import { query, withTransaction } from '../config/db.js';
import { saveNotification, TYPE } from '../services/notification.service.js';
import { writeAudit, ACTION } from '../services/audit.service.js';
import { createError } from '../middleware/errorHandler.js';
import { getCustomerBalance } from '../services/loyaltyService.js';

import { RESERVATION_STATUS } from '../../../frontend/src/shared/reservationStatus.js';

export async function submitReservation(req, res, next) {
  try {
    const customerId = req.user.user_id;
    const {
      preferred_area_id,
      table_id,
      reservation_start_at,
      reservation_end_at,
      guest_count,
      special_request,
      occasion,
      dining_purpose,
      hold_time,
      preorder_items = [],
      voucher_code,
      // Guest contact fields — always stored directly in dbo.Reservations
      // so data is never lost regardless of whether the user is authenticated.
      guest_name,
      guest_phone,
      guest_email,
    } = req.body;

    const errors = [];
    if (!reservation_start_at) errors.push('reservation_start_at is required.');
    if (!reservation_end_at) errors.push('reservation_end_at is required.');
    if (!guest_count) errors.push('guest_count is required.');
    if (errors.length > 0) return res.status(400).json({ errors });

    const startAt = new Date(reservation_start_at);
    const endAt = new Date(reservation_end_at);

    if (isNaN(startAt.getTime())) return res.status(400).json({ error: 'reservation_start_at is not a valid date.' });
    if (isNaN(endAt.getTime())) return res.status(400).json({ error: 'reservation_end_at is not a valid date.' });
    if (endAt <= startAt) return res.status(400).json({ error: 'reservation_end_at must be after reservation_start_at.' });
    if (startAt <= new Date()) return res.status(400).json({ error: 'Reservation must be scheduled in the future.' });

    const guestNum = parseInt(guest_count, 10);
    if (isNaN(guestNum) || guestNum < 1 || guestNum > 12) {
      return res.status(400).json({ error: 'guest_count must be between 1 and 12.' });
    }

    let resolvedVoucher = null;
    if (voucher_code && String(voucher_code).trim() !== '') {
      const vRows = await query(
        `SELECT v.voucher_id, p.promotion_name, p.discount_type, p.discount_value
         FROM dbo.Vouchers v
         JOIN dbo.Promotions p ON v.promotion_id = p.promotion_id
         WHERE v.voucher_code  = @Code
           AND v.is_active     = 1
           AND p.is_active     = 1
           AND v.times_used    < v.usage_limit
           AND p.start_at     <= SYSDATETIME()
           AND p.end_at       >= SYSDATETIME()`,
        { Code: voucher_code.trim() }
      );
      if (vRows.length === 0) {
        return res.status(400).json({ error: `Voucher "${voucher_code}" is invalid, expired, or fully used.` });
      }
      resolvedVoucher = vRows[0];
    }

    const enrichedPreorders = [];
    for (const item of preorder_items) {
      if (!item.dish_id || !item.quantity || item.quantity < 1) {
        return res.status(400).json({ error: `Invalid preorder item: ${JSON.stringify(item)}` });
      }
      const dRows = await query(
        `SELECT dish_id, price FROM dbo.Dishes
         WHERE dish_id = @DishId AND is_available = 1 AND allow_preorder = 1`,
        { DishId: Number(item.dish_id) }
      );
      if (dRows.length === 0) {
        return res.status(400).json({
          error: `Dish ID ${item.dish_id} is not available for preorder.`
        });
      }
      enrichedPreorders.push({ ...item, unit_price: dRows[0].price });
    }

    const { reservationId } = await withTransaction(async (tx) => {
      // ── STEP 0: Time-based table conflict check (Option B) ──────────────────
      // If a specific table was requested, ensure no overlapping confirmed booking exists.
      if (table_id) {
        const conflictRows = await tx(
          `SELECT r.reservation_id
           FROM dbo.Reservations r
           JOIN dbo.ReservationTables rt ON rt.reservation_id = r.reservation_id
           WHERE rt.table_id = @Tid
             AND r.reservation_status NOT IN (N'Completed', N'Paid', N'Cancelled', N'No Show')
             AND r.reservation_start_at < @EndAt
             AND r.reservation_end_at   > @StartAt`,
          { Tid: Number(table_id), StartAt: startAt, EndAt: endAt }
        );
        if (conflictRows.length > 0) {
          throw createError(409,
            `Table ${table_id} is already booked during ${startAt.toLocaleString('vi-VN')} – ${endAt.toLocaleString('vi-VN')}. Please choose a different table or time.`
          );
        }
      }

      // Format special_request to embed dining purpose and hold time
      let formattedRequest = special_request ? special_request.trim() : '';
      if (hold_time) {
        formattedRequest = `[Hold: ${hold_time}]\n` + formattedRequest;
      }
      const finalPurpose = dining_purpose || occasion;
      if (finalPurpose) {
        formattedRequest = `[Dining Purpose: ${finalPurpose}]\n` + formattedRequest;
      }
      formattedRequest = formattedRequest.trim();

      // ── STEP 1: Insert reservation — status Confirmed immediately ────────────
      // Rule: Do NOT use OUTPUT INSERTED.* on tables that have DB triggers.
      // Safe pattern: INSERT first, then SELECT SCOPE_IDENTITY() for the new PK.
      await tx(
        `INSERT INTO dbo.Reservations
           (customer_id, preferred_area_id,
            reservation_start_at, reservation_end_at,
            guest_count, special_request,
            contact_name, contact_phone, contact_email,
            reservation_status, reservation_source,
            confirmed_at,
            created_at, updated_at)
         VALUES
           (@CustId, @AreaId,
            @StartAt, @EndAt,
            @Guests, @Request,
            @GuestName, @GuestPhone, @GuestEmail,
            N'Pending Payment', N'Online',
            SYSDATETIME(),
            SYSDATETIME(), SYSDATETIME())`,
        {
          CustId: customerId,
          AreaId: preferred_area_id ? Number(preferred_area_id) : null,
          StartAt: startAt,
          EndAt: endAt,
          Guests: guestNum,
          Request: formattedRequest || null,
          GuestName: guest_name || null,
          GuestPhone: guest_phone || null,
          GuestEmail: guest_email || null,
        }
      );

      // Fetch the new reservation_id safely after insert
      const idRows = await tx(`SELECT SCOPE_IDENTITY() AS reservation_id`);
      const reservationId = idRows[0]?.reservation_id;
      if (!reservationId) throw new Error('Failed to retrieve new reservation_id after INSERT.');

      // ── STEP 2: Assign & reserve the table immediately ───────────────────────
      let finalTableId = table_id ? Number(table_id) : null;
      if (!finalTableId) {
        const autoRes = await tx(
          `SELECT TOP 1 table_id FROM dbo.RestaurantTables WITH (UPDLOCK, ROWLOCK)
           WHERE table_status = N'Available' AND capacity >= @GuestCount
           ORDER BY capacity ASC`,
          { GuestCount: guestNum }
        );
        if (autoRes.length > 0) {
          finalTableId = autoRes[0].table_id;
        }
      }

      if (finalTableId) {
        const tRows = await tx(
          `SELECT table_id FROM dbo.RestaurantTables WHERE table_id = @Tid`,
          { Tid: finalTableId }
        );
        if (tRows.length === 0) {
          throw createError(400, `Table ID ${finalTableId} does not exist.`);
        }
        await tx(
          `INSERT INTO dbo.ReservationTables
             (reservation_id, table_id, assigned_by_staff_id, assigned_at)
           VALUES (@ResId, @Tid, NULL, SYSDATETIME())`,
          { ResId: reservationId, Tid: finalTableId }
        );
        // Mark the table as Reserved so it does not appear available in the map
        await tx(
          `UPDATE dbo.RestaurantTables
           SET table_status = N'Reserved', updated_at = SYSDATETIME()
           WHERE table_id = @Tid`,
          { Tid: finalTableId }
        );
      }

      // ── STEP 3: Pre-order items ───────────────────────────────────────────────
      for (const item of enrichedPreorders) {
        await tx(
          `INSERT INTO dbo.PreorderItems
             (reservation_id, dish_id, quantity, unit_price, notes, created_at)
           VALUES (@ResId, @DishId, @Qty, @Price, @Notes, SYSDATETIME())`,
          {
            ResId: reservationId,
            DishId: Number(item.dish_id),
            Qty: Number(item.quantity),
            Price: parseFloat(item.unit_price),
            Notes: item.notes || null,
          }
        );
      }

      // ── STEP 4: Notify Manager & Staff (informational, not approval needed) ──
      const allStaff = await tx(
        `SELECT user_id FROM dbo.UserAccounts WHERE role_id IN (2, 4) AND is_active = 1`
      );
      for (const s of allStaff) {
        await saveNotification(tx, {
          userId: s.user_id,
          type: TYPE.SYSTEM,
          title: 'New Reservation — Auto-Confirmed',
          body:
            `Reservation #${reservationId} from Customer ID ${customerId} is created and awaiting payment. ` +
            `${guestNum} guests · ${startAt.toLocaleString('en-GB')}` +
            (enrichedPreorders.length > 0 ? ` · ${enrichedPreorders.length} pre-order item(s)` : '') +
            (resolvedVoucher ? ` · Voucher: ${voucher_code}` : '') +
            `. Pending 15m timeout.`,
        });
      }

      // ── STEP 5: Audit Log ─────────────────────────────────────────────────────
      await writeAudit(tx, {
        userId: customerId,
        action: ACTION.RESERVATION_CREATED,
        table: 'Reservations',
        targetId: reservationId,
        newValue: {
          reservation_id: reservationId,
          status: 'Pending Payment',
          customer_id: customerId,
          start_at: startAt.toISOString(),
          guest_count: guestNum,
          table_id: table_id || null,
          preorder_count: enrichedPreorders.length,
          voucher_code: voucher_code || null,
          auto_confirmed: true,
        },
        ip: req.ip,
      });

      return { reservationId, finalTableId };
    });

    // ── Socket.IO broadcast ───────────────────────────────────────────────────
    const io = req.app.get('io');
    if (io) {
      io.to('room:manager').to('room:staff').emit('reservation:new', {
        reservation_id: reservationId,
        reservation_status: RESERVATION_STATUS.PENDING_PAYMENT,
        customer_id: customerId,
        reservation_start_at: startAt.toISOString(),
        guest_count: guestNum,
        preferred_area_id: preferred_area_id || null,
        table_id: table_id || null,
        has_preorder: enrichedPreorders.length > 0,
        has_voucher: !!resolvedVoucher,
        occasion: occasion || null,
      });
    }

    // ── 15-Minute Payment Timeout ─────────────────────────────────────────────
    setTimeout(async () => {
      try {
        // Check current status
        const rows = await query(
          `SELECT reservation_status FROM dbo.Reservations WHERE reservation_id = @ResId`,
          { ResId: reservationId }
        );
        if (rows && rows.length > 0 && rows[0].reservation_status === RESERVATION_STATUS.PENDING_PAYMENT) {
          // Cancel it
          await query(
            `UPDATE dbo.Reservations SET reservation_status = @Status, updated_at = SYSDATETIME() WHERE reservation_id = @ResId`,
            { Status: RESERVATION_STATUS.CANCELLED, ResId: reservationId }
          );

          // Free the table
          if (finalTableId) {
            await query(
              `UPDATE dbo.RestaurantTables SET table_status = N'Available', updated_at = SYSDATETIME() WHERE table_id = @Tid`,
              { Tid: finalTableId }
            );
          }

          // Broadcast cancellation
          if (io) {
            io.to('room:manager').to('room:staff').emit('reservation:updated', {
              reservation_id: reservationId,
              reservation_status: RESERVATION_STATUS.CANCELLED
            });
            if (finalTableId) {
              io.to('room:manager').to('room:staff').emit('table:status_updated', {
                table_id: finalTableId,
                status: 'Available'
              });
            }
          }
          console.log(`[TIMEOUT] Reservation ${reservationId} cancelled due to unpaid timeout. Table ${finalTableId} freed.`);
        }
      } catch (e) {
        console.error(`[TIMEOUT ERROR] Failed to auto-cancel reservation ${reservationId}:`, e);
      }
    }, 15 * 60 * 1000);

    return res.status(201).json({
      success: true,
      reservation_id: reservationId,
      reservation_status: RESERVATION_STATUS.PENDING_PAYMENT,
      message: 'Reservation created. Please complete payment within 15 minutes to hold your table.',
    });

  } catch (err) { next(err); }
}

export const getCustomerPaymentHistory = async (req, res) => {
    try {
        const userId = req.userId || req.user?.id || req.user?.user_id;
        
        if (!userId) {
            return res.status(401).json({ success: false, message: "User not authenticated." });
        }

        const queryStr = `
            SELECT 
                p.payment_id, p.amount_paid, p.payment_status, p.paid_at, p.transaction_ref, p.created_at,
                pm.method_name,
                CASE 
                    WHEN p.order_id IS NOT NULL THEN 'Order Payment'
                    WHEN p.reservation_id IS NOT NULL THEN 'Reservation Deposit'
                    ELSE 'Payment'
                END AS payment_purpose,
                o.order_id, o.order_type,
                r.reservation_id, r.reservation_start_at
            FROM dbo.Payments p
            LEFT JOIN dbo.PaymentMethods pm ON p.payment_method_id = pm.payment_method_id
            LEFT JOIN dbo.Orders o ON p.order_id = o.order_id
            LEFT JOIN dbo.Reservations r ON p.reservation_id = r.reservation_id
            WHERE o.customer_id = @userId OR r.customer_id = @userId
            ORDER BY p.created_at DESC;
        `;

        const result = await query(queryStr, { userId });

        return res.json({ success: true, payments: result || [] });
    } catch (err) {
        console.error('Error fetching customer payment history:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

export const getCustomerPaymentDetails = async (req, res) => {
    try {
        const userId = req.userId || req.user?.id || req.user?.user_id;
        const { paymentId } = req.params;
        
        if (!userId) {
            return res.status(401).json({ success: false, message: "User not authenticated." });
        }

        const paymentQuery = `
            SELECT 
                p.payment_id, p.amount_paid, p.change_given, p.payment_status, p.paid_at, p.transaction_ref, p.created_at,
                pm.method_name,
                o.order_id, o.order_status, o.subtotal AS total_amount, o.service_charge AS tax_amount, o.discount_amount, o.total_amount AS net_amount, o.order_type,
                r.reservation_id, r.reservation_status, r.reservation_start_at, r.guest_count, r.special_request,
                t.table_number, t.seating_capacity
            FROM dbo.Payments p
            LEFT JOIN dbo.PaymentMethods pm ON p.payment_method_id = pm.payment_method_id
            LEFT JOIN dbo.Orders o ON p.order_id = o.order_id
            LEFT JOIN dbo.Reservations r ON p.reservation_id = r.reservation_id
            LEFT JOIN dbo.RestaurantTables t ON r.table_id = t.table_id
            WHERE p.payment_id = @paymentId AND (o.customer_id = @userId OR r.customer_id = @userId)
        `;
        const payments = await query(paymentQuery, { paymentId, userId });
        
        if (!payments || payments.length === 0) {
            return res.status(404).json({ success: false, message: "Payment not found or unauthorized." });
        }
        
        const payment = payments[0];
        let items = [];

        if (payment.order_id) {
            const itemsQuery = `
                SELECT 
                    oi.order_item_id, oi.quantity, oi.unit_price, oi.line_total AS subtotal, oi.notes AS note,
                    d.dish_name AS item_name,
                    (SELECT TOP 1 image_url FROM dbo.DishImages di WHERE di.dish_id = d.dish_id AND di.is_primary = 1) AS image_url
                FROM dbo.OrderItems oi
                JOIN dbo.Dishes d ON oi.dish_id = d.dish_id
                WHERE oi.order_id = @orderId
            `;
            items = await query(itemsQuery, { orderId: payment.order_id });
        }

        return res.json({ success: true, payment, items });
    } catch (err) {
        console.error('Error fetching payment details:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

export const getCustomerDashboardSummary = async (req, res) => {
    try {
        const userId = req.userId || req.user?.id || req.user?.user_id;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized." });

        const { startDate, endDate } = req.query;
        let startVal = startDate ? new Date(startDate) : null;
        let endVal = endDate ? new Date(endDate) : null;
        if (startVal && isNaN(startVal.getTime())) startVal = null;
        if (endVal && isNaN(endVal.getTime())) endVal = null;

        let dateFilter = "";
        let prevDateFilter = "";
        let prevStartVal = null;
        let prevEndVal = null;

        if (startVal && endVal) {
            dateFilter = " AND created_at >= @startDate AND created_at <= @endDate ";
            prevDateFilter = " AND created_at >= @prevStartDate AND created_at <= @prevEndDate ";
            
            const diffMs = endVal.getTime() - startVal.getTime();
            prevStartVal = new Date(startVal.getTime() - diffMs);
            prevEndVal = new Date(endVal.getTime() - diffMs);
        } else {
            prevDateFilter = " AND created_at < DATEADD(day, -30, GETDATE()) ";
        }

        // 1. Total Reservations
        const resQuery = `SELECT COUNT(*) AS total FROM dbo.Reservations WHERE customer_id = @userId AND reservation_status != N'Cancelled' ${dateFilter}`;
        const resPrevQuery = `SELECT COUNT(*) AS total FROM dbo.Reservations WHERE customer_id = @userId AND reservation_status != N'Cancelled' ${prevDateFilter}`;
        
        let sparkEndDate = endVal || new Date();
        const resSparkQuery = `SELECT CAST(created_at AS DATE) as date, COUNT(*) as count FROM dbo.Reservations WHERE customer_id = @userId AND reservation_status != N'Cancelled' AND created_at >= DATEADD(day, -7, @sparkEndDate) AND created_at <= @sparkEndDate GROUP BY CAST(created_at AS DATE) ORDER BY date ASC`;
        
        // 2. Total Orders
        const ordQuery = `SELECT COUNT(*) AS total FROM dbo.Orders WHERE customer_id = @userId ${dateFilter}`;
        const ordPrevQuery = `SELECT COUNT(*) AS total FROM dbo.Orders WHERE customer_id = @userId ${prevDateFilter}`;
        const ordSparkQuery = `SELECT CAST(created_at AS DATE) as date, COUNT(*) as count FROM dbo.Orders WHERE customer_id = @userId AND created_at >= DATEADD(day, -7, @sparkEndDate) AND created_at <= @sparkEndDate GROUP BY CAST(created_at AS DATE) ORDER BY date ASC`;

        // 3. Total Expenditure
        let pDateFilter = "";
        let pPrevDateFilter = "";
        if (startVal && endVal) {
            pDateFilter = " AND p.created_at >= @startDate AND p.created_at <= @endDate ";
            pPrevDateFilter = " AND p.created_at >= @prevStartDate AND p.created_at <= @prevEndDate ";
        } else {
            pPrevDateFilter = " AND p.created_at < DATEADD(day, -30, GETDATE()) ";
        }
        const expQuery = `SELECT SUM(p.amount_paid) AS total FROM dbo.Payments p LEFT JOIN dbo.Orders o ON p.order_id = o.order_id LEFT JOIN dbo.Reservations r ON p.reservation_id = r.reservation_id WHERE p.payment_status = N'Completed' AND (o.customer_id = @userId OR r.customer_id = @userId) ${pDateFilter}`;
        const expPrevQuery = `SELECT SUM(p.amount_paid) AS total FROM dbo.Payments p LEFT JOIN dbo.Orders o ON p.order_id = o.order_id LEFT JOIN dbo.Reservations r ON p.reservation_id = r.reservation_id WHERE p.payment_status = N'Completed' AND (o.customer_id = @userId OR r.customer_id = @userId) ${pPrevDateFilter}`;
        const expSparkQuery = `SELECT CAST(p.created_at AS DATE) as date, SUM(p.amount_paid) as count FROM dbo.Payments p LEFT JOIN dbo.Orders o ON p.order_id = o.order_id LEFT JOIN dbo.Reservations r ON p.reservation_id = r.reservation_id WHERE p.payment_status = N'Completed' AND (o.customer_id = @userId OR r.customer_id = @userId) AND p.created_at >= DATEADD(day, -7, @sparkEndDate) AND p.created_at <= @sparkEndDate GROUP BY CAST(p.created_at AS DATE) ORDER BY date ASC`;

        const safeQuery = async (q, params) => {
            try {
                return await query(q, params);
            } catch (err) {
                console.error(`[Dashboard] Query failed: ${q.substring(0, 50)}...`, err.message || err);
                return [];
            }
        };

        const queryParams = { 
            userId, 
            startDate: startVal, 
            endDate: endVal, 
            prevStartDate: prevStartVal, 
            prevEndDate: prevEndVal,
            sparkEndDate
        };

        const [
            reservations, prevReservations, resSpark,
            orders, prevOrders, ordSpark,
            expenditures, prevExpenditures, expSpark
        ] = await Promise.all([
            safeQuery(resQuery, queryParams), safeQuery(resPrevQuery, queryParams), safeQuery(resSparkQuery, queryParams),
            safeQuery(ordQuery, queryParams), safeQuery(ordPrevQuery, queryParams), safeQuery(ordSparkQuery, queryParams),
            safeQuery(expQuery, queryParams), safeQuery(expPrevQuery, queryParams), safeQuery(expSparkQuery, queryParams)
        ]);

        const loyaltyBalanceData = await getCustomerBalance(userId);
        const totalLoyaltyPoints = loyaltyBalanceData.balance || 0;

        const calcDelta = (curr, prev) => {
            if (!prev || prev === 0) return null;
            return ((curr - prev) / prev) * 100;
        };

        const generateSparklineArray = (data) => {
            const arr = Array(7).fill(0);
            const targetEnd = new Date(sparkEndDate);
            targetEnd.setHours(0,0,0,0);
            if (data && data.length > 0) {
                data.forEach(row => {
                    const d = new Date(row.date);
                    d.setHours(0,0,0,0);
                    const diffTime = Math.abs(targetEnd - d);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays < 7) {
                        arr[6 - diffDays] = row.count || 0;
                    }
                });
            }
            return arr;
        };

        const totalReservations = reservations[0]?.total || 0;
        const totalOrders = orders[0]?.total || 0;
        const totalExpenditure = expenditures[0]?.total || 0;

        return res.json({
            totalReservations: {
                value: totalReservations,
                deltaPercent: calcDelta(totalReservations, prevReservations[0]?.total || 0),
                sparkline: generateSparklineArray(resSpark)
            },
            totalOrders: {
                value: totalOrders,
                deltaPercent: calcDelta(totalOrders, prevOrders[0]?.total || 0),
                sparkline: generateSparklineArray(ordSpark)
            },
            totalExpenditure: {
                value: totalExpenditure,
                deltaPercent: calcDelta(totalExpenditure, prevExpenditures[0]?.total || 0),
                sparkline: generateSparklineArray(expSpark)
            },
            totalLoyaltyPoints: {
                value: totalLoyaltyPoints,
                deltaPercent: null,
                sparkline: []
            }
        });
    } catch (err) {
        console.error('Error fetching dashboard summary:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

export const getCustomerExpenditureTrend = async (req, res) => {
    try {
        const userId = req.userId || req.user?.id || req.user?.user_id;
        const { range = '6m', startDate, endDate } = req.query;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized." });

        let monthsBack = 6;
        if (range === '1y') monthsBack = 12;

        let startVal = startDate ? new Date(startDate) : null;
        let endVal = endDate ? new Date(endDate) : null;
        if (startVal && isNaN(startVal.getTime())) startVal = null;
        if (endVal && isNaN(endVal.getTime())) endVal = null;

        let dateFilter = "";
        let grouping = "yyyy-MM";

        if (startVal && endVal) {
            dateFilter = " AND p.created_at >= @startDate AND p.created_at <= @endDate ";
            
            const diffDays = Math.ceil(Math.abs(endVal - startVal) / (1000 * 60 * 60 * 24));
            if (diffDays <= 1) {
                grouping = "HH:00";
            } else if (diffDays <= 31) {
                grouping = "yyyy-MM-dd";
            }
        } else {
            dateFilter = " AND p.created_at >= DATEADD(month, -@monthsBack, GETDATE()) ";
        }

        const trendQuery = `
            SELECT 
                FORMAT(p.created_at, '${grouping}') AS month,
                SUM(p.amount_paid) AS total
            FROM dbo.Payments p
            LEFT JOIN dbo.Orders o ON p.order_id = o.order_id
            LEFT JOIN dbo.Reservations r ON p.reservation_id = r.reservation_id
            WHERE p.payment_status = N'Completed' 
              AND (o.customer_id = @userId OR r.customer_id = @userId)
              ${dateFilter}
            GROUP BY FORMAT(p.created_at, '${grouping}')
            ORDER BY month ASC
        `;
        
        let result = [];
        try {
            result = await query(trendQuery, { userId, monthsBack, startDate: startVal, endDate: endVal });
        } catch (err) {
            console.error('[Dashboard] Expenditure Trend Query failed:', err.message || err);
        }
        return res.json({ success: true, trend: result || [] });
    } catch (err) {
        console.error('Error fetching expenditure trend:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

export const getCustomerOrdersByCategory = async (req, res) => {
    try {
        const userId = req.userId || req.user?.id || req.user?.user_id;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized." });

        const { startDate, endDate } = req.query;
        let startVal = startDate ? new Date(startDate) : null;
        let endVal = endDate ? new Date(endDate) : null;
        if (startVal && isNaN(startVal.getTime())) startVal = null;
        if (endVal && isNaN(endVal.getTime())) endVal = null;

        let dateFilter = "";
        if (startVal && endVal) {
            dateFilter = " AND o.created_at >= @startDate AND o.created_at <= @endDate ";
        }

        const catQuery = `
            SELECT 
                mc.category_name as category,
                COUNT(oi.order_item_id) as count
            FROM dbo.OrderItems oi
            JOIN dbo.Orders o ON oi.order_id = o.order_id
            JOIN dbo.Dishes d ON oi.dish_id = d.dish_id
            JOIN dbo.MenuCategories mc ON d.category_id = mc.category_id
            WHERE o.customer_id = @userId ${dateFilter}
            GROUP BY mc.category_name
            ORDER BY count DESC
        `;
        let result = [];
        try {
            result = await query(catQuery, { userId, startDate: startVal, endDate: endVal });
        } catch (err) {
            // Silently fallback to avoid terminal spam
        }

        return res.json({ success: true, categories: result || [] });
    } catch (err) {
        console.error('Error fetching categories:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

export const getCustomerRecentActivity = async (req, res) => {
    try {
        const userId = req.userId || req.user?.id || req.user?.user_id;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized." });

        const { startDate, endDate } = req.query;
        let startVal = startDate ? new Date(startDate) : null;
        let endVal = endDate ? new Date(endDate) : null;
        if (startVal && isNaN(startVal.getTime())) startVal = null;
        if (endVal && isNaN(endVal.getTime())) endVal = null;

        let dateFilter = "";
        if (startVal && endVal) {
            dateFilter = " AND created_at >= @startDate AND created_at <= @endDate ";
        }

        const actQuery = `
            SELECT TOP 10 * FROM (
                SELECT 
                    'order' AS type,
                    order_id AS id,
                    order_status AS status,
                    total_amount AS amount,
                    created_at
                FROM dbo.Orders
                WHERE customer_id = @userId ${dateFilter}
                
                UNION ALL
                
                SELECT 
                    'reservation' AS type,
                    reservation_id AS id,
                    reservation_status AS status,
                    final_total AS amount,
                    created_at
                FROM dbo.Reservations
                WHERE customer_id = @userId ${dateFilter}
            ) AS Combined
            ORDER BY created_at DESC
        `;
        
        let result = [];
        try {
            result = await query(actQuery, { userId, startDate: startVal, endDate: endVal });
        } catch (err) {
            // Silently fallback to avoid terminal spam
        }
        return res.json({ success: true, activity: result || [] });
    } catch (err) {
        console.error('Error fetching recent activity:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};
