import { useState, useEffect } from "react";
import { Bell, CheckCircle, AlertCircle } from "lucide-react";
import {
  getNotifications,
  markAllNotificationsRead,
  clearNotifications,
} from "../utils/notifications";

function Notifications() {
  const [notifications, setNotifications] = useState(() => getNotifications());

  useEffect(() => {
    const refresh = () => setNotifications(getNotifications());
    window.addEventListener("kamyas-notifications-updated", refresh);
    refresh();
    return () => window.removeEventListener("kamyas-notifications-updated", refresh);
  }, []);

  return (
    <div className="notifications-page">
      <div className="notifications-content">
        <div className="notifications-header-row">
          <h1 className="notifications-title">
            <Bell size={28} />
            Notifications
          </h1>
          {notifications.length > 0 && (
            <div className="notifications-actions">
              <button type="button" className="export-btn" onClick={markAllNotificationsRead}>
                Mark all read
              </button>
              <button type="button" className="export-btn" onClick={clearNotifications}>
                Clear all
              </button>
            </div>
          )}
        </div>

        <div className="notifications-list">
          {notifications.length === 0 ? (
            <p className="manage-products-empty">
              No notifications yet. You will be notified 5 minutes before a batch
              ends, when a batch completes, and when a scheduled batch starts.
            </p>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`notification-item ${notif.read ? "read" : "unread"} ${notif.type}`}
              >
                <div className="notification-icon">
                  {notif.type === "success" ? (
                    <CheckCircle size={24} />
                  ) : (
                    <AlertCircle size={24} />
                  )}
                </div>
                <div className="notification-body">
                  <h3 className="notification-title">{notif.title}</h3>
                  <p className="notification-message">{notif.message}</p>
                  <span className="notification-time">
                    {notif.time} · {notif.date}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default Notifications;
