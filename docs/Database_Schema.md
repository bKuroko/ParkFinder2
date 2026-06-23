# Database Schema

ParkFinder uses PostgreSQL with SQLAlchemy models.

## Facility

Implemented as `facilities`.

- `id`
- `facility_code`
- `name`
- `address`
- `latitude`
- `longitude`
- `total_slots`
- `created_at`

Development seed:

- Facility name: Montero Parking Lot
- Facility ID/code: `FAC-001`
- Total slots: 12

## User

Implemented as `admin_users` for the current admin/operator use case.

- `id`
- `email`
- `full_name`
- `hashed_password`
- `is_active`
- `facility_id`
- `created_at`

Admins are facility-restricted through `facility_id`.

## Camera

Implemented as `cameras`.

- `id`
- `facility_id`
- `name`
- `source_url`
- `status`
- `last_heartbeat_at`

## ParkingSlot

Implemented as `parking_slots`.

- `id`
- `facility_id`
- `slot_number`
- `polygon`
- `is_occupied`
- `confidence`
- `last_seen_at`

The `polygon` field stores predefined parking slot coordinates used by OpenCV.

## OccupancyRecord

Implemented as `occupancy_records`.

- `id`
- `slot_id`
- `status`
- `timestamp`

This stores slot-level history from AI updates.

## OccupancySnapshot

Implemented as `occupancy_snapshots`.

- `id`
- `facility_id`
- `available_slots`
- `occupied_slots`
- `occupancy_percentage`
- `captured_at`

This supports admin trend charts and reports.

## MonitoringLog

Implemented as `monitoring_logs`.

- `id`
- `facility_id`
- `camera_id`
- `level`
- `message`
- `metadata`
- `created_at`
