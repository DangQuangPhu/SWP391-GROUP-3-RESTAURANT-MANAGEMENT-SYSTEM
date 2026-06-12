import express from "express";
import { pool } from "../database/db.js";
import { resolveUserId, requireUserId } from "../middleware/authMiddleware.js";
import { TABLE_DISPLAY } from "../utils/constants.js";
import { getMembershipInfo, canAccessArea } from "../utils/membership.js";

const router = express.Router();

/* ------------------------------------------------------------------ */
/* Display mapping (presentation only — DB keeps real area/table data) */
/* ------------------------------------------------------------------ */

// Maps a DB table_number -> premium UI label + floor/zone hints.
const TABLE_DISPLAY = {
  T01: { displayLabel: "101", floor: 1, zone: "Main Dining" },
  T02: { displayLabel: "102", floor: 1, zone: "Main Dining" },
  T03: { displayLabel: "103", floor: 1, zone: "Main Dining" },
  T04: { displayLabel: "104", floor: 1, zone: "Main Dining" },
  V01: { displayLabel: "VIP-101", floor: 1, zone: "VIP Lounge" },
  V02: { displayLabel: "VIP-102", floor: 1, zone: "VIP Lounge" },
  B01: { displayLabel: "BAR-101", floor: 1, zone: "Window / Bar" },
  P01: { displayLabel: "PR-101", floor: 1, zone: "Private Room" },
  G01: { displayLabel: "201", floor: 2, zone: "Rooftop Terrace" },
  G02: { displayLabel: "202", floor: 2, zone: "Rooftop Terrace" },
};

function decorateTable(row) {
  const meta = TABLE_DISPLAY[row.table_number] || {
    displayLabel: row.table_number,
    floor: 1,
    zone: row.area_name,
  };
  return { ...meta };
}

/* ------------------------------------------------------------------ */
/* Settings helpers                                                    */
/* ------------------------------------------------------------------ */

const SETTING_KEYS = [
  "open_time",
  "close_time",
  "max_guests",
  "table_hold_min",
  "cancel_deadline_h",
  "restaurant_name",
];

async function loadSettings() {
  const placeholders = SETTING_KEYS.map(() => "?").join(", ");
  const [rows] = await pool.query(
    `SELECT setting_key, setting_value FROM dbo.RestaurantSettings WHERE setting_key IN (${placeholders})`,
    SETTING_KEYS
  );

  const map = {};
  for (const row of rows) {
    map[row.setting_key] = row.setting_value;
  }

  return {
    open_time: map.open_time || "10:00",
    close_time: map.close_time || "22:00",
    max_guests: Number(map.max_guests) || 12,
    table_hold_min: Number(map.table_hold_min) || 15,
    cancel_deadline_h: Number(map.cancel_deadline_h) || 2,
    restaurant_name: map.restaurant_name || "Phūrai Premium Restaurant",
  };
}

/* ------------------------------------------------------------------ */
/* Date / time helpers                                                 */
/* ------------------------------------------------------------------ */

// Build a local Date from "YYYY-MM-DD" + "HH:mm".
function buildLocalDate(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const [y, m, d] = String(dateStr).split("-").map(Number);
  const [hh, mm] = String(timeStr).split(":").map(Number);
  if ([y, m, d, hh, mm].some((n) => !Number.isFinite(n))) return null;
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

function timeToMinutes(timeStr) {
  const [hh, mm] = String(timeStr).split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

function formatLocalIso(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

const UNAVAILABLE_REASON = {
  Reserved: "Already booked",
  Occupied: "Currently occupied",
  Cleaning: "Being cleaned",
  Inactive: "Not in service",
  Booked: "Already booked for this time",
};

const BLOCKING_STATUSES = ["Pending", "Confirmed", "Checked In"];

/* ------------------------------------------------------------------ */
/* Suggestion logic                                                    */
/* ------------------------------------------------------------------ */

// Pick the best single table or combination for a guest count.
function computeRecommendations(tables, guestCount) {
  const bookable = tables
    .filter((t) => t.is_bookable)
    .sort((a, b) => a.capacity - b.capacity);

  // 1) Smallest single table that fits.
  const single = bookable.find((t) => t.capacity >= guestCount);
  if (single) return [single.table_id];

  // 2) Greedy combination (largest first) within the same floor when possible.
  const byFloor = {};
  for (const t of bookable) {
    byFloor[t.floor] = byFloor[t.floor] || [];
    byFloor[t.floor].push(t);
  }

  for (const floor of Object.keys(byFloor)) {
    const sorted = [...byFloor[floor]].sort((a, b) => b.capacity - a.capacity);
    const picked = [];
    let total = 0;
    for (const t of sorted) {
      picked.push(t.table_id);
      total += t.capacity;
      if (total >= guestCount) return picked;
    }
  }

  return [];
}

/* ------------------------------------------------------------------ */
/* Expire Old Holds                                                   */
/* ------------------------------------------------------------------ */

async function expireOldHolds() {
  try {
    const [rows] = await pool.query(`
      SELECT reservation_id, reservation_start_at, special_request 
      FROM dbo.Reservations 
      WHERE reservation_status IN (N'Pending', N'Confirmed')
    `);
    
    if (rows.length === 0) return;
    
    const now = Date.now();
    const toExpire = [];
    
    for (const r of rows) {
      const match = String(r.special_request || '').match(/\[Hold:\s*(\d+)m\]/);
      const holdMins = match ? parseInt(match[1], 10) : 30; // default 30 mins if not found
      const startMs = new Date(r.reservation_start_at).getTime();
      
      if (now > startMs + holdMins * 60000) {
        toExpire.push(r.reservation_id);
      }
    }
    
    if (toExpire.length > 0) {
      const placeholders = toExpire.map(() => '?').join(',');
      await pool.query(`
        UPDATE dbo.Reservations
        SET reservation_status = N'Expired', updated_at = SYSDATETIME()
        WHERE reservation_id IN (${placeholders})
      `, toExpire);
    }
  } catch (err) {
    console.error("Failed to expire old holds:", err);
  }
}

/* ------------------------------------------------------------------ */
/* GET /api/reservations/settings                                      */
/* ------------------------------------------------------------------ */

router.get("/settings", async (_req, res) => {
  try {
    const settings = await loadSettings();
    return res.json({ success: true, settings });
  } catch (error) {
    console.error("Load reservation settings failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Could not load reservation settings." });
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/reservations/menu  (dishes available for preorder)         */
/* ------------------------------------------------------------------ */

router.get("/menu", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT d.dish_id, d.dish_name, d.price, c.category_name, c.display_order
       FROM dbo.Dishes d
       JOIN dbo.MenuCategories c ON d.category_id = c.category_id
       WHERE d.is_available = 1 AND c.is_active = 1
       ORDER BY c.display_order, d.dish_name;`
    );

    const dishes = rows.map((r) => ({
      dish_id: r.dish_id,
      dish_name: r.dish_name,
      price: Number(r.price),
      category_name: r.category_name,
    }));

    return res.json({ success: true, dishes });
  } catch (error) {
    console.error("Load preorder menu failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Could not load the preorder menu." });
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/reservations/availability                                  */
/* ------------------------------------------------------------------ */

router.get("/availability", async (req, res) => {
  try {
    await expireOldHolds();

    const { date, time } = req.query;
    const durationMinutes = Number(req.query.durationMinutes) || 120;
    const guestCount = Number(req.query.guestCount) || 1;
    const areaType = req.query.areaType || null;

    const slotStart = buildLocalDate(date, time);
    if (!slotStart) {
      return res
        .status(400)
        .json({ success: false, message: "Valid date and time are required." });
    }
    const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);

    const settings = await loadSettings();

    // Availability query — checks static status + overlapping reservations.
    const [rows] = await pool.query(
      `SELECT
         t.table_id, t.table_number, t.capacity, t.notes,
         t.table_status AS current_status,
         a.area_id, a.area_name, a.area_type,
         CASE
           WHEN t.table_status IN (N'Occupied', N'Cleaning', N'Inactive', N'Reserved')
             THEN t.table_status
           WHEN EXISTS (
             SELECT 1
             FROM dbo.ReservationTables rt
             JOIN dbo.Reservations r ON rt.reservation_id = r.reservation_id
             WHERE rt.table_id = t.table_id
               AND r.reservation_status IN (N'Pending', N'Confirmed', N'Checked In')
               AND r.reservation_start_at < ?
               AND r.reservation_end_at > ?
           ) THEN N'Booked'
           ELSE N'Available'
         END AS availability_at_slot
       FROM dbo.RestaurantTables t
       JOIN dbo.RestaurantAreas a ON t.area_id = a.area_id
       WHERE a.is_active = 1
       ORDER BY a.area_type, t.table_number;`,
      [slotEnd, slotStart]
    );

    let tables = rows.map((row) => {
      const meta = decorateTable(row);
      const availability = row.availability_at_slot;
      const isBookable = availability === "Available";
      const isTooSmall = row.capacity < guestCount;
      return {
        table_id: row.table_id,
        table_number: row.table_number,
        display_label: meta.displayLabel,
        floor: meta.floor,
        zone: meta.zone,
        area_id: row.area_id,
        area_name: row.area_name,
        area_type: row.area_type,
        capacity: row.capacity,
        notes: row.notes || null,
        current_status: row.current_status,
        availability_at_slot: availability,
        is_bookable: isBookable,
        is_too_small: isTooSmall,
        is_suggested: false,
        reason: isBookable ? null : UNAVAILABLE_REASON[availability] || "Unavailable",
      };
    });

    // Optional area filter (by area_type), keeps booking authoritative on backend.
    if (areaType) {
      const wanted = String(areaType).toLowerCase();
      tables = tables.map((t) => ({
        ...t,
        matches_area: t.area_type.toLowerCase() === wanted,
      }));
    }

    const recommendedTableIds = computeRecommendations(tables, guestCount);
    const recommendedSet = new Set(recommendedTableIds);
    tables = tables.map((t) => ({
      ...t,
      is_suggested: recommendedSet.has(t.table_id),
    }));

    return res.json({
      success: true,
      slotStart: formatLocalIso(slotStart),
      slotEnd: formatLocalIso(slotEnd),
      durationMinutes,
      guestCount,
      settings,
      tables,
      recommendedTableIds,
    });
  } catch (error) {
    console.error("Reservation availability failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Could not load table availability." });
  }
});

/* ------------------------------------------------------------------ */
/* POST /api/reservations                                              */
/* ------------------------------------------------------------------ */

router.post("/", resolveUserId, async (req, res) => {
  const {
    reservation_start_at,
    reservation_end_at,
    date,
    time,
    durationMinutes,
    guest_count,
    preferred_area_id,
    table_ids,
    contact_name,
    contact_email,
    contact_phone,
    special_request,
  } = req.body || {};

  // Resolve slot (accept either explicit datetimes or date+time+duration).
  let slotStart = reservation_start_at ? new Date(reservation_start_at) : buildLocalDate(date, time);
  let slotEnd = reservation_end_at
    ? new Date(reservation_end_at)
    : slotStart
    ? new Date(slotStart.getTime() + (Number(durationMinutes) || 120) * 60000)
    : null;

  if (!slotStart || Number.isNaN(slotStart.getTime()) || !slotEnd || Number.isNaN(slotEnd.getTime())) {
    return res.status(400).json({ success: false, message: "Invalid reservation date/time." });
  }
  if (slotEnd <= slotStart) {
    return res.status(400).json({ success: false, message: "End time must be after start time." });
  }
  if (slotStart.getTime() <= Date.now()) {
    return res.status(400).json({ success: false, message: "Reservation time must be in the future." });
  }

  const guestCount = Number(guest_count);
  if (!Number.isFinite(guestCount) || guestCount < 1) {
    return res.status(400).json({ success: false, message: "Guest count must be at least 1." });
  }

  const tableIds = Array.isArray(table_ids)
    ? [...new Set(table_ids.map(Number).filter((n) => Number.isFinite(n) && n > 0))]
    : [];
  if (tableIds.length === 0) {
    return res.status(400).json({ success: false, message: "Please select at least one table." });
  }

  const customerId = req.userId || null; // logged-in user, else guest (NULL)

  // Guests must supply contact details (stored in special_request — no schema change).
  if (!customerId) {
    if (!String(contact_name || "").trim() || !String(contact_email || "").trim() || !String(contact_phone || "").trim()) {
      return res.status(400).json({
        success: false,
        message: "Guest reservations require full name, email, and phone.",
      });
    }
  }

  try {
    const settings = await loadSettings();

    if (guestCount > settings.max_guests) {
      return res.status(400).json({
        success: false,
        message: `Guest count cannot exceed ${settings.max_guests}. Please contact us for larger groups.`,
      });
    }

    // Opening-hours validation.
    const openMin = timeToMinutes(settings.open_time);
    const closeMin = timeToMinutes(settings.close_time);
    const startMin = slotStart.getHours() * 60 + slotStart.getMinutes();
    const endMin = startMin + Math.round((slotEnd - slotStart) / 60000);
    if (openMin != null && closeMin != null && (startMin < openMin || endMin > closeMin)) {
      return res.status(400).json({
        success: false,
        message: `Reservations must be between ${settings.open_time} and ${settings.close_time}.`,
      });
    }

    // Compose special_request with structured contact/purpose info for guests.
    const finalSpecialRequest = String(special_request || "").slice(0, 1000) || null;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Re-check availability for the selected tables INSIDE the transaction.
      const inPlaceholders = tableIds.map(() => "?").join(", ");
      const [checkRows] = await connection.query(
        `SELECT
           t.table_id, t.table_number, t.capacity, t.table_status,
           CASE
             WHEN t.table_status IN (N'Occupied', N'Cleaning', N'Inactive', N'Reserved')
               THEN t.table_status
             WHEN EXISTS (
               SELECT 1
               FROM dbo.ReservationTables rt WITH (UPDLOCK, HOLDLOCK)
               JOIN dbo.Reservations r WITH (UPDLOCK, HOLDLOCK)
                 ON rt.reservation_id = r.reservation_id
               WHERE rt.table_id = t.table_id
                 AND r.reservation_status IN (N'Pending', N'Confirmed', N'Checked In')
                 AND r.reservation_start_at < ?
                 AND r.reservation_end_at > ?
             ) THEN N'Booked'
             ELSE N'Available'
           END AS availability_at_slot,
           a.area_name
         FROM dbo.RestaurantTables t
         LEFT JOIN dbo.RestaurantAreas a ON t.area_id = a.area_id
         WHERE t.table_id IN (${inPlaceholders});`,
        [slotEnd, slotStart, ...tableIds]
      );

      if (checkRows.length !== tableIds.length) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ success: false, message: "One or more selected tables do not exist." });
      }

      // 1. Fetch user membership tier (if logged in, else Bronze)
      let currentTier = "Bronze";
      if (customerId) {
        const [userRows] = await connection.query(
          `SELECT membership_tier FROM dbo.CustomerProfiles WHERE user_id = ?`,
          [customerId]
        );
        if (userRows.length > 0 && userRows[0].membership_tier) {
          currentTier = userRows[0].membership_tier;
        }
      }

      const conflict = checkRows.find((r) => r.availability_at_slot !== "Available");
      if (conflict) {
        await connection.rollback();
        connection.release();
        return res.status(409).json({
          success: false,
          code: "TABLE_UNAVAILABLE",
          message:
            "This table has just been booked or is unavailable. Please choose another table.",
        });
      }

      for (const row of checkRows) {
        if (!canAccessArea(currentTier, row.area_name)) {
          await connection.rollback();
          connection.release();
          return res.status(403).json({
            success: false,
            message: "Your membership tier is not eligible for this table.",
          });
        }
      }

      const totalCapacity = checkRows.reduce((sum, r) => sum + Number(r.capacity), 0);
      if (totalCapacity < guestCount) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: "Selected tables cannot seat your whole party. Please add another table.",
        });
      }

      // Insert reservation. Online bookings start as Pending (manager confirms).
      const [insertedRows] = await connection.query(
        `INSERT INTO dbo.Reservations
           (customer_id, preferred_area_id, reservation_start_at, reservation_end_at,
            guest_count, special_request, reservation_status, reservation_source)
         OUTPUT INSERTED.reservation_id, INSERTED.reservation_status, INSERTED.created_at
         VALUES (?, ?, ?, ?, ?, ?, N'Pending', N'Online');`,
        [
          customerId,
          preferred_area_id ? Number(preferred_area_id) : null,
          slotStart,
          slotEnd,
          guestCount,
          finalSpecialRequest,
        ]
      );

      const created = insertedRows[0];
      const reservationId = created.reservation_id;

      for (const tableId of tableIds) {
        await connection.query(
          `INSERT INTO dbo.ReservationTables (reservation_id, table_id) VALUES (?, ?);`,
          [reservationId, tableId]
        );
      }

      await connection.commit();
      connection.release();

      const tableSummaries = checkRows.map((r) => {
        const meta = TABLE_DISPLAY[r.table_number] || { displayLabel: r.table_number };
        return {
          table_id: r.table_id,
          table_number: r.table_number,
          display_label: meta.displayLabel,
          capacity: r.capacity,
        };
      });

      return res.status(201).json({
        success: true,
        reservation: {
          reservation_id: reservationId,
          reservation_status: created.reservation_status,
          reservation_start_at: formatLocalIso(slotStart),
          reservation_end_at: formatLocalIso(slotEnd),
          guest_count: guestCount,
          special_request: finalSpecialRequest,
          tables: tableSummaries,
          is_guest: !customerId,
        },
      });
    } catch (txError) {
      try {
        await connection.rollback();
      } catch {
        /* ignore rollback failure */
      }
      connection.release();
      throw txError;
    }
  } catch (error) {
    console.error("Create reservation failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Could not create reservation. Please try again." });
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/reservations/my                                            */
/* ------------------------------------------------------------------ */

router.get("/my", resolveUserId, requireUserId, async (req, res) => {
  try {
    await expireOldHolds();

    const [rows] = await pool.query(
      `SELECT
         r.reservation_id, r.reservation_start_at, r.reservation_end_at,
         r.guest_count, r.special_request, r.reservation_status,
         r.created_at, r.cancelled_at, r.cancel_reason,
         a.area_name, a.area_type
       FROM dbo.Reservations r
       LEFT JOIN dbo.RestaurantAreas a ON r.preferred_area_id = a.area_id
       WHERE r.customer_id = ?
       ORDER BY r.reservation_start_at DESC;`,
      [req.userId]
    );

    const ids = rows.map((r) => r.reservation_id);
    let tablesByReservation = {};
    let preorderByReservation = {};
    if (ids.length > 0) {
      const placeholders = ids.map(() => "?").join(", ");
      const [tableRows] = await pool.query(
        `SELECT rt.reservation_id, t.table_number, t.capacity
         FROM dbo.ReservationTables rt
         JOIN dbo.RestaurantTables t ON rt.table_id = t.table_id
         WHERE rt.reservation_id IN (${placeholders});`,
        ids
      );
      tablesByReservation = tableRows.reduce((acc, row) => {
        const meta = TABLE_DISPLAY[row.table_number] || { displayLabel: row.table_number };
        acc[row.reservation_id] = acc[row.reservation_id] || [];
        acc[row.reservation_id].push({
          table_number: row.table_number,
          display_label: meta.displayLabel,
          capacity: row.capacity,
        });
        return acc;
      }, {});

      const [preorderRows] = await pool.query(
        `SELECT p.reservation_id, p.dish_id, p.quantity, p.unit_price, d.dish_name
         FROM dbo.PreorderItems p
         JOIN dbo.Dishes d ON p.dish_id = d.dish_id
         WHERE p.reservation_id IN (${placeholders});`,
        ids
      );
      preorderByReservation = preorderRows.reduce((acc, row) => {
        acc[row.reservation_id] = acc[row.reservation_id] || [];
        acc[row.reservation_id].push({
          dish_id: row.dish_id,
          dish_name: row.dish_name,
          quantity: row.quantity,
          unit_price: Number(row.unit_price),
        });
        return acc;
      }, {});
    }

    const reservations = rows.map((r) => ({
      reservation_id: r.reservation_id,
      reservation_start_at: r.reservation_start_at,
      reservation_end_at: r.reservation_end_at,
      guest_count: r.guest_count,
      special_request: r.special_request,
      reservation_status: r.reservation_status,
      created_at: r.created_at,
      cancelled_at: r.cancelled_at,
      cancel_reason: r.cancel_reason,
      area_name: r.area_name,
      area_type: r.area_type,
      tables: tablesByReservation[r.reservation_id] || [],
      preorders: preorderByReservation[r.reservation_id] || [],
    }));

    return res.json({ success: true, reservations });
  } catch (error) {
    console.error("Load my reservations failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Could not load your reservations." });
  }
});

/* ------------------------------------------------------------------ */
/* PATCH /api/reservations/:id/cancel                                  */
/* ------------------------------------------------------------------ */

router.patch("/:id/cancel", resolveUserId, requireUserId, async (req, res) => {
  try {
    const reservationId = Number(req.params.id);
    if (!Number.isFinite(reservationId) || reservationId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid reservation id." });
    }

    const [rows] = await pool.query(
      `SELECT reservation_id, customer_id, reservation_status, reservation_start_at
       FROM dbo.Reservations WHERE reservation_id = ?;`,
      [reservationId]
    );
    const reservation = rows[0];
    if (!reservation) {
      return res.status(404).json({ success: false, message: "Reservation not found." });
    }
    if (Number(reservation.customer_id) !== Number(req.userId)) {
      return res.status(403).json({ success: false, message: "You cannot modify this reservation." });
    }

    const blocked = ["Checked In", "Completed", "No Show", "Cancelled"];
    if (blocked.includes(reservation.reservation_status)) {
      return res.status(400).json({
        success: false,
        message: `Reservation cannot be cancelled (status: ${reservation.reservation_status}).`,
      });
    }

    const settings = await loadSettings();
    const startAt = new Date(reservation.reservation_start_at);
    const deadlineMs = settings.cancel_deadline_h * 3600000;
    if (startAt.getTime() - Date.now() < deadlineMs) {
      return res.status(400).json({
        success: false,
        message: `Reservations must be cancelled at least ${settings.cancel_deadline_h} hour(s) in advance.`,
      });
    }

    const reason = String(req.body?.cancel_reason || "Cancelled by customer").slice(0, 255);
    await pool.query(
      `UPDATE dbo.Reservations
       SET reservation_status = N'Cancelled', cancelled_at = SYSDATETIME(),
           cancel_reason = ?, updated_at = SYSDATETIME()
       WHERE reservation_id = ?;`,
      [reason, reservationId]
    );

    return res.json({ success: true, message: "Reservation cancelled." });
  } catch (error) {
    console.error("Cancel reservation failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Could not cancel reservation." });
  }
});

/* ------------------------------------------------------------------ */
/* POST /api/reservations/:id/preorder  (optional Phase 2)            */
/* Replaces the reservation's preorder list with the provided items.   */
/* ------------------------------------------------------------------ */

router.post("/:id/preorder", resolveUserId, requireUserId, async (req, res) => {
  const reservationId = Number(req.params.id);
  if (!Number.isFinite(reservationId) || reservationId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid reservation id." });
  }

  // Normalize requested items: { dish_id, quantity, notes }.
  const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
  const wantedQty = new Map();
  const notesByDish = new Map();
  for (const item of rawItems) {
    const dishId = Number(item?.dish_id);
    const qty = Math.floor(Number(item?.quantity));
    if (!Number.isFinite(dishId) || dishId <= 0) continue;
    if (!Number.isFinite(qty) || qty <= 0) continue;
    wantedQty.set(dishId, (wantedQty.get(dishId) || 0) + qty);
    if (item?.notes && !notesByDish.has(dishId)) {
      notesByDish.set(dishId, String(item.notes).slice(0, 255));
    }
  }

  try {
    // Ownership + status guard (read outside tx is fine; re-validated below).
    const [resRows] = await pool.query(
      `SELECT reservation_id, customer_id, reservation_status
       FROM dbo.Reservations WHERE reservation_id = ?;`,
      [reservationId]
    );
    const reservation = resRows[0];
    if (!reservation) {
      return res.status(404).json({ success: false, message: "Reservation not found." });
    }
    if (Number(reservation.customer_id) !== Number(req.userId)) {
      return res.status(403).json({ success: false, message: "You cannot modify this reservation." });
    }
    const allowed = ["Pending", "Confirmed"];
    if (!allowed.includes(reservation.reservation_status)) {
      return res.status(400).json({
        success: false,
        message: `Pre-orders can only be edited while a reservation is Pending or Confirmed (current: ${reservation.reservation_status}).`,
      });
    }

    const dishIds = [...wantedQty.keys()];

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Always clear current preorder list for this reservation first.
      await connection.query(
        `DELETE FROM dbo.PreorderItems WHERE reservation_id = ?;`,
        [reservationId]
      );

      let insertedItems = [];
      if (dishIds.length > 0) {
        // Re-fetch authoritative prices (never trust client prices).
        const placeholders = dishIds.map(() => "?").join(", ");
        const [dishRows] = await connection.query(
          `SELECT dish_id, dish_name, price FROM dbo.Dishes
           WHERE dish_id IN (${placeholders}) AND is_available = 1;`,
          dishIds
        );

        if (dishRows.length !== dishIds.length) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({
            success: false,
            message: "One or more selected dishes are not available.",
          });
        }

        for (const dish of dishRows) {
          const qty = wantedQty.get(dish.dish_id);
          const notes = notesByDish.get(dish.dish_id) || null;
          await connection.query(
            `INSERT INTO dbo.PreorderItems (reservation_id, dish_id, quantity, unit_price, notes)
             VALUES (?, ?, ?, ?, ?);`,
            [reservationId, dish.dish_id, qty, Number(dish.price), notes]
          );
          insertedItems.push({
            dish_id: dish.dish_id,
            dish_name: dish.dish_name,
            quantity: qty,
            unit_price: Number(dish.price),
          });
        }
      }

      await connection.commit();
      connection.release();

      const total = insertedItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
      return res.json({
        success: true,
        message: insertedItems.length
          ? "Pre-order saved."
          : "Pre-order cleared.",
        reservation_id: reservationId,
        preorders: insertedItems,
        preorder_total: total,
      });
    } catch (txError) {
      try {
        await connection.rollback();
      } catch {
        /* ignore rollback failure */
      }
      connection.release();
      throw txError;
    }
  } catch (error) {
    console.error("Save preorder failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Could not save pre-order. Please try again." });
  }
});

export default router;
