import { Server } from "socket.io";

let io = null;

import pool from "./db.js";

const STAFF_ROLE_IDS = new Set([2, 3, 4, 5]);
const CUSTOMER_ROLE_ID = 1;
const MANAGER_ROLE_ID = 4; // Based on PRD Manager role context, or we can just check if role === "Manager" in db, but we don't have role name here. PRD says user_id 2 is Manager.
// Actually, let's just query user role if needed, or trust the roleId mapping.
// According to PRD: Role 1 Customer, 2 Restaurant Staff, 3 Kitchen Staff, 4 Manager, 5 Admin
const RESTAURANT_STAFF_ROLE_ID = 2;

/**
 * Attach Socket.IO to the HTTP server.
 * Clients authenticate via handshake.auth: { userId, roleId, sessionId? }
 */
export function initSocket(httpServer, { allowedOrigins = [] } = {}) {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    },
  });

  io.on("connection", async (socket) => {
    const auth = socket.handshake.auth || {};
    const userId = Number(auth.userId);
    const roleId = Number(auth.roleId);
    const sessionId = Number(auth.sessionId);

    // Join manager room
    if (roleId === 4 || roleId === 5) {
      socket.join("room:manager");
    }

    // Kitchen Staff (role 3) → room:kitchen (dedicated KDS room)
    if (roleId === 3) {
      socket.join("room:kitchen");
      socket.join("room:staff"); // also join general staff room for shared events
    }

    // Restaurant Staff (role 2) → room:restaurant_staff + room:staff
    if (roleId === 2) {
      socket.join("room:restaurant_staff");
      socket.join("room:staff");
    }

    // All staff with shifts → shift-specific rooms
    if (STAFF_ROLE_IDS.has(roleId)) {
      if (Number.isFinite(userId) && userId > 0) {
        try {
          const today = new Date().toISOString().split('T')[0];
          const [schedule] = await pool.query(
            `SELECT shift_id FROM dbo.StaffSchedules
             WHERE user_id = ?
               AND work_date = ?
               AND attendance_status IN (N'Scheduled', N'Present')`,
            [userId, today]
          );
          
          if (schedule && schedule.length > 0) {
            schedule.forEach(row => {
              if (row.shift_id) {
                socket.join(`room:shift:${row.shift_id}`);
              }
            });
          }
        } catch (error) {
          console.error("Socket shift query error:", error);
        }
      }
    }

    if (roleId === CUSTOMER_ROLE_ID && Number.isFinite(userId) && userId > 0) {
      socket.join(`customer_${userId}`);
    }

    if (Number.isFinite(sessionId) && sessionId > 0) {
      socket.join(`session_${sessionId}`);
    }

    socket.on("disconnect", () => {
      /* rooms are cleaned up automatically */
    });
  });

  return io;
}

export function getIO() {
  return io;
}
