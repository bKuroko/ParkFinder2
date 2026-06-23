from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import models
from app.db.session import get_db
from app.schemas import FacilityAvailability, FacilityDetail, FacilitySummary, OccupancyHistoryItem
from app.services import facility_to_detail, facility_to_summary


router = APIRouter(prefix="/facilities", tags=["driver-public"])


@router.get("", response_model=list[FacilitySummary])
def list_facilities(search: str | None = None, db: Session = Depends(get_db)) -> list[FacilitySummary]:
    statement = select(models.Facility).order_by(models.Facility.name)
    if search:
        like_term = f"%{search.strip()}%"
        statement = statement.where(
            models.Facility.name.ilike(like_term) | models.Facility.facility_code.ilike(like_term)
        )
    facilities = db.scalars(statement).all()
    return [facility_to_summary(db, facility) for facility in facilities]


@router.get("/{facility_id}", response_model=FacilityDetail)
def get_facility(facility_id: int, db: Session = Depends(get_db)) -> FacilityDetail:
    facility = db.scalar(
        select(models.Facility)
        .where(models.Facility.id == facility_id)
        .options(selectinload(models.Facility.slots), selectinload(models.Facility.cameras))
    )
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")
    return facility_to_detail(db, facility)


@router.get("/{facility_id}/availability", response_model=FacilityAvailability)
def get_facility_availability(facility_id: int, db: Session = Depends(get_db)) -> FacilityAvailability:
    facility = db.get(models.Facility, facility_id)
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")

    summary = facility_to_summary(db, facility)
    latest_slot_update = db.scalar(
        select(models.ParkingSlot.last_seen_at)
        .where(models.ParkingSlot.facility_id == facility_id)
        .order_by(models.ParkingSlot.last_seen_at.desc())
        .limit(1)
    )
    return FacilityAvailability(
        facility_id=summary.id,
        facility_code=summary.facility_code,
        facility_name=summary.name,
        total_slots=summary.total_slots,
        available_slots=summary.available_slots,
        occupied_slots=summary.occupied_slots,
        occupancy_percentage=summary.occupancy_percentage,
        updated_at=latest_slot_update,
    )


@router.get("/{facility_id}/history", response_model=list[OccupancyHistoryItem])
def get_facility_history(
    facility_id: int,
    limit: int = 24,
    db: Session = Depends(get_db),
) -> list[models.OccupancySnapshot]:
    facility = db.get(models.Facility, facility_id)
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")
    return list(
        db.scalars(
            select(models.OccupancySnapshot)
            .where(models.OccupancySnapshot.facility_id == facility_id)
            .order_by(models.OccupancySnapshot.captured_at.desc())
            .limit(min(limit, 100))
        ).all()
    )
