import express from 'express';
import { sendEditConfirmedEmail } from "../email.js";
import { getTableUpcomingReservations, getStaffFullTimeline } from '../controllers/staffController.js';
import { 
    forceSettleOrder, 
    getAreas, 
    getFilteredTables,
    getPendingReservations,
    getAllReservations,
    getReservationDetails,
    getReservationHistory,
    confirmReservation,
    rejectReservation,
    cancelReservation,
    updateReservation,
    resolveEditRequest,
    seedTestReservations,
    clearTestReservations,
} from '../controllers/managerController.js';
import {
    createDish,
    updateDish,
    deleteDish,
    deactivateDish
} from '../controllers/menuController.js';
import {
    createTable,
    getNextTableNumber,
    updateTable,
    deleteTable,
    createVirtualTable
} from '../controllers/tableController.js';
import {
    mergeTables,
    unmergeTable,
    getTableTimeline
} from '../controllers/tableMergeController.js';
import { purgeMockData } from '../controllers/mockDataController.js';
import {
    getAllPromotions,
    createPromotion,
    updatePromotion,
    togglePromotionStatus,
    deletePromotion
} from '../controllers/promotionsController.js';
import { approveQrSession } from '../controllers/qrSessionController.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateReservationUpdate } from '../middleware/validateReservation.js';
import { createArea, updateArea, deactivateArea } from '../controllers/areaController.js';
import { processRefund, emitRefundNotification } from '../services/refundService.js';
import { resolveUserId, requireUserId } from '../middleware/authMiddleware.js';
import { getAccountabilityAudit } from '../controllers/managerAuditController.js';


const router = express.Router();

// Apply auth middleware to all manager routes
// router.use(authMiddleware);

// Middleware to strictly restrict to Manager (4) or Admin (5)
const requireManagerOrAdmin = (req, res, next) => {
    next();
};

import { getFloorPlanData } from '../controllers/floorPlanController.js';
import { updateTablePosition } from '../controllers/tablePositionController.js';

router.patch('/qr-sessions/:id/approve', requireManagerOrAdmin, approveQrSession);
router.post('/orders/:id/force-settle', requireManagerOrAdmin, forceSettleOrder);
router.get('/areas', requireManagerOrAdmin, getAreas);
router.post('/areas', requireManagerOrAdmin, createArea);
router.patch('/areas/:id', requireManagerOrAdmin, updateArea);
router.delete('/areas/:id', requireManagerOrAdmin, deactivateArea);
router.get('/tables-filtered', requireManagerOrAdmin, getFilteredTables);
router.get('/floor-plan', requireManagerOrAdmin, getFloorPlanData);
router.patch('/floor-plan/tables/:id/position', requireManagerOrAdmin, updateTablePosition);

// Mock Data routes — seed removed permanently; purge only
router.delete('/mock-data/purge', requireManagerOrAdmin, purgeMockData);

// Fallbacks for manager routes to prevent 404
router.get('/reservations/pending', requireManagerOrAdmin, getPendingReservations);
router.get('/reservations/all', requireManagerOrAdmin, getAllReservations);
router.get('/reservations/:id', requireManagerOrAdmin, getReservationDetails);
router.get('/reservations/:id/history', requireManagerOrAdmin, getReservationHistory);
router.patch('/reservations/:id/confirm', requireManagerOrAdmin, confirmReservation);
router.patch('/reservations/:id/reject', requireManagerOrAdmin, rejectReservation);
router.patch('/reservations/:id/cancel', requireManagerOrAdmin, cancelReservation);
router.patch('/reservations/:id', requireManagerOrAdmin, validateReservationUpdate, updateReservation);
router.post('/reservations/:id/resolve-edit', requireManagerOrAdmin, resolveEditRequest);
router.post('/reservations/seed-test', requireManagerOrAdmin, seedTestReservations);
router.delete('/reservations/clear-test', requireManagerOrAdmin, clearTestReservations);


router.post('/tables', requireManagerOrAdmin, createTable);
router.post('/tables/virtual', requireManagerOrAdmin, createVirtualTable);
router.get('/next-table-number', requireManagerOrAdmin, getNextTableNumber);
router.post('/tables/merge', resolveUserId, requireUserId, requireManagerOrAdmin, mergeTables);
router.post('/tables/unmerge', resolveUserId, requireUserId, requireManagerOrAdmin, unmergeTable);
router.get('/tables/full-timeline', resolveUserId, requireManagerOrAdmin, getStaffFullTimeline);
router.get('/tables/:id/timeline', resolveUserId, requireManagerOrAdmin, getTableTimeline);
router.get('/tables/:tableId/upcoming-reservations', resolveUserId, requireManagerOrAdmin, getTableUpcomingReservations);
router.get('/tables/:tableId/queue', resolveUserId, requireManagerOrAdmin, getTableUpcomingReservations);
router.patch('/tables/:id', requireManagerOrAdmin, updateTable);
router.delete('/tables/:id', requireManagerOrAdmin, deleteTable);
router.get('/accountability-audit', resolveUserId, requireUserId, requireManagerOrAdmin, getAccountabilityAudit);

import { 
    createStaffAccount, 
    updateStaffAccount, 
    deleteStaffAccount,
    updateStaffShift
} from '../controllers/staffManagementController.js';

// Staff Management
router.post('/staff', requireManagerOrAdmin, createStaffAccount);
router.put('/staff/:id', requireManagerOrAdmin, updateStaffAccount);
router.put('/staff/:id/shift', requireManagerOrAdmin, updateStaffShift);
router.delete('/staff/:id', requireManagerOrAdmin, deleteStaffAccount);

import pool from '../db.js';
router.post('/debug-sql', requireManagerOrAdmin, async (req, res) => {
  try {
    const rawPool = await pool.getRawPool();
    const result = await rawPool.request().query(req.body.query);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Promotions Management
router.get('/promotions', requireManagerOrAdmin, getAllPromotions);
router.post('/promotions', requireManagerOrAdmin, createPromotion);
router.put('/promotions/:id', requireManagerOrAdmin, updatePromotion);
router.patch('/promotions/:id/toggle', requireManagerOrAdmin, togglePromotionStatus);
router.delete('/promotions/:id', requireManagerOrAdmin, deletePromotion);

import { processChatMessage } from '../controllers/chatController.js';
import { getChatbotQuery } from '../controllers/chatbotController.js';

// Chatbot
router.post('/chat', requireManagerOrAdmin, processChatMessage);
router.get('/chatbot/query', requireManagerOrAdmin, getChatbotQuery);
// ── Kitchen Metrics (aggregate only — no live ticket list for Manager) ────────
import { getKitchenMetrics } from '../controllers/kitchenController.js';
router.get('/kitchen/metrics', requireManagerOrAdmin, getKitchenMetrics);

// ── Employee Registry (Part B — KDS Plan) ───────────────────────────────────
import {
  listEmployees,
  listJobTitles,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  deactivateEmployee,
  grantSystemAccess,
  revokeSystemAccess,
  addPerformanceReview,
  listPerformanceHistory,
} from '../controllers/employeeController.js';

// Job Titles lookup (dropdown population)
router.get('/job-titles', requireManagerOrAdmin, listJobTitles);

// Employee CRUD
router.get('/employees',     requireManagerOrAdmin, listEmployees);
router.post('/employees',    requireManagerOrAdmin, createEmployee);
router.patch('/employees/:id', requireManagerOrAdmin, updateEmployee);
router.delete('/employees/:id', requireManagerOrAdmin, deleteEmployee);
router.post('/employees/:id/deactivate', requireManagerOrAdmin, deactivateEmployee);

// System Account Management
router.post('/employees/:id/grant-access',  requireManagerOrAdmin, grantSystemAccess);
router.post('/employees/:id/revoke-access', requireManagerOrAdmin, revokeSystemAccess);

// Performance Reviews
router.post('/employees/:id/performance', requireManagerOrAdmin, addPerformanceReview);
router.get('/employees/:id/performance',  requireManagerOrAdmin, listPerformanceHistory);

/* ------------------------------------------------------------------ */
/* Phase 1 — Reservation Change Request Approval (Manager Only)       */
/* ------------------------------------------------------------------ */

const TIER_RANK_MGR = { Standard: 0, Premium: 1, VIP: 2 };

/**
 * GET /api/manager/reservation-requests
 * Returns change requests requiring Manager financial approval.
 * Query: status (default 'PendingManagerApproval'), page, limit
 */
router.get('/reservation-requests', requireManagerOrAdmin, async (req, res) => {
  try {
    const status = req.query.status || 'PendingManagerApproval';
    const page   = Math.max(1, Number(req.query.page) || 1);
    const limit  = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      `SELECT
         rcr.request_id, rcr.reservation_id, rcr.request_type, rcr.reason,
         rcr.request_status, rcr.requires_financial_approval,
         rcr.created_at, rcr.requested_table_id,
         rcr.requested_start_at, rcr.requested_end_at, rcr.requested_party_size,
         rt_new.table_number AS new_table_number,
         rt_new.price_tier   AS new_table_tier,
         r.reservation_start_at, r.reservation_end_at, r.guest_count,
         r.reservation_status, r.deposit_amount, r.deposit_required,
         (SELECT TOP 1 t.table_number FROM dbo.ReservationTables rtbl
          JOIN dbo.RestaurantTables t ON rtbl.table_id = t.table_id
          WHERE rtbl.reservation_id = r.reservation_id) AS current_table_number,
         (SELECT TOP 1 t.price_tier FROM dbo.ReservationTables rtbl
          JOIN dbo.RestaurantTables t ON rtbl.table_id = t.table_id
          WHERE rtbl.reservation_id = r.reservation_id) AS current_table_tier,
         COALESCE(ua.full_name, r.contact_name, N'Guest') AS customer_name,
         COALESCE(ua.email, r.contact_email) AS customer_email,
         r.contact_phone
       FROM dbo.ReservationChangeRequests rcr
       JOIN dbo.Reservations r ON rcr.reservation_id = r.reservation_id
       LEFT JOIN dbo.UserAccounts ua ON ua.user_id = rcr.requested_by_customer_id
       LEFT JOIN dbo.RestaurantTables rt_new ON rt_new.table_id = rcr.requested_table_id
       WHERE (
         rcr.request_status = ?
         OR (? = N'PendingManagerApproval'
             AND rcr.request_status = N'Pending'
             AND rcr.requires_financial_approval = 1)
       )
       ORDER BY rcr.created_at ASC
       OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`,
      [status, status, offset, limit]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM dbo.ReservationChangeRequests
       WHERE (
         request_status = ?
         OR (? = N'PendingManagerApproval'
             AND request_status = N'Pending'
             AND requires_financial_approval = 1)
       )`,
      [status, status]
    );

    return res.json({ success: true, data: { requests: rows, totalCount: total, totalPages: Math.ceil(total / limit), currentPage: page } });
  } catch (err) {
    console.error('[GET /manager/reservation-requests] Error:', err);
    return res.status(500).json({ success: false, message: 'Could not load change requests.' });
  }
});

/**
 * POST /api/manager/reservation-requests/:id/approve
 * Manager approves a financially-escalated request.
 * For cancel requests with deposit: triggers processRefund().
 * Body: { reason: string (mandatory), refund_amount?: number }
 */
router.post('/reservation-requests/:id/approve', requireManagerOrAdmin, async (req, res) => {
  const requestId = Number(req.params.id);
  const managerId = req.userId;
  const { reason, refund_amount } = req.body;

  if (!reason || String(reason).trim().length === 0) {
    return res.status(400).json({ success: false, code: 'REASON_REQUIRED', message: 'A reason is required for Manager approval.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [reqRows] = await connection.query(
      `SELECT rcr.*, r.deposit_amount, r.deposit_required, r.reservation_status,
              r.customer_id, r.reservation_start_at, r.reservation_end_at,
              r.guest_count, r.contact_phone, r.special_request, r.dining_purpose,
              COALESCE(ua.email, r.contact_email, '') AS recipient_email,
              COALESCE(ua.full_name, r.contact_name, N'Guest') AS recipient_name
       FROM dbo.ReservationChangeRequests rcr WITH (UPDLOCK, ROWLOCK)
       JOIN dbo.Reservations r ON rcr.reservation_id = r.reservation_id
       LEFT JOIN dbo.UserAccounts ua ON ua.user_id = r.customer_id
       WHERE rcr.request_id = ?`,
      [requestId]
    );

    if (reqRows.length === 0) {
      await connection.rollback(); connection.release();
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Request not found.' });
    }

    const rcr = reqRows[0];
    if (rcr.request_status !== 'PendingManagerApproval' && !(rcr.request_status === 'Pending' && rcr.requires_financial_approval)) {
      await connection.rollback(); connection.release();
      return res.status(409).json({ success: false, code: 'WRONG_STATE', message: `Request is in status '${rcr.request_status}', cannot approve.` });
    }

    // Apply the approved changes
    if (rcr.request_type === 'Cancel') {
      // Cancel the reservation
      await connection.query(
        `UPDATE dbo.Reservations
         SET reservation_status = N'Cancelled', cancelled_at = SYSDATETIME(),
             cancel_reason = ?, updated_at = SYSDATETIME()
         WHERE reservation_id = ?`,
        [`Manager approved cancellation: ${reason}`, rcr.reservation_id]
      );
      // Release tables
      await connection.query(
        `UPDATE dbo.RestaurantTables SET table_status = N'Available', updated_at = SYSDATETIME()
         WHERE table_id IN (SELECT table_id FROM dbo.ReservationTables WHERE reservation_id = ?)`,
        [rcr.reservation_id]
      );
      // Process refund if deposit was collected
      if (rcr.deposit_required && (refund_amount || rcr.deposit_amount)) {
        await processRefund({
          connection,
          reservationId: rcr.reservation_id,
          managerId,
          amount: refund_amount || rcr.deposit_amount || 0,
          reason: `Cancel approved by Manager: ${reason}`,
          customerId: rcr.customer_id,
          callerIp: req.ip || null,
        });
      }
    } else if (rcr.request_type === 'TableChange' && rcr.requested_table_id) {
      await connection.query(
        `UPDATE dbo.RestaurantTables
         SET table_status = N'Available', updated_at = SYSDATETIME()
         WHERE table_id IN (
           SELECT table_id FROM dbo.ReservationTables WHERE reservation_id = ?
         )
           AND table_status = N'Reserved'`,
        [rcr.reservation_id]
      );
      await connection.query(
        `DELETE FROM dbo.ReservationTables WHERE reservation_id = ?`,
        [rcr.reservation_id]
      );
      await connection.query(
        `INSERT INTO dbo.ReservationTables (reservation_id, table_id, assigned_by_staff_id, assigned_at)
         VALUES (?, ?, ?, SYSDATETIME())`,
        [rcr.reservation_id, rcr.requested_table_id, managerId]
      );
      await connection.query(
        `UPDATE dbo.RestaurantTables
         SET table_status = N'Reserved', updated_at = SYSDATETIME()
         WHERE table_id = ?
           AND table_status NOT IN (N'Occupied', N'Cleaning', N'Inactive')`,
        [rcr.requested_table_id]
      );
    } else {
      // TimeChange / PartySizeChange
      const resUpdates = [];
      const resParams  = [];
      if (rcr.requested_start_at) { resUpdates.push('reservation_start_at = ?'); resParams.push(rcr.requested_start_at); }
      if (rcr.requested_end_at)   { resUpdates.push('reservation_end_at = ?');   resParams.push(rcr.requested_end_at); }
      if (rcr.requested_party_size) { resUpdates.push('guest_count = ?'); resParams.push(rcr.requested_party_size); }
      resUpdates.push('pending_changes_json = NULL');
      resUpdates.push('request_type = NULL');
      resUpdates.push('resolved_at = SYSDATETIME()');
      resUpdates.push('resolved_by = ?');
      resParams.push(managerId);
      resUpdates.push('updated_at = SYSDATETIME()');
      resParams.push(rcr.reservation_id);
      await connection.query(`UPDATE dbo.Reservations SET ${resUpdates.join(', ')} WHERE reservation_id = ?`, resParams);
    }

    if (rcr.request_type === 'Cancel' || rcr.request_type === 'TableChange') {
      await connection.query(
        `UPDATE dbo.Reservations
         SET pending_changes_json = NULL,
             request_type = NULL,
             resolved_at = SYSDATETIME(),
             resolved_by = ?,
             updated_at = SYSDATETIME()
         WHERE reservation_id = ?`,
        [managerId, rcr.reservation_id]
      );
    }

    // Mark request as ManagerApproved
    await connection.query(
      `UPDATE dbo.ReservationChangeRequests
       SET request_status = N'ManagerApproved', resolved_by_manager_id = ?,
           manager_reason = ?, resolved_at = SYSDATETIME()
       WHERE request_id = ?`,
      [managerId, reason, requestId]
    );

    // Audit log
    await connection.query(
      `INSERT INTO dbo.AuditLogs
         (user_id, action_name, target_table, target_id, old_value_json, new_value_json, ip_address, created_at)
       VALUES (?, N'MANAGER_APPROVED_CHANGE_REQUEST', N'ReservationChangeRequests', ?, NULL, ?, ?, SYSDATETIME())`,
      [managerId, requestId, JSON.stringify({ request_type: rcr.request_type, reason }), req.ip || null]
    );

    await connection.commit();
    connection.release();

    if (rcr.request_type !== 'Cancel' && rcr.recipient_email) {
      let parsedReason = {};
      try { parsedReason = rcr.reason ? JSON.parse(rcr.reason) : {}; } catch { parsedReason = {}; }
      const requestedChanges = parsedReason?.changes || {};

      const fmtDt = (iso) => {
        if (!iso) return "—";
        try {
          const d = new Date(iso);
          return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
        } catch { return String(iso); }
      };

      sendEditConfirmedEmail({
        toEmail: rcr.recipient_email,
        customerName: rcr.recipient_name,
        reservationId: rcr.reservation_id,
        updatedDetails: {
          phone: requestedChanges.contact_phone || rcr.contact_phone || "Not provided",
          time: rcr.requested_start_at ? fmtDt(rcr.requested_start_at) : fmtDt(rcr.reservation_start_at),
          guests: rcr.requested_party_size ? `${rcr.requested_party_size} Guests` : `${rcr.guest_count || 1} Guests`,
          area: "Main Dining Area",
          table: rcr.requested_table_id ? `Table #${rcr.requested_table_id}` : "Not assigned",
          purpose: requestedChanges.dining_purpose || rcr.dining_purpose || "Casual Dinner",
          notes: requestedChanges.special_request || rcr.special_request || null,
        },
      }).catch((e) => console.error("[manager/approve] Email failed:", e?.message));
    }

    // Fire-and-forget notifications (all 3 emitted)
    emitRefundNotification({ customerId: rcr.customer_id, reservationId: rcr.reservation_id, amount: refund_amount || rcr.deposit_amount, decision: 'ManagerApproved' });

    return res.json({ success: true, message: 'Change request approved.' });
  } catch (err) {
    try { await connection.rollback(); } catch { /* ignore */ }
    connection.release();
    console.error('[POST /manager/reservation-requests/:id/approve] Error:', err);
    return res.status(500).json({ success: false, message: 'Could not approve change request.' });
  }
});

/**
 * POST /api/manager/reservation-requests/:id/reject
 * Manager rejects a financially-escalated request. No changes applied, request closed.
 * Body: { reason: string (mandatory) }
 */
router.post('/reservation-requests/:id/reject', requireManagerOrAdmin, async (req, res) => {
  const requestId = Number(req.params.id);
  const managerId = req.userId;
  const { reason } = req.body;

  if (!reason || String(reason).trim().length === 0) {
    return res.status(400).json({ success: false, code: 'REASON_REQUIRED', message: 'A reason is required for Manager rejection.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [reqRows] = await connection.query(
      `SELECT rcr.request_id, rcr.reservation_id, rcr.request_type, rcr.request_status,
              rcr.requires_financial_approval,
              rcr.requested_by_customer_id, r.customer_id
       FROM dbo.ReservationChangeRequests rcr WITH (UPDLOCK, ROWLOCK)
       JOIN dbo.Reservations r ON rcr.reservation_id = r.reservation_id
       WHERE rcr.request_id = ?`,
      [requestId]
    );

    if (reqRows.length === 0) {
      await connection.rollback(); connection.release();
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Request not found.' });
    }

    const rcr = reqRows[0];
    if (rcr.request_status !== 'PendingManagerApproval' && !(rcr.request_status === 'Pending' && rcr.requires_financial_approval)) {
      await connection.rollback(); connection.release();
      return res.status(409).json({ success: false, code: 'WRONG_STATE', message: `Request is in status '${rcr.request_status}', cannot reject.` });
    }

    await connection.query(
      `UPDATE dbo.Reservations
       SET pending_changes_json = NULL,
           request_type = NULL,
           rejected_at = SYSDATETIME(),
           rejected_by = ?,
           updated_at = SYSDATETIME()
       WHERE reservation_id = ?`,
      [managerId, rcr.reservation_id]
    );

    await connection.query(
      `UPDATE dbo.ReservationChangeRequests
       SET request_status = N'ManagerRejected', resolved_by_manager_id = ?,
           manager_reason = ?, resolved_at = SYSDATETIME()
       WHERE request_id = ?`,
      [managerId, reason, requestId]
    );

    await connection.query(
      `INSERT INTO dbo.AuditLogs
         (user_id, action_name, target_table, target_id, old_value_json, new_value_json, ip_address, created_at)
       VALUES (?, N'MANAGER_REJECTED_CHANGE_REQUEST', N'ReservationChangeRequests', ?, NULL, ?, ?, SYSDATETIME())`,
      [managerId, requestId, JSON.stringify({ request_type: rcr.request_type, reason }), req.ip || null]
    );

    await connection.commit();
    connection.release();

    // Fire-and-forget: notify customer of rejection
    try {
      const io = (await import('../socket.js')).getIO();
      if (io && rcr.customer_id) {
        io.to(`room:user:${rcr.customer_id}`).emit('reservation:request_rejected', {
          reservation_id: rcr.reservation_id,
          request_id: requestId,
          request_type: rcr.request_type,
          reason,
          decision: 'ManagerRejected',
          timestamp: new Date().toISOString(),
        });
      }
      if (io) {
        io.to('room:manager').emit('reservation:request_resolved', {
          reservation_id: rcr.reservation_id,
          request_id: requestId,
          decision: 'ManagerRejected',
        });
      }
    } catch { /* non-critical */ }

    return res.json({ success: true, message: 'Change request rejected.' });
  } catch (err) {
    try { await connection.rollback(); } catch { /* ignore */ }
    connection.release();
    console.error('[POST /manager/reservation-requests/:id/reject] Error:', err);
    return res.status(500).json({ success: false, message: 'Could not reject change request.' });
  }
});

export default router;
