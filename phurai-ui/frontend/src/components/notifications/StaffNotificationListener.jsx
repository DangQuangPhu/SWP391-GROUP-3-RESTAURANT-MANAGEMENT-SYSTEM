import React, { useEffect } from "react";
import { useSocket } from "@/core/socket/SocketContext.jsx";
import { useAuth } from "@/features/auth/context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { apiPatch } from "@/core/api/httpClient.js";

export default function StaffNotificationListener({ user, isAuthenticated }) {
  const { socket } = useSocket();
  const { handleSignOut } = useAuth();
  const navigate = useNavigate();

  const roleId = Number(user?.roleId || user?.role_id);
  const isStaffOrManager = isAuthenticated && [2, 3, 4].includes(roleId);

  useEffect(() => {
    if (!socket || !isStaffOrManager) return;

    const handleNewDineInOrder = (data) => {
      if (data?.items?.length > 0) {
        const itemNames = data.items.map(i => `${i.quantity}x ${i.name || 'Item'}`).join(', ');
        toast(`Table ${data.tableName || "Unknown"} just ordered: ${itemNames}!`, {
          icon: "🍽️",
          duration: 8000,
          id: `new-order-${data.tableId}-${Date.now()}`
        });
      }
    };

    socket.on("NEW_DINEIN_ORDER", handleNewDineInOrder);

    const handleRoleChanged = () => {
      alert("Your role has changed. Please log in again.");
      handleSignOut();
    };

    const handleDeactivated = () => {
      alert("Your account has been inactive and you need to report it to your supervisor.");
      handleSignOut();
    };

    const handleForceLogout = ({ reason }) => {
      alert(`System Logout: ${reason || "Your session has been terminated."}`);
      handleSignOut();
    };

    // Phase 2: auth:session_revoked — fired when an admin/manager revokes system access.
    // Uses session_revoked_at timestamp + JWT.iat to invalidate existing tokens server-side.
    // Frontend: clear auth + redirect to Home page.
    const handleSessionRevoked = ({ reason, code } = {}) => {
      handleSignOut();
      toast.error(reason || "Your system access has been revoked. Please contact your manager.", {
        id: "session-revoked",
        duration: 8000,
        icon: "🔒",
      });
      // Redirect to home page (not /staff or /manager — account no longer has access)
      navigate("/", { replace: true });
    };

    // ── Table Overrun Warning ─────────────────────────────────────────────────
    // Fired by cronService.js every 60 seconds when a table is still Occupied
    // past its EstimatedReleaseTime. The notification is sent once per session
    // (overrun_alerted flag prevents duplicate toasts for the same stay).
    const handleTableOverrun = (data) => {
      const {
        tableNumber,
        estimatedReleaseAt,
        nextReservationAt,
        message,
      } = data;

      const releaseTime = estimatedReleaseAt
        ? new Date(estimatedReleaseAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        : '--:--';

      let toastMsg = `⚠️ Table ${tableNumber} overdue since ${releaseTime}.`;
      if (nextReservationAt) {
        const nextTime = new Date(nextReservationAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        toastMsg += ` Next guest at ${nextTime}.`;
      }
      toastMsg += ' Please check and take action.';

      toast.error(toastMsg, {
        id: `overrun-${data.tableId}-${data.sessionId}`,
        duration: 15000, // Persistent enough for staff to notice
        position: 'top-right',
        style: {
          background: '#1a1a2e',
          color: '#ff6b6b',
          border: '1px solid #ff6b6b',
          fontWeight: 500,
          maxWidth: '360px',
        },
      });
    };

    socket.on("table:overrun_warning", handleTableOverrun);

    socket.on("STAFF_ROLE_CHANGED", handleRoleChanged);
    socket.on("STAFF_DEACTIVATED", handleDeactivated);
    socket.on("auth:force_logout", handleForceLogout);
    socket.on("auth:session_revoked", handleSessionRevoked);

    return () => {
      socket.off("NEW_DINEIN_ORDER", handleNewDineInOrder);
      socket.off("STAFF_ROLE_CHANGED", handleRoleChanged);
      socket.off("STAFF_DEACTIVATED", handleDeactivated);
      socket.off("auth:force_logout", handleForceLogout);
      socket.off("auth:session_revoked", handleSessionRevoked);
      socket.off("table:overrun_warning", handleTableOverrun);
    };
  }, [socket, isStaffOrManager, handleSignOut, navigate]);

  return null;
}

