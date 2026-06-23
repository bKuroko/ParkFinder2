from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import models
from app.api.deps import get_current_admin, require_facility_access
from app.db.session import get_db
from app.schemas import DashboardResponse, FacilitySummary, MonitoringLogItem
from app.services import facility_to_summary


router = APIRouter(prefix="/admin", tags=["admin"])


def _admin_facility_id(admin: models.AdminUser, requested_facility_id: int | None) -> int:
    if admin.facility_id is not None:
        return admin.facility_id
    if requested_facility_id is None:
        raise HTTPException(status_code=400, detail="facility_id is required for unrestricted admins")
    return requested_facility_id


@router.get("/facilities", response_model=list[FacilitySummary])
def list_admin_facilities(
    db: Session = Depends(get_db),
    current_admin: models.AdminUser = Depends(get_current_admin),
) -> list[FacilitySummary]:
    statement = select(models.Facility).order_by(models.Facility.name)
    if current_admin.facility_id is not None:
        statement = statement.where(models.Facility.id == current_admin.facility_id)
    facilities = db.scalars(statement).all()
    return [facility_to_summary(db, facility) for facility in facilities]


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
