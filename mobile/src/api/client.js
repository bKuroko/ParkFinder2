const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://10.0.2.2:8000/api/v1";
const REQUEST_TIMEOUT_MS = 3000;

const FALLBACK_FACILITY = {
  id: 1,
  facility_code: "FAC-001",
  name: "Montero Parking Lot",
  address: "Cagayan de Oro City, Misamis Oriental",
  latitude: 8.459434,
  longitude: 124.607614,
  total_slots: 12,
  available_slots: 5,
  occupied_slots: 7,
  occupancy_percentage: 58.33,
  updated_at: null
};

function rectangle(x, y, width, height) {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height }
  ];
}

function fallbackSlots() {
  return Array.from({ length: 12 }, (_, index) => ({
    slot_number: index < 6 ? `A${index + 1}` : `B${index - 5}`,
    is_occupied: [1, 3, 5, 6, 8, 10, 11].includes(index),
    confidence: [1, 3, 5, 6, 8, 10, 11].includes(index) ? 0.92 : 0,
    polygon: rectangle(80 + (index % 6) * 95, index < 6 ? 120 : 330, 72, 128),
    last_seen_at: new Date().toISOString()
  }));
}

export function getCachedFacilities(search = "") {
  if (!search.trim()) {
    return [FALLBACK_FACILITY];
  }
  return FALLBACK_FACILITY.name.toLowerCase().includes(search.trim().toLowerCase())
    ? [FALLBACK_FACILITY]
    : [];
}

export function getCachedFacility() {
  return {
    ...FALLBACK_FACILITY,
    slots: fallbackSlots(),
    cameras: [
      {
        id: 1,
        name: "Montero CCTV",
        source_url: "montero-parking-sample.mp4",
        status: "online",
        last_heartbeat_at: new Date().toISOString()
      }
    ]
  };
}

async function request(path, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_URL}${path}`, {
      signal: controller.signal
    });
    if (!response.ok) {
      const message = await response.text();
      const apiError = new Error(message || `Request failed with status ${response.status}`);
      apiError.isHttpError = true;
      throw apiError;
    }
    return response.json();
  } catch (error) {
    if (error.isHttpError) {
      throw error;
    }
    if (error.name === "AbortError") {
      throw new Error(`Cannot reach ParkFinder server at ${API_URL}. Check that the backend is running.`);
    }
    if (error.message?.startsWith("Cannot reach ParkFinder server")) {
      throw error;
    }
    throw new Error(`Cannot reach ParkFinder server at ${API_URL}. Check that the backend is running.`);
  } finally {
    clearTimeout(timeout);
  }
}

export function searchFacilities(search) {
  const params = search ? `?search=${encodeURIComponent(search)}` : "";
  return request(`/facilities${params}`);
}

export function getFacility(facilityId) {
  return request(`/facilities/${facilityId}`);
}

export function getFacilityAvailability(facilityId) {
  return request(`/facilities/${facilityId}/availability`);
}
