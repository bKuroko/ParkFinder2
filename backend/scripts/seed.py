from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT))

from app import models  # noqa: E402
from app.core.security import get_password_hash  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402


def rectangle(x: int, y: int, width: int, height: int) -> list[dict[str, float]]:
    return [
        {"x": x, "y": y},
        {"x": x + width, "y": y},
        {"x": x + width, "y": y + height},
        {"x": x, "y": y + height},
    ]


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        facility = db.query(models.Facility).filter_by(facility_code="FAC-001").one_or_none()
        if facility is None:
            facility = db.query(models.Facility).filter_by(facility_code="MTR-001").one_or_none()
        if facility is None:
            facility = db.query(models.Facility).filter_by(facility_code="CPF-001").one_or_none()
        if facility is None:
            facility = models.Facility(
                facility_code="FAC-001",
                name="Montero Parking Lot",
                address="Cagayan de Oro City, Misamis Oriental",
                latitude=8.459434,
                longitude=124.607614,
                total_slots=12,
            )
            db.add(facility)
            db.flush()
        else:
            facility.facility_code = "FAC-001"
            facility.name = "Montero Parking Lot"
            facility.address = "Cagayan de Oro City, Misamis Oriental"
            facility.latitude = 8.459434
            facility.longitude = 124.607614
            facility.total_slots = 12

        camera = db.query(models.Camera).filter_by(facility_id=facility.id, name="Montero CCTV").one_or_none()
        old_camera = db.query(models.Camera).filter_by(facility_id=facility.id, name="Entrance CCTV").one_or_none()
        if camera is None and old_camera is not None:
            camera = old_camera
        if camera is None:
            camera = models.Camera(
                facility_id=facility.id,
                name="Montero CCTV",
                source_url="montero-parking-sample.mp4",
                status="online",
                last_heartbeat_at=datetime.now(timezone.utc),
            )
            db.add(camera)
            db.flush()
        else:
            camera.name = "Montero CCTV"
            camera.source_url = "montero-parking-sample.mp4"
            camera.status = "online"
            camera.last_heartbeat_at = datetime.now(timezone.utc)

        slot_layout = []
        for index in range(6):
            slot_layout.append((f"A{index + 1}", rectangle(80 + index * 95, 120, 72, 128)))
        for index in range(6):
            slot_layout.append((f"B{index + 1}", rectangle(80 + index * 95, 330, 72, 128)))

        desired_slot_numbers = {slot_number for slot_number, _ in slot_layout}
        extra_slots = (
            db.query(models.ParkingSlot)
            .filter(models.ParkingSlot.facility_id == facility.id)
            .filter(~models.ParkingSlot.slot_number.in_(desired_slot_numbers))
            .all()
        )
        for extra_slot in extra_slots:
            db.query(models.OccupancyRecord).filter_by(slot_id=extra_slot.id).delete()
            db.delete(extra_slot)

        occupied_slots = {"A2", "A4", "B1", "B3", "B6", "A6", "B5"}
        for slot_number, polygon in slot_layout:
            slot = (
                db.query(models.ParkingSlot)
                .filter_by(facility_id=facility.id, slot_number=slot_number)
                .one_or_none()
            )
            if slot is None:
                slot = models.ParkingSlot(
                    facility_id=facility.id,
                    slot_number=slot_number,
                    polygon=polygon,
                    is_occupied=slot_number in occupied_slots,
                    confidence=0.92 if slot_number in occupied_slots else 0.0,
                    last_seen_at=datetime.now(timezone.utc),
                )
                db.add(slot)
            else:
                slot.polygon = polygon
                slot.is_occupied = slot_number in occupied_slots
                slot.confidence = 0.92 if slot_number in occupied_slots else 0.0
                slot.last_seen_at = datetime.now(timezone.utc)

        db.flush()
        if db.query(models.OccupancyRecord).count() == 0:
            for slot in db.query(models.ParkingSlot).filter_by(facility_id=facility.id).all():
                db.add(
                    models.OccupancyRecord(
                        slot_id=slot.id,
                        status="occupied" if slot.is_occupied else "available",
                        timestamp=datetime.now(timezone.utc),
                    )
                )

        admin = db.query(models.AdminUser).filter_by(email="admin@parkfinder.local").one_or_none()
        if admin is None:
            admin = models.AdminUser(
                email="admin@parkfinder.local",
                full_name="Montero Parking Admin",
                hashed_password=get_password_hash("admin123"),
                facility_id=facility.id,
            )
            db.add(admin)
        else:
            admin.full_name = "Montero Parking Admin"
            admin.facility_id = facility.id

        existing_history = (
            db.query(models.OccupancySnapshot).filter_by(facility_id=facility.id).count()
        )
        if existing_history == 0:
            now = datetime.now(timezone.utc)
            sample_percentages = [25, 33, 42, 50, 58, 67, 58, 58]
            for offset, percentage in enumerate(sample_percentages):
                occupied = round((percentage / 100) * facility.total_slots)
                db.add(
                    models.OccupancySnapshot(
                        facility_id=facility.id,
                        available_slots=facility.total_slots - occupied,
                        occupied_slots=occupied,
                        occupancy_percentage=percentage,
                        captured_at=now - timedelta(hours=len(sample_percentages) - offset),
                    )
                )
        else:
            latest_snapshot = models.OccupancySnapshot(
                facility_id=facility.id,
                available_slots=5,
                occupied_slots=7,
                occupancy_percentage=58.33,
            )
            db.add(latest_snapshot)

        existing_logs = db.query(models.MonitoringLog).filter_by(facility_id=facility.id).count()
        if existing_logs == 0:
            db.add_all(
                [
                    models.MonitoringLog(
                        facility_id=facility.id,
                        camera_id=camera.id,
                        level="info",
                        message="Seed data loaded for Montero Parking Lot",
                        details={"source": "seed"},
                    ),
                    models.MonitoringLog(
                        facility_id=facility.id,
                        camera_id=camera.id,
                        level="info",
                        message="Montero CCTV stream is online",
                        details={"camera": "Montero CCTV"},
                    ),
                ]
            )

        db.commit()
        print("Seed complete.")
        print("Admin login: admin@parkfinder.local / admin123")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
