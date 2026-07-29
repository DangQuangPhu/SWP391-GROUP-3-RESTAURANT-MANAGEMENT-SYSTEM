import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "@/core/socket/SocketContext.jsx";
import { appToastSuccess, appToastClickableSuccess } from "@/core/notifications/appToast.js";
import { apiGet, apiPatch, getAuthToken } from "@/core/api/httpClient.js";

function isCustomerUser(user) {
  const roleId = Number(user?.roleId ?? user?.role_id);
  if (roleId === 1) return true;
  const role = String(user?.roleName ?? user?.role_name ?? user?.role ?? "")
    .trim()
    .toLowerCase();
  return role === "customer";
}

/**
 * Listens for staff-driven updates and shows customer-facing toasts.
 * Mount inside SocketProvider for authenticated customers.
 */
export default function CustomerNotificationListener({ user, isAuthenticated }) {
  const { socket } = useSocket();
  const navigate = useNavigate();

  // Fetch unread notifications on mount
  useEffect(() => {
    const token = getAuthToken();
    if (!token || !isAuthenticated || !isCustomerUser(user)) return;
    apiGet("/notifications?limit=10")
      .then((res) => {
        if (res?.success && res.data?.unread > 0) {
          const unreadBooking = res.data.items.find(n => !n.is_read && n.notification_type === 'Booking Confirmed');
          if (unreadBooking) {
            appToastClickableSuccess(unreadBooking.message_body || "Your reservation has been successfully processed.", () => {
              apiPatch(`/notifications/${unreadBooking.notification_id}/read`).catch(() => {});
              navigate("/my-reservations");
            });
          }
        }
      })
      .catch(() => {});
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token || !socket || !isAuthenticated || !isCustomerUser(user)) {
      return undefined;
    }

    const handleStaffUpdate = (payload = {}) => {
      const message =
        payload.message ||
        payload.title ||
        "Your restaurant visit has been updated.";
      appToastSuccess(message);
    };

    const handleProcessed = (payload = {}) => {
      appToastClickableSuccess(
        payload.message || "Your reservation has been successfully processed.",
        () => navigate("/my-reservations")
      );
    };

    socket.on("STAFF_ACTION_UPDATE", handleStaffUpdate);
    socket.on("reservation:processed", handleProcessed);
    
    return () => {
      socket.off("STAFF_ACTION_UPDATE", handleStaffUpdate);
      socket.off("reservation:processed", handleProcessed);
    };
  }, [socket, user, isAuthenticated, navigate]);

  return null;
}
