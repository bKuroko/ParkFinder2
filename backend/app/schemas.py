from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: str
    password: str


class AdminProfile(BaseModel):
    id: int
    email: str
    full_name: str
    facility_id: int | None
    facility_ids: list[int]
    role: str
    is_super_admin: bool

    model_config = ConfigDict(from_attributes=True)


class ParkingLotSubmissionCreate(BaseModel):
    name: str = Field(min_length=3, max_length=160)
    address: str = Field(min_length=5, max_length=255)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    total_slots: int = Field(ge=1, le=10_000)


class ParkingLotSubmissionItem(BaseModel):
    id: int
    name: str
    address: str
    latitude: float
    longitude: float
    total_slots: int
    status: Literal["pending", "approved", "rejected"]
    submitted_by_admin_id: int
    submitter_name: str
    submitter_email: str
    reviewed_by_admin_id: int | None = None
    facility_id: int | None = None
    submitted_at: datetime
    reviewed_at: datetime | None = None


class SlotStatus(BaseModel):
    slot_number: str
    is_occupied: bool
    confidence: float = 0.0
    polygon: list[dict[str, float]]
    last_seen_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class CameraStatus(BaseModel):
    id: int
    name: str
    source_url: str
    status: str
    last_heartbeat_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class FacilitySummary(BaseModel):
    id: int
    facility_code: str
    name: str
    address: str
    latitude: float | None
    longitude: float | None
    total_slots: int
    available_slots: int
    occupied_slots: int
    occupancy_percentage: float
    updated_at: datetime | None = None


class FacilityAvailability(BaseModel):
    facility_id: int
    facility_code: str
    facility_name: str
    total_slots: int
    available_slots: int
    occupied_slots: int
    occupancy_percentage: float
    updated_at: datetime | None = None


class FacilityDetail(FacilitySummary):
    slots: list[SlotStatus]
    cameras: list[CameraStatus]


class OccupancyHistoryItem(BaseModel):
    available_slots: int
    occupied_slots: int
    occupancy_percentage: float
    captured_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MonitoringLogItem(BaseModel):
    id: int
    level: str
    message: str
    details: dict[str, Any] | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DashboardResponse(BaseModel):
    facility: FacilitySummary
    cameras: list[CameraStatus]
    history: list[OccupancyHistoryItem]
    logs: list[MonitoringLogItem]


class SlotDetectionUpdate(BaseModel):
    slot_number: str
    is_occupied: bool
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class SlotStatusIngest(BaseModel):
    facility_id: int
    camera_id: int | None = None
    camera_status: str = "online"
    slots: list[SlotDetectionUpdate]
