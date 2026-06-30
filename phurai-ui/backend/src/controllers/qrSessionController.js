import pool, { createDbRequest } from "../db.js";
import sql from "mssql";

const SESSION_SELECT = `
  SELECT TOP 1
    qs.qr_session_id AS session_id,
    qs.table_id,
    qs.token,
    qs.session_status,
    qs.expires_at,
    qs.customer_id,
    t.table_number,
    t.static_qr_code,
    a.area_name
  FROM dbo.QROrderSessions AS qs
  INNER JOIN dbo.RestaurantTables AS t ON qs.table_id = t.table_id
  LEFT JOIN dbo.RestaurantAreas AS a ON t.area_id = a.area_id
`;

function mapSessionRow(row) {
  if (!row) return null;

  return {
    session_id: row.session_id,
    table_id: row.table_id,
    token: row.token,
    session_status: row.session_status,
    expires_at: row.expires_at,
    customer_id: row.customer_id,
    table_number: row.table_number,
    static_qr_code: row.static_qr_code,
    area_name: row.area_name ?? null,
  };
}

/**
 * GET /api/customer/qr-sessions/active
 * Returns the logged-in customer's active dine-in QR session, if any.
 */
export async function getActiveSession(req, res) {
  try {
    const userId = req.userId;

    const [rows] = await pool.query(
      `${SESSION_SELECT}
       WHERE qs.customer_id = ?
         AND qs.session_status = N'Active'
         AND (qs.expires_at IS NULL OR qs.expires_at > SYSUTCDATETIME())
       ORDER BY qs.generated_at DESC;`,
      [userId]
    );

    const session = mapSessionRow(rows[0]) ?? null;

    return res.json({
      success: true,
      hasActiveSession: Boolean(session),
      session,
    });
  } catch (error) {
    console.error("getActiveSession failed:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load active table session.",
    });
  }
}

/**
 * GET /api/customer/qr-sessions/validate?table_id=&session_id=
 * Confirms a table/session pair is active (QR scan or deep link).
 */
export async function validateSession(req, res) {
  try {
    const tableId = Number(req.query.table_id);
    const sessionId = Number(req.query.session_id);

    if (!Number.isFinite(tableId) || tableId <= 0 || !Number.isFinite(sessionId) || sessionId <= 0) {
      return res.status(400).json({
        success: false,
        message: "table_id and session_id are required.",
      });
    }

    const [rows] = await pool.query(
      `${SESSION_SELECT}
       WHERE qs.qr_session_id = ?
         AND qs.table_id = ?
         AND qs.session_status = N'Active'
         AND (qs.expires_at IS NULL OR qs.expires_at > SYSUTCDATETIME());`,
      [sessionId, tableId]
    );

    const session = mapSessionRow(rows[0]);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "This table session is not active or has expired.",
      });
    }

    return res.json({
      success: true,
      session,
    });
  } catch (error) {
    console.error("validateSession failed:", error);
    return res.status(500).json({
      success: false,
      message: "Could not validate table session.",
    });
  }
}

/**
 * POST /api/customer/qr-sessions/scan
 * Body: { table_id }
 * Resolves static QR scan, applying merged table rules and counter restrictions.
 */
export async function scanStaticQr(req, res) {
  try {
    const tableId = Number(req.body.table_id);
    if (!Number.isFinite(tableId) || tableId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid table ID." });
    }

    // 1. Fetch table details
    const [tables] = await pool.query(`
      SELECT table_id, is_counter, table_status, merged_into_table_id 
      FROM dbo.RestaurantTables 
      WHERE table_id = ?
    `, [tableId]);

    if (!tables || tables.length === 0) {
      return res.status(404).json({ success: false, message: "Table not found." });
    }

    const table = tables[0];

    // Rule 1: No QR for counter tables
    if (table.is_counter === true || table.is_counter === 1) {
      return res.status(403).json({ success: false, message: "Counter tables do not support QR ordering." });
    }

    if (table.table_status === 'Reserved' || table.table_status === 'Cleaning') {
      return res.status(403).json({ success: false, message: "Table is not ready or is currently reserved. Please contact staff." });
    }

    // Rule 1: Table must be Occupied or Available
    if (table.table_status !== 'Occupied' && table.table_status !== 'Available') {
      return res.status(403).json({ success: false, message: "Table is not available. Please contact staff to check in." });
    }

    // Rule 1: Resolve merged table
    const resolvedTableId = table.merged_into_table_id ? table.merged_into_table_id : table.table_id;

    let session = null;

    if (table.table_status === 'Available') {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        const crypto = await import('crypto');
        const token = crypto.randomBytes(32).toString('hex');

        // 1. Create an Active Session
        const insertResult = await conn.query(`
          INSERT INTO dbo.QROrderSessions (table_id, scanned_table_id, token, session_status, generated_at)
          OUTPUT INSERTED.qr_session_id
          VALUES (?, ?, ?, N'Active', SYSUTCDATETIME())
        `, [resolvedTableId, tableId, token]);

        const newSessionId = insertResult[0][0].qr_session_id;

        // 2. Update Table to Occupied
        await conn.query(`
          UPDATE dbo.RestaurantTables 
          SET table_status = N'Occupied', updated_at = SYSUTCDATETIME()
          WHERE table_id = ?
        `, [resolvedTableId]);

        await conn.commit();

        const [newSessions] = await pool.query(
          `${SESSION_SELECT} WHERE qs.qr_session_id = ?`,
          [newSessionId]
        );
        session = mapSessionRow(newSessions[0]);

        // Emit Socket.IO event to staff
        const io = req.app.get("io");
        if (io) {
          io.to("room:manager").to("room:staff").emit("table:status_changed", { tableId: resolvedTableId, status: 'Occupied' });
          io.to("room:manager").to("room:staff").emit("table:sync", { action: "update", table_id: resolvedTableId });
        }

        return res.json({
          success: true,
          message: "Session activated. Table is now occupied.",
          session,
          resolved_table_id: resolvedTableId,
          was_merged: !!table.merged_into_table_id
        });
      } catch (error) {
        await conn.rollback();
        throw error;
      } finally {
        conn.release();
      }
    }

    // If Occupied, Find existing active session
    const [existingSessions] = await pool.query(
      `${SESSION_SELECT}
       WHERE qs.table_id = ?
         AND qs.session_status = N'Active'
         AND (qs.expires_at IS NULL OR qs.expires_at > SYSUTCDATETIME())
       ORDER BY qs.generated_at DESC;`,
      [resolvedTableId]
    );

    session = mapSessionRow(existingSessions[0]);

    // 3. If no session exists, generate one
    if (!session) {
      const crypto = await import('crypto');
      const token = crypto.randomBytes(32).toString('hex');

      // Check for an active reservation
      const [resRows] = await pool.query(
        `SELECT TOP 1 r.reservation_id, r.customer_id
         FROM dbo.ReservationTables rt
         JOIN dbo.Reservations r ON rt.reservation_id = r.reservation_id
         WHERE rt.table_id = ? AND r.reservation_status IN (N'Check-in', N'Dining')
         ORDER BY r.reservation_id DESC`,
        [resolvedTableId]
      );

      const reservationId = resRows.length > 0 ? resRows[0].reservation_id : null;
      const customerId = resRows.length > 0 ? resRows[0].customer_id : null;

      const insertResult = await pool.query(`
        INSERT INTO dbo.QROrderSessions (table_id, scanned_table_id, token, session_status, generated_at, reservation_id, customer_id)
        OUTPUT INSERTED.qr_session_id
        VALUES (?, ?, ?, N'Active', SYSUTCDATETIME(), ?, ?)
      `, [resolvedTableId, tableId, token, reservationId, customerId]);

      const newSessionId = insertResult[0][0].qr_session_id;

      const [newSessions] = await pool.query(
        `${SESSION_SELECT} WHERE qs.qr_session_id = ?`,
        [newSessionId]
      );
      session = mapSessionRow(newSessions[0]);
    }

    return res.json({
      success: true,
      message: table.merged_into_table_id ? "Redirected to primary merged table." : "Session loaded.",
      session,
      resolved_table_id: resolvedTableId,
      was_merged: !!table.merged_into_table_id
    });
  } catch (error) {
    console.error("scanStaticQr failed:", error);
    return res.status(500).json({ success: false, message: "Could not process QR scan." });
  }
}

/**
 * GET /api/customer/qr-sessions/scan/:qr_code
 * Resolves static QR code from URL, applying merged table rules and counter restrictions.
 */
export async function scanStaticQrCodeUrl(req, res) {
  try {
    const qrCode = req.params.qr_code;
    console.log(`\n\n[QR SCAN RECV] 📲 Someone scanned table QR: ${qrCode}`);

    if (!qrCode || typeof qrCode !== 'string') {
      return res.status(400).json({ success: false, message: "Invalid QR Code." });
    }

    // 1. Fetch table details by QR Code
    const [tables] = await pool.query(`
      SELECT table_id, is_counter, table_status, merged_into_table_id 
      FROM dbo.RestaurantTables 
      WHERE static_qr_code = ?
    `, [qrCode]);

    if (!tables || tables.length === 0) {
      return res.status(404).json({ success: false, message: "Table not found or invalid QR code." });
    }

    const table = tables[0];
    const tableId = table.table_id;

    // Rule 1: No QR for counter tables
    if (table.is_counter === true || table.is_counter === 1) {
      return res.status(403).json({ success: false, message: "Counter tables do not support QR ordering." });
    }

    if (table.table_status === 'Reserved' || table.table_status === 'Cleaning') {
      return res.status(403).json({ success: false, message: "Table is not ready or is currently reserved. Please contact staff." });
    }

    // Rule 1: Table must be Occupied or Available
    if (table.table_status !== 'Occupied' && table.table_status !== 'Available') {
      return res.status(403).json({ success: false, message: "Table is not available. Please contact staff." });
    }

    // Rule 1: Resolve merged table
    const resolvedTableId = table.merged_into_table_id ? table.merged_into_table_id : table.table_id;

    let session = null;

    if (table.table_status === 'Available') {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        const crypto = await import('crypto');
        const token = crypto.randomBytes(32).toString('hex');

        // 1. Create an Active Session
        const insertResult = await conn.query(`
          INSERT INTO dbo.QROrderSessions (table_id, scanned_table_id, token, session_status, generated_at)
          OUTPUT INSERTED.qr_session_id
          VALUES (?, ?, ?, N'Active', SYSUTCDATETIME())
        `, [resolvedTableId, tableId, token]);

        const newSessionId = insertResult[0][0].qr_session_id;

        // 2. Update Table to Occupied
        await conn.query(`
          UPDATE dbo.RestaurantTables 
          SET table_status = N'Occupied', updated_at = SYSUTCDATETIME()
          WHERE table_id = ?
        `, [resolvedTableId]);

        await conn.commit();

        const [newSessions] = await pool.query(
          `${SESSION_SELECT} WHERE qs.qr_session_id = ?`,
          [newSessionId]
        );
        session = mapSessionRow(newSessions[0]);

        // Emit Socket.IO event to staff
        const io = req.app.get("io");
        if (io) {
          io.to("room:manager").to("room:staff").emit("table:status_changed", { tableId: resolvedTableId, status: 'Occupied' });
          io.to("room:manager").to("room:staff").emit("table:sync", { action: "update", table_id: resolvedTableId });
        }

        return res.json({
          success: true,
          message: "Session activated. Table is now occupied.",
          session,
          resolved_table_id: resolvedTableId,
          was_merged: !!table.merged_into_table_id
        });
      } catch (error) {
        await conn.rollback();
        throw error;
      } finally {
        conn.release();
      }
    }

    // If Occupied, Find existing active session
    const [existingSessions] = await pool.query(
      `${SESSION_SELECT}
       WHERE qs.table_id = ?
         AND qs.session_status = N'Active'
         AND (qs.expires_at IS NULL OR qs.expires_at > SYSUTCDATETIME())
       ORDER BY qs.generated_at DESC;`,
      [resolvedTableId]
    );

    session = mapSessionRow(existingSessions[0]);

    // 3. If no session exists, generate one
    if (!session) {
      const crypto = await import('crypto');
      const token = crypto.randomBytes(32).toString('hex');

      // Check for an active reservation
      const [resRows] = await pool.query(
        `SELECT TOP 1 r.reservation_id, r.customer_id
         FROM dbo.ReservationTables rt
         JOIN dbo.Reservations r ON rt.reservation_id = r.reservation_id
         WHERE rt.table_id = ? AND r.reservation_status IN (N'Check-in', N'Dining')
         ORDER BY r.reservation_id DESC`,
        [resolvedTableId]
      );

      const reservationId = resRows.length > 0 ? resRows[0].reservation_id : null;
      const customerId = resRows.length > 0 ? resRows[0].customer_id : null;

      const insertResult = await pool.query(`
        INSERT INTO dbo.QROrderSessions (table_id, scanned_table_id, token, session_status, generated_at, reservation_id, customer_id)
        OUTPUT INSERTED.qr_session_id
        VALUES (?, ?, ?, N'Active', SYSUTCDATETIME(), ?, ?)
      `, [resolvedTableId, tableId, token, reservationId, customerId]);

      const newSessionId = insertResult[0][0].qr_session_id;

      const [newSessions] = await pool.query(
        `${SESSION_SELECT} WHERE qs.qr_session_id = ?`,
        [newSessionId]
      );
      session = mapSessionRow(newSessions[0]);
    }

    return res.json({
      success: true,
      message: table.merged_into_table_id ? "Redirected to primary merged table." : "Session loaded.",
      session,
      resolved_table_id: resolvedTableId,
      was_merged: !!table.merged_into_table_id
    });
  } catch (error) {
    console.error("scanStaticQrCodeUrl failed:", error);
    return res.status(500).json({ success: false, message: "Could not process QR scan." });
  }
}

/**
 * PATCH /api/sessions/:id/approve
 * Staff/Manager approves a pending QR session.
 * Updates session to Active, table to Occupied, and emits Socket.IO event.
 */
export async function approveQrSession(req, res) {
  let conn;
  let transactionStarted = false;
  let transactionCommitted = false;

  try {
    conn = await pool.getConnection();
    const sessionId = Number(req.params.id);
    if (!Number.isFinite(sessionId) || sessionId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid session ID." });
    }

    await conn.beginTransaction();
    transactionStarted = true;

    // 1. Verify session is Pending
    const [sessions] = await conn.query(
      `SELECT table_id, session_status 
       FROM dbo.QROrderSessions WITH (UPDLOCK)
       WHERE qr_session_id = ?`,
      [sessionId]
    );

    if (!sessions || sessions.length === 0) {
      await conn.rollback();
      transactionStarted = false;
      return res.status(404).json({ success: false, message: "Session not found." });
    }

    if (sessions[0].session_status !== 'Pending') {
      await conn.rollback();
      transactionStarted = false;
      return res.status(400).json({ success: false, message: "Session is not pending approval." });
    }

    const tableId = sessions[0].table_id;

    // 2. Update Table to Occupied
    await conn.query(
      `UPDATE dbo.RestaurantTables 
       SET table_status = N'Occupied', updated_at = SYSUTCDATETIME() 
       WHERE table_id = ?`,
      [tableId]
    );

    // 3. Update Session to Active
    await conn.query(
      `UPDATE dbo.QROrderSessions 
       SET session_status = N'Active' 
       WHERE qr_session_id = ?`,
      [sessionId]
    );

    await conn.commit();
    transactionCommitted = true;
    transactionStarted = false;

    // 4. Emit to Customer & Staff
    try {
      const io = req.app?.get?.("io");
      if (io) {
        const payload = { session_id: sessionId, qr_session_id: sessionId, table_id: tableId };
        io.emit("QR_SESSION_APPROVED", payload);
        io.to(`session_${sessionId}`).emit("SESSION_APPROVED", payload);
        io.to(`session_${sessionId}`).emit("QR_SESSION_APPROVED", payload);
        io.to("room:manager").to("room:staff").emit("table:sync", { action: "update", table_id: tableId });
      } else {
        console.warn("[QR APPROVE] Socket.IO instance not found; DB update already committed.", { sessionId, tableId });
      }
    } catch (socketError) {
      console.error("[QR APPROVE] Socket emit failed after commit:", socketError);
    }

    return res.json({ success: true, message: "Session approved." });
  } catch (error) {
    if (conn && transactionStarted && !transactionCommitted) {
      try {
        await conn.rollback();
      } catch (rollbackError) {
        console.error("[QR APPROVE] Rollback failed:", rollbackError);
      }
    }
    console.error("🔥 BACKEND CRASH IN APPROVE API:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  } finally {
    conn?.release?.();
  }
}

/**
 * PATCH /api/sessions/:id/reject
 * Staff/Manager rejects a pending QR session.
 * Updates session to Closed, and emits Socket.IO event.
 */
export async function rejectQrSession(req, res) {
  let conn;
  let transactionStarted = false;
  let transactionCommitted = false;

  try {
    conn = await pool.getConnection();
    const sessionId = Number(req.params.id);
    if (!Number.isFinite(sessionId) || sessionId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid session ID." });
    }

    await conn.beginTransaction();
    transactionStarted = true;

    const [sessions] = await conn.query(
      `SELECT table_id, session_status 
       FROM dbo.QROrderSessions WITH (UPDLOCK)
       WHERE qr_session_id = ?`,
      [sessionId]
    );

    if (!sessions || sessions.length === 0) {
      await conn.rollback();
      transactionStarted = false;
      return res.status(404).json({ success: false, message: "Session not found." });
    }

    if (sessions[0].session_status !== 'Pending') {
      await conn.rollback();
      transactionStarted = false;
      return res.status(400).json({ success: false, message: "Session is not pending approval." });
    }

    const tableId = sessions[0].table_id;

    await conn.query(
      `UPDATE dbo.QROrderSessions 
       SET session_status = N'Closed', expires_at = SYSUTCDATETIME()
       WHERE qr_session_id = ?`,
      [sessionId]
    );

    await conn.commit();
    transactionCommitted = true;
    transactionStarted = false;

    try {
      const io = req.app?.get?.("io");
      if (io) {
        const payload = { session_id: sessionId, qr_session_id: sessionId, table_id: tableId };
        io.emit("QR_SESSION_REJECTED", payload);
        io.to(`session_${sessionId}`).emit("SESSION_REJECTED", payload);
        io.to(`session_${sessionId}`).emit("QR_SESSION_REJECTED", payload);
        io.to("room:manager").to("room:staff").emit("table:sync", { action: "update", table_id: tableId });
      } else {
        console.warn("[QR REJECT] Socket.IO instance not found; DB update already committed.", { sessionId, tableId });
      }
    } catch (socketError) {
      console.error("[QR REJECT] Socket emit failed after commit:", socketError);
    }

    return res.json({ success: true, message: "Session rejected." });
  } catch (error) {
    if (conn && transactionStarted && !transactionCommitted) {
      try {
        await conn.rollback();
      } catch (rollbackError) {
        console.error("[QR REJECT] Rollback failed:", rollbackError);
      }
    }
    console.error("🔥 BACKEND CRASH IN REJECT API:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  } finally {
    conn?.release?.();
  }
}

/**
 * POST /api/public/qr-order/submit
 * Public endpoint for QR Dine-in Guests.
 */
export async function submitQrOrderPublic(req, res) {
  const conn = await pool.getConnection();
  try {
    const { sessionId, cartItems } = req.body;

    if (!sessionId || !cartItems || !cartItems.length) {
      return res.status(400).json({ success: false, message: "Invalid session or empty cart." });
    }

    await conn.beginTransaction();

    // 1. Verify session is Active
    const [sessions] = await conn.query(
      `SELECT qs.table_id, qs.session_status, t.table_number 
       FROM dbo.QROrderSessions qs WITH (UPDLOCK)
       JOIN dbo.RestaurantTables t ON qs.table_id = t.table_id
       WHERE qs.qr_session_id = ?`,
      [sessionId]
    );

    if (!sessions || sessions.length === 0 || sessions[0].session_status !== 'Active') {
      await conn.rollback();
      return res.status(403).json({ success: false, message: "Unauthorized QR Session." });
    }
    const tableId = sessions[0].table_id;
    const tableName = sessions[0].table_number;

    // 2. Check for an Open Order linked to this table
    const [openOrders] = await conn.query(
      `SELECT order_id 
       FROM dbo.Orders WITH (UPDLOCK)
       WHERE table_id = ? AND order_status = N'Open'`,
      [tableId]
    );

    let orderId;
    if (openOrders && openOrders.length > 0) {
      orderId = openOrders[0].order_id;
    } else {
      // 3. Create a new Order
      const insertOrder = await conn.query(
        `INSERT INTO dbo.Orders (table_id, qr_session_id, order_type, order_status, created_at, subtotal, total_amount)
         OUTPUT INSERTED.order_id
         VALUES (?, ?, N'QR Self', N'Open', SYSUTCDATETIME(), 0, 0)`,
        [tableId, sessionId]
      );
      orderId = insertOrder[0][0].order_id;
    }

    // 4. Insert Items
    for (const item of cartItems) {
      const dishId = item.menu_item_id || item.dish_id || item.id;
      // Get price to prevent spoofing
      const [dishes] = await conn.query(`SELECT price FROM dbo.Dishes WHERE dish_id = ?`, [dishId]);
      const price = dishes[0]?.price || 0;

      const insertItem = await conn.query(
        `INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, notes, item_status)
         OUTPUT INSERTED.order_item_id
         VALUES (?, ?, ?, ?, ?, N'Pending')`,
        [orderId, dishId, item.quantity, price, item.notes || null]
      );

      const orderItemId = insertItem[0][0].order_item_id;

      // Automatically create Kitchen Ticket
      await conn.query(
        `INSERT INTO dbo.KitchenTickets (order_item_id, kitchen_status, priority_level, sent_at)
         VALUES (?, N'Pending', 3, SYSUTCDATETIME())`,
        [orderItemId]
      );
    }

    // 5. Recalculate Order Total with Strict Accounting Math
    await conn.query(
      `UPDATE dbo.Orders 
       SET subtotal = (SELECT ISNULL(SUM(quantity * unit_price), 0) FROM dbo.OrderItems WHERE order_id = ?),
           total_amount = (SELECT ISNULL(SUM(quantity * unit_price), 0) FROM dbo.OrderItems WHERE order_id = ?) - ISNULL(discount_amount, 0) + ISNULL(service_charge, 0)
       WHERE order_id = ?`,
      [orderId, orderId, orderId]
    );

    await conn.commit();

    // 6. Socket emit to staff & kitchen
    const io = req.app.get("io");
    if (io) {
      io.to("room:manager").to("room:staff").emit("NEW_DINEIN_ORDER", { tableId, tableName, items: cartItems });
      io.to("room:kitchen").emit("kds:new_ticket", { orderId, tableId, items: cartItems });
    }

    return res.json({ success: true, message: "Order sent to kitchen!", order_id: orderId });
  } catch (error) {
    await conn.rollback();
    console.error("submitQrOrderPublic failed:", error);
    return res.status(500).json({ success: false, message: "Failed to submit order." });
  } finally {
    conn.release();
  }
}

/**
 * GET /api/public/qr/session/:token/history
 * Fetch history of orders for a given QR session token, categorized into preorders and session orders.
 */
export async function getQrSessionHistory(req, res) {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).json({ success: false, message: "Token is required" });

    // 1. Get session details
    const [sessions] = await pool.query(
      `SELECT qr_session_id, reservation_id, table_id
       FROM dbo.QROrderSessions 
       WHERE token = ?`,
      [token]
    );

    if (!sessions || sessions.length === 0) {
      return res.status(404).json({ success: false, message: "Session not found." });
    }

    const { qr_session_id, reservation_id, table_id } = sessions[0];

    // 2. Query all relevant Orders for this session/table/reservation
    const [orders] = await pool.query(
      `SELECT order_id, order_type, subtotal, discount_amount, service_charge, total_amount, amount_paid
       FROM dbo.Orders
       WHERE (reservation_id = ? AND reservation_id IS NOT NULL) 
          OR qr_session_id = ? 
          OR (table_id = ? AND order_status = N'Open')`,
      [reservation_id, qr_session_id, table_id]
    );

    let globalSubtotal = 0;
    let globalPrepaid = 0;
    let preorders = [];
    let sessionOrders = [];

    // To prevent duplicate items if orders overlap unexpectedly
    const seenOrderIds = new Set();

    for (const order of orders) {
      if (seenOrderIds.has(order.order_id)) continue;
      seenOrderIds.add(order.order_id);

      globalSubtotal += Number(order.subtotal || 0);
      globalPrepaid += Number(order.amount_paid || 0); // Pre-paid deposit is stored here

      const request = await createDbRequest();
      const result = await request
        .input("orderId", sql.Int, order.order_id)
        .query(`
          SELECT 
            oi.order_item_id, oi.order_id, oi.quantity, oi.unit_price, oi.item_status, oi.notes,
            d.dish_name, di.image_url, o.order_type
          FROM dbo.OrderItems oi
          JOIN dbo.Dishes d ON oi.dish_id = d.dish_id
          LEFT JOIN dbo.DishImages di ON d.dish_id = di.dish_id AND di.is_primary = 1
          JOIN dbo.Orders o ON oi.order_id = o.order_id
          WHERE oi.order_id = @orderId
        `);
      const items = result.recordset || [];

      if (order.order_type === 'Preorder') {
        preorders = preorders.concat(items);
      } else {
        sessionOrders = sessionOrders.concat(items);
      }
    }

    res.json({
      success: true,
      data: {
        preorders,
        sessionOrders,
        summary: {
          subtotal: globalSubtotal,
          prepaidDeposit: globalPrepaid,
          remainingToPay: Math.max(0, globalSubtotal - globalPrepaid)
        }
      }
    });
  } catch (error) {
    console.error("getQrSessionHistory failed:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * DELETE /api/public/qr-order/items/:itemId
 * Cancel a pending order item and strictly recalculate the invoice totals.
 */
export async function cancelOrderItem(req, res) {
  const conn = await pool.getConnection();
  try {
    const itemId = Number(req.params.itemId);
    if (!Number.isFinite(itemId)) return res.status(400).json({ success: false, message: "Invalid item ID" });

    await conn.beginTransaction();

    // 1. Lock and fetch the item
    const [items] = await conn.query(
      `SELECT oi.order_id, oi.item_status, oi.quantity, oi.unit_price, o.table_id
       FROM dbo.OrderItems oi WITH (UPDLOCK)
       JOIN dbo.Orders o ON oi.order_id = o.order_id
       WHERE oi.order_item_id = ?`,
      [itemId]
    );

    if (!items || items.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    const item = items[0];

    // 2. Strict status check
    if (item.item_status !== 'Pending') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: `Cannot cancel item. Kitchen has already started (Status: ${item.item_status})` });
    }

    // 3. Update Item Status
    await conn.query(
      `UPDATE dbo.OrderItems SET item_status = N'Cancelled' WHERE order_item_id = ?`,
      [itemId]
    );

    // 4. Delete or Cancel Kitchen Ticket
    await conn.query(
      `UPDATE dbo.KitchenTickets SET kitchen_status = N'Cancelled' WHERE order_item_id = ?`,
      [itemId]
    );

    // 5. Strict Recalculation of Order Totals
    // Sum only non-cancelled items
    await conn.query(
      `UPDATE dbo.Orders 
       SET subtotal = ISNULL((SELECT SUM(quantity * unit_price) FROM dbo.OrderItems WHERE order_id = ? AND item_status != N'Cancelled'), 0)
       WHERE order_id = ?`,
      [item.order_id, item.order_id]
    );

    await conn.query(
      `UPDATE dbo.Orders
       SET total_amount = subtotal - ISNULL(discount_amount, 0) + ISNULL(service_charge, 0)
       WHERE order_id = ?`,
      [item.order_id]
    );

    await conn.commit();

    // 6. Real-time updates
    const io = req.app.get("io");
    if (io) {
      io.to("room:kitchen").emit("kds:ticket_cancelled", { orderItemId: itemId });
      // Notify staff
      io.to("room:manager").to("room:staff").emit("ORDER_ITEM_CANCELLED", { orderId: item.order_id, itemId });
    }

    return res.json({ success: true, message: "Item cancelled successfully." });
  } catch (error) {
    await conn.rollback();
    console.error("cancelOrderItem failed:", error);
    return res.status(500).json({ success: false, message: "Failed to cancel item." });
  } finally {
    conn.release();
  }
}

export async function applyVoucherToQrSession(req, res) {
  const { token } = req.params;
  const { voucher_code } = req.body;
  if (!token || !voucher_code) {
    return res.status(400).json({ success: false, message: "Token and voucher_code are required." });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Validate session and get order_id
    const [sessions] = await conn.query(
      `SELECT session_id, table_id, order_id, is_active FROM dbo.QRSessions WHERE session_token = ?`,
      [token]
    );
    if (sessions.length === 0 || !sessions[0].is_active) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Invalid or expired session." });
    }
    const sessionInfo = sessions[0];
    if (!sessionInfo.order_id) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "No active order found for this session." });
    }

    // 2. Fetch order details
    const [orders] = await conn.query(
      `SELECT order_id, subtotal, discount_amount FROM dbo.Orders WHERE order_id = ?`,
      [sessionInfo.order_id]
    );
    if (orders.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Order not found." });
    }
    const order = orders[0];
    if (order.discount_amount > 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "A voucher has already been applied to this order." });
    }

    // 3. Validate Voucher & Promotion
    const [vouchers] = await conn.query(
      `SELECT v.voucher_id, v.voucher_code, v.usage_limit, v.times_used, 
              p.promotion_id, p.discount_type, p.discount_value, p.max_discount, 
              p.min_order_value, p.start_at, p.end_at, p.applicable_to
       FROM dbo.Vouchers v
       JOIN dbo.Promotions p ON v.promotion_id = p.promotion_id
       WHERE v.voucher_code = ? AND v.is_active = 1 AND p.is_active = 1`,
      [voucher_code]
    );

    if (vouchers.length === 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Invalid or inactive voucher." });
    }

    const promo = vouchers[0];
    const now = new Date();
    if (now < new Date(promo.start_at) || now > new Date(promo.end_at)) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Voucher is expired or not yet active." });
    }
    if (promo.usage_limit && promo.times_used >= promo.usage_limit) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Voucher usage limit reached." });
    }
    if (promo.applicable_to === 'Reservation') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "This voucher is only applicable to reservations." });
    }
    if (order.subtotal < promo.min_order_value) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: `Minimum order value of ${promo.min_order_value} required.` });
    }

    // 4. Calculate discount
    let discountAmount = 0;
    if (promo.discount_type.toUpperCase() === 'PERCENT') {
      discountAmount = order.subtotal * (promo.discount_value / 100);
      if (promo.max_discount && discountAmount > promo.max_discount) {
        discountAmount = promo.max_discount;
      }
    } else {
      discountAmount = promo.discount_value;
    }
    // Prevent negative total
    if (discountAmount > order.subtotal) {
      discountAmount = order.subtotal;
    }

    // 5. Update Order with discount
    // We also recalculate total_amount: subtotal - discount + service_charge (if any, assuming 0 for now or keeping existing calculation)
    await conn.query(
      `UPDATE dbo.Orders 
       SET discount_amount = ?,
        total_amount = subtotal - ? + ISNULL(service_charge, 0),
        applied_promo_code = ?
          WHERE order_id = ? `,
      [discountAmount, discountAmount, voucher_code, order.order_id]
    );

    // 6. [CRITICAL FIX] Deduct Quota (times_used) atomically
    await conn.query(
      `UPDATE dbo.Vouchers SET times_used = times_used + 1 WHERE voucher_code = ? `,
      [voucher_code]
    );

    // Also update order details to return
    const [updatedOrders] = await conn.query(
      `SELECT total_amount FROM dbo.Orders WHERE order_id = ? `,
      [order.order_id]
    );

    await conn.commit();

    return res.json({ 
      success: true, 
      message: "Voucher applied successfully.", 
      discount_amount: discountAmount,
      new_total: updatedOrders[0].total_amount
    });

  } catch (error) {
    await conn.rollback();
    console.error("applyVoucherToQrSession error:", error);
    return res.status(500).json({ success: false, message: "Server error applying voucher." });
  } finally {
    conn.release();
  }
}

