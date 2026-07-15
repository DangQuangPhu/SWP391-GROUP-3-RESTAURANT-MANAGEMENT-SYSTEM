import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useSocket } from "@/core/socket/SocketContext.jsx";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/core/notifications/notificationApi.js";
import { appToastSuccess } from "@/core/notifications/appToast.js";
import { apiPatch, profileRequestHeaders } from "@/core/api/httpClient.js";
import "./notification-bell.css";

const QR_NOTIFICATION_STORAGE_KEY = "phurai_pending_qr_notifications";

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
  const resId = payload.reservation_id || payload.reservationId || item?.reservation_id || item?.reservationId;
  const ordId = payload.order_id || payload.orderId || item?.order_id || item?.orderId;
  const tblNum = payload.table_number || payload.tableNumber || payload.table_label;
  const amt = payload.amount || item?.amount;

  if (resId) {
    lines.push(`Reservation: #${resId}`);
  }
  if (ordId) {
    lines.push(`Order: #${ordId}`);
  }
  if (payload.customer_name || payload.customerName) {
    lines.push(`Guest: ${payload.customer_name || payload.customerName}`);
  }
  if (tblNum) {
    lines.push(`Table: ${tblNum}`);
  }
  if (amt) {
    lines.push(`Amount: ${Number(amt).toLocaleString('vi-VN')}₫`);
  }
  if (payload.start_time || payload.startTime) {
    lines.push(`Time: ${payload.start_time || payload.startTime}`);
  }
  if (payload.guest_count || payload.guestCount) {
    lines.push(`Guests: ${payload.guest_count || payload.guestCount}`);
  }
  if (payload.dish_name || payload.dishName) {
    lines.push(`Dish: ${payload.dish_name || payload.dishName}`);
  }
  return lines;
}

function readStoredQrNotifications() {
  try {
    const raw = localStorage.getItem(QR_NOTIFICATION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredQrNotifications(notifications) {
  try {
    const qrNotifications = notifications.filter(
      (item) => item.notification_type === "QR_PENDING"
    );
    localStorage.setItem(QR_NOTIFICATION_STORAGE_KEY, JSON.stringify(qrNotifications));
  } catch {
    /* storage is best-effort only */
  }
}

function getQrSessionPayload(data = {}) {
  return data.session || data;
}

function getQrSessionId(session = {}) {
  return (
    session.session_id ||
    session.qr_session_id ||
    session.id ||
    session.table_id ||
    Date.now()
  );
}

function getQrTableLabel(session = {}) {
  return (
    session.table_number ||
    session.table_label ||
    session.table_name ||
    session.table_id ||
    "Unknown"
  );
}

function buildQrNotification(data = {}) {
  const session = getQrSessionPayload(data);
  const sessionId = getQrSessionId(session);
  const tableLabel = getQrTableLabel(session);

  return {
    id: sessionId,
    table_id: session.table_id || "Unknown",
    notification_id: `qr-req-${sessionId}`,
    title: "QR Check-in Request",
    message_body: `Table ${tableLabel} is requesting menu access.`,
    notification_type: "QR_PENDING",
    is_read: false,
    sent_at: session.sent_at || session.generated_at || new Date().toISOString(),
    type: "QR_PENDING",
    _live: true,
    _payload: {
      ...session,
      session_id: session.session_id || session.qr_session_id || sessionId,
      table_id: session.table_id || "Unknown",
      type: "QR_PENDING",
    },
  };
}

function mergeNotifications(...groups) {
  const seen = new Set();
  const merged = [];

  groups.flat().forEach((item) => {
    if (!item) return;
    const key = item.notification_id || item.id;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  });

  return merged;
}

function NotificationBell({ user, listenForStaffEvents = false, className = "" }) {
  const { socket } = useSocket();
  const userId = Number(user?.userId ?? user?.id);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState(() =>
    listenForStaffEvents ? readStoredQrNotifications() : []
  );
  const [expandedId, setExpandedId] = useState(null);
  const unread = notifications.filter((item) => !item.is_read).length;

  const loadNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await fetchNotifications(userId);
      const regularNotifications = Array.isArray(data.items) ? data.items : [];
      setNotifications((prev) =>
        mergeNotifications(
          prev.filter((item) => item.notification_type === "QR_PENDING"),
          regularNotifications
        )
      );
    } catch {
      /* keep existing list on refresh failure */
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadPendingQrSessions = useCallback(() => {
    if (!listenForStaffEvents) return;

    setNotifications((prev) =>
      mergeNotifications(readStoredQrNotifications(), prev)
    );
  }, [listenForStaffEvents]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    loadPendingQrSessions();
  }, [loadPendingQrSessions]);

  useEffect(() => {
    if (listenForStaffEvents) {
      writeStoredQrNotifications(notifications);
    }
  }, [notifications, listenForStaffEvents]);

  useEffect(() => {
    if (!socket || !listenForStaffEvents) return undefined;

    const handleIncoming = (payload = {}) => {
      const message =
        payload.message || payload.title || "New customer activity received.";
      appToastSuccess(message);
      const notificationId = `live-${Date.now()}`;
      setNotifications((prev) =>
        mergeNotifications(
          [
            {
              notification_id: notificationId,
              title: payload.title || "New activity",
              message_body: message,
              notification_type: payload.actionType === "order" ? "Order Ready" : "System",
              is_read: false,
              sent_at: payload.sent_at || new Date().toISOString(),
              _live: true,
              _payload: payload,
            },
          ],
          prev
        )
      );
    };

    const handleSystemAlert = (payload = {}) => {
      const message = payload.message || payload.title || "System Alert";
      toast.error(message, { duration: 6000, icon: '⚠️' });
      const notificationId = `live-${Date.now()}`;
      setNotifications((prev) =>
        mergeNotifications(
          [
            {
              notification_id: notificationId,
              title: payload.title || "System Alert",
              message_body: message,
              notification_type: "System",
              is_read: false,
              sent_at: new Date().toISOString(),
              _live: true,
              _payload: payload,
            },
          ],
          prev
        )
      );
    };

    const handleQrRequest = (data = {}) => {
      const qrNotification = buildQrNotification(data);
      setNotifications((prev) =>
        mergeNotifications([qrNotification], prev)
      );
      appToastSuccess(
        `Table ${getQrTableLabel(qrNotification._payload)} requested QR access.`
      );
    };

    const handleCashPending = (payload = {}) => {
      appToastSuccess(`Table ${payload.tableNumber || 'Unknown'} requested Cash Payment (${new Intl.NumberFormat("vi-VN").format(payload.amount || 0)}đ)`);
      const notificationId = `cash-${payload.orderId}-${Date.now()}`;
      setNotifications((prev) =>
        mergeNotifications(
          [
            {
              notification_id: notificationId,
              title: "Cash Payment Request",
              message_body: `Table ${payload.tableNumber} wants to pay by cash.`,
              notification_type: "Payment",
              is_read: false,
              sent_at: new Date().toISOString(),
              _live: true,
              _payload: payload,
            },
          ],
          prev
        )
      );
    };

    socket.on("NEW_CUSTOMER_ACTION", handleIncoming);
    socket.on("notification:new", handleSystemAlert);
    socket.on("NEW_QR_SESSION_PENDING", handleQrRequest);
    socket.on("payment:cash_pending", handleCashPending);
    return () => {
      socket.off("NEW_CUSTOMER_ACTION", handleIncoming);
      socket.off("notification:new", handleSystemAlert);
      socket.off("NEW_QR_SESSION_PENDING", handleQrRequest);
      socket.off("payment:cash_pending", handleCashPending);
    };
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
      loadPendingQrSessions();
    }
  };

  const handleItemClick = async (item) => {
    const id = item.notification_id;
    if (item.notification_type !== "QR_PENDING") {
      setExpandedId((prev) => (prev === id ? null : id));
    }

    if (item._live || item.is_read || !userId) return;

    try {
      await markNotificationRead(userId, id);
      setNotifications((prev) =>
        prev.map((row) =>
          row.notification_id === id ? { ...row, is_read: true } : row
        )
      );
    } catch (err) {
      toast.error(err.message || "Could not mark notification as read.");
    }
  };

  const handleQrAction = async (item, action) => {
    const sessionId = item._payload?.session_id || item._payload?.qr_session_id || item.id;
    if (!sessionId) {
      toast.error("Missing QR session ID.");
      return;
    }

    try {
      const requestOptions = { headers: profileRequestHeaders(userId) };
      if (action === "approve") {
        await apiPatch(`/staff/qr-sessions/${sessionId}/approve`, {}, requestOptions);
        toast.success("Table approved.");
      } else {
        await apiPatch(`/staff/qr-sessions/${sessionId}/reject`, {}, requestOptions);
        toast.success("Table rejected.");
      }
      setNotifications((prev) =>
        prev.filter((row) => row.notification_id !== item.notification_id)
      );
    } catch (err) {
      toast.error(err.message || `Failed to ${action} session.`);
    }
  };

  const handleMarkAllRead = async () => {
    if (!userId || unread === 0) return;
    try {
      await markAllNotificationsRead(userId);
      setNotifications((prev) =>
        prev.map((row) =>
          row.notification_type === "QR_PENDING" ? row : { ...row, is_read: true }
        )
      );
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
            {loading && notifications.length === 0 ? (
              <p className="notification-bell__empty">Loading notifications...</p>
            ) : null}
            {!loading && notifications.length === 0 ? (
              <p className="notification-bell__empty">No notifications yet.</p>
            ) : null}

            {notifications.map((item) => {
              const payload = item._payload || {};
              const details = buildDetailLines(item, payload);
              const expanded = expandedId === item.notification_id;

              if (item.notification_type === "QR_PENDING") {
                return (
                  <div
                    key={item.notification_id}
                    className="notification-bell__item is-unread"
                    style={{
                      background: "#fff",
                      borderLeft: "4px solid #16a34a",
                      padding: "12px",
                      cursor: "default",
                    }}
                  >
                    <div className="notification-bell__item-top">
                      <strong>{item.title}</strong>
                      <span>{formatSentAt(item.sent_at)}</span>
                    </div>
                    <p style={{ margin: "8px 0", color: "#333", fontWeight: "500" }}>
                      {item.message_body}
                    </p>
                    <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                      <button
                        type="button"
                        onClick={() => handleQrAction(item, "approve")}
                        style={{
                          flex: 1,
                          padding: "6px",
                          background: "#16a34a",
                          color: "#fff",
                          borderRadius: "4px",
                          border: "none",
                          cursor: "pointer",
                          fontWeight: "bold",
                        }}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQrAction(item, "reject")}
                        style={{
                          flex: 1,
                          padding: "6px",
                          background: "#fef2f2",
                          color: "#dc2626",
                          borderRadius: "4px",
                          border: "1px solid #fca5a5",
                          cursor: "pointer",
                          fontWeight: "bold",
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={item.notification_id}
                  className={`notification-bell__item ${
                    item.is_read ? "is-read" : "is-unread"
                  } ${expanded ? "is-expanded" : ""}`}
                  onClick={() => handleItemClick(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleItemClick(item);
                  }}
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
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default NotificationBell;
