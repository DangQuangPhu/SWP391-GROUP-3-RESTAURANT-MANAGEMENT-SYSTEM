import { Server } from "socket.io";

let io = null;

import pool from "./db.js";

// Role mapping: 1=Customer, 2=Restaurant Staff, 4=Manager, 5=Admin
// role_id=3 (Kitchen Staff) is DEPRECATED — KDS is device-based, not account-based.
// KDS devices authenticate via their own KDS JWT and join room:kds independently.
const STAFF_ROLE_IDS = new Set([2, 4, 5]); // role 3 removed
const CUSTOMER_ROLE_ID = 1;

/**
 * Attach Socket.IO to the HTTP server.
 * Clients authenticate via handshake.auth: { userId, roleId, sessionId? }
 */
export function initSocket(httpServer, { allowedOrigins = [] } = {}) {
  const corsOrigin = allowedOrigins.length > 0 ? allowedOrigins : "*";
  io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      credentials: true,
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

    // Restaurant Staff (role 2) → room:restaurant_staff + room:staff
    if (roleId === 2) {
      socket.join("room:restaurant_staff");
      socket.join("room:staff");
    }
    // NOTE: KDS devices (role_id=3 deprecated) join room:kds via their own
    // device-token handshake, handled separately in the KDS activate flow.

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

    if (Number.isFinite(userId) && userId > 0) {
      socket.join(`user_${userId}`);
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
