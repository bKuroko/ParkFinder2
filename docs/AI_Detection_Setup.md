# AI Detection Setup

The AI module uses Python, OpenCV, and Ultralytics YOLOv8.

## Purpose

The laptop reads parking lot video footage, detects vehicles, compares detections with predefined parking slot polygons, classifies slots as occupied or available, and sends updates to FastAPI.

## Install

```powershell
cd ai_processing
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

## Configure

Slot polygons are stored in:

```text
ai_processing/config/parking_slots.sample.json
```

Update the polygons to match the CCTV/video camera angle.

The occupancy logic uses these config values:

- `confidence_threshold`: ignores low-confidence YOLO vehicle detections
- `slot_overlap_threshold`: marks a slot occupied when a vehicle box covers enough of the slot polygon
- `presence_frames`: number of detected frames needed before changing a slot to occupied
- `vacancy_frames`: number of empty frames needed before changing a slot back to available
- `post_interval_seconds`: sends the current slot state to FastAPI on this interval, and also sends immediately when a slot changes

A slot is occupied when a vehicle detection center is inside the slot polygon or the vehicle bounding box overlaps enough of the slot polygon. If the vehicle leaves, the detector sees the slot as empty for `vacancy_frames` processed frames, then posts the slot as available.

## Run

```powershell
python detector.py --config config\parking_slots.sample.json --video C:\path\to\parking-video.mp4 --display
```

The preview uses:

- green polygons for available slots
- red polygons for occupied slots

To test overlays without updating the backend:

```powershell
python detector.py --config config\parking_slots.sample.json --video C:\path\to\parking-video.mp4 --display --no-post
```

## Backend Update

The detector posts to:

```text
POST /api/v1/ingest/slot-status
```

with:

```text
X-API-Key: dev-ai-ingest-key
```

No Raspberry Pi is required for development.

### Send updates to Appwrite

After deploying the `parkfinder-api` Appwrite Function described in [`../appwrite/README.md`](../appwrite/README.md), set `PARKFINDER_API_URL` in `ai_processing/.env` to the generated HTTPS Function domain plus `/api/v1`, and set `PARKFINDER_AI_API_KEY` to the same private value configured as the Function's `AI_INGEST_API_KEY`. The existing detector and simulator can then post through the compatibility endpoint. Keep that key on the YOLO computer; never place it in the mobile app or website.

## Try Without Footage

Real YOLO detection needs video, an image, or a camera feed. If you do not have footage yet, you can still test the AI-to-backend update flow with the simulator:

```powershell
cd ai_processing
.\.venv\Scripts\Activate.ps1
python simulate_ai_updates.py --config config\parking_slots.sample.json --cycles 5 --interval 3
```

This simulates changing slot statuses and posts them to:

```text
POST /api/v1/ingest/slot-status
```

Keep the FastAPI backend running while using the simulator without `--dry-run`.

Use dry run mode to preview the simulated counts without touching the backend:

```powershell
cd ai_processing
.\.venv\Scripts\Activate.ps1
python simulate_ai_updates.py --config config\parking_slots.sample.json --cycles 3 --dry-run
```

The simulator is useful for checking the database, mobile app, and admin dashboard before real CCTV/video footage is available.
