import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CarFront,
  CheckCircle2,
  Download,
  FileText,
  Home,
  LogOut,
  MapPin,
  ParkingCircle,
  PieChart,
  RefreshCw,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Users
} from "lucide-react";

import {
  approveParkingLotSubmission,
  getAdminFacilities,
  getAdminLogs,
  getAdminUsers,
  getCurrentAdmin,
  getDashboard,
  getFacility,
  getParkingLotSubmissions,
  getReports,
  rejectParkingLotSubmission,
  removeToken,
  submitParkingLot,
  setSlotStatus
} from "../api/client";
import MetricCard from "../components/MetricCard";

const VIEW_COPY = {
  dashboard: {
    title: "Dashboard",
    subtitle: "You are viewing data for your assigned facility only."
  },
  slots: {
    title: "Slot Overview",
    subtitle: "Monitor every parking slot status from the latest AI update."
  },
  logs: {
    title: "Logs & Reports",
    subtitle: "Review monitoring events and occupancy report summaries."
  },
  cameras: {
    title: "Camera Status",
    subtitle: "Check camera health for the assigned parking facility."
  },
  settings: {
    title: "Facility Settings",
    subtitle: "View the assigned facility profile used by ParkFinder."
  },
  users: {
    title: "Users",
    subtitle: "View admin access restricted to this facility."
  },
  "parking-lots": {
    title: "Parking Lot Requests",
    subtitle: "Facility owners can submit a lot and the super admin controls approval."
  }
};

const EMPTY_LOT_FORM = {
  name: "",
  address: "",
  latitude: "",
  longitude: "",
  total_slots: ""
};

const EVENT_TYPE_OPTIONS = [
  ["all", "All Events"],
  ["ai_update", "AI Updates"],
  ["vehicle_entry", "Vehicle Entry"],
  ["vehicle_exit", "Vehicle Exit"],
  ["camera_status", "Camera Status"],
  ["system", "System"],
  ["error", "Errors"]
];

function eventTypeLabel(value) {
  const option = EVENT_TYPE_OPTIONS.find(([key]) => key === value);
  return option?.[1] || value;
}

function getLogEventType(log) {
  const detailsType = log.details?.event_type;
  if (detailsType) {
    return detailsType;
  }

  const text = `${log.level || ""} ${log.message || ""}`.toLowerCase();
  if (log.level === "error" || text.includes("error") || text.includes("failed")) {
    return "error";
  }
  if (text.includes("entry") || text.includes("entered")) {
    return "vehicle_entry";
  }
  if (text.includes("exit") || text.includes("left") || text.includes("available")) {
    return "vehicle_exit";
  }
  if (text.includes("camera") || text.includes("cctv") || text.includes("stream")) {
    return "camera_status";
  }
  if (text.includes("ai") || text.includes("slot data") || text.includes("processor")) {
    return "ai_update";
  }
  return "system";
}

function getLogSlotNumber(log) {
  if (log.details?.slot_number) {
    return String(log.details.slot_number);
  }
  const match = (log.message || "").match(/\b([A-Z]\d+)\b/i);
  return match ? match[1].toUpperCase() : "";
}

function toDateInputValue(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeCsvValue(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatDateTime(value) {
  if (!value) {
    return "No updates yet";
  }
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatTime(value) {
  if (!value) {
    return "Now";
  }
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

function facilityRows(facility) {
  return [
    ["Facility Name", facility.name],
    ["Facility ID", facility.facility_code],
    ["Address", facility.address],
    ["Data Status", "Demo facility"],
    ["Total Slots", facility.total_slots],
    ["Parking Type", "Not specified"]
  ];
}

function statusLabel(isOccupied) {
  return isOccupied ? "Occupied" : "Available";
}

export default function DashboardPage({ onLogout }) {
  const [dashboard, setDashboard] = useState(null);
  const [reports, setReports] = useState(null);
  const [facilityDetail, setFacilityDetail] = useState(null);
  const [facilities, setFacilities] = useState([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState(null);
  const [allLogs, setAllLogs] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminProfile, setAdminProfile] = useState(null);
  const [lotSubmissions, setLotSubmissions] = useState([]);
  const [lotForm, setLotForm] = useState(EMPTY_LOT_FORM);
  const [lotMessage, setLotMessage] = useState(null);
  const [lotAction, setLotAction] = useState("");
  const [slotAction, setSlotAction] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState("dashboard");
  const [logFilters, setLogFilters] = useState({
    date: "",
    eventType: "all",
    slot: "all"
  });
  const selectedFacilityIdRef = useRef(null);

  async function loadDashboard({ silent = false, facilityId = selectedFacilityIdRef.current } = {}) {
    if (!silent) {
      setLoading(true);
    }
    setError("");
    try {
      const [adminData, facilityOptions] = await Promise.all([
        getCurrentAdmin(),
        getAdminFacilities()
      ]);

      const isSuperAdmin = adminData.is_super_admin || adminData.role === "super_admin";
      const requestedFacilityId = Number(facilityId);
      const requestedFacilityIsVisible = facilityOptions.some(
        (facilityOption) => facilityOption.id === requestedFacilityId
      );
      const targetFacilityId = requestedFacilityIsVisible
        ? requestedFacilityId
        : adminData.facility_id ?? facilityOptions[0]?.id;
      if (!targetFacilityId) {
        throw new Error("No parking facilities are available for this account.");
      }

      const [dashboardData, reportData, facilityData, logData, userData, submissionData] = await Promise.all([
        getDashboard(targetFacilityId),
        getReports(targetFacilityId),
        getFacility(targetFacilityId),
        getAdminLogs(targetFacilityId),
        isSuperAdmin ? getAdminUsers() : Promise.resolve([adminData]),
        getParkingLotSubmissions()
      ]);

      setDashboard(dashboardData);
      setReports(reportData);
      setFacilityDetail(facilityData);
      setFacilities(facilityOptions);
      selectedFacilityIdRef.current = targetFacilityId;
      setSelectedFacilityId(targetFacilityId);
      setAllLogs(logData);
      setAdminUsers(userData);
      setAdminProfile(adminData);
      setLotSubmissions(submissionData);
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        removeToken();
        onLogout();
        return;
      }
      setError(err.message || "Unable to load dashboard data.");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(() => {
      loadDashboard({ silent: true });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  if (loading && !dashboard) {
    return <main className="state-page">Loading dashboard...</main>;
  }

  if (error && !dashboard) {
    return (
      <main className="state-page">
        <section className="state-card">
          <strong>Unable to load dashboard data</strong>
          <p>{error}</p>
          <div className="state-actions">
            <button className="secondary-button" onClick={loadDashboard}>
              <RefreshCw size={17} />
              Try Again
            </button>
            <button className="secondary-button" onClick={onLogout}>
              <LogOut size={17} />
              Back to Login
            </button>
          </div>
        </section>
      </main>
    );
  }

  const facility = facilityDetail || dashboard.facility;
  const isSuperAdmin = Boolean(
    adminProfile?.is_super_admin || adminProfile?.role === "super_admin"
  );
  const canSwitchFacilities = facilities.length > 1;
  const adminInitial = (adminProfile?.full_name || "Admin").trim().charAt(0).toUpperCase();
  const cameras = facilityDetail?.cameras || dashboard.cameras || [];
  const slots = [...(facilityDetail?.slots || [])].sort((a, b) =>
    a.slot_number.localeCompare(b.slot_number, undefined, { numeric: true })
  );
  const history = dashboard.history || [];
  const logs = allLogs.length ? allLogs : dashboard.logs || [];
  const recentLogs = logs.slice(0, 5);
  const slotOptions = slots.map((slot) => slot.slot_number);
  const filteredLogs = logs.filter((log) => {
    const logDate = toDateInputValue(log.created_at);
    const eventType = getLogEventType(log);
    const slotNumber = getLogSlotNumber(log);

    return (
      (!logFilters.date || logDate === logFilters.date) &&
      (logFilters.eventType === "all" || eventType === logFilters.eventType) &&
      (logFilters.slot === "all" || slotNumber === logFilters.slot)
    );
  });
  const occupancy = Number(facility.occupancy_percentage || 0);
  const availability = facility.total_slots
    ? Number(((facility.available_slots / facility.total_slots) * 100).toFixed(1))
    : 0;
  const latestSample = facility.updated_at || history[0]?.captured_at;
  const onlineCameras = cameras.filter((camera) => camera.status === "online").length;
  const activeCopy = VIEW_COPY[activeView] || VIEW_COPY.dashboard;

  const allNavItems = [
    [Home, "Dashboard", "dashboard"],
    [SlidersHorizontal, "Slot Overview", "slots"],
    [FileText, "Logs & Reports", "logs"],
    [Camera, "Camera Status", "cameras"],
    [MapPin, "Parking Lots", "parking-lots"],
    [Settings, "Facility Settings", "settings"],
    [Users, "Users", "users"]
  ];
  const navItems = isSuperAdmin
    ? allNavItems.filter(([, , view]) => !["logs", "cameras"].includes(view))
    : allNavItems;

  function handleViewChange(view) {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleFacilityChange(event) {
    const facilityId = Number(event.target.value);
    if (facilityId && facilityId !== selectedFacilityIdRef.current) {
      loadDashboard({ facilityId });
    }
  }

  function updateLotForm(field, value) {
    setLotForm((current) => ({ ...current, [field]: value }));
  }

  function lotErrorMessage(err) {
    try {
      return JSON.parse(err.message).detail || err.message;
    } catch {
      return err.message || "Unable to process the parking lot request.";
    }
  }

  async function handleLotSubmit(event) {
    event.preventDefault();
    setLotAction("submit");
    setLotMessage(null);
    try {
      const submission = await submitParkingLot({
        name: lotForm.name.trim(),
        address: lotForm.address.trim(),
        latitude: Number(lotForm.latitude),
        longitude: Number(lotForm.longitude),
        total_slots: Number(lotForm.total_slots)
      });
      setLotSubmissions((current) => [submission, ...current]);
      setLotForm(EMPTY_LOT_FORM);
      setLotMessage({ type: "success", text: "Parking lot sent to the super admin for approval." });
    } catch (err) {
      setLotMessage({ type: "error", text: lotErrorMessage(err) });
    } finally {
      setLotAction("");
    }
  }

  async function handleSlotStatus(direction) {
    setSlotAction(true);
    setError("");
    try {
      await setSlotStatus(selectedFacilityId, direction);
      await loadDashboard({ silent: true });
    } catch (err) {
      setError(err.message || "Unable to update slot status.");
    } finally {
      setSlotAction("");
    }
  }

  async function handleLotReview(submissionId, decision) {
    setLotAction(`${decision}-${submissionId}`);
    setLotMessage(null);
    try {
      const updated = decision === "approve"
        ? await approveParkingLotSubmission(submissionId)
        : await rejectParkingLotSubmission(submissionId);
      setLotSubmissions((current) =>
        current.map((submission) => submission.id === updated.id ? updated : submission)
      );
      setLotMessage({
        type: "success",
        text: decision === "approve"
          ? `${updated.name} is approved and assigned to ${updated.submitter_name}.`
          : `${updated.name} was rejected.`
      });
      if (decision === "approve") {
        await loadDashboard({ silent: true });
      }
    } catch (err) {
      setLotMessage({ type: "error", text: lotErrorMessage(err) });
    } finally {
      setLotAction("");
    }
  }

  function updateLogFilter(key, value) {
    setLogFilters((current) => ({ ...current, [key]: value }));
  }

  function resetLogFilters() {
    setLogFilters({
      date: "",
      eventType: "all",
      slot: "all"
    });
  }

  function logExportRows() {
    return filteredLogs.map((log) => ({
      createdAt: formatDateTime(log.created_at),
      eventType: eventTypeLabel(getLogEventType(log)),
      slot: getLogSlotNumber(log) || "All slots",
      level: log.level || "info",
      message: log.message,
      details: log.details ? JSON.stringify(log.details) : ""
    }));
  }

  function exportLogsCsv() {
    const rows = logExportRows();
    const headers = ["Created At", "Event Type", "Slot", "Level", "Message", "Details"];
    const csv = [
      headers.map(escapeCsvValue).join(","),
      ...rows.map((row) =>
        [
          row.createdAt,
          row.eventType,
          row.slot,
          row.level,
          row.message,
          row.details
        ].map(escapeCsvValue).join(",")
      )
    ].join("\n");

    downloadBlob(
      `parkfinder-logs-${toDateInputValue(new Date().toISOString())}.csv`,
      csv,
      "text/csv;charset=utf-8"
    );
  }

  async function exportLogsPdf() {
    const { jsPDF } = await import("jspdf");
    const rows = logExportRows();
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 36;
    let y = 42;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("ParkFinder Logs & Reports", margin, y);
    y += 18;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`${facility.name} | ${filteredLogs.length} filtered logs | Exported ${formatDateTime(new Date().toISOString())}`, margin, y);
    y += 24;

    const columns = [
      ["Time", 112],
      ["Event", 88],
      ["Slot", 58],
      ["Level", 54],
      ["Message", pageWidth - margin * 2 - 312]
    ];

    function drawHeader() {
      doc.setFillColor(232, 245, 234);
      doc.rect(margin, y - 12, pageWidth - margin * 2, 24, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      let x = margin + 6;
      columns.forEach(([label, width]) => {
        doc.text(label, x, y + 3);
        x += width;
      });
      y += 22;
      doc.setFont("helvetica", "normal");
    }

    drawHeader();

    rows.forEach((row) => {
      const values = [row.createdAt, row.eventType, row.slot, row.level, row.message];
      const wrapped = values.map((value, index) => doc.splitTextToSize(String(value || ""), columns[index][1] - 10));
      const rowHeight = Math.max(24, ...wrapped.map((lines) => lines.length * 11 + 10));

      if (y + rowHeight > pageHeight - margin) {
        doc.addPage();
        y = 42;
        drawHeader();
      }

      doc.setDrawColor(226, 235, 228);
      doc.line(margin, y - 10, pageWidth - margin, y - 10);
      let x = margin + 6;
      wrapped.forEach((lines, index) => {
        doc.text(lines, x, y);
        x += columns[index][1];
      });
      y += rowHeight;
    });

    if (!rows.length) {
      doc.text("No logs matched the selected filters.", margin + 6, y);
    }

    doc.save(`parkfinder-logs-${toDateInputValue(new Date().toISOString())}.pdf`);
  }

  const summaryMetrics = (
    <section className="prototype-metrics">
      <MetricCard
        label="Total Slots"
        value={facility.total_slots}
        helper="All slots in this facility"
        icon={ParkingCircle}
      />
      <MetricCard
        label="Available Slots"
        value={facility.available_slots}
        helper={`${availability}% Available`}
        tone="success"
        icon={CheckCircle2}
      />
      <MetricCard
        label="Occupied Slots"
        value={facility.occupied_slots}
        helper={`${occupancy}% Occupied`}
        tone="danger"
        icon={CarFront}
      />
      <MetricCard
        label="Occupancy Percentage"
        value={`${facility.occupancy_percentage}%`}
        helper="Current occupancy rate"
        icon={PieChart}
      />
    </section>
  );

  function facilityInfoPanel() {
    return (
      <article className="prototype-panel facility-info-panel">
        <h3>Facility Information</h3>
        <div className="facility-info-list">
          {facilityRows(facility).map(([label, value]) => (
            <div className="facility-info-row" key={label}>
              <span>{label}</span>
              <strong className={label === "Facility ID" || label === "Operating Hours" ? "green-text" : ""}>
                {value}
              </strong>
            </div>
          ))}
        </div>
      </article>
    );
  }

  function cameraStatusPanel({ full = false } = {}) {
    return (
      <article className={`prototype-panel camera-panel ${full ? "full-panel" : ""}`}>
        <h3>Camera Status</h3>
        <div className={full ? "camera-card-grid" : "prototype-camera-list"}>
          {cameras.length ? (
            cameras.map((camera, index) => (
              <div className={full ? "camera-detail-card" : "prototype-camera-item"} key={camera.id}>
                <span className={camera.status === "online" ? "camera-dot online-dot" : "camera-dot offline-dot"} />
                <strong>{camera.name || `Camera ${index + 1}`}</strong>
                <b className={camera.status === "online" ? "green-text" : "red-text"}>{camera.status}</b>
                {full ? (
                  <>
                    <small>{camera.source_url}</small>
                    <time>Last heartbeat: {formatDateTime(camera.last_heartbeat_at)}</time>
                  </>
                ) : null}
              </div>
            ))
          ) : (
            <p className="empty-text">No cameras registered for this facility.</p>
          )}
        </div>
        <div className="camera-health">
          <ShieldCheck size={20} />
          <strong>
            {!cameras.length
              ? "No cameras configured yet"
              : onlineCameras === cameras.length
              ? "All cameras are functioning properly"
              : `${onlineCameras}/${cameras.length} cameras online`}
          </strong>
        </div>
      </article>
    );
  }

  function logsPanel({ full = false } = {}) {
    const visibleLogs = full ? filteredLogs : recentLogs;
    return (
      <article className={`prototype-panel recent-logs-panel ${full ? "full-panel" : ""}`}>
        <div className="panel-title-row">
          <h3>{full ? "Logs & Reports" : "Recent Activity Logs"}</h3>
          {!full ? <button onClick={() => handleViewChange("logs")}>View All</button> : null}
        </div>
        {full ? (
          <div className="log-filter-bar">
            <label>
              <span>Date</span>
              <input
                type="date"
                value={logFilters.date}
                onChange={(event) => updateLogFilter("date", event.target.value)}
              />
            </label>
            <label>
              <span>Event Type</span>
              <select
                value={logFilters.eventType}
                onChange={(event) => updateLogFilter("eventType", event.target.value)}
              >
                {EVENT_TYPE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Slot</span>
              <select
                value={logFilters.slot}
                onChange={(event) => updateLogFilter("slot", event.target.value)}
              >
                <option value="all">All Slots</option>
                {slotOptions.map((slotNumber) => (
                  <option key={slotNumber} value={slotNumber}>
                    {slotNumber}
                  </option>
                ))}
              </select>
            </label>
            <div className="log-filter-actions">
              <button type="button" onClick={resetLogFilters}>Reset</button>
              <button type="button" onClick={exportLogsCsv} disabled={!filteredLogs.length}>
                <Download size={16} />
                Download CSV
              </button>
              <button type="button" onClick={exportLogsPdf} disabled={!filteredLogs.length}>
                <FileText size={16} />
                Download PDF
              </button>
            </div>
          </div>
        ) : null}
        {full ? (
          <div className="report-strip">
            <div>
              <span>Average Occupancy</span>
              <strong>{reports?.average_occupancy_percentage ?? 0}%</strong>
            </div>
            <div>
              <span>Peak Occupancy</span>
              <strong>{reports?.peak_occupancy_percentage ?? 0}%</strong>
            </div>
            <div>
              <span>Report Samples</span>
              <strong>{reports?.sample_count ?? 0}</strong>
            </div>
            <div>
              <span>Filtered Logs</span>
              <strong>{filteredLogs.length}</strong>
            </div>
          </div>
        ) : null}
        <div className={full ? "full-log-list" : "prototype-log-list"}>
          {visibleLogs.length ? (
            visibleLogs.map((log) => (
              <div className="prototype-log-item" key={log.id}>
                <time>{formatTime(log.created_at)}</time>
                <div className="log-message">
                  <span>{log.message}</span>
                  <small>
                    {eventTypeLabel(getLogEventType(log))}
                    {" | "}
                    {getLogSlotNumber(log) ? `Slot ${getLogSlotNumber(log)}` : "All slots"}
                  </small>
                </div>
                <b className={log.level === "error" ? "log-badge error" : "log-badge"}>
                  {log.level === "error" ? "Error" : "Success"}
                </b>
              </div>
            ))
          ) : (
            <p className="empty-text">No monitoring logs yet.</p>
          )}
        </div>
      </article>
    );
  }

  function accessBanner() {
    const accessTitle = isSuperAdmin
      ? "Super-admin access:"
      : canSwitchFacilities
        ? "Multi-facility access:"
        : "Facility-restricted access:";
    const accessDescription = isSuperAdmin
      ? "You can review every facility and administrator from this web dashboard."
      : canSwitchFacilities
        ? `You can review ${facilities.length} assigned parking facilities from this web dashboard.`
        : "You can only view and manage data for your assigned facility.";

    return (
      <section className="access-banner">
        <span>
          <ShieldCheck size={30} />
        </span>
        <strong>{accessTitle}</strong>
        <p>{accessDescription}</p>
      </section>
    );
  }

  function renderView() {
    if (activeView === "parking-lots") {
      const pendingCount = lotSubmissions.filter((submission) => submission.status === "pending").length;
      return (
        <section className={`lot-management-grid ${isSuperAdmin ? "single" : ""}`}>
          {!isSuperAdmin ? (
            <article className="prototype-panel full-panel lot-form-panel">
              <h3>Add a Parking Lot</h3>
              <p className="panel-intro">
                Enter the map coordinates and seeded slot capacity. The lot becomes public only after super-admin approval.
              </p>
              <form className="lot-form" onSubmit={handleLotSubmit}>
                <label>
                  <span>Parking lot name</span>
                  <input
                    value={lotForm.name}
                    onChange={(event) => updateLotForm("name", event.target.value)}
                    minLength={3}
                    maxLength={160}
                    required
                  />
                </label>
                <label>
                  <span>Full address or Plus Code</span>
                  <input
                    value={lotForm.address}
                    onChange={(event) => updateLotForm("address", event.target.value)}
                    minLength={5}
                    maxLength={255}
                    required
                  />
                </label>
                <div className="lot-coordinate-grid">
                  <label>
                    <span>Latitude</span>
                    <input
                      type="number"
                      step="any"
                      min="-90"
                      max="90"
                      value={lotForm.latitude}
                      onChange={(event) => updateLotForm("latitude", event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    <span>Longitude</span>
                    <input
                      type="number"
                      step="any"
                      min="-180"
                      max="180"
                      value={lotForm.longitude}
                      onChange={(event) => updateLotForm("longitude", event.target.value)}
                      required
                    />
                  </label>
                </div>
                <label>
                  <span>Seeded slot count</span>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={lotForm.total_slots}
                    onChange={(event) => updateLotForm("total_slots", event.target.value)}
                    required
                  />
                </label>
                <button className="primary-button" type="submit" disabled={lotAction === "submit"}>
                  {lotAction === "submit" ? "Submitting..." : "Submit for approval"}
                </button>
              </form>
            </article>
          ) : null}

          <article className="prototype-panel full-panel submission-panel">
            <div className="panel-title-row">
              <h3>{isSuperAdmin ? "Owner Submissions" : "My Submissions"}</h3>
              <span>{pendingCount} pending</span>
            </div>
            {lotMessage ? (
              <p className={`lot-message ${lotMessage.type}`}>{lotMessage.text}</p>
            ) : null}
            <div className="submission-list">
              {lotSubmissions.length ? lotSubmissions.map((submission) => (
                <article className="submission-card" key={submission.id}>
                  <div className="submission-card-header">
                    <div>
                      <strong>{submission.name}</strong>
                      <p>{submission.address}</p>
                    </div>
                    <span className={`submission-status ${submission.status}`}>
                      {submission.status}
                    </span>
                  </div>
                  <div className="submission-meta">
                    <span><b>Owner:</b> {submission.submitter_name}</span>
                    <span><b>Slots:</b> {submission.total_slots}</span>
                    <span><b>Submitted:</b> {formatDateTime(submission.submitted_at)}</span>
                    {submission.facility_id ? <span><b>Facility ID:</b> {submission.facility_id}</span> : null}
                  </div>
                  <a
                    className="map-link"
                    href={`https://www.google.com/maps/search/?api=1&query=${submission.latitude},${submission.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MapPin size={16} />
                    Check coordinates on map
                  </a>
                  {isSuperAdmin && submission.status === "pending" ? (
                    <div className="submission-actions">
                      <button
                        className="primary-button"
                        type="button"
                        onClick={() => handleLotReview(submission.id, "approve")}
                        disabled={Boolean(lotAction)}
                      >
                        {lotAction === `approve-${submission.id}` ? "Approving..." : "Approve"}
                      </button>
                      <button
                        className="danger-button"
                        type="button"
                        onClick={() => handleLotReview(submission.id, "reject")}
                        disabled={Boolean(lotAction)}
                      >
                        {lotAction === `reject-${submission.id}` ? "Rejecting..." : "Reject"}
                      </button>
                    </div>
                  ) : null}
                </article>
              )) : (
                <p className="empty-text">
                  {isSuperAdmin ? "No parking lot requests have been submitted." : "You have not submitted a parking lot yet."}
                </p>
              )}
            </div>
          </article>
        </section>
      );
    }

    if (activeView === "slots") {
      return (
        <section className="view-stack">
          {summaryMetrics}
          <article className="prototype-panel full-panel">
            <div className="panel-title-row">
              <h3>Parking Slot Count</h3>
              <span>Manual vehicle count for {facility.name}</span>
            </div>
            <p>Available: <strong>{facility.available_slots}</strong> · Occupied: <strong>{facility.occupied_slots}</strong> · Total: <strong>{facility.total_slots}</strong></p>
            {!isSuperAdmin && <>
              {error && <p className="error-text">{error}</p>}
              <div className="slot-actions">
                <button disabled={slotAction || facility.available_slots <= 0} onClick={() => handleSlotStatus("in")}>In</button>
                <button disabled={slotAction || facility.occupied_slots <= 0} onClick={() => handleSlotStatus("out")}>Out</button>
              </div>
            </>}
          </article>
        </section>
      );
    }

    if (activeView === "logs") {
      return (
        <section className="view-stack">
          {logsPanel({ full: true })}
        </section>
      );
    }

    if (activeView === "cameras") {
      return (
        <section className="view-stack">
          {cameraStatusPanel({ full: true })}
        </section>
      );
    }

    if (activeView === "settings") {
      return (
        <section className="settings-grid">
          {facilityInfoPanel()}
          <article className="prototype-panel full-panel">
            <h3>Facility Settings</h3>
            <div className="settings-list">
              <div>
                <span>Data Access</span>
                <strong>
                  {isSuperAdmin
                    ? "All ParkFinder facilities"
                    : canSwitchFacilities
                      ? `${facilities.length} assigned facilities`
                      : `Restricted to ${facility.name}`}
                </strong>
              </div>
              <div>
                <span>Demo Updates</span>
                <strong>Seeded data or simulated AI ingest</strong>
              </div>
              <div>
                <span>Database</span>
                <strong>PostgreSQL current slot status and history</strong>
              </div>
              <div>
                <span>Coordinates</span>
                <strong>{facility.latitude}, {facility.longitude}</strong>
              </div>
            </div>
          </article>
          {accessBanner()}
        </section>
      );
    }

    if (activeView === "users") {
      return (
        <section className="settings-grid">
          <article className="prototype-panel user-panel">
            <h3>{isSuperAdmin ? "Administrator Accounts" : "Admin User"}</h3>
            <div className="user-list">
              {adminUsers.map((user) => {
                const userIsSuperAdmin = user.is_super_admin || user.role === "super_admin";
                const userFacilityIds = user.facility_ids?.length
                  ? user.facility_ids
                  : user.facility_id
                    ? [user.facility_id]
                    : [];
                const assignedFacilityNames = facilities
                  .filter((facilityOption) => userFacilityIds.includes(facilityOption.id))
                  .map((facilityOption) => facilityOption.name);
                return (
                  <div className="user-card" key={user.id}>
                    <span className="admin-avatar large">
                      {user.full_name.trim().charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <div className="user-name-row">
                        <strong>{user.full_name}</strong>
                        <span className={`role-badge ${userIsSuperAdmin ? "super-admin" : ""}`}>
                          {userIsSuperAdmin ? "Super Admin" : "Facility Admin"}
                        </span>
                      </div>
                      <p>{user.email}</p>
                      <small>
                        {userIsSuperAdmin
                          ? "Access to all facilities"
                          : assignedFacilityNames.length
                            ? assignedFacilityNames.join(", ")
                            : `${userFacilityIds.length} assigned facilities`}
                      </small>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
          {accessBanner()}
        </section>
      );
    }

    return (
      <>
        {summaryMetrics}
        <section className="prototype-grid">
          {facilityInfoPanel()}
          {cameraStatusPanel()}
          {logsPanel()}
        </section>
        {accessBanner()}
      </>
    );
  }

  return (
    <main className="admin-layout">
      <aside className="admin-sidebar">
        <div>
          <div className="sidebar-brand">
            <h1>
              Park<span>Finder</span>
            </h1>
            <p>{isSuperAdmin ? "Super Admin Panel" : "Admin Panel"}</p>
          </div>

          <div className="facility-switcher">
            <span>{canSwitchFacilities ? "Select facility:" : "Facility (You are managing):"}</span>
            {canSwitchFacilities ? (
              <select
                className="facility-select"
                value={selectedFacilityId || ""}
                onChange={handleFacilityChange}
                aria-label="Select a facility to manage"
                disabled={loading}
              >
                {facilities.map((facilityOption) => (
                  <option key={facilityOption.id} value={facilityOption.id}>
                    {facilityOption.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="facility-label">{facility.name}</div>
            )}
          </div>

          <nav className="sidebar-nav" aria-label="Admin navigation">
            {navItems.map(([Icon, label, view]) => (
              <button
                className={activeView === view ? "active" : ""}
                key={label}
                onClick={() => handleViewChange(view)}
              >
                <Icon size={23} />
                {label}
              </button>
            ))}
          </nav>
        </div>

        <button className="sidebar-logout" onClick={onLogout}>
          <LogOut size={23} />
          Logout
        </button>
      </aside>

      <section className="admin-main">
        <header className="admin-header">
          <div className="admin-title">
            <h2>
              {activeCopy.title}
              {activeView === "parking-lots" ? "" : ` - ${facility.name}`}
            </h2>
            <p>{activeCopy.subtitle}</p>
          </div>

          <span className="dashboard-badge">
            {isSuperAdmin
              ? "SUPER ADMIN DASHBOARD (WEB) - ALL DEMO FACILITIES"
              : canSwitchFacilities
                ? `ADMIN DASHBOARD (WEB) - ${facilities.length} DEMO FACILITIES`
                : "ADMIN DASHBOARD (WEB) - DEMO FACILITY"}
          </span>

          <div className="admin-profile">
            <span className="admin-avatar">{adminInitial}</span>
            <div>
              <strong>{adminProfile?.full_name}</strong>
              <small>
                {isSuperAdmin
                  ? "Super Admin"
                  : canSwitchFacilities
                    ? `${facilities.length}-Facility Admin`
                    : "Facility Admin"}
              </small>
            </div>
          </div>

          <div className="last-updated">
            <div>
              <span>Last Updated:</span>
              <strong>{formatDateTime(latestSample)}</strong>
            </div>
            <button onClick={() => loadDashboard()} disabled={loading} aria-label="Refresh dashboard">
              <RefreshCw size={28} />
            </button>
          </div>
        </header>

        {renderView()}
      </section>
    </main>
  );
}
