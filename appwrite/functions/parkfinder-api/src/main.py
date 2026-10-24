"""REST-compatible ParkFinder API hosted as an Appwrite Function.

The function keeps the existing /api/v1 route contract so the mobile and web
clients only need their API base URL changed after the Appwrite deployment.
"""
from __future__ import annotations

import json
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

import requests
from jose import JWTError, jwt
from passlib.context import CryptContext


APPWRITE_ENDPOINT = os.environ.get("APPWRITE_ENDPOINT", "").rstrip("/")
APPWRITE_PROJECT_ID = os.environ.get("APPWRITE_FUNCTION_PROJECT_ID", os.environ.get("APPWRITE_PROJECT_ID", ""))
APPWRITE_API_KEY = os.environ.get("APPWRITE_API_KEY", "")
DATABASE_ID = os.environ.get("APPWRITE_DATABASE_ID", "parkfinder")
JWT_SECRET = os.environ.get("JWT_SECRET_KEY", "")
AI_INGEST_API_KEY = os.environ.get("AI_INGEST_API_KEY", "")
TABLES = {
    "facilities": os.environ.get("TABLE_FACILITIES", "facilities"),
    "admins": os.environ.get("TABLE_ADMINS", "admin_users"),
    "submissions": os.environ.get("TABLE_SUBMISSIONS", "parking_lot_submissions"),
    "slots": os.environ.get("TABLE_SLOTS", "parking_slots"),
    "records": os.environ.get("TABLE_RECORDS", "occupancy_records"),
    "cameras": os.environ.get("TABLE_CAMERAS", "cameras"),
    "snapshots": os.environ.get("TABLE_SNAPSHOTS", "occupancy_snapshots"),
    "logs": os.environ.get("TABLE_LOGS", "monitoring_logs"),
}
PASSWORDS = CryptContext(schemes=["bcrypt"], deprecated="auto")


class ApiError(Exception):
    def __init__(self, status: int, detail: str):
        self.status = status
        self.detail = detail


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _id(row: dict[str, Any]) -> int:
    return int(row["$id"])


def _json_field(value: Any, default: Any) -> Any:
    if value in (None, ""):
        return default
    if not isinstance(value, str):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return default


def _table_url(table: str, suffix: str = "rows") -> str:
    return f"{APPWRITE_ENDPOINT}/tablesdb/{DATABASE_ID}/tables/{TABLES[table]}/{suffix}"


def _aw(method: str, url: str, *, params: list[tuple[str, str]] | None = None,
        body: dict[str, Any] | None = None) -> dict[str, Any]:
    if not APPWRITE_ENDPOINT or not APPWRITE_PROJECT_ID or not APPWRITE_API_KEY:
        raise ApiError(503, "Appwrite function is missing its database configuration")
    headers = {
        "X-Appwrite-Project": APPWRITE_PROJECT_ID,
        "X-Appwrite-Key": APPWRITE_API_KEY,
        "Content-Type": "application/json",
    }
    try:
        response = requests.request(method, url, headers=headers, params=params, json=body, timeout=12)
    except requests.RequestException as exc:
        raise ApiError(502, "Could not connect to Appwrite database") from exc
    if not response.ok:
        try:
            detail = response.json().get("message", "Appwrite request failed")
        except ValueError:
            detail = "Appwrite request failed"
        raise ApiError(response.status_code if response.status_code < 500 else 502, detail)
    if not response.content:
        return {}
    return response.json()


def _query(method: str, attribute: str, values: Any) -> tuple[str, str]:
    if not isinstance(values, list):
        values = [values]
    return "queries[]", json.dumps({"method": method, "attribute": attribute, "values": values})


def _list(table: str, queries: list[tuple[str, str]] | None = None) -> list[dict[str, Any]]:
    result = _aw("GET", _table_url(table), params=(queries or []) + [("limit", "500")])
    return result.get("rows", [])


def _get(table: str, row_id: int | str) -> dict[str, Any] | None:
    try:
        return _aw("GET", _table_url(table, f"rows/{row_id}"))
    except ApiError as exc:
        if exc.status == 404:
            return None
        raise


def _next_id(table: str) -> str:
    rows = _list(table)
    ids = [int(row["$id"]) for row in rows if str(row.get("$id", "")).isdigit()]
    return str(max(ids, default=0) + 1)


def _create(table: str, data: dict[str, Any], row_id: int | str | None = None) -> dict[str, Any]:
    return _aw("POST", _table_url(table), body={
        "rowId": str(row_id if row_id is not None else _next_id(table)),
        "data": data,
        "permissions": [],
    })


def _update(table: str, row_id: int | str, data: dict[str, Any]) -> dict[str, Any]:
    return _aw("PATCH", _table_url(table, f"rows/{row_id}"), body={"data": data})


def _summary(facility: dict[str, Any]) -> dict[str, Any]:
    facility_id = _id(facility)
    slots = _list("slots", [_query("equal", "facility_id", facility_id)])
    configured = int(facility.get("total_slots", 0))
    total = len(slots) or configured
    occupied = sum(1 for slot in slots if slot.get("is_occupied"))
    available = max(total - occupied, 0)
    seen = [slot.get("last_seen_at") for slot in slots if slot.get("last_seen_at")]
    updated = max(seen) if seen else None
    return {
        "id": facility_id,
        "facility_code": facility.get("facility_code"),
        "name": facility.get("name"),
        "address": facility.get("address"),
        "latitude": facility.get("latitude"),
        "longitude": facility.get("longitude"),
        "total_slots": total,
        "available_slots": available,
        "occupied_slots": occupied,
        "occupancy_percentage": round(occupied * 100 / total, 2) if total else 0.0,
        "updated_at": updated,
    }


def _camera_out(camera: dict[str, Any]) -> dict[str, Any]:
    return {"id": _id(camera), "name": camera.get("name"), "source_url": camera.get("source_url"),
            "status": camera.get("status", "offline"), "last_heartbeat_at": camera.get("last_heartbeat_at")}


def _slot_out(slot: dict[str, Any]) -> dict[str, Any]:
    return {"id": _id(slot), "slot_number": slot.get("slot_number"),
            "is_occupied": bool(slot.get("is_occupied")), "confidence": slot.get("confidence", 0),
            "polygon": _json_field(slot.get("polygon"), []), "last_seen_at": slot.get("last_seen_at")}


def _facility_detail(facility: dict[str, Any]) -> dict[str, Any]:
    summary = _summary(facility)
    fid = summary["id"]
    slots = _list("slots", [_query("equal", "facility_id", fid)])
    cameras = _list("cameras", [_query("equal", "facility_id", fid)])
    summary["slots"] = sorted((_slot_out(row) for row in slots), key=lambda item: item["slot_number"])
    summary["cameras"] = [_camera_out(row) for row in cameras]
    return summary


def _admin_profile(admin: dict[str, Any]) -> dict[str, Any]:
    ids = _json_field(admin.get("facility_ids"), [])
    if admin.get("facility_id") is not None:
        ids = sorted(set(ids + [int(admin["facility_id"])]))
    super_admin = admin.get("facility_id") is None and not ids
    return {"id": _id(admin), "email": admin.get("email"), "full_name": admin.get("full_name"),
            "facility_id": admin.get("facility_id"), "facility_ids": ids,
            "role": "super_admin" if super_admin else "facility_admin", "is_super_admin": super_admin}


def _current_admin(headers: dict[str, str]) -> dict[str, Any]:
    auth = headers.get("authorization", "")
    token = auth.removeprefix("Bearer ").strip()
    if not token or not JWT_SECRET:
        raise ApiError(401, "Could not validate credentials")
    try:
        subject = jwt.decode(token, JWT_SECRET, algorithms=["HS256"]).get("sub")
    except JWTError as exc:
        raise ApiError(401, "Could not validate credentials") from exc
    admin = _get("admins", subject)
    if not admin or not admin.get("is_active", True):
        raise ApiError(401, "Could not validate credentials")
    return admin


def _require_facility(admin: dict[str, Any], facility_id: int) -> None:
    profile = _admin_profile(admin)
    if not profile["is_super_admin"] and facility_id not in profile["facility_ids"]:
        raise ApiError(403, "Admin is not allowed to access this facility")


def _target_facility(admin: dict[str, Any], requested: str | None) -> int:
    profile = _admin_profile(admin)
    if profile["is_super_admin"]:
        if requested is None:
            raise ApiError(400, "facility_id is required for super admins")
        return int(requested)
    ids = profile["facility_ids"]
    target = int(requested) if requested else (admin.get("facility_id") or (ids[0] if ids else None))
    if target is None:
        raise ApiError(403, "No facilities are assigned to this admin")
    _require_facility(admin, target)
    return target


def _submission_item(row: dict[str, Any]) -> dict[str, Any]:
    submitter = _get("admins", row.get("submitted_by_admin_id"))
    if not submitter:
        raise ApiError(500, "Parking lot submitter no longer exists")
    return {"id": _id(row), "name": row.get("name"), "address": row.get("address"),
            "latitude": row.get("latitude"), "longitude": row.get("longitude"),
            "total_slots": row.get("total_slots"), "status": row.get("status"),
            "submitted_by_admin_id": row.get("submitted_by_admin_id"),
            "submitter_name": submitter.get("full_name"), "submitter_email": submitter.get("email"),
            "reviewed_by_admin_id": row.get("reviewed_by_admin_id"), "facility_id": row.get("facility_id"),
            "submitted_at": row.get("submitted_at"), "reviewed_at": row.get("reviewed_at")}


def _facility(facility_id: int) -> dict[str, Any]:
    row = _get("facilities", facility_id)
    if not row:
        raise ApiError(404, "Facility not found")
    return row


def _log(facility_id: int, message: str, details: dict[str, Any] | None = None,
         camera_id: int | None = None, level: str = "info") -> None:
    _create("logs", {"facility_id": facility_id, "camera_id": camera_id,
                      "level": level, "message": message,
                      "details": json.dumps(details) if details is not None else "",
                      "created_at": _now()})


def _snapshot(facility_id: int) -> dict[str, Any]:
    summary = _summary(_facility(facility_id))
    return _create("snapshots", {"facility_id": facility_id,
                                  "available_slots": summary["available_slots"],
                                  "occupied_slots": summary["occupied_slots"],
                                  "occupancy_percentage": summary["occupancy_percentage"],
                                  "captured_at": _now()})


def _run(method: str, path: str, query: dict[str, str], headers: dict[str, str], body: dict[str, Any]) -> tuple[Any, int]:
    path = re.sub(r"^/api/v1", "", path.rstrip("/")) or "/"

    if method == "GET" and path == "/health":
        return {"status": "ok"}, 200

    if method == "GET" and path == "/facilities":
        search = query.get("search", "").strip().lower()
        facilities = _list("facilities")
        if search:
            facilities = [f for f in facilities if search in f.get("name", "").lower()
                          or search in f.get("facility_code", "").lower()]
        return sorted((_summary(f) for f in facilities), key=lambda f: f["name"] or ""), 200

    match = re.fullmatch(r"/facilities/(\d+)(?:/(availability|history))?", path)
    if method == "GET" and match:
        fid = int(match.group(1))
        suffix = match.group(2)
        facility = _facility(fid)
        if suffix is None:
            return _facility_detail(facility), 200
        if suffix == "availability":
            summary = _summary(facility)
            summary["facility_id"] = summary.pop("id")
            summary["facility_name"] = summary.pop("name")
            slots = _list("slots", [_query("equal", "facility_id", fid)])
            updates = [s["last_seen_at"] for s in slots if s.get("last_seen_at")]
            summary["updated_at"] = max(updates) if updates else None
            return summary, 200
        snapshots = _list("snapshots", [_query("equal", "facility_id", fid)])
        limit = min(max(int(query.get("limit", "24")), 1), 100)
        snapshots.sort(key=lambda row: row.get("captured_at", ""), reverse=True)
        return [{"available_slots": s.get("available_slots", 0), "occupied_slots": s.get("occupied_slots", 0),
                 "occupancy_percentage": s.get("occupancy_percentage", 0), "captured_at": s.get("captured_at")}
                for s in snapshots[:limit]], 200

    if method == "POST" and path == "/auth/login":
        if not JWT_SECRET:
            raise ApiError(503, "Admin login is not configured")
        email = str(body.get("email", "")).strip().lower()
        matches = _list("admins", [_query("equal", "email", email)])
        admin = matches[0] if matches else None
        if not admin or not PASSWORDS.verify(str(body.get("password", "")), admin.get("hashed_password", "")):
            raise ApiError(401, "Incorrect email or password")
        if not admin.get("is_active", True):
            raise ApiError(403, "Admin account is inactive")
        expiry = datetime.now(timezone.utc) + timedelta(minutes=int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "720")))
        token = jwt.encode({"sub": str(_id(admin)), "exp": expiry}, JWT_SECRET, algorithm="HS256")
        return {"access_token": token, "token_type": "bearer"}, 200

    if method == "GET" and path == "/auth/me":
        return _admin_profile(_current_admin(headers)), 200

    if method == "POST" and path == "/ingest/slot-status":
        if not AI_INGEST_API_KEY or headers.get("x-api-key") != AI_INGEST_API_KEY:
            raise ApiError(401, "Invalid AI ingest API key")
        fid = int(body.get("facility_id", 0))
        _facility(fid)
        camera_id = body.get("camera_id")
        now = _now()
        slots = _list("slots", [_query("equal", "facility_id", fid)])
        slots_by_number = {s.get("slot_number"): s for s in slots}
        updated = 0
        for detection in body.get("slots", []):
            slot = slots_by_number.get(detection.get("slot_number"))
            if not slot:
                continue
            occupied = bool(detection.get("is_occupied"))
            confidence = float(detection.get("confidence", 0))
            _update("slots", slot["$id"], {"is_occupied": occupied, "confidence": confidence, "last_seen_at": now})
            _create("records", {"slot_id": _id(slot), "status": "occupied" if occupied else "available", "timestamp": now})
            if bool(slot.get("is_occupied")) != occupied:
                label = "occupied" if occupied else "available"
                _log(fid, f"Slot {slot['slot_number']} changed to {label}",
                     {"event_type": "vehicle_entry" if occupied else "vehicle_exit", "slot_number": slot["slot_number"],
                      "status": label, "confidence": confidence}, camera_id)
            updated += 1
        if camera_id is not None:
            camera = _get("cameras", camera_id)
            if camera:
                _update("cameras", camera_id, {"status": body.get("camera_status", "online"), "last_heartbeat_at": now})
        snapshot = _snapshot(fid)
        _log(fid, f"AI processor updated {updated} slots", {"event_type": "ai_update", "updated_slots": updated,
             "camera_status": body.get("camera_status", "online")}, camera_id)
        return {"updated_slots": updated, "available_slots": snapshot["available_slots"],
                "occupied_slots": snapshot["occupied_slots"], "occupancy_percentage": snapshot["occupancy_percentage"]}, 200

    if path.startswith("/admin/"):
        admin = _current_admin(headers)
        profile = _admin_profile(admin)
        if method == "GET" and path == "/admin/facilities":
            facilities = _list("facilities")
            if not profile["is_super_admin"]:
                facilities = [f for f in facilities if _id(f) in profile["facility_ids"]]
            return sorted((_summary(f) for f in facilities), key=lambda f: f["name"] or ""), 200
        if method == "GET" and path == "/admin/users":
            if not profile["is_super_admin"]:
                raise ApiError(403, "Super-admin access is required")
            return [_admin_profile(a) for a in sorted(_list("admins"), key=lambda a: a.get("full_name", ""))], 200
        if path == "/admin/parking-lot-submissions" and method == "GET":
            rows = _list("submissions")
            if not profile["is_super_admin"]:
                rows = [r for r in rows if int(r.get("submitted_by_admin_id", -1)) == _id(admin)]
            rows.sort(key=lambda r: r.get("submitted_at", ""), reverse=True)
            return [_submission_item(row) for row in rows], 200
        if path == "/admin/parking-lot-submissions" and method == "POST":
            if profile["is_super_admin"]:
                raise ApiError(403, "Super admins review parking lots; a facility owner must submit the request")
            fields = {"name": str(body.get("name", "")).strip(), "address": str(body.get("address", "")).strip(),
                      "latitude": float(body.get("latitude")), "longitude": float(body.get("longitude")),
                      "total_slots": int(body.get("total_slots", 0))}
            if len(fields["name"]) < 3 or len(fields["address"]) < 5 or fields["total_slots"] < 1:
                raise ApiError(422, "Invalid parking lot submission")
            row = _create("submissions", {**fields, "status": "pending", "submitted_by_admin_id": _id(admin),
                                           "reviewed_by_admin_id": None, "facility_id": None,
                                           "submitted_at": _now(), "reviewed_at": None})
            return _submission_item(row), 201
        decision = re.fullmatch(r"/admin/parking-lot-submissions/(\d+)/(approve|reject)", path)
        if decision and method == "POST":
            if not profile["is_super_admin"]:
                raise ApiError(403, "Super-admin access is required")
            row = _get("submissions", decision.group(1))
            if not row:
                raise ApiError(404, "Parking lot submission not found")
            if row.get("status") != "pending":
                raise ApiError(409, "Parking lot submission was already reviewed")
            facility_id = None
            if decision.group(2) == "approve":
                if any(f.get("name", "").casefold() == row.get("name", "").casefold() for f in _list("facilities")):
                    raise ApiError(409, "A facility with this name already exists")
                codes = [int(m.group(1)) for f in _list("facilities")
                         if (m := re.fullmatch(r"FAC-(\d+)", f.get("facility_code", "")))]
                facility = _create("facilities", {"facility_code": f"FAC-{max(codes, default=0)+1:03d}",
                    "name": row["name"], "address": row["address"], "latitude": row["latitude"],
                    "longitude": row["longitude"], "total_slots": row["total_slots"], "created_at": _now()})
                facility_id = _id(facility)
                submitter = _get("admins", row.get("submitted_by_admin_id"))
                if not submitter:
                    raise ApiError(409, "The submitting account no longer exists")
                ids = _json_field(submitter.get("facility_ids"), [])
                if facility_id not in ids:
                    ids.append(facility_id)
                _update("admins", _id(submitter), {"facility_id": submitter.get("facility_id") or facility_id,
                                                "facility_ids": json.dumps(sorted(set(ids)))})
            saved = _update("submissions", row["$id"], {"status": "approved" if facility_id else "rejected",
                "reviewed_by_admin_id": _id(admin), "facility_id": facility_id, "reviewed_at": _now()})
            return _submission_item(saved), 200

        count_adjustment = re.fullmatch(r"/admin/facilities/(\d+)/slots/count", path)
        if method == "POST" and count_adjustment:
            fid = int(count_adjustment.group(1)); _require_facility(admin, fid)
            facility = _facility(fid); direction = body.get("direction")
            if direction not in {"in", "out"}:
                raise ApiError(422, "direction must be 'in' or 'out'")
            slots = sorted(_list("slots", [_query("equal", "facility_id", fid)]), key=lambda s: s.get("slot_number", ""))
            if not slots:
                slots = [_create("slots", {"facility_id": fid, "slot_number": f"MANUAL-{i:04d}", "polygon": "[]",
                    "is_occupied": False, "confidence": 0, "last_seen_at": None}) for i in range(1, int(facility.get("total_slots", 0))+1)]
            target = next((s for s in slots if bool(s.get("is_occupied")) == (direction == "out")), None)
            if not target:
                raise ApiError(409, "No available slots" if direction == "in" else "No occupied slots")
            occupied = direction == "in"; now = _now()
            _update("slots", target["$id"], {"is_occupied": occupied, "confidence": 1.0, "last_seen_at": now})
            _create("records", {"slot_id": _id(target), "status": "occupied" if occupied else "available", "timestamp": now})
            _log(fid, f"Admin recorded vehicle {direction}; {target['slot_number']} is {'occupied' if occupied else 'available'}",
                 {"event_type": "vehicle_entry" if occupied else "vehicle_exit", "slot_number": target["slot_number"],
                  "status": "occupied" if occupied else "available", "source": "admin"})
            snapshot = _snapshot(fid)
            return {"available_slots": snapshot["available_slots"], "occupied_slots": snapshot["occupied_slots"],
                    "total_slots": facility.get("total_slots", 0)}, 200

        if method == "GET" and path in {"/admin/dashboard", "/admin/logs", "/admin/reports"}:
            fid = _target_facility(admin, query.get("facility_id")); facility = _facility(fid)
            history = _list("snapshots", [_query("equal", "facility_id", fid)])
            logs = _list("logs", [_query("equal", "facility_id", fid)])
            history.sort(key=lambda x: x.get("captured_at", ""), reverse=True)
            logs.sort(key=lambda x: x.get("created_at", ""), reverse=True)
            if path == "/admin/reports":
                values = [float(x.get("occupancy_percentage", 0)) for x in history[:100]]
                return {"average_occupancy_percentage": round(sum(values)/len(values), 2) if values else 0,
                        "peak_occupancy_percentage": max(values, default=0), "sample_count": len(values)}, 200
            if path == "/admin/logs":
                return [{"id": _id(x), "level": x.get("level", "info"), "message": x.get("message", ""),
                         "details": _json_field(x.get("details"), None), "created_at": x.get("created_at")}
                        for x in logs[:100]], 200
            cameras = _list("cameras", [_query("equal", "facility_id", fid)])
            return {"facility": _summary(facility), "cameras": [_camera_out(c) for c in cameras],
                    "history": [{"available_slots": x.get("available_slots", 0), "occupied_slots": x.get("occupied_slots", 0),
                                 "occupancy_percentage": x.get("occupancy_percentage", 0), "captured_at": x.get("captured_at")}
                                for x in history[:24]],
                    "logs": [{"id": _id(x), "level": x.get("level", "info"), "message": x.get("message", ""),
                              "details": _json_field(x.get("details"), None), "created_at": x.get("created_at")}
                             for x in logs[:20]]}, 200

    raise ApiError(404, "Not found")


def _request_body(req: Any) -> dict[str, Any]:
    """Read JSON from Appwrite Python runtimes with different Request shapes."""
    raw: Any = None
    for attribute in ("body_json", "bodyJson", "body"):
        try:
            raw = getattr(req, attribute, None)
        except (AttributeError, TypeError, ValueError):
            raw = None
        if raw is not None:
            break
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8", errors="replace")
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except (TypeError, ValueError):
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def main(context):
    req = context.req
    headers = {str(key).lower(): value for key, value in (req.headers or {}).items()}
    cors_headers = {
        "Access-Control-Allow-Origin": os.environ.get("WEB_ORIGIN", "*"),
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
        "Access-Control-Max-Age": "86400",
    }
    if req.method == "OPTIONS":
        return context.res.json({}, 200, cors_headers)
    try:
        body = _request_body(req)
        result, status_code = _run(req.method.upper(), req.path, req.query or {}, headers, body)
        return context.res.json(result, status_code, cors_headers)
    except ApiError as exc:
        return context.res.json({"detail": exc.detail}, exc.status, cors_headers)
    except Exception as exc:  # Function logs are private to the Appwrite console.
        context.error(f"Unhandled ParkFinder API error: {type(exc).__name__}: {exc}")
        return context.res.json({"detail": "Internal server error"}, 500, cors_headers)
