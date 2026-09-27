# Mobile App Guide

The driver app is built with Expo React Native. Drivers do not log in.

## Features

- Search parking facility
- View facility details
- View demo availability from the backend
- View available slot count
- View occupied slot count
- View occupancy percentage
- View map-based parking view
- Open directly to the map after the first welcome screen
- Browse demo lots directly on the map; matching lots appear in a list only during search
- See compact lot names above map pins, with overlapping names hidden
- See pin colors for plentiful, filling, and few or full demo spaces
- Retry the map if tiles fail to load

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

The mobile app uses OpenLayers inside a WebView with OpenStreetMap's public tiles for this demo. No map API key is needed. The map keeps OpenStreetMap attribution visible and identifies the app in tile requests, as required by the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/). All nine demo facilities appear on the map; search filters them, and selecting one centers the map on its stored latitude and longitude. Availability is labeled as demo data throughout the app.
