import { useEffect, useState } from "react";
import {
  Camera,
  CarFront,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  Home,
  LogOut,
  ParkingCircle,
  PieChart,
  RefreshCw,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Users
} from "lucide-react";

import {
  getAdminLogs,
  getCurrentAdmin,
  getDashboard,
  getFacility,
  getReports,
  removeToken
} from "../api/client";
import MetricCard from "../components/MetricCard";
import TrendChart from "../components/TrendChart";

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
  }
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
    ["Operating Hours", "Open 24 Hours"],
    ["Total Slots", facility.total_slots],
    ["Parking Type", "Outdoor Parking"],
    ["Managed Since", "June 2026"]
  ];
}

function statusLabel(isOccupied) {
  return isOccupied ? "Occupied" : "Available";
}

export default function DashboardPage({ onLogout }) {
  const [dashboard, setDashboard] = useState(null);
  const [reports, setReports] = useState(null);
  const [facilityDetail, setFacilityDetail] = useState(null);
  const [allLogs, setAllLogs] = useState([]);
  const [adminProfile, setAdminProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState("dashboard");
  const [logFilters, setLogFilters] = useState({
    date: "",
    eventType: "all",
    slot: "all"
  });

  async function loadDashboard({ silent = false } = {}) {
    if (!silent) {
      setLoading(true);
    }
    setError("");
    try {
      const [dashboardData, reportData, adminData] = await Promise.all([
        getDashboard(),
        getReports(),
        getCurrentAdmin()
      ]);
      const [facilityData, logData] = await Promise.all([
        getFacility(dashboardData.facility.id),
        getAdminLogs()
      ]);

      setDashboard(dashboardData);
      setReports(reportData);
      setFacilityDetail(facilityData);
      setAllLogs(logData);
      setAdminProfile(adminData);
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

  const navItems = [
    [Home, "Dashboard", "dashboard"],
    [SlidersHorizontal, "Slot Overview", "slots"],
    [FileText, "Logs & Reports", "logs"],
    [Camera, "Camera Status", "cameras"],
    [Settings, "Facility Settings", "settings"],
    [Users, "Users", "users"]
  ];

  function handleViewChange(view) {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
            {onlineCameras === cameras.length
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
    return (
      <section className="access-banner">
        <span>
          <ShieldCheck size={30} />
        </span>
        <strong>Facility-restricted access:</strong>
        <p>You can only view and manage data for your assigned facility.</p>
      </section>
    );
  }

  function renderView() {
    if (activeView === "slots") {
      return (
        <section className="view-stack">
          {summaryMetrics}
          <article className="prototype-panel full-panel">
            <div className="panel-title-row">
              <h3>Slot Overview</h3>
              <span>{slots.length} monitored slots</span>
            </div>
            <div className="slot-grid">
              {slots.length ? (
                slots.map((slot) => (
                  <div className={`slot-card ${slot.is_occupied ? "occupied" : "available"}`} key={slot.slot_number}>
                    <div>
                      <strong>{slot.slot_number}</strong>
                      <span>{statusLabel(slot.is_occupied)}</span>
                    </div>
                    <small>Confidence {(Number(slot.confidence || 0) * 100).toFixed(0)}%</small>
                    <time>Last seen {formatDateTime(slot.last_seen_at)}</time>
                  </div>
                ))
              ) : (
                <p className="empty-text">No parking slots found for this facility.</p>
              )}
            </div>
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
                <strong>Restricted to {facility.name}</strong>
              </div>
              <div>
                <span>Realtime Source</span>
                <strong>YOLOv8 AI ingest endpoint</strong>
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
            <h3>Admin User</h3>
            <div className="user-card">
              <span className="admin-avatar large">M</span>
              <div>
                <strong>{adminProfile?.full_name || "Montero Parking Admin"}</strong>
                <p>{adminProfile?.email || "admin@parkfinder.local"}</p>
                <small>Facility ID: {adminProfile?.facility_id || facility.id}</small>
              </div>
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
          <article className="prototype-panel trend-panel">
            <h3>Occupancy Trend (Today)</h3>
            <TrendChart history={history} />
          </article>
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
            <p>Admin Panel</p>
          </div>

          <div className="facility-switcher">
            <span>Facility (You are managing):</span>
            <div className="facility-label">{facility.name}</div>
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
            <h2>{activeCopy.title} - {facility.name}</h2>
            <p>{activeCopy.subtitle}</p>
          </div>

          <span className="dashboard-badge">ADMIN DASHBOARD (WEB) - FACILITY RESTRICTED</span>

          <div className="admin-profile">
            <span className="admin-avatar">M</span>
            <strong>Admin Montero</strong>
            <ChevronDown size={16} />
          </div>

          <div className="last-updated">
            <div>
              <span>Last Updated:</span>
              <strong>{formatDateTime(latestSample)}</strong>
            </div>
            <button onClick={loadDashboard} disabled={loading} aria-label="Refresh dashboard">
              <RefreshCw size={28} />
            </button>
          </div>
        </header>

        {renderView()}
      </section>
    </main>
  );
}
