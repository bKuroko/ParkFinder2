from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.core.config import get_settings
from app.db.session import get_db
from app.schemas import SlotStatusIngest
from app.services import create_occupancy_snapshot, touch_camera


router = APIRouter(prefix="/ingest", tags=["ai-ingest"])


def require_ai_api_key(x_api_key: str | None = Header(default=None)) -> None:
    if x_api_key != get_settings().ai_ingest_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid AI ingest API key")


@router.post("/slot-status")
def ingest_slot_status(
    payload: SlotStatusIngest,
    db: Session = Depends(get_db),
    _: None = Depends(require_ai_api_key),
) -> dict[str, object]:
    facility = db.get(models.Facility, payload.facility_id)
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")

    now = datetime.now(timezone.utc)
    slots_by_number = {
        slot.slot_number: slot
        for slot in db.scalars(
            select(models.ParkingSlot).where(models.ParkingSlot.facility_id == payload.facility_id)
        ).all()
    }

    updated = 0
    for detected_slot in payload.slots:
        slot = slots_by_number.get(detected_slot.slot_number)
        if not slot:
            continue
        previous_status = slot.is_occupied
        slot.is_occupied = detected_slot.is_occupied
        slot.confidence = detected_slot.confidence
        slot.last_seen_at = now
        db.add(
            models.OccupancyRecord(
                slot_id=slot.id,
                status="occupied" if detected_slot.is_occupied else "available",
                timestamp=now,
            )
        )
        if previous_status != detected_slot.is_occupied:
            event_type = "vehicle_entry" if detected_slot.is_occupied else "vehicle_exit"
            status_label = "occupied" if detected_slot.is_occupied else "available"
            db.add(
                models.MonitoringLog(
                    facility_id=payload.facility_id,
                    camera_id=payload.camera_id,
                    level="info",
                    message=f"Slot {slot.slot_number} changed to {status_label}",
                    details={
                        "event_type": event_type,
                        "slot_number": slot.slot_number,
                        "status": status_label,
                        "confidence": detected_slot.confidence,
                    },
                )
            )
        updated += 1

    db.flush()
    touch_camera(db, payload.camera_id, payload.camera_status)
    snapshot = create_occupancy_snapshot(db, payload.facility_id)
    db.add(
        models.MonitoringLog(
            facility_id=payload.facility_id,
            camera_id=payload.camera_id,
            level="info",
            message=f"AI processor updated {updated} slots",
            details={
                "event_type": "ai_update",
                "updated_slots": updated,
                "camera_status": payload.camera_status,
            },
        )
    )
    db.commit()
    db.refresh(snapshot)
    return {
        "updated_slots": updated,
        "available_slots": snapshot.available_slots,
        "occupied_slots": snapshot.occupied_slots,
        "occupancy_percentage": snapshot.occupancy_percentage,
    }
