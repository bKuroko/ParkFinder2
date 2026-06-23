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

### `GET /api/v1/auth/me`

Returns the current admin profile.

### `GET /api/v1/admin/dashboard`

Returns facility-restricted dashboard data for the logged-in admin.

### `GET /api/v1/admin/logs`

Returns monitoring logs for the admin's assigned facility.

### `GET /api/v1/admin/reports`

Returns simple occupancy report metrics for the admin's assigned facility.

## AI Ingest Endpoint

### `POST /api/v1/ingest/slot-status`

Requires:

```text
X-API-Key: dev-ai-ingest-key
```

The AI worker sends slot updates after processing video frames. The backend updates current slot state, creates per-slot occupancy records, creates an occupancy snapshot, and writes a monitoring log.
