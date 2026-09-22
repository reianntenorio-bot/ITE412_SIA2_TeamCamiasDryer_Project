import { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Clock,
  Plus,
  Pencil,
  Trash2,
  X,
  CheckCircle,
} from "lucide-react";
import { completeDryerBatch } from "../utils/dryingHistory";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatStartDisplay(date) {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const h = pad2(date.getHours());
  const min = pad2(date.getMinutes());
  return `${y}-${m}-${d} ${h}:${min}`;
}

function localFormToStartAtIso(startDate, startTimeVal) {
  const [y, mo, d] = startDate.split("-").map(Number);
  const [hh, mm] = startTimeVal.split(":").map(Number);
  if ([y, mo, d, hh, mm].some((n) => Number.isNaN(n))) {
    throw new Error("Invalid start date or time");
  }
  return new Date(y, mo - 1, d, hh, mm, 0, 0).toISOString();
}

function apiRowToSchedule(row) {
  const start = row.startAt ? new Date(row.startAt) : new Date();
  const durationHours =
    typeof row.durationHours === "number" && Number.isFinite(row.durationHours)
      ? row.durationHours
      : 3;
  const batchSizeKg =
    typeof row.batchSizeKg === "number" && Number.isFinite(row.batchSizeKg)
      ? row.batchSizeKg
      : 15;
  const endMs = start.getTime() + durationHours * 3600000;
  const now = Date.now();
  let status = "scheduled";
  if (now >= endMs) status = "overdue";
  else if (now >= start.getTime()) status = "in_progress";

  return {
    id: row.id,
    startTime: formatStartDisplay(start),
    duration: `${durationHours} hrs`,
    batchSize: `${batchSizeKg} kg`,
    status,
    canComplete: status !== "scheduled",
  };
}

function localDateInputDefault() {
  const t = new Date();
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
}

async function readErrorMessage(res) {
  try {
    const data = await res.json();
    if (data && typeof data.error === "string") return data.error;
  } catch {
    /* ignore */
  }
  return res.statusText || `Request failed (${res.status})`;
}

function Scheduler() {
  const [schedules, setSchedules] = useState([]);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [completingId, setCompletingId] = useState(null);

  const fetchBatches = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await fetch(`${API_URL}/api/dryer-batches`);
      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        throw new Error("Invalid response from server");
      }
      setSchedules(data.map(apiRowToSchedule));
    } catch (err) {
      setError(err.message || "Failed to load schedules");
      setSchedules([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBatches(true);
    const t = setInterval(() => fetchBatches(false), 12000);
    return () => clearInterval(t);
  }, [fetchBatches]);

  const totalScheduled = schedules.length;
  const todayYmd = localDateInputDefault();
  const todaySessions = schedules.filter((s) =>
    s.startTime.startsWith(todayYmd)
  ).length;

  const summaryStats = [
    { label: "Total Scheduled", value: String(totalScheduled), icon: Calendar },
    { label: "Today's Sessions", value: String(todaySessions), icon: Clock },
  ];

  const handleEdit = (schedule) => {
    setEditingSchedule({ ...schedule });
    setIsAddModalOpen(false);
  };

  const handleDelete = async (schedule) => {
    if (!window.confirm(`Delete Kamyas Batch #${schedule.id.slice(0, 8)}…?`)) {
      return;
    }
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/dryer-batches/${schedule.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      await fetchBatches(false);
    } catch (err) {
      setError(err.message || "Delete failed");
    }
  };

  const handleDone = async (schedule) => {
    if (
      !window.confirm(
        `Mark ${displayBatchLabel(schedule)} as done and save it to History?`
      )
    ) {
      return;
    }
    setError(null);
    setCompletingId(schedule.id);
    try {
      await completeDryerBatch(schedule.id);
      await fetchBatches(false);
    } catch (err) {
      setError(err.message || "Could not mark batch as done");
    } finally {
      setCompletingId(null);
    }
  };

  const statusLabel = (status) => {
    switch (status) {
      case "in_progress":
        return "In Progress";
      case "overdue":
        return "Overdue";
      default:
        return "Scheduled";
    }
  };

  const handleAddClick = () => {
    setIsAddModalOpen(true);
    setEditingSchedule(null);
  };

  const buildBodyFromForm = useCallback((form) => {
    const startDate = form.startDate.value;
    const startTimeVal = form.startTime.value;
    const duration = parseFloat(form.duration.value) || 3;
    const batchSize = parseInt(form.batchSize.value, 10) || 15;
    return {
      startAt: localFormToStartAtIso(startDate, startTimeVal),
      durationHours: duration,
      batchSizeKg: batchSize,
    };
  }, []);

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingSchedule) return;
    const form = e.target;
    const body = buildBodyFromForm(form);
    setError(null);
    try {
      const res = await fetch(
        `${API_URL}/api/dryer-batches/${editingSchedule.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) throw new Error(await readErrorMessage(res));
      setEditingSchedule(null);
      await fetchBatches(false);
    } catch (err) {
      setError(err.message || "Update failed");
    }
  };

  const handleSaveAdd = async (e) => {
    e.preventDefault();
    const form = e.target;
    const body = buildBodyFromForm(form);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/dryer-batches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      setIsAddModalOpen(false);
      await fetchBatches(false);
    } catch (err) {
      setError(err.message || "Could not add batch");
    }
  };

  const parseScheduleForForm = (schedule) => {
    const [datePart, timePart] = schedule.startTime.split(" ");
    const durationMatch = schedule.duration.match(/[\d.]+/);
    const batchMatch = schedule.batchSize.match(/\d+/);
    return {
      startDate: datePart || localDateInputDefault(),
      startTime: timePart || "14:00",
      duration: durationMatch ? durationMatch[0] : "3",
      batchSize: batchMatch ? batchMatch[0] : "15",
    };
  };

  const displayBatchLabel = (schedule) => {
    const shortId = schedule.id.length > 8 ? schedule.id.slice(0, 8) : schedule.id;
    return `Kamyas Batch #${shortId}`;
  };

  return (
    <div className="scheduler-page">
      <div className="scheduler-banner">
        Kamyas Smart Machine for Automated Regulated Temperature
      </div>

      {error && (
        <div
          className="scheduler-banner"
          style={{
            background: "var(--danger, #b91c1c)",
            color: "#fff",
            marginTop: "0.5rem",
          }}
        >
          {error}
        </div>
      )}

      <section className="scheduler-section">
        <div className="scheduler-header">
          <h2 className="scheduler-title">Drying Schedule Manager</h2>
          <button className="add-schedule-btn" type="button" onClick={handleAddClick}>
            <Plus size={18} />
            Add Batch
          </button>
        </div>

        <div className="summary-widgets">
          {summaryStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="summary-widget">
                <Icon size={24} className="summary-icon" />
                <div className="summary-content">
                  <span className="summary-value">{stat.value}</span>
                  <span className="summary-label">{stat.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="scheduler-section">
        <h2 className="section-title">Upcoming Drying Sessions</h2>
        <div className="scheduler-table-container">
          {loading ? (
            <p className="scheduler-title" style={{ padding: "1rem" }}>
              Loading schedules…
            </p>
          ) : (
            <table className="scheduler-table">
              <thead>
                <tr>
                  <th>Batch Name</th>
                  <th>Start Time</th>
                  <th>Duration</th>
                  <th>Batch Size</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "1.5rem" }}>
                      No batches scheduled yet. Use Add Batch to create one.
                    </td>
                  </tr>
                ) : (
                  schedules.map((schedule) => (
                    <tr key={schedule.id}>
                      <td className="batch-name">{displayBatchLabel(schedule)}</td>
                      <td className="start-time">{schedule.startTime}</td>
                      <td className="duration">{schedule.duration}</td>
                      <td className="batch-size">{schedule.batchSize}</td>
                      <td>
                        <span className={`batch-status-pill batch-status-${schedule.status}`}>
                          {statusLabel(schedule.status)}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          {schedule.canComplete && (
                            <button
                              className="batch-done-btn"
                              type="button"
                              title="Mark as done"
                              disabled={completingId === schedule.id}
                              onClick={() => handleDone(schedule)}
                            >
                              <CheckCircle size={16} />
                              {completingId === schedule.id ? "Saving…" : "Done"}
                            </button>
                          )}
                          <button
                            className="action-btn edit"
                            type="button"
                            title="Edit"
                            onClick={() => handleEdit(schedule)}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="action-btn delete"
                            type="button"
                            title="Delete"
                            onClick={() => handleDelete(schedule)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {editingSchedule && (
        <div
          className="schedule-modal-overlay"
          onClick={() => setEditingSchedule(null)}
        >
          <div
            className="schedule-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="schedule-modal-header">
              <h3>Edit Schedule — {displayBatchLabel(editingSchedule)}</h3>
              <button
                className="modal-close"
                onClick={() => setEditingSchedule(null)}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="schedule-modal-form">
              {(() => {
                const f = parseScheduleForForm(editingSchedule);
                return (
                  <>
                    <div className="form-row">
                      <label>Start Date</label>
                      <input
                        type="date"
                        name="startDate"
                        defaultValue={f.startDate}
                        required
                      />
                    </div>
                    <div className="form-row">
                      <label>Start Time</label>
                      <input
                        type="time"
                        name="startTime"
                        defaultValue={f.startTime}
                        required
                      />
                    </div>
                    <div className="form-row">
                      <label>Duration (hours)</label>
                      <input
                        type="number"
                        name="duration"
                        step="0.5"
                        min="0.5"
                        defaultValue={f.duration}
                        required
                      />
                    </div>
                    <div className="form-row">
                      <label>Batch Size (kg)</label>
                      <input
                        type="number"
                        name="batchSize"
                        min="1"
                        defaultValue={f.batchSize}
                        required
                      />
                    </div>
                    <div className="form-actions">
                      <button
                        type="button"
                        className="btn-cancel"
                        onClick={() => setEditingSchedule(null)}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="btn-save">
                        Save Changes
                      </button>
                    </div>
                  </>
                );
              })()}
            </form>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div
          className="schedule-modal-overlay"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            className="schedule-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="schedule-modal-header">
              <h3>Add Batch</h3>
              <button
                className="modal-close"
                onClick={() => setIsAddModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveAdd} className="schedule-modal-form">
              <div className="form-row">
                <label>Start Date</label>
                <input
                  type="date"
                  name="startDate"
                  defaultValue={localDateInputDefault()}
                  required
                />
              </div>
              <div className="form-row">
                <label>Start Time</label>
                <input type="time" name="startTime" defaultValue="14:00" required />
              </div>
              <div className="form-row">
                <label>Duration (hours)</label>
                <input
                  type="number"
                  name="duration"
                  step="0.5"
                  min="0.5"
                  defaultValue="3"
                  required
                />
              </div>
              <div className="form-row">
                <label>Batch Size (kg)</label>
                <input
                  type="number"
                  name="batchSize"
                  min="1"
                  defaultValue="15"
                  required
                />
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-save">
                  Add Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Scheduler;
