import { useState } from "react";
import {
  approveParkingLotSubmission, rejectParkingLotSubmission, submitParkingLot,
  updateParkingLot, deleteParkingLot,
  updateParkingLotRequest, deleteParkingLotRequest
} from "../api/client";

const EMPTY = { name: "", address: "", latitude: "", longitude: "", total_slots: "" };

function messageFor(error) {
  try {
    const detail = JSON.parse(error.message).detail;
    return Array.isArray(detail) ? detail.map((item) => item.msg || "Invalid form value").join(". ") : detail || error.message;
  }
  catch { return error.message || "Unable to update the parking lot."; }
}

export default function ParkingLotManager({ facilities, submissions, users, isSuperAdmin, onReload }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [action, setAction] = useState("");
  const [message, setMessage] = useState(null);
  const capacityLocked = editing?.kind === "facility" && editing.slot_count > 0;

  function beginEdit(kind, lot) {
    setEditing({ kind, id: lot.id, slot_count: lot.slot_count || 0 });
    setForm({ ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((key) => [key, lot[key] ?? ""])) });
    setMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() { setEditing(null); setForm(EMPTY); }
  function change(key, value) { setForm((current) => ({ ...current, [key]: value })); }

  async function perform(key, operation, success, resetForm = false) {
    setAction(key);
    setMessage(null);
    try {
      await operation();
      if (resetForm) reset();
      await onReload();
      setMessage({ type: "success", text: success });
    } catch (error) {
      setMessage({ type: "error", text: messageFor(error) });
    } finally { setAction(""); }
  }

  function save(event) {
    event.preventDefault();
    const payload = { name: form.name.trim(), address: form.address.trim(),
      latitude: Number(form.latitude), longitude: Number(form.longitude), total_slots: Number(form.total_slots) };
    if (capacityLocked) delete payload.total_slots;
    perform("save", () => editing?.kind === "facility" ? updateParkingLot(editing.id, payload)
      : editing?.kind === "request" ? updateParkingLotRequest(editing.id, payload)
      : submitParkingLot(payload),
    editing?.kind === "facility" ? "Parking lot updated." : "Request submitted for approval.", true);
  }

  function remove(kind, lot) {
    const text = kind === "facility"
      ? `Delete parking lot "${lot.name}"? It will be removed from driver listings and stop receiving parking updates. Monitoring history will be retained.`
      : `Delete the parking lot request "${lot.name}"?`;
    if (!window.confirm(text)) return;
    perform(`delete-${kind}-${lot.id}`, () => kind === "facility" ? deleteParkingLot(lot.id) : deleteParkingLotRequest(lot.id),
      kind === "facility" ? "Parking lot deleted. Monitoring history retained." : "Request deleted.", editing?.id === lot.id && editing?.kind === kind);
  }

  return (
    <section className="view-stack lot-management">
      {message ? <p role="status" className={`lot-message ${message.type}`}>{message.text}</p> : null}
      {!isSuperAdmin ? <article className="prototype-panel full-panel lot-form-panel">
        <h3>{editing ? `Edit ${editing.kind === "facility" ? "Parking Lot" : "Parking Lot Request"}` : "Add a Parking Lot"}</h3>
        <p className="panel-intro">{editing?.kind === "facility" ? "Update this lot's details." : "New and edited requests require super-admin approval before appearing to drivers."}</p>
        <form className="lot-form" onSubmit={save}>
          <fieldset disabled={Boolean(action)} className="lot-form-fields">
            <label>Parking lot name<input value={form.name} onChange={(event) => change("name", event.target.value)} minLength={3} maxLength={160} required /></label>
            <label>Full address or Plus Code<input value={form.address} onChange={(event) => change("address", event.target.value)} minLength={5} maxLength={255} required /></label>
            <div className="lot-coordinate-grid">
              <label>Latitude<input type="number" step="any" min="-90" max="90" value={form.latitude} onChange={(event) => change("latitude", event.target.value)} required /></label>
              <label>Longitude<input type="number" step="any" min="-180" max="180" value={form.longitude} onChange={(event) => change("longitude", event.target.value)} required /></label>
            </div>
            <label>Slot capacity<input type="number" min="1" max="10000" value={form.total_slots} onChange={(event) => change("total_slots", event.target.value)} readOnly={capacityLocked} required /></label>
            {capacityLocked ? <p className="empty-text">Capacity follows the configured parking slots. Slot configuration must be adjusted separately.</p> : null}
            <div className="submission-actions">
              <button className="primary-button" type="submit">{action === "save" ? "Saving..." : editing?.kind === "facility" ? "Save changes" : "Submit for approval"}</button>
              {editing ? <button className="secondary-button" type="button" onClick={reset}>Cancel edit</button> : null}
            </div>
          </fieldset>
        </form>
      </article> : null}

      <article className="prototype-panel full-panel">
        <div className="panel-title-row"><h3>{isSuperAdmin ? "All Parking Lots" : "My Parking Lots"}</h3><span>{facilities.length} active</span></div>
        <div className="submission-list">
          {facilities.map((lot) => <article className="submission-card" key={lot.id}>
            <div className="submission-card-header"><div><strong>{lot.name}</strong><p>{lot.address}</p></div><span className="submission-status approved">Active</span></div>
            <div className="submission-meta"><span>{lot.facility_code}</span><span>{lot.total_slots} slots</span><span>{lot.latitude}, {lot.longitude}</span></div>
            {isSuperAdmin ? <p className="empty-text">Owners: {users.filter((user) => user.facility_ids?.includes(lot.id) || user.facility_id === lot.id).map((user) => user.full_name).join(", ") || "No owner assigned"}</p> : null}
            {!isSuperAdmin ? <div className="submission-actions">
              <button type="button" className="secondary-button" disabled={Boolean(action)} onClick={() => beginEdit("facility", lot)}>Edit</button>
              <button type="button" className="danger-button" disabled={Boolean(action)} onClick={() => remove("facility", lot)}>Delete</button>
            </div> : null}
          </article>)}
          {!facilities.length ? <p className="empty-text">No active parking lots. {isSuperAdmin ? "Approved owner requests will appear here." : "Submit a parking lot for approval above."}</p> : null}
        </div>
      </article>

      <article className="prototype-panel full-panel">
        <div className="panel-title-row"><h3>{isSuperAdmin ? "Owner Requests" : "My Requests"}</h3><span>{submissions.filter((row) => row.status === "pending").length} pending</span></div>
        <div className="submission-list">
          {submissions.map((row) => <article key={row.id} className="submission-card">
            <div className="submission-card-header"><div><strong>{row.name}</strong><p>{row.address}</p></div><span className={`submission-status ${row.status}`}>{row.status}</span></div>
            <div className="submission-meta"><span>Owner: {row.submitter_name}</span><span>{row.total_slots} slots</span><span>{row.latitude}, {row.longitude}</span></div>
            <a className="map-link" href={`https://www.google.com/maps/search/?api=1&query=${row.latitude},${row.longitude}`} target="_blank" rel="noreferrer">Check coordinates on map</a>
            <div className="submission-actions">
              {!isSuperAdmin && row.status !== "approved" ? <>
                <button type="button" className="secondary-button" disabled={Boolean(action)} onClick={() => beginEdit("request", row)}>Edit request</button>
                <button type="button" className="danger-button" disabled={Boolean(action)} onClick={() => remove("request", row)}>Delete request</button>
              </> : null}
              {isSuperAdmin && row.status === "pending" ? <>
                <button type="button" className="primary-button" disabled={Boolean(action)} onClick={() => perform(`approve-${row.id}`, () => approveParkingLotSubmission(row.id), "Parking lot approved and assigned.")}>Approve</button>
                <button type="button" className="danger-button" disabled={Boolean(action)} onClick={() => perform(`reject-${row.id}`, () => rejectParkingLotSubmission(row.id), "Parking lot request rejected.")}>Reject</button>
              </> : null}
            </div>
          </article>)}
          {!submissions.length ? <p className="empty-text">No parking lot requests.</p> : null}
        </div>
      </article>
    </section>
  );
}
