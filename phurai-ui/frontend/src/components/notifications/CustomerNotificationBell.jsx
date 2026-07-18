import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPatch, request } from "@/core/api/httpClient.js";
import { useSocket } from "@/core/socket/SocketContext.jsx";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
import "@/styles/notifications/CustomerNotificationBell.css";

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, Math.floor((now - then) / 1000));
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function resolveRoute(notif) {
  const type = notif.notification_type;
  if (type === 'Payment Receipt') return '/profile/payments';
  if (type === 'Promotion') return '/profile/loyalty';
  if (type === 'Order Ready') return '/profile/payments';
  if (type === 'Booking Confirmed' || type === 'Booking Rejected' || type === 'Booking Reminder') return '/my-reservations';
  return '/my-reservations';
}

export default function CustomerNotificationBell({ variant = "navbar" }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [readingAll, setReadingAll] = useState(false);
  const [bellRinging, setBellRinging] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const { socket } = useSocket();
  const hasToasted = useRef(false);
  const bellAnimTimer = useRef(null);

  const isProfile = variant === "profile";

  const loadNotifications = useCallback((showToast = false) => {
    const token = localStorage.getItem("phurai_token") || localStorage.getItem("token");
    if (!token) return;
    apiGet("/notifications?limit=20")
      .then((res) => {
        if (res?.success) {
          setNotifications(res.data?.items || []);
          const unread = res.data?.unread || 0;
          setUnreadCount(unread);
          if (unread > 0) {
            setBellRinging(true);
            clearTimeout(bellAnimTimer.current);
            bellAnimTimer.current = setTimeout(() => setBellRinging(false), 1500);
          }
          if (showToast && unread > 0 && !hasToasted.current) {
            toast.info(`You have ${unread} unread notification(s).`, { autoClose: 4000 });
            hasToasted.current = true;
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadNotifications(true);
    const handleProcessed = (payload) => {
      loadNotifications(false);
      if (payload?.message) toast.info(payload.message, { autoClose: 5000 });
      else toast.info("A new notification has arrived.", { autoClose: 5000 });
    };
    if (socket) {
      socket.on("reservation:processed", handleProcessed);
      socket.on("STAFF_ACTION_UPDATE", handleProcessed);
      return () => {
        socket.off("reservation:processed", handleProcessed);
        socket.off("STAFF_ACTION_UPDATE", handleProcessed);
      };
    }
  }, [socket, loadNotifications]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => () => clearTimeout(bellAnimTimer.current), []);

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      try {
        await apiPatch(`/notifications/${notif.notification_id}/read`);
        setUnreadCount((c) => Math.max(0, c - 1));
        setNotifications((prev) =>
          prev.map((n) => n.notification_id === notif.notification_id ? { ...n, is_read: true } : n)
        );
      } catch (err) { console.error("Failed to mark as read", err); }
    }
    setOpen(false);
    navigate(resolveRoute(notif));
  };

  const handleDeleteNotification = async (e, notif) => {
    e.stopPropagation();
    try {
      await request(`/notifications/${notif.notification_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("phurai_token") || localStorage.getItem("token")}` }
      });
      setNotifications((prev) => prev.filter((n) => n.notification_id !== notif.notification_id));
      if (!notif.is_read) setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) { console.error("Failed to delete notification", err); }
  };

  const handleReadAll = async () => {
    if (readingAll || unreadCount === 0) return;
    setReadingAll(true);
    try {
      await apiPatch("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) { console.error("Failed to mark all as read", err); }
    finally { setReadingAll(false); }
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative", display: "flex", alignItems: "center" }}>

      {/* Bell button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={isProfile ? "profile-dashboard__icon-btn" : undefined}
        style={!isProfile ? {
          background: "none", border: "none", cursor: "pointer",
          position: "relative", padding: "8px", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
        } : { position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}
        aria-label="Notifications"
      >
        <svg
          className={`notification-bell-icon stroke-current ${isProfile ? "" : "w-6 h-6"} ${bellRinging && unreadCount > 0 && !open ? "has-promotion" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={isProfile ? { width: "18px", height: "18px" } : undefined}
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: "absolute",
            top: isProfile ? "2px" : "0px",
            right: isProfile ? "2px" : "0px",
            background: "#e06c6c", color: "#fff",
            fontSize: "10px", fontWeight: "bold",
            borderRadius: "50%", width: "16px", height: "16px",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "sfx-pulse 2s infinite"
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown with Apple spring animation */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            style={{
              position: "absolute",
              top: "calc(100% + 10px)",
              right: 0,
              width: "340px",
              background: "#ffffff",
              border: "1px solid rgba(140, 118, 75, 0.18)",
              borderRadius: "16px",
              zIndex: 1000,
              boxShadow: "0 12px 36px rgba(140, 118, 75, 0.12)",
              overflow: "hidden"
            }}
          >
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 16px 10px",
              borderBottom: "1px solid rgba(140, 118, 75, 0.08)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "#2d251a", fontSize: "15px", fontWeight: 700 }}>Notifications</span>
                {unreadCount > 0 && (
                  <span style={{
                    background: "#e06c6c", color: "#fff", fontSize: "10px",
                    fontWeight: "bold", borderRadius: "99px", padding: "1px 7px"
                  }}>
                    {unreadCount} new
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleReadAll}
                  disabled={readingAll}
                  style={{
                    background: "none", border: "1px solid rgba(140, 118, 75, 0.25)",
                    color: readingAll ? "#a3998e" : "#8c764b",
                    fontSize: "11px", fontWeight: 600,
                    padding: "4px 10px", borderRadius: "6px",
                    cursor: readingAll ? "not-allowed" : "pointer",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    if (!readingAll) {
                      e.currentTarget.style.background = "rgba(140, 118, 75, 0.08)";
                      e.currentTarget.style.borderColor = "#8c764b";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "none";
                    e.currentTarget.style.borderColor = "rgba(140, 118, 75, 0.25)";
                  }}
                >
                  {readingAll ? 'Marking...' : 'Read All'}
                </button>
              )}
            </div>

            {/* Notification list */}
            <div style={{ maxHeight: "360px", overflowY: "auto", padding: "8px" }}>
              {notifications.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {notifications.map((notif, idx) => (
                    <motion.div
                      key={notif.notification_id}
                      onClick={() => handleNotificationClick(notif)}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: "spring", stiffness: 350, damping: 30, delay: idx * 0.025 }}
                      style={{
                        display: "flex", flexDirection: "column",
                        padding: "10px 12px", borderRadius: "10px",
                        cursor: "pointer", position: "relative",
                        background: notif.is_read ? "transparent" : "rgba(140, 118, 75, 0.05)",
                        borderLeft: notif.is_read ? "2px solid transparent" : "2px solid #8c764b",
                        transition: "background 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = notif.is_read ? "rgba(140, 118, 75, 0.04)" : "rgba(140, 118, 75, 0.09)";
                        const btn = e.currentTarget.querySelector(".notif-del-btn");
                        if (btn) btn.style.opacity = "1";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = notif.is_read ? "transparent" : "rgba(140, 118, 75, 0.05)";
                        const btn = e.currentTarget.querySelector(".notif-del-btn");
                        if (btn) btn.style.opacity = "0";
                      }}
                    >
                      <button
                        className="notif-del-btn"
                        onClick={(e) => handleDeleteNotification(e, notif)}
                        style={{
                          position: "absolute", top: "8px", right: "8px",
                          background: "none", border: "none",
                          color: "#a89e90", cursor: "pointer",
                          opacity: 0, transition: "opacity 0.2s", padding: "4px",
                          fontSize: "14px", lineHeight: 1
                        }}
                        title="Delete"
                      >
                        ×
                      </button>
                      <span style={{ color: "#2d251a", fontSize: "13px", fontWeight: notif.is_read ? 500 : 700, paddingRight: "20px" }}>
                        {notif.title}
                      </span>
                      <span style={{ color: "#5c5346", fontSize: "12px", marginTop: "3px", lineHeight: 1.4 }}>
                        {notif.message_body}
                      </span>
                      <span style={{ color: "#a89e90", fontSize: "10px", marginTop: "5px" }}>
                        {timeAgo(notif.sent_at)}
                      </span>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "#a89e90", fontSize: "13px", textAlign: "center", padding: "20px 0", margin: 0 }}>
                  No notifications yet
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


