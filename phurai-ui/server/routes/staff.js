import express from "express";
import pool from "../db.js";

const router = express.Router();

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
/* GET /api/staff/reservations/today                                   */
/* ------------------------------------------------------------------ */

router.get("/reservations/today", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         r.reservation_id,
         r.reservation_start_at,
         r.guest_count,
         r.special_request,
         r.reservation_status,
         ua.full_name AS customer_name,
         ua.email,
         ua.phone,
         a.area_name
       FROM dbo.Reservations r
       LEFT JOIN dbo.UserAccounts ua ON r.customer_id = ua.user_id
       LEFT JOIN dbo.RestaurantAreas a ON r.preferred_area_id = a.area_id
       WHERE CAST(r.reservation_start_at AS DATE) = CAST(SYSDATETIME() AS DATE)
       ORDER BY r.reservation_start_at ASC;`
    );

    const ids = rows.map((r) => r.reservation_id);
    let tablesByReservation = {};

    if (ids.length > 0) {
      const placeholders = ids.map(() => "?").join(", ");
      const [tableRows] = await pool.query(
        `SELECT rt.reservation_id, t.table_number
         FROM dbo.ReservationTables rt
         JOIN dbo.RestaurantTables t ON rt.table_id = t.table_id
         WHERE rt.reservation_id IN (${placeholders});`,
        ids
      );
      tablesByReservation = tableRows.reduce((acc, row) => {
        acc[row.reservation_id] = acc[row.reservation_id] || [];
        acc[row.reservation_id].push(row.table_number);
        return acc;
      }, {});
    }

    const reservations = rows.map((row) => {
      const start = parseDbDate(row.reservation_start_at);
      const tableLabels = tablesByReservation[row.reservation_id] || [];
      return {
        reservation_id: row.reservation_id,
        customer_name: row.customer_name || "Walk-in guest",
        email: row.email || "",
        phone: row.phone || "",
        reservation_date: formatDatePart(start),
        start_time: formatTimePart(start),
        party_size: row.guest_count,
        area_name: row.area_name || "Unassigned",
        table_label: tableLabels.join(", ") || "—",
        status: slugStatus(row.reservation_status),
        occasion: "",
        special_request: row.special_request || "",
        preorder: [],
      };
    });

    return jsonOk(res, reservations);
  } catch (error) {
    console.error("Staff reservations/today failed:", error);
    return jsonError(res, "Could not load today's reservations.");
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
         a.area_name
       FROM dbo.RestaurantTables t
       JOIN dbo.RestaurantAreas a ON t.area_id = a.area_id
       WHERE a.is_active = 1
       ORDER BY a.area_name, t.table_number;`
    );

    const tables = rows.map((row) => ({
      table_id: row.table_id,
      table_number: row.table_number,
      area_name: row.area_name,
      capacity: row.capacity,
      status: slugStatus(row.table_status),
      qr_code: row.static_qr_code || null,
    }));

    return jsonOk(res, tables);
  } catch (error) {
    console.error("Staff tables/status failed:", error);
    return jsonError(res, "Could not load table status.");
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/staff/orders/active                                        */
/* ------------------------------------------------------------------ */

router.get("/orders/active", async (_req, res) => {
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
         img.image_url
       FROM dbo.Dishes d
       JOIN dbo.MenuCategories c ON d.category_id = c.category_id
       OUTER APPLY (
         SELECT TOP 1 di.image_url
         FROM dbo.DishImages di
         WHERE di.dish_id = d.dish_id
         ORDER BY di.is_primary DESC, di.image_id ASC
       ) img
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

router.get("/best-selling", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT TOP 10
         d.dish_name,
         SUM(oi.quantity) AS qty_sold,
         SUM(oi.line_total) AS revenue
       FROM dbo.OrderItems oi
       JOIN dbo.Orders o ON oi.order_id = o.order_id
       JOIN dbo.Dishes d ON oi.dish_id = d.dish_id
       WHERE o.order_status <> N'Cancelled'
         AND o.created_at >= DATEADD(day, -30, CAST(SYSDATETIME() AS DATE))
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
         v.voucher_code,
         v.times_used
       FROM dbo.Promotions p
       OUTER APPLY (
         SELECT TOP 1 v2.voucher_code, v2.times_used
         FROM dbo.Vouchers v2
         WHERE v2.promotion_id = p.promotion_id
         ORDER BY v2.voucher_id ASC
       ) v
       ORDER BY p.start_at DESC;`
    );

    const promotions = rows.map((row) => {
      const start = parseDbDate(row.start_at);
      const end = parseDbDate(row.end_at);
      return {
        promo_id: row.promotion_id,
        name: row.promotion_name,
        code: row.voucher_code || "",
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
         sp.staff_id,
         sp.staff_code,
         sp.job_title,
         sp.employment_status,
         ua.full_name,
         ua.email,
         ua.phone,
         r.role_name
       FROM dbo.StaffProfiles sp
       JOIN dbo.UserAccounts ua ON sp.user_id = ua.user_id
       JOIN dbo.Roles r ON ua.role_id = r.role_id
       ORDER BY ua.full_name ASC;`
    );

    const staff = rows.map((row) => ({
      staff_id: row.staff_id,
      full_name: row.full_name,
      role_name: row.role_name,
      job_title: row.job_title,
      staff_code: row.staff_code,
      phone: row.phone || "",
      email: row.email || "",
      status: mapEmploymentStatus(row.employment_status),
      shift: "",
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
    const today = new Date();

    const [snapshotRows] = await pool.query(
      `SELECT TOP 1 snapshot_json, report_type, report_date
       FROM dbo.ReportSnapshots
       WHERE report_type IN (N'Daily Revenue', N'Weekly Revenue', N'Monthly Revenue')
       ORDER BY generated_at DESC;`
    );

    if (snapshotRows[0]?.snapshot_json) {
      try {
        const parsed = JSON.parse(snapshotRows[0].snapshot_json);
        if (parsed && (parsed.day || parsed.week || parsed.month)) {
          return jsonOk(res, {
            source: "snapshot",
            snapshot_type: snapshotRows[0].report_type,
            snapshot_date: snapshotRows[0].report_date,
            series: {
              day: parsed.day || [],
              week: parsed.week || [],
              month: parsed.month || [],
            },
          });
        }
      } catch {
        /* fall through to live aggregation */
      }
    }

    const [hourlyRows] = await pool.query(
      `SELECT
         DATEPART(hour, p.paid_at) AS bucket_hour,
         ISNULL(SUM(p.amount_paid), 0) AS revenue
       FROM dbo.Payments p
       WHERE p.payment_status = N'Completed'
         AND p.paid_at IS NOT NULL
         AND CAST(p.paid_at AS DATE) = CAST(SYSDATETIME() AS DATE)
       GROUP BY DATEPART(hour, p.paid_at)
       ORDER BY bucket_hour ASC;`
    );

    const [dailyRows] = await pool.query(
      `SELECT
         CAST(p.paid_at AS DATE) AS bucket_date,
         ISNULL(SUM(p.amount_paid), 0) AS revenue
       FROM dbo.Payments p
       WHERE p.payment_status = N'Completed'
         AND p.paid_at IS NOT NULL
         AND CAST(p.paid_at AS DATE) >= DATEADD(day, -6, CAST(SYSDATETIME() AS DATE))
       GROUP BY CAST(p.paid_at AS DATE)
       ORDER BY bucket_date ASC;`
    );

    const [weeklyRows] = await pool.query(
      `SELECT
         DATEPART(week, p.paid_at) AS bucket_week,
         MIN(CAST(p.paid_at AS DATE)) AS week_start,
         ISNULL(SUM(p.amount_paid), 0) AS revenue
       FROM dbo.Payments p
       WHERE p.payment_status = N'Completed'
         AND p.paid_at IS NOT NULL
         AND p.paid_at >= DATEADD(week, -3, CAST(SYSDATETIME() AS DATE))
       GROUP BY DATEPART(week, p.paid_at), YEAR(p.paid_at)
       ORDER BY week_start ASC;`
    );

    const formatHourLabel = (hour) => {
      const h = toNumber(hour);
      if (h === 0) return "12a";
      if (h < 12) return `${h}a`;
      if (h === 12) return "12p";
      return `${h - 12}p`;
    };

    const day = hourlyRows.map((row) => ({
      label: formatHourLabel(row.bucket_hour),
      value: Math.round((toNumber(row.revenue) / 1_000_000) * 10) / 10,
    }));

    const weekDayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const week = dailyRows.map((row) => {
      const date = parseDbDate(row.bucket_date);
      const label = date ? weekDayNames[date.getDay()] : String(row.bucket_date);
      return {
        label,
        value: Math.round((toNumber(row.revenue) / 1_000_000) * 10) / 10,
      };
    });

    const month = weeklyRows.map((row, index) => ({
      label: `W${index + 1}`,
      value: Math.round((toNumber(row.revenue) / 1_000_000) * 10) / 10,
    }));

    return jsonOk(res, {
      source: "live",
      as_of: today.toISOString(),
      series: { day, week, month },
    });
  } catch (error) {
    console.error("Staff reports/revenue failed:", error);
    return jsonError(res, "Could not load revenue report.");
  }
});

export default router;
