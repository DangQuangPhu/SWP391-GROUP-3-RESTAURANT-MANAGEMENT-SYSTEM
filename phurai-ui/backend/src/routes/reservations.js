import express from "express";

import pool from "../db.js";
import { resolveUserId, requireUserId } from "../middleware/authMiddleware.js";
import { getMembershipInfo, canAccessArea } from "../utils/membership.js";
import {
  getKitchenViewPlaceholderTableId,
  getKitchenViewSeatsBooked,
  isKitchenViewAreaName,
  KITCHEN_VIEW_AREA_NAME,
  resolveKitchenViewCounterCapacity,
} from "../utils/kitchenViewBooking.js";
import { notifyStaffNewCustomerAction } from "../services/notificationService.js";
import { getIO } from "../socket.js";
import { sendBookingConfirmationEmail } from "../email.js";
import { RESERVATION_STATUS } from "../constants/reservationStatus.js"; // backend-local copy — do NOT import from frontend/ (breaks Docker)
import { updateReservationStatus } from "../services/reservationStateService.js";
import { submitEditRequest, submitCancelRequest } from "../services/reservationRequestService.js";
import {
  createPreSaveReservation,
  cancelPendingPayment,
  applyPromoCodeToReservation,
  submitReservationReview
} from "../controllers/customerReservationController.js";
import { validateReservationCreate, validateReservationUpdate } from "../middleware/validateReservation.js";
import { getReservationTimeline } from "../utils/timelineLogger.js";

const router = express.Router();

/* ------------------------------------------------------------------ */
/* POST /api/reservations/:id/review                                   */
/* ------------------------------------------------------------------ */
router.post("/:id/review", submitReservationReview);

/* ------------------------------------------------------------------ */
/* POST /api/reservations/pre-save                                     */
/* ------------------------------------------------------------------ */
router.post("/pre-save", resolveUserId, validateReservationCreate, createPreSaveReservation);

/* ------------------------------------------------------------------ */
/* PATCH /api/reservations/:id/abort-payment                            */
/* ------------------------------------------------------------------ */
router.patch("/:id/abort-payment", resolveUserId, cancelPendingPayment);

/* ------------------------------------------------------------------ */
/* GET /api/reservations/:id/timeline                                   */
/* ------------------------------------------------------------------ */
router.get("/:id/timeline", resolveUserId, getReservationTimeline);

/* ------------------------------------------------------------------ */
/* PATCH /api/reservations/:id/apply-promo                            */
/* ------------------------------------------------------------------ */
router.patch("/:id/apply-promo", resolveUserId, applyPromoCodeToReservation);

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
    `SELECT setting_key, setting_value
     FROM dbo.RestaurantSettings
     WHERE setting_key IN (${placeholders})`,
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
/* Expire Old Holds                                                    */
/* ------------------------------------------------------------------ */

async function expireOldHolds() {
  try {
    const [rows] = await pool.query(`
      SELECT reservation_id, reservation_start_at, special_request, reservation_status
      FROM dbo.Reservations
      WHERE reservation_status IN (N'Pending Request', N'Confirmed', N'Reserved', N'Pending Payment')
    `);

    if (rows.length === 0) return;

    const now = Date.now();
    const toExpire = [];

    for (const r of rows) {
      const match = String(r.special_request || "").match(/\[Hold:\s*(\d+)m\]/);
      const holdMins = match ? parseInt(match[1], 10) : 30;
      const startMs = new Date(r.reservation_start_at).getTime();

      if (now > startMs + holdMins * 60000) {
        toExpire.push(r.reservation_id);
      }
    }

    if (toExpire.length > 0) {
      const placeholders = toExpire.map(() => "?").join(",");

      // 1) Release tables assigned to the expired reservations
      await pool.query(
        `
        UPDATE dbo.RestaurantTables
        SET table_status = N'Available',
            updated_at = SYSDATETIME()
        WHERE table_id IN (
            SELECT table_id
            FROM dbo.ReservationTables
            WHERE reservation_id IN (${placeholders})
        )
        `,
        toExpire
      );

      // 2) Update reservation status to Cancelled to comply with CHECK constraint
      for (const resId of toExpire) {
        try {
          await updateReservationStatus({
            connection: pool,
            reservationId: resId,
            toStatus: RESERVATION_STATUS.CANCELLED,
            staffId: null,
            auditAction: "SYSTEM_HOLD_EXPIRED",
            extraUpdates: ", cancel_reason = N'Hold expired', cancelled_at = SYSDATETIME()"
          });
        } catch (e) {
          console.error("[expireOldHolds] Failed to update status for", resId, e.message);
        }
      }
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

    return res.status(500).json({
      success: false,
      message: "Could not load reservation settings.",
    });
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/reservations/menu                                          */
/* ------------------------------------------------------------------ */

router.get("/menu", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT d.dish_id, d.dish_name, d.price, c.category_name, c.display_order
       FROM dbo.Dishes d
       JOIN dbo.MenuCategories c ON d.category_id = c.category_id
       WHERE d.is_available = 1
         AND c.is_active = 1
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

    return res.status(500).json({
      success: false,
      message: "Could not load the preorder menu.",
    });
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
      return res.status(400).json({
        success: false,
        message: "Valid date and time are required.",
      });
    }

    const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);
    const settings = await loadSettings();

    const [rows] = await pool.query(
      `SELECT
         t.table_id,
         t.table_number,
         t.capacity,
         t.notes,
         t.table_status AS current_status,
         t.merged_into_table_id,
         a.area_id,
         a.area_name,
         a.area_type,
         CASE
           WHEN t.table_status IN (N'Occupied', N'Cleaning', N'Inactive', N'Reserved')
             THEN t.table_status
           WHEN EXISTS (
             SELECT 1
             FROM dbo.ReservationTables rt
             JOIN dbo.Reservations r ON rt.reservation_id = r.reservation_id
             WHERE rt.table_id = t.table_id
               AND (
                 r.reservation_status IN (N'Confirmed', N'Reserved', N'Dining')
                 OR
                 (r.reservation_status IN (N'Pending Request', N'Pending Payment') AND r.created_at >= DATEADD(minute, -15, SYSDATETIME()))
               )
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
        merged_into_table_id: row.merged_into_table_id || null,
        notes: row.notes || null,
        current_status: row.current_status,
        availability_at_slot: availability,
        is_bookable: isBookable,
        is_too_small: isTooSmall,
        is_suggested: false,
        reason: isBookable
          ? null
          : UNAVAILABLE_REASON[availability] || "Unavailable",
      };
    });

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

    return res.status(500).json({
      success: false,
      message: "Could not load table availability.",
    });
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/reservations/status                                        */
/* ------------------------------------------------------------------ */

router.get("/status", async (req, res) => {
  const { txn_ref } = req.query;
  if (!txn_ref) {
    return res.status(400).json({ success: false, message: "Missing txn_ref parameter." });
  }

  try {
    const [rows] = await pool.query(
      `SELECT reservation_id, reservation_status, vnp_txn_ref 
       FROM dbo.Reservations 
       WHERE vnp_txn_ref = ?`,
      [txn_ref]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Reservation not found for the given transaction reference." });
    }

    const { reservation_id, reservation_status } = rows[0];

    // Map to public statuses
    let publicStatus = "Pending";
    if (reservation_status === RESERVATION_STATUS.CONFIRMED || reservation_status === RESERVATION_STATUS.PENDING_REQUEST) {
      return res.redirect(`/payment/vnpay_return${req.url.substring(req.url.indexOf("?"))}`);
    } else if (reservation_status === RESERVATION_STATUS.CANCELLED) {
      publicStatus = "PaymentFailed";
    }

    return res.json({
      success: true,
      status: publicStatus,
      reservation_id: reservation_id
    });
  } catch (error) {
    console.error("Error fetching reservation status by txn_ref:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});



/* ------------------------------------------------------------------ */
/* POST /api/reservations                                              */
/* ------------------------------------------------------------------ */

router.post("/", resolveUserId, validateReservationCreate, async (req, res) => {
  const {
    reservation_start_at,
    reservation_end_at,
    date,
    time,
    durationMinutes,
    guest_count,
    preferred_area_id,
    table_ids,
    // Accept both field name conventions from the frontend
    contact_name,  contact_email,  contact_phone,
    guest_name:    guestNameField,
    guest_phone:   guestPhoneField,
    guest_email:   guestEmailField,
    special_request,
    preorderItems,
    preorder_items,
    // Booking metadata — frontend may send as dining_purpose or occasion
    dining_purpose,
    occasion,
    duration,
  } = req.body || {};

  // Normalise contact fields: prefer guest_* prefix (new), fall back to contact_* (legacy)
  const guestNameRaw  = guestNameField  || contact_name  || null;
  const guestPhoneRaw = guestPhoneField || contact_phone || null;
  const guestEmailRaw = guestEmailField || contact_email || null;
  // Support both camelCase and snake_case preorder field names
  const preorderItemsRaw = req.body.preorder_items || req.body.pre_order_items || req.body.preorderItems || [];

  console.log("POST /api/reservations body:", JSON.stringify(req.body, null, 2));
  console.log("Parsed preorderItems:", preorderItemsRaw);
  console.log("Parsed table_ids:", table_ids);
  console.log("Parsed preferred_area_id:", preferred_area_id);
  console.log("Parsed userId:", req.userId);

  let slotStart = reservation_start_at
    ? new Date(reservation_start_at)
    : buildLocalDate(date, time);

  let slotEnd = reservation_end_at
    ? new Date(reservation_end_at)
    : slotStart
      ? new Date(slotStart.getTime() + (Number(durationMinutes) || 120) * 60000)
      : null;

  if (
    !slotStart ||
    Number.isNaN(slotStart.getTime()) ||
    !slotEnd ||
    Number.isNaN(slotEnd.getTime())
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid reservation date/time.",
    });
  }

  if (slotEnd <= slotStart) {
    return res.status(400).json({
      success: false,
      message: "End time must be after start time.",
    });
  }

  if (slotStart.getTime() <= Date.now()) {
    return res.status(400).json({
      success: false,
      message: "Reservation time must be in the future.",
    });
  }

  const guestCount = Number(guest_count);

  if (!Number.isFinite(guestCount) || guestCount < 1) {
    return res.status(400).json({
      success: false,
      message: "Guest count must be at least 1.",
    });
  }

  const tableIds = Array.isArray(table_ids)
    ? [...new Set(table_ids.map(Number).filter((n) => Number.isFinite(n) && n > 0))]
    : [];

  let effective_preferred_area_id = preferred_area_id;

  if (!effective_preferred_area_id && tableIds.length > 0) {
    const [tableAreaRows] = await pool.query(
      `SELECT DISTINCT area_id FROM dbo.RestaurantTables WHERE table_id IN (${tableIds.join(',')})`
    );
    if (tableAreaRows.length > 1) {
      return res.status(400).json({ success: false, message: "Selected tables must be in the same area." });
    } else if (tableAreaRows.length === 1) {
      effective_preferred_area_id = tableAreaRows[0].area_id;
    }
  }

  let kitchenViewBooking = false;
  let kitchenArea = null;

  if (effective_preferred_area_id) {
    const [areaRows] = await pool.query(
      `SELECT TOP 1 area_id, area_name, area_type, is_active
       FROM dbo.RestaurantAreas
       WHERE area_id = ?;`,
      [Number(effective_preferred_area_id)]
    );
    kitchenArea = areaRows[0] || null;
    kitchenViewBooking = Boolean(kitchenArea && isKitchenViewAreaName(kitchenArea.area_name));
  }

  if (!kitchenViewBooking && tableIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Please select at least one table.",
    });
  }

  let customerId = Number(req.userId);

  if (!Number.isFinite(customerId) || customerId <= 0) {
    customerId = null;
  }

  if (!customerId) {
    if (
      !String(guestNameRaw || "").trim() ||
      !String(guestEmailRaw || "").trim() ||
      !String(guestPhoneRaw || "").trim()
    ) {
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

    const openMin = timeToMinutes(settings.open_time);
    const closeMin = timeToMinutes(settings.close_time);
    const startMin = slotStart.getHours() * 60 + slotStart.getMinutes();
    const endMin = startMin + Math.round((slotEnd - slotStart) / 60000);

    if (
      openMin != null &&
      closeMin != null &&
      (startMin < openMin || endMin > closeMin)
    ) {
      return res.status(400).json({
        success: false,
        message: `Reservations must be between ${settings.open_time} and ${settings.close_time}.`,
      });
    }

    let assembledSpecialRequest = [];
    const effectiveDiningPurpose = dining_purpose || occasion;
    // Only store dining purpose if customer explicitly picked a non-default purpose
    if (effectiveDiningPurpose && effectiveDiningPurpose.toLowerCase() !== 'casual dinner') {
      assembledSpecialRequest.push(`[Dining Purpose: ${effectiveDiningPurpose}]`);
    }
    // Only store hold time if there's also a real user note
    const userNoteText = special_request && special_request.trim();
    if (userNoteText) {
      if (req.body.hold_time || durationMinutes) {
        assembledSpecialRequest.push(`[Hold: ${req.body.hold_time || durationMinutes + 'm'}]`);
      }
      assembledSpecialRequest.push(`[Notes: ${userNoteText}]`);
    }
    const finalSpecialRequest = assembledSpecialRequest.length > 0 
      ? assembledSpecialRequest.join('\n').slice(0, 1000) 
      : null;

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // [BMAD EXECUTE] Strict Time-Slot Overlap Prevention
      if (effective_preferred_area_id && !kitchenViewBooking) {
        const bufferMinutes = Number(settings.table_hold_min) || 15;

        // Fetch total capacity of the requested area
        const [areaCapacityRows] = await connection.query(
          `SELECT ISNULL(SUM(capacity), 0) AS total_capacity 
           FROM dbo.RestaurantTables 
           WHERE area_id = ? AND table_status != N'Inactive'`,
          [effective_preferred_area_id]
        );
        const areaTotalCapacity = Number(areaCapacityRows[0]?.total_capacity || 0);

        // Calculate overlaps
        const [overlapRows] = await connection.query(
          `SELECT ISNULL(SUM(guest_count), 0) AS total_overlapping_guests
           FROM dbo.Reservations WITH (UPDLOCK, HOLDLOCK)
           WHERE preferred_area_id = ?
             AND reservation_status NOT IN (N'Cancelled', N'No Show', N'Reject Check-in', N'Completed')
             AND ? < DATEADD(minute, ?, reservation_end_at)
             AND ? > reservation_start_at`,
          [effective_preferred_area_id, slotStart, bufferMinutes, slotEnd]
        );
        
        const sumOverlappingGuests = Number(overlapRows[0]?.total_overlapping_guests || 0);

        if (sumOverlappingGuests + guestCount > areaTotalCapacity) {
          await connection.rollback();
          connection.release();
          return res.status(409).json({
            success: false,
            message: "The selected time slot is fully booked. Please choose a different time."
          });
        }
      }

      let checkRows = [];
      let effectiveTableIds = tableIds;

      if (kitchenViewBooking) {
        const counterCapacity = await resolveKitchenViewCounterCapacity(
          connection,
          kitchenArea.area_id,
          settings
        );

        if (guestCount > counterCapacity) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({
            success: false,
            message: `Kitchen View counter has ${counterCapacity} seats. Please reduce your party size or choose another area.`,
          });
        }

        const seatsBooked = await getKitchenViewSeatsBooked(
          connection,
          kitchenArea.area_id,
          slotStart,
          slotEnd
        );

        if (seatsBooked + guestCount > counterCapacity) {
          await connection.rollback();
          connection.release();
          return res.status(409).json({
            success: false,
            code: "SEATS_UNAVAILABLE",
            message: `Only ${Math.max(0, counterCapacity - seatsBooked)} counter seat(s) remain for this time. Please choose another slot or area.`,
          });
        }

        const placeholder = await getKitchenViewPlaceholderTableId(
          connection,
          kitchenArea.area_id
        );

        if (!placeholder) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({
            success: false,
            message: "Kitchen View counter is not configured. Please contact the restaurant.",
          });
        }

        effectiveTableIds = [placeholder.table_id];
        checkRows = [
          {
            table_id: placeholder.table_id,
            table_number: placeholder.table_number,
            capacity: counterCapacity,
            table_status: "Available",
            availability_at_slot: "Available",
            area_name: KITCHEN_VIEW_AREA_NAME,
          },
        ];
      } else {
        const inPlaceholders = effectiveTableIds.map(() => "?").join(", ");

        const [tableRows] = await connection.query(
          `SELECT
             t.table_id,
             t.table_number,
             (
               t.capacity + ISNULL((
                 SELECT SUM(c.capacity)
                 FROM dbo.RestaurantTables c
                 WHERE c.merged_into_table_id = t.table_id
               ), 0)
             ) AS capacity,
             t.table_status,
             CASE
               WHEN t.table_status IN (N'Occupied', N'Cleaning', N'Inactive', N'Reserved')
                 THEN t.table_status
               WHEN EXISTS (
                 SELECT 1
                 FROM dbo.ReservationTables rt WITH (UPDLOCK, HOLDLOCK)
                 JOIN dbo.Reservations r WITH (UPDLOCK, HOLDLOCK)
                   ON rt.reservation_id = r.reservation_id
                 WHERE rt.table_id = t.table_id
                   AND (
                     r.reservation_status IN (N'Confirmed', N'Reserved', N'Dining')
                     OR
                     (r.reservation_status IN (N'Pending Request', N'Pending Payment') AND r.created_at >= DATEADD(minute, -15, SYSDATETIME()))
                   )
                   AND r.reservation_start_at < ?
                   AND r.reservation_end_at > ?
               ) THEN N'Booked'
               ELSE N'Available'
             END AS availability_at_slot,
             a.area_name
           FROM dbo.RestaurantTables t
           LEFT JOIN dbo.RestaurantAreas a ON t.area_id = a.area_id
           WHERE t.table_id IN (${inPlaceholders});`,
          [slotEnd, slotStart, ...effectiveTableIds]
        );

        checkRows = tableRows;

        if (checkRows.length !== effectiveTableIds.length) {
          await connection.rollback();
          connection.release();

          return res.status(400).json({
            success: false,
            message: "One or more selected tables do not exist.",
          });
        }
      }

      let currentTier = "Bronze";

      if (customerId) {
        const [accountRows] = await connection.query(
          `SELECT user_id
           FROM dbo.UserAccounts
           WHERE user_id = ?
             AND is_active = 1`,
          [customerId]
        );

        if (accountRows.length === 0) {
          console.warn(
            `User id ${customerId} from token does not exist in dbo.UserAccounts. Creating reservation as guest.`
          );

          customerId = null;
        }
      }

      // membership_tier removed per Fine-Dining equality architecture

      const conflict = kitchenViewBooking
        ? null
        : checkRows.find((r) => r.availability_at_slot !== "Available");

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
        const areaName = kitchenViewBooking ? KITCHEN_VIEW_AREA_NAME : row.area_name;
        if (!canAccessArea(currentTier, areaName)) {
          await connection.rollback();
          connection.release();

          return res.status(403).json({
            success: false,
            message: "Your membership tier is not eligible for this table.",
          });
        }
      }

      const totalCapacity = kitchenViewBooking
        ? guestCount
        : checkRows.reduce((sum, r) => sum + Number(r.capacity), 0);

      if (!kitchenViewBooking && totalCapacity < guestCount) {
        await connection.rollback();
        connection.release();

        return res.status(400).json({
          success: false,
          message:
            "Selected tables cannot seat your whole party. Please add another table.",
        });
      }

      const initialStatus = "Pending Payment";

      // AUTO-CONFIRM: INSERT directly as 'Pending Request'
      const [scopeRows] = await connection.query(
        `INSERT INTO dbo.Reservations
           (customer_id, contact_name, contact_phone, contact_email, preferred_area_id,
            reservation_start_at, reservation_end_at,
            guest_count, special_request, reservation_status, reservation_source,
            confirmed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, N'Online', SYSDATETIME());
         SELECT CAST(SCOPE_IDENTITY() AS INT) AS reservation_id;`,
        [
          customerId,
          guestNameRaw  || null,
          guestPhoneRaw || null,
          guestEmailRaw || null,
          kitchenViewBooking
            ? kitchenArea.area_id
            : effective_preferred_area_id
              ? Number(effective_preferred_area_id)
              : null,
          slotStart,
          slotEnd,
          guestCount,
          finalSpecialRequest,
          initialStatus
        ]
      );

      const reservationId = scopeRows[0]?.reservation_id;
      if (!reservationId) throw new Error("Failed to retrieve reservation_id after INSERT. Check DB triggers or constraints.");

      const created = { reservation_status: initialStatus, created_at: new Date() };


      for (const tableId of effectiveTableIds) {
        await connection.query(
          `INSERT INTO dbo.ReservationTables (reservation_id, table_id)
           VALUES (?, ?);`,
          [reservationId, tableId]
        );
      }

      
      let paymentUrl = null;
      let totalAmount = 0;
      let validPreorderItems = [];

      if (Array.isArray(preorderItemsRaw) && preorderItemsRaw.length > 0) {
        // Collect valid items and calculate total amount
        for (const item of preorderItemsRaw) {
          const dishId = Number(item.dish_id || item.dishId || item.id);
          const qty = Number(item.quantity || item.qty || 1);

          if (!Number.isFinite(dishId) || dishId <= 0 || !Number.isFinite(qty) || qty <= 0) continue;

          const [dishRows] = await connection.query(
            `SELECT price FROM dbo.Dishes WHERE dish_id = ? AND is_available = 1`,
            [dishId]
          );

          if (dishRows.length > 0) {
            const unitPrice = Number(dishRows[0].price);
            validPreorderItems.push({ dishId, qty, unitPrice, notes: item.notes || null });
            totalAmount += unitPrice * qty;
            console.log(`[DEBUG TRACE 1] Added preorder item ${dishId}, qty: ${qty}, unitPrice: ${unitPrice}. Current totalAmount: ${totalAmount}`);
          }
        }

        console.log(`[DEBUG TRACE 2] Finished Preorder Items loop. Final totalAmount from preorder: ${totalAmount}`);

        if (validPreorderItems.length > 0) {
          // 1. Insert PreorderItems
          for (const item of validPreorderItems) {
            await connection.query(
              `INSERT INTO dbo.PreorderItems (reservation_id, dish_id, quantity, unit_price, notes) VALUES (?, ?, ?, ?, ?)`,
              [reservationId, item.dishId, item.qty, item.unitPrice, item.notes]
            );
          }

          // 2. Create Order
          const [orderRows] = await connection.query(
            `INSERT INTO dbo.Orders (reservation_id, table_id, customer_id, order_type, order_status, subtotal, total_amount)
             VALUES (?, ?, ?, N'Preorder', N'Open', ?, ?);
             SELECT CAST(SCOPE_IDENTITY() AS INT) AS order_id;`,
            [reservationId, effectiveTableIds[0], customerId || null, totalAmount, totalAmount]
          );
          const newOrderId = orderRows[0].order_id;

          // 3. Create OrderItems
          for (const item of validPreorderItems) {
            await connection.query(
              `INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, notes) VALUES (?, ?, ?, ?, ?)`,
              [newOrderId, item.dishId, item.qty, item.unitPrice, item.notes]
            );
          }

          // 4. Create Payment (VNPAY Method ID is typically assumed to be created or resolved)
          // We look up the VNPAY payment method ID, fallback to 1 if not found.
          const [methodRows] = await connection.query(`SELECT payment_method_id FROM dbo.PaymentMethods WHERE method_name = 'VNPAY'`);
          const paymentMethodId = methodRows.length > 0 ? methodRows[0].payment_method_id : 1; // Assuming 'VNPAY' is inserted later if missing

          await connection.query(
            `INSERT INTO dbo.Payments (order_id, payment_method_id, amount_paid, payment_status)
             VALUES (?, ?, ?, N'Pending');`,
            [newOrderId, paymentMethodId, totalAmount]
          );

          // Note: Payment URL is no longer generated here. 
          // The frontend will call /api/payments/create_vnpay_url in step 3 (process-payment).
        }
      }

      const guestName = String(guestNameRaw || "").trim() || "Guest";
      const startLabel = `${String(slotStart.getHours()).padStart(2, "0")}:${String(
        slotStart.getMinutes()
      ).padStart(2, "0")}`;




      // Audit log
      await connection.query(
        `INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, old_value_json, new_value_json, ip_address, created_at)
         VALUES (?, N'RESERVATION_CREATED', N'Reservations', ?, ?, ?, ?, SYSDATETIME())`,
        [
          customerId || null,
          reservationId,
          null,
          JSON.stringify({ reservation_status: initialStatus, guest_count: guestCount }),
          req.ip
        ]
      );

      // Notification for manager (user_id = 2 per PRD)
      await connection.query(
        `INSERT INTO dbo.Notifications (user_id, notification_type, title, message_body, is_read, sent_at)
         VALUES (?, N'System', N'New Reservation Request', ?, 0, SYSDATETIME())`,
        [
          2, // Manager
          `New reservation from ${guestName} for ${guestCount} guests on ${formatLocalIso(slotStart)} at ${startLabel}`
        ]
      );

      await connection.commit();
      connection.release();

      const tableSummaries = kitchenViewBooking
        ? [
          {
            table_id: checkRows[0]?.table_id,
            table_number: "COUNTER",
            display_label: `${KITCHEN_VIEW_AREA_NAME} · ${guestCount} seat(s)`,
            capacity: guestCount,
          },
        ]
        : checkRows.map((r) => {
          const meta = TABLE_DISPLAY[r.table_number] || {
            displayLabel: r.table_number,
          };

          return {
            table_id: r.table_id,
            table_number: r.table_number,
            display_label: meta.displayLabel,
            capacity: r.capacity,
          };
        });

      const tableLabel =
        tableSummaries
          .map((t) => t.display_label || t.table_number)
          .filter(Boolean)
          .join(", ") || "—";

      const io = getIO();
      if (io) {
        const newPayload = {
          reservation_id: reservationId,
          customer_name: guestName,
          customer_phone: guestPhoneRaw || null,
          email: guestEmailRaw || null,
          reservation_start_at: formatLocalIso(slotStart),
          reservation_date: slotStart.toISOString().slice(0, 10),
          start_time: startLabel,
          guest_count: guestCount,
          party_size: guestCount,
          area_name: kitchenViewBooking ? KITCHEN_VIEW_AREA_NAME : (checkRows[0]?.area_name || "General"),
          special_request: finalSpecialRequest,
          status: "confirmed",
          reservation_status: initialStatus,
          table_label: tableLabel,
        };
        io.to("room:manager").emit("reservation:new", newPayload);
        io.to("room:staff").emit("reservation:new", newPayload);
      }

      // Fire-and-forget confirmation email — never crash the response
      if (guestEmailRaw) {
        const resDate = slotStart.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
        const resTime = `${String(slotStart.getHours()).padStart(2, "0")}:${String(slotStart.getMinutes()).padStart(2, "0")}`;
        const parsedAreaName = kitchenViewBooking
          ? KITCHEN_VIEW_AREA_NAME
          : (checkRows[0]?.area_name || null);
        // Compute duration from actual slot diff (reliable) — fall back to frontend label
        const durationMs = slotEnd.getTime() - slotStart.getTime();
        const durationMins = Math.round(durationMs / 60000);
        const durationLabel = duration
          ? String(duration)
          : durationMins > 0
            ? `${durationMins} minutes`
            : null;
        const effectivePurpose = dining_purpose || occasion || null;
        sendBookingConfirmationEmail({
          toEmail:         guestEmailRaw,
          customerName:    guestName,
          customerPhone:   guestPhoneRaw || null,
          reservationDate: resDate,
          reservationTime: resTime,
          reservationId,
          diningPurpose:   effectivePurpose,
          duration:        durationLabel,
          areaName:        parsedAreaName,
          tables:          tableSummaries,
        }).catch((e) => console.error("[Email fire-and-forget] confirmationEmail failed:", e?.message));
      }

      // Fetch saved preorder items with dish names for response
      let savedPreorderItems = [];
      if (preorderItemsRaw && preorderItemsRaw.length > 0) {
        try {
          const [pRows] = await pool.query(
            `SELECT pi.preorder_item_id, pi.dish_id, pi.quantity, pi.unit_price, pi.notes,
                    d.dish_name
             FROM dbo.PreorderItems pi
             LEFT JOIN dbo.Dishes d ON pi.dish_id = d.dish_id
             WHERE pi.reservation_id = ?
             ORDER BY pi.created_at ASC`,
            [reservationId]
          );
          savedPreorderItems = pRows;
        } catch (e) {
          console.error('[preorderItems fetch]', e?.message);
        }
      }

      // 1. Calculate the raw total of all pre-ordered items
      const preorderItemsTotal = totalAmount || 0;

      // 2. Define the Base Table Deposit
      const BASE_TABLE_DEPOSIT = 20000;

      // 3. Define the exact money the customer MUST pay upfront via QR right now
      // 30% deposit of food + table, remaining 70% paid at checkout.
      // NOTE: We don't have discount_amount computed here yet in this legacy route.
      const net_total = BASE_TABLE_DEPOSIT + preorderItemsTotal;
      const deposit_amount = Math.round(net_total * 0.3);
      const final_total = net_total - deposit_amount;

      console.log(`[AUTOMATION CHECK] Preorder: ${preorderItemsTotal} | Table Deposit: ${BASE_TABLE_DEPOSIT} | Net Total: ${net_total} | QR Target (30%): ${deposit_amount} | Remaining (70%): ${final_total}`);
      
      const order_code = `RES${reservationId}`;

      // Update the DB with the newly generated order_code and precise financial values
      await connection.query(
        `UPDATE dbo.Reservations 
         SET deposit_amount = ?, final_total = ?, order_code = ?
         WHERE reservation_id = ?`,
        [deposit_amount, final_total, order_code, reservationId]
      );

      const bank = 'TPBank';
      const acc = '00003942326';
      // Assuming 'bank' and 'acc' are TPBank and 00003942326, we apply the requested template format.
      const qr_url = `https://qr.sepay.vn/img?bank=${bank}&acc=${acc}&amount=${deposit_amount}&des=${order_code}&template=&showinfo=true&holder=DANG%20QUANG%20PHU&store=PHURAI%20RESTAURANT`;

      const responsePayload = {
        success: true,
        deposit_amount,
        final_total, // For frontend compatibility with pre-save logic
        order_code,
        qr_url,
        reservation: {
          reservation_id: reservationId,
          reservation_status: initialStatus,
          reservation_start_at: formatLocalIso(slotStart),
          reservation_end_at: formatLocalIso(slotEnd),
          guest_count: guestCount,
          special_request: finalSpecialRequest,
          tables: tableSummaries,
          is_guest: !customerId,
          preorderItems: savedPreorderItems,
        },
      };

      if (typeof paymentUrl !== 'undefined' && paymentUrl) {
        responsePayload.paymentUrl = paymentUrl;
      }

      // --- BACKEND SWEEPER LOGIC ---
      // 15-minute auto-cancel for pending payments
      setTimeout(async () => {
        try {
          const [checkRes] = await pool.query('SELECT reservation_status FROM dbo.Reservations WHERE reservation_id = ?', [reservationId]);
            
          if (checkRes.length > 0 && checkRes[0].reservation_status === RESERVATION_STATUS.PENDING_PAYMENT) {
            // Auto cancel
            await updateReservationStatus({
              connection: pool,
              reservationId: reservationId,
              toStatus: RESERVATION_STATUS.CANCELLED,
              staffId: null,
              auditAction: "PAYMENT_TIMEOUT_AUTO_CANCEL",
              extraUpdates: ", cancel_reason = N'Payment Timeout (Auto Swept)', cancelled_at = SYSDATETIME()"
            });
            console.log(`[Sweeper] Reservation ${reservationId} was swept and cancelled due to payment timeout.`);
            
            // Note: We might also want to broadcast this cancellation
            const io = getIO();
            if (io) {
              io.emit("reservation:status_changed", { reservation_id: reservationId, status: "Cancelled" });
            }
          }
        } catch (e) {
          console.error(`[Sweeper Error] Failed to sweep reservation ${reservationId}:`, e);
        }
      }, 15 * 60 * 1000); // 15 minutes
      // -----------------------------

      return res.status(201).json(responsePayload);

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
    console.error("CRITICAL Create reservation error:", error);

    // Check if it's a SQL error (tedious/mssql) to extract specific details
    const sqlErrorDetail = error.originalError ? error.originalError.message : error.message;

    return res.status(500).json({
      success: false,
      message: "Internal server error while creating reservation.",
      error: sqlErrorDetail // EXPOSE RAW ERROR TO FRONTEND
    });
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
         r.reservation_id,
         COALESCE(ua.full_name, r.contact_name, N'') AS customer_name,
         COALESCE(ua.phone, r.contact_phone, N'') AS customer_phone,
         COALESCE(ua.email, r.contact_email, N'') AS customer_email,
         r.reservation_start_at,
         r.reservation_end_at,
         r.guest_count,
         r.special_request,
         r.reservation_status AS status,
         r.created_at AS created_time,
         r.cancelled_at,
         r.cancel_reason,
         a.area_name AS preferred_area,
         a.area_type
       FROM dbo.Reservations r
       LEFT JOIN dbo.UserAccounts ua ON r.customer_id = ua.user_id
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
        const meta = TABLE_DISPLAY[row.table_number] || {
          displayLabel: row.table_number,
        };

        acc[row.reservation_id] = acc[row.reservation_id] || [];

        acc[row.reservation_id].push({
          table_number: row.table_number,
          display_label: meta.displayLabel,
          capacity: row.capacity,
        });

        return acc;
      }, {});

      const [preorderRows] = await pool.query(
        `SELECT p.reservation_id,
                p.dish_id,
                p.quantity,
                p.unit_price,
                d.dish_name
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

    const reservations = rows.map((r) => {
      const assignedTables = tablesByReservation[r.reservation_id] || [];
      const assigned_tables = assignedTables.map(t => t.table_number).join(", ");
      return {
        reservation_id: r.reservation_id,
        customer_name: r.customer_name,
        customer_phone: r.customer_phone,
        customer_email: r.customer_email,
        reservation_start_at: r.reservation_start_at,
        reservation_end_at: r.reservation_end_at,
        guest_count: r.guest_count,
        special_request: r.special_request,
        reservation_status: r.status,
        status: r.status,
        created_time: r.created_time,
        created_at: r.created_time,
        cancelled_at: r.cancelled_at,
        cancel_reason: r.cancel_reason,
        preferred_area: r.preferred_area,
        area_name: r.preferred_area,
        area_type: r.area_type,
        assigned_tables: assigned_tables,
        tables: assignedTables,
        preorders: preorderByReservation[r.reservation_id] || [],
      };
    });

    return res.json({ success: true, reservations });
  } catch (error) {
    console.error("Load my reservations failed:", error);

    return res.status(500).json({
      success: false,
      message: "Could not load your reservations.",
    });
  }
});

/* ------------------------------------------------------------------ */
/* PATCH /api/reservations/:id/cancel                                  */
/* ------------------------------------------------------------------ */

router.patch("/:id/cancel", resolveUserId, requireUserId, async (req, res) => {
  try {
    const reservationId = Number(req.params.id);

    if (!Number.isFinite(reservationId) || reservationId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid reservation id.",
      });
    }

    const [rows] = await pool.query(
      `SELECT reservation_id,
              customer_id,
              reservation_status,
              reservation_start_at
       FROM dbo.Reservations
       WHERE reservation_id = ?;`,
      [reservationId]
    );

    const reservation = rows[0];

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found.",
      });
    }

    if (Number(reservation.customer_id) !== Number(req.userId)) {
      return res.status(403).json({
        success: false,
        message: "You cannot modify this reservation.",
      });
    }

    const blocked = [RESERVATION_STATUS.SEATED, RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.NO_SHOW, RESERVATION_STATUS.CANCELLED];

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

    const reason = String(
      req.body?.cancel_reason || "Cancelled by customer"
    ).slice(0, 255);

    await updateReservationStatus({
      connection: pool,
      reservationId,
      toStatus: RESERVATION_STATUS.CANCELLED,
      staffId: null,
      auditAction: "CUSTOMER_CANCELLED_RESERVATION",
      extraUpdates: `, cancel_reason = N'${reason.replace(/'/g, "''")}', cancelled_at = SYSDATETIME()`
    });

    return res.json({
      success: true,
      message: "Reservation cancelled.",
    });
  } catch (error) {
    console.error("Cancel reservation failed:", error);

    return res.status(500).json({
      success: false,
      message: "Could not cancel reservation.",
    });
  }
});

/* ------------------------------------------------------------------ */
/* POST /api/reservations/:id/preorder                                 */
/* ------------------------------------------------------------------ */

router.post("/:id/preorder", resolveUserId, requireUserId, async (req, res) => {
  const reservationId = Number(req.params.id);

  if (!Number.isFinite(reservationId) || reservationId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid reservation id.",
    });
  }

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
    const [resRows] = await pool.query(
      `SELECT reservation_id,
              customer_id,
              reservation_status
       FROM dbo.Reservations
       WHERE reservation_id = ?;`,
      [reservationId]
    );

    const reservation = resRows[0];

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found.",
      });
    }

    if (Number(reservation.customer_id) !== Number(req.userId)) {
      return res.status(403).json({
        success: false,
        message: "You cannot modify this reservation.",
      });
    }

    const allowed = [RESERVATION_STATUS.PENDING_REQUEST, RESERVATION_STATUS.CONFIRMED, RESERVATION_STATUS.PENDING_PAYMENT, RESERVATION_STATUS.RESERVED];

    if (!allowed.includes(reservation.reservation_status)) {
      return res.status(400).json({
        success: false,
        message: `Pre-orders can only be edited while a reservation is pending or confirmed (current: ${reservation.reservation_status}).`,
      });
    }

    const dishIds = [...wantedQty.keys()];

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      await connection.query(
        `DELETE FROM dbo.PreorderItems
         WHERE reservation_id = ?;`,
        [reservationId]
      );

      let insertedItems = [];

      if (dishIds.length > 0) {
        const placeholders = dishIds.map(() => "?").join(", ");

        const [dishRows] = await connection.query(
          `SELECT dish_id, dish_name, price
           FROM dbo.Dishes
           WHERE dish_id IN (${placeholders})
             AND is_available = 1;`,
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
            `INSERT INTO dbo.PreorderItems
               (reservation_id, dish_id, quantity, unit_price, notes)
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

      const total = insertedItems.reduce(
        (sum, i) => sum + i.unit_price * i.quantity,
        0
      );

      return res.json({
        success: true,
        message: insertedItems.length ? "Pre-order saved." : "Pre-order cleared.",
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

    return res.status(500).json({
      success: false,
      message: "Could not save pre-order. Please try again.",
    });
  }
});

/* ------------------------------------------------------------------ */
/* POST /api/reservations/:id/request-edit  (Flow B)                  */
/* ------------------------------------------------------------------ */

router.post("/:id/request-edit", resolveUserId, validateReservationUpdate, async (req, res) => {
  const reservationId = Number(req.params.id);
  if (!Number.isFinite(reservationId) || reservationId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid reservation ID." });
  }

  const customerId = req.userId ? Number(req.userId) : null;
  const { changes } = req.body || {};

  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    return res.status(400).json({
      success: false,
      code: "MISSING_CHANGES",
      message: "Request body must include a 'changes' object with the fields to update.",
    });
  }

  try {
    const result = await submitEditRequest(reservationId, customerId, changes, req.ip);
    if (!result.success) {
      const statusMap = {
        NOT_FOUND: 404,
        FORBIDDEN: 403,
        EDIT_LIMIT_REACHED: 409,
        REQUEST_ALREADY_PENDING: 409,
        INVALID_STATUS: 409,
        NO_VALID_CHANGES: 400,
        INVALID_FIELDS: 400,
      };
      return res.status(statusMap[result.code] || 400).json(result);
    }
    return res.json({ success: true, message: "Edit request submitted successfully." });
  } catch (err) {
    console.error("[POST /:id/request-edit] Error:", err);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

/* ------------------------------------------------------------------ */
/* POST /api/reservations/:id/request-cancel  (Cancel Request)        */
/* ------------------------------------------------------------------ */

router.post("/:id/request-cancel", resolveUserId, async (req, res) => {
  const reservationId = Number(req.params.id);
  if (!Number.isFinite(reservationId) || reservationId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid reservation ID." });
  }

  const customerId = req.userId ? Number(req.userId) : null;
  const { cancel_reason } = req.body || {};

  try {
    const result = await submitCancelRequest(
      reservationId,
      customerId,
      cancel_reason || null,
      req.ip
    );
    if (!result.success) {
      const statusMap = {
        NOT_FOUND: 404,
        FORBIDDEN: 403,
        REQUEST_ALREADY_PENDING: 409,
        INVALID_STATUS: 409,
      };
      return res.status(statusMap[result.code] || 400).json(result);
    }
    return res.json({ success: true, message: "Cancellation request submitted. Awaiting manager review." });
  } catch (err) {
    console.error("[POST /:id/request-cancel] Error:", err);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/reservations/:id/timeline                                   */
/* Returns ordered AuditLog events for a reservation, with actor name. */
/* Used by both Staff and Manager detail panels.                        */
/* ------------------------------------------------------------------ */
router.get("/:id/timeline", resolveUserId, async (req, res) => {
  const reservationId = Number(req.params.id);
  if (!Number.isFinite(reservationId) || reservationId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid reservation id." });
  }

  const ACTION_LABEL_MAP = {
    RESERVATION_CREATED:              "Reservation Created",
    MANAGER_CONFIRMED:                "Booking Confirmed by",
    STAFF_CHECKIN_CONFIRMED:          "Checked in by",
    CHECK_IN_RESERVATION:             "Checked in by",
    PAYMENT_CHECKOUT_AUTO:            "Payment completed",
    STAFF_CHECKOUT_CONFIRMED:         "Checked out by",
    REJECT_RESERVATION:               "Check-in Rejected by",
    REJECT_CHECKIN:                   "Check-in Rejected by",
    MANAGER_APPROVED_EDIT:            "Edit Approved by",
    MANAGER_EDIT_RESERVATION:         "Reservation Edited by",
    MANAGER_RESOLVE_REQUEST:          "Edit Request Confirmed by",
    MANAGER_DECLINE_REQUEST:          "Edit Request Rejected by",
    MANAGER_CANCELLED_RESERVATION:    "Cancelled by",
    CUSTOMER_EDIT_REQUEST:            "Edit Request Sent by",
    CUSTOMER_CANCEL_REQUEST:          "Cancellation Requested by",
    CANCEL_RESERVATION:               "Cancelled by",
    STAFF_SEND_COOKING_QUEUE:         "Sent to Kitchen by",
    "Staff Send Cooking Queue":       "Sent to Kitchen by",
  };

  try {
    const [rows] = await pool.query(
      `SELECT
          al.audit_log_id,
          al.action_name,
          al.old_value_json,
          al.new_value_json,
          al.created_at,
          al.user_id AS actor_user_id,
          COALESCE(ua.full_name, N'System') AS actor_name,
          r.customer_id
       FROM dbo.AuditLogs al
       LEFT JOIN dbo.UserAccounts ua ON al.user_id = ua.user_id
       LEFT JOIN dbo.Reservations r  ON r.reservation_id = al.target_id
       WHERE al.target_table = N'Reservations'
         AND al.target_id    = ?
       ORDER BY al.created_at ASC`,
      [reservationId]
    );

    const timeline = rows.map((row) => {
      const label = ACTION_LABEL_MAP[row.action_name] ?? row.action_name;
      const ts = row.created_at
        ? new Date(row.created_at).toLocaleString("vi-VN", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit", hour12: false,
          }).replace(",", "")
        : "—";

      const noActorActions = ["PAYMENT_CHECKOUT_AUTO"];
      const showActor = !noActorActions.includes(row.action_name);

      let actorLabel = row.actor_name;
      if (row.action_name === "RESERVATION_CREATED") {
        const isGuest = !row.customer_id;
        const prefix = isGuest ? "Guest" : "Customer";
        actorLabel = `${prefix}: ${row.actor_name !== "System" ? row.actor_name : "—"}`;
      }

      const displayText = showActor
        ? `${label}: ${actorLabel} — ${ts}`
        : `${label} — ${ts}`;

      let parsedMeta = {};
      let parsedOld = {};
      try { parsedMeta = JSON.parse(row.new_value_json || "{}"); } catch (_) {}
      try { parsedOld = JSON.parse(row.old_value_json || "{}"); } catch (_) {}

      // Build extra info for cancel events
      let cancelReason = null;
      if (["MANAGER_CANCELLED_RESERVATION", "CANCEL_RESERVATION", "CUSTOMER_CANCEL_REQUEST", "REJECT_RESERVATION", "REJECT_CHECKIN", "MANAGER_DECLINE_REQUEST", "REJECT_CHECKOUT"].includes(row.action_name)) {
        cancelReason = parsedMeta.cancel_reason || parsedMeta.reason || null;
      }

      // Build diff for edit request events
      let pendingChanges = null;
      if (["CUSTOMER_EDIT_REQUEST", "MANAGER_RESOLVE_REQUEST", "MANAGER_DECLINE_REQUEST"].includes(row.action_name)) {
        pendingChanges = parsedMeta.changes || parsedMeta || null;
      }

      return {
        log_id: row.audit_log_id,
        action_name: row.action_name,
        label,
        display_text: displayText,
        actor_name: actorLabel,
        is_guest: row.action_name === "RESERVATION_CREATED" && !row.customer_id,
        timestamp: row.created_at,
        timestamp_formatted: ts,
        meta: parsedMeta,
        old_value: parsedOld,
        cancel_reason: cancelReason,
        pending_changes: pendingChanges,
        new_value_json: row.new_value_json,
      };
    });

    return res.json({ success: true, timeline });
  } catch (err) {
    console.error("[GET /:id/timeline] Error:", err);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

export default router;