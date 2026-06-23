# Mobile App Guide

The driver app is built with Expo React Native. Drivers do not log in.

## Features

- Search parking facility
- View facility details
- View real-time availability
- View available slot count
- View occupied slot count
- View occupancy percentage
- View map-based parking view

## Not Included

- Login
- Registration
- Profile
- Favorites
- Recent searches
- Reservation
- Payment
- Turn-by-turn directions

## Run

```powershell
cd mobile
npm install
npm run start -- --clear
```

For a real phone, set:

```text
EXPO_PUBLIC_API_URL=http://YOUR_LAPTOP_IP:8000/api/v1
```

The backend must run with:

```powershell
uvicorn app.main:app --reload --host 0.0.0.0
```

## Map

The mobile app uses OpenLayers inside a WebView with OpenStreetMap/CARTO tiles. Parking facilities appear after search, and selecting a facility centers the map on its stored latitude and longitude.
