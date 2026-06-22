import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPatch, request } from "@/core/api/httpClient.js";
import { useSocket } from "@/core/socket/SocketContext.jsx";
import { toast } from "react-toastify";

export default function CustomerNotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const { socket } = useSocket();
  const hasToasted = useRef(false);

  const loadNotifications = (showToast = false) => {
    const token = localStorage.getItem("phurai_token") || localStorage.getItem("token");
    if (!token) return;
    
    apiGet("/notifications?limit=5")
      .then((res) => {
        if (res?.success) {
          setNotifications(res.data?.items || []);
          setUnreadCount(res.data?.unread || 0);
          
          if (showToast && res.data?.unread > 0 && !hasToasted.current) {
             toast.info(`You have ${res.data.unread} unread notification(s).`, { autoClose: 5000 });
             hasToasted.current = true;
          }
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadNotifications(true);

    const handleProcessed = (payload) => {
      loadNotifications(false);
      if (payload?.message) {
        toast.info(payload.message, { autoClose: 5000 });
      } else {
        toast.info("A new notification has arrived.", { autoClose: 5000 });
      }
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

  const handleDeleteNotification = async (e, notif) => {
    e.stopPropagation();
    try {
      await request(`/notifications/${notif.notification_id}`, { method: "DELETE", headers: { Authorization: `Bearer ${localStorage.getItem("phurai_token") || localStorage.getItem("token")}` } });
      setNotifications((prev) => prev.filter((n) => n.notification_id !== notif.notification_id));
      if (!notif.is_read) {
         setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (err) {
      console.error("Failed to delete notification", err);
    }
  };

  return (
    <div
      ref={dropdownRef}
      style={{ position: "relative", display: "flex", alignItems: "center" }}
    >
      <style>
        {`
          @keyframes sfx-pulse {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(224, 108, 108, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(224, 108, 108, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(224, 108, 108, 0); }
          }
        `}
      </style>
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
              animation: "sfx-pulse 2s infinite"
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
            width: "320px",
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
                    padding: "10px 12px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    position: "relative",
                    background: notif.is_read ? "transparent" : "rgba(159, 134, 85, 0.1)",
                    borderLeft: notif.is_read ? "2px solid transparent" : "2px solid #bf9a63",
                    transition: "background 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                     e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                     const btn = e.currentTarget.querySelector(".notif-del-btn");
                     if (btn) btn.style.opacity = "1";
                  }}
                  onMouseLeave={(e) => {
                     e.currentTarget.style.background = notif.is_read ? "transparent" : "rgba(159, 134, 85, 0.1)";
                     const btn = e.currentTarget.querySelector(".notif-del-btn");
                     if (btn) btn.style.opacity = "0";
                  }}
                >
                  <button 
                    className="notif-del-btn"
                    onClick={(e) => handleDeleteNotification(e, notif)}
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "8px",
                      background: "none",
                      border: "none",
                      color: "#888",
                      cursor: "pointer",
                      opacity: 0,
                      transition: "opacity 0.2s",
                      padding: "4px"
                    }}
                    title="Delete"
                  >
                    ×
                  </button>
                  <span style={{ color: "#fff", fontSize: "14px", fontWeight: notif.is_read ? "normal" : "bold", paddingRight: "16px" }}>
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
