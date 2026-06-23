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
