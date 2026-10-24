"""Copy current local ParkFinder SQL rows to the matching Appwrite tables.

Run after bootstrap_appwrite.py. The script is repeatable: it preserves numeric
row IDs and updates rows already copied. It never deletes either database.
"""
from __future__ import annotations

import json
import os
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))
load_dotenv(BACKEND / ".env")

from app import models  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402


ENDPOINT = os.environ["APPWRITE_ENDPOINT"].rstrip("/")
PROJECT = os.environ["APPWRITE_PROJECT_ID"]
KEY = os.environ["APPWRITE_API_KEY"]
DATABASE_ID = os.environ.get("APPWRITE_DATABASE_ID", "parkfinder")
HEADERS = {"X-Appwrite-Project": PROJECT, "X-Appwrite-Key": KEY, "Content-Type": "application/json"}


def clean(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, (dict, list)):
        return json.dumps(value)
    return value


def upsert(table: str, row_id: int, data: dict[str, Any]) -> None:
    base = f"{ENDPOINT}/tablesdb/{DATABASE_ID}/tables/{table}/rows"
    url = f"{base}/{row_id}"
    response = requests.put(url, headers=HEADERS, json={"data": data, "permissions": []}, timeout=30)
    if response.status_code in (200, 201):
        return
    if response.status_code != 404:
        raise RuntimeError(f"Appwrite upsert {table}/{row_id} failed ({response.status_code}): {response.text}")
    response = requests.post(base, headers=HEADERS, json={"rowId": str(row_id), "data": data, "permissions": []}, timeout=30)
    if not response.ok:
        raise RuntimeError(f"Appwrite create {table}/{row_id} failed ({response.status_code}): {response.text}")


def model_rows(session, model):
    return session.query(model).order_by(model.id).all()


def main() -> None:
    session = SessionLocal()
    try:
        facilities = model_rows(session, models.Facility)
        admins = model_rows(session, models.AdminUser)
        mapping = [
            ("facilities", facilities, lambda x: {"facility_code": x.facility_code, "name": x.name,
             "address": x.address, "latitude": x.latitude, "longitude": x.longitude,
             "total_slots": x.total_slots, "created_at": clean(x.created_at)}),
            ("admin_users", admins, lambda x: {"email": x.email, "full_name": x.full_name,
             "hashed_password": x.hashed_password, "is_active": x.is_active, "facility_id": x.facility_id,
             "facility_ids": json.dumps(x.facility_ids), "created_at": clean(x.created_at)}),
            ("parking_lot_submissions", model_rows(session, models.ParkingLotSubmission), lambda x: {
             "name": x.name, "address": x.address, "latitude": x.latitude, "longitude": x.longitude,
             "total_slots": x.total_slots, "status": x.status, "submitted_by_admin_id": x.submitted_by_admin_id,
             "reviewed_by_admin_id": x.reviewed_by_admin_id, "facility_id": x.facility_id,
             "submitted_at": clean(x.submitted_at), "reviewed_at": clean(x.reviewed_at)}),
            ("parking_slots", model_rows(session, models.ParkingSlot), lambda x: {"facility_id": x.facility_id,
             "slot_number": x.slot_number, "polygon": json.dumps(x.polygon or []), "is_occupied": x.is_occupied,
             "confidence": x.confidence, "last_seen_at": clean(x.last_seen_at)}),
            ("occupancy_records", model_rows(session, models.OccupancyRecord), lambda x: {"slot_id": x.slot_id,
             "status": x.status, "timestamp": clean(x.timestamp)}),
            ("cameras", model_rows(session, models.Camera), lambda x: {"facility_id": x.facility_id,
             "name": x.name, "source_url": x.source_url, "status": x.status,
             "last_heartbeat_at": clean(x.last_heartbeat_at)}),
            ("occupancy_snapshots", model_rows(session, models.OccupancySnapshot), lambda x: {
             "facility_id": x.facility_id, "available_slots": x.available_slots,
             "occupied_slots": x.occupied_slots, "occupancy_percentage": x.occupancy_percentage,
             "captured_at": clean(x.captured_at)}),
            ("monitoring_logs", model_rows(session, models.MonitoringLog), lambda x: {
             "facility_id": x.facility_id, "camera_id": x.camera_id, "level": x.level,
             "message": x.message, "details": json.dumps(x.details) if x.details is not None else None,
             "created_at": clean(x.created_at)}),
        ]
        total = 0
        for table, rows, serialize in mapping:
            for row in rows:
                upsert(table, row.id, serialize(row))
                total += 1
            print(f"Copied {len(rows)} rows into {table}")
        print(f"Migration complete: {total} rows copied. Local PostgreSQL was not changed.")
    finally:
        session.close()


if __name__ == "__main__":
    main()
