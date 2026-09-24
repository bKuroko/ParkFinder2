import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app import models
from app.api.deps import get_current_admin, require_facility_access, require_super_admin
from app.db.session import get_db
from app.schemas import (
    AdminProfile,
    DashboardResponse,
    FacilitySummary,
    MonitoringLogItem,
    ParkingLotSubmissionCreate,
    ParkingLotSubmissionItem,
)
from app.services import facility_to_summary


router = APIRouter(prefix="/admin", tags=["admin"])


def _submission_item(
    db: Session, submission: models.ParkingLotSubmission
) -> ParkingLotSubmissionItem:
    submitter = db.get(models.AdminUser, submission.submitted_by_admin_id)
    if submitter is None:
        raise HTTPException(status_code=500, detail="Parking lot submitter no longer exists")
    return ParkingLotSubmissionItem(
        id=submission.id,
        name=submission.name,
        address=submission.address,
        latitude=submission.latitude,
        longitude=submission.longitude,
        total_slots=submission.total_slots,
        status=submission.status,
        submitted_by_admin_id=submission.submitted_by_admin_id,
        submitter_name=submitter.full_name,
        submitter_email=submitter.email,
        reviewed_by_admin_id=submission.reviewed_by_admin_id,
        facility_id=submission.facility_id,
        submitted_at=submission.submitted_at,
        reviewed_at=submission.reviewed_at,
    )


def _pending_submission(db: Session, submission_id: int) -> models.ParkingLotSubmission:
    submission = db.get(models.ParkingLotSubmission, submission_id)
    if submission is None:
        raise HTTPException(status_code=404, detail="Parking lot submission not found")
    if submission.status != "pending":
        raise HTTPException(status_code=409, detail="Parking lot submission was already reviewed")
    return submission


def _next_facility_code(db: Session) -> str:
    highest_number = 0
    for code in db.scalars(select(models.Facility.facility_code)).all():
        match = re.fullmatch(r"FAC-(\d+)", code)
        if match:
            highest_number = max(highest_number, int(match.group(1)))
    return f"FAC-{highest_number + 1:03d}"


def _admin_facility_id(admin: models.AdminUser, requested_facility_id: int | None) -> int:
    if admin.is_super_admin:
        if requested_facility_id is None:
            raise HTTPException(status_code=400, detail="facility_id is required for super admins")
        return requested_facility_id

    target_facility_id = requested_facility_id or admin.facility_id
    if target_facility_id is None and admin.facility_ids:
        target_facility_id = admin.facility_ids[0]
    if target_facility_id is None:
        raise HTTPException(status_code=403, detail="No facilities are assigned to this admin")
    require_facility_access(admin, target_facility_id)
    return target_facility_id


@router.get("/facilities", response_model=list[FacilitySummary])
def list_admin_facilities(
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(get_current_admin),
) -> list[FacilitySummary]:
    statement = select(models.Facility).order_by(models.Facility.name)
    if not current_admin.is_super_admin:
        statement = statement.where(models.Facility.id.in_(current_admin.facility_ids))
    facilities = db.scalars(statement).all()
    return [facility_to_summary(db, facility) for facility in facilities]


@router.get("/users", response_model=list[AdminProfile])
def list_admin_users(
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(require_super_admin),
) -> list[models.AdminUser]:
    return list(db.scalars(select(models.AdminUser).order_by(models.AdminUser.full_name)).all())


@router.get("/parking-lot-submissions", response_model=list[ParkingLotSubmissionItem])
def list_parking_lot_submissions(
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(get_current_admin),
) -> list[ParkingLotSubmissionItem]:
    statement = select(models.ParkingLotSubmission).order_by(
        models.ParkingLotSubmission.submitted_at.desc()
    )
    if not current_admin.is_super_admin:
        statement = statement.where(
            models.ParkingLotSubmission.submitted_by_admin_id == current_admin.id
        )
    submissions = db.scalars(statement).all()
    return [_submission_item(db, submission) for submission in submissions]


@router.post(
    "/parking-lot-submissions",
    response_model=ParkingLotSubmissionItem,
    status_code=status.HTTP_201_CREATED,
)
def create_parking_lot_submission(
    payload: ParkingLotSubmissionCreate,
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(get_current_admin),
) -> ParkingLotSubmissionItem:
    if current_admin.is_super_admin:
        raise HTTPException(
            status_code=403,
            detail="Super admins review parking lots; a facility owner must submit the request",
        )

    submission = models.ParkingLotSubmission(
        name=payload.name.strip(),
        address=payload.address.strip(),
        latitude=payload.latitude,
        longitude=payload.longitude,
        total_slots=payload.total_slots,
        status="pending",
        submitted_by_admin_id=current_admin.id,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return _submission_item(db, submission)


@router.post(
    "/parking-lot-submissions/{submission_id}/approve",
    response_model=ParkingLotSubmissionItem,
)
def approve_parking_lot_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    super_admin: models.AdminUser = Depends(require_super_admin),
) -> ParkingLotSubmissionItem:
    submission = _pending_submission(db, submission_id)
    duplicate = db.scalar(
        select(models.Facility).where(
            func.lower(models.Facility.name) == submission.name.casefold()
        )
    )
    if duplicate:
        raise HTTPException(
            status_code=409,
            detail="A facility with this name already exists",
        )

    facility = models.Facility(
        facility_code=_next_facility_code(db),
        name=submission.name,
        address=submission.address,
        latitude=submission.latitude,
        longitude=submission.longitude,
        total_slots=submission.total_slots,
    )
    db.add(facility)
    db.flush()

    submitter = db.get(models.AdminUser, submission.submitted_by_admin_id)
    if submitter is None:
        raise HTTPException(status_code=409, detail="The submitting account no longer exists")
    if facility not in submitter.assigned_facilities:
        submitter.assigned_facilities.append(facility)
    if submitter.facility_id is None:
        submitter.facility_id = facility.id

    submission.status = "approved"
    submission.reviewed_by_admin_id = super_admin.id
    submission.reviewed_at = datetime.now(timezone.utc)
    submission.facility_id = facility.id
    db.commit()
    db.refresh(submission)
    return _submission_item(db, submission)


@router.post(
    "/parking-lot-submissions/{submission_id}/reject",
    response_model=ParkingLotSubmissionItem,
)
def reject_parking_lot_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    super_admin: models.AdminUser = Depends(require_super_admin),
) -> ParkingLotSubmissionItem:
    submission = _pending_submission(db, submission_id)
    submission.status = "rejected"
    submission.reviewed_by_admin_id = super_admin.id
    submission.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(submission)
    return _submission_item(db, submission)


@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(
    facility_id: int | None = None,
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(get_current_admin),
) -> DashboardResponse:
    target_facility_id = _admin_facility_id(current_admin, facility_id)
    require_facility_access(current_admin, target_facility_id)

    facility = db.scalar(
        select(models.Facility)
        .where(models.Facility.id == target_facility_id)
        .options(selectinload(models.Facility.cameras))
    )
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")

    history = list(
        db.scalars(
            select(models.OccupancySnapshot)
            .where(models.OccupancySnapshot.facility_id == target_facility_id)
            .order_by(models.OccupancySnapshot.captured_at.desc())
            .limit(24)
        ).all()
    )
    logs = list(
        db.scalars(
            select(models.MonitoringLog)
            .where(models.MonitoringLog.facility_id == target_facility_id)
            .order_by(models.MonitoringLog.created_at.desc())
            .limit(20)
        ).all()
    )

    return DashboardResponse(
        facility=facility_to_summary(db, facility),
        cameras=facility.cameras,
        history=history,
        logs=logs,
    )


@router.get("/logs", response_model=list[MonitoringLogItem])
def get_logs(
    facility_id: int | None = None,
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(get_current_admin),
) -> list[models.MonitoringLog]:
    target_facility_id = _admin_facility_id(current_admin, facility_id)
    require_facility_access(current_admin, target_facility_id)
    return list(
        db.scalars(
            select(models.MonitoringLog)
            .where(models.MonitoringLog.facility_id == target_facility_id)
            .order_by(models.MonitoringLog.created_at.desc())
            .limit(100)
        ).all()
    )


@router.get("/reports")
def get_reports(
    facility_id: int | None = None,
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(get_current_admin),
) -> dict[str, object]:
    target_facility_id = _admin_facility_id(current_admin, facility_id)
    require_facility_access(current_admin, target_facility_id)
    snapshots = list(
        db.scalars(
            select(models.OccupancySnapshot)
            .where(models.OccupancySnapshot.facility_id == target_facility_id)
            .order_by(models.OccupancySnapshot.captured_at.desc())
            .limit(100)
        ).all()
    )
    if not snapshots:
        return {"average_occupancy_percentage": 0, "peak_occupancy_percentage": 0, "sample_count": 0}

    percentages = [snapshot.occupancy_percentage for snapshot in snapshots]
    return {
        "average_occupancy_percentage": round(sum(percentages) / len(percentages), 2),
        "peak_occupancy_percentage": max(percentages),
        "sample_count": len(snapshots),
    }
