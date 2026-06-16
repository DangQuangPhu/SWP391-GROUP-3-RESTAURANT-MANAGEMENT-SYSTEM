import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPatch } from "@/core/api/httpClient.js";
import { useSocket } from "@/core/socket/SocketContext.jsx";

export default function CustomerNotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const { socket } = useSocket();

  const loadNotifications = () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    
    apiGet("/notifications?limit=5")
      .then((res) => {
        if (res?.success) {
          setNotifications(res.data?.items || []);
          setUnreadCount(res.data?.unread || 0);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadNotifications();

    const handleProcessed = () => {
      loadNotifications();
    };

    if (socket) {
      socket.on("reservation:processed", handleProcessed);
      socket.on("STAFF_ACTION_UPDATE", handleProcessed);
      return () => {
        socket.off("reservation:processed", handleProcessed);
        socket.off("STAFF_ACTION_UPDATE", handleProcessed);
      };
    }
  }, [socket]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      try {
        await apiPatch(`/notifications/${notif.notification_id}/read`);
        setUnreadCount((c) => Math.max(0, c - 1));
        setNotifications((prev) =>
          prev.map((n) =>
            n.notification_id === notif.notification_id
              ? { ...n, is_read: true }
              : n
          )
        );
      } catch (err) {
        console.error("Failed to mark as read", err);
      }
    }
    setOpen(false);
    navigate("/my-reservations");
  };

  return (
    <div
      ref={dropdownRef}
      style={{ position: "relative", display: "flex", alignItems: "center" }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          position: "relative",
          padding: "8px",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        aria-label="Notifications"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "0px",
              right: "0px",
              background: "#e06c6c",
              color: "#fff",
              fontSize: "10px",
              fontWeight: "bold",
              borderRadius: "50%",
              width: "16px",
              height: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            width: "300px",
            background: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: "8px",
            padding: "16px",
            zIndex: 1000,
            boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
          }}
        >
          <h4
            style={{
              color: "#fff",
              margin: "0 0 12px 0",
              fontSize: "16px",
              borderBottom: "1px solid #333",
              paddingBottom: "8px",
            }}
          >
            Notifications
          </h4>
          {notifications.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {notifications.map((notif) => (
                <div
                  key={notif.notification_id}
                  onClick={() => handleNotificationClick(notif)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    padding: "8px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    background: notif.is_read ? "transparent" : "rgba(159, 134, 85, 0.1)",
                    borderLeft: notif.is_read ? "2px solid transparent" : "2px solid #bf9a63",
                    transition: "background 0.2s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = notif.is_read ? "transparent" : "rgba(159, 134, 85, 0.1)")}
                >
                  <span style={{ color: "#fff", fontSize: "14px", fontWeight: notif.is_read ? "normal" : "bold" }}>
                    {notif.title}
                  </span>
                  <span style={{ color: "#aaa", fontSize: "12px", marginTop: "4px" }}>
                    {notif.message_body}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "#666", fontSize: "14px", margin: 0 }}>No new notifications</p>
          )}
        </div>
      )}
    </div>
  );
}
