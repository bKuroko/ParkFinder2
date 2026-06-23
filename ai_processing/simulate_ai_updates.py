from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv


def load_config(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def build_slot_updates(slots: list[dict[str, Any]], cycle: int) -> list[dict[str, Any]]:
    updates = []
    for index, slot in enumerate(slots):
        # A simple moving pattern so availability changes between cycles.
        is_occupied = (index + cycle) % 4 in {0, 1}
        updates.append(
            {
                "slot_number": slot["slot_number"],
                "is_occupied": is_occupied,
                "confidence": 0.91 if is_occupied else 0.0,
            }
        )
    return updates


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
            "slots": slots,
        },
        timeout=10,
    )
    response.raise_for_status()
    return response.json()


def run_simulation(args: argparse.Namespace) -> None:
    load_dotenv()
    config = load_config(Path(args.config))
    api_url = os.getenv("PARKFINDER_API_URL", "http://localhost:8000/api/v1")
    api_key = os.getenv("PARKFINDER_AI_API_KEY", "dev-ai-ingest-key")

    for cycle in range(args.cycles):
        updates = build_slot_updates(config["slots"], cycle)
        occupied = sum(1 for update in updates if update["is_occupied"])
        available = len(updates) - occupied

        if args.dry_run:
            print(
                f"Cycle {cycle + 1}: dry run, {available} available, {occupied} occupied"
            )
        else:
            result = post_status(
                api_url=api_url,
                api_key=api_key,
                facility_id=int(config["facility_id"]),
                camera_id=config.get("camera_id"),
                slots=updates,
            )
            print(f"Cycle {cycle + 1}: backend updated -> {result}")

        if cycle < args.cycles - 1:
            time.sleep(args.interval)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Simulate AI parking slot updates without video footage."
    )
    parser.add_argument(
        "--config",
        default="config/parking_slots.sample.json",
        help="Path to slot config JSON.",
    )
    parser.add_argument("--cycles", type=int, default=5, help="Number of update cycles.")
    parser.add_argument("--interval", type=float, default=3.0, help="Seconds between cycles.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print simulated statuses without posting to the backend.",
    )
    return parser


if __name__ == "__main__":
    run_simulation(build_parser().parse_args())
