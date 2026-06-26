import React, { useEffect } from "react";
import { useSocket } from "@/core/socket/SocketContext.jsx";
import { useAuth } from "@/features/auth/context/AuthContext.jsx";
import toast from "react-hot-toast";
import { apiPatch } from "@/core/api/httpClient.js";

export default function StaffNotificationListener({ user, isAuthenticated }) {
  const { socket } = useSocket();
  const { handleSignOut } = useAuth();

  const roleId = Number(user?.roleId || user?.role_id);
  const isStaffOrManager = isAuthenticated && [2, 3, 4, 5].includes(roleId);

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

    socket.on("STAFF_ROLE_CHANGED", handleRoleChanged);
    socket.on("STAFF_DEACTIVATED", handleDeactivated);
    socket.on("auth:force_logout", handleForceLogout);

    return () => {
      socket.off("NEW_DINEIN_ORDER", handleNewDineInOrder);
      socket.off("STAFF_ROLE_CHANGED", handleRoleChanged);
      socket.off("STAFF_DEACTIVATED", handleDeactivated);
      socket.off("auth:force_logout", handleForceLogout);
    };
  }, [socket, isStaffOrManager, handleSignOut]);

  return null;
}
