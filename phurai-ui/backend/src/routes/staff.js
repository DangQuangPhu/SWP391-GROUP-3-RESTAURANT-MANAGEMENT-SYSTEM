import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import pool from "../db.js";
import { resolveUserId, requireUserId } from "../middleware/authMiddleware.js";
import { getIO } from "../socket.js";
import {
  listStaffTables,
  getStaffFullTimeline,
  checkInTable,
  resetTable,
  markTableClean,
  updateTableStatus,
  deleteStaffTable,
  getActiveOccupiedOrders,
  addOrderItem,
  updateOrderItemStatus,
  advanceTableCourseStage,
  voidOrderItem,
  listStaffMenuDishes,
  getTableBill,
  applyTablePromoCode,
  checkoutTablePayment,
  voidTableBill,
  splitOrderBill,
  payBillSplit,
  getKdsReadyQueue,
  getKdsDelayedItems,
  getShiftReportSummary,
  getShiftReportAudit,
  shiftCheckIn,
  shiftCheckOut,
  getOrderTimeline,
  verifyCustomerEmail,
  getTableUpcomingReservations,
  listTodayReservations,
} from "../controllers/staffController.js";

import {
  getTodayShiftReservations,
  getStaffReservationDetail,
  staffCheckIn,
  checkinReservation,
  rejectReservation,
  confirmCheckout,
  sendCookingQueue,
  transferReservationTable,
  assignTable,
  createWalkInReservation,
} from "../controllers/staffReservationController.js";
import { updateReservation } from "../controllers/managerReservationController.js";
import {
  mergeTables,
  unmergeTable,
  getTableTimeline,
  verifyClearTable,
} from "../controllers/tableMergeController.js";
import { parseReportIntent } from "../services/aiReportService.js";
import { fetchReportData } from "../services/reportExportService.js";
import { generateExcelBuffer, generatePdfBuffer } from "../services/fileExportService.js";
import { createVirtualTable } from "../controllers/tableController.js";
import { splitOrderItems } from "../controllers/staffOrderController.js";
import { approveQrSession, rejectQrSession } from "../controllers/qrSessionController.js";
import {
  createTableRequest,
  listTableRequests,
  resolveTableRequest,
  cancelOrderItem
} from "../controllers/tableRequestController.js";
import { sendEditConfirmedEmail } from "../email.js";

const router = express.Router();

router.patch("/qr-sessions/:id/approve", resolveUserId, requireUserId, approveQrSession);
router.patch("/qr-sessions/:id/reject", resolveUserId, requireUserId, rejectQrSession);

router.get("/tables", listStaffTables);
router.get("/tables/timeline", resolveUserId, getStaffFullTimeline);
// Compatibility endpoint used by the staff portal and operational runbooks.
// It must precede the parameterised reservation-detail route below.
router.get("/reservations/today", resolveUserId, listTodayReservations);
// Shift-scoped view removed
router.get("/reservations/today-shift", resolveUserId, requireUserId, getTodayShiftReservations);
router.get("/reservations/:id", resolveUserId, getStaffReservationDetail);
router.post(
  "/test-checkin/:id",
  (req, res, next) => {
    req.userId = 3;
    next();
  },
  staffCheckIn
);

router.post(
  "/reservations/:id/check-in",
  resolveUserId,
  requireUserId,
  staffCheckIn
);

router.post(
  "/reservations/:id/extend-hold",
  resolveUserId,
  requireUserId,
  handleExtendHoldRoute
);
router.patch(
  "/reservations/:id/extend-hold",
  resolveUserId,
  requireUserId,
  handleExtendHoldRoute
);

router.post(
  "/reservations/walk-in",
  resolveUserId,
  requireUserId,
  createWalkInReservation
);

router.post(
  "/reservations/:id/assign-table",
  resolveUserId,
  requireUserId,
  assignTable
);

router.patch(
  "/reservations/:id/check-in",
  resolveUserId,
  requireUserId,
  staffCheckIn
);
router.patch(
  "/reservations/:id/checkin",
  resolveUserId,
  requireUserId,
  staffCheckIn
);
router.patch(
  "/reservations/:id/reject",
  resolveUserId,
  requireUserId,
  rejectReservation
);
router.post(
  "/reservations/:id/transfer",
  resolveUserId,
  requireUserId,
  transferReservationTable
);
router.patch(
  "/reservations/:id/checkout-confirm",
  resolveUserId,
  requireUserId,
  confirmCheckout
);
router.post(
  "/reservations/:reservationId/send-cooking-queue",
  resolveUserId,
  requireUserId,
  sendCookingQueue
);
router.post("/tables/:tableId/check-in", (req, res) => {
  return res.status(400).json({
    success: false,
    message: "Direct table check-in is deprecated. Please check in via the customer's reservation."
  });
});
router.post("/tables/:tableId/reset", resolveUserId, requireUserId, resetTable);
router.put("/tables/:tableId/mark-clean", resolveUserId, requireUserId, markTableClean);
router.patch("/tables/:tableId/status", resolveUserId, requireUserId, updateTableStatus);
router.delete("/tables/:tableId", resolveUserId, requireUserId, deleteStaffTable);
router.post(
  "/tables/merge",
  resolveUserId,
  requireUserId,
  mergeTables
);

router.post(
  "/tables/virtual",
  resolveUserId,
  requireUserId,
  createVirtualTable
);
router.post("/tables/unmerge", resolveUserId, requireUserId, unmergeTable);
router.get("/tables/:tableId/timeline", resolveUserId, getTableTimeline);
router.get("/tables/:tableId/upcoming-reservations", resolveUserId, getTableUpcomingReservations);
router.post("/tables/:tableId/verify-clear", resolveUserId, requireUserId, verifyClearTable);

router.get("/orders/active", getActiveOccupiedOrders);
router.post("/orders/:tableId/items", resolveUserId, requireUserId, addOrderItem);
router.patch("/orders/items/:itemId/status", resolveUserId, requireUserId, updateOrderItemStatus);
router.patch("/orders/items/:itemId/void", resolveUserId, voidOrderItem);
router.patch("/tables/:tableId/stage/advance", resolveUserId, requireUserId, advanceTableCourseStage);
router.post("/orders/:orderId/split-items", resolveUserId, requireUserId, splitOrderItems);
router.get("/dishes/menu", listStaffMenuDishes);

router.post("/shifts/check-in", resolveUserId, requireUserId, shiftCheckIn);
router.post("/shifts/check-out", resolveUserId, requireUserId, shiftCheckOut);

router.patch("/payments/split/:splitId/pay", resolveUserId, requireUserId, payBillSplit);
router.post("/payments/:orderId/split", resolveUserId, requireUserId, splitOrderBill);
router.get("/payments/:tableId", getTableBill);
router.post("/payments/:tableId/voucher", resolveUserId, applyTablePromoCode);
router.post("/payments/:tableId/checkout", resolveUserId, requireUserId, checkoutTablePayment);
router.post("/payments/:tableId/void", resolveUserId, voidTableBill);

router.get("/orders/:orderId/timeline", resolveUserId, requireUserId, getOrderTimeline);
router.get("/customers/verify", verifyCustomerEmail);

router.get("/kds/ready", getKdsReadyQueue);
router.get("/kds/delayed", getKdsDelayedItems);
router.get("/reports/summary", getShiftReportSummary);
router.get("/reports/audit", getShiftReportAudit);

// UC-S09: Table requests (customer call-staff, cancel-item, extra-note)
router.post("/table-requests", resolveUserId, createTableRequest);
router.get("/table-requests", resolveUserId, requireUserId, listTableRequests);
router.patch("/table-requests/:logId/resolve", resolveUserId, requireUserId, resolveTableRequest);
router.post("/table-requests/cancel-item", resolveUserId, requireUserId, cancelOrderItem);

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function slugStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatDatePart(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatTimePart(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function parseDbDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function mapEmploymentStatus(status) {
  const s = String(status || "").toLowerCase();
  if (s === "on leave") return "on_leave";
  if (s === "resigned") return "inactive";
  return "active";
}

function derivePromoStatus(row, now = new Date()) {
  if (!row.is_active) return "disabled";
  const start = parseDbDate(row.start_at);
  const end = parseDbDate(row.end_at);
  if (start && now < start) return "scheduled";
  if (end && now > end) return "expired";
  return "active";
}

function mapDiscountType(type) {
  return String(type).toLowerCase() === "percent" ? "percent" : "amount";
}

function mapOrderStatus(status) {
  const s = String(status || "");
  if (s === "Served" || s === "Paid" || s === "Billed") return s === "Served" ? "served" : "done";
  if (s === "Partially Served" || s === "Sent To Kitchen" || s === "Open") return "in_progress";
  return "in_progress";
}

function mapKitchenAggregate(statuses, orderStatus) {
  const list = statuses.filter(Boolean);
  const os = String(orderStatus || "");
  if (os === "Served" || os === "Paid") return "done";
  if (list.some((s) => s === "Preparing")) return "cooking";
  if (list.some((s) => s === "Pending")) return "queued";
  if (list.length && list.every((s) => s === "Ready")) return "ready";
  return "queued";
}

function trendText(dir, text) {
  return { dir, text };
}

function jsonOk(res, data) {
  return res.json({ success: true, data });
}

function jsonError(res, message, status = 500) {
  return res.status(status).json({ success: false, message });
}

/* ------------------------------------------------------------------ */
/* GET /api/staff/overview                                             */
/* ------------------------------------------------------------------ */

router.get("/overview", async (_req, res) => {
  try {
    const [revenueTodayRows] = await pool.query(
      `SELECT ISNULL(SUM(p.amount_paid), 0) AS total
       FROM dbo.Payments p
       WHERE p.payment_status = N'Completed'
         AND p.paid_at IS NOT NULL
         AND CAST(p.paid_at AS DATE) = CAST(SYSDATETIME() AS DATE);`
    );

    const [revenueYesterdayRows] = await pool.query(
      `SELECT ISNULL(SUM(p.amount_paid), 0) AS total
       FROM dbo.Payments p
       WHERE p.payment_status = N'Completed'
         AND p.paid_at IS NOT NULL
         AND CAST(p.paid_at AS DATE) = DATEADD(day, -1, CAST(SYSDATETIME() AS DATE));`
    );

    const [reservationsTodayRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM dbo.Reservations r
       WHERE CAST(r.reservation_start_at AS DATE) = CAST(SYSDATETIME() AS DATE);`
    );

    const [occupiedRows] = await pool.query(
      `SELECT
         SUM(CASE WHEN t.table_status = N'Occupied' THEN 1 ELSE 0 END) AS occupied,
         COUNT(*) AS total
       FROM dbo.RestaurantTables t;`
    );

    const [pendingOrdersRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM dbo.Orders o
       WHERE o.order_status IN (N'Open', N'Sent To Kitchen', N'Partially Served');`
    );

    const [kitchenQueueRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM dbo.KitchenTickets kt
       WHERE kt.kitchen_status IN (N'Pending', N'Preparing');`
    );

    const [bestDishRows] = await pool.query(
      `SELECT TOP 1 d.dish_name, SUM(oi.quantity) AS qty_sold
       FROM dbo.OrderItems oi
       JOIN dbo.Orders o ON oi.order_id = o.order_id
       JOIN dbo.Dishes d ON oi.dish_id = d.dish_id
       WHERE o.order_status <> N'Cancelled'
         AND CAST(o.created_at AS DATE) = CAST(SYSDATETIME() AS DATE)
       GROUP BY d.dish_id, d.dish_name
       ORDER BY qty_sold DESC;`
    );

    const [activePromosRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM dbo.Promotions p
       WHERE p.is_active = 1
         AND p.start_at <= SYSDATETIME()
         AND p.end_at >= SYSDATETIME();`
    );

    const [ratingRows] = await pool.query(
      `SELECT AVG(CAST(cr.overall_rating AS DECIMAL(4,2))) AS avg_rating
       FROM dbo.CustomerReviews cr
       WHERE cr.is_visible = 1;`
    );

    const [monthStatsRows] = await pool.query(
      `SELECT
         COUNT(*) AS total_count,
         SUM(CASE WHEN r.reservation_status = N'Completed' THEN 1 ELSE 0 END) AS completed_count,
         SUM(CASE WHEN r.reservation_status = N'No Show' THEN 1 ELSE 0 END) AS noshow_count,
         AVG(CAST(r.guest_count AS DECIMAL(6,2))) AS avg_party
       FROM dbo.Reservations r
       WHERE r.reservation_start_at >= DATEFROMPARTS(YEAR(SYSDATETIME()), MONTH(SYSDATETIME()), 1);`
    );

    const [areaStatsRows] = await pool.query(
      `SELECT a.area_name AS area, COUNT(*) AS count
       FROM dbo.Reservations r
       LEFT JOIN dbo.RestaurantAreas a ON r.preferred_area_id = a.area_id
       WHERE r.reservation_start_at >= DATEFROMPARTS(YEAR(SYSDATETIME()), MONTH(SYSDATETIME()), 1)
       GROUP BY a.area_name
       ORDER BY count DESC;`
    );

    const [utilizationRows] = await pool.query(
      `SELECT
         a.area_name AS area,
         CASE WHEN COUNT(*) = 0 THEN 0
           ELSE ROUND(
             100.0 * SUM(CASE WHEN t.table_status IN (N'Occupied', N'Reserved') THEN 1 ELSE 0 END)
             / COUNT(*), 0)
         END AS utilization
       FROM dbo.RestaurantAreas a
       JOIN dbo.RestaurantTables t ON t.area_id = a.area_id
       WHERE a.is_active = 1
       GROUP BY a.area_name
       ORDER BY a.area_name;`
    );

    const revenueToday = toNumber(revenueTodayRows[0]?.total);
    const revenueYesterday = toNumber(revenueYesterdayRows[0]?.total);
    const reservationsToday = toNumber(reservationsTodayRows[0]?.total);
    const occupied = toNumber(occupiedRows[0]?.occupied);
    const tableTotal = toNumber(occupiedRows[0]?.total);
    const pendingOrders = toNumber(pendingOrdersRows[0]?.total);
    const kitchenQueue = toNumber(kitchenQueueRows[0]?.total);
    const bestDish = bestDishRows[0];
    const activePromos = toNumber(activePromosRows[0]?.total);
    const monthStatsRow = monthStatsRows[0];
    const ratingRow = ratingRows[0];
    const avgRating = ratingRow?.avg_rating != null ? toNumber(ratingRow.avg_rating).toFixed(1) : "—";

    const revenueTrendPct =
      revenueYesterday > 0
        ? (((revenueToday - revenueYesterday) / revenueYesterday) * 100).toFixed(1)
        : null;

    const totalMonth = toNumber(monthStatsRow?.total_count);
    const completedMonth = toNumber(monthStatsRow?.completed_count);
    const noshowMonth = toNumber(monthStatsRow?.noshow_count);

    const kpis = [
      {
        id: "revenue",
        label: "Today Revenue",
        value: revenueToday,
        format: "currency",
        icon: "wallet",
        trend: trendText(
          revenueToday >= revenueYesterday ? "up" : "down",
          revenueTrendPct != null ? `${revenueTrendPct}% vs yesterday` : "No prior day data"
        ),
        accent: "gold",
      },
      {
        id: "reservations",
        label: "Reservations Today",
        value: reservationsToday,
        format: "number",
        icon: "calendar",
        trend: trendText("flat", `${reservationsToday} scheduled`),
        accent: "blue",
      },
      {
        id: "occupied",
        label: "Occupied Tables",
        value: occupied,
        suffix: tableTotal ? ` / ${tableTotal}` : "",
        format: "number",
        icon: "grid",
        trend: trendText(
          "flat",
          tableTotal ? `${Math.round((occupied / tableTotal) * 100)}% capacity` : "—"
        ),
        accent: "green",
      },
      {
        id: "pendingOrders",
        label: "Pending Orders",
        value: pendingOrders,
        format: "number",
        icon: "receipt",
        trend: trendText("flat", `${pendingOrders} open tickets`),
        accent: "amber",
      },
      {
        id: "kitchen",
        label: "Kitchen Queue",
        value: kitchenQueue,
        format: "number",
        icon: "fire",
        trend: trendText(kitchenQueue > 0 ? "up" : "flat", `${kitchenQueue} in queue`),
        accent: "red",
      },
      {
        id: "bestDish",
        label: "Best-selling Dish",
        value: bestDish?.dish_name || "—",
        format: "text",
        icon: "star",
        trend: trendText("up", bestDish ? `${toNumber(bestDish.qty_sold)} sold today` : "No sales today"),
        accent: "gold",
      },
      {
        id: "promos",
        label: "Active Promotions",
        value: activePromos,
        format: "number",
        icon: "tag",
        trend: trendText("flat", `${activePromos} running now`),
        accent: "purple",
      },
      {
        id: "rating",
        label: "Customer Rating",
        value: avgRating,
        suffix: avgRating !== "—" ? " / 5" : "",
        format: "text",
        icon: "heart",
        trend: trendText("flat", "From visible reviews"),
        accent: "green",
      },
    ];

    const reservationStats = {
      totalThisMonth: totalMonth,
      completionRate: totalMonth ? Math.round((completedMonth / totalMonth) * 100) : 0,
      noShowRate: totalMonth ? Math.round((noshowMonth / totalMonth) * 100) : 0,
      avgPartySize: monthStatsRow?.avg_party != null ? toNumber(monthStatsRow.avg_party, 0) : 0,
      byArea: areaStatsRows.map((row) => ({
        area: row.area || "Unassigned",
        count: toNumber(row.count),
      })),
    };

    const tableUtilization = utilizationRows.map((row) => ({
      area: row.area,
      utilization: toNumber(row.utilization),
    }));

    return jsonOk(res, { kpis, reservationStats, tableUtilization });
  } catch (error) {
    console.error("Staff overview failed:", error);
    return jsonError(res, "Could not load staff overview.");
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/staff/tables/status                                        */
/* ------------------------------------------------------------------ */

router.get("/tables/status", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         t.table_id,
         t.table_number,
         t.capacity,
         t.table_status,
         t.static_qr_code,
         t.merged_into_table_id,
         t.is_counter,
         a.area_name,
         (
           SELECT TOP 1 r.reservation_id
           FROM dbo.Reservations AS r
           INNER JOIN dbo.ReservationTables AS rt ON r.reservation_id = rt.reservation_id
           WHERE rt.table_id = t.table_id
             AND r.reservation_status IN (N'Await Check-in')
             AND CAST(DATEADD(hour, 7, r.reservation_start_at) AS DATE) = CAST(DATEADD(hour, 7, SYSDATETIME()) AS DATE)
           ORDER BY r.reservation_start_at ASC
         ) AS active_reservation_id,
         (
           SELECT TOP 1 r.reservation_start_at
           FROM dbo.Reservations AS r
           INNER JOIN dbo.ReservationTables AS rt ON r.reservation_id = rt.reservation_id
           WHERE rt.table_id = t.table_id
             AND r.reservation_status IN (N'Await Check-in')
             AND CAST(DATEADD(hour, 7, r.reservation_start_at) AS DATE) = CAST(DATEADD(hour, 7, SYSDATETIME()) AS DATE)
           ORDER BY r.reservation_start_at ASC
         ) AS next_reservation_start_at,
         (
           SELECT TOP 1 tos.reservation_id
           FROM dbo.TableOccupancySessions AS tos
           WHERE tos.table_id = t.table_id
             AND tos.released_at IS NULL
           ORDER BY tos.check_in_at DESC
         ) AS active_occupancy_reservation_id,
         (
           SELECT TOP 1 COALESCE(r.seated_at, r.checked_in_at, tos.check_in_at)
           FROM dbo.TableOccupancySessions AS tos
           LEFT JOIN dbo.Reservations AS r ON r.reservation_id = tos.reservation_id
           WHERE tos.table_id = t.table_id
             AND tos.released_at IS NULL
           ORDER BY tos.check_in_at DESC
         ) AS occupied_since,
         (
           SELECT TOP 1 tos.estimated_duration_min
           FROM dbo.TableOccupancySessions AS tos
           WHERE tos.table_id = t.table_id
             AND tos.released_at IS NULL
           ORDER BY tos.check_in_at DESC
         ) AS estimated_duration_min,
         (
           SELECT TOP 1 tos.buffer_min
           FROM dbo.TableOccupancySessions AS tos
           WHERE tos.table_id = t.table_id
             AND tos.released_at IS NULL
           ORDER BY tos.check_in_at DESC
         ) AS buffer_min,
         (
           SELECT TOP 1 COALESCE(r.reservation_end_at, tos.estimated_release_at)
           FROM dbo.TableOccupancySessions AS tos
           LEFT JOIN dbo.Reservations AS r ON r.reservation_id = tos.reservation_id
           WHERE tos.table_id = t.table_id
             AND tos.released_at IS NULL
           ORDER BY tos.check_in_at DESC
         ) AS estimated_release_at,
         (
           SELECT TOP 1 tos.overrun_alerted
           FROM dbo.TableOccupancySessions AS tos
           WHERE tos.table_id = t.table_id
             AND tos.released_at IS NULL
           ORDER BY tos.check_in_at DESC
         ) AS overrun_alerted,
         active_order.order_id AS active_order_id,
         active_order.order_status AS active_order_status,
         ISNULL(order_stage.item_count, 0) AS active_order_item_count,
         CASE
           WHEN t.table_status <> N'Occupied' THEN NULL
           WHEN active_order.order_id IS NULL THEN N'Dining'
           WHEN active_order.order_status = N'Billed' THEN N'Bill Requested'
           WHEN ISNULL(order_stage.item_count, 0) = 0 THEN N'Dining'
           WHEN active_order.order_status = N'Served'
             OR ISNULL(order_stage.item_count, 0) = ISNULL(order_stage.served_count, 0) THEN N'Served'
           WHEN ISNULL(order_stage.ready_count, 0) > 0
             OR ISNULL(order_stage.kitchen_ready_count, 0) > 0 THEN N'Ready'
           WHEN ISNULL(order_stage.preparing_count, 0) > 0
             OR ISNULL(order_stage.kitchen_preparing_count, 0) > 0 THEN N'Preparing'
           WHEN ISNULL(order_stage.sent_count, 0) > 0
             OR active_order.order_status = N'Sent To Kitchen' THEN N'Sent to Kitchen'
           WHEN ISNULL(order_stage.pending_count, 0) > 0
             OR active_order.order_status = N'Open' THEN N'Order Placed'
           ELSE N'Dining'
         END AS course_stage,
         CASE
           WHEN t.table_status <> N'Occupied' THEN NULL
           WHEN active_order.order_id IS NULL THEN N'Waiting for order'
           WHEN active_order.order_status = N'Billed' THEN N'Bill requested; awaiting payment'
           WHEN ISNULL(order_stage.item_count, 0) = 0 THEN N'Waiting for order'
           WHEN active_order.order_status = N'Served'
             OR ISNULL(order_stage.item_count, 0) = ISNULL(order_stage.served_count, 0) THEN N'All active items served'
           WHEN ISNULL(order_stage.ready_count, 0) > 0
             OR ISNULL(order_stage.kitchen_ready_count, 0) > 0 THEN N'Kitchen item ready for service'
           WHEN ISNULL(order_stage.preparing_count, 0) > 0
             OR ISNULL(order_stage.kitchen_preparing_count, 0) > 0 THEN N'Kitchen is preparing items'
           WHEN ISNULL(order_stage.sent_count, 0) > 0
             OR active_order.order_status = N'Sent To Kitchen' THEN N'Order sent to kitchen'
           WHEN ISNULL(order_stage.pending_count, 0) > 0
             OR active_order.order_status = N'Open' THEN N'Order placed; not yet cooking'
           ELSE N'Dining'
         END AS course_stage_detail
       FROM dbo.RestaurantTables t
       JOIN dbo.RestaurantAreas a ON t.area_id = a.area_id
       OUTER APPLY (
         SELECT TOP 1
           o.order_id,
           o.order_status,
           o.reservation_id,
           o.customer_id,
           o.created_by_staff_id,
           o.created_at
         FROM dbo.Orders AS o
         WHERE o.table_id = t.table_id
           AND o.order_status NOT IN (N'Paid', N'Cancelled')
         ORDER BY o.updated_at DESC, o.created_at DESC
       ) AS active_order
       OUTER APPLY (
         SELECT
           COUNT(1) AS item_count,
           SUM(CASE WHEN oi.item_status = N'Pending' THEN 1 ELSE 0 END) AS pending_count,
           SUM(CASE WHEN oi.item_status = N'Sent To Kitchen' THEN 1 ELSE 0 END) AS sent_count,
           SUM(CASE WHEN oi.item_status = N'Preparing' THEN 1 ELSE 0 END) AS preparing_count,
           SUM(CASE WHEN oi.item_status = N'Ready' THEN 1 ELSE 0 END) AS ready_count,
           SUM(CASE WHEN oi.item_status = N'Served' THEN 1 ELSE 0 END) AS served_count,
           SUM(CASE WHEN kt.kitchen_status = N'Preparing' THEN 1 ELSE 0 END) AS kitchen_preparing_count,
           SUM(CASE WHEN kt.kitchen_status = N'Ready' THEN 1 ELSE 0 END) AS kitchen_ready_count
         FROM dbo.OrderItems AS oi
         LEFT JOIN dbo.KitchenTickets AS kt ON kt.order_item_id = oi.order_item_id
         WHERE oi.order_id = active_order.order_id
           AND oi.item_status <> N'Cancelled'
       ) AS order_stage
       WHERE a.is_active = 1
       ORDER BY a.area_name, t.table_number;`
    );

    const tables = rows.map((row) => ({
      table_id: row.table_id,
      table_number: row.table_number,
      area_name: row.area_name,
      capacity: row.capacity,
      status: slugStatus(row.table_status),
      table_status: row.table_status,
      qr_code: row.static_qr_code || null,
      merged_into_table_id: row.merged_into_table_id || null,
      is_counter: Boolean(row.is_counter),
      active_reservation_id: row.active_reservation_id ?? null,
      next_reservation_start_at: row.next_reservation_start_at ?? null,
      active_occupancy_reservation_id: row.active_occupancy_reservation_id ?? null,
      occupied_since: row.occupied_since ?? null,
      estimated_duration_min: row.estimated_duration_min ?? null,
      buffer_min: row.buffer_min ?? null,
      estimated_release_at: row.estimated_release_at ?? null,
      overrun_alerted: Boolean(row.overrun_alerted),
      active_order_id: row.active_order_id ?? null,
      active_order_status: row.active_order_status ?? null,
      active_order_item_count: Number(row.active_order_item_count ?? 0),
      course_stage: row.course_stage ?? null,
      course_stage_detail: row.course_stage_detail ?? null,
    }));

    return jsonOk(res, tables);
  } catch (error) {
    console.error("Staff tables/status failed:", error);
    return jsonError(res, "Could not load table status.");
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/staff/orders/active — see staffController.getActiveOccupiedOrders */
/* ------------------------------------------------------------------ */

router.get("/orders/active-legacy", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         o.order_id,
         o.order_status,
         o.total_amount,
         o.created_at,
         t.table_number,
         (SELECT COUNT(*) FROM dbo.OrderItems oi WHERE oi.order_id = o.order_id) AS items_count
       FROM dbo.Orders o
       JOIN dbo.RestaurantTables t ON o.table_id = t.table_id
       WHERE o.order_status NOT IN (N'Paid', N'Cancelled')
       ORDER BY o.created_at DESC;`
    );

    const orderIds = rows.map((r) => r.order_id);
    let kitchenByOrder = {};

    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => "?").join(", ");
      const [ticketRows] = await pool.query(
        `SELECT oi.order_id, kt.kitchen_status
         FROM dbo.KitchenTickets kt
         JOIN dbo.OrderItems oi ON kt.order_item_id = oi.order_item_id
         WHERE oi.order_id IN (${placeholders});`,
        orderIds
      );
      kitchenByOrder = ticketRows.reduce((acc, row) => {
        acc[row.order_id] = acc[row.order_id] || [];
        acc[row.order_id].push(row.kitchen_status);
        return acc;
      }, {});
    }

    const orders = rows.map((row) => ({
      order_id: row.order_id,
      order_number: `#A-${row.order_id}`,
      table_label: row.table_number,
      items_count: toNumber(row.items_count),
      total: toNumber(row.total_amount),
      status: mapOrderStatus(row.order_status),
      kitchen_status: mapKitchenAggregate(kitchenByOrder[row.order_id] || [], row.order_status),
      created_at: row.created_at,
    }));

    return jsonOk(res, orders);
  } catch (error) {
    console.error("Staff orders/active failed:", error);
    return jsonError(res, "Could not load active orders.");
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/staff/kitchen                                              */
/* ------------------------------------------------------------------ */

router.get("/kitchen", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         kt.kitchen_ticket_id,
         kt.kitchen_status,
         kt.priority_level,
         kt.sent_at,
         kt.started_at,
         kt.ready_at,
         oi.quantity,
         oi.order_item_id,
         d.dish_name,
         o.order_id,
         t.table_number
       FROM dbo.KitchenTickets kt
       JOIN dbo.OrderItems oi ON kt.order_item_id = oi.order_item_id
       JOIN dbo.Dishes d ON oi.dish_id = d.dish_id
       JOIN dbo.Orders o ON oi.order_id = o.order_id
       JOIN dbo.RestaurantTables t ON o.table_id = t.table_id
       WHERE kt.kitchen_status IN (N'Pending', N'Preparing')
         AND o.order_status NOT IN (N'Cancelled', N'Paid')
       ORDER BY kt.priority_level ASC, kt.sent_at ASC;`
    );

    const tickets = rows.map((row) => ({
      kitchen_ticket_id: row.kitchen_ticket_id,
      order_item_id: row.order_item_id,
      order_id: row.order_id,
      order_number: `#A-${row.order_id}`,
      table_label: row.table_number,
      dish_name: row.dish_name,
      quantity: row.quantity,
      kitchen_status: slugStatus(row.kitchen_status),
      priority_level: row.priority_level,
      sent_at: row.sent_at,
      started_at: row.started_at,
      ready_at: row.ready_at,
    }));

    return jsonOk(res, tickets);
  } catch (error) {
    console.error("Staff kitchen failed:", error);
    return jsonError(res, "Could not load kitchen queue.");
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/staff/dishes                                               */
/* ------------------------------------------------------------------ */

router.get("/dishes", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
          d.dish_id,
          d.dish_name,
          d.price,
          d.is_available,
          d.is_recommended,
          d.spicy_level,
          d.prep_time_min,
          c.category_name,
          CONCAT('/api/dishes/', d.dish_id, '/image') AS image_url
        FROM dbo.Dishes d
        JOIN dbo.MenuCategories c ON d.category_id = c.category_id
        ORDER BY c.display_order, d.dish_name;`
    );

    const dishes = rows.map((row) => ({
      dish_id: row.dish_id,
      dish_name: row.dish_name,
      category_name: row.category_name,
      price: toNumber(row.price),
      is_available: Boolean(row.is_available),
      is_recommended: Boolean(row.is_recommended),
      spicy_level: toNumber(row.spicy_level),
      prep_minutes: row.prep_time_min != null ? toNumber(row.prep_time_min) : 0,
      image_url: row.image_url || null,
    }));

    return jsonOk(res, dishes);
  } catch (error) {
    console.error("Staff dishes failed:", error);
    return jsonError(res, "Could not load dishes.");
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/staff/best-selling                                         */
/* ------------------------------------------------------------------ */

router.get("/best-selling", async (req, res) => {
  try {
    const filter = req.query.filter || 'month';
    let dateCondition = "";
    if (filter === 'today') {
      dateCondition = "AND o.created_at >= CAST(SYSDATETIME() AS DATE)";
    } else if (filter === 'week') {
      dateCondition = "AND o.created_at >= DATEADD(day, -7, CAST(SYSDATETIME() AS DATE))";
    } else if (filter === 'month') {
      dateCondition = "AND o.created_at >= DATEADD(day, -30, CAST(SYSDATETIME() AS DATE))";
    }

    const [rows] = await pool.query(
      `SELECT TOP 10
         d.dish_name,
         SUM(oi.quantity) AS qty_sold,
         SUM(oi.line_total) AS revenue
       FROM dbo.OrderItems oi
       JOIN dbo.Orders o ON oi.order_id = o.order_id
       JOIN dbo.Dishes d ON oi.dish_id = d.dish_id
       WHERE o.order_status = N'Paid'
         ${dateCondition}
       GROUP BY d.dish_id, d.dish_name
       ORDER BY qty_sold DESC, revenue DESC;`
    );

    const bestSellers = rows.map((row, index) => ({
      rank: index + 1,
      dish_name: row.dish_name,
      qty_sold: toNumber(row.qty_sold),
      revenue: toNumber(row.revenue),
    }));

    return jsonOk(res, bestSellers);
  } catch (error) {
    console.error("Staff best-selling failed:", error);
    return jsonError(res, "Could not load best-selling dishes.");
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/staff/promotions                                           */
/* ------------------------------------------------------------------ */

router.get("/promotions", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         p.promotion_id,
         p.promotion_name,
         p.discount_type,
         p.discount_value,
         p.min_order_value,
         p.start_at,
         p.end_at,
         p.is_active,
         v.promo_code AS promo_code,
         v.times_used
       FROM dbo.Promotions p
       OUTER APPLY (
         SELECT TOP 1 v2.promo_code, v2.times_used
         FROM dbo.PromoCodes v2
         WHERE v2.promotion_id = p.promotion_id
         ORDER BY v2.promo_code_id ASC
       ) v
       ORDER BY p.start_at DESC;`
    );

    const promotions = rows.map((row) => {
      const start = parseDbDate(row.start_at);
      const end = parseDbDate(row.end_at);
      return {
        promo_id: row.promotion_id,
        name: row.promotion_name,
        code: row.promo_code || "",
        discount_type: mapDiscountType(row.discount_type),
        discount_value: toNumber(row.discount_value),
        min_order: toNumber(row.min_order_value),
        start_date: formatDatePart(start),
        end_date: formatDatePart(end),
        status: derivePromoStatus(row),
        usage_count: toNumber(row.times_used),
      };
    });

    return jsonOk(res, promotions);
  } catch (error) {
    console.error("Staff promotions failed:", error);
    return jsonError(res, "Could not load promotions.");
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/staff/staff                                                */
/* ------------------------------------------------------------------ */

router.get("/staff", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         ua.user_id,
         ua.full_name,
         ua.email,
         ua.phone,
         r.role_name,
         sp.staff_id,
         sp.staff_code,
         sp.job_title,
         sp.employment_status,
         NULL AS shift_name
       FROM dbo.UserAccounts AS ua
       INNER JOIN dbo.Roles AS r ON ua.role_id = r.role_id
       LEFT JOIN dbo.StaffProfiles AS sp ON sp.user_id = ua.user_id
       WHERE r.role_name IN (N'Manager', N'Restaurant Staff')

         AND ua.is_active = 1
       ORDER BY ua.full_name ASC;`
    );

    const staff = rows.map((row) => ({
      staff_id: row.staff_id,
      user_id: row.user_id,
      full_name: row.full_name,
      role_name: row.role_name,
      job_title: row.job_title,
      staff_code: row.staff_code,
      phone: row.phone || "",
      email: row.email || "",
      status: mapEmploymentStatus(row.employment_status),
      shift: "Morning",
    }));

    return jsonOk(res, staff);
  } catch (error) {
    console.error("Staff staff list failed:", error);
    return jsonError(res, "Could not load staff list.");
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/staff/reports/revenue                                      */
/* ------------------------------------------------------------------ */

router.get("/reports/revenue", async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        FORMAT(d.date_day, 'yyyy-MM-dd') AS date,
        ISNULL(p.revenue, 0) AS revenue,
        ISNULL(r.reservations, 0) AS reservations
      FROM (
        SELECT DATEADD(day, -number, CAST(SYSDATETIME() AS DATE)) AS date_day
        FROM master.dbo.spt_values
        WHERE type = 'P' AND number <= 365
      ) d
      LEFT JOIN (
        SELECT CAST(paid_at AS DATE) AS paid_date, SUM(amount_paid) AS revenue
        FROM dbo.Payments
        WHERE payment_status = N'Completed'
          AND paid_at >= DATEADD(day, -365, CAST(SYSDATETIME() AS DATE))
        GROUP BY CAST(paid_at AS DATE)
      ) p ON d.date_day = p.paid_date
      LEFT JOIN (
        SELECT CAST(reservation_start_at AS DATE) AS res_date, COUNT(*) AS reservations
        FROM dbo.Reservations
        WHERE reservation_status <> N'Cancelled'
          AND reservation_start_at >= DATEADD(day, -365, CAST(SYSDATETIME() AS DATE))
        GROUP BY CAST(reservation_start_at AS DATE)
      ) r ON d.date_day = r.res_date
      ORDER BY d.date_day ASC;
    `);

    return jsonOk(res, rows);
  } catch (error) {
    console.error("Staff reports/revenue failed:", error);
    return jsonError(res, "Could not load revenue report.");
  }
});

/* ------------------------------------------------------------------ */
/* Phase 1 — Change Request Workflow (Staff Endpoints)                 */
/* ------------------------------------------------------------------ */

// Price tier rank map for financial impact computation
const TIER_RANK = { Standard: 0, Premium: 1, VIP: 2 };

/**
 * GET /api/staff/reservation-requests
 * Returns pending change requests for Staff review.
 * Query params: status (default 'Pending'), page, limit
 */
router.get("/reservation-requests", resolveUserId, requireUserId, async (req, res) => {
  try {
    const status = req.query.status || "Pending";
    const page   = Math.max(1, Number(req.query.page) || 1);
    const limit  = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      `SELECT
         rcr.request_id,
         rcr.reservation_id,
         rcr.request_type,
         rcr.reason,
         rcr.request_status,
         rcr.requires_financial_approval,
         rcr.created_at,
         rcr.requested_start_at,
         rcr.requested_end_at,
         rcr.requested_party_size,
         rcr.requested_table_id,
         -- New table info
         rt_new.table_number AS new_table_number,
         rt_new.price_tier   AS new_table_tier,
         -- Reservation snapshot
         r.reservation_start_at,
         r.reservation_end_at,
         r.guest_count,
         r.reservation_status,
         -- Assigned table (current)
         (SELECT TOP 1 t.table_number FROM dbo.ReservationTables rtbl
          JOIN dbo.RestaurantTables t ON rtbl.table_id = t.table_id
          WHERE rtbl.reservation_id = r.reservation_id) AS current_table_number,
         (SELECT TOP 1 t.price_tier FROM dbo.ReservationTables rtbl
          JOIN dbo.RestaurantTables t ON rtbl.table_id = t.table_id
          WHERE rtbl.reservation_id = r.reservation_id) AS current_table_tier,
         -- Customer info
         COALESCE(ua.full_name, r.contact_name, N'Guest') AS customer_name,
         COALESCE(ua.email, r.contact_email) AS customer_email,
         r.contact_phone
       FROM dbo.ReservationChangeRequests rcr
       JOIN dbo.Reservations r ON rcr.reservation_id = r.reservation_id
       LEFT JOIN dbo.UserAccounts ua ON ua.user_id = rcr.requested_by_customer_id
       LEFT JOIN dbo.RestaurantTables rt_new ON rt_new.table_id = rcr.requested_table_id
       WHERE rcr.request_status = ?
       ORDER BY rcr.created_at ASC
       OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`,
      [status, offset, limit]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM dbo.ReservationChangeRequests WHERE request_status = ?`,
      [status]
    );

    return jsonOk(res, {
      requests: rows,
      totalCount: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    });
  } catch (err) {
    console.error("[GET /staff/reservation-requests] Error:", err);
    return jsonError(res, "Could not load reservation requests.");
  }
});

/**
 * PATCH /api/staff/reservations/:id/full-edit
 * Allows staff to fully edit a reservation using the manager's logic.
 */
router.patch("/reservations/:id/full-edit", resolveUserId, requireUserId, updateReservation);

/**
 * PATCH /api/staff/reservations/:id/direct-edit
 * Staff direct edit of a reservation with financial impact guard.
 * Allowed fields: guest_count, reservation_start_at, reservation_end_at, special_request, contact_phone.
 * Table changes (table_id) are allowed ONLY if no price-tier upgrade; otherwise 403.
 */
router.patch("/reservations/:id/direct-edit", resolveUserId, requireUserId, async (req, res) => {
  const reservationId = Number(req.params.id);
  const staffId = req.userId;
  const { table_id: newTableId, guest_count, reservation_start_at, reservation_end_at, special_request, contact_phone } = req.body;

  try {
    // Load current reservation + assigned table tier
    const [resRows] = await pool.query(
      `SELECT r.reservation_id, r.reservation_status, r.guest_count,
              t.table_id AS current_table_id, t.price_tier AS current_tier
       FROM dbo.Reservations r
       LEFT JOIN dbo.ReservationTables rt ON rt.reservation_id = r.reservation_id
       LEFT JOIN dbo.RestaurantTables t ON t.table_id = rt.table_id
       WHERE r.reservation_id = ?`,
      [reservationId]
    );

    if (resRows.length === 0) {
      return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Reservation not found." });
    }

    const current = resRows[0];

    // Financial impact guard — compare price tiers if a table change is requested
    if (newTableId && newTableId !== current.current_table_id) {
      const [newTableRows] = await pool.query(
        `SELECT price_tier FROM dbo.RestaurantTables WHERE table_id = ?`,
        [newTableId]
      );
      if (newTableRows.length === 0) {
        return res.status(400).json({ success: false, code: "INVALID_TABLE", message: "Requested table not found." });
      }
      const newTier = newTableRows[0].price_tier;
      const currentTierRank = TIER_RANK[current.current_tier ?? "Standard"] ?? 0;
      const newTierRank     = TIER_RANK[newTier] ?? 0;

      if (newTierRank > currentTierRank) {
        return res.status(403).json({
          success: false,
          code: "REQUIRES_MANAGER_APPROVAL",
          message: `This table change (${current.current_tier || "Standard"} → ${newTier}) involves a price-tier upgrade and must be approved by a Manager. Create a change request instead.`,
          current_tier: current.current_tier,
          requested_tier: newTier,
        });
      }
    }

    // Apply allowed field updates
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const updates = [];
      const params = [];

      if (guest_count != null) { updates.push("guest_count = ?"); params.push(guest_count); }
      if (reservation_start_at) { updates.push("reservation_start_at = ?"); params.push(reservation_start_at); }
      if (reservation_end_at)   { updates.push("reservation_end_at = ?");   params.push(reservation_end_at); }
      if (special_request != null) { updates.push("special_request = ?"); params.push(special_request); }
      if (contact_phone != null)   { updates.push("contact_phone = ?");   params.push(contact_phone); }

      if (updates.length > 0) {
        updates.push("updated_at = SYSDATETIME()");
        params.push(reservationId);
        await connection.query(
          `UPDATE dbo.Reservations SET ${updates.join(", ")} WHERE reservation_id = ?`,
          params
        );
      }

      // Table reassignment (same or lower tier already validated above)
      if (newTableId && newTableId !== current.current_table_id) {
        await connection.query(
          `UPDATE dbo.ReservationTables SET table_id = ? WHERE reservation_id = ?`,
          [newTableId, reservationId]
        );
      }

      // Audit log
      await connection.query(
        `INSERT INTO dbo.AuditLogs
           (user_id, action_name, target_table, target_id, old_value_json, new_value_json, ip_address, created_at)
         VALUES (?, N'STAFF_DIRECT_EDIT_RESERVATION', N'Reservations', ?, NULL, ?, ?, SYSDATETIME())`,
        [staffId, reservationId, JSON.stringify(req.body), req.ip || null]
      );

      await connection.commit();
      connection.release();

      return jsonOk(res, { message: "Reservation updated successfully." });
    } catch (err) {
      try { await connection.rollback(); } catch { /* ignore */ }
      connection.release();
      throw err;
    }
  } catch (err) {
    console.error("[PATCH /staff/reservations/:id/direct-edit] Error:", err);
    return jsonError(res, "Could not update reservation.");
  }
});

/**
 * PATCH /api/staff/reservations/:id/extend-ert
 * Extends the reservation_end_at ERT only. Table status is unchanged.
 */
router.patch("/reservations/:id/extend-ert", resolveUserId, requireUserId, async (req, res) => {
  const reservationId = Number(req.params.id);
  const staffId = req.userId;
  const minutes = Number(req.body?.minutes);

  if (!Number.isFinite(reservationId) || reservationId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid reservation id." });
  }
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 240) {
    return res.status(400).json({ success: false, message: "Extension must be between 1 and 240 minutes." });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT r.reservation_id, r.reservation_end_at, r.reservation_status, rt.table_id
       FROM dbo.Reservations r WITH (UPDLOCK, ROWLOCK)
       LEFT JOIN dbo.ReservationTables rt ON rt.reservation_id = r.reservation_id
       WHERE r.reservation_id = ?`,
      [reservationId]
    );

    const current = rows[0];
    if (!current) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: "Reservation not found." });
    }

    if (!["Dining", "Pending Payment"].includes(current.reservation_status)) {
      await connection.rollback();
      connection.release();
      return res.status(409).json({
        success: false,
        message: "ERT can only be extended while the table is actively dining.",
      });
    }

    await connection.query(
      `UPDATE dbo.Reservations
       SET reservation_end_at = DATEADD(minute, ?, reservation_end_at),
           updated_at = SYSDATETIME()
       WHERE reservation_id = ?`,
      [minutes, reservationId]
    );

    const [updatedRows] = await connection.query(
      `SELECT reservation_end_at FROM dbo.Reservations WHERE reservation_id = ?`,
      [reservationId]
    );
    const newEndAt = updatedRows[0]?.reservation_end_at;

    await connection.query(
      `INSERT INTO dbo.AuditLogs
         (user_id, action_name, target_table, target_id, old_value_json, new_value_json, ip_address, created_at)
       VALUES (?, N'ERT_EXTENDED', N'Reservations', ?, ?, ?, ?, SYSDATETIME())`,
      [
        staffId,
        reservationId,
        JSON.stringify({ reservation_end_at: current.reservation_end_at }),
        JSON.stringify({ reservation_end_at: newEndAt, added_minutes: minutes }),
        req.ip || null,
      ]
    );

    await connection.commit();
    connection.release();

    try {
      const io = getIO();
      if (io) {
        io.to("room:staff").to("room:manager").emit("table:sync", {
          table_id: current.table_id,
          reservation_id: reservationId,
          estimated_release_at: newEndAt,
        });
      }
    } catch (socketErr) {
      console.error("[extend-ert] Socket.IO broadcast failed:", socketErr.message);
    }

    return jsonOk(res, {
      reservation_id: reservationId,
      reservation_end_at: newEndAt,
      added_minutes: minutes,
      message: "Estimated release time extended.",
    });
  } catch (err) {
    try { await connection.rollback(); } catch { /* ignore */ }
    connection.release();
    console.error("[PATCH /staff/reservations/:id/extend-ert] Error:", err);
    return jsonError(res, "Could not extend estimated release time.");
  }
});

/**
 * POST / PATCH /api/staff/reservations/:id/extend-hold
 * Extends reservation hold time when customer calls staff to report late arrival.
 */
async function handleExtendHoldRoute(req, res) {
  try {
    const reservationId = Number(req.params.id);
    const addedMinutes = Math.max(5, Math.min(180, Number(req.body.addedMinutes || 30)));

    if (!Number.isFinite(reservationId) || reservationId <= 0) {
      return jsonError(res, "Invalid reservation ID.");
    }

    const [rows] = await pool.query(
      `SELECT reservation_id, reservation_start_at, COALESCE(NULLIF(no_show_grace_minutes, 0), 20) AS no_show_grace_minutes, reservation_status
       FROM dbo.Reservations
       WHERE reservation_id = ?`,
      [reservationId]
    );

    if (!rows || !rows.length) {
      return jsonError(res, "Reservation not found.");
    }

    const r = rows[0];
    const currentGrace = Number(r.no_show_grace_minutes) || 20;
    const newGrace = currentGrace + addedMinutes;

    await pool.query(
      `UPDATE dbo.Reservations
       SET no_show_grace_minutes = ?,
           updated_at = SYSDATETIME()
       WHERE reservation_id = ?`,
      [newGrace, reservationId]
    );

    // Socket notification
    try {
      const io = (await import("../socket.js")).getIO();
      if (io) {
        io.to("room:staff").to("room:manager").emit("table:status_changed", {
          reservation_id: reservationId,
          reason: "hold_extended",
          added_minutes: addedMinutes,
          new_grace_minutes: newGrace,
        });
      }
    } catch { /* ignore */ }

    const startMs = new Date(r.reservation_start_at).getTime();
    const newDeadlineMs = startMs + newGrace * 60 * 1000;
    const newDeadline = new Date(newDeadlineMs).toISOString();

    return jsonOk(res, {
      message: `Hold time extended by +${addedMinutes}m. New grace period: ${newGrace}m.`,
      new_grace_minutes: newGrace,
      hold_deadline: newDeadline,
    });
  } catch (err) {
    console.error("[POST/PATCH /staff/reservations/:id/extend-hold] Error:", err);
    return jsonError(res, "Could not extend hold time.");
  }
};

router.post("/reservations/:id/extend-hold", resolveUserId, requireUserId, handleExtendHoldRoute);
router.patch("/reservations/:id/extend-hold", resolveUserId, requireUserId, handleExtendHoldRoute);

/**
 * POST /api/staff/reservation-requests/:id/resolve
 * Staff resolves a non-financial pending request by applying the change.
 * Blocked on requires_financial_approval=true requests (403).
 * Body: { staff_note?: string }
 */
router.post("/reservation-requests/:id/resolve", resolveUserId, requireUserId, async (req, res) => {
  const requestId = Number(req.params.id);
  const staffId   = req.userId;
  const { staff_note } = req.body;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Lock and load the request (support lookup by request_id OR reservation_id)
    const [reqRows] = await connection.query(
      `SELECT
         rcr.request_id, rcr.reservation_id, rcr.request_type, rcr.request_status,
         rcr.requires_financial_approval,
         rcr.requested_table_id, rcr.requested_start_at, rcr.requested_end_at,
         rcr.requested_party_size,
         rcr.reason,
         rcr.requested_by_customer_id,
         r.reservation_status,
         r.reservation_start_at,
         r.reservation_end_at,
         r.guest_count,
         r.contact_phone,
         r.special_request,
         r.dining_purpose,
         COALESCE(ua.email, r.contact_email, '') AS recipient_email,
         COALESCE(ua.full_name, r.contact_name, N'Guest') AS recipient_name
       FROM dbo.ReservationChangeRequests rcr WITH (UPDLOCK, ROWLOCK)
       JOIN dbo.Reservations r ON r.reservation_id = rcr.reservation_id
       LEFT JOIN dbo.UserAccounts ua ON ua.user_id = r.customer_id
       WHERE rcr.request_id = ? OR rcr.reservation_id = ?`,
      [requestId, requestId]
    );

    if (reqRows.length === 0) {
      await connection.rollback(); connection.release();
      return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Request not found." });
    }

    const rcr = reqRows[0];

    if (rcr.request_status !== "Pending") {
      await connection.rollback(); connection.release();
      return res.status(409).json({ success: false, code: "ALREADY_RESOLVED", message: "This request has already been resolved." });
    }

    if (rcr.requires_financial_approval) {
      await connection.rollback(); connection.release();
      return res.status(403).json({
        success: false,
        code: "REQUIRES_MANAGER_APPROVAL",
        message: "This request requires Manager financial approval. Staff cannot resolve it directly.",
      });
    }

    let parsedReason = {};
    try {
      parsedReason = rcr.reason ? JSON.parse(rcr.reason) : {};
    } catch {
      parsedReason = {};
    }
    const requestedChanges = parsedReason?.changes || {};

    // Apply the requested changes to Reservations
    const resUpdates = [];
    const resParams  = [];

    if (rcr.request_type === "TableChange" && rcr.requested_table_id) {
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
        [rcr.reservation_id, rcr.requested_table_id, staffId]
      );
      await connection.query(
        `UPDATE dbo.RestaurantTables
         SET table_status = N'Reserved', updated_at = SYSDATETIME()
         WHERE table_id = ?
           AND table_status NOT IN (N'Occupied', N'Cleaning', N'Inactive')`,
        [rcr.requested_table_id]
      );
    }
    if (rcr.requested_start_at) { resUpdates.push("reservation_start_at = ?"); resParams.push(rcr.requested_start_at); }
    if (rcr.requested_end_at)   { resUpdates.push("reservation_end_at = ?");   resParams.push(rcr.requested_end_at); }
    if (rcr.requested_party_size) { resUpdates.push("guest_count = ?"); resParams.push(rcr.requested_party_size); }
    if (Object.prototype.hasOwnProperty.call(requestedChanges, "contact_phone")) {
      resUpdates.push("contact_phone = ?");
      resParams.push(requestedChanges.contact_phone || null);
    }
    if (Object.prototype.hasOwnProperty.call(requestedChanges, "special_request")) {
      resUpdates.push("special_request = ?");
      resParams.push(requestedChanges.special_request || null);
    }
    if (Object.prototype.hasOwnProperty.call(requestedChanges, "dining_purpose")) {
      resUpdates.push("dining_purpose = ?");
      resParams.push(requestedChanges.dining_purpose || null);
    }

    // DO NOT SET has_pending_request directly because it is a computed column!
    // Transition to Await Check-in so Staff/Manager portals show the correct status
    // after approval and the Manage Table timer activates for the new/unchanged table.
    if (["Confirmed", "Reserved", "Pending Request"].includes(rcr.reservation_status)) {
      resUpdates.push("reservation_status = N'Await Check-in'");
    }
    resUpdates.push("pending_changes_json = NULL");
    resUpdates.push("request_type = NULL");
    resUpdates.push("resolved_at = SYSDATETIME()");
    resUpdates.push("resolved_by = ?");
    resParams.push(staffId);
    resUpdates.push("updated_at = SYSDATETIME()");
    resParams.push(rcr.reservation_id);
    await connection.query(
      `UPDATE dbo.Reservations SET ${resUpdates.join(", ")} WHERE reservation_id = ?`,
      resParams
    );

    const requestedPreorders = requestedChanges.preorder_items;
    if (Array.isArray(requestedPreorders) && requestedPreorders.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
      await connection.query(
        `DELETE FROM dbo.PreorderItems WHERE reservation_id = ?`,
        [rcr.reservation_id]
      );

      for (const item of requestedPreorders) {
        const dishId = Number(item.dish_id || item.dishId || item.id);
        const quantity = Math.max(1, Number(item.quantity || item.qty || 1));
        if (!Number.isFinite(dishId) || dishId <= 0 || !Number.isFinite(quantity)) continue;

        const [dishRows] = await connection.query(
          `SELECT price FROM dbo.Dishes WHERE dish_id = ? AND is_available = 1`,
          [dishId]
        );
        if (dishRows.length === 0) continue;

        await connection.query(
          `INSERT INTO dbo.PreorderItems (reservation_id, dish_id, quantity, unit_price, notes)
           VALUES (?, ?, ?, ?, ?)`,
          [rcr.reservation_id, dishId, quantity, Number(dishRows[0].price || 0), item.notes || null]
        );
      }
    }

    // Mark request as StaffResolved
    await connection.query(
      `UPDATE dbo.ReservationChangeRequests
       SET request_status = N'StaffResolved',
           resolved_by_staff_id = ?,
           manager_reason = ?,
           resolved_at = SYSDATETIME()
       WHERE request_id = ?`,
      [staffId, staff_note || null, rcr.request_id]
    );

    // Create in-app Notification for customer using valid notification_type 'Booking Changed'
    if (rcr.requested_by_customer_id) {
      await connection.query(
        `INSERT INTO dbo.Notifications (user_id, notification_type, title, message_body, is_read, sent_at)
         VALUES (?, N'Booking Changed', N'Change Request Approved', ?, 0, SYSDATETIME())`,
        [
          rcr.requested_by_customer_id,
          `Your change request for reservation #${String(rcr.reservation_id).padStart(6, "0")} has been approved and updated successfully.`,
        ]
      );
    }

    // Audit log
    await connection.query(
      `INSERT INTO dbo.AuditLogs
         (user_id, action_name, target_table, target_id, old_value_json, new_value_json, ip_address, created_at)
       VALUES (?, N'STAFF_RESOLVED_CHANGE_REQUEST', N'ReservationChangeRequests', ?, NULL, ?, ?, SYSDATETIME())`,
      [staffId, rcr.request_id, JSON.stringify({ request_type: rcr.request_type, note: staff_note }), req.ip || null]
    );

    await connection.commit();
    connection.release();

    // Fire-and-forget: send updated reservation email to customer
    if (rcr.recipient_email) {
      const fmtDt = (iso) => {
        if (!iso) return "—";
        try {
          const d = new Date(iso);
          return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
        } catch { return String(iso); }
      };

      // Fetch area & table details from DB
      let tableDisplay = "Not assigned";
      let areaDisplay  = "Main Dining Area";

      try {
        const [tableInfoRows] = await connection.query(
          `SELECT rt.table_id, rt.table_number, ra.area_name
           FROM dbo.ReservationTables rtl
           JOIN dbo.RestaurantTables rt ON rt.table_id = rtl.table_id
           LEFT JOIN dbo.RestaurantAreas ra ON ra.area_id = rt.area_id
           WHERE rtl.reservation_id = ?`,
          [rcr.reservation_id]
        );

        if (tableInfoRows.length > 0) {
          tableDisplay = tableInfoRows.map(t => `#${t.table_number}`).join(", ");
          areaDisplay  = tableInfoRows[0].area_name || "Main Dining Area";
        } else if (rcr.requested_table_id) {
          const [reqTableRows] = await connection.query(
            `SELECT rt.table_id, rt.table_number, ra.area_name
             FROM dbo.RestaurantTables rt
             LEFT JOIN dbo.RestaurantAreas ra ON ra.area_id = rt.area_id
             WHERE rt.table_id = ?`,
            [rcr.requested_table_id]
          );
          if (reqTableRows.length > 0) {
            tableDisplay = `Table #${reqTableRows[0].table_number} (ID: ${reqTableRows[0].table_id})`;
            areaDisplay  = reqTableRows[0].area_name || "Main Dining Area";
          }
        }
      } catch (err) {
        console.error("[staff/resolve] Failed to fetch table/area details for email:", err?.message);
      }

      sendEditConfirmedEmail({
        toEmail: rcr.recipient_email,
        customerName: rcr.recipient_name,
        reservationId: rcr.reservation_id,
        updatedDetails: {
          phone: requestedChanges.contact_phone || rcr.contact_phone || "Not provided",
          time: rcr.requested_start_at ? fmtDt(rcr.requested_start_at) : fmtDt(rcr.reservation_start_at),
          guests: rcr.requested_party_size ? `${rcr.requested_party_size} Guests` : `${rcr.guest_count || 1} Guests`,
          area: areaDisplay,
          table: tableDisplay,
          purpose: requestedChanges.dining_purpose || rcr.dining_purpose || "Casual Dinner",
          notes: requestedChanges.special_request || rcr.special_request || null,
        },
      }).catch((e) => console.error("[staff/resolve] Email failed:", e?.message));
    }

    // Fire-and-forget: notify customer socket & bell
    try {
      const io = (await import("../socket.js")).getIO();
      if (io && rcr.requested_by_customer_id) {
        const notifPayload = {
          reservation_id: rcr.reservation_id,
          request_id: rcr.request_id,
          request_type: rcr.request_type,
          decision: "StaffResolved",
          message: `Your change request for reservation #${String(rcr.reservation_id).padStart(6, "0")} has been approved.`,
          timestamp: new Date().toISOString(),
        };
        io.to(`room:user:${rcr.requested_by_customer_id}`).emit("reservation:request_resolved", notifPayload);
        io.to(`room:user:${rcr.requested_by_customer_id}`).emit("notification:new", notifPayload);
        io.to(`room:user:${rcr.requested_by_customer_id}`).emit("STAFF_ACTION_UPDATE", notifPayload);
      }
      if (io) {
        const payload = {
          reservation_id: rcr.reservation_id,
          request_id: rcr.request_id,
          decision: "StaffResolved",
        };
        io.to("room:staff").emit("reservation:request_resolved", payload);
        io.to("room:manager").emit("reservation:request_resolved", payload);
        io.to("room:staff").emit("table:status_changed", { reservation_id: rcr.reservation_id });
        io.to("room:manager").emit("table:status_changed", { reservation_id: rcr.reservation_id });
      }
    } catch { /* non-critical */ }

    return jsonOk(res, { message: "Change request resolved and applied successfully." });
  } catch (err) {
    try { await connection.rollback(); } catch { /* ignore */ }
    connection.release();
    console.error("[POST /staff/reservation-requests/:id/resolve] Error:", err);
    return jsonError(res, "Could not resolve change request.");
  }
});

/**
 * GET /api/staff/no-show-candidates
 * Returns reservations past their no-show grace period that still have no check-in.
 * Does NOT auto-transition — Staff must confirm individually.
 */
router.get("/no-show-candidates", resolveUserId, requireUserId, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         r.reservation_id,
         r.reservation_status,
         r.reservation_start_at,
         r.no_show_grace_minutes,
         r.guest_count,
         COALESCE(ua.full_name, r.contact_name, N'Guest') AS customer_name,
         COALESCE(ua.email, r.contact_email) AS customer_email,
         r.contact_phone,
         DATEDIFF(minute, r.reservation_start_at, SYSDATETIME()) AS minutes_past_start
       FROM dbo.Reservations r
       LEFT JOIN dbo.UserAccounts ua ON ua.user_id = r.customer_id
       WHERE r.reservation_status = N'Confirmed'
         AND r.checked_in_at IS NULL
         AND SYSDATETIME() > DATEADD(minute, r.no_show_grace_minutes, r.reservation_start_at)
       ORDER BY r.reservation_start_at ASC`
    );
    return jsonOk(res, { candidates: rows, count: rows.length });
  } catch (err) {
    console.error("[GET /staff/no-show-candidates] Error:", err);
    return jsonError(res, "Could not load no-show candidates.");
  }
});

// ==========================================
// REPORTS & AI EXPORT
// ==========================================

router.post("/reports/ask", resolveUserId, requireUserId, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ success: false, message: "Prompt is required" });

    // 1. Ask Gemini to parse the intent
    const intent = await parseReportIntent(prompt);

    // 2. Run predefined query to get the data
    const { dataset, grandTotalRow } = await fetchReportData(intent);

    return res.json({
      success: true,
      intent,
      data: dataset,
      grandTotalRow
    });
  } catch (error) {
    console.error("[POST /staff/reports/ask] Error:", error);
    return res.status(500).json({ success: false, message: "Error processing report request", error: error.message });
  }
});

router.post("/reports/export", resolveUserId, requireUserId, async (req, res) => {
  try {
    const { intent, format } = req.body;
    if (!intent || !format) return res.status(400).json({ success: false, message: "Intent and format are required" });
    if (!new Set(["revenue_summary", "reservation_stats", "top_dishes", "revenue_detail", "custom_filtered"]).has(intent.report_type)) {
      return res.status(400).json({ success: false, message: "Invalid report type" });
    }

    const { dataset, grandTotalRow } = await fetchReportData(intent);
    const userId = req.userId || req.user?.user_id || req.user?.userId || req.user?.id || 1;
    
    // Log to AuditLogs
    await pool.query(
      `INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, new_value_json) VALUES (?, ?, ?, ?)`,
      [userId, 'REPORT_GENERATED', 'Report', JSON.stringify({ format, report_type: intent.report_type, date_range: intent.date_range })]
    );

    if (format === "excel") {
      const buffer = await generateExcelBuffer(dataset, grandTotalRow, intent);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=' + `report_${Date.now()}.xlsx`);
      return res.send(buffer);
    } else if (format === "pdf") {
      const buffer = await generatePdfBuffer(dataset, grandTotalRow, intent);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=' + `report_${Date.now()}.pdf`);
      return res.send(buffer);
    } else {
      return res.status(400).json({ success: false, message: "Invalid format" });
    }
  } catch (error) {
    console.error("[POST /staff/reports/export] Error:", error);
    return res.status(500).json({ success: false, message: "Error exporting report", error: error.message });
  }
});

// Multer storage for reviewed report uploads
const reportsUploadDir = path.join(process.cwd(), "backend/uploads/reports");
if (!fs.existsSync(reportsUploadDir)) {
  fs.mkdirSync(reportsUploadDir, { recursive: true });
}

const reportStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, reportsUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `reviewed-report-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const reportUpload = multer({
  storage: reportStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/pdf",
      "application/octet-stream"
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(file.mimetype) || ext === ".xlsx" || ext === ".pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only .xlsx and .pdf files are allowed"));
    }
  }
});

router.post("/reports/upload", resolveUserId, requireUserId, reportUpload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const { intent } = req.body;
    let parsedIntent = null;
    if (intent) {
      try { parsedIntent = typeof intent === "string" ? JSON.parse(intent) : intent; } catch (e) {}
    }

    const managerId = req.userId || req.user?.user_id || req.user?.userId || req.user?.id || 1;
    const fileRef = `/uploads/reports/${req.file.filename}`;
    const reportType = parsedIntent?.report_type || "revenue_detail";
    const fromDate = parsedIntent?.date_range?.from || null;
    const toDate = parsedIntent?.date_range?.to || null;

    await pool.query(
      `INSERT INTO dbo.ReportSubmissions 
        (manager_id, report_type, date_range_from, date_range_to, file_reference, intent_json, status, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, N'Submitted', SYSDATETIME())`,
      [managerId, reportType, fromDate, toDate, fileRef, JSON.stringify(parsedIntent || {})]
    );

    // AuditLog entry
    await pool.query(
      `INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, new_value_json) VALUES (?, ?, ?, ?)`,
      [managerId, 'REPORT_SUBMITTED_TO_ADMIN', 'ReportSubmission', JSON.stringify({ file_reference: fileRef, report_type: reportType })]
    );
    return res.json({
      success: true,
      message: "Report submitted successfully to Admin inbox",
      file_reference: fileRef
    });
  } catch (error) {
    console.error("[POST /staff/reports/upload] Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to upload report" });
  }
});

export default router;
