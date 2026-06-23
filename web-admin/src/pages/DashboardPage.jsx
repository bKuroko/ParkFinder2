import { useEffect, useState } from "react";
import { Camera, LogOut, RefreshCw } from "lucide-react";

import { getDashboard, getReports } from "../api/client";
import MetricCard from "../components/MetricCard";
import TrendChart from "../components/TrendChart";

export default function DashboardPage({ onLogout }) {
  const [dashboard, setDashboard] = useState(null);
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setError("");
    try {
      const [dashboardData, reportData] = await Promise.all([getDashboard(), getReports()]);
      setDashboard(dashboardData);
      setReports(reportData);
    } catch (err) {
      setError("Unable to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading && !dashboard) {
    return <main className="state-page">Loading dashboard...</main>;
  }

  if (error && !dashboard) {
    return <main className="state-page">{error}</main>;
  }

  const facility = dashboard.facility;

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Facility-restricted access</p>
          <h1>{facility.name}</h1>
          <p>{facility.address}</p>
        </div>
        <div className="topbar-actions">
          <button className="secondary-button" onClick={loadDashboard}>
            <RefreshCw size={17} />
            Refresh
          </button>
          <button className="secondary-button" onClick={onLogout}>
            <LogOut size={17} />
            Logout
          </button>
        </div>
      </header>

      <section className="metrics-grid">
        <MetricCard label="Facility ID" value={facility.facility_code} />
        <MetricCard label="Total Slots" value={facility.total_slots} />
        <MetricCard label="Available Slots" value={facility.available_slots} tone="success" />
        <MetricCard label="Occupied Slots" value={facility.occupied_slots} tone="danger" />
        <MetricCard label="Occupancy" value={`${facility.occupancy_percentage}%`} />
        <MetricCard
          label="Average Occupancy"
          value={`${reports?.average_occupancy_percentage ?? 0}%`}
          helper={`${reports?.sample_count ?? 0} report samples`}
        />
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-header">
            <h2>Occupancy Trend</h2>
            <span>Last 24 samples</span>
          </div>
          <TrendChart history={dashboard.history} />
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Camera Status</h2>
            <Camera size={20} />
          </div>
          <div className="camera-list">
            {dashboard.cameras.map((camera) => (
              <div className="camera-item" key={camera.id}>
                <div>
                  <strong>{camera.name}</strong>
                  <span>{camera.source_url}</span>
                </div>
                <b className={camera.status === "online" ? "online" : "offline"}>{camera.status}</b>
              </div>
            ))}
          </div>
        </article>

        <article className="panel span-2">
          <div className="panel-header">
            <h2>Logs and Reports</h2>
            <span>Latest monitoring events</span>
          </div>
          <div className="log-list">
            {dashboard.logs.map((log) => (
              <div className="log-item" key={log.id}>
                <span className={`log-level ${log.level}`}>{log.level}</span>
                <p>{log.message}</p>
                <time>{new Date(log.created_at).toLocaleString()}</time>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
