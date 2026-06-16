import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useSocket } from "@/core/socket/SocketContext.jsx";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/core/notifications/notificationApi.js";
import { appToastSuccess } from "@/core/notifications/appToast.js";
import "./notification-bell.css";

function formatSentAt(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildDetailLines(item, payload = {}) {
  const lines = [];
  if (payload.reservation_id || item?.reservation_id) {
    lines.push(`Reservation #${payload.reservation_id ?? item.reservation_id}`);
  }
  if (payload.order_id || item?.order_id) {
    lines.push(`Order #${payload.order_id ?? item.order_id}`);
  }
  if (payload.customer_name) {
    lines.push(`Guest: ${payload.customer_name}`);
  }
  if (payload.table_number || payload.table_label) {
    lines.push(`Table: ${payload.table_number || payload.table_label}`);
  }
  if (payload.start_time) {
    lines.push(`Time: ${payload.start_time}`);
  }
  if (payload.party_size) {
    lines.push(`Party size: ${payload.party_size}`);
  }
  if (payload.dish_name) {
    lines.push(`Dish: ${payload.dish_name}`);
  }
  return lines;
}

function NotificationBell({ user, listenForStaffEvents = false, className = "" }) {
  const { socket } = useSocket();
  const userId = Number(user?.userId ?? user?.id);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [expandedId, setExpandedId] = useState(null);
  const [livePayloads, setLivePayloads] = useState({});

  const loadNotifications = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token || !userId) return;
    setLoading(true);
    try {
      const data = await fetchNotifications(userId);
      setItems(Array.isArray(data.items) ? data.items : []);
      setUnread(Number(data.unread) || 0);
    } catch {
      /* keep existing list on refresh failure */
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || !socket || !listenForStaffEvents) return undefined;

    const handleIncoming = (payload = {}) => {
      const message =
        payload.message || payload.title || "New customer activity received.";
      appToastSuccess(message);
      setUnread((count) => count + 1);
      setLivePayloads((prev) => ({
        ...prev,
        [`live-${Date.now()}`]: payload,
      }));
      setItems((prev) => [
        {
          notification_id: `live-${Date.now()}`,
          title: payload.title || "New activity",
          message_body: message,
          notification_type: payload.actionType === "order" ? "Order Ready" : "System",
          is_read: false,
          sent_at: payload.sent_at || new Date().toISOString(),
          _live: true,
          _payload: payload,
        },
        ...prev,
      ]);
    };

    socket.on("NEW_CUSTOMER_ACTION", handleIncoming);
    return () => socket.off("NEW_CUSTOMER_ACTION", handleIncoming);
  }, [socket, listenForStaffEvents]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (
        panelRef.current?.contains(event.target) ||
        buttonRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const handleToggle = () => {
    setOpen((prev) => !prev);
    if (!open) {
      loadNotifications();
    }
  };

  const handleItemClick = async (item) => {
    const id = item.notification_id;
    setExpandedId((prev) => (prev === id ? null : id));

    if (item._live || item.is_read || !userId) return;

    try {
      await markNotificationRead(userId, id);
      setItems((prev) =>
        prev.map((row) =>
          row.notification_id === id ? { ...row, is_read: true } : row
        )
      );
      setUnread((count) => Math.max(0, count - 1));
    } catch (err) {
      toast.error(err.message || "Could not mark notification as read.");
    }
  };

  const handleMarkAllRead = async () => {
    if (!userId || unread === 0) return;
    try {
      await markAllNotificationsRead(userId);
      setItems((prev) => prev.map((row) => ({ ...row, is_read: true })));
      setUnread(0);
    } catch (err) {
      toast.error(err.message || "Could not mark all as read.");
    }
  };

  if (!userId) return null;

  return (
    <div className={`notification-bell ${className}`.trim()}>
      <button
        ref={buttonRef}
        type="button"
        className="sfx-iconbtn sfx-header__bell notification-bell__trigger"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={handleToggle}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            d="M12 3a5 5 0 0 0-5 5v2.1c0 .5-.2 1-.5 1.4L5 13.2V14h14v-.8l-1.5-1.7c-.3-.4-.5-.9-.5-1.4V8a5 5 0 0 0-5-5Zm0 18a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 21Z"
            fill="currentColor"
          />
        </svg>
        {unread > 0 ? (
          <span className="notification-bell__badge" aria-label={`${unread} unread`}>
            {unread > 99 ? "99+" : unread}
          </span>
        ) : (
          <span className="sfx-header__dot notification-bell__dot" />
        )}
      </button>

      {open ? (
        <div ref={panelRef} className="notification-bell__panel" role="dialog" aria-label="Notifications">
          <header className="notification-bell__head">
            <div>
              <h2>Notifications</h2>
              <p>{unread > 0 ? `${unread} unread` : "You're all caught up"}</p>
            </div>
            <button
              type="button"
              className="notification-bell__mark-all"
              onClick={handleMarkAllRead}
              disabled={unread === 0}
            >
              Mark all read
            </button>
          </header>

          <div className="notification-bell__list">
            {loading && items.length === 0 ? (
              <p className="notification-bell__empty">Loading notifications…</p>
            ) : null}
            {!loading && items.length === 0 ? (
              <p className="notification-bell__empty">No notifications yet.</p>
            ) : null}

            {items.map((item) => {
              const payload = item._payload || livePayloads[item.notification_id] || {};
              const details = buildDetailLines(item, payload);
              const expanded = expandedId === item.notification_id;

              return (
                <button
                  key={item.notification_id}
                  type="button"
                  className={`notification-bell__item ${
                    item.is_read ? "is-read" : "is-unread"
                  } ${expanded ? "is-expanded" : ""}`}
                  onClick={() => handleItemClick(item)}
                >
                  <div className="notification-bell__item-top">
                    <strong>{item.title}</strong>
                    <span>{formatSentAt(item.sent_at)}</span>
                  </div>
                  <p>{item.message_body}</p>
                  {expanded && details.length > 0 ? (
                    <ul className="notification-bell__details">
                      {details.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default NotificationBell;
