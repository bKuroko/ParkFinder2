# Security Notes

## Admin Authentication

Admins log in with email and password. Passwords are hashed with bcrypt. The backend returns a JWT for protected admin endpoints.

## Facility Authorization

Regular admin endpoints are restricted through `admin_facility_assignments`. An admin can request only its assigned parking facilities. Super admins have no facility assignments; they can select any facility and access the protected administrator list from the web dashboard only.

## AI API Key

The AI ingest endpoint requires:

```text
X-API-Key
```

The key is loaded from environment variables and should be changed for production.

## Environment Variables

Secrets and connection strings live in `.env` files:

- database URL
- JWT secret
- CORS origins
- AI ingest API key

Do not commit real production secrets.

## CCTV Privacy

Raw CCTV or video footage is not exposed to mobile users or web admins. The app only exposes derived parking availability data.

## CORS

Allowed frontend origins are configured through `BACKEND_CORS_ORIGINS`.

## Production Checklist

- Replace development secrets.
- Use HTTPS.
- Restrict CORS origins.
- Rotate AI ingest API keys.
- Use database migrations.
- Add audit logs for admin actions.
