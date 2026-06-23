# ParkFinder Setup Guide

ParkFinder uses a laptop for development, PostgreSQL for data storage, FastAPI for the backend, Expo React Native for the driver app, Vite React for the admin dashboard, and YOLOv8/OpenCV for video processing.

## Prerequisites

- Python 3.11+
- Node.js 20+
- Docker Desktop
- Expo Go on an Android phone or emulator

## Start PostgreSQL

From the project root:

```powershell
docker compose up -d postgres
```

The database is mapped to `localhost:6543` to avoid conflicts with local PostgreSQL services.

## Backend

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python scripts\seed.py
uvicorn app.main:app --reload --host 0.0.0.0
```

Open:

```text
http://localhost:8000/docs
```

## Mobile App

For a real Android phone, set `mobile/.env` to your laptop Wi-Fi IP:

```text
EXPO_PUBLIC_API_URL=http://YOUR_LAPTOP_IP:8000/api/v1
```

Then run:

```powershell
cd mobile
npm install
npm run start -- --clear
```

## Web Admin

```powershell
cd web-admin
npm install
Copy-Item .env.example .env
npm run dev
```

Open:

```text
http://localhost:5173
```

Seed admin:

```text
admin@parkfinder.local
admin123
```
