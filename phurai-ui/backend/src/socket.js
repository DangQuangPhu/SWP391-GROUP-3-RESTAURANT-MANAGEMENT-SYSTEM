import { Server } from "socket.io";

let io = null;

import pool from "./db.js";

// Role mapping: 1=Customer, 2=Restaurant Staff, 4=Manager, 5=Admin
// role_id=3 (Kitchen Staff) is DEPRECATED — KDS is device-based, not account-based.
// KDS devices authenticate via their own KDS JWT and join room:kds independently.
const STAFF_ROLE_IDS = new Set([2, 3, 4]);
const CUSTOMER_ROLE_ID = 1;

/**
 * Attach Socket.IO to the HTTP server.
 * Clients authenticate via handshake.auth: { userId, roleId, sessionId? }
 */
export function initSocket(httpServer, { allowedOrigins = [] } = {}) {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => callback(null, true),
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", async (socket) => {
    const auth = socket.handshake.auth || {};
    const userId = Number(auth.userId);
    const roleId = Number(auth.roleId);
    const sessionId = Number(auth.sessionId);

    // Join manager room
    if (roleId === 3 || roleId === 4) {
      socket.join("room:manager");
    }

    // Restaurant Staff (role 2) → room:restaurant_staff + room:staff
    if (roleId === 2) {
      socket.join("room:restaurant_staff");
      socket.join("room:staff");
    }
    // NOTE: KDS devices (role_id=3 deprecated) join room:kds via their own
    // device-token handshake, handled separately in the KDS activate flow.

    // Shift-specific rooms logic removed (no shifts)

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
