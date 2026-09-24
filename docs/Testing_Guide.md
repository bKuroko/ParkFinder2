# Testing Guide

## Backend Health

```text
http://localhost:8000/health
```

Expected:

```json
{"status":"ok"}
```

## Public Facility API

```text
http://localhost:8000/api/v1/facilities
```

Expected seed facility:

```text
Montero Parking Lot
FAC-001
12 total slots
```

## Availability API

```text
http://localhost:8000/api/v1/facilities/1/availability
```

Expected seed availability:

```text
5 available
7 occupied
58.33% occupied
```

## Admin Login

Use `/docs` or the web admin login screen:

```text
admin@parkfinder.local
admin123
```

Super-admin web login:

```text
superadmin@parkfinder.local
superadmin123
```

Confirm the super admin can select any listed facility and view administrator accounts. Confirm the regular admin remains locked to Montero Parking Lot.

Multi-facility accounts:

```text
cluster3@parkfinder.local / cluster3admin
cluster5@parkfinder.local / cluster5admin
```

Confirm the ParkFinder admin sees only Montero (`FAC-001`). Confirm the three-lot account sees only `FAC-002` through `FAC-004`. Confirm the five-lot account sees only `FAC-005` through `FAC-009`.

## Parking Lot Approval

1. Log in as a regular facility owner and submit a parking lot from **Parking Lots**.
2. Confirm another regular owner cannot see the request or approve it.
3. Log in as the super admin and approve the request.
4. Confirm the new facility appears in the public API and in the submitting owner's facility selector.

## Mobile App

1. Start backend with `--host 0.0.0.0`.
2. Set `mobile/.env` to the laptop Wi-Fi IP.
3. Run `npm run start -- --clear`.
4. Search `Montero`.
5. Confirm the map shows Montero Parking Lot.
6. Open details and confirm availability counts.

## AI Ingest

Send a test request with `X-API-Key`, or run the detector against a sample video. Confirm slot status changes in:

```text
GET /api/v1/facilities/1/availability
```
