import pool from "../db.js";
import { getDefaultErtDurationMin } from "../constants/ertConfig.js";
import { getAssignmentMode, TABLE_ASSIGNMENT_STATUS } from "../utils/tableAssignmentPolicy.js";

const ALLOWED_STATUSES = new Set([
  'Pending Request', 'Pending Payment', 'Reserved', 'Confirmed',
  'Cancelled', 'Completed', 'No Show', 'Dining', 'Cleaning',
  'Check-out', 'Reject Check-in', 'Reject Request', 'Reject Check-out',
  'Paid', 'PaymentFailed', 'Pending', 'Await Check-in', 'Check-in',
  'Complete Paid', 'Overdue', 'Awaiting Deposit'
]);

const ACTIVE_RESERVATION_STATUS_SQL = `
  N'Pending Request',
  N'Awaiting Deposit',
  N'Await Check-in',
  N'Reserved',
  N'Confirmed',
  N'Paid',
  N'Check-in',
  N'Dining',
  N'Overdue'
`;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function loadMaxBookingDuration() {
  try {
    const [rows] = await pool.query(
      `SELECT setting_value FROM dbo.RestaurantSettings WHERE setting_key = 'max_booking_duration'`
    );
    if (rows.length > 0) {
      const val = Number(rows[0].setting_value);
      if (Number.isFinite(val) && val > 0) return val;
    }
  } catch (err) {
    console.error("[validateReservation] Failed to load max_booking_duration setting:", err.message);
  }
  return 4; // Fallback to 4 hours
}

async function loadTableHoldMin() {
  try {
    const [rows] = await pool.query(
      `SELECT setting_value FROM dbo.RestaurantSettings WHERE setting_key = 'table_hold_min'`
    );
    if (rows.length > 0) {
      const val = Number(rows[0].setting_value);
      if (Number.isFinite(val) && val > 0) return val;
    }
  } catch (err) {
    console.error("[validateReservation] Failed to load table_hold_min setting:", err.message);
  }
  return 15; // Fallback
}

function buildLocalDate(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const [y, m, d] = String(dateStr).split("-").map(Number);
  const [hh, mm] = String(timeStr).split(":").map(Number);
  if ([y, m, d, hh, mm].some((n) => !Number.isFinite(n))) return null;
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

/**
 * Stage 1-4 validation middleware for reservation creation (POST).
 */
export const validateReservationCreate = async (req, res, next) => {
  try {
    const body = req.body || {};
    
    // Normalize and trim contact fields
    const contact_name = (body.contact_name || body.guest_name || "").trim();
    const contact_phone = (body.contact_phone || body.guest_phone || "").trim();
    const contact_email = (body.contact_email || body.guest_email || "").trim().toLowerCase();
    
    // Update req.body with sanitized fields so controllers get clean input
    if (body.contact_name !== undefined) body.contact_name = contact_name;
    if (body.guest_name !== undefined) body.guest_name = contact_name;
    if (body.contact_phone !== undefined) body.contact_phone = contact_phone;
    if (body.guest_phone !== undefined) body.guest_phone = contact_phone;
    if (body.contact_email !== undefined) body.contact_email = contact_email;
    if (body.guest_email !== undefined) body.guest_email = contact_email;
    
    const customerId = req.userId ? Number(req.userId) : null;
    
    // Stage 1: Schema Validation (Fields Required)
    if (!customerId) {
      if (!contact_name || !contact_phone || !contact_email) {
        return res.status(400).json({
          success: false,
          error: "VALIDATION_FAILED",
          message: "Guest reservations require full name, email, and phone."
        });
      }
    }
    
    if (contact_email && !EMAIL_REGEX.test(contact_email)) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_FAILED",
        message: "Invalid email format."
      });
    }
    
    const guestCount = Number(body.guest_count);
    if (!Number.isFinite(guestCount) || guestCount <= 0) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_FAILED",
        message: "Guest count must be an integer greater than 0."
      });
    }
    body.guest_count = guestCount; // Enforce numeric type
    
    if (body.reservation_status && !ALLOWED_STATUSES.has(body.reservation_status)) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_FAILED",
        message: `Invalid reservation status: '${body.reservation_status}'`
      });
    }
    
    // Stage 2: Date & Time Logic
    let slotStart = body.reservation_start_at
      ? new Date(body.reservation_start_at)
      : buildLocalDate(body.date, body.time);
      
    let preferredAreaName = "";
    const preferredAreaIdForDuration = Number(body.preferred_area_id);
    if (preferredAreaIdForDuration) {
      const [durationAreaRows] = await pool.query(
        `SELECT area_name FROM dbo.RestaurantAreas WHERE area_id = ?`,
        [preferredAreaIdForDuration]
      );
      preferredAreaName = durationAreaRows[0]?.area_name || "";
    } else if (Array.isArray(body.table_ids) && body.table_ids.length > 0) {
      const firstTableId = Number(body.table_ids[0]);
      if (Number.isFinite(firstTableId) && firstTableId > 0) {
        const [durationTableRows] = await pool.query(
          `SELECT TOP 1 a.area_name
           FROM dbo.RestaurantTables t
           INNER JOIN dbo.RestaurantAreas a ON a.area_id = t.area_id
           WHERE t.table_id = ?`,
          [firstTableId]
        );
        preferredAreaName = durationTableRows[0]?.area_name || "";
      }
    }

    const diningDuration = getDefaultErtDurationMin(body.guest_count, preferredAreaName);
    const slotEnd = slotStart
      ? new Date(slotStart.getTime() + diningDuration * 60000)
      : null;
        
    if (!slotStart || Number.isNaN(slotStart.getTime()) || !slotEnd || Number.isNaN(slotEnd.getTime())) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_FAILED",
        message: "Invalid reservation date/time."
      });
    }
    
    if (slotEnd <= slotStart) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_FAILED",
        message: "End time must be after start time."
      });
    }
    
    if (slotStart.getTime() <= Date.now()) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_FAILED",
        message: "Reservation time must be in the future."
      });
    }
    
    // Operating hours check
    const day = slotStart.getDay(); // 0 = Sunday, 1-4 = Monday-Thursday, 5-6 = Friday-Saturday
    const startHour = slotStart.getHours();
    const startMin = slotStart.getMinutes();
    const timeVal = startHour * 60 + startMin;

    let isValidOperatingHours = false;
    let allowedHoursMsg = "";

    if (day >= 1 && day <= 4) {
      if (timeVal >= 420 && timeVal < 1440) {
        isValidOperatingHours = true;
      }
      allowedHoursMsg = "Monday - Thursday operating hours are 07:00 AM - 24:00 PM.";
    } else if (day === 5 || day === 6) {
      if (timeVal >= 420 && timeVal < 1440) {
        isValidOperatingHours = true;
      }
      allowedHoursMsg = "Friday - Saturday operating hours are 07:00 AM - 24:00 PM.";
    } else if (day === 0) {
      if (timeVal >= 1140 && timeVal < 1200) {
        isValidOperatingHours = true;
      }
      allowedHoursMsg = "Sunday operating hours are 19:00 PM - 20:00 PM (7 PM - 8 PM).";
    }

    if (!isValidOperatingHours) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_FAILED",
        message: `Outside operating hours. ${allowedHoursMsg}`
      });
    }

    body.reservation_start_at = slotStart.toISOString();
    body.reservation_end_at = slotEnd.toISOString();
    body.durationMinutes = diningDuration;

    // reservation_end_at is ERT for slot planning and alerts only.
    // Table release still requires payment success or staff confirmation.
    const durationMinutes = Math.round((slotEnd - slotStart) / 60000);
    const tableAssignmentMode = getAssignmentMode(slotStart);
    body.table_assignment_status = tableAssignmentMode;

    if (durationMinutes < 60) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_FAILED",
        message: `Dining duration must be at least 1 hour (60 minutes).`
      });
    }
    
    // Stage 3: Table Assignment & Capacity Checks
    const rawTableIds = body.table_ids || [];
    const tableIds = Array.isArray(rawTableIds)
      ? [...new Set(rawTableIds.map(Number).filter((n) => Number.isFinite(n) && n > 0))]
      : [];
      
    // Note: If no table_ids are provided, check if it's Kitchen View counter area.
    // If not kitchen view, we require at least one table.
    let preferredAreaId = Number(body.preferred_area_id);
    let isKitchenView = false;
    
    if (preferredAreaId) {
      const [areaRows] = await pool.query(
        `SELECT area_name FROM dbo.RestaurantAreas WHERE area_id = ?`,
        [preferredAreaId]
      );
      if (areaRows.length > 0 && areaRows[0].area_name === "Kitchen View") {
        isKitchenView = true;
      }
    }
    
    if (!isKitchenView && tableIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_FAILED",
        message: "Please select at least one table."
      });
    }
    
    if (tableIds.length > 0) {
      // 1. Verify tables exist
      const [tableRows] = await pool.query(
        `SELECT t.table_id,
                t.area_id,
                a.area_name,
                (t.capacity + ISNULL((
                  SELECT SUM(c.capacity)
                  FROM dbo.RestaurantTables c
                  WHERE c.merged_into_table_id = t.table_id
                ), 0)) AS capacity
         FROM dbo.RestaurantTables t
         LEFT JOIN dbo.RestaurantAreas a ON a.area_id = t.area_id
         WHERE t.table_id IN (${tableIds.join(',')})`
      );
      
      if (tableRows.length !== tableIds.length) {
        return res.status(400).json({
          success: false,
          error: "VALIDATION_FAILED",
          message: "One or more selected tables do not exist."
        });
      }
      
      // 2. Sum capacity
      const totalCapacity = tableRows.reduce((sum, r) => sum + Number(r.capacity), 0);
      if (totalCapacity < guestCount) {
        return res.status(400).json({
          success: false,
          error: "VALIDATION_FAILED",
          message: `Selected tables capacity (${totalCapacity}) cannot seat your party size (${guestCount}).`
        });
      }

      const distinctAreaIds = [...new Set(tableRows.map((r) => Number(r.area_id)).filter(Boolean))];
      if (distinctAreaIds.length > 1) {
        return res.status(400).json({
          success: false,
          error: "VALIDATION_FAILED",
          message: "Selected tables must belong to the same area."
        });
      }

      if (!body.preferred_area_id && distinctAreaIds[0]) {
        body.preferred_area_id = distinctAreaIds[0];
      }

      if (distinctAreaIds[0]) {
        const areaId = distinctAreaIds[0];
        const [areaCapacityRows] = await pool.query(
          `SELECT ISNULL(SUM(capacity), 0) AS total_capacity
           FROM dbo.RestaurantTables
           WHERE area_id = ?
             AND table_status <> N'Inactive'`,
          [areaId]
        );
        const areaTotalCapacity = Number(areaCapacityRows[0]?.total_capacity || 0);

        const [areaOverlapRows] = await pool.query(
          `SELECT ISNULL(SUM(guest_count), 0) AS total_overlapping_guests
           FROM dbo.Reservations
           WHERE preferred_area_id = ?
             AND reservation_status IN (${ACTIVE_RESERVATION_STATUS_SQL})
             AND reservation_start_at < ?
             AND reservation_end_at > ?`,
          [areaId, slotEnd.toISOString(), slotStart.toISOString()]
        );
        const overlappingGuests = Number(areaOverlapRows[0]?.total_overlapping_guests || 0);

        if (areaTotalCapacity > 0 && overlappingGuests + guestCount > areaTotalCapacity) {
          return res.status(409).json({
            success: false,
            error: "AREA_FULL",
            message: "This area is fully booked for the selected time. Please choose another time or area."
          });
        }
      }

      if (tableAssignmentMode === TABLE_ASSIGNMENT_STATUS.CONFIRMED) {
        // 3a. Reservation-overlap check (existing bookings)
        const [overlaps] = await pool.query(
          `SELECT TOP 1 r.reservation_id, rt.table_id
           FROM dbo.Reservations r
           JOIN dbo.ReservationTables rt ON r.reservation_id = rt.reservation_id
           WHERE rt.table_id IN (${tableIds.join(',')})
             AND r.reservation_status IN (${ACTIVE_RESERVATION_STATUS_SQL})
             AND r.reservation_start_at < ?
             AND r.reservation_end_at > ?`,
          [slotEnd.toISOString(), slotStart.toISOString()]
        );

        if (overlaps.length > 0) {
          return res.status(400).json({
            success: false,
            error: "SLOT_CONFLICT",
            message: "Collision detected: One or more selected tables are already booked during this time."
          });
        }

        // 3b. EstimatedReleaseTime check — block slots blocked by currently Occupied tables.
        const tableIdStr = tableIds.join(',');
        const [occupancyBlocks] = await pool.query(
          `SELECT TOP 1
             tos.session_id,
             tos.table_id,
             tos.estimated_release_at
           FROM dbo.TableOccupancySessions tos WITH (NOLOCK)
           WHERE tos.table_id IN (${tableIdStr})
             AND tos.released_at IS NULL
             AND tos.estimated_release_at > ?`,
          [slotStart.toISOString()]
        );

        if (occupancyBlocks.length > 0) {
          const block = occupancyBlocks[0];
          const releaseTime = new Date(block.estimated_release_at).toLocaleString('vi-VN', {
            hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
          });
          return res.status(409).json({
            success: false,
            error: "TABLE_OCCUPIED",
            message: `Table is currently occupied. Estimated available after ${releaseTime}. Please choose a later time or a different table.`,
            estimatedReleaseAt: block.estimated_release_at
          });
        }
      }
    }
    
    // Stage 4: Pre-order Pricing Integrity
    const preorderItemsRaw = body.preorder_items || body.pre_order_items || body.preorderItems || [];
    let preorderItemsTotal = 0;
    
    if (Array.isArray(preorderItemsRaw) && preorderItemsRaw.length > 0) {
      const validPreorderItems = [];
      for (const item of preorderItemsRaw) {
        const dishId = Number(item.dish_id || item.dishId || item.id);
        const qty = Number(item.quantity || item.qty || 1);
        
        if (!Number.isFinite(dishId) || dishId <= 0 || !Number.isFinite(qty) || qty <= 0) continue;
        
        const [dishRows] = await pool.query(
          `SELECT price FROM dbo.Dishes WHERE dish_id = ? AND is_available = 1`,
          [dishId]
        );
        
        if (dishRows.length > 0) {
          const unitPrice = Number(dishRows[0].price);
          preorderItemsTotal += unitPrice * qty;
          validPreorderItems.push({
            dish_id: dishId,
            quantity: qty,
            unit_price: unitPrice,
            notes: item.notes || null
          });
        }
      }
      
      // Keep sanitized/calculated preorder items array in req.body
      if (body.preorder_items !== undefined) body.preorder_items = validPreorderItems;
      if (body.pre_order_items !== undefined) body.pre_order_items = validPreorderItems;
      if (body.preorderItems !== undefined) body.preorderItems = validPreorderItems;
    }
    
    // Recalculate & override deposit_amount and final_total (30% deposit of Net Total, 70% remaining balance)
    const BASE_TABLE_DEPOSIT = 20000;
    const net_total = BASE_TABLE_DEPOSIT + preorderItemsTotal;
    const secureDepositAmount = Math.round(net_total * 0.3);
    const secureFinalTotal = net_total - secureDepositAmount;
    
    body.deposit_amount = secureDepositAmount;
    body.final_total = secureFinalTotal;
    body.items_total = preorderItemsTotal;
    
    next();
  } catch (err) {
    console.error("[validateReservationCreate] Error:", err);
    return res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "An internal error occurred during reservation validation."
    });
  }
};

/**
 * Stage 1-4 validation middleware for reservation update flows (PATCH / request-edit).
 */
export const validateReservationUpdate = async (req, res, next) => {
  try {
    const reservationId = Number(req.params.id);
    if (!Number.isFinite(reservationId) || reservationId <= 0) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_FAILED",
        message: "Invalid reservation ID."
      });
    }

    const target = req.body.changes || req.body;
    if (!target || typeof target !== "object" || Array.isArray(target)) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_FAILED",
        message: "Request payload must be a valid object."
      });
    }

    // Stage 1: Schema Validation (Optional fields but validated if present)
    if (target.contact_name !== undefined) target.contact_name = String(target.contact_name).trim();
    if (target.guest_name !== undefined) target.guest_name = String(target.guest_name).trim();
    if (target.contact_phone !== undefined) target.contact_phone = String(target.contact_phone).trim();
    if (target.guest_phone !== undefined) target.guest_phone = String(target.guest_phone).trim();

    if (target.contact_email !== undefined || target.guest_email !== undefined) {
      const emailRaw = target.contact_email || target.guest_email;
      const emailTrimmed = String(emailRaw).trim().toLowerCase();
      if (!EMAIL_REGEX.test(emailTrimmed)) {
        return res.status(400).json({
          success: false,
          error: "VALIDATION_FAILED",
          message: "Invalid email format."
        });
      }
      if (target.contact_email !== undefined) target.contact_email = emailTrimmed;
      if (target.guest_email !== undefined) target.guest_email = emailTrimmed;
    }

    let guestCount = undefined;
    if (target.guest_count !== undefined) {
      guestCount = Number(target.guest_count);
      if (!Number.isFinite(guestCount) || guestCount <= 0) {
        return res.status(400).json({
          success: false,
          error: "VALIDATION_FAILED",
          message: "Guest count must be an integer greater than 0."
        });
      }
      target.guest_count = guestCount;
    }

    if (target.reservation_status && !ALLOWED_STATUSES.has(target.reservation_status)) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_FAILED",
        message: `Invalid reservation status: '${target.reservation_status}'`
      });
    }

    // Load existing reservation for context if needed
    let existingRes = null;
    const getExisting = async () => {
      if (existingRes) return existingRes;
      const [rows] = await pool.query(
        `SELECT reservation_start_at, reservation_end_at, guest_count FROM dbo.Reservations WHERE reservation_id = ?`,
        [reservationId]
      );
      if (rows.length === 0) {
        throw new Error("RESERVATION_NOT_FOUND");
      }
      existingRes = rows[0];
      return existingRes;
    };

    // Stage 2: Date & Time Logic (Optional)
    let hasTimeChange = target.reservation_start_at !== undefined || target.reservation_end_at !== undefined || target.date !== undefined || target.time !== undefined;
    let slotStart = null;
    let slotEnd = null;

    if (hasTimeChange) {
      let existing = null;
      try {
        existing = await getExisting();
      } catch (err) {
        if (err.message === "RESERVATION_NOT_FOUND") {
          return res.status(404).json({
            success: false,
            error: "VALIDATION_FAILED",
            message: "Reservation not found."
          });
        }
        throw err;
      }

      slotStart = target.reservation_start_at
        ? new Date(target.reservation_start_at)
        : (target.date && target.time)
          ? buildLocalDate(target.date, target.time)
          : new Date(existing.reservation_start_at);

      if (target.reservation_end_at) {
        slotEnd = new Date(target.reservation_end_at);
      } else if (target.durationMinutes) {
        slotEnd = new Date(slotStart.getTime() + (90 + Number(target.durationMinutes)) * 60000);
      } else {
        // Compute relative difference from old reservation if only start_at changed
        // Cap to 90 minutes so inherited long-duration reservations don't fail validation
        if (target.reservation_start_at) {
          const oldDiff = new Date(existing.reservation_end_at).getTime() - new Date(existing.reservation_start_at).getTime();
          const cappedDiff = Math.min(oldDiff, 90 * 60000);
          slotEnd = new Date(slotStart.getTime() + cappedDiff);
        } else {
          slotEnd = new Date(existing.reservation_end_at);
        }
      }

      if (Number.isNaN(slotStart.getTime()) || Number.isNaN(slotEnd.getTime())) {
        return res.status(400).json({
          success: false,
          error: "VALIDATION_FAILED",
          message: "Invalid reservation date/time."
        });
      }

      if (slotEnd <= slotStart) {
        return res.status(400).json({
          success: false,
          error: "VALIDATION_FAILED",
          message: "End time must be after start time."
        });
      }

      if (slotStart.getTime() <= Date.now()) {
        return res.status(400).json({
          success: false,
          error: "VALIDATION_FAILED",
          message: "Reservation time must be in the future."
        });
      }

      // Operating hours check
      const day = slotStart.getDay();
      const startHour = slotStart.getHours();
      const startMin = slotStart.getMinutes();
      const timeVal = startHour * 60 + startMin;

      let isValidOperatingHours = false;
      let allowedHoursMsg = "";

      if (day >= 1 && day <= 4) {
        if (timeVal >= 420 && timeVal < 1440) {
          isValidOperatingHours = true;
        }
        allowedHoursMsg = "Monday - Thursday operating hours are 07:00 AM - 24:00 PM.";
      } else if (day === 5 || day === 6) {
        if (timeVal >= 420 && timeVal < 1440) {
          isValidOperatingHours = true;
        }
        allowedHoursMsg = "Friday - Saturday operating hours are 07:00 AM - 24:00 PM.";
      } else if (day === 0) {
        if (timeVal >= 1140 && timeVal < 1200) {
          isValidOperatingHours = true;
        }
        allowedHoursMsg = "Sunday operating hours are 19:00 PM - 20:00 PM (7 PM - 8 PM).";
      }

      if (!isValidOperatingHours) {
        return res.status(400).json({
          success: false,
          error: "VALIDATION_FAILED",
          message: `Outside operating hours. ${allowedHoursMsg}`
        });
      }

      // Duration Check: 60-90 minutes dining
      const durationMinutes = Math.round((slotEnd - slotStart) / 60000);
      const selectedDuration = Number(target.durationMinutes) || 30;
      
      console.log("[validateReservationUpdate] DEBUG:", {
        slotStart: slotStart.toISOString(),
        slotEnd: slotEnd.toISOString(),
        durationMinutes,
        selectedDuration,
        target
      });

      if (durationMinutes < 60) {
        return res.status(400).json({
          success: false,
          error: "VALIDATION_FAILED",
          message: `Dining duration must be at least 1 hour (60 minutes).`
        });
      }
      if (durationMinutes > 90) {
        return res.status(400).json({
          success: false,
          error: "VALIDATION_FAILED",
          message: `Dining duration cannot exceed 1.5 hours (90 minutes).`
        });
      }

      // Fee Policy Notification for hold duration of 45 or 60 minutes
      if (selectedDuration === 45 || selectedDuration === 60) {
        let currentNotes = target.special_request || "";
        if (!currentNotes.includes("[Duration over 30 mins: Extra fee applies]")) {
          target.special_request = (currentNotes ? currentNotes + "\n" : "") + "[Duration over 30 mins: Extra fee applies]";
        }
      }
    }

    // Stage 3: Table Assignment & Capacity Checks (Optional)
    const rawTableIds = target.table_ids || (target.table_id ? [target.table_id] : undefined);
    let tableIds = undefined;

    if (rawTableIds !== undefined) {
      tableIds = Array.isArray(rawTableIds)
        ? [...new Set(rawTableIds.map(Number).filter((n) => Number.isFinite(n) && n > 0))]
        : [];
    }

    let hasTableOrGuestChange = tableIds !== undefined || guestCount !== undefined || hasTimeChange;

    if (hasTableOrGuestChange) {
      let existing = null;
      try {
        existing = await getExisting();
      } catch (err) {
        if (err.message === "RESERVATION_NOT_FOUND") {
          return res.status(404).json({
            success: false,
            error: "VALIDATION_FAILED",
            message: "Reservation not found."
          });
        }
        throw err;
      }

      const activeGuestCount = guestCount !== undefined ? guestCount : Number(existing.guest_count);
      const activeSlotStart = slotStart || new Date(existing.reservation_start_at);
      const activeSlotEnd = slotEnd || new Date(existing.reservation_end_at);

      let activeTableIds = [];
      if (tableIds !== undefined) {
        activeTableIds = tableIds;
      } else {
        const [assignedTables] = await pool.query(
          `SELECT table_id FROM dbo.ReservationTables WHERE reservation_id = ?`,
          [reservationId]
        );
        activeTableIds = assignedTables.map(t => t.table_id);
      }

      if (activeTableIds.length > 0) {
        // 1. Verify tables exist
        const [tableRows] = await pool.query(
          `SELECT t.table_id,
                  (t.capacity + ISNULL((
                    SELECT SUM(c.capacity)
                    FROM dbo.RestaurantTables c
                    WHERE c.merged_into_table_id = t.table_id
                  ), 0)) AS capacity
           FROM dbo.RestaurantTables t
           WHERE t.table_id IN (${activeTableIds.join(',')})`
        );

        if (tableRows.length !== activeTableIds.length) {
          return res.status(400).json({
            success: false,
            error: "VALIDATION_FAILED",
            message: "One or more selected tables do not exist."
          });
        }

        // 2. Sum capacity
        const totalCapacity = tableRows.reduce((sum, r) => sum + Number(r.capacity), 0);
        if (totalCapacity < activeGuestCount) {
          return res.status(400).json({
            success: false,
            error: "VALIDATION_FAILED",
            message: `Selected tables capacity (${totalCapacity}) cannot seat your party size (${activeGuestCount}).`
          });
        }

        // 3. Overlap check (excluding current reservation ID!)
        const [overlaps] = await pool.query(
          `SELECT TOP 1 r.reservation_id, rt.table_id
           FROM dbo.Reservations r
           JOIN dbo.ReservationTables rt ON r.reservation_id = rt.reservation_id
           WHERE rt.table_id IN (${activeTableIds.join(',')})
             AND r.reservation_id != ?
             AND r.reservation_status IN (${ACTIVE_RESERVATION_STATUS_SQL})
             AND DATEADD(minute, -60, r.reservation_start_at) < ?
             AND DATEADD(minute, 60, r.reservation_end_at) > ?`,
          [reservationId, activeSlotEnd.toISOString(), activeSlotStart.toISOString()]
        );

        if (overlaps.length > 0) {
          return res.status(400).json({
            success: false,
            error: "VALIDATION_FAILED",
            message: "Collision detected: One or more selected tables are already booked during this time."
          });
        }
      }
    }

    // Stage 4: Pre-order Pricing Integrity (Optional)
    const preorderItemsRaw = target.preorder_items || target.pre_order_items || target.preorderItems;
    const shouldPricePreorderItems = Array.isArray(preorderItemsRaw)
      && preorderItemsRaw.every((item) => item && typeof item === "object" && !Array.isArray(item));
    if (preorderItemsRaw !== undefined && shouldPricePreorderItems) {
      let preorderItemsTotal = 0;
      const validPreorderItems = [];

      if (Array.isArray(preorderItemsRaw) && preorderItemsRaw.length > 0) {
        for (const item of preorderItemsRaw) {
          const dishId = Number(item.dish_id || item.dishId || item.id);
          const qty = Number(item.quantity || item.qty || 1);

          if (!Number.isFinite(dishId) || dishId <= 0 || !Number.isFinite(qty) || qty <= 0) continue;

          const [dishRows] = await pool.query(
            `SELECT price FROM dbo.Dishes WHERE dish_id = ? AND is_available = 1`,
            [dishId]
          );

          if (dishRows.length > 0) {
            const unitPrice = Number(dishRows[0].price);
            preorderItemsTotal += unitPrice * qty;
            validPreorderItems.push({
              dish_id: dishId,
              quantity: qty,
              unit_price: unitPrice,
              notes: item.notes || null
            });
          }
        }
      }

      if (target.preorder_items !== undefined) target.preorder_items = validPreorderItems;
      if (target.pre_order_items !== undefined) target.pre_order_items = validPreorderItems;
      if (target.preorderItems !== undefined) target.preorderItems = validPreorderItems;
      // NOTE: Do NOT add deposit_amount/final_total/items_total to target here —
      // those keys are not in EDIT_REQUEST_ALLOWED_FIELDS and would cause
      // sanitizeEditChanges to reject the payload with INVALID_FIELDS.
    }

    next();
  } catch (err) {
    console.error("[validateReservationUpdate] Error:", err);
    return res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "An internal error occurred during reservation validation."
    });
  }
};
