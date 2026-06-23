from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models
from app.schemas import FacilityDetail, FacilitySummary


def calculate_facility_counts(db: Session, facility_id: int) -> tuple[int, int, int, float]:
    total = db.scalar(
        select(func.count(models.ParkingSlot.id)).where(models.ParkingSlot.facility_id == facility_id)
    ) or 0
    occupied = db.scalar(
        select(func.count(models.ParkingSlot.id)).where(
            models.ParkingSlot.facility_id == facility_id,
            models.ParkingSlot.is_occupied.is_(True),
        )
    ) or 0
    available = max(total - occupied, 0)
    percentage = round((occupied / total) * 100, 2) if total else 0.0
    return total, available, occupied, percentage


def facility_to_summary(db: Session, facility: models.Facility) -> FacilitySummary:
    total, available, occupied, percentage = calculate_facility_counts(db, facility.id)
    return FacilitySummary(
        id=facility.id,
        facility_code=facility.facility_code,
        name=facility.name,
        address=facility.address,
        latitude=facility.latitude,
        longitude=facility.longitude,
        total_slots=total or facility.total_slots,
        available_slots=available,
        occupied_slots=occupied,
        occupancy_percentage=percentage,
    )


def facility_to_detail(db: Session, facility: models.Facility) -> FacilityDetail:
    summary = facility_to_summary(db, facility)
    return FacilityDetail(
        **summary.model_dump(),
        slots=sorted(facility.slots, key=lambda slot: slot.slot_number),
        cameras=facility.cameras,
    )


def create_occupancy_snapshot(db: Session, facility_id: int) -> models.OccupancySnapshot:
    _, available, occupied, percentage = calculate_facility_counts(db, facility_id)
    snapshot = models.OccupancySnapshot(
        facility_id=facility_id,
        available_slots=available,
        occupied_slots=occupied,
        occupancy_percentage=percentage,
    )
    db.add(snapshot)
    return snapshot


def touch_camera(db: Session, camera_id: int | None, status: str) -> None:
    if camera_id is None:
        return
    camera = db.get(models.Camera, camera_id)
    if camera:
        camera.status = status
        camera.last_heartbeat_at = datetime.now(timezone.utc)
