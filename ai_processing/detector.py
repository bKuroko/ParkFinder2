from __future__ import annotations

import argparse
import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import requests
from dotenv import load_dotenv
from ultralytics import YOLO


@dataclass
class ParkingSlot:
    slot_number: str
    polygon: np.ndarray
    area: float


@dataclass
class VehicleDetection:
    box: np.ndarray
    confidence: float
    class_id: int


@dataclass
class OccupancySettings:
    confidence_threshold: float = 0.35
    slot_overlap_threshold: float = 0.12
    presence_frames: int = 1
    vacancy_frames: int = 2
    overlay_alpha: float = 0.28


@dataclass
class SlotState:
    is_occupied: bool = False
    candidate_status: bool | None = None
    candidate_frames: int = 0
    confidence: float = 0.0
    overlap_ratio: float = 0.0


def load_config(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def parse_slots(config: dict[str, Any]) -> list[ParkingSlot]:
    slots = []
    for slot in config["slots"]:
        points = np.array([[point["x"], point["y"]] for point in slot["polygon"]], dtype=np.int32)
        area = max(float(cv2.contourArea(points.astype(np.float32))), 1.0)
        slots.append(ParkingSlot(slot_number=slot["slot_number"], polygon=points, area=area))
    return slots


def parse_occupancy_settings(config: dict[str, Any]) -> OccupancySettings:
    return OccupancySettings(
        confidence_threshold=float(config.get("confidence_threshold", 0.35)),
        slot_overlap_threshold=float(config.get("slot_overlap_threshold", 0.12)),
        presence_frames=max(1, int(config.get("presence_frames", 1))),
        vacancy_frames=max(1, int(config.get("vacancy_frames", 2))),
        overlay_alpha=float(config.get("overlay_alpha", 0.28)),
    )


class OccupancyStateTracker:
    def __init__(self, slots: list[ParkingSlot], settings: OccupancySettings) -> None:
        self.settings = settings
        self.states = {slot.slot_number: SlotState() for slot in slots}

    def initial_updates(self) -> list[dict[str, Any]]:
        return [
            {
                "slot_number": slot_number,
                "is_occupied": state.is_occupied,
                "confidence": state.confidence,
                "overlap_ratio": state.overlap_ratio,
            }
            for slot_number, state in self.states.items()
        ]

    def smooth(self, raw_updates: list[dict[str, Any]]) -> list[dict[str, Any]]:
        smoothed = []
        for update in raw_updates:
            state = self.states[update["slot_number"]]
            raw_status = bool(update["is_occupied"])

            if raw_status == state.is_occupied:
                state.candidate_status = None
                state.candidate_frames = 0
            else:
                if state.candidate_status == raw_status:
                    state.candidate_frames += 1
                else:
                    state.candidate_status = raw_status
                    state.candidate_frames = 1

                required_frames = (
                    self.settings.presence_frames if raw_status else self.settings.vacancy_frames
                )
                if state.candidate_frames >= required_frames:
                    state.is_occupied = raw_status
                    state.candidate_status = None
                    state.candidate_frames = 0

            if raw_status:
                state.confidence = float(update["confidence"])
                state.overlap_ratio = float(update["overlap_ratio"])
            elif not state.is_occupied:
                state.confidence = 0.0
                state.overlap_ratio = 0.0

            smoothed.append(
                {
                    "slot_number": update["slot_number"],
                    "is_occupied": state.is_occupied,
                    "confidence": round(state.confidence if state.is_occupied else 0.0, 3),
                    "overlap_ratio": round(state.overlap_ratio if state.is_occupied else 0.0, 3),
                }
            )
        return smoothed


def detection_center(detection: VehicleDetection) -> tuple[float, float]:
    box = detection.box
    x1, y1, x2, y2 = box
    return (float((x1 + x2) / 2), float((y1 + y2) / 2))


def clip_box_to_frame(box: np.ndarray, frame_shape: tuple[int, ...]) -> tuple[int, int, int, int] | None:
    frame_height, frame_width = frame_shape[:2]
    x1 = max(0, min(frame_width - 1, int(np.floor(box[0]))))
    y1 = max(0, min(frame_height - 1, int(np.floor(box[1]))))
    x2 = max(0, min(frame_width, int(np.ceil(box[2]))))
    y2 = max(0, min(frame_height, int(np.ceil(box[3]))))
    if x2 <= x1 or y2 <= y1:
        return None
    return x1, y1, x2, y2


def slot_overlap_ratio(
    slot: ParkingSlot,
    detection: VehicleDetection,
    frame_shape: tuple[int, ...],
) -> float:
    clipped_box = clip_box_to_frame(detection.box, frame_shape)
    if clipped_box is None:
        return 0.0

    x1, y1, x2, y2 = clipped_box
    roi_width = x2 - x1
    roi_height = y2 - y1
    roi_polygon = slot.polygon - np.array([x1, y1], dtype=np.int32)
    mask = np.zeros((roi_height, roi_width), dtype=np.uint8)
    cv2.fillPoly(mask, [roi_polygon], 255)
    covered_area = float(cv2.countNonZero(mask))
    return min(covered_area / slot.area, 1.0)


def is_detection_in_slot(
    slot: ParkingSlot,
    detection: VehicleDetection,
    settings: OccupancySettings,
    frame_shape: tuple[int, ...],
) -> tuple[bool, float]:
    center_inside = cv2.pointPolygonTest(slot.polygon, detection_center(detection), False) >= 0
    overlap = slot_overlap_ratio(slot, detection, frame_shape)
    occupied = center_inside or overlap >= settings.slot_overlap_threshold
    return occupied, overlap


def classify_slots(
    slots: list[ParkingSlot],
    detections: list[VehicleDetection],
    settings: OccupancySettings,
    frame_shape: tuple[int, ...],
) -> list[dict[str, Any]]:
    slot_updates = []
    for slot in slots:
        occupied = False
        best_confidence = 0.0
        best_overlap = 0.0
        for detection in detections:
            detection_occupies_slot, overlap = is_detection_in_slot(
                slot=slot,
                detection=detection,
                settings=settings,
                frame_shape=frame_shape,
            )
            if detection_occupies_slot:
                occupied = True
                best_confidence = max(best_confidence, detection.confidence)
                best_overlap = max(best_overlap, overlap)

        slot_updates.append(
            {
                "slot_number": slot.slot_number,
                "is_occupied": occupied,
                "confidence": round(float(best_confidence), 3),
                "overlap_ratio": round(float(best_overlap), 3),
            }
        )
    return slot_updates


def vehicle_detections(
    result: Any,
    vehicle_class_ids: set[int],
    confidence_threshold: float,
) -> list[VehicleDetection]:
    detections = []
    for box in result.boxes:
        class_id = int(box.cls[0])
        if class_id not in vehicle_class_ids:
            continue
        confidence = float(box.conf[0])
        if confidence < confidence_threshold:
            continue
        detections.append(VehicleDetection(box=box.xyxy[0].cpu().numpy(), confidence=confidence, class_id=class_id))
    return detections


def backend_slot_payload(slot_updates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "slot_number": update["slot_number"],
            "is_occupied": bool(update["is_occupied"]),
            "confidence": float(update["confidence"]),
        }
        for update in slot_updates
    ]


def post_status(
    api_url: str,
    api_key: str,
    facility_id: int,
    camera_id: int | None,
    slots: list[dict[str, Any]],
) -> dict[str, Any]:
    response = requests.post(
        f"{api_url.rstrip('/')}/ingest/slot-status",
        headers={"X-API-Key": api_key},
        json={
            "facility_id": facility_id,
            "camera_id": camera_id,
            "camera_status": "online",
            "slots": backend_slot_payload(slots),
        },
        timeout=10,
    )
    response.raise_for_status()
    return response.json()


def slot_status_map(slot_updates: list[dict[str, Any]]) -> dict[str, bool]:
    return {update["slot_number"]: bool(update["is_occupied"]) for update in slot_updates}


def status_changed(
    previous_statuses: dict[str, bool] | None,
    current_updates: list[dict[str, Any]],
) -> bool:
    if previous_statuses is None:
        return True
    current_statuses = slot_status_map(current_updates)
    return any(previous_statuses.get(slot_number) != is_occupied for slot_number, is_occupied in current_statuses.items())


def draw_label(frame: np.ndarray, text: str, origin: tuple[int, int], color: tuple[int, int, int]) -> None:
    x, y = origin
    y = max(y, 22)
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.48
    thickness = 1
    (width, height), baseline = cv2.getTextSize(text, font, font_scale, thickness)
    cv2.rectangle(frame, (x, y - height - baseline - 4), (x + width + 8, y + 4), (20, 20, 20), -1)
    cv2.putText(frame, text, (x + 4, y - baseline), font, font_scale, color, thickness, cv2.LINE_AA)


def draw_overlay(
    frame: np.ndarray,
    slots: list[ParkingSlot],
    slot_updates: list[dict[str, Any]],
    detections: list[VehicleDetection],
    settings: OccupancySettings,
) -> np.ndarray:
    status_by_slot = {update["slot_number"]: update for update in slot_updates}
    filled = frame.copy()
    for slot in slots:
        update = status_by_slot.get(slot.slot_number, {})
        occupied = bool(update.get("is_occupied"))
        color = (0, 0, 255) if occupied else (0, 180, 0)
        cv2.fillPoly(filled, [slot.polygon], color)

    cv2.addWeighted(filled, settings.overlay_alpha, frame, 1 - settings.overlay_alpha, 0, frame)

    for detection in detections:
        x1, y1, x2, y2 = detection.box.astype(int)
        cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 170, 0), 2)
        draw_label(frame, f"vehicle {detection.confidence:.2f}", (x1, y1), (255, 220, 120))

    for slot in slots:
        update = status_by_slot.get(slot.slot_number, {})
        occupied = bool(update.get("is_occupied"))
        color = (0, 0, 255) if occupied else (0, 180, 0)
        status_text = "Occupied" if occupied else "Available"
        confidence = float(update.get("confidence", 0.0))
        cv2.polylines(frame, [slot.polygon], isClosed=True, color=color, thickness=2)
        label_x, label_y = tuple(slot.polygon[0])
        label = f"{slot.slot_number} {status_text}"
        if occupied:
            label = f"{label} {confidence:.2f}"
        draw_label(frame, label, (int(label_x), int(label_y)), color)
    return frame


def run_detector(args: argparse.Namespace) -> None:
    load_dotenv()
    config = load_config(Path(args.config))
    video_path = args.video or config.get("video_path")
    if not video_path:
        raise ValueError("Provide --video or set video_path in the config file.")

    api_url = os.getenv("PARKFINDER_API_URL", "http://localhost:8000/api/v1")
    api_key = os.getenv("PARKFINDER_AI_API_KEY", "dev-ai-ingest-key")
    slots = parse_slots(config)
    settings = parse_occupancy_settings(config)
    vehicle_class_ids = set(config.get("vehicle_class_ids", [2, 3, 5, 7]))
    frame_skip = int(config.get("frame_skip", 5))
    post_interval_seconds = float(config.get("post_interval_seconds", 5))
    tracker = OccupancyStateTracker(slots, settings)

    model = YOLO(config.get("model_name", "yolov8n.pt"))
    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        raise RuntimeError(f"Could not open video source: {video_path}")

    writer = None
    if args.output:
        fps = capture.get(cv2.CAP_PROP_FPS) or 25
        width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(args.output, fourcc, fps, (width, height))

    frame_index = 0
    last_post_at = 0.0
    last_sent_statuses: dict[str, bool] | None = None
    latest_updates = tracker.initial_updates()
    latest_detections: list[VehicleDetection] = []

    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                break

            if frame_index % frame_skip == 0:
                result = model(frame, verbose=False)[0]
                latest_detections = vehicle_detections(
                    result=result,
                    vehicle_class_ids=vehicle_class_ids,
                    confidence_threshold=settings.confidence_threshold,
                )
                raw_updates = classify_slots(
                    slots=slots,
                    detections=latest_detections,
                    settings=settings,
                    frame_shape=frame.shape,
                )
                latest_updates = tracker.smooth(raw_updates)

                now = time.time()
                changed = status_changed(last_sent_statuses, latest_updates)
                should_post = (
                    not args.no_post
                    and (changed or now - last_post_at >= post_interval_seconds)
                )
                if should_post:
                    try:
                        response = post_status(
                            api_url=api_url,
                            api_key=api_key,
                            facility_id=int(config["facility_id"]),
                            camera_id=config.get("camera_id"),
                            slots=latest_updates,
                        )
                        last_post_at = now
                        last_sent_statuses = slot_status_map(latest_updates)
                        print(
                            "Posted "
                            f"{len(latest_updates)} slots: "
                            f"{response.get('available_slots')} available, "
                            f"{response.get('occupied_slots')} occupied"
                        )
                    except requests.RequestException as exc:
                        print(f"Could not post slot updates: {exc}")

            overlay = draw_overlay(frame.copy(), slots, latest_updates, latest_detections, settings)
            if writer:
                writer.write(overlay)
            if args.display:
                cv2.imshow("ParkFinder Detection", overlay)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

            frame_index += 1
    finally:
        capture.release()
        if writer:
            writer.release()
        cv2.destroyAllWindows()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run YOLOv8 parking slot occupancy detection.")
    parser.add_argument("--config", default="config/parking_slots.sample.json", help="Path to slot config JSON.")
    parser.add_argument("--video", help="Path to a parking lot video file.")
    parser.add_argument("--display", action="store_true", help="Show live OpenCV preview.")
    parser.add_argument("--output", help="Optional path to write annotated video.")
    parser.add_argument("--no-post", action="store_true", help="Run detection without posting to FastAPI.")
    return parser


if __name__ == "__main__":
    run_detector(build_parser().parse_args())
