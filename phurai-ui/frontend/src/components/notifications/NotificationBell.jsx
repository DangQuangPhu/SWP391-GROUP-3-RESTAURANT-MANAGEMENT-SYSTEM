import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Skeleton } from "@/components/ui/Skeleton.jsx";
import toast from "react-hot-toast";
import { useSocket } from "@/core/socket/SocketContext.jsx";
import { useStaffStore } from "@/features/staff-dashboard/store/staffStore.js";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/core/notifications/notificationApi.js";
import { appToastSuccess } from "@/core/notifications/appToast.js";
import { apiPatch, profileRequestHeaders } from "@/core/api/httpClient.js";
import "./notification-bell.css";

const QR_NOTIFICATION_STORAGE_KEY = "phurai_pending_qr_notifications";
const PAYMENT_NOTIFICATION_STORAGE_KEY = "phurai_payment_notifications";

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

function readStoredPaymentNotifications() {
  try {
    const raw = localStorage.getItem(PAYMENT_NOTIFICATION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Only keep notifications from the last 8 hours
    const cutoff = Date.now() - 8 * 60 * 60 * 1000;
    return parsed.filter((n) => new Date(n.sent_at).getTime() > cutoff);
  } catch {
    return [];
  }
}

function writeStoredPaymentNotifications(notifications) {
  try {
    const paymentNotifs = notifications
      .filter((item) => item.notification_type === "Payment Confirmed")
      .slice(0, 20); // max 20 persisted
    localStorage.setItem(PAYMENT_NOTIFICATION_STORAGE_KEY, JSON.stringify(paymentNotifs));
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
  const isReducedMotion = useReducedMotion();
  const { socket } = useSocket();
  const openTableModal = useStaffStore((state) => state.openTableModal);
  const userId = Number(user?.userId ?? user?.id);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState(() => {
    const stored = listenForStaffEvents ? readStoredQrNotifications() : [];
    const payments = listenForStaffEvents ? readStoredPaymentNotifications() : [];
    return mergeNotifications(payments, stored);
  });
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
      writeStoredPaymentNotifications(notifications);
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
      const tableId = payload.tableNumber || payload.tableId || payload.table_id || "N/A";
      const amountStr = new Intl.NumberFormat("vi-VN").format(payload.amount || payload.total_amount || 0);
      appToastSuccess(`💵 [CASH ON DELIVERY] Table ${tableId} requested cash payment (${amountStr}₫)`);
      const notificationId = `cash-${payload.orderId || payload.order_id || Date.now()}-${Date.now()}`;
      setNotifications((prev) =>
        mergeNotifications(
          [
            {
              notification_id: notificationId,
              title: `💵 [CASH ON DELIVERY] Table #${tableId}`,
              message_body: `Customer requested Cash Payment (${amountStr}₫) at table.`,
              notification_type: "Cash Payment Request",
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

    const handleOverrun = (payload = {}) => {
      const message = payload.message || "Cảnh báo quá giờ sử dụng bàn!";
      toast.error(message, {
        duration: 8000,
        icon: '⚠️',
        style: {
          background: '#1a1a2e',
          color: '#ffffff',
          border: '1px solid #ff6b6b'
        }
      });
      const notificationId = `overrun-${payload.tableId}-${payload.sessionId}-${Date.now()}`;
      setNotifications((prev) =>
        mergeNotifications(
          [
            {
              notification_id: notificationId,
              title: payload.title || "Table Overrun Warning",
              message_body: message,
              notification_type: "Overrun Warning",
              is_read: false,
              sent_at: payload.timestamp || new Date().toISOString(),
              _live: true,
              _payload: payload,
            },
          ],
          prev
        )
      );
    };

    const handlePaymentConfirmed = (payload = {}) => {
      const orderId = payload.orderId || payload.order_id;
      const tableId = payload.table_id || payload.tableNumber;
      const amount = payload.amount_paid || payload.amount || 0;
      const amountStr = Number(amount).toLocaleString('vi-VN');
      const confirmedAt = new Date().toISOString();
      const notificationId = `pay-confirmed-${orderId}-${Date.now()}`;
      const title = `✅ [PAYMENT ONLINE] Order #${orderId}`;
      const message = tableId
        ? `Table #${tableId} paid ${amountStr}₫ via SePay / Online Transfer.`
        : `Order #${orderId} payment of ${amountStr}₫ confirmed online.`;

      appToastSuccess(title);

      setNotifications((prev) =>
        mergeNotifications(
          [
            {
              notification_id: notificationId,
              title,
              message_body: message,
              notification_type: "Online Payment Confirmed",
              is_read: false,
              sent_at: confirmedAt,
              _live: true,
              _payload: { ...payload, confirmedAt },
            },
          ],
          prev
        )
      );
    };

    socket.on("NEW_CUSTOMER_ACTION", handleIncoming);
    socket.on("notification:new", handleIncoming);
    socket.on("reservation:new", handleIncoming);
    socket.on("reservation:edit_requested", handleIncoming);
    socket.on("reservation:cancel_requested", handleIncoming);
    socket.on("reservation:request_pending", handleIncoming);
    socket.on("NEW_RESERVATION_REQUEST", handleIncoming);
    socket.on("NEW_QR_SESSION_PENDING", handleQrRequest);
    socket.on("payment:cash_pending", handleCashPending);
    socket.on("table:cash_payment_requested", handleCashPending);
    socket.on("table:overrun_warning", handleOverrun);
    socket.on("PAYMENT_STATUS_CHANGED", handlePaymentConfirmed);
    socket.on("QR_SESSION_PAYMENT_COMPLETED", handlePaymentConfirmed);
    return () => {
      socket.off("NEW_CUSTOMER_ACTION", handleIncoming);
      socket.off("notification:new", handleIncoming);
      socket.off("reservation:new", handleIncoming);
      socket.off("reservation:edit_requested", handleIncoming);
      socket.off("reservation:cancel_requested", handleIncoming);
      socket.off("reservation:request_pending", handleIncoming);
      socket.off("NEW_RESERVATION_REQUEST", handleIncoming);
      socket.off("NEW_QR_SESSION_PENDING", handleQrRequest);
      socket.off("payment:cash_pending", handleCashPending);
      socket.off("table:cash_payment_requested", handleCashPending);
      socket.off("table:overrun_warning", handleOverrun);
      socket.off("PAYMENT_STATUS_CHANGED", handlePaymentConfirmed);
      socket.off("QR_SESSION_PAYMENT_COMPLETED", handlePaymentConfirmed);
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
    if (notifications.length === 0) return;
    try {
      if (userId) {
        await markAllNotificationsRead(userId).catch(() => {});
      }
      setNotifications((prev) =>
        prev.map((row) => ({ ...row, is_read: true }))
      );
      toast.success("Marked all notifications as read.");
    } catch {
      setNotifications((prev) =>
        prev.map((row) => ({ ...row, is_read: true }))
      );
    }
  };

  const handleClearAll = () => {
    setNotifications([]);
    localStorage.removeItem(QR_NOTIFICATION_STORAGE_KEY);
    localStorage.removeItem(PAYMENT_NOTIFICATION_STORAGE_KEY);
    toast.success("Cleared all notifications.");
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
          <motion.span 
            key={unread}
            initial={isReducedMotion ? {} : { scale: 0.8 }}
            animate={isReducedMotion ? {} : { scale: 1 }}
            transition={isReducedMotion ? { duration: 0.1 } : { type: "spring", stiffness: 380, damping: 22 }}
            className="notification-bell__badge" 
            aria-label={`${unread} unread`}
          >
            {unread > 99 ? "99+" : unread}
          </motion.span>
        ) : (
          <span className="sfx-header__dot notification-bell__dot" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div 
            ref={panelRef} 
            initial={isReducedMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={isReducedMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
            transition={isReducedMotion ? { duration: 0.1 } : { type: "spring", stiffness: 450, damping: 26 }}
            className="notification-bell__panel" 
            role="dialog" 
            aria-label="Notifications"
          >
            <header className="notification-bell__head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2>Notifications</h2>
                <p>{unread > 0 ? `${unread} unread` : "You're all caught up"}</p>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  type="button"
                  className="notification-bell__mark-all"
                  onClick={handleMarkAllRead}
                  disabled={unread === 0}
                  style={{ opacity: unread === 0 ? 0.4 : 1, cursor: unread === 0 ? "not-allowed" : "pointer" }}
                >
                  Mark all read
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={notifications.length === 0}
                  title="Clear all notifications"
                  aria-label="Clear all notifications"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: notifications.length === 0 ? "not-allowed" : "pointer",
                    opacity: notifications.length === 0 ? 0.3 : 0.8,
                    fontSize: "15px",
                    padding: "4px",
                    lineHeight: 1,
                  }}
                >
                  🗑️
                </button>
              </div>
            </header>

            <div className="notification-bell__list">
              {loading && notifications.length === 0 ? (
                <div className="space-y-2 p-2" aria-busy="true" aria-label="Loading notifications">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="notification-bell__item"
                      style={{
                        background: "#fff",
                        padding: "12px",
                        borderRadius: "8px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        border: "1px solid #f0f0f0"
                      }}
                    >
                      <div className="notification-bell__item-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Skeleton className="w-1/2 h-4" />
                        <Skeleton className="w-16 h-3" />
                      </div>
                      <Skeleton className="w-full h-3.5" />
                      <Skeleton className="w-3/4 h-3.5" />
                    </div>
                  ))}
                </div>
              ) : null}
              {!loading && notifications.length === 0 ? (
                <p className="notification-bell__empty">No notifications yet.</p>
              ) : null}

              <AnimatePresence initial={false}>
                {notifications.map((item) => {
                  const payload = item._payload || {};
                  const expanded = expandedId === item.notification_id;

                  let itemContent = null;

                  if (item.notification_type === "QR_PENDING") {
                    itemContent = (
                      <div
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
                  } else if (item.notification_type === "Cash Payment Request") {
                    itemContent = (
                      <div
                        className={`notification-bell__item ${item.is_read ? "is-read" : "is-unread"}`}
                        style={{
                          background: item.is_read ? "#fffbe6" : "#fef9c3",
                          borderLeft: "4px solid #ca8a04",
                          padding: "12px",
                          cursor: "default",
                        }}
                      >
                        <div className="notification-bell__item-top">
                          <strong style={{ color: "#854d0e" }}>{item.title}</strong>
                          <span>{formatSentAt(item.sent_at)}</span>
                        </div>
                        <p style={{ margin: "6px 0 8px", color: "#713f12", fontSize: "0.875rem", fontWeight: 500 }}>
                          {item.message_body}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setNotifications((prev) =>
                              prev.map((row) =>
                                row.notification_id === item.notification_id
                                  ? { ...row, is_read: true }
                                  : row
                              )
                            );
                          }}
                          style={{
                            padding: "5px 10px",
                            background: "#ca8a04",
                            color: "#fff",
                            borderRadius: "4px",
                            border: "none",
                            cursor: "pointer",
                            fontWeight: "bold",
                            fontSize: "0.75rem",
                          }}
                        >
                          Mark as Handled
                        </button>
                      </div>
                    );
                  } else if (item.notification_type === "Payment Confirmed" || item.notification_type === "Online Payment Confirmed") {
                    const confirmedAt = payload.confirmedAt || item.sent_at;
                    const timeStr = confirmedAt
                      ? new Date(confirmedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                      : "";
                    itemContent = (
                      <div
                        className={`notification-bell__item ${item.is_read ? "is-read" : "is-unread"}`}
                        style={{
                          background: item.is_read ? "#f0fdf4" : "#dcfce7",
                          borderLeft: "4px solid #16a34a",
                          padding: "12px",
                          cursor: "default",
                        }}
                      >
                        <div className="notification-bell__item-top">
                          <strong style={{ color: "#15803d" }}>{item.title}</strong>
                          <span>{formatSentAt(item.sent_at)}</span>
                        </div>
                        <p style={{ margin: "6px 0 8px", color: "#166534", fontSize: "0.875rem", fontWeight: 500 }}>
                          {item.message_body}
                        </p>
                        {timeStr && (
                          <p style={{ margin: "0 0 8px", color: "#15803d", fontSize: "0.75rem", fontFamily: "monospace" }}>
                            ⏱ Confirmed at {timeStr}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setNotifications((prev) =>
                              prev.map((row) =>
                                row.notification_id === item.notification_id
                                  ? { ...row, is_read: true }
                                  : row
                              )
                            );
                          }}
                          style={{
                            padding: "5px 10px",
                            background: "#16a34a",
                            color: "#fff",
                            borderRadius: "4px",
                            border: "none",
                            cursor: "pointer",
                            fontWeight: "bold",
                            fontSize: "0.75rem",
                          }}
                        >
                          Mark as Handled
                        </button>
                      </div>
                    );
                  } else if (item.notification_type === "Overrun Warning") {

                    const details = [];
                    if (payload.estimatedReleaseAt) {
                      const estTime = new Date(payload.estimatedReleaseAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                      details.push(`Dự kiến trống: ${estTime}`);
                    }
                    if (payload.nextReservationAt) {
                      const nextTime = new Date(payload.nextReservationAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                      details.push(`Đặt tiếp theo: ${nextTime} (#${payload.nextReservationId})`);
                    }

                    itemContent = (
                      <div
                        className="notification-bell__item is-unread"
                        style={{
                          background: "#fff5f5",
                          borderLeft: "4px solid #ef4444",
                          padding: "12px",
                          cursor: "default",
                        }}
                      >
                        <div className="notification-bell__item-top">
                          <strong style={{ color: "#c53030" }}>⚠️ {item.title}</strong>
                          <span>{formatSentAt(item.sent_at)}</span>
                        </div>
                        <p style={{ margin: "6px 0 8px", color: "#4a5568", fontSize: "0.875rem" }}>
                          {item.message_body}
                        </p>
                        {details.length > 0 && (
                          <ul style={{ margin: "0 0 10px 0", paddingLeft: "16px", fontSize: "0.8rem", color: "#718096" }}>
                            {details.map((d, idx) => <li key={idx}>{d}</li>)}
                          </ul>
                        )}
                        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (payload.tableId) {
                                openTableModal(payload.tableId);
                                setOpen(false);
                              }
                            }}
                            style={{
                              flex: 1,
                              padding: "6px",
                              background: "#ef4444",
                              color: "#fff",
                              borderRadius: "4px",
                              border: "none",
                              cursor: "pointer",
                              fontWeight: "bold",
                              fontSize: "0.8rem",
                            }}
                          >
                            View Table Details
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (item._live) {
                                setNotifications((prev) =>
                                  prev.filter((row) => row.notification_id !== item.notification_id)
                                );
                              } else {
                                try {
                                  await markNotificationRead(userId, item.notification_id);
                                  setNotifications((prev) =>
                                    prev.filter((row) => row.notification_id !== item.notification_id)
                                  );
                                } catch (err) {
                                  toast.error("Could not mark as handled");
                                }
                              }
                            }}
                            style={{
                              flex: 1,
                              padding: "6px",
                              background: "#fff",
                              color: "#4a5568",
                              borderRadius: "4px",
                              border: "1px solid #cbd5e0",
                              cursor: "pointer",
                              fontWeight: "bold",
                              fontSize: "0.8rem",
                            }}
                          >
                            Mark as Handled
                          </button>
                        </div>
                      </div>
                    );
                  } else {
                    const details = buildDetailLines(item, payload);
                    itemContent = (
                      <div
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
                  }

                  return (
                    <motion.div
                      key={item.notification_id || item.id}
                      initial={isReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0, x: -20 }}
                      animate={{ opacity: 1, height: "auto", x: 0 }}
                      exit={isReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0, x: -100 }}
                      transition={isReducedMotion ? { duration: 0.1 } : { type: "spring", stiffness: 450, damping: 28 }}
                      style={{ overflow: "hidden" }}
                    >
                      {itemContent}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default NotificationBell;
