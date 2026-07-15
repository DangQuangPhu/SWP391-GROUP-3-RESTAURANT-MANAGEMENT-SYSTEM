import pool, { getRawPool } from "../db.js";
import sql from "mssql";
import { getIO } from "../socket.js";
import { resolveShift } from "../services/shiftResolver.js";
import { sendBookingCheckedInEmail, sendBookingRejectedEmail } from "../email.js";
import { processPreordersToKds } from "../services/kdsIntegrationService.js";
import { RESERVATION_STATUS } from '../constants/reservationStatus.js';


// ──────────────────────────────────────────────────────────────────────────────
// POST /api/staff/reservations/walk-in
//
// Creates an immediate Walk-in reservation — no deposit, no voucher.
// Atomic transaction with UPDLOCK on RestaurantTables to prevent race conditions
// when two staff members pick the same Available table simultaneously.
//
// Security: all inputs bound via sql.NVarChar / sql.Int — zero string concat.
// ──────────────────────────────────────────────────────────────────────────────
export const createWalkInReservation = async (req, res) => {
  const staffId = parseInt(req.user?.userId || req.userId, 10);
  if (!staffId) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  }

  const { contact_name, contact_phone, contact_email, guest_count, table_id, start_time, end_time } = req.body;

  // ── Input validation ──────────────────────────────────────────────────────
  if (!contact_name || typeof contact_name !== 'string' || contact_name.trim().length < 2) {
    return res.status(400).json({ success: false, message: 'Full name is required (min 2 characters).' });
  }
  if (!contact_phone || typeof contact_phone !== 'string' || contact_phone.trim().length < 8) {
    return res.status(400).json({ success: false, message: 'Valid phone number is required.' });
  }
  if (contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email)) {
    return res.status(400).json({ success: false, message: 'Invalid email format.' });
  }
  const parsedGuestCount = parseInt(guest_count, 10);
  if (!parsedGuestCount || parsedGuestCount < 1 || parsedGuestCount > 50) {
    return res.status(400).json({ success: false, message: 'Guest count must be between 1 and 50.' });
  }
  const parsedTableId = parseInt(table_id, 10);
  if (!parsedTableId || isNaN(parsedTableId)) {
    return res.status(400).json({ success: false, message: 'A valid table must be selected.' });
  }

  // Sanitize string inputs (trim whitespace + max length enforcement)
  const safeName  = contact_name.trim().slice(0, 100);
  const safePhone = contact_phone.trim().slice(0, 20);
  const safeEmail = contact_email ? contact_email.trim().slice(0, 100) : null;

  const rawPool = await getRawPool();
  const transaction = new sql.Transaction(rawPool);
  await transaction.begin();

  try {
    // ── SECURITY: UPDLOCK acquires an update-lock immediately on the row.
    // A second concurrent transaction reading 'Available' is blocked until
    // this one commits or rolls back — race condition eliminated. ──────────
    const req1 = new sql.Request(transaction);
    req1.input('tableId', sql.Int, parsedTableId);
    const tableCheck = await req1.query(`
      SELECT table_status, table_number, capacity
      FROM dbo.RestaurantTables WITH (UPDLOCK, ROWLOCK)
      WHERE table_id = @tableId
    `);

    if (!tableCheck.recordset.length) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Table not found.' });
    }
    const tableRow = tableCheck.recordset[0];
    if (tableRow.table_status !== 'Available') {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: `Table is not available (currently: ${tableRow.table_status}). Please select another table.`
      });
    }

    // Find matching customer account by phone or email
    let matchedCustomerId = null;
    const reqMatch = new sql.Request(transaction);
    reqMatch.input('matchPhone', sql.NVarChar(20), safePhone);
    reqMatch.input('matchEmail', sql.NVarChar(100), safeEmail);
    const matchRes = await reqMatch.query(`
      SELECT user_id 
      FROM dbo.UserAccounts 
      WHERE (phone IS NOT NULL AND phone = @matchPhone)
         OR (email IS NOT NULL AND LOWER(email) = LOWER(@matchEmail))
    `);
    if (matchRes.recordset.length > 0) {
      matchedCustomerId = matchRes.recordset[0].user_id;
    }

    // ── Step 1: INSERT Reservation (Walk-in, Dining, no deposit, no voucher) ──
    const now = new Date();
    let startAt = now;
    let endAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const getLocalDateWithTime = (timeStr) => {
      if (!timeStr) return null;
      const [hh, mm] = timeStr.split(':').map(Number);
      if (isNaN(hh) || isNaN(mm)) return null;
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm, 0, 0);
    };

    if (start_time) {
      const parsedStart = getLocalDateWithTime(start_time);
      if (parsedStart) startAt = parsedStart;
    }
    if (end_time) {
      const parsedEnd = getLocalDateWithTime(end_time);
      if (parsedEnd) endAt = parsedEnd;
    }

    if (endAt <= startAt) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'End time must be after start time.' });
    }

    const req2 = new sql.Request(transaction);
    req2.input('customerId', sql.Int,           matchedCustomerId);
    req2.input('safeName',   sql.NVarChar(100), safeName);
    req2.input('safePhone',  sql.NVarChar(20),  safePhone);
    req2.input('safeEmail',  sql.NVarChar(100), safeEmail);
    req2.input('guestCount', sql.TinyInt,       parsedGuestCount);
    req2.input('staffId',    sql.Int,           staffId);
    req2.input('startAt',    sql.DateTime2,     startAt);
    req2.input('endAt',      sql.DateTime2,     endAt);

    const insertRes = await req2.query(`
      INSERT INTO dbo.Reservations
        (customer_id, contact_name, contact_phone, contact_email,
         guest_count, reservation_status, reservation_source,
         deposit_amount, applied_promo_code, applied_voucher_id,
         created_by_staff_id, confirmed_by_staff_id,
         reservation_start_at, reservation_end_at,
         checked_in_at, created_at, updated_at)
      OUTPUT INSERTED.reservation_id
      VALUES
        (@customerId, @safeName, @safePhone, @safeEmail,
         @guestCount, N'Dining', N'Walk-in',
         NULL, NULL, NULL,
         @staffId, @staffId,
         @startAt, @endAt,
         SYSDATETIME(), SYSDATETIME(), SYSDATETIME())
    `);
    const newReservationId = insertRes.recordset[0].reservation_id;

    // ── Step 2: Link reservation ↔ table ──────────────────────────────────
    const req3 = new sql.Request(transaction);
    req3.input('reservationId', sql.Int, newReservationId);
    req3.input('tableId',       sql.Int, parsedTableId);
    req3.input('staffId',       sql.Int, staffId);
    await req3.query(`
      INSERT INTO dbo.ReservationTables (reservation_id, table_id, assigned_by_staff_id)
      VALUES (@reservationId, @tableId, @staffId)
    `);

    // ── Step 3: Table → Occupied ──────────────────────────────────────────
    const req4 = new sql.Request(transaction);
    req4.input('tableId', sql.Int, parsedTableId);
    await req4.query(`
      UPDATE dbo.RestaurantTables
      SET table_status = N'Occupied', updated_at = SYSDATETIME()
      WHERE table_id = @tableId
    `);

    // ── Step 4: Timeline + Audit ──────────────────────────────────────────
    const req5 = new sql.Request(transaction);
    req5.input('reservationId', sql.Int, newReservationId);
    req5.input('staffId',       sql.Int, staffId);
    await req5.query(`
      INSERT INTO dbo.ReservationTimelines
        (reservation_id, event_type, performed_by, notes)
      VALUES
        (@reservationId, N'WALK_IN_CREATED', @staffId,
         N'Walk-in reservation created by staff. No deposit required.');
      INSERT INTO dbo.AuditLogs
        (user_id, action_name, target_table, target_id, new_value_json, ip_address)
      VALUES
        (@staffId, N'WALK_IN_CREATED', N'Reservations', @reservationId,
         N'{"reservation_source":"Walk-in","reservation_status":"Dining"}', NULL);
    `);

    // ── Step 5: Auto-generate QR session ─────────────────────────────────
    // Walk-in guests order immediately — the QR session must exist the moment
    // they sit down. We ALWAYS create a fresh session:
    //   1. Expire any stale active session on this table (e.g. from a crash/reset)
    //   2. Insert the new active session with a cryptographically unique token.
    {
      const tNum  = tableRow.table_number || `T-${parsedTableId}`;
      const slug  = String(tNum).trim().toLowerCase().replace(/\s+/g, '-');
      // Token: table-slug + epoch-ms + 6-char hex random → guaranteed unique
      const randomSuffix = Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0');
      const token = `qr-walkin-${slug}-${Date.now()}-${randomSuffix}`;

      const req5a = new sql.Request(transaction);
      req5a.input('tableId', sql.Int, parsedTableId);
      await req5a.query(`
        UPDATE dbo.QROrderSessions
        SET session_status = N'Expired', expires_at = SYSDATETIME()
        WHERE table_id = @tableId AND session_status = N'Active'
      `);

      const req5b = new sql.Request(transaction);
      req5b.input('tableId',       sql.Int,          parsedTableId);
      req5b.input('reservationId', sql.Int,          newReservationId);
      req5b.input('customerId',    sql.Int,          matchedCustomerId);
      req5b.input('token',         sql.VarChar(255), token);
      req5b.input('staffId',       sql.Int,          staffId);
      await req5b.query(`
        INSERT INTO dbo.QROrderSessions
          (table_id, reservation_id, customer_id, token, session_status,
           generated_by_staff_id, generated_at, expires_at)
        VALUES
          (@tableId, @reservationId, @customerId, @token, N'Active',
           @staffId, SYSDATETIME(), DATEADD(hour, 4, SYSDATETIME()))
      `);
    }

    await transaction.commit();

    // ── Step 6: Real-time broadcast to Staff + Manager portals ────────────

    try {
      const io = getIO();
      if (io) {
        const broadcastPayload = {
          reservation_id:     newReservationId,
          customer_name:      safeName,
          contact_phone:      safePhone,
          reservation_status: 'Dining',
          reservation_source: 'Walk-in',
          table_id:           parsedTableId,
          table_number:       tableRow.table_number,
        };
        ['room:staff', 'room:manager'].forEach((room) => {
          io.to(room).emit('reservation:new', broadcastPayload);
          io.to(room).emit('reservation:status_changed', {
            reservation_id: newReservationId,
            new_status:     'Dining',
            table_id:       parsedTableId,
          });
          io.to(room).emit('table:status_changed', {
            table_id:   parsedTableId,
            new_status: 'Occupied',
          });
        });
      }
    } catch (socketErr) {
      console.error('[Walk-in] Socket.IO broadcast failed (non-fatal):', socketErr.message);
    }

    // ── Step 7: Optional email — fire-and-forget, non-fatal ──────────────
    if (safeEmail) {
      setImmediate(async () => {
        try {
          const now2 = new Date();
          await sendBookingCheckedInEmail({
            toEmail:         safeEmail,
            customerName:    safeName,
            reservationId:   newReservationId,
            reservationDate: now2.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            reservationTime: `${String(now2.getHours()).padStart(2, '0')}:${String(now2.getMinutes()).padStart(2, '0')}`,
          });
        } catch (emailErr) {
          console.error('[Walk-in] Email send failed (non-fatal):', emailErr?.message || emailErr);
        }
      });
    }

    return res.status(201).json({
      success:        true,
      message:        `Walk-in #${newReservationId} created — Table ${tableRow.table_number} is now Occupied.`,
      reservation_id: newReservationId,
      table_id:       parsedTableId,
      table_number:   tableRow.table_number,
    });


  } catch (err) {
    try { await transaction.rollback(); } catch (_) {}
    console.error('[createWalkInReservation] Error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to create walk-in reservation.' });
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/staff/reservations/today-shift
//
// Returns ONLY today's Confirmed/Checked-In reservations whose start time falls
// within the requesting staff member's currently scheduled shift.
//
// Security invariant: an INNER JOIN on StaffSchedules + Shifts guarantees that
// if the staff member has no schedule today, zero rows are returned — no data
// leaks to unscheduled staff members.
// ──────────────────────────────────────────────────────────────────────────────
export const getTodayShiftReservations = async (req, res) => {
  const staffId = req.userId;

  if (!staffId) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: staff identity could not be resolved.",
    });
  }

  try {
    const { page = 1, limit = 20, search = "", status = "all" } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const offset = (pageNum - 1) * limitNum;

    let whereConditions = ["1 = 1"];
    let queryParams = [];

    // Date filtering (default to next 7 days if "All Dates" is provided to ensure staff sees data!)
    const isValidDate = (d) => d && typeof d === 'string' && d.toLowerCase() !== "all" && d.toLowerCase() !== "all dates" && d.trim() !== "";
    const sd = isValidDate(req.query.startDate) ? req.query.startDate : null;
    const ed = isValidDate(req.query.endDate) ? req.query.endDate : null;

    if (sd && ed) {
      whereConditions.push("CAST(r.reservation_start_at AS DATE) BETWEEN ? AND ?");
      queryParams.push(sd, ed);
    } else if (sd) {
      whereConditions.push("CAST(r.reservation_start_at AS DATE) >= ?");
      queryParams.push(sd);
    } else if (ed) {
      whereConditions.push("CAST(r.reservation_start_at AS DATE) <= ?");
      queryParams.push(ed);
    }

    // Status filtering
    if (status !== "all" && status) {
      whereConditions.push("r.reservation_status = ?");
      queryParams.push(status);
    }

    // Search filtering
    if (search) {
      whereConditions.push(`(
        CAST(r.reservation_id AS VARCHAR) LIKE ? OR
        ua.full_name LIKE ? OR
        r.contact_name LIKE ? OR
        ua.phone LIKE ? OR
        r.contact_phone LIKE ?
      )`);
      const searchWild = `%${search}%`;
      queryParams.push(searchWild, searchWild, searchWild, searchWild, searchWild);
    }

    const whereClause = whereConditions.join(" AND ");

    // Count Total
    const [countRows] = await pool.query(
      `SELECT COUNT(DISTINCT r.reservation_id) AS totalCount
       FROM dbo.Reservations r
       LEFT JOIN dbo.UserAccounts ua ON r.customer_id = ua.user_id
       WHERE ${whereClause}`,
      queryParams
    );
    const totalCount = countRows[0]?.totalCount || 0;
    const totalPages = Math.ceil(totalCount / limitNum);

    // Fetch Page
    const [rows] = await pool.query(
      `SELECT
                r.reservation_id,
                COALESCE(ua.full_name, r.contact_name, N'Guest') AS customer_name,
                COALESCE(ua.phone, r.contact_phone) AS customer_phone,
                COALESCE(ua.email, r.contact_email) AS customer_email,
                cp.username,
                r.reservation_start_at,
                r.reservation_end_at,
                r.guest_count,
                r.special_request,
                r.dining_purpose,
                r.reservation_status,
                CASE WHEN r.has_pending_request = 1
                     THEN N'Request'
                     ELSE r.reservation_status
                END AS display_status,
                r.created_at,
                r.checked_in_at,
                STRING_AGG(t.table_number, ', ') AS assigned_tables,
                sh.shift_name,
                sh.start_time       AS shift_start_time,
                sh.end_time         AS shift_end_time
             FROM dbo.Reservations r
             LEFT JOIN dbo.UserAccounts ua ON r.customer_id = ua.user_id
             LEFT JOIN dbo.CustomerProfiles cp ON r.customer_id = cp.user_id
             LEFT JOIN dbo.ReservationTables res_t ON r.reservation_id = res_t.reservation_id
             LEFT JOIN dbo.RestaurantTables t ON res_t.table_id = t.table_id
             LEFT JOIN dbo.StaffSchedules ss ON ss.user_id = ? AND ss.work_date = CAST(r.reservation_start_at AS DATE)
             LEFT JOIN dbo.Shifts sh ON sh.shift_id = ss.shift_id AND sh.is_active = 1
             WHERE ${whereClause}
             GROUP BY
                 r.reservation_id, ua.full_name, r.contact_name, ua.phone, r.contact_phone,
                 ua.email, r.contact_email, cp.username, r.reservation_start_at,
                 r.reservation_end_at, r.guest_count, r.special_request, r.dining_purpose, r.reservation_status,
                 r.has_pending_request, r.created_at, r.checked_in_at, sh.shift_name, sh.start_time, sh.end_time
             ORDER BY 
                 CASE r.reservation_status
                     WHEN N'${RESERVATION_STATUS.AWAIT_CHECK_IN}' THEN 1
                     WHEN N'${RESERVATION_STATUS.CHECK_IN}' THEN 2
                     WHEN N'${RESERVATION_STATUS.OCCUPIED}' THEN 3
                     WHEN N'${RESERVATION_STATUS.COMPLETE_PAID}' THEN 4
                     WHEN N'${RESERVATION_STATUS.CHECK_OUT}' THEN 5
                     WHEN N'${RESERVATION_STATUS.PENDING_PAYMENT}' THEN 6
                     WHEN N'${RESERVATION_STATUS.REJECT_CHECK_IN}' THEN 7
                     ELSE 8
                 END ASC,
                 r.reservation_start_at ASC
             OFFSET ? ROWS
             FETCH NEXT ? ROWS ONLY`,
      [staffId, ...queryParams, offset, limitNum]
    );

    return res.json({
      success: true,
      reservations: rows,
      totalCount,
      totalPages,
      currentPage: pageNum
    });
  } catch (error) {
    console.error("[getTodayShiftReservations] Query failed:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching shift reservations.",
    });
  }
};

export const assignTable = async (req, res) => {
  const reservationId = parseInt(req.params.id, 10);
  const staffUserId = parseInt(req.user?.userId || req.userId, 10);
  const tableId = parseInt(req.body.tableId, 10);

  if (isNaN(reservationId) || isNaN(tableId) || isNaN(staffUserId)) {
    return res.status(400).json({ success: false, message: "Invalid parameters for assigning table." });
  }

  try {
    const rawPool = await getRawPool();
    const transaction = new sql.Transaction(rawPool);
    await transaction.begin();

    try {
      const request = new sql.Request(transaction);
      request.input('id', sql.Int, reservationId);
      request.input('tableId', sql.Int, tableId);
      request.input('staffId', sql.Int, staffUserId);

      // Step 1: Check table availability (Relaxed for MVP)
      const tableCheck = await request.query(`SELECT table_status FROM dbo.RestaurantTables WHERE table_id = @tableId`);
      if (!tableCheck.recordset.length) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: "Table not found." });
      }
      const currentTableStatus = tableCheck.recordset[0].table_status;
      if (['Occupied', 'Cleaning', 'Inactive'].includes(currentTableStatus)) {
        await transaction.rollback();
        return res.status(409).json({ success: false, message: `Conflict: Table is currently ${currentTableStatus}.` });
      }

      // Step 1: Base Assignment (Idempotent to avoid PK violation if already assigned)
      await request.query(`
        IF NOT EXISTS (SELECT 1 FROM dbo.ReservationTables WHERE reservation_id = @id AND table_id = @tableId)
        BEGIN
            INSERT INTO dbo.ReservationTables (reservation_id, table_id, assigned_by_staff_id) 
            VALUES (@id, @tableId, @staffId)
        END
      `);
      
      // Step 2: Force Reservation Status Update (Relaxed validation)
      await request.query(`UPDATE dbo.Reservations SET reservation_status = N'Dining', checked_in_at = COALESCE(checked_in_at, SYSDATETIME()), updated_at = SYSDATETIME() WHERE reservation_id = @id`);
      
      await request.query(`UPDATE dbo.RestaurantTables SET table_status = N'Occupied' WHERE table_id = @tableId`);

      // Create QR Session if none exists
      const sessionCheck = await request.query(`
        SELECT TOP 1 qr_session_id 
        FROM dbo.QROrderSessions 
        WHERE table_id = @tableId 
          AND session_status = N'Active' 
          AND (expires_at IS NULL OR expires_at > SYSDATETIME())
      `);
      if (!sessionCheck.recordset.length) {
        const tRows = await request.query(`SELECT table_number FROM dbo.RestaurantTables WHERE table_id = @tableId`);
        const tNum = tRows.recordset.length ? tRows.recordset[0].table_number : 'T-' + tableId;
        const slug = String(tNum).trim().toLowerCase().replace(/\s+/g, "-");
        const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
        const token = `qr-session-${slug}-${stamp}`;

        const custCheck = await request.query(`SELECT customer_id FROM dbo.Reservations WHERE reservation_id = @id`);
        const customerId = custCheck.recordset.length ? custCheck.recordset[0].customer_id : null;
        
        const sessionReq = new sql.Request(transaction);
        sessionReq.input('tableId', sql.Int, tableId);
        sessionReq.input('id', sql.Int, reservationId);
        sessionReq.input('customerId', sql.Int, customerId);
        sessionReq.input('token', sql.VarChar(255), token);
        sessionReq.input('staffId', sql.Int, staffUserId);

        await sessionReq.query(`
          INSERT INTO dbo.QROrderSessions
            (table_id, reservation_id, customer_id, token, session_status, generated_by_staff_id, generated_at, expires_at)
          VALUES
            (@tableId, @id, @customerId, @token, N'Active', @staffId, SYSDATETIME(), DATEADD(hour, 4, SYSDATETIME()))
        `);
      }

      await request.query(`INSERT INTO dbo.ReservationTimelines (reservation_id, event_type, performed_by, notes) VALUES (@id, N'TABLE_ASSIGNED', @staffId, N'Staff assigned table.')`);
      await request.query(`INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id) VALUES (@staffId, N'ASSIGN_TABLE', N'Reservations', @id)`);

      // Step 2: Auto-Fire Preorders Check
      const preorderCheck = await request.query(`SELECT * FROM dbo.PreorderItems WHERE reservation_id = @id`);
      const preorders = preorderCheck.recordset;

      const resCheck = await request.query(`SELECT deposit_amount FROM dbo.Reservations WHERE reservation_id = @id`);
      const depositAmount = resCheck.recordset.length ? resCheck.recordset[0].deposit_amount : 0;

      let newOrderId = null;

      // Step 3: If Preorders Exist - Execute Order Migration
      if (preorders && preorders.length > 0) {
        request.input('depositAmount', sql.Decimal(10, 2), depositAmount || 0);

        const createOrderRes = await request.query(`
          INSERT INTO dbo.Orders (reservation_id, table_id, created_by_staff_id, order_type, order_status, amount_paid)
          OUTPUT INSERTED.order_id
          VALUES (@id, @tableId, @staffId, N'Preorder', N'Open', @depositAmount)
        `);
        newOrderId = createOrderRes.recordset[0].order_id;
        
        for (const item of preorders) {
          const itemReq = new sql.Request(transaction);
          itemReq.input('newOrderId', sql.Int, newOrderId);
          itemReq.input('dishId', sql.Int, item.dish_id);
          itemReq.input('qty', sql.Int, item.quantity);
          itemReq.input('price', sql.Decimal(10, 2), item.unit_price);
          itemReq.input('notes', sql.NVarChar(255), item.notes || '');
          
          const createOrderItemRes = await itemReq.query(`
            INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, item_status, notes)
            OUTPUT INSERTED.order_item_id
            VALUES (@newOrderId, @dishId, @qty, @price, N'Sent To Kitchen', @notes)
          `);
          const newOrderItemId = createOrderItemRes.recordset[0].order_item_id;

          const ticketReq = new sql.Request(transaction);
          ticketReq.input('newOrderItemId', sql.Int, newOrderItemId);
          await ticketReq.query(`
            INSERT INTO dbo.KitchenTickets (order_item_id, kitchen_status, priority_level)
            VALUES (@newOrderItemId, N'Pending', 2)
          `);
        }

        // Math Recalculation
        const mathReq = new sql.Request(transaction);
        mathReq.input('newOrderId', sql.Int, newOrderId);
        await mathReq.query(`
          UPDATE dbo.Orders 
          SET subtotal = (SELECT ISNULL(SUM(quantity * unit_price), 0) FROM dbo.OrderItems WHERE order_id = @newOrderId)
          WHERE order_id = @newOrderId;

          UPDATE dbo.Orders 
          SET total_amount = subtotal
          WHERE order_id = @newOrderId;
        `);
      }

      await transaction.commit();

      // Step 4: WebSockets - CRITICAL
      try {
        const io = req.app.get("io");
        if (io) {
          io.to('room:manager').emit('reservation:status_changed', { reservation_id: reservationId, new_status: 'Dining', table_id: tableId });
          io.to('room:staff').emit('reservation:status_changed', { reservation_id: reservationId, new_status: 'Dining', table_id: tableId });

          io.to('room:manager').emit('table:status_changed', { table_id: tableId, new_status: 'Occupied' });
          io.to('room:staff').emit('table:status_changed', { table_id: tableId, new_status: 'Occupied' });

          if (newOrderId) {
            io.to('room:kitchen').emit('kds:new_ticket', { order_id: newOrderId, message: 'New pre-order ticket arrived.' });
          }
        }
      } catch (socketErr) {
        console.error("[Socket.IO] Error emitting assign-table status:", socketErr);
      }

      return res.status(200).json({ success: true, message: "Table assigned successfully." });
    } catch (error) {
      await transaction.rollback();
      console.error("🚨 SQL TRANSACTION FAILED - assignTable:", error);
      return res.status(500).json({ success: false, message: "Server error during assign table transaction." });
    }
  } catch (dbErr) {
    console.error("🚨 DB CONNECTION CRASH:", dbErr);
    return res.status(500).json({ success: false, message: "Database error initializing assign table transaction." });
  }
};
// GET /api/staff/reservations/:id
// Returns a single reservation with full detail + preorder items
export const getStaffReservationDetail = async (req, res) => {
  const reservationId = req.params.id;
  try {
    const [rows] = await pool.query(
      `SELECT
          r.reservation_id,
          COALESCE(ua.full_name, r.contact_name, N'Guest') AS customer_name,
          COALESCE(ua.phone, r.contact_phone) AS customer_phone,
          COALESCE(ua.email, r.contact_email) AS customer_email,
          cp.username,
          r.reservation_start_at, r.reservation_end_at, r.guest_count,
          r.special_request, r.dining_purpose, r.reservation_status, r.reservation_source,
          r.created_at, r.checked_in_at,
          STRING_AGG(t.table_number, ', ') AS assigned_tables,
          MAX(a.area_name) AS area_name
       FROM dbo.Reservations r
       LEFT JOIN dbo.UserAccounts ua ON r.customer_id = ua.user_id
       LEFT JOIN dbo.CustomerProfiles cp ON r.customer_id = cp.user_id
       LEFT JOIN dbo.ReservationTables rt ON r.reservation_id = rt.reservation_id
       LEFT JOIN dbo.RestaurantTables t ON rt.table_id = t.table_id
       LEFT JOIN dbo.RestaurantAreas a ON t.area_id = a.area_id
       WHERE r.reservation_id = ?
       GROUP BY r.reservation_id, ua.full_name, ua.phone, ua.email,
                r.contact_name, r.contact_phone, r.contact_email,
                cp.username,
                r.reservation_start_at, r.reservation_end_at, r.guest_count,
                r.special_request, r.dining_purpose, r.reservation_status, r.reservation_source,
                r.created_at, r.checked_in_at`,
      [reservationId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Reservation not found.' });
    }

    const [preorderRows] = await pool.query(
      `SELECT pi.preorder_item_id, pi.dish_id, pi.quantity, pi.unit_price,
              pi.notes, pi.created_at,
              d.dish_name, d.price
       FROM dbo.PreorderItems pi
       LEFT JOIN dbo.Dishes d ON pi.dish_id = d.dish_id
       WHERE pi.reservation_id = ?
       ORDER BY pi.created_at ASC`,
      [reservationId]
    );

    return res.json({
      success: true,
      reservation: {
        ...rows[0],
        preorders: preorderRows,
      },
    });
  } catch (error) {
    console.error('[getStaffReservationDetail] error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};


// PATCH /api/staff/reservations/:id/checkin
export const checkinReservation = async (req, res) => {
  const reservationId = req.params.id;
  const staffUserId = req.user?.userId || req.userId;

  try {
    const rawPool = await getRawPool();
    const transaction = new sql.Transaction(rawPool);
    await transaction.begin();
    
    try {
        const request = new sql.Request(transaction);
        request.input('id', sql.Int, parseInt(reservationId, 10));
        request.input('staffId', sql.Int, parseInt(staffUserId, 10)); // Ensure this is not undefined

        // 1. Update status (canonical value is 'Check-in' — see RESERVATION_STATUS.CHECK_IN)
        await request.query(`UPDATE dbo.Reservations SET reservation_status = N'Check-in', checked_in_at = SYSDATETIME(), updated_at = SYSDATETIME() WHERE reservation_id = @id AND reservation_status = N'Confirmed'`);
        
        // 2. Insert Timeline
        await request.query(`INSERT INTO dbo.ReservationTimelines (reservation_id, event_type, performed_by, notes) VALUES (@id, N'GUEST_ARRIVED', @staffId, N'Guest arrived, waiting for table.')`);
        
        // 3. Insert AuditLog
        await request.query(`INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id) VALUES (@staffId, N'CHECK_IN', N'Reservations', @id)`);

        await transaction.commit();
        
        // Emit WebSockets here
        try {
          const io = getIO();
          if (io) {
            const statusPayload = {
              reservation_id: parseInt(reservationId, 10),
              new_status: 'Check-in',
              staff_name: `Staff #${staffUserId}`,
              timestamp: new Date().toISOString(),
            };
            io.to('room:manager').emit('reservation:status_changed', statusPayload);
            io.to('room:staff').emit('reservation:status_changed', statusPayload);
          }
        } catch (socketErr) {
          console.error("[Socket.IO] Error emitting checkin status:", socketErr);
        }

        res.status(200).json({ success: true, message: "Check-in successful" });
    } catch (error) {
        try { await transaction.rollback(); } catch (e) {}
        console.error("🚨 CHECKIN CRASH ROOT CAUSE:", error);
        import('fs').then(fs => fs.writeFileSync('CRASH_LOG.txt', String(error.stack || error)));
        res.status(500).json({ success: false, message: "Server error during check-in transaction.", error: String(error) });
    }
  } catch (dbErr) {
    console.error("🚨 DB CONNECTION CRASH:", dbErr);
    import('fs').then(fs => fs.writeFileSync('CRASH_LOG.txt', 'DB_ERR: ' + String(dbErr.stack || dbErr)));
    res.status(500).json({ success: false, message: "Database error initializing check-in transaction." });
  }
};

// PATCH /api/staff/reservations/:id/reject
export const rejectReservation = async (req, res) => {
  const reservationId = parseInt(req.params.id, 10);
  const staffUserId = parseInt(req.userId || req.user?.userId, 10);
  const { reason, new_status } = req.body;

  if (isNaN(reservationId)) {
    return res.status(400).json({ success: false, message: "Invalid reservation ID" });
  }

  if (new_status !== 'No Show' && new_status !== 'Check-in Rejected' && new_status !== 'Cancelled') {
    return res.status(400).json({ success: false, message: "new_status must be 'No Show', 'Cancelled' or 'Check-in Rejected'" });
  }

  try {
    const rawPool = await getRawPool();
    
    // Security Guardrail: Backend RBAC Enforcement
    const roleReq = new sql.Request(rawPool);
    roleReq.input('staffUserId', sql.Int, staffUserId);
    const roleRows = await roleReq.query(
      `SELECT r.role_name FROM dbo.UserAccounts ua INNER JOIN dbo.Roles r ON ua.role_id = r.role_id WHERE ua.user_id = @staffUserId`
    );
    const roleName = roleRows.recordset[0]?.role_name;
    if (roleName === 'Restaurant Staff' && new_status !== 'No Show' && new_status !== 'Check-in Rejected' && new_status !== 'Cancelled') {
      return res.status(403).json({ success: false, message: "Forbidden: Staff are not allowed to manually reject or cancel reservations. Only No Show or Check-in Rejected is permitted." });
    }

    const transaction = new sql.Transaction(rawPool);
    await transaction.begin();

    try {
      const dbReason = reason || 'No reason provided';
      const targetStatus = (new_status === 'No Show') ? 'No Show' : 'Cancelled';

      // Step 1: Update Reservation
      const updateReq = new sql.Request(transaction);
      updateReq.input('targetStatus', sql.NVarChar, targetStatus);
      updateReq.input('dbReason', sql.NVarChar, dbReason);
      updateReq.input('resId', sql.Int, reservationId);
      
      const updateResult = await updateReq.query(
        `UPDATE dbo.Reservations
         SET reservation_status = @targetStatus,
             cancelled_at       = SYSDATETIME(),
             cancel_reason      = @dbReason,
             updated_at         = SYSDATETIME()
         WHERE reservation_id = @resId
           AND reservation_status = N'Await Check-in'`
      );

      if (updateResult.rowsAffected[0] === 0) {
        await transaction.rollback();
        return res.status(409).json({ success: false, message: "Reservation is not in Await Check-in status or does not exist." });
      }

      // Step 2: Safe Table Release
      const releaseReq = new sql.Request(transaction);
      releaseReq.input('resId', sql.Int, reservationId);
      await releaseReq.query(
        `UPDATE dbo.RestaurantTables
         SET table_status = N'Available', updated_at = SYSDATETIME()
         WHERE table_id IN (
           SELECT table_id FROM dbo.ReservationTables WHERE reservation_id = @resId
         )`
      );

      // Step 3: Timeline & Audit
      const timelineReq = new sql.Request(transaction);
      timelineReq.input('resId', sql.Int, reservationId);
      timelineReq.input('staffUserId', sql.Int, staffUserId);
      timelineReq.input('dbReason', sql.NVarChar, dbReason);
      await timelineReq.query(
        `INSERT INTO dbo.ReservationTimelines (reservation_id, event_type, performed_by, notes) 
         VALUES (@resId, N'REJECT_CHECKIN', @staffUserId, @dbReason)`
      );

      const auditReq = new sql.Request(transaction);
      auditReq.input('staffUserId', sql.Int, staffUserId);
      auditReq.input('resId', sql.Int, reservationId);
      auditReq.input('oldVal', sql.NVarChar, JSON.stringify({ reservation_status: "Await Check-in" }));
      auditReq.input('newVal', sql.NVarChar, JSON.stringify({ reservation_status: targetStatus, cancel_reason: dbReason }));
      auditReq.input('ip', sql.NVarChar, req.ip || null);
      await auditReq.query(
        `INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, old_value_json, new_value_json, ip_address, created_at)
         VALUES (@staffUserId, N'STAFF_REJECTED_AWAIT_CHECK_IN', N'Reservations', @resId, @oldVal, @newVal, @ip, SYSDATETIME())`
      );

      // Step 4: Manager Notification
      const notifyReq = new sql.Request(transaction);
      notifyReq.input('resId', sql.Int, reservationId);
      notifyReq.input('dbReason', sql.NVarChar, dbReason);
      await notifyReq.query(
        `INSERT INTO dbo.Notifications (user_id, notification_type, title, message_body, is_read, sent_at) 
         SELECT user_id, N'Booking Rejected', N'Check-in Rejected', N'Staff rejected reservation #' + CAST(@resId AS NVARCHAR) + N'. Reason: ' + @dbReason, 0, SYSDATETIME()
         FROM dbo.UserAccounts 
         WHERE role_id = 4`
      );

      // Get assigned tables before committing to emit socket events
      const tablesReq = new sql.Request(transaction);
      tablesReq.input('resId', sql.Int, reservationId);
      const tablesRes = await tablesReq.query(
        `SELECT table_id FROM dbo.ReservationTables WHERE reservation_id = @resId`
      );
      const assignedTables = tablesRes.recordset;

      await transaction.commit();

      // Safe WebSocket Emission
      try {
        const io = getIO();
        if (io) {
          const payload = { reservation_id: reservationId, new_status: targetStatus, reason: dbReason };
          io.to("room:manager").emit("reservation:status_changed", payload);
          io.to("room:staff").emit("reservation:status_changed", payload);

          io.to("room:manager").emit("notification:new", {
            title: "Check-in Rejected",
            message: `Staff rejected reservation #${reservationId}. Reason: ${dbReason}`
          });

          // Notify table status changed to available for assigned tables
          for (const tbl of assignedTables) {
            io.to("room:manager").emit("table:status_changed", { table_id: tbl.table_id, new_status: 'Available' });
            io.to("room:staff").emit("table:status_changed", { table_id: tbl.table_id, new_status: 'Available' });
          }
        }
      } catch (socketErr) {
        console.error("[Socket.IO] Error emitting reject status:", socketErr);
      }

      // Fire-and-forget email
      try {
        const rawPool2 = await getRawPool();
        const emailInfoReq = new sql.Request(rawPool2);
        emailInfoReq.input('resId', sql.Int, reservationId);
        const emailInfoRes = await emailInfoReq.query(
          `SELECT COALESCE(ua.email, r.contact_email, N'') AS customer_email,
                  COALESCE(ua.full_name, r.contact_name, N'Guest') AS customer_name
           FROM dbo.Reservations r
           LEFT JOIN dbo.UserAccounts ua ON r.customer_id = ua.user_id
           WHERE r.reservation_id = @resId`
        );
        const row = emailInfoRes.recordset[0];
        if (row?.customer_email) {
          sendBookingRejectedEmail({
            toEmail: row.customer_email,
            customerName: row.customer_name,
            reservationId,
            reason: dbReason,
          }).catch(e => console.error("[rejectEmail]", e?.message));
        }
      } catch (emailErr) {
        console.error("[reject email query]", emailErr?.message);
      }

      return res.json({ success: true, message: `Reservation successfully rejected and set to ${targetStatus}.` });

    } catch (innerErr) {
      await transaction.rollback();
      throw innerErr;
    }

  } catch (error) {
    console.error('Error rejecting reservation:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// PATCH /api/staff/reservations/:id/checkout-confirm
// Staff manually confirms the checkout after payment auto-triggers CheckedOut.
// Inserts STAFF_CHECKOUT_CONFIRMED AuditLog row.
// ──────────────────────────────────────────────────────────────────────────────
export const confirmCheckout = async (req, res) => {
  const reservationId = req.params.id;
  const staffUserId = req.userId;

  try {
    const [staffRows] = await pool.query(
      `SELECT full_name FROM dbo.UserAccounts WHERE user_id = ?`,
      [staffUserId]
    );
    const staffName = staffRows[0]?.full_name || `Staff #${staffUserId}`;

    // Verify the reservation is in CheckedOut state
    const [resRows] = await pool.query(
      `SELECT reservation_status, checked_out_at FROM dbo.Reservations WHERE reservation_id = ?`,
      [reservationId]
    );
    if (!resRows.length) {
      return res.status(404).json({ success: false, message: 'Reservation not found.' });
    }
    if (resRows[0].reservation_status !== RESERVATION_STATUS.CHECK_OUT) {
      return res.status(409).json({
        success: false,
        message: `Reservation is '${resRows[0].reservation_status}', expected '${RESERVATION_STATUS.CHECK_OUT}'.`,
      });
    }

    const checkedOutAt = resRows[0].checked_out_at || new Date().toISOString();

    await pool.query(
      `INSERT INTO dbo.AuditLogs
         (user_id, action_name, target_table, target_id, new_value_json, ip_address, created_at)
       VALUES (?, N'STAFF_CHECKOUT_CONFIRMED', N'Reservations', ?, ?, ?, SYSDATETIME())`,
      [
        staffUserId,
        reservationId,
        JSON.stringify({ status: RESERVATION_STATUS.CHECK_OUT, staff_name: staffName, checked_out_at: checkedOutAt }),
        req.ip,
      ]
    );

    res.json({
      success: true,
      message: 'Checkout confirmed.',
      checked_out_at: checkedOutAt,
      staff_name: staffName,
    });
  } catch (error) {
    console.error('Error confirming checkout:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/staff/reservations/:reservationId/send-cooking-queue
// ──────────────────────────────────────────────────────────────────────────────
import { createOrder } from "../services/orderService.js";

export const sendCookingQueue = async (req, res) => {
  const reservationId = req.params.reservationId;
  const staffUserId = req.userId;

  try {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [resRows] = await connection.query(
        `SELECT r.reservation_id, r.reservation_status, r.customer_id, rt.table_id 
         FROM dbo.Reservations r
         LEFT JOIN dbo.ReservationTables rt ON r.reservation_id = rt.reservation_id
         WHERE r.reservation_id = ?`,
        [reservationId]
      );

      if (resRows.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ success: false, message: 'Reservation not found' });
      }

      const reservation = resRows[0];

      if (reservation.reservation_status !== RESERVATION_STATUS.OCCUPIED && reservation.reservation_status !== RESERVATION_STATUS.CHECK_IN) {
        await connection.rollback();
        connection.release();
        return res.status(409).json({
          success: false,
          message: `Cannot send cooking queue: reservation status is '${reservation.reservation_status}', must be 'Occupied' or 'Checked In'`
        });
      }

      const kdsResult = await processPreordersToKds(reservationId, connection, staffUserId);

      if (!kdsResult) {
        await connection.rollback();
        connection.release();
        return res.status(409).json({
          success: false,
          message: `No preorder items found, or cooking queue already sent. Cannot send twice.`
        });
      }

      const { orderId, itemCount } = kdsResult;

      // Note: processPreordersToKds already writes a system-auto AuditLog, but since this is manual,
      // we'll update that specific AuditLog to reflect manual action.
      await connection.query(
        `UPDATE dbo.AuditLogs 
         SET action_name = N'Staff Manual Send Cooking Queue',
             new_value_json = ? 
         WHERE user_id = ? AND target_id = ? AND target_table = N'Reservations' AND action_name = N'System Auto Send Cooking Queue' AND created_at >= DATEADD(minute, -1, SYSDATETIME())`,
        [JSON.stringify({ order_id: orderId, queued_items: itemCount, sent_by_staff: true }), staffUserId, reservationId]
      );

      await connection.commit();
      connection.release();

      const io = getIO();
      if (io) {
        const kitchenPayload = {
          reservation_id: parseInt(reservationId, 10),
          order_id: orderId,
          item_count: itemCount,
          sent_by: staffUserId,
          timestamp: new Date().toISOString(),
        };
        io.to('room:kitchen').emit('kitchen:new_preorder', kitchenPayload);
        io.to('room:manager').emit('kitchen:new_preorder', kitchenPayload);
        io.to('room:staff').emit('reservation:kitchen_sent', {
          reservation_id: parseInt(reservationId, 10),
          item_count: itemCount,
        });
      }

      res.json({
        success: true,
        message: `Sent ${itemCount} item(s) to kitchen queue as Order #${orderId}`,
        orderId
      });

    } catch (txError) {
      await connection.rollback();
      connection.release();
      throw txError;
    }
  } catch (error) {
    console.error('[staffReservationController] sendCookingQueue error:', error);
    res.status(500).json({ success: false, message: 'Failed to send cooking queue', error: error.message });
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// PATCH /api/staff/reservations/:id/check-in
// ──────────────────────────────────────────────────────────────────────────────
export const staffCheckIn = async (req, res) => {
  const staffUserId = req.userId;
  const reservationId = parseInt(req.params.id, 10);
  const newTableId = req.body?.table_id ? Number(req.body.table_id) : null;

  if (isNaN(reservationId)) {
    return res.status(400).json({ success: false, message: 'Invalid reservation ID' });
  }

  try {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Ensure reservation exists and is ready for check-in
      const [resRows] = await connection.query(
        `SELECT customer_id, reservation_status, table_ids = STUFF((SELECT ',' + CAST(table_id AS VARCHAR) FROM dbo.ReservationTables WHERE reservation_id = r.reservation_id FOR XML PATH('')), 1, 1, '')
         FROM dbo.Reservations r
         WHERE r.reservation_id = ?`,
        [reservationId]
      );

      if (resRows.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ success: false, message: 'Reservation not found' });
      }

      const reservation = resRows[0];

      const allowedFrom = [RESERVATION_STATUS.CONFIRMED, RESERVATION_STATUS.AWAIT_CHECK_IN, RESERVATION_STATUS.RESERVED];
      if (!allowedFrom.includes(reservation.reservation_status)) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ success: false, message: `Cannot check-in from status: ${reservation.reservation_status}` });
      }

      let tableIdList = [];

      if (newTableId) {
        // If a different table_id is passed, update the ReservationTables mapping
        const oldTableIds = reservation.table_ids ? reservation.table_ids.split(',').map(Number) : [];

        // GHOST TABLE FIX: Release ALL previous table assignments unconditionally,
        // not just those in 'Reserved' status. If a table was somehow already
        // 'Occupied' or in another state, still free it — the new assignment takes over.
        if (oldTableIds.length > 0) {
          const oldPlaceholders = oldTableIds.map(() => '?').join(',');
          await connection.query(
            `UPDATE dbo.RestaurantTables
             SET table_status = N'Available', updated_at = SYSDATETIME()
             WHERE table_id IN (${oldPlaceholders})`,
            [...oldTableIds]
          );

          await connection.query(
            `DELETE FROM dbo.ReservationTables WHERE reservation_id = ?`,
            [reservationId]
          );
        }

        // 2. Assign the new table
        await connection.query(
          `INSERT INTO dbo.ReservationTables (reservation_id, table_id, assigned_by_staff_id)
           VALUES (?, ?, ?)`,
          [reservationId, newTableId, staffUserId]
        );

        tableIdList = [newTableId];
      } else {
        if (!reservation.table_ids) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ success: false, message: 'Reservation has no assigned tables. Cannot check-in.' });
        }
        tableIdList = reservation.table_ids.split(',').map(Number);
      }

      // Update reservation status to Dining directly since they are checked-in with table assigned
      await connection.query(
        `UPDATE dbo.Reservations 
         SET reservation_status = ?, checked_in_at = SYSDATETIME(), updated_at = SYSDATETIME()
         WHERE reservation_id = ?`,
        [RESERVATION_STATUS.DINING, reservationId]
      );

      // CONCURRENCY GUARD: UPDLOCK on each target table prevents two concurrent
      // check-ins from both reading 'Available' and double-assigning the same table.
      if (tableIdList.length > 0) {
        const lockPlaceholders = tableIdList.map(() => '?').join(',');
        const [lockedRows] = await connection.query(
          `SELECT table_id, table_status
           FROM dbo.RestaurantTables WITH (UPDLOCK, ROWLOCK)
           WHERE table_id IN (${lockPlaceholders})`,
          [...tableIdList]
        );
        const alreadyOccupied = lockedRows.filter(r => r.table_status === 'Occupied');
        if (alreadyOccupied.length > 0) {
          await connection.rollback();
          connection.release();
          return res.status(409).json({
            success: false,
            message: `Table conflict: already Occupied by another check-in. Please select another table.`
          });
        }
      }

      // Update mapped tables to Occupied
      const placeholders = tableIdList.map(() => '?').join(',');
      await connection.query(
        `UPDATE dbo.RestaurantTables
         SET table_status = 'Occupied', updated_at = SYSDATETIME()
         WHERE table_id IN (${placeholders})`,
        [...tableIdList]
      );


      // Create QR Order Sessions for each table in tableIdList if none exists
      let firstSessionId = null;
      for (const tId of tableIdList) {
        const [activeSessionRows] = await connection.query(
          `SELECT TOP 1 qr_session_id
           FROM dbo.QROrderSessions
           WHERE table_id = ?
             AND session_status = N'Active'
             AND (expires_at IS NULL OR expires_at > SYSUTCDATETIME());`,
          [tId]
        );

        if (!activeSessionRows[0]) {
          const [tRows] = await connection.query(
            `SELECT table_number FROM dbo.RestaurantTables WHERE table_id = ?`,
            [tId]
          );
          const tNum = tRows[0]?.table_number || `T-${tId}`;

          const slug = String(tNum).trim().toLowerCase().replace(/\s+/g, "-");
          const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
          const token = `qr-session-${slug}-${stamp}`;

          const [insRes] = await connection.query(
            `INSERT INTO dbo.QROrderSessions
               (table_id, reservation_id, customer_id, token, session_status, generated_by_staff_id, generated_at, expires_at)
             OUTPUT INSERTED.qr_session_id AS session_id
             VALUES
               (?, ?, ?, ?, N'Active', ?, SYSDATETIME(), DATEADD(hour, 4, SYSDATETIME()));`,
            [tId, reservationId, reservation.customer_id || null, token, staffUserId]
          );

          if (insRes?.[0]?.session_id && !firstSessionId) {
            firstSessionId = insRes[0].session_id;
          }
        } else {
          firstSessionId = activeSessionRows[0].qr_session_id;
        }
      }

      // Process Preorders to KDS within the SAME transaction
      let kdsResult = null;
      try {
        kdsResult = await processPreordersToKds(reservationId, connection, staffUserId);
      } catch (kdsErr) {
        console.error("Auto-KDS error during check-in:", kdsErr.message);
        if (kdsErr.message.includes("No table assigned")) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({
            success: false,
            message: "Cannot check in: Please assign a table first so preorders can be sent to the kitchen."
          });
        }
        throw kdsErr;
      }

      // Insert into AuditLogs & ReservationTimelines
      const safeValueJson = JSON.stringify({ reservation_status: RESERVATION_STATUS.DINING });
      await connection.query(
        `INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, new_value_json, created_at)
         VALUES (?, 'STAFF_MANUAL_CHECKIN', 'Reservations', ?, ?, SYSDATETIME());
         
         INSERT INTO dbo.ReservationTimelines (reservation_id, event_type, performed_by, notes, created_at)
         VALUES (?, N'CHECK_IN', ?, N'Checked in and seated by staff', SYSDATETIME());`,
        [staffUserId, reservationId, safeValueJson, reservationId, staffUserId]
      );

      await connection.commit();

      // Emit sockets
      try {
        const io = getIO();
        if (io) {
          io.emit('RESERVATION_STATUS_CHANGED', { id: reservationId, status: RESERVATION_STATUS.DINING });
          tableIdList.forEach(tId => {
            io.emit('TABLE_STATUS_CHANGED', { tableId: tId, newStatus: 'Occupied' });
          });
          if (kdsResult) {
            const kitchenPayload = {
              reservation_id: reservationId,
              order_id: kdsResult.orderId,
              item_count: kdsResult.itemCount,
              sent_by: staffUserId,
              timestamp: new Date().toISOString(),
            };
            io.to('room:kitchen').emit('kitchen:new_preorder', kitchenPayload);
            io.to('room:manager').emit('kitchen:new_preorder', kitchenPayload);
            io.to('room:staff').emit('reservation:kitchen_sent', {
              reservation_id: reservationId,
              item_count: kdsResult.itemCount,
            });
          }
        }
      } catch (socketErr) {
        console.error("[Socket.IO] Error emitting checkin status:", socketErr);
      }

      // Send email asynchronously
      try {
        setImmediate(async () => {
          try {
            const [rows] = await pool.query(
              `SELECT COALESCE(ua.email, r.contact_email, N'') AS customer_email,
                      COALESCE(ua.full_name, r.contact_name, N'Guest') AS customer_name,
                      r.reservation_start_at
               FROM dbo.Reservations r
               LEFT JOIN dbo.UserAccounts ua ON r.customer_id = ua.user_id
               WHERE r.reservation_id = ?`,
              [reservationId]
            );
            const row = rows[0];
            if (row?.customer_email) {
              const d = new Date(row.reservation_start_at);
              await sendBookingCheckedInEmail({
                toEmail: row.customer_email,
                customerName: row.customer_name,
                reservationId,
                reservationDate: d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }),
                reservationTime: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
              });
            }
          } catch (emailInnerErr) {
            console.error("[checkin email query] Failed to send email:", emailInnerErr?.message || emailInnerErr);
          }
        });
      } catch (emailErr) {
        console.error("[Email Dispatch] Error kicking off email:", emailErr);
      }

      connection.release();
      res.json({
        success: true,
        message: 'Successfully checked in.',
        data: {
          session_id: firstSessionId
        }
      });

    } catch (txError) {
      await connection.rollback();
      connection.release();
      throw txError;
    }
  } catch (error) {
    console.error('[staffReservationController] staffCheckIn error:', error);
    res.status(500).json({ success: false, message: 'Failed to check in reservation' });
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/staff/reservations/:id/transfer
// Swap table assignments, migrate active Order and QR Session, log event.
// ──────────────────────────────────────────────────────────────────────────────
export const transferReservationTable = async (req, res) => {
  const reservationId = req.params.id;
  const staffUserId = req.userId;
  const { newTableId, surchargeAmount, transferReason } = req.body;

  if (!newTableId) {
    return res.status(400).json({ success: false, message: "newTableId is required." });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    // 1. Validation: Verify newTableId exists and is Available
    const [newTableRows] = await connection.query(
      `SELECT table_status FROM dbo.RestaurantTables WHERE table_id = ?`,
      [newTableId]
    );

    if (!newTableRows || newTableRows.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, message: "New table not found." });
    }

    if (newTableRows[0].table_status !== 'Available') {
      connection.release();
      return res.status(409).json({ success: false, message: `Conflict: Table ${newTableId} is not Available.` });
    }

    // Begin Transaction
    await connection.beginTransaction();

    // Find the oldTableId currently assigned
    const [oldTableRows] = await connection.query(
      `SELECT table_id FROM dbo.ReservationTables WHERE reservation_id = ?`,
      [reservationId]
    );

    if (!oldTableRows || oldTableRows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: "Reservation is not currently assigned to any table." });
    }

    const oldTableId = oldTableRows[0].table_id;

    // Step 1: Status Swap
    await connection.query(
      `UPDATE dbo.RestaurantTables SET table_status = N'Cleaning', updated_at = SYSDATETIME() WHERE table_id = ?`,
      [oldTableId]
    );
    await connection.query(
      `UPDATE dbo.RestaurantTables SET table_status = N'Occupied', updated_at = SYSDATETIME() WHERE table_id = ?`,
      [newTableId]
    );

    // Step 2: Data Migration
    await connection.query(
      `UPDATE dbo.ReservationTables SET table_id = ? WHERE reservation_id = ?`,
      [newTableId, reservationId]
    );
    await connection.query(
      `UPDATE dbo.Orders SET table_id = ?, updated_at = SYSDATETIME() WHERE reservation_id = ? AND order_status NOT IN (N'Billed', N'Paid', N'Cancelled')`,
      [newTableId, reservationId]
    );
    await connection.query(
      `UPDATE dbo.QROrderSessions SET table_id = ? WHERE reservation_id = ? AND session_status = N'Active'`,
      [newTableId, reservationId]
    );

    // Step 3: Surcharge Logic
    const surcharge = parseFloat(surchargeAmount) || 0;
    if (surcharge > 0) {
      // Fetch active order
      const [orderRows] = await connection.query(
        `SELECT TOP 1 order_id FROM dbo.Orders WHERE reservation_id = ? AND order_status = N'Open' ORDER BY created_at DESC`,
        [reservationId]
      );

      let orderId = null;

      if (orderRows && orderRows.length > 0) {
        orderId = orderRows[0].order_id;
      } else {
        // Auto-create an order
        const [resRows] = await connection.query(`SELECT customer_id FROM dbo.Reservations WHERE reservation_id = ?`, [reservationId]);
        const customerId = resRows[0]?.customer_id || null;

        const [newOrderRows] = await connection.query(
          `DECLARE @OutputTbl TABLE (order_id INT);
           INSERT INTO dbo.Orders (reservation_id, table_id, customer_id, created_by_staff_id, order_type, order_status, subtotal, total_amount, created_at, updated_at)
           OUTPUT INSERTED.order_id INTO @OutputTbl
           VALUES (?, ?, ?, ?, N'Dine In', N'Open', 0, 0, SYSDATETIME(), SYSDATETIME());
           SELECT order_id FROM @OutputTbl;`,
          [reservationId, newTableId, customerId, staffUserId]
        );
        orderId = newOrderRows[0].order_id;
      }

      if (orderId) {
        // Find a dummy surcharge dish or use first available dish
        const [dishRows] = await connection.query(
          `SELECT TOP 1 dish_id FROM dbo.Dishes WHERE dish_name LIKE N'%Surcharge%'
           UNION ALL
           SELECT TOP 1 dish_id FROM dbo.Dishes`
        );
        const dishId = dishRows?.[0]?.dish_id;

        if (dishId) {
          // Insert surcharge item
          await connection.query(
            `INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, item_status, notes, created_at, updated_at) 
             VALUES (?, ?, 1, ?, N'Served', ?, SYSDATETIME(), SYSDATETIME())`,
            [orderId, dishId, surcharge, transferReason || 'Table Transfer Surcharge']
          );

          // Trigger Order Math recalculation
          await connection.query(
            `UPDATE dbo.Orders 
             SET subtotal = (SELECT ISNULL(SUM(line_total), 0) FROM dbo.OrderItems WHERE order_id = ? AND item_status != N'Cancelled'),
                 total_amount = (SELECT ISNULL(SUM(line_total), 0) FROM dbo.OrderItems WHERE order_id = ? AND item_status != N'Cancelled') + service_charge - discount_amount,
                 updated_at = SYSDATETIME()
             WHERE order_id = ?`,
            [orderId, orderId, orderId]
          );
        }
      }
    }

    // Step 4: Logging
    await connection.query(
      `INSERT INTO dbo.ReservationTimelines (reservation_id, event_type, performed_by, notes) 
       VALUES (?, N'TABLE_TRANSFERRED', ?, ?)`,
      [reservationId, staffUserId, transferReason || `Transferred from table ${oldTableId} to ${newTableId}`]
    );

    // Audit Log
    await connection.query(
      `INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, old_value_json, new_value_json, ip_address, created_at)
       VALUES (?, N'TRANSFER_TABLE', N'Reservations', ?, ?, ?, ?, SYSDATETIME())`,
      [
        staffUserId,
        reservationId,
        JSON.stringify({ table_id: oldTableId }),
        JSON.stringify({ table_id: newTableId, surcharge }),
        req.ip || null
      ]
    );

    // Commit transaction
    await connection.commit();
    connection.release();

    // Step 4b: Emit WebSockets
    try {
      const io = getIO();
      if (io) {
        io.to('room:manager').emit('table:status_changed', { table_id: oldTableId, new_status: 'Cleaning' });
        io.to('room:staff').emit('table:status_changed', { table_id: oldTableId, new_status: 'Cleaning' });

        io.to('room:manager').emit('table:status_changed', { table_id: newTableId, new_status: 'Occupied' });
        io.to('room:staff').emit('table:status_changed', { table_id: newTableId, new_status: 'Occupied' });

        io.to('room:manager').emit('reservation:status_changed', { reservation_id: parseInt(reservationId, 10), table_id: newTableId });
        io.to('room:staff').emit('reservation:status_changed', { reservation_id: parseInt(reservationId, 10), table_id: newTableId });

        io.emit('order:updated', { reservation_id: parseInt(reservationId, 10) });
      }
    } catch (socketErr) {
      console.error("[Socket.IO] Error emitting transfer status:", socketErr);
    }

    return res.status(200).json({
      success: true,
      message: `Successfully transferred reservation to table ${newTableId}.`
    });

  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackErr) {
        console.error("Rollback failed:", rollbackErr);
      }
      connection.release();
    }
    console.error('Error transferring table:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};


