"""Route-level checks using a fake TablesDB transport; no cloud credentials."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location("parkfinder_api", Path(__file__).parents[1] / "functions/parkfinder-api/src/main.py")
api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)


class LotManagementTests(unittest.TestCase):
    def setUp(self):
        self.db = {table: {} for table in api.TABLES}
        for number, role in [(1, "super_admin"), (2, "facility_admin"), (3, "facility_admin")]:
            self.db["admins"][str(number)] = {"$id": str(number), "email": f"user{number}@example.invalid",
                "full_name": f"User {number}", "role": role, "is_active": True, "approval_status": "approved",
                "facility_id": None, "facility_ids": "[]", "hashed_password": "unused"}
        self.fields = {"name": "Example Parking", "address": "Example Street", "latitude": 8.4, "longitude": 124.6, "total_slots": 12}
        self.transport = patch.object(api, "_aw", self.aw)
        self.transport.start()
        self.secret = patch.object(api, "JWT_SECRET", "unit-test-secret")
        self.secret.start()
        self.addCleanup(self.transport.stop)
        self.addCleanup(self.secret.stop)

    def aw(self, method, url, *, params=None, body=None):
        parts = url.split("/tables/")[1].split("/")
        table = next(key for key, value in api.TABLES.items() if value == parts[0])
        rows = self.db[table]
        if method == "GET" and len(parts) == 2:
            result = list(rows.values())
            offset, limit = 0, 100
            for key, value in params or []:
                q = json.loads(value)
                if q["method"] == "equal":
                    result = [r for r in result if r.get(q["attribute"]) in q["values"]]
                elif q["method"] == "limit": limit = q["values"][0]
                elif q["method"] == "offset": offset = q["values"][0]
            return {"rows": copy.deepcopy(result[offset:offset+limit])}
        if method == "POST":
            rid = body["rowId"]
            if rid in rows: raise api.ApiError(409, "Duplicate row ID")
            rows[rid] = {"$id": rid, **body["data"]}
            return copy.deepcopy(rows[rid])
        rid = parts[2]
        if rid not in rows: raise api.ApiError(404, "Missing row")
        if method == "PATCH": rows[rid].update(body["data"])
        return copy.deepcopy(rows[rid])

    def call(self, method, path, body=None, user=1):
        token = api.jwt.encode({"sub": str(user)}, api.JWT_SECRET, algorithm="HS256")
        return api._run(method, "/api/v1" + path, {}, {"authorization": "Bearer " + token}, body or {})

    def rejects(self, code, method, path, body=None, user=1):
        with self.assertRaises(api.ApiError) as caught: self.call(method, path, body, user)
        self.assertEqual(caught.exception.status, code)

    def create(self, owner=2):
        request, status = self.call("POST", "/admin/parking-lot-submissions", self.fields, user=owner)
        self.assertEqual(status, 201)
        row, status = self.call("POST", f"/admin/parking-lot-submissions/{request['id']}/approve")
        self.assertEqual(status, 200)
        return row["facility_id"]

    def test_crud_permissions_and_retained_history(self):
        fid = self.create()
        path = f"/admin/facilities/{fid}"
        self.rejects(403, "PATCH", path, {"name": "Other Lot"}, user=3)
        self.rejects(403, "DELETE", path, user=3)
        self.rejects(403, "PATCH", path, {"name": "Super Admin Change"}, user=1)
        self.rejects(403, "DELETE", path, user=1)
        self.call("PATCH", path, {"name": "Updated Lot"}, user=2)
        self.assertEqual(self.call("GET", path, user=2)[0]["name"], "Updated Lot")
        self.db["logs"]["history"] = {"$id": "history", "facility_id": fid}
        self.call("DELETE", path, user=2)
        self.assertTrue(self.db["facilities"][str(fid)]["is_deleted"])
        self.assertIn("history", self.db["logs"])
        self.assertEqual(self.call("GET", "/facilities")[0], [])
        self.rejects(404, "GET", f"/facilities/{fid}")
        self.rejects(404, "POST", f"/admin/facilities/{fid}/slots/count", {"direction": "in"}, user=2)
        new = self.create()
        self.assertNotEqual(fid, new, "Deleted row IDs must never be reused")

    def test_account_deletion_and_owner_only_lot_management(self):
        fid = self.create()
        self.rejects(409, "DELETE", "/admin/users/2")
        self.rejects(403, "PATCH", f"/admin/facilities/{fid}", {"owner_id": 3}, user=2)
        self.rejects(403, "PATCH", f"/admin/facilities/{fid}", {"owner_id": 3}, user=1)
        self.assertFalse(api._admin_profile(self.db["admins"]["2"])["is_super_admin"])
        self.call("DELETE", f"/admin/facilities/{fid}", user=2)
        self.call("DELETE", "/admin/users/2")
        self.rejects(401, "GET", "/auth/me", user=2)
        self.assertEqual(len(self.call("GET", "/admin/users")[0]), 2)
        self.rejects(409, "DELETE", "/admin/users/1")
        self.rejects(403, "DELETE", "/admin/users/1", user=3)

    def test_request_approval_and_cancellation(self):
        self.rejects(403, "POST", "/admin/facilities", {**self.fields, "owner_id": 2}, user=2)
        row, _ = self.call("POST", "/admin/parking-lot-submissions", self.fields, user=2)
        path = f"/admin/parking-lot-submissions/{row['id']}"
        self.rejects(403, "DELETE", path, user=3)
        self.rejects(403, "DELETE", path, user=1)
        self.rejects(403, "PATCH", path, {"name": "Super Admin Change"}, user=1)
        self.call("POST", path + "/reject")
        updated, _ = self.call("PATCH", path, {"name": "Revised Lot"}, user=2)
        self.assertEqual(updated["status"], "pending")
        self.call("POST", path + "/approve")
        self.rejects(409, "DELETE", path, user=2)
        row, _ = self.call("POST", "/admin/parking-lot-submissions", self.fields, user=2)
        path = f"/admin/parking-lot-submissions/{row['id']}"
        self.call("DELETE", path, user=2)
        self.rejects(404, "POST", path + "/approve")

    def test_validation_slot_capacity_and_pagination(self):
        self.rejects(403, "POST", "/admin/facilities", {**self.fields, "owner_id": 1})
        self.rejects(422, "POST", "/admin/parking-lot-submissions", {**self.fields, "latitude": 200}, user=2)
        fid = self.create()
        self.db["slots"]["1"] = {"$id": "1", "facility_id": fid, "slot_number": "A1", "is_occupied": True}
        self.rejects(409, "PATCH", f"/admin/facilities/{fid}", {"total_slots": 1}, user=2)
        self.call("PATCH", f"/admin/facilities/{fid}", {"address": "Updated Street"}, user=2)
        for number in range(2, 207):
            self.db["facilities"][str(number)] = {"$id": str(number), "is_deleted": number == 206}
        self.assertEqual(api._next_id("facilities"), "207")
        self.assertEqual(len(api._list("facilities")), 205)


if __name__ == "__main__":
    unittest.main()
