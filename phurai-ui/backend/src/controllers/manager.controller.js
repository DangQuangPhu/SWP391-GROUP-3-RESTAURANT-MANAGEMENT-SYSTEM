import { query, withTransaction }       from '../config/db.js';
import { saveNotification, TYPE }       from '../services/notification.service.js';
import { writeAudit, ACTION }           from '../services/audit.service.js';
import { createError }                  from '../middleware/errorHandler.js';
import { RESERVATION_STATUS }           from '../constants/reservationStatus.js';

export async function listReservations(req, res, next) {
  try {
    const { status, date } = req.query;

    const statusFilter = status ? `AND r.reservation_status = @Status` : '';
    const dateFilter   = date   ? `AND CAST(r.reservation_start_at AS DATE) = @Date` : '';

    const rows = await query(
      `SELECT
         r.reservation_id,
         r.created_at              AS submitted_at,
         r.reservation_start_at,
         r.reservation_end_at,
         r.guest_count,
         r.special_request,
         r.reservation_status,
         r.reservation_source,
         r.confirmed_by_staff_id,
         r.confirmed_at,
         r.checked_in_at,
         r.cancelled_at,
         r.cancel_reason,
         COALESCE(ua.full_name, N'Walk-in Guest') AS customer_name,
         ua.phone            AS customer_phone,
         ua.email            AS customer_email,
         cp.username,
         cp.loyalty_points,
         ar.area_name,
         ar.area_type,
         confirmer.full_name AS confirmed_by_name,
         STRING_AGG(t.table_number, N', ')
           WITHIN GROUP (ORDER BY t.table_number) AS assigned_tables,
         STRING_AGG(CAST(rt.table_id AS NVARCHAR), N',')
           WITHIN GROUP (ORDER BY rt.table_id)    AS table_ids,
         (SELECT COUNT(*)
          FROM dbo.PreorderItems pi
          WHERE pi.reservation_id = r.reservation_id) AS preorder_count
       FROM dbo.Reservations r
       LEFT JOIN dbo.UserAccounts ua   ON r.customer_id           = ua.user_id
       LEFT JOIN dbo.CustomerProfiles cp ON r.customer_id         = cp.user_id
       LEFT JOIN dbo.RestaurantAreas ar  ON r.preferred_area_id   = ar.area_id
       LEFT JOIN dbo.ReservationTables rt ON r.reservation_id     = rt.reservation_id
       LEFT JOIN dbo.RestaurantTables t   ON rt.table_id          = t.table_id
       LEFT JOIN dbo.UserAccounts confirmer ON r.confirmed_by_staff_id = confirmer.user_id
       WHERE 1=1
         ${statusFilter}
         ${dateFilter}
       GROUP BY
         r.reservation_id, r.created_at, r.reservation_start_at, r.reservation_end_at,
         r.guest_count, r.special_request, r.reservation_status, r.reservation_source,
         r.confirmed_by_staff_id, r.confirmed_at, r.checked_in_at, r.cancelled_at,
         r.cancel_reason,
         ua.full_name, ua.phone, ua.email,
         cp.username, cp.loyalty_points,
         ar.area_name, ar.area_type,
         confirmer.full_name
       ORDER BY 
         CASE WHEN r.reservation_status = N'${RESERVATION_STATUS.PENDING_LEGACY}' THEN 0 ELSE 1 END ASC,
         r.created_at DESC`,
      { Status: status || null, Date: date || null }
    );

    return res.json({ reservations: rows, total: rows.length });
  } catch (err) { next(err); }
}

export async function getReservationDetail(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Reservation ID must be a number.' });

    const [reservation] = await query(
      `SELECT r.*,
              COALESCE(ua.full_name, N'Walk-in Guest') AS customer_name,
              ua.phone, ua.email, ua.avatar_url,
              cp.username, cp.loyalty_points, cp.preferences,
              ar.area_name, ar.area_type,
              cf.full_name AS confirmed_by_name, cf.email AS confirmed_by_email
       FROM dbo.Reservations r
       LEFT JOIN dbo.UserAccounts ua ON r.customer_id = ua.user_id
       LEFT JOIN dbo.CustomerProfiles cp ON r.customer_id = cp.user_id
       LEFT JOIN dbo.RestaurantAreas ar ON r.preferred_area_id = ar.area_id
       LEFT JOIN dbo.UserAccounts cf ON r.confirmed_by_staff_id = cf.user_id
       WHERE r.reservation_id = @ResId`,
      { ResId: id }
    );
    if (!reservation) throw createError(404, `Reservation #${id} not found.`);

    const tables = await query(
      `SELECT t.table_id, t.table_number, t.capacity, a.area_name, a.area_type
       FROM dbo.ReservationTables rt
       JOIN dbo.RestaurantTables t ON rt.table_id = t.table_id
       JOIN dbo.RestaurantAreas a ON t.area_id = a.area_id
       WHERE rt.reservation_id = @ResId`,
      { ResId: id }
    );

    const preorders = await query(
      `SELECT pi.preorder_item_id, pi.dish_id, pi.quantity, pi.unit_price, pi.notes,
              d.dish_name, d.description, d.price AS current_price, CONCAT('/api/dishes/', d.dish_id, '/image') AS image_url
       FROM dbo.PreorderItems pi
       JOIN dbo.Dishes d ON pi.dish_id = d.dish_id
       WHERE pi.reservation_id = @ResId`,
      { ResId: id }
    );

    const history = await query(
      `SELECT al.audit_log_id, al.action_name, al.created_at,
              al.old_value_json, al.new_value_json, al.ip_address,
              ua.full_name AS performed_by, ua.email AS performed_by_email,
              ro.role_name AS performed_by_role
       FROM dbo.AuditLogs al
       LEFT JOIN dbo.UserAccounts ua ON al.user_id = ua.user_id
       LEFT JOIN dbo.Roles ro ON ua.role_id = ro.role_id
       WHERE al.target_table = N'Reservations'
         AND al.target_id    = @ResId
       ORDER BY al.created_at ASC`,
      { ResId: id }
    );

    return res.json({ reservation, tables, preorders, history });
  } catch (err) { next(err); }
}

export async function confirmReservation(req, res, next) {
  try {
    const managerId = req.user.user_id;
    const id        = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Reservation ID must be a number.' });

    const { table_ids = [] } = req.body;

    const [existing] = await query(
      `SELECT reservation_id, reservation_status, reservation_start_at,
              customer_id, guest_count, preferred_area_id
       FROM dbo.Reservations WHERE reservation_id = @ResId`,
      { ResId: id }
    );
    if (!existing)                                  throw createError(404, `Reservation #${id} not found.`);
    if (existing.reservation_status !== RESERVATION_STATUS.PENDING_REQUEST && existing.reservation_status !== RESERVATION_STATUS.PENDING_LEGACY)  throw createError(409,
      `Cannot confirm. Current status is "${existing.reservation_status}".`);

    // Shift resolution removed

    const result = await withTransaction(async (tx) => {
      const updated = await tx(
        `UPDATE dbo.Reservations
         SET reservation_status    = N'${RESERVATION_STATUS.CONFIRMED}',
             confirmed_by_staff_id = @MgrId,
             confirmed_at          = SYSDATETIME(),
             updated_at            = SYSDATETIME()
         OUTPUT INSERTED.confirmed_at
         WHERE reservation_id    = @ResId
           AND (reservation_status = N'${RESERVATION_STATUS.PENDING_REQUEST}' OR reservation_status = N'${RESERVATION_STATUS.PENDING_LEGACY}')`,
        { MgrId: managerId, ResId: id }
      );
      if (updated.length === 0) throw createError(409, 'Reservation was already confirmed or cancelled.');
      const confirmedAt = updated[0].confirmed_at;

      let tableNumbers = 'TBD';
      let finalTableIds = [];
      const incomingTableIds = Array.isArray(table_ids) ? table_ids.map(Number).filter(Boolean) : [];

      if (incomingTableIds.length > 0) {
        finalTableIds = [incomingTableIds[0]];
      } else {
        const autoRes = await tx(
          `SELECT TOP 1 table_id FROM dbo.RestaurantTables WITH (UPDLOCK, ROWLOCK)
           WHERE table_status = N'Available' AND capacity >= @GuestCount
           ORDER BY capacity ASC`,
          { GuestCount: existing.guest_count }
        );
        if (autoRes.length > 0) {
          finalTableIds = [autoRes[0].table_id];
        }
      }

      if (finalTableIds.length > 0) {
        const oldAssignments = await tx(
          `SELECT table_id FROM dbo.ReservationTables WHERE reservation_id = @ResId`,
          { ResId: id }
        );
        for (const { table_id } of oldAssignments) {
          await tx(
            `UPDATE dbo.RestaurantTables SET table_status = N'Available', updated_at = SYSDATETIME()
             WHERE table_id = @Tid AND table_status = N'Reserved'`,
            { Tid: table_id }
          );
        }
        await tx(`DELETE FROM dbo.ReservationTables WHERE reservation_id = @ResId`, { ResId: id });

        const tNums = [];
        for (const tid of finalTableIds) {
          const tCheck = await tx(
            `SELECT table_id, table_number FROM dbo.RestaurantTables WHERE table_id = @Tid`,
            { Tid: tid }
          );
          if (tCheck.length === 0) throw createError(400, `Table ID ${tid} does not exist.`);
          tNums.push(tCheck[0].table_number);

          await tx(
            `INSERT INTO dbo.ReservationTables
               (reservation_id, table_id, assigned_by_staff_id, assigned_at)
             VALUES (@ResId, @Tid, @MgrId, SYSDATETIME())`,
            { ResId: id, Tid: tid, MgrId: managerId }
          );
          await tx(
            `UPDATE dbo.RestaurantTables
             SET table_status = N'Reserved', updated_at = SYSDATETIME()
             WHERE table_id = @Tid`,
            { Tid: tid }
          );
        }
        tableNumbers = tNums.join(', ');
      }

      const [customer] = await tx(
        `SELECT ua.full_name, ua.phone
         FROM dbo.UserAccounts ua
         LEFT JOIN dbo.CustomerProfiles cp ON ua.user_id = cp.user_id
         WHERE ua.user_id = @CustId`,
        { CustId: existing.customer_id || 0 }
      );
      const custName = customer?.full_name || 'Walk-in Guest';
      const arrivalStr = new Date(existing.reservation_start_at).toLocaleString('en-GB');

      // Shift notifications removed
      await saveNotification(tx, {
        userId: managerId,
        type:   TYPE.BOOKING_CONFIRMED,
        title:  `You confirmed Reservation #${id}`,
        body:   `Reservation #${id} for ${custName} on ${arrivalStr} confirmed. ` +
                `Tables: ${tableNumbers}. Notified ${shiftStaff.length} ${shift.shift_name} staff.`,
      });

      if (existing.customer_id) {
        await saveNotification(tx, {
          userId: existing.customer_id,
          type:   TYPE.BOOKING_CONFIRMED,
          title:  'Your Reservation is Confirmed! ✓',
          body:   `Your reservation #${id} for ${arrivalStr} ` +
                  `(${existing.guest_count} guests, table ${tableNumbers}) ` +
                  `has been confirmed. We look forward to welcoming you!`,
        });
      }

      await writeAudit({
        user_id: managerId,
        action: ACTION.CONFIRM_RESERVATION,
        target_id: id,
        target_table: 'Reservations',
        oldValue: { reservation_status: existing.reservation_status, confirmed_by_staff_id: null },
        newValue: {
          reservation_status:    RESERVATION_STATUS.CONFIRMED,
          confirmed_by_staff_id: managerId,
          confirmed_at:          confirmedAt,
          assigned_table_ids:    finalTableIds,
          assigned_table_numbers: tableNumbers,
          shift_id:              shift.shift_id,
          shift_name:            shift.shift_name,
          notified_staff_count:  shiftStaff.length,
        }
      });

      return { confirmedAt, tableNumbers, shift, shiftStaff: shiftStaff.length, custName };
    });

    const io = req.app.get('io');
    if (io) {
      io.to('room:manager').emit('reservation:status_updated', {
        reservation_id: id,
        new_status:     RESERVATION_STATUS.CONFIRMED,
        confirmed_at:   result.confirmedAt,
      });
      io.to(`room:shift:${result.shift.shift_id}`).emit('reservation:confirmed', {
        reservation_id:      id,
        customer_name:       result.custName,
        reservation_start_at: existing.reservation_start_at,
        guest_count:         existing.guest_count,
        assigned_tables:     result.tableNumbers,
        shift_name:          result.shift.shift_name,
        message:             'Manager confirmed. Verify customer identity on walk-in.',
      });
    }

    return res.json({
      success:               true,
      reservation_id:        id,
      reservation_status:    RESERVATION_STATUS.CONFIRMED,
      confirmed_at:          result.confirmedAt,
      resolved_shift:        result.shift,
      notified_staff_count:  result.shiftStaff,
    });

  } catch (err) { next(err); }
}

export async function rejectReservation(req, res, next) {
  try {
    const managerId     = req.user.user_id;
    const id            = parseInt(req.params.id, 10);
    const { cancel_reason: reason } = req.body;

    if (isNaN(id))   return res.status(400).json({ error: 'Invalid reservation ID.' });
    if (!reason?.trim()) return res.status(400).json({ error: 'cancel_reason is required.' });

    const [existing] = await query(
      `SELECT reservation_id, reservation_status, customer_id, reservation_start_at
       FROM dbo.Reservations WHERE reservation_id = @ResId`,
      { ResId: id }
    );
    if (!existing)                                  throw createError(404, `Reservation #${id} not found.`);
    if (existing.reservation_status !== RESERVATION_STATUS.PENDING_REQUEST && existing.reservation_status !== RESERVATION_STATUS.PENDING_LEGACY)  throw createError(409,
      `Cannot reject. Status is "${existing.reservation_status}".`);

    await withTransaction(async (tx) => {
      const updated = await tx(
        `UPDATE dbo.Reservations
         SET reservation_status = N'${RESERVATION_STATUS.REJECT_REQUEST}',
             reject_reason      = @Reason,
             updated_at         = SYSDATETIME()
         OUTPUT INSERTED.updated_at
         WHERE reservation_id = @ResId AND (reservation_status = N'${RESERVATION_STATUS.PENDING_REQUEST}' OR reservation_status = N'${RESERVATION_STATUS.PENDING_LEGACY}')`,
        { Reason: reason, ResId: id }
      );

      const oldTables = await tx(
        `SELECT table_id FROM dbo.ReservationTables WHERE reservation_id = @ResId`,
        { ResId: id }
      );
      for (const { table_id } of oldTables) {
        await tx(
          `UPDATE dbo.RestaurantTables
           SET table_status = N'Available', updated_at = SYSDATETIME()
           WHERE table_id = @Tid AND table_status IN (N'Reserved')`,
          { Tid: table_id }
        );
      }

      if (existing.customer_id) {
        await saveNotification(tx, {
          userId: existing.customer_id,
          type:   TYPE.BOOKING_REJECTED,
          title:  'Reservation Could Not Be Confirmed',
          body:
            `We're sorry. Your reservation #${id} for ` +
            `${new Date(existing.reservation_start_at).toLocaleString('en-GB')} ` +
            `could not be confirmed. Reason: ${reason.trim()}. ` +
            `Please contact us or book a different time.`,
        });
      }

      await writeAudit(tx, {
        userId:   managerId,
        action: ACTION.REJECT_RESERVATION,
        target_id: id,
        target_table: 'Reservations',
        oldValue: { reservation_status: existing.reservation_status },
        newValue: {
          reservation_status:       RESERVATION_STATUS.REJECT_REQUEST,
          reject_reason:            reason,
          rejected_by:              managerId
        }
      });
    });

    const io = req.app.get('io');
    if (io) {
      io.to('room:manager').emit('reservation:status_updated', {
        reservation_id: id,
        new_status:     RESERVATION_STATUS.REJECT_REQUEST,
        cancel_reason:  reason.trim(),
      });
    }

    return res.json({ success: true, reservation_id: id, new_status: RESERVATION_STATUS.REJECT_REQUEST });

  } catch (err) { next(err); }
}

// ============================================================================
// PATCH /api/manager/reservations/:id/cancel
// Manager proactively cancels a Confirmed reservation before check-in.
// ============================================================================
export async function cancelReservationByManager(req, res, next) {
  try {
    const managerId = req.user.user_id;
    const id        = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid reservation ID.' });

    const { cancel_reason } = req.body;
    if (!cancel_reason || String(cancel_reason).trim().length < 5) {
      return res.status(400).json({ error: 'cancel_reason is required (minimum 5 characters).' });
    }

    const [existing] = await query(
      `SELECT r.reservation_id, r.reservation_status, r.customer_id,
              COALESCE(ua.full_name, r.contact_name, N'Guest') AS customer_name,
              COALESCE(ua.email, r.contact_email, N'')         AS customer_email
       FROM dbo.Reservations r
       LEFT JOIN dbo.UserAccounts ua ON r.customer_id = ua.user_id
       WHERE r.reservation_id = @ResId`,
      { ResId: id }
    );
    if (!existing) throw createError(404, `Reservation #${id} not found.`);

    const CANCELLABLE = [RESERVATION_STATUS.CONFIRMED, RESERVATION_STATUS.PENDING_REQUEST, RESERVATION_STATUS.PENDING_LEGACY];
    if (!CANCELLABLE.includes(existing.reservation_status)) {
      throw createError(409, `Cannot cancel reservation with status "${existing.reservation_status}".`);
    }

    await withTransaction(async (tx) => {
      const updated = await tx(
        `UPDATE dbo.Reservations
         SET reservation_status  = N'${RESERVATION_STATUS.CANCELLED}',
             cancel_reason       = @Reason,
             cancelled_by_manager = @MgrId,
             updated_at          = SYSDATETIME()
         OUTPUT INSERTED.updated_at
         WHERE reservation_id    = @ResId
           AND reservation_status IN (N'${RESERVATION_STATUS.CONFIRMED}', N'${RESERVATION_STATUS.PENDING_REQUEST}', N'${RESERVATION_STATUS.PENDING_LEGACY}')`,
        { Reason: cancel_reason, MgrId: managerId, ResId: id }
      );

      // Release tables
      const oldTables = await tx(
        `SELECT table_id FROM dbo.ReservationTables WHERE reservation_id = @ResId`,
        { ResId: id }
      );
      for (const { table_id } of oldTables) {
        await tx(
          `UPDATE dbo.RestaurantTables
           SET table_status = N'Available', updated_at = SYSDATETIME()
           WHERE table_id = @Tid`,
          { Tid: table_id }
        );
      }

      // In-app notification to customer
      if (existing.customer_id) {
        await saveNotification(tx, {
          userId: existing.customer_id,
          type:   TYPE.BOOKING_REJECTED,
          title:  'Your Reservation Has Been Cancelled',
          body:   `Your reservation #${id} has been cancelled by the restaurant. Reason: ${String(cancel_reason).trim()}.`,
        });
      }

      await writeAudit({
        user_id: managerId,
        action: ACTION.CANCEL_RESERVATION,
        target_id: id,
        target_table: 'Reservations',
        oldValue: { reservation_status: existing.reservation_status },
        newValue: { reservation_status: RESERVATION_STATUS.CANCELLED, cancel_reason: String(cancel_reason).trim(), cancelled_by_manager: managerId },
      });
    });

    const io = req.app.get('io');
    if (io) {
      io.to('room:manager').to('room:staff').emit('reservation:status_changed', {
        reservation_id: id, reservation_status: RESERVATION_STATUS.CANCELLED,
      });
      io.to(`room:customer:${existing.customer_id}`).emit('reservation:cancelled', { reservation_id: id });
    }

    return res.json({ success: true, reservation_id: id, reservation_status: RESERVATION_STATUS.CANCELLED });
  } catch (err) { next(err); }
}
