import pool from "../db.js";

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

    // Rule 1: Table must be Occupied
    if (table.table_status !== 'Occupied') {
      return res.status(403).json({ success: false, message: "Table is not occupied. Please contact staff to check in." });
    }

    // Rule 1: Resolve merged table
    const resolvedTableId = table.merged_into_table_id ? table.merged_into_table_id : table.table_id;

    // 2. Find existing active session for the resolved table
    const [existingSessions] = await pool.query(
      `${SESSION_SELECT}
       WHERE qs.table_id = ?
         AND qs.session_status = N'Active'
         AND (qs.expires_at IS NULL OR qs.expires_at > SYSUTCDATETIME())
       ORDER BY qs.generated_at DESC;`,
      [resolvedTableId]
    );

    let session = mapSessionRow(existingSessions[0]);

    // 3. If no session exists, generate one
    if (!session) {
      const crypto = await import('crypto');
      const token = crypto.randomBytes(32).toString('hex');

      const insertResult = await pool.query(`
        INSERT INTO dbo.QROrderSessions (table_id, scanned_table_id, token, session_status, generated_at)
        OUTPUT INSERTED.qr_session_id
        VALUES (?, ?, ?, N'Active', SYSUTCDATETIME())
      `, [resolvedTableId, tableId, token]);

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

    // Rule 1: Table must be Occupied or Available
    if (table.table_status !== 'Occupied' && table.table_status !== 'Available') {
      return res.status(403).json({ success: false, message: "Table is not available. Please contact staff." });
    }

    // Rule 1: Resolve merged table
    const resolvedTableId = table.merged_into_table_id ? table.merged_into_table_id : table.table_id;

    let session = null;

    if (table.table_status === 'Available') {
      // Find existing Pending session
      const [pendingSessions] = await pool.query(
        `${SESSION_SELECT}
         WHERE qs.table_id = ?
           AND qs.session_status = N'Pending'
         ORDER BY qs.generated_at DESC;`,
        [resolvedTableId]
      );

      session = mapSessionRow(pendingSessions[0]);

      if (!session) {
        const crypto = await import('crypto');
        const token = crypto.randomBytes(32).toString('hex');

        const insertResult = await pool.query(`
          INSERT INTO dbo.QROrderSessions (table_id, scanned_table_id, token, session_status, generated_at)
          OUTPUT INSERTED.qr_session_id
          VALUES (?, ?, ?, N'Pending', SYSUTCDATETIME())
        `, [resolvedTableId, tableId, token]);

        const newSessionId = insertResult[0][0].qr_session_id;

        const [newSessions] = await pool.query(
          `${SESSION_SELECT} WHERE qs.qr_session_id = ?`,
          [newSessionId]
        );
        session = mapSessionRow(newSessions[0]);
      }

      // Emit Socket.IO event to staff (always emit so staff get reminded if they missed it)
      const io = req.app.get("io");
      if (io) {
        console.log("[SOCKET EMIT] 🌍 GLOBAL EMIT FIRED for Table ID:", table.table_id);
        io.emit("NEW_QR_SESSION_PENDING", { session });
      }

      return res.json({
        success: true,
        message: "Session is pending approval.",
        session,
        resolved_table_id: resolvedTableId,
        was_merged: !!table.merged_into_table_id
      });
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

      const insertResult = await pool.query(`
        INSERT INTO dbo.QROrderSessions (table_id, scanned_table_id, token, session_status, generated_at)
        OUTPUT INSERTED.qr_session_id
        VALUES (?, ?, ?, N'Active', SYSUTCDATETIME())
      `, [resolvedTableId, tableId, token]);

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
        `INSERT INTO dbo.Orders (table_id, order_type, order_status, created_at, subtotal, total_amount)
         OUTPUT INSERTED.order_id
         VALUES (?, N'Dine In', N'Open', SYSUTCDATETIME(), 0, 0)`,
        [tableId]
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

    // 5. Recalculate Order Total
    await conn.query(
      `UPDATE dbo.Orders 
       SET total_amount = (SELECT SUM(quantity * unit_price) FROM dbo.OrderItems WHERE order_id = ?),
           subtotal = (SELECT SUM(quantity * unit_price) FROM dbo.OrderItems WHERE order_id = ?)
       WHERE order_id = ?`,
      [orderId, orderId, orderId]
    );

    await conn.commit();

    // 6. Socket emit to staff & kitchen
    const io = req.app.get("io");
    if (io) {
      io.to("room:manager").to("room:staff").emit("NEW_DINEIN_ORDER", { tableId, tableName, items: cartItems });
      io.to("room:kitchen").emit("NEW_KITCHEN_TICKET", { orderId, tableId, items: cartItems });
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
