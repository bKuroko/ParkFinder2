import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload
from pydantic import ValidationError

from app import models
from app.api.deps import get_current_admin, require_facility_access, require_super_admin
from app.db.session import get_db
from app.schemas import (
    AdminProfile,
    DashboardResponse,
    FacilitySummary,
    FacilityDetail,
    FacilityCreate,
    FacilityUpdate,
    MonitoringLogItem,
    ParkingLotSubmissionCreate,
    ParkingLotSubmissionItem,
)
from app.services import create_occupancy_snapshot, facility_to_summary, facility_to_detail


router = APIRouter(prefix="/admin", tags=["admin"])


def _active_facility(db: Session, facility_id: int) -> models.Facility:
    facility = db.get(models.Facility, facility_id)
    if not facility or facility.is_deleted:
        raise HTTPException(status_code=404, detail="Facility not found")
    return facility


def _lot_values(data: dict) -> dict:
    try:
        values = ParkingLotSubmissionCreate.model_validate(data).model_dump()
        values["name"] = values["name"].strip()
        values["address"] = values["address"].strip()
        return ParkingLotSubmissionCreate.model_validate(values).model_dump()
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail="Enter a valid name, address, coordinates, and slot capacity") from exc


def _owner(db: Session, owner_id: int) -> models.AdminUser:
    owner = db.get(models.AdminUser, owner_id)
    if not owner or owner.is_deleted or not owner.is_active or owner.is_super_admin or owner.approval_status != "approved":
        raise HTTPException(status_code=422, detail="Select an active, approved parking owner")
    return owner


def _ensure_unique_name(db: Session, name: str, exclude_id: int | None = None) -> None:
    statement = select(models.Facility).where(models.Facility.is_deleted.is_(False), func.lower(models.Facility.name) == name.lower())
    if exclude_id is not None:
        statement = statement.where(models.Facility.id != exclude_id)
    if db.scalar(statement):
        raise HTTPException(status_code=409, detail="A facility with this name already exists")


@router.post("/facilities", response_model=FacilitySummary, status_code=201)
def create_facility(payload: FacilityCreate, db: Session = Depends(get_db), _: models.AdminUser = Depends(get_current_admin)):
    raise HTTPException(status_code=403, detail="Parking lots must be submitted by their owner for approval")


@router.patch("/facilities/{facility_id}", response_model=FacilitySummary)
def update_facility(facility_id: int, payload: FacilityUpdate, db: Session = Depends(get_db), current_admin: models.AdminUser = Depends(get_current_admin)):
    if current_admin.is_super_admin:
        raise HTTPException(status_code=403, detail="Only the assigned parking owner can edit or delete this lot")
    require_facility_access(current_admin, facility_id)
    facility = _active_facility(db, facility_id)
    changes = payload.model_dump(exclude_unset=True)
    if "owner_id" in changes:
        raise HTTPException(status_code=403, detail="Parking lot ownership cannot be changed here")
    fields = _lot_values({**{key: getattr(facility, key) for key in ("name", "address", "latitude", "longitude", "total_slots")}, **changes})
    _ensure_unique_name(db, fields["name"], facility.id)
    has_slots = db.scalar(select(models.ParkingSlot.id).where(models.ParkingSlot.facility_id == facility.id).limit(1))
    if has_slots and fields["total_slots"] != facility.total_slots:
        raise HTTPException(status_code=409, detail="This lot has configured parking slots. Change its slot configuration before changing capacity.")
    for key, value in fields.items():
        setattr(facility, key, value)
    db.commit()
    return facility_to_summary(db, facility)


@router.get("/facilities/{facility_id}", response_model=FacilityDetail)
def read_admin_facility(facility_id: int, db: Session = Depends(get_db), current_admin: models.AdminUser = Depends(get_current_admin)):
    require_facility_access(current_admin, facility_id)
    return facility_to_detail(db, _active_facility(db, facility_id))


@router.delete("/facilities/{facility_id}")
def delete_facility(facility_id: int, db: Session = Depends(get_db), current_admin: models.AdminUser = Depends(get_current_admin)):
    if current_admin.is_super_admin:
        raise HTTPException(status_code=403, detail="Only the assigned parking owner can edit or delete this lot")
    require_facility_access(current_admin, facility_id)
    facility = _active_facility(db, facility_id)
    facility.is_deleted = True
    db.commit()
    return {"message": "Parking lot deleted. Monitoring history has been retained."}


@router.delete("/users/{admin_id}")
def delete_admin_user(admin_id: int, db: Session = Depends(get_db), current_admin: models.AdminUser = Depends(require_super_admin)):
    account = db.get(models.AdminUser, admin_id)
    if not account or account.is_deleted:
        raise HTTPException(status_code=404, detail="Account not found")
    if account.id == current_admin.id:
        raise HTTPException(status_code=409, detail="You cannot delete your signed-in account")
    if account.is_super_admin and not any(a.id != account.id and a.is_super_admin and a.is_active and a.approval_status == "approved"
            for a in db.scalars(select(models.AdminUser).where(models.AdminUser.is_deleted.is_(False))).all()):
        raise HTTPException(status_code=409, detail="The last active super admin cannot be deleted")
    if db.scalar(select(models.Facility.id).where(models.Facility.id.in_(account.facility_ids), models.Facility.is_deleted.is_(False)).limit(1)):
        raise HTTPException(status_code=409, detail="This account still manages active parking lots. The owner must remove those lots before the account can be deleted.")
    account.account_role = account.role
    account.is_deleted = True
    account.is_active = False
    db.commit()
    return {"message": "Account deleted. Login access removed; parking history retained."}


@router.post("/facilities/{facility_id}/slots/count")
def adjust_slot_count(
    facility_id: int,
    payload: dict[str, str],
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(get_current_admin),
) -> dict[str, object]:
    require_facility_access(current_admin, facility_id)
    direction = payload.get("direction")
    if direction not in {"in", "out"}:
        raise HTTPException(status_code=422, detail="direction must be 'in' or 'out'")
    facility = _active_facility(db, facility_id)
    slots = list(db.scalars(select(models.ParkingSlot).where(models.ParkingSlot.facility_id == facility_id).order_by(models.ParkingSlot.slot_number)).all())
    if not slots:
        slots = [models.ParkingSlot(facility_id=facility_id, slot_number=f"MANUAL-{i:04d}", polygon=[], is_occupied=False, confidence=0) for i in range(1, facility.total_slots + 1)]
        db.add_all(slots)
        db.flush()
    target = next((slot for slot in slots if slot.is_occupied == (direction == "out")), None)
    if target is None:
        raise HTTPException(status_code=409, detail="No available slots" if direction == "in" else "No occupied slots")
    occupied = direction == "in"
    target.is_occupied = occupied
    target.confidence = 1.0
    now = datetime.now(timezone.utc)
    target.last_seen_at = now
    status_label = "occupied" if occupied else "available"
    db.add(models.OccupancyRecord(slot_id=target.id, status=status_label, timestamp=now))
    db.add(models.MonitoringLog(facility_id=facility_id, level="info", message=f"Admin recorded vehicle {direction}; {target.slot_number} is {status_label}", details={"event_type": "vehicle_entry" if occupied else "vehicle_exit", "slot_number": target.slot_number, "status": status_label, "source": "admin"}))
    db.flush()
    snapshot = create_occupancy_snapshot(db, facility_id)
    db.commit()
    return {"available_slots": snapshot.available_slots, "occupied_slots": snapshot.occupied_slots, "total_slots": facility.total_slots}


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
    if submission is None or submission.is_deleted:
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
    statement = select(models.Facility).where(models.Facility.is_deleted.is_(False)).order_by(models.Facility.name)
    if not current_admin.is_super_admin:
        statement = statement.where(models.Facility.id.in_(current_admin.facility_ids))
    facilities = db.scalars(statement).all()
    return [facility_to_summary(db, facility) for facility in facilities]


@router.get("/users", response_model=list[AdminProfile])
def list_admin_users(
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(require_super_admin),
) -> list[models.AdminUser]:
    return list(db.scalars(select(models.AdminUser).where(models.AdminUser.is_deleted.is_(False)).order_by(models.AdminUser.full_name)).all())


def _review_account(admin_id: int, approved: bool, db: Session) -> models.AdminUser:
    account = db.get(models.AdminUser, admin_id)
    if account is None or account.is_deleted:
        raise HTTPException(status_code=404, detail="Account not found")
    if account.approval_status != "pending":
        raise HTTPException(status_code=409, detail="Account registration was already reviewed")
    account.account_role = "facility_admin"
    account.account_approval_status = "approved" if approved else "rejected"
    account.is_active = approved
    db.commit()
    db.refresh(account)
    return account


@router.post("/users/{admin_id}/approve", response_model=AdminProfile)
def approve_admin_user(
    admin_id: int,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(require_super_admin),
) -> models.AdminUser:
    return _review_account(admin_id, True, db)


@router.post("/users/{admin_id}/reject", response_model=AdminProfile)
def reject_admin_user(
    admin_id: int,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(require_super_admin),
) -> models.AdminUser:
    return _review_account(admin_id, False, db)


@router.get("/parking-lot-submissions", response_model=list[ParkingLotSubmissionItem])
def list_parking_lot_submissions(
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(get_current_admin),
) -> list[ParkingLotSubmissionItem]:
    active_admins = select(models.AdminUser.id).where(models.AdminUser.is_deleted.is_(False))
    active_facilities = select(models.Facility.id).where(models.Facility.is_deleted.is_(False))
    statement = select(models.ParkingLotSubmission).where(
        models.ParkingLotSubmission.is_deleted.is_(False),
        models.ParkingLotSubmission.submitted_by_admin_id.in_(active_admins),
        (models.ParkingLotSubmission.facility_id.is_(None)) | models.ParkingLotSubmission.facility_id.in_(active_facilities),
    ).order_by(
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
        **_lot_values(payload.model_dump()),
        status="pending",
        submitted_by_admin_id=current_admin.id,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return _submission_item(db, submission)


@router.patch("/parking-lot-submissions/{submission_id}", response_model=ParkingLotSubmissionItem)
def update_parking_lot_submission(submission_id: int, payload: FacilityUpdate, db: Session = Depends(get_db), current_admin: models.AdminUser = Depends(get_current_admin)):
    submission = db.get(models.ParkingLotSubmission, submission_id)
    _manage_request(submission, current_admin)
    fields = {key: getattr(submission, key) for key in ("name", "address", "latitude", "longitude", "total_slots")}
    changes = payload.model_dump(exclude_unset=True, exclude={"owner_id"})
    for key, value in _lot_values({**fields, **changes}).items():
        setattr(submission, key, value)
    submission.status = "pending"
    submission.reviewed_at = None
    submission.reviewed_by_admin_id = None
    submission.submitted_at = datetime.now(timezone.utc)
    db.commit()
    return _submission_item(db, submission)


def _manage_request(submission, admin) -> None:
    if admin.is_super_admin:
        raise HTTPException(status_code=403, detail="Only the submitting owner can edit or delete a parking lot request")
    if not submission or submission.is_deleted:
        raise HTTPException(status_code=404, detail="Parking lot request not found")
    if not admin.is_super_admin and submission.submitted_by_admin_id != admin.id:
        raise HTTPException(status_code=403, detail="You cannot manage another owner's parking lot request")
    if submission.status == "approved":
        raise HTTPException(status_code=409, detail="Manage the approved parking lot in the facility list")


@router.delete("/parking-lot-submissions/{submission_id}")
def delete_parking_lot_submission(submission_id: int, db: Session = Depends(get_db), current_admin: models.AdminUser = Depends(get_current_admin)):
    submission = db.get(models.ParkingLotSubmission, submission_id)
    _manage_request(submission, current_admin)
    submission.is_deleted = True
    db.commit()
    return {"message": "Parking lot request deleted"}


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
    _owner(db, submission.submitted_by_admin_id)
    duplicate = db.scalar(
        select(models.Facility).where(
            func.lower(models.Facility.name) == submission.name.casefold(),
            models.Facility.is_deleted.is_(False),
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
    if submitter is None or submitter.is_deleted:
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
    if not facility or facility.is_deleted:
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
    _active_facility(db, target_facility_id)
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
    _active_facility(db, target_facility_id)
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
