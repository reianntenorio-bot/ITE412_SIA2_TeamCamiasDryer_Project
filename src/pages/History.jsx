import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  History as HistoryIcon,
  Clock,
  Package,
  Scale,
  Eye,
  X,
  FileDown,
  Printer,
  Trash2,
} from "lucide-react";
import {
  fetchDryingHistory,
  deleteHistoryEntry,
  computeHistorySummary,
  formatSessionDate,
  formatSessionDuration,
  formatBatchLabel,
  formatStatusLabel,
  HISTORY_UPDATED_EVENT,
} from "../utils/dryingHistory";
import {
  buildHistoryReportLines,
  downloadCsv,
  downloadExcel,
  printHistoryReport,
} from "../utils/exportHistoryReport";

function History() {
  const location = useLocation();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [deletingId, setDeletingId] = useState(null);

  const loadHistory = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await fetchDryingHistory();
      setSessions(data);
    } catch (err) {
      setError(err.message || "Failed to load history");
      setSessions([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory(true);
    const interval = setInterval(() => loadHistory(false), 5000);
    return () => clearInterval(interval);
  }, [loadHistory, location.pathname]);

  useEffect(() => {
    const onHistoryUpdated = () => loadHistory(false);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        loadHistory(false);
      }
    };

    window.addEventListener(HISTORY_UPDATED_EVENT, onHistoryUpdated);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(HISTORY_UPDATED_EVENT, onHistoryUpdated);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadHistory]);

  const filteredSessions = useMemo(() => {
    if (statusFilter === "all") return sessions;
    return sessions.filter((session) => session.status === statusFilter);
  }, [sessions, statusFilter]);

  const summary = computeHistorySummary(filteredSessions);
  const summaryStats = [
    { label: "Avg Duration", value: summary.avgDuration, icon: Clock },
    { label: "Total Batches", value: summary.totalBatches, icon: Package },
    { label: "Total Weight", value: summary.totalWeight, icon: Scale },
  ];

  const exportBaseName = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    return `kamyas-history-${statusFilter}-${timestamp}`;
  };

  const handleExportCsv = () => {
    downloadCsv(`${exportBaseName()}.csv`, buildHistoryReportLines(filteredSessions));
  };

  const handleExportExcel = () => {
    downloadExcel(`${exportBaseName()}.csv`, buildHistoryReportLines(filteredSessions));
  };

  const handlePrint = () => {
    printHistoryReport(filteredSessions);
  };

  const handleDelete = async (session) => {
    const label = formatBatchLabel(session.batchId || session.id);
    if (!window.confirm(`Delete ${label} from history?`)) return;

    setDeletingId(session.id);
    setError(null);
    try {
      await deleteHistoryEntry(session.id);
      if (selectedBatch?.id === session.id) {
        setSelectedBatch(null);
      }
      await loadHistory(false);
    } catch (err) {
      setError(err.message || "Failed to delete history entry");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="history-page">
      <div className="history-banner">
        Kamyas Smart Machine for Automated Regulated Temperature
      </div>

      {error && <div className="manage-products-error">{error}</div>}

      <section className="history-section">
        <h2 className="section-title">
          <HistoryIcon size={22} />
          Drying Session History
        </h2>
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

      <section className="history-section">
        <div className="history-toolbar">
          <h2 className="section-title">Past Drying Sessions</h2>
          <div className="history-toolbar-actions">
            <div className="history-filter-group">
              {[
                { value: "all", label: "All" },
                { value: "completed", label: "Completed" },
                { value: "pending", label: "Pending" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`history-filter-btn${
                    statusFilter === opt.value ? " active" : ""
                  }`}
                  onClick={() => setStatusFilter(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="history-export-group">
              <button type="button" className="export-btn" onClick={handleExportCsv}>
                <FileDown size={16} />
                CSV
              </button>
              <button type="button" className="export-btn" onClick={handleExportExcel}>
                <FileDown size={16} />
                Excel
              </button>
              <button type="button" className="export-btn" onClick={handlePrint}>
                <Printer size={16} />
                Print / PDF
              </button>
            </div>
          </div>
        </div>
        <div className="history-table-container">
          {loading ? (
            <p className="manage-products-loading">Loading history…</p>
          ) : filteredSessions.length === 0 ? (
            <p className="manage-products-empty">
              No drying sessions found for this filter. Add a batch in Add Batch or
              finish a run on the Dashboard.
            </p>
          ) : (
            <table className="history-table">
              <thead>
                <tr>
                  <th>Batch Name</th>
                  <th>Date</th>
                  <th>Duration</th>
                  <th>Batch Size</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map((session) => (
                  <tr key={`${session.source}-${session.id}`}>
                    <td className="batch-name">{formatBatchLabel(session.batchId || session.id)}</td>
                    <td className="batch-date">
                      {formatSessionDate(session.startedAt || session.endedAt)}
                    </td>
                    <td className="batch-duration">
                      {formatSessionDuration(session.durationHours)}
                    </td>
                    <td className="batch-size">{session.batchSizeKg ?? 15} kg</td>
                    <td>
                      <span
                        className={`status-pill ${
                          session.status === "completed"
                            ? "active"
                            : session.status === "pending"
                              ? "pending"
                              : "paused"
                        }`}
                      >
                        {formatStatusLabel(session.status)}
                      </span>
                    </td>
                    <td>
                      <div className="history-action-buttons">
                        <button
                          className="view-btn"
                          type="button"
                          onClick={() => setSelectedBatch(session)}
                        >
                          <Eye size={16} />
                          View
                        </button>
                        <button
                          className="action-btn delete"
                          type="button"
                          title="Delete"
                          disabled={deletingId === session.id}
                          onClick={() => handleDelete(session)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {selectedBatch && (
        <div className="batch-modal-overlay" onClick={() => setSelectedBatch(null)}>
          <div className="batch-modal" onClick={(e) => e.stopPropagation()}>
            <div className="batch-modal-header">
              <h3>{formatBatchLabel(selectedBatch.batchId || selectedBatch.id)}</h3>
              <button
                className="modal-close"
                type="button"
                onClick={() => setSelectedBatch(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="batch-modal-body">
              <div className="modal-row">
                <span className="modal-label">Date</span>
                <span className="modal-value">
                  {formatSessionDate(
                    selectedBatch.startedAt || selectedBatch.endedAt
                  )}
                </span>
              </div>
              <div className="modal-row">
                <span className="modal-label">Duration</span>
                <span className="modal-value">
                  {formatSessionDuration(selectedBatch.durationHours)}
                </span>
              </div>
              <div className="modal-row">
                <span className="modal-label">Batch Size</span>
                <span className="modal-value">
                  {selectedBatch.batchSizeKg ?? 15} kg
                </span>
              </div>
              <div className="modal-row">
                <span className="modal-label">Status</span>
                <span className="modal-value">
                  {formatStatusLabel(selectedBatch.status)}
                </span>
              </div>
              <div className="modal-row">
                <span className="modal-label">Source</span>
                <span className="modal-value">
                  {selectedBatch.source === "scheduled"
                    ? "Scheduled batch"
                    : "Dashboard run"}
                </span>
              </div>
              {selectedBatch.progressPct != null && (
                <div className="modal-row">
                  <span className="modal-label">Progress</span>
                  <span className="modal-value">{selectedBatch.progressPct}%</span>
                </div>
              )}
              {selectedBatch.avgTemperature != null && (
                <div className="modal-row">
                  <span className="modal-label">Avg Temperature</span>
                  <span className="modal-value">
                    {selectedBatch.avgTemperature.toFixed(1)}°C
                  </span>
                </div>
              )}
              {selectedBatch.avgHumidity != null && (
                <div className="modal-row">
                  <span className="modal-label">Avg Humidity</span>
                  <span className="modal-value">
                    {selectedBatch.avgHumidity.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default History;
