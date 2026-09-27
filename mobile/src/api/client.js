const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://10.0.2.2:8000/api/v1";
const REQUEST_TIMEOUT_MS = 3000;

let cachedFacilities = [];
const cachedFacilitiesById = new Map();

function cacheFacility(facility) {
  if (!facility?.id) {
    return facility;
  }

  const cached = { ...facility };
  cachedFacilitiesById.set(String(facility.id), cached);
  const existingIndex = cachedFacilities.findIndex((item) => item.id === facility.id);
  if (existingIndex >= 0) {
    cachedFacilities = cachedFacilities.map((item, index) =>
      index === existingIndex ? cached : item
    );
  } else {
    cachedFacilities = [...cachedFacilities, cached];
  }
  return facility;
}

export function getCachedFacilities(search = "") {
  const query = search.trim().toLowerCase();
  return query
    ? cachedFacilities.filter((facility) =>
        facility.name.toLowerCase().includes(query) ||
        facility.facility_code?.toLowerCase().includes(query)
      )
    : [...cachedFacilities];
}

export function getCachedFacility(facilityId) {
  if (facilityId != null) {
    return cachedFacilitiesById.get(String(facilityId)) || null;
  }
  return cachedFacilities[0] || null;
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
    throw new Error("Parking information is unavailable. Check your connection and try again.");
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchFacilities(search) {
  const params = search ? `?search=${encodeURIComponent(search)}` : "";
  const facilities = await request(`/facilities${params}`);
  facilities.forEach(cacheFacility);
  return facilities;
}

export async function getFacility(facilityId) {
  const facility = await request(`/facilities/${facilityId}`);
  return cacheFacility(facility);
}

export function getFacilityAvailability(facilityId) {
  return request(`/facilities/${facilityId}/availability`);
}
