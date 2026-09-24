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


# These names and coordinates come from map-listed CDO parking places. The
# coordinates are the decoded centers of their published Plus Codes. Capacity
# is intentionally demo seed data; it is not claimed as a surveyed slot count.
VERIFIED_CDO_FACILITIES = [
    {
        "facility_code": "FAC-002",
        "name": "Chowking Divisoria Parking Lot",
        "address": "FJHV+248, Divisoria, Cagayan de Oro City, Misamis Oriental",
        "latitude": 8.4775375,
        "longitude": 124.6428281,
        "total_slots": 18,
    },
    {
        "facility_code": "FAC-003",
        "name": "TODC Pay Parking",
        "address": "FJGV+835, Cagayan de Oro City, Misamis Oriental",
        "latitude": 8.4757625,
        "longitude": 124.6427344,
        "total_slots": 24,
    },
    {
        "facility_code": "FAC-004",
        "name": "Pearlmont Hotel Carpark",
        "address": "FMH3+9JX, Cagayan de Oro City, Misamis Oriental",
        "latitude": 8.4784875,
        "longitude": 124.6541094,
        "total_slots": 28,
    },
    {
        "facility_code": "FAC-005",
        "name": "Limketkai Parking Lot",
        "address": "FMJ4+CW7, Limketkai Center, Cagayan de Oro City, Misamis Oriental",
        "latitude": 8.4810375,
        "longitude": 124.6572969,
        "total_slots": 80,
    },
    {
        "facility_code": "FAC-006",
        "name": "Limketkai Luxe Hotel Parking Lot",
        "address": "FMM5+C25, Limketkai Center, Cagayan de Oro City, Misamis Oriental",
        "latitude": 8.4835125,
        "longitude": 124.6576094,
        "total_slots": 45,
    },
    {
        "facility_code": "FAC-007",
        "name": "Puregold Parking Lot",
        "address": "FMM5+8FR, Cagayan de Oro City, Misamis Oriental",
        "latitude": 8.4833625,
        "longitude": 124.6586406,
        "total_slots": 60,
    },
    {
        "facility_code": "FAC-008",
        "name": "Pay Parking Area - Corrales Extension",
        "address": "FMQ2+29Q, Corrales Extension, Cagayan de Oro City, Misamis Oriental",
        "latitude": 8.4875875,
        "longitude": 124.6509844,
        "total_slots": 35,
    },
    {
        "facility_code": "FAC-009",
        "name": "Lifestyle District Parking Lot",
        "address": "FMQ2+8M7, 946 Corrales Extension, Cagayan de Oro City, Misamis Oriental",
        "latitude": 8.4882875,
        "longitude": 124.6516719,
        "total_slots": 50,
    },
]


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

        super_admin = (
            db.query(models.AdminUser)
            .filter_by(email="superadmin@parkfinder.local")
            .one_or_none()
        )
        if super_admin is None:
            super_admin = models.AdminUser(
                email="superadmin@parkfinder.local",
                full_name="ParkFinder Super Admin",
                hashed_password=get_password_hash("superadmin123"),
                facility_id=None,
            )
            db.add(super_admin)
        else:
            super_admin.full_name = "ParkFinder Super Admin"
            super_admin.facility_id = None
            super_admin.is_active = True

        facilities_by_code = {facility.facility_code: facility}
        for spec in VERIFIED_CDO_FACILITIES:
            parking_facility = (
                db.query(models.Facility)
                .filter_by(facility_code=spec["facility_code"])
                .one_or_none()
            )
            if parking_facility is None:
                parking_facility = models.Facility(
                    facility_code=spec["facility_code"],
                    name=spec["name"],
                    address=spec["address"],
                    latitude=spec["latitude"],
                    longitude=spec["longitude"],
                    total_slots=spec["total_slots"],
                )
                db.add(parking_facility)
                db.flush()
            else:
                parking_facility.name = spec["name"]
                parking_facility.address = spec["address"]
                parking_facility.latitude = spec["latitude"]
                parking_facility.longitude = spec["longitude"]
                parking_facility.total_slots = spec["total_slots"]

            facilities_by_code[spec["facility_code"]] = parking_facility

            # Remove the former generated camera/slot/history demo only once.
            # Future seed runs leave real monitoring data alone.
            has_legacy_demo = db.query(models.Camera).filter_by(
                facility_id=parking_facility.id,
                source_url="pending-cctv-setup",
            ).first()
            if has_legacy_demo:
                slot_ids = [
                    slot_id
                    for (slot_id,) in db.query(models.ParkingSlot.id)
                    .filter_by(facility_id=parking_facility.id)
                    .all()
                ]
                if slot_ids:
                    db.query(models.OccupancyRecord).filter(
                        models.OccupancyRecord.slot_id.in_(slot_ids)
                    ).delete(synchronize_session=False)
                db.query(models.MonitoringLog).filter_by(
                    facility_id=parking_facility.id
                ).delete(synchronize_session=False)
                db.query(models.Camera).filter_by(
                    facility_id=parking_facility.id
                ).delete(synchronize_session=False)
                db.query(models.OccupancySnapshot).filter_by(
                    facility_id=parking_facility.id
                ).delete(synchronize_session=False)
                db.query(models.ParkingSlot).filter_by(
                    facility_id=parking_facility.id
                ).delete(synchronize_session=False)

        db.flush()
        verified_facilities = [
            facilities_by_code[f"FAC-{index:03d}"] for index in range(2, 10)
        ]

        admin.assigned_facilities = [facility]
        super_admin.assigned_facilities = []

        three_lot_admin = (
            db.query(models.AdminUser)
            .filter_by(email="cluster3@parkfinder.local")
            .one_or_none()
        )
        if three_lot_admin is None:
            three_lot_admin = models.AdminUser(
                email="cluster3@parkfinder.local",
                full_name="CDO Three-Lot Admin",
                hashed_password=get_password_hash("cluster3admin"),
                facility_id=verified_facilities[0].id,
            )
            db.add(three_lot_admin)
        else:
            three_lot_admin.full_name = "CDO Three-Lot Admin"
            three_lot_admin.facility_id = verified_facilities[0].id
            three_lot_admin.is_active = True
        three_lot_admin.assigned_facilities = verified_facilities[:3]

        five_lot_admin = (
            db.query(models.AdminUser)
            .filter_by(email="cluster5@parkfinder.local")
            .one_or_none()
        )
        if five_lot_admin is None:
            five_lot_admin = models.AdminUser(
                email="cluster5@parkfinder.local",
                full_name="CDO Five-Lot Admin",
                hashed_password=get_password_hash("cluster5admin"),
                facility_id=verified_facilities[3].id,
            )
            db.add(five_lot_admin)
        else:
            five_lot_admin.full_name = "CDO Five-Lot Admin"
            five_lot_admin.facility_id = verified_facilities[3].id
            five_lot_admin.is_active = True
        five_lot_admin.assigned_facilities = verified_facilities[3:]

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
                        details={"event_type": "system", "source": "seed"},
                    ),
                    models.MonitoringLog(
                        facility_id=facility.id,
                        camera_id=camera.id,
                        level="info",
                        message="Montero CCTV stream is online",
                        details={"event_type": "camera_status", "camera": "Montero CCTV"},
                    ),
                    models.MonitoringLog(
                        facility_id=facility.id,
                        camera_id=camera.id,
                        level="info",
                        message="Slot A2 changed to occupied",
                        details={
                            "event_type": "vehicle_entry",
                            "slot_number": "A2",
                            "status": "occupied",
                            "confidence": 0.92,
                        },
                    ),
                    models.MonitoringLog(
                        facility_id=facility.id,
                        camera_id=camera.id,
                        level="info",
                        message="Slot B2 changed to available",
                        details={
                            "event_type": "vehicle_exit",
                            "slot_number": "B2",
                            "status": "available",
                            "confidence": 0.0,
                        },
                    ),
                ]
            )

        db.commit()
        print("Seed complete.")
        print("Admin login: admin@parkfinder.local / admin123")
        print("Super-admin login: superadmin@parkfinder.local / superadmin123")
        print("Three-lot admin: cluster3@parkfinder.local / cluster3admin")
        print("Five-lot admin: cluster5@parkfinder.local / cluster5admin")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
