import React, { useEffect } from "react";
import { useSocket } from "@/core/socket/SocketContext.jsx";
import toast from "react-hot-toast";
import { apiPatch } from "@/core/api/httpClient.js";

export default function StaffNotificationListener({ user, isAuthenticated }) {
  const { socket } = useSocket();

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
    return () => {
      socket.off("NEW_DINEIN_ORDER", handleNewDineInOrder);
    };
  }, [socket, isStaffOrManager]);

  return null;
}
