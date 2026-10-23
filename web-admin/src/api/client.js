const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";
const TOKEN_KEY = "parkfinder_admin_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      }
    });
  } catch (error) {
    const apiError = new Error(`Cannot reach ParkFinder API at ${API_URL}. Check that the backend is running.`);
    apiError.cause = error;
    throw apiError;
  }

  if (!response.ok) {
    const message = await response.text();
    const error = new Error(message || `Request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export async function login(email, password) {
  const data = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  setToken(data.access_token);
  return data;
}

function facilityPath(path, facilityId) {
  if (facilityId === null || facilityId === undefined) {
    return path;
  }
  return `${path}?facility_id=${encodeURIComponent(facilityId)}`;
}

export function getAdminFacilities() {
  return request("/admin/facilities");
}

export function getAdminUsers() {
  return request("/admin/users");
}

export function getParkingLotSubmissions() {
  return request("/admin/parking-lot-submissions");
}

export function submitParkingLot(payload) {
  return request("/admin/parking-lot-submissions", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function approveParkingLotSubmission(submissionId) {
  return request(`/admin/parking-lot-submissions/${submissionId}/approve`, {
    method: "POST"
  });
}

export function rejectParkingLotSubmission(submissionId) {
  return request(`/admin/parking-lot-submissions/${submissionId}/reject`, {
    method: "POST"
  });
}

export function getDashboard(facilityId) {
  return request(facilityPath("/admin/dashboard", facilityId));
}

export function getReports(facilityId) {
  return request(facilityPath("/admin/reports", facilityId));
}

export function getAdminLogs(facilityId) {
  return request(facilityPath("/admin/logs", facilityId));
}

export function getCurrentAdmin() {
  return request("/auth/me");
}

export function getFacility(facilityId) {
  return request(`/facilities/${facilityId}`);
}

export function setSlotStatus(facilityId, direction) {
  return request(`/admin/facilities/${facilityId}/slots/count`, {
    method: "POST",
    body: JSON.stringify({ direction })
  });
}
