# Web Admin Guide

The admin dashboard is built with React and Vite.

## Features

- Admin login
- Facility-restricted dashboard
- Web-only super-admin access across all facilities
- Super-admin facility switcher and administrator list
- Multi-facility accounts assigned to three or five parking lots
- Facility-owner parking lot submission form
- Super-admin approval and rejection queue
- Facility name
- Facility ID
- Total slots
- Available slots
- Occupied slots
- Occupancy percentage
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

Facility admin:

```text
admin@parkfinder.local
admin123
```

Super admin:

```text
superadmin@parkfinder.local
superadmin123
```

Multi-facility admins:

```text
cluster3@parkfinder.local / cluster3admin
cluster5@parkfinder.local / cluster5admin
```

## Facility Restriction

The JWT identifies the admin. Regular admins can access only their assigned facility list, which may contain one, three, or five parking lots. A super admin has no facility restriction and can select any facility from the web dashboard. Admin authentication is not exposed in the mobile driver app.

Montero Parking Lot belongs only to `admin@parkfinder.local`. The three-lot account owns `FAC-002` through `FAC-004`, while the five-lot account owns `FAC-005` through `FAC-009`.

## Parking Lot Approval

1. A facility owner opens **Parking Lots** and submits the name, address or Plus Code, coordinates, and seeded slot count.
2. The request remains pending and is not visible in the public/mobile facility list.
3. The super admin opens **Parking Lots** and approves or rejects the request.
4. Approval creates the facility, makes it public, and assigns it to the submitting owner.
