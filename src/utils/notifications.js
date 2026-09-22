const STORAGE_KEY = "kamyas_notifications";
const MAX_ITEMS = 50;

export function getNotifications() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export function addNotification({ type = "info", title, message }) {
  if (!title) return;
  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    message: message || "",
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    date: new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    read: false,
    createdAt: new Date().toISOString(),
  };
  const next = [item, ...getNotifications()].slice(0, MAX_ITEMS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("kamyas-notifications-updated"));
  return item;
}

export function markAllNotificationsRead() {
  const next = getNotifications().map((n) => ({ ...n, read: true }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("kamyas-notifications-updated"));
}

export function clearNotifications() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  window.dispatchEvent(new CustomEvent("kamyas-notifications-updated"));
}
