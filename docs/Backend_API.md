# Backend API

The backend is built with FastAPI, SQLAlchemy, PostgreSQL, JWT authentication, bcrypt password hashing, CORS configuration, and API key protection for AI ingest.

## Public Driver Endpoints

### `GET /api/v1/facilities`

Returns searchable parking facilities. Optional query:

```text
?search=Montero
```

### `GET /api/v1/facilities/{facility_id}`

Returns facility details, availability summary, parking slots, and camera metadata.

### `GET /api/v1/facilities/{facility_id}/availability`

Returns only the driver-facing availability summary:

- facility ID
- facility code
- facility name
- total slots
- available slots
- occupied slots
- occupancy percentage
- latest update time

## Admin Endpoints

### `POST /api/v1/auth/login`

Logs in an admin and returns a JWT access token.

### `POST /api/v1/auth/register`

Public parking-owner registration. Requires `full_name`, `email`, and a password of at least 8 characters. New accounts are stored as inactive `facility_admin` accounts with `approval_status: pending`; they cannot log in until a super admin approves them.

### `GET /api/v1/auth/me`

Returns the current admin profile, role, and super-admin status.

### `GET /api/v1/admin/facilities`

Returns all assigned facilities for a regular admin or every facility for a super admin. Multi-facility accounts may select any returned facility through the dashboard, logs, and reports endpoints.

### `GET /api/v1/admin/dashboard`

Returns dashboard data for the logged-in admin. Super admins pass `facility_id` to select a facility.

### `GET /api/v1/admin/logs`

Returns monitoring logs for the assigned or selected facility.

### `GET /api/v1/admin/reports`

Returns simple occupancy report metrics for the assigned or selected facility.

### `GET /api/v1/admin/users`

Returns administrator accounts and role information. This endpoint requires super-admin access.

### `POST /api/v1/admin/users/{admin_id}/approve`

Super admin only. Approves a pending owner account and enables login.

### `POST /api/v1/admin/users/{admin_id}/reject`

Super admin only. Rejects a pending owner account and keeps login disabled.

### `GET /api/v1/admin/parking-lot-submissions`

Returns the logged-in facility owner's own requests. A super admin receives all owner requests.

### `POST /api/v1/admin/parking-lot-submissions`

Creates a pending parking lot request for a regular facility-owner account. The request contains its name, address, map coordinates, and initial slot count. Pending and rejected requests are not returned by the public facility API.

### `POST /api/v1/admin/parking-lot-submissions/{submission_id}/approve`

Super admin only. Creates the public facility, assigns it to the submitting owner, and marks the request approved.

### `POST /api/v1/admin/parking-lot-submissions/{submission_id}/reject`

Super admin only. Rejects the pending request without creating a public facility.

## Parking Lot and Account Management

- Parking lots are created through owner submission and super-admin approval. Direct `POST /api/v1/admin/facilities` is forbidden for every role.
- `GET /api/v1/admin/facilities/{id}`: view an assigned lot (super admin can view all).
- `PATCH /api/v1/admin/facilities/{id}`: assigned owners update name, address, coordinates, or unconfigured slot capacity. Super admins cannot edit lots or change ownership.
- `DELETE /api/v1/admin/facilities/{id}`: assigned owners remove their lot from active lists. Its slots and monitoring history are retained; public detail, history, counting, and AI ingest refuse deleted lots. Super admins cannot delete lots.
- `PATCH /api/v1/admin/parking-lot-submissions/{id}`: owners edit their own unapproved requests; requests return to pending review.
- `DELETE /api/v1/admin/parking-lot-submissions/{id}`: owners delete their own unapproved requests. Super admins can approve/reject requests but cannot edit/delete them.
- `DELETE /api/v1/admin/users/{id}`: super admin removes an account from active lists and disables login and existing tokens. Self deletion and deletion of the last active super admin are forbidden. Account deletion is blocked while the owner still has active parking lots.

Deletion uses an `is_deleted` marker to preserve historical relationships and numeric IDs. Retained deleted account email addresses cannot be registered again. The web UI asks for confirmation before deletion.

Slot capacity is editable here only before individual slots have been configured. This protects occupied slots, camera calibration, and historical records from accidental removal. Configured slot changes require updating the slot configuration separately.

## AI Ingest Endpoint

### `POST /api/v1/ingest/slot-status`

Requires:

```text
X-API-Key: dev-ai-ingest-key
```

The AI worker sends slot updates after processing video frames. The backend updates current slot state, creates per-slot occupancy records, creates an occupancy snapshot, and writes a monitoring log.

## Appwrite deployment option

The current FastAPI API runs locally. For the Appwrite version, see [`appwrite/README.md`](../appwrite/README.md). It describes a Python Appwrite Function that keeps the `/api/v1` route contract and stores records in Appwrite TablesDB. Once deployed, set the mobile, web, and AI API base URLs to the Function's HTTPS domain plus `/api/v1`.
