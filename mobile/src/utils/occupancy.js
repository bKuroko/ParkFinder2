const STATUS = {
  green: { color: "#078528", textColor: "#078528", backgroundColor: "#f4fbf6", pinTextColor: "#ffffff", label: "Low occupancy" },
  yellow: { color: "#eab308", textColor: "#854d0e", backgroundColor: "#fefce8", pinTextColor: "#422006", label: "Moderate occupancy" },
  orange: { color: "#f97316", textColor: "#9a3412", backgroundColor: "#fff7ed", pinTextColor: "#431407", label: "High occupancy" },
  red: { color: "#dc2626", textColor: "#b91c1c", backgroundColor: "#fef2f2", pinTextColor: "#ffffff", label: "Full" },
  unknown: { color: "#9ca3af", textColor: "#596579", backgroundColor: "#f3f4f6", pinTextColor: "#111827", label: "Occupancy unavailable" }
};

function numeric(value) {
  if (value == null || typeof value === "boolean" || (typeof value === "string" && !value.trim())) return NaN;
  return Number(value);
}

export function getOccupancyStatus(facility) {
  const total = numeric(facility?.total_slots);
  if (!Number.isFinite(total) || total <= 0) return STATUS.unknown;
  let percentage = numeric(facility?.occupancy_percentage);
  if (!Number.isFinite(percentage)) {
    const occupied = numeric(facility?.occupied_slots);
    if (Number.isFinite(occupied) && occupied >= 0) percentage = occupied / total * 100;
  }
  if (!Number.isFinite(percentage) || percentage < 0) return STATUS.unknown;
  // Shared edges belong to the lower band: 25% is green, 75% is yellow.
  if (percentage <= 25) return STATUS.green;
  if (percentage <= 75) return STATUS.yellow;
  if (percentage < 100) return STATUS.orange;
  return STATUS.red;
}
