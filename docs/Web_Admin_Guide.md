# Web Admin Guide

The admin dashboard is built with React and Vite.

## Features

- Admin login
- Facility-restricted dashboard
- Facility name
- Facility ID
- Total slots
- Available slots
- Occupied slots
- Occupancy percentage
- Occupancy trend
- Camera status
- Logs and reports

## Run

```powershell
cd web-admin
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## Login

```text
admin@parkfinder.local
admin123
```

## Facility Restriction

The JWT identifies the admin. The backend uses the admin's `facility_id` to restrict dashboard, logs, and reports to the assigned facility only.
