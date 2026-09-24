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

- Montero Parking Lot (`FAC-001`) with its monitored sample slots
- Eight additional map-listed parking locations in Cagayan de Oro City (`FAC-002` through `FAC-009`)
- A configured demo `total_slots` count only for the eight verified locations; no fabricated camera, individual-slot, or occupancy records

## User

Implemented as `admin_users` for the current admin/operator use case.

- `id`
- `email`
- `full_name`
- `hashed_password`
- `is_active`
- `facility_id`
- `created_at`

`facility_id` remains the account's primary facility for backward compatibility. Multi-facility access is stored in `admin_facility_assignments`. A super admin has no primary or assigned facilities and receives web access across all facilities.

## AdminFacilityAssignment

Implemented as `admin_facility_assignments`.

- `admin_id`
- `facility_id`

The composite primary key prevents duplicate facility assignments for an account.

## ParkingLotSubmission

Implemented as `parking_lot_submissions`.

- `id`
- `name`
- `address`
- `latitude`
- `longitude`
- `total_slots`
- `status`
- `submitted_by_admin_id`
- `reviewed_by_admin_id`
- `facility_id`
- `submitted_at`
- `reviewed_at`

New submissions start as `pending`. Approval creates a `facilities` row and assigns it to the submitting account; rejection does not create a facility.

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

This supports occupancy history and admin reports.

## MonitoringLog

Implemented as `monitoring_logs`.

- `id`
- `facility_id`
- `camera_id`
- `level`
- `message`
- `metadata`
- `created_at`
