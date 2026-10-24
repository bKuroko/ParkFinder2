# Move ParkFinder backend data and API to Appwrite

This migration keeps the existing REST paths (`/api/v1/...`) by hosting one Python Appwrite Function as `parkfinder-api`. The function writes data to Appwrite TablesDB and retains the current admin login/JWT API contract. The mobile and web screens can therefore keep their existing request code and only change their API base URL. Appwrite Auth is not wired into the existing admin login yet.

The camera/YOLO process stays on a computer that can reach the CCTV's private RTSP address. It sends occupancy JSON to this Function; it does not upload or process the video in Appwrite.

## 1. Create the Appwrite project and key

In Appwrite Console, create/select your Cloud project. Create a temporary setup key with these scopes for the schema and migration scripts:

- `rows.read`
- `rows.write`
- `databases.write`
- `tables.write`
- `columns.read`
- `columns.write`
- `indexes.read`
- `indexes.write`

Do not put this key in mobile or web code, and do not commit it to GitHub. Create a second, least-privilege key with only `rows.read` and `rows.write` for the deployed Function. Store that second key in the Function environment as a secret named `APPWRITE_API_KEY`; revoke the temporary setup key when schema creation and data migration are done.

## 2. Prepare the TablesDB schema

Use a local Python environment with `requests` installed. In PowerShell, from the repository root, set the Appwrite values for this session (replace each placeholder with the values shown in your Appwrite Console; do not save the key in a tracked file):

```powershell
$env:APPWRITE_ENDPOINT = "https://REGION.cloud.appwrite.io/v1"
$env:APPWRITE_PROJECT_ID = "YOUR_PROJECT_ID"
$env:APPWRITE_API_KEY = "YOUR_SERVER_API_KEY"
python -m pip install requests
python appwrite/scripts/bootstrap_appwrite.py
```

The script creates a `parkfinder` TablesDB database and the tables used by the API: `facilities`, `admin_users`, `parking_lot_submissions`, `parking_slots`, `occupancy_records`, `cameras`, `occupancy_snapshots`, and `monitoring_logs`. These tables have no public permissions; client apps call the Function instead.

## 3. Copy the existing local data (optional for a new project)

Start the local PostgreSQL database and run the existing seed script first if you want the demo facilities/admin accounts. With `backend/.env` configured for the local database and the Appwrite variables above still set, run:

```powershell
python appwrite/scripts/migrate_local_postgres.py
```

The migration preserves each SQL row's numeric ID and is safe to re-run; it updates matching Appwrite rows and does not delete local data. Do not run it until the Appwrite schema exists.

## 4. Deploy the API Function

Push this repository to GitHub. In Appwrite Console, open **Functions → Create function → Connect Git repository** and configure:

- Function name: `parkfinder-api`
- Runtime: Python 3.12 (or the newest Python runtime Appwrite Cloud offers)
- Root directory: `appwrite/functions/parkfinder-api`
- Entrypoint: `src/main.py`
- Build command: `pip install -r requirements.txt`
- Execute access: `Any` for its HTTP domain (the function enforces admin JWT and YOLO API-key checks itself)

Add these Function environment variables in the Appwrite Console. Mark secrets as secret:

| Variable | Value |
| --- | --- |
| `APPWRITE_ENDPOINT` | Your region endpoint, e.g. `https://REGION.cloud.appwrite.io/v1` |
| `APPWRITE_API_KEY` | Server API key with the scopes above (secret) |
| `APPWRITE_DATABASE_ID` | `parkfinder` |
| `JWT_SECRET_KEY` | A new long random secret (secret; don't reuse the sample dev key) |
| `AI_INGEST_API_KEY` | A new random key for YOLO ingestion (secret) |
| `WEB_ORIGIN` | Your deployed admin site's origin after it exists; `*` is okay for local trial |

Deploy the function, then open its **Domains** tab and copy the generated HTTPS domain. Its API base is that domain plus `/api/v1`, for example `https://YOUR-FUNCTION-DOMAIN/api/v1`.

`APPWRITE_FUNCTION_PROJECT_ID` is injected into the Function by Appwrite; the setup script uses `APPWRITE_PROJECT_ID` from your local PowerShell environment.

## 5. Point ParkFinder at the Function

Set the function API base in the ignored local environment files:

- `mobile/.env`: `EXPO_PUBLIC_API_URL=https://YOUR-FUNCTION-DOMAIN/api/v1`
- `web-admin/.env`: `VITE_API_URL=https://YOUR-FUNCTION-DOMAIN/api/v1`
- `ai_processing/.env`: `PARKFINDER_API_URL=https://YOUR-FUNCTION-DOMAIN/api/v1` and `PARKFINDER_AI_API_KEY` to the same secret value as `AI_INGEST_API_KEY`

Restart Expo/Vite after changing environment values. Keep the YOLO API key only on the camera computer. The Appwrite project key must never be copied into these client `.env` files.

## Current scope and limitations

- The Appwrite Function preserves the current driver, admin, and YOLO REST routes so the clients can be switched by configuration.
- Admin login remains the project's existing password-hash/JWT flow stored in the `admin_users` table. Appwrite Auth migration can be done later.
- Appwrite's Function HTTP domain has a short synchronous execution limit. This API stores small status updates and returns quickly; video processing remains local.
- SQL rows are not synchronized automatically after migration. Once switched, Appwrite is the cloud source of truth; local PostgreSQL remains available for development.
