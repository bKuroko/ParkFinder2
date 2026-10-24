"""Create the ParkFinder TablesDB schema in an Appwrite Cloud project.

Set APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY first. The API key
needs databases.write, tables.write, columns.write, indexes.write, rows.read,
and rows.write scopes. Keep the key out of source control.
"""
from __future__ import annotations

import os
import time

import requests


ENDPOINT = os.environ["APPWRITE_ENDPOINT"].rstrip("/")
PROJECT = os.environ["APPWRITE_PROJECT_ID"]
KEY = os.environ["APPWRITE_API_KEY"]
DATABASE_ID = os.environ.get("APPWRITE_DATABASE_ID", "parkfinder")
HEADERS = {"X-Appwrite-Project": PROJECT, "X-Appwrite-Key": KEY, "Content-Type": "application/json"}


TABLES = {
    "facilities": [
        ("facility_code", "string", {"size": 40, "required": True}),
        ("name", "string", {"size": 160, "required": True}),
        ("address", "string", {"size": 255, "required": True}),
        ("latitude", "float", {"required": False}), ("longitude", "float", {"required": False}),
        # Appwrite TablesDB does not allow defaults on required columns.
        # The API supplies these values when creating rows.
        ("total_slots", "integer", {"required": True}),
        ("created_at", "datetime", {"required": False}),
    ],
    "admin_users": [
        ("email", "string", {"size": 255, "required": True}),
        ("full_name", "string", {"size": 160, "required": True}),
        ("hashed_password", "string", {"size": 255, "required": True}),
        ("is_active", "boolean", {"required": True}),
        ("facility_id", "integer", {"required": False}),
        ("facility_ids", "text", {"required": False}),
        ("created_at", "datetime", {"required": False}),
    ],
    "parking_lot_submissions": [
        ("name", "string", {"size": 160, "required": True}),
        ("address", "string", {"size": 255, "required": True}),
        ("latitude", "float", {"required": True}), ("longitude", "float", {"required": True}),
        ("total_slots", "integer", {"required": True}), ("status", "string", {"size": 30, "required": True}),
        ("submitted_by_admin_id", "integer", {"required": True}),
        ("reviewed_by_admin_id", "integer", {"required": False}),
        ("facility_id", "integer", {"required": False}), ("submitted_at", "datetime", {"required": True}),
        ("reviewed_at", "datetime", {"required": False}),
    ],
    "parking_slots": [
        ("facility_id", "integer", {"required": True}), ("slot_number", "string", {"size": 40, "required": True}),
        ("polygon", "text", {"required": False}), ("is_occupied", "boolean", {"required": True}),
        ("confidence", "float", {"required": True}), ("last_seen_at", "datetime", {"required": False}),
    ],
    "occupancy_records": [
        ("slot_id", "integer", {"required": True}), ("status", "string", {"size": 30, "required": True}),
        ("timestamp", "datetime", {"required": True}),
    ],
    "cameras": [
        ("facility_id", "integer", {"required": True}), ("name", "string", {"size": 120, "required": True}),
        ("source_url", "string", {"size": 255, "required": True}),
        ("status", "string", {"size": 40, "required": True}),
        ("last_heartbeat_at", "datetime", {"required": False}),
    ],
    "occupancy_snapshots": [
        ("facility_id", "integer", {"required": True}), ("available_slots", "integer", {"required": True}),
        ("occupied_slots", "integer", {"required": True}), ("occupancy_percentage", "float", {"required": True}),
        ("captured_at", "datetime", {"required": True}),
    ],
    "monitoring_logs": [
        ("facility_id", "integer", {"required": True}), ("camera_id", "integer", {"required": False}),
        ("level", "string", {"size": 30, "required": True}), ("message", "text", {"required": True}),
        ("details", "text", {"required": False}), ("created_at", "datetime", {"required": True}),
    ],
}

INDEXES = {
    "facilities": [("facility_code", ["facility_code"], "unique")],
    "admin_users": [("email", ["email"], "unique")],
    "parking_slots": [("facility_slot", ["facility_id", "slot_number"], "unique"),
                      ("facility", ["facility_id"], "key")],
    "cameras": [("facility", ["facility_id"], "key")],
    "occupancy_snapshots": [("facility", ["facility_id"], "key")],
    "monitoring_logs": [("facility", ["facility_id"], "key")],
    "parking_lot_submissions": [("submitter", ["submitted_by_admin_id"], "key")],
}


def request(method: str, path: str, body: dict | None = None) -> requests.Response:
    return requests.request(method, f"{ENDPOINT}/tablesdb{path}", headers=HEADERS, json=body, timeout=30)


def create_if_missing(method: str, path: str, body: dict) -> requests.Response:
    response = request(method, path, body)
    if response.status_code in (200, 201, 202):
        return response
    if response.status_code == 409:
        return response
    raise RuntimeError(f"Appwrite {method} {path} failed ({response.status_code}): {response.text}")


def wait_column(table_id: str, key: str) -> None:
    path = f"/{DATABASE_ID}/tables/{table_id}/columns/{key}"
    for _ in range(40):
        response = request("GET", path)
        if response.ok and response.json().get("status") == "available":
            return
        time.sleep(1)
    raise RuntimeError(f"Timed out waiting for column {table_id}.{key} to become available")


def wait_index(table_id: str, key: str) -> None:
    path = f"/{DATABASE_ID}/tables/{table_id}/indexes/{key}"
    for _ in range(40):
        response = request("GET", path)
        if response.ok and response.json().get("status") == "available":
            return
        time.sleep(1)
    raise RuntimeError(f"Timed out waiting for index {table_id}.{key} to become available")


def main() -> None:
    create_if_missing("POST", "", {"databaseId": DATABASE_ID, "name": "ParkFinder", "enabled": True})
    for table_id, columns in TABLES.items():
        create_if_missing("POST", f"/{DATABASE_ID}/tables", {
            "tableId": table_id, "name": table_id.replace("_", " ").title(),
            "permissions": [], "rowSecurity": False,
        })
        for key, kind, settings in columns:
            create_if_missing("POST", f"/{DATABASE_ID}/tables/{table_id}/columns/{kind}", {"key": key, **settings})
        for key, _, _ in columns:
            wait_column(table_id, key)
        for index_id, keys, kind in INDEXES.get(table_id, []):
            create_if_missing("POST", f"/{DATABASE_ID}/tables/{table_id}/indexes", {
                "key": index_id, "type": kind, "columns": keys,
            })
            wait_index(table_id, index_id)
    print(f"Created or verified Appwrite database '{DATABASE_ID}' and {len(TABLES)} tables.")


if __name__ == "__main__":
    main()
