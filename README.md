# ParkFinder

ParkFinder is a full-stack smart parking monitoring system. It uses a laptop-based YOLOv8/OpenCV processor to read parking lot video footage, classify predefined parking slots as occupied or vacant, and publish the latest parking state into PostgreSQL through a FastAPI backend.

The repository contains:

- `backend` - FastAPI REST API, PostgreSQL models, JWT admin auth, seed data, facility-restricted and super-admin routes.
- `ai_processing` - YOLOv8/OpenCV video processor using predefined slot polygons.
- `mobile` - Expo React Native driver app with no login.
- `web-admin` - Vite React admin dashboard with login and facility metrics.

## Current demo scope

All nine listed facilities (`FAC-001` through `FAC-009`) are demo entries. Montero (`FAC-001`) has sample slots, camera status, and occupancy history. The other eight have demo capacities but no monitored slots, so their reported available counts are demo values. The included test video is not footage from any of these facilities. A separate video-backed facility will be added later; the current web and mobile apps use the demo API data.

Detailed project guides are in `docs/`.

## Prerequisites

- Python 3.11+
- Node.js 20+
- Docker Desktop
- Expo Go on an Android device or emulator

## 1. Start PostgreSQL

```powershell
docker compose up -d postgres
```

ParkFinder maps PostgreSQL to `localhost:6543` to avoid conflicts with any PostgreSQL already running on Windows.

## 2. Configure and run the backend

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python scripts\seed.py
uvicorn app.main:app --reload --host 0.0.0.0
```

Backend URL:

```text
http://localhost:8000
```

API docs:

```text
http://localhost:8000/docs
```

Seed admin:

```text
Email: admin@parkfinder.local
Password: admin123
```

Seed super admin (web dashboard only):

```text
Email: superadmin@parkfinder.local
Password: superadmin123
```

Seed multi-facility admins (web dashboard only):

```text
3 facilities: cluster3@parkfinder.local / cluster3admin
5 facilities: cluster5@parkfinder.local / cluster5admin
```

## 3. Run the web admin dashboard

```powershell
cd web-admin
npm install
Copy-Item .env.example .env
npm run dev
```

Web admin URL:

```text
http://localhost:5173
```

## 4. Run the mobile driver app

```powershell
cd mobile
npm install
Copy-Item .env.example .env
npm run start
```

For a physical Android device, set `EXPO_PUBLIC_API_URL` in `mobile/.env` to your laptop LAN IP, for example:

```text
EXPO_PUBLIC_API_URL=http://192.168.1.50:8000/api/v1
```

Keep the phone and laptop on the same network. This project uses Expo SDK 52, so the Android phone needs the [SDK 52 version of Expo Go](https://expo.dev/go?device=true&platform=android&sdkVersion=52).

The mobile map uses OpenLayers with OpenStreetMap's public tiles for this demo. No map API key is needed. Keep OpenStreetMap attribution visible and follow its [tile usage policy](https://operations.osmfoundation.org/policies/tiles/); choose a dedicated tile service before wider production use.

For an Android emulator, use:

```text
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api/v1
```

## 5. Run YOLO parking detection

```powershell
cd ai_processing
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python detector.py --config config\parking_slots.sample.json --video C:\path\to\parking-video.mp4 --display
```

The detector:

1. Loads YOLOv8.
2. Reads a video file.
3. Checks vehicle detections against predefined parking slot polygons.
4. Marks each slot as occupied or vacant.
5. Sends slot status updates to the FastAPI backend.

## API Overview

Public driver endpoints:

- `GET /api/v1/facilities?search=Montero`
- `GET /api/v1/facilities/{facility_id}`
- `GET /api/v1/facilities/{facility_id}/availability`
- `GET /api/v1/facilities/{facility_id}/history`

Admin endpoints:

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET /api/v1/admin/facilities`
- `GET /api/v1/admin/dashboard`
- `GET /api/v1/admin/logs`
- `GET /api/v1/admin/reports`
- `GET /api/v1/admin/users` (super admin only)
- `GET /api/v1/admin/parking-lot-submissions`
- `POST /api/v1/admin/parking-lot-submissions` (facility owner)
- `POST /api/v1/admin/parking-lot-submissions/{id}/approve` (super admin only)
- `POST /api/v1/admin/parking-lot-submissions/{id}/reject` (super admin only)

AI ingest endpoint:

- `POST /api/v1/ingest/slot-status`

The AI endpoint requires the `X-API-Key` header. The default development key is in `backend/.env.example` and `ai_processing/.env.example`.

## Notes

- The backend creates tables automatically in development when `CREATE_TABLES_ON_START=true`.
- The seed script keeps Montero Parking Lot on the original ParkFinder admin and inserts eight additional map-listed Cagayan de Oro parking locations. Only their demo slot capacities are seeded; cameras, individual slots, and occupancy history are not fabricated for those locations.
- The three-lot account owns `FAC-002` through `FAC-004`; the five-lot account owns `FAC-005` through `FAC-009`. Montero (`FAC-001`) is not shared with either account.
- Facility owners can submit a new parking lot in the web dashboard. It becomes public and is assigned to that owner only after a super admin approves it.
- Replace the sample slot coordinates in `ai_processing/config/parking_slots.sample.json` with real CCTV-calibrated polygons for production footage.

bahog tiktik
