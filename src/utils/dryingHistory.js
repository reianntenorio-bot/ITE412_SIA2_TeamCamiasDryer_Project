const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export const HISTORY_UPDATED_EVENT = "kamyas-history-updated";

export function notifyHistoryUpdated() {
  window.dispatchEvent(new CustomEvent(HISTORY_UPDATED_EVENT));
}

export { API_URL };

export function formatSessionDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatSessionDuration(hours) {
  if (hours == null || !Number.isFinite(hours)) return "—";
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded} hrs`;
}

export function formatBatchLabel(id) {
  if (!id) return "Kamyas Batch";
  const shortId = id.length > 8 ? id.slice(0, 8) : id;
  return `Kamyas Batch #${shortId}`;
}

export function formatStatusLabel(status) {
    switch (status) {
    case "completed":
      return "Completed";
    case "pending":
      return "Pending";
    case "interrupted":
      return "Interrupted";
    case "stopped":
      return "Stopped";
    default:
      return status ? String(status) : "Completed";
  }
}

export function computeHistorySummary(sessions) {
  if (!sessions.length) {
    return {
      avgDuration: "—",
      totalBatches: "0",
      totalWeight: "0 kg",
    };
  }

  const durations = sessions
    .map((s) => s.durationHours)
    .filter((h) => typeof h === "number" && Number.isFinite(h));
  const avgDuration =
    durations.length > 0
      ? formatSessionDuration(
          durations.reduce((sum, h) => sum + h, 0) / durations.length
        )
      : "—";

  const totalWeight = sessions.reduce(
    (sum, s) => sum + (typeof s.batchSizeKg === "number" ? s.batchSizeKg : 0),
    0
  );

  return {
    avgDuration,
    totalBatches: String(sessions.length),
    totalWeight: `${totalWeight.toLocaleString()} kg`,
  };
}

export async function completeDryerBatch(batchId) {
  let res;
  try {
    res = await fetch(`${API_URL}/api/dryer-batches/${encodeURIComponent(batchId)}/complete`, {
      method: "POST",
    });
  } catch {
    throw new Error(
      `Cannot reach the API at ${API_URL}. Start it with: cd server && npm run dev`
    );
  }
  if (!res.ok) {
    let message = "Failed to mark batch as done";
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const data = await res.json();
  notifyHistoryUpdated();
  return data;
}

export async function fetchDryingHistory() {
  let res;
  try {
    res = await fetch(`${API_URL}/api/drying-history`);
  } catch {
    throw new Error(
      `Cannot reach the API at ${API_URL}. Start it with: cd server && npm run dev`
    );
  }
  if (!res.ok) {
    let message = "Failed to load drying history";
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("Invalid response from server");
  return data;
}

export async function deleteHistoryEntry(entryId) {
  let res;
  try {
    res = await fetch(
      `${API_URL}/api/drying-history/${encodeURIComponent(entryId)}`,
      { method: "DELETE" },
    );
  } catch {
    throw new Error(
      `Cannot reach the API at ${API_URL}. Start it with: cd server && npm run dev`,
    );
  }
  if (!res.ok) {
    let message = "Failed to delete history entry";
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  notifyHistoryUpdated();
  return res.json();
}

export async function saveDryingSession(payload) {
  let res;
  try {
    res = await fetch(`${API_URL}/api/drying-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      `Cannot reach the API at ${API_URL}. Start it with: cd server && npm run dev`
    );
  }
  if (!res.ok) {
    let message = "Failed to save drying session";
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const data = await res.json();
  notifyHistoryUpdated();
  return data;
}
