import sql from "mssql";
import { createDbRequest } from "../db.js";
import crypto from "crypto";
import { sweepNoShows } from "../services/noShowSweeper.js";
import { sweepTableAssignmentFinalization } from "../services/tableAssignmentFinalizer.js";

const TABLE_STATUSES = new Set([
  "Available",
  "Reserved",
  "Occupied",
  "Cleaning",
  "Inactive",
]);

function jsonOk(res, data) {
  return res.json({ success: true, data });
}

function jsonError(res, message, status = 500) {
  return res.status(status).json({ success: false, message });
}

function isUniqueConstraintError(error) {
  const number = error?.number ?? error?.originalError?.number;
  if (number === 2627 || number === 2601) return true;
  const message = String(error?.message ?? "");
  return (
    message.includes("UQ_RestaurantTables_table_number") ||
    message.includes("UQ_RestaurantTables_static_qr_code") ||
    /unique|duplicate/i.test(message)
  );
}

function buildQrCode() {
  return crypto.randomUUID();
}

function parseTableNumberParts(tableNumber) {
  const text = String(tableNumber ?? "").trim();
  const match = text.match(/^(.+?)-(\d+)$/);
  if (!match) return null;
  return {
    prefix: match[1],
    numericPart: match[2],
    value: Number.parseInt(match[2], 10),
  };
}

function buildNextTableNumber(existingNumbers, areaName) {
  let best = null;

  for (const tableNumber of existingNumbers) {
    const parsed = parseTableNumberParts(tableNumber);
    if (!parsed || !Number.isFinite(parsed.value)) continue;
    if (!best || parsed.value > best.value) {
      best = parsed;
    }
  }

  if (best) {
    const nextValue = best.value + 1;
    const padWidth = Math.max(best.numericPart.length, String(nextValue).length);
    return `${best.prefix}-${String(nextValue).padStart(padWidth, "0")}`;
  }

  const fallbackPrefix = String(areaName || "T")
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Za-z]/g, ""))
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 3) || "T";

  return `${fallbackPrefix}-01`;
}

function parseStatusFilter(raw) {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => TABLE_STATUSES.has(item));
}

function slugStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function mapFilteredTableRow(row) {
  const rawStatus = row.table_status || "Available";
  let displayStatus = rawStatus;

  if (rawStatus === "Reserved" && !row.active_reservation_id) {
    displayStatus = "Available";
  } else if (rawStatus === "Available" && row.active_reservation_id) {
    displayStatus = "Reserved";
  }

  return {
    table_id: row.table_id,
    table_number: row.table_number,
    area_id: row.area_id,
    area_name: row.area_name,
    capacity: row.capacity,
    status: slugStatus(displayStatus),
    table_status: displayStatus,
    raw_table_status: rawStatus,
    qr_code: row.static_qr_code || null,
    merged_into_table_id: row.merged_into_table_id || null,
    is_counter: Boolean(row.is_counter),
    active_reservation_id: row.active_reservation_id ?? null,
    active_reservation_customer_name: row.active_reservation_customer_name ?? null,
    next_reservation_guest_count: row.next_reservation_guest_count ?? null,
    next_reservation_start_at: row.next_reservation_start_at ?? null,
    active_occupancy_reservation_id: row.active_occupancy_reservation_id ?? null,
    occupied_since: row.occupied_since ?? null,
    estimated_duration_min: row.estimated_duration_min ?? null,
    buffer_min: row.buffer_min ?? null,
    estimated_release_at: row.estimated_release_at ?? null,
    overrun_alerted: Boolean(row.overrun_alerted),
    upcoming_count: Number(row.upcoming_count ?? 0),
    active_order_id: row.active_order_id ?? null,
    active_order_status: row.active_order_status ?? null,
    active_order_item_count: Number(row.active_order_item_count ?? 0),
    course_stage: row.course_stage ?? null,
    course_stage_detail: row.course_stage_detail ?? null,
  };
}

function mapTableRow(row) {
  return {
    table_id: row.table_id,
    area_id: row.area_id,
    area_name: row.area_name,
    table_number: row.table_number,
    capacity: row.capacity,
    table_status: row.table_status,
    static_qr_code: row.static_qr_code,
  };
}

async function fetchActiveArea(areaId) {
  const request = await createDbRequest();
  request.input("areaId", sql.SmallInt, areaId);
  const result = await request.query(
    `SELECT TOP 1 area_id, area_name
     FROM dbo.RestaurantAreas
     WHERE area_id = @areaId
       AND is_active = 1;`
  );
  return result.recordset[0] ?? null;
}

export async function listAreas(_req, res) {
  try {
    const request = await createDbRequest();
    const result = await request.query(
      `SELECT
         a.area_id,
         a.area_name
       FROM dbo.RestaurantAreas AS a
       WHERE a.is_active = 1
       ORDER BY a.area_name ASC;`
    );

    const data = result.recordset.map((row) => ({
      area_id: row.area_id,
      area_name: row.area_name,
    }));

    return jsonOk(res, data);
  } catch (error) {
    console.error("GET /api/manager/areas failed:", error);
    return jsonError(res, "Could not load restaurant areas.");
  }
}

export async function getNextTableNumber(req, res) {
  try {
    const areaId = Number(req.query.area_id);
    if (!Number.isFinite(areaId) || areaId <= 0) {
      return jsonError(res, "area_id is required.", 400);
    }

    const area = await fetchActiveArea(areaId);
    if (!area) {
      return jsonError(res, "Area not found or inactive.", 404);
    }

    const tablesRequest = await createDbRequest();
    tablesRequest.input("areaId", sql.SmallInt, areaId);
    const tablesResult = await tablesRequest.query(
      `SELECT table_number
       FROM dbo.RestaurantTables
       WHERE area_id = @areaId
       ORDER BY table_number ASC;`
    );

    const tableNumbers = tablesResult.recordset.map((row) => row.table_number);
    const nextTableNumber = buildNextTableNumber(tableNumbers, area.area_name);

    const capacityRequest = await createDbRequest();
    capacityRequest.input("areaId", sql.SmallInt, areaId);
    const capacityResult = await capacityRequest.query(
      `SELECT TOP 1 capacity
       FROM (
         SELECT capacity, COUNT(*) AS usage_count
         FROM dbo.RestaurantTables
         WHERE area_id = @areaId
         GROUP BY capacity
       ) AS capacity_counts
       ORDER BY usage_count DESC, capacity ASC;`
    );

    return jsonOk(res, {
      area_id: area.area_id,
      area_name: area.area_name,
      table_number: nextTableNumber,
      suggested_capacity: capacityResult.recordset[0]?.capacity ?? null,
    });
  } catch (error) {
    console.error("GET /api/manager/next-table-number failed:", error);
    return jsonError(res, "Could not suggest next table number.");
  }
}

export async function listFilteredTables(req, res) {
  try {
    await sweepNoShows().catch((err) => console.error("[listFilteredTables] Auto sweep failed:", err.message));
    await sweepTableAssignmentFinalization().catch((err) => console.error("[listFilteredTables] Assignment sweep failed:", err.message));

    const search = String(req.query.search ?? "").trim();
    const areaIdRaw = req.query.area_id;
    const statuses = parseStatusFilter(req.query.statuses);

    const request = await createDbRequest();
    const where = ["a.is_active = 1"];
    let paramIndex = 0;

    if (search) {
      const paramName = `search${paramIndex}`;
      request.input(paramName, sql.NVarChar(40), `%${search}%`);
      where.push(`t.table_number LIKE @${paramName}`);
      paramIndex += 1;
    }

    if (areaIdRaw != null && String(areaIdRaw).trim() !== "") {
      const areaId = Number(areaIdRaw);
      if (!Number.isFinite(areaId) || areaId <= 0) {
        return jsonError(res, "Invalid area_id.", 400);
      }
      const paramName = `areaId${paramIndex}`;
      request.input(paramName, sql.SmallInt, areaId);
      where.push(`t.area_id = @${paramName}`);
      paramIndex += 1;
    }

    if (statuses.length > 0) {
      const statusParams = statuses.map((status, index) => {
        const paramName = `status${paramIndex + index}`;
        request.input(paramName, sql.NVarChar(20), status);
        return `@${paramName}`;
      });
      paramIndex += statuses.length;
      where.push(`t.table_status IN (${statusParams.join(", ")})`);
    }

    const result = await request.query(
      `SELECT
         t.table_id,
         t.area_id,
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
           SELECT TOP 1 COALESCE(ua.full_name, r.contact_name, N'Guest')
           FROM dbo.Reservations AS r
           LEFT JOIN dbo.UserAccounts AS ua ON r.customer_id = ua.user_id
           INNER JOIN dbo.ReservationTables AS rt ON r.reservation_id = rt.reservation_id
           WHERE rt.table_id = t.table_id
             AND r.reservation_status IN (N'Confirmed', N'Await Check-in', N'Pending')
             AND r.reservation_start_at >= SYSDATETIME()
             AND CAST(DATEADD(hour, 7, r.reservation_start_at) AS DATE) = CAST(DATEADD(hour, 7, SYSDATETIME()) AS DATE)
           ORDER BY r.reservation_start_at ASC
         ) AS active_reservation_customer_name,
         (
           SELECT TOP 1 r.guest_count
           FROM dbo.Reservations AS r
           INNER JOIN dbo.ReservationTables AS rt ON r.reservation_id = rt.reservation_id
           WHERE rt.table_id = t.table_id
             AND r.reservation_status IN (N'Confirmed', N'Await Check-in', N'Pending')
             AND r.reservation_start_at >= SYSDATETIME()
             AND CAST(DATEADD(hour, 7, r.reservation_start_at) AS DATE) = CAST(DATEADD(hour, 7, SYSDATETIME()) AS DATE)
           ORDER BY r.reservation_start_at ASC
         ) AS next_reservation_guest_count,
         (
           SELECT TOP 1 r.reservation_start_at
           FROM dbo.Reservations AS r
           INNER JOIN dbo.ReservationTables AS rt ON r.reservation_id = rt.reservation_id
           WHERE rt.table_id = t.table_id
             AND r.reservation_status IN (N'Confirmed', N'Await Check-in', N'Pending')
             AND r.reservation_start_at >= SYSDATETIME()
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
         (
           SELECT COUNT(1)
           FROM dbo.Reservations AS r_up
           INNER JOIN dbo.ReservationTables AS rt_up ON r_up.reservation_id = rt_up.reservation_id
           WHERE rt_up.table_id = t.table_id
             AND r_up.reservation_status IN (N'Confirmed', N'Await Check-in', N'Pending')
             AND r_up.reservation_start_at >= SYSDATETIME()
             AND CAST(DATEADD(hour, 7, r_up.reservation_start_at) AS DATE) = CAST(DATEADD(hour, 7, SYSDATETIME()) AS DATE)
         ) AS upcoming_count,
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
       FROM dbo.RestaurantTables AS t
       INNER JOIN dbo.RestaurantAreas AS a ON a.area_id = t.area_id
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
       WHERE ${where.join(" AND ")}
       ORDER BY a.area_name ASC, t.table_number ASC;`
    );

    return jsonOk(res, result.recordset.map(mapFilteredTableRow));
  } catch (error) {
    console.error("GET /api/manager/tables-filtered failed:", error);
    return jsonError(res, "Could not load filtered tables.");
  }
}

export async function createTable(req, res) {
  try {
    const tableNumber = String(req.body?.table_number ?? "").trim();
    const areaId = Number(req.body?.area_id);
    const capacity = Number(req.body?.capacity);
    const tableStatus = String(req.body?.table_status ?? "").trim();

    if (!tableNumber) {
      return jsonError(res, "table_number is required.", 400);
    }
    if (!Number.isFinite(areaId) || areaId <= 0) {
      return jsonError(res, "area_id is required.", 400);
    }
    if (!Number.isFinite(capacity) || capacity <= 0) {
      return jsonError(res, "capacity must be greater than 0.", 400);
    }
    if (!TABLE_STATUSES.has(tableStatus)) {
      return jsonError(
        res,
        "table_status must be one of: Available, Reserved, Occupied, Cleaning, Inactive.",
        400
      );
    }

    const area = await fetchActiveArea(areaId);
    if (!area) {
      return jsonError(res, "Area not found or inactive.", 404);
    }

    // --- Capacity Limit Check ---
    const limitRequest = await createDbRequest();
    limitRequest.input("areaId", sql.SmallInt, areaId);
    const limitResult = await limitRequest.query(
      `SELECT COUNT(*) as table_count
       FROM dbo.RestaurantTables
       WHERE area_id = @areaId;`
    );
    const currentTableCount = limitResult.recordset[0]?.table_count || 0;

    const maxTablesSettingResult = await createDbRequest().query(
      `SELECT setting_value FROM dbo.RestaurantSettings WHERE setting_key = 'max_tables_per_area'`
    );
    const maxTablesPerArea = Number(maxTablesSettingResult.recordset[0]?.setting_value) || 15;

    if (currentTableCount >= maxTablesPerArea) {
      return res.status(403).json({
        success: false,
        code: 'SPACE_LIMIT_REACHED',
        message: 'Floor plan capacity reached.'
      });
    }
    // ----------------------------

    const duplicateRequest = await createDbRequest();
    duplicateRequest.input("tableNumber", sql.NVarChar(20), tableNumber);
    duplicateRequest.input("areaId", sql.SmallInt, areaId);
    const duplicateResult = await duplicateRequest.query(
      `SELECT TOP 1 table_id
       FROM dbo.RestaurantTables
       WHERE table_number = @tableNumber
         AND area_id = @areaId;`
    );
    if (duplicateResult.recordset[0]) {
      return jsonError(res, `Table ${tableNumber} already exists in this area.`, 400);
    }

    let maxRetries = 3;
    let created;
    
    while (maxRetries > 0) {
      try {
        const staticQrCode = buildQrCode();

        const insertRequest = await createDbRequest();
        insertRequest.input("areaId", sql.SmallInt, areaId);
        insertRequest.input("tableNumber", sql.NVarChar(20), tableNumber);
        insertRequest.input("capacity", sql.TinyInt, capacity);
        insertRequest.input("tableStatus", sql.NVarChar(20), tableStatus);
        insertRequest.input("staticQrCode", sql.NVarChar(120), staticQrCode);

        const insertResult = await insertRequest.query(
          `INSERT INTO dbo.RestaurantTables
             (area_id, table_number, capacity, table_status, static_qr_code)
           OUTPUT
             INSERTED.table_id,
             INSERTED.area_id,
             INSERTED.table_number,
             INSERTED.capacity,
             INSERTED.table_status,
             INSERTED.static_qr_code
           VALUES
             (@areaId, @tableNumber, @capacity, @tableStatus, @staticQrCode);`
        );

        created = insertResult.recordset[0];
        break; // Success
      } catch (err) {
        if (isUniqueConstraintError(err) && String(err.message).includes("UQ_RestaurantTables_static_qr_code")) {
          maxRetries--;
          if (maxRetries === 0) throw err;
        } else {
          throw err;
        }
      }
    }

    return res.status(201).json({
      success: true,
      data: mapTableRow({
        ...created,
        area_name: area.area_name,
      }),
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const tableNumber = String(req.body?.table_number ?? "").trim();
      return jsonError(res, `Table ${tableNumber} already exists in this area.`, 400);
    }
    console.error("POST /api/manager/tables failed:", error);
    return jsonError(res, "Could not create table.");
  }
}

export async function createVirtualTable(req, res) {
  try {
    const areaId = req.body?.area_id ? Number(req.body.area_id) : 1;
    const capacity = req.body?.capacity ? Number(req.body.capacity) : 4;
    const baseNumber = req.body?.table_number ? String(req.body.table_number).trim() : 'V';

    const area = await fetchActiveArea(areaId);
    if (!area) {
      return jsonError(res, "Active area not found.", 404);
    }

    const numbersRequest = await createDbRequest();
    
    let tableNumber;
    if (baseNumber === 'V') {
      const numbersResult = await numbersRequest.query(
        `SELECT table_number FROM dbo.RestaurantTables WHERE table_number LIKE 'V-%';`
      );
      const existingNumbers = numbersResult.recordset.map((r) => r.table_number);
      let best = 0;
      for (const num of existingNumbers) {
        const match = num.match(/^V-(\d+)$/);
        if (match) {
          const val = parseInt(match[1], 10);
          if (val > best) best = val;
        }
      }
      tableNumber = `V-${String(best + 1).padStart(2, "0")}`;
    } else {
      numbersRequest.input("likePattern", sql.NVarChar(20), `${baseNumber}-V%`);
      const numbersResult = await numbersRequest.query(
        `SELECT table_number FROM dbo.RestaurantTables WHERE table_number LIKE @likePattern;`
      );
      const existingNumbers = numbersResult.recordset.map((r) => r.table_number);
      let best = 0;
      const regex = new RegExp(`^${baseNumber}-V(\\d+)$`);
      for (const num of existingNumbers) {
        const match = num.match(regex);
        if (match) {
          const val = parseInt(match[1], 10);
          if (val > best) best = val;
        }
      }
      tableNumber = `${baseNumber}-V${best + 1}`;
    }

    const staticQrCode = buildQrCode();
    const insertRequest = await createDbRequest();
    insertRequest.input("areaId", sql.SmallInt, areaId);
    insertRequest.input("tableNumber", sql.NVarChar(20), tableNumber);
    insertRequest.input("capacity", sql.TinyInt, capacity);
    insertRequest.input("tableStatus", sql.NVarChar(20), "Available");
    insertRequest.input("staticQrCode", sql.NVarChar(120), staticQrCode);

    const insertResult = await insertRequest.query(
      `INSERT INTO dbo.RestaurantTables
         (area_id, table_number, capacity, table_status, static_qr_code)
       OUTPUT
         INSERTED.table_id,
         INSERTED.area_id,
         INSERTED.table_number,
         INSERTED.capacity,
         INSERTED.table_status,
         INSERTED.static_qr_code
       VALUES
         (@areaId, @tableNumber, @capacity, @tableStatus, @staticQrCode);`
    );

    const created = insertResult.recordset[0];
    
    // Emit socket event to sync frontend
    const io = req.app.get("io");
    if (io) {
      io.to("room:manager").to("room:staff").emit("table:sync", { action: "create", table: created });
    }

    return res.status(201).json({
      success: true,
      data: mapTableRow({
        ...created,
        area_name: area.area_name,
      }),
    });
  } catch (error) {
    console.error("POST /api/manager/tables/virtual failed:", error);
    return jsonError(res, "Could not create virtual table.");
  }
}

export async function updateTable(req, res) {
  try {
    const tableId = Number(req.params.id);
    const tableNumber = String(req.body?.table_number ?? "").trim();
    const areaId = Number(req.body?.area_id);
    const capacity = Number(req.body?.capacity);
    const tableStatus = String(req.body?.status ?? req.body?.table_status ?? "").trim();

    if (!Number.isFinite(tableId) || tableId <= 0) {
      return jsonError(res, "Invalid table id.", 400);
    }
    if (!tableNumber) {
      return jsonError(res, "table_number is required.", 400);
    }
    if (!Number.isFinite(areaId) || areaId <= 0) {
      return jsonError(res, "area_id is required.", 400);
    }
    if (!Number.isFinite(capacity) || capacity <= 0) {
      return jsonError(res, "capacity must be greater than 0.", 400);
    }
    if (!TABLE_STATUSES.has(tableStatus)) {
      return jsonError(
        res,
        "table_status must be one of: Available, Reserved, Occupied, Cleaning, Inactive.",
        400
      );
    }

    const area = await fetchActiveArea(areaId);
    if (!area) {
      return jsonError(res, "Area not found or inactive.", 404);
    }

    const duplicateRequest = await createDbRequest();
    duplicateRequest.input("tableId", sql.SmallInt, tableId);
    duplicateRequest.input("tableNumber", sql.NVarChar(20), tableNumber);
    duplicateRequest.input("areaId", sql.SmallInt, areaId);
    const duplicateResult = await duplicateRequest.query(
      `SELECT TOP 1 table_id
       FROM dbo.RestaurantTables
       WHERE table_number = @tableNumber
         AND area_id = @areaId
         AND table_id != @tableId;`
    );
    if (duplicateResult.recordset[0]) {
      return jsonError(res, `Table ${tableNumber} already exists in this area.`, 400);
    }

    const oldTableRequest = await createDbRequest();
    oldTableRequest.input("tableId", sql.SmallInt, tableId);
    const oldTableResult = await oldTableRequest.query(`SELECT table_status FROM dbo.RestaurantTables WHERE table_id = @tableId`);
    const oldTableStatus = oldTableResult.recordset[0]?.table_status || "Unknown";

    const updateRequest = await createDbRequest();
    updateRequest.input("tableId", sql.SmallInt, tableId);
    updateRequest.input("areaId", sql.SmallInt, areaId);
    updateRequest.input("tableNumber", sql.NVarChar(20), tableNumber);
    updateRequest.input("capacity", sql.TinyInt, capacity);
    updateRequest.input("tableStatus", sql.NVarChar(20), tableStatus);

    const updateResult = await updateRequest.query(
      `UPDATE dbo.RestaurantTables
       SET area_id = @areaId,
           table_number = @tableNumber,
           capacity = @capacity,
           table_status = @tableStatus,
           updated_at = SYSDATETIME()
       WHERE table_id = @tableId;`
    );

    if (updateResult.rowsAffected[0] === 0) {
      return jsonError(res, "Table not found.", 404);
    }
    
    // Insert Audit Log
    const managerId = req.user?.userId || req.user?.id || 1;
    const auditRequest = await createDbRequest();
    auditRequest.input("managerId", sql.Int, managerId);
    auditRequest.input("tableId", sql.SmallInt, tableId);
    auditRequest.input("oldVal", sql.NVarChar(sql.MAX), JSON.stringify({ status: oldTableStatus }));
    auditRequest.input("newVal", sql.NVarChar(sql.MAX), JSON.stringify({ status: tableStatus }));
    
    await auditRequest.query(
      `INSERT INTO dbo.AuditLogs (
         user_id, action_name, target_table, target_id, old_value_json, new_value_json, 
         ip_address, created_at
       ) VALUES (
         @managerId, 'UPDATE_TABLE_STATUS', 'RestaurantTables', @tableId, @oldVal, @newVal,
         'system', SYSDATETIME()
       );`
    );

    // Emit socket event to sync frontend
    const io = req.app.get("io");
    if (io) {
      io.to("room:manager").to("room:staff").emit("table:sync", { action: "update", table_id: tableId });
      io.emit("table:status_changed", { table_id: tableId, table_status: tableStatus });
    }

    return res.json({
      success: true,
      message: "Table updated successfully",
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const tableNumber = String(req.body?.table_number ?? "").trim();
      return jsonError(res, `Table ${tableNumber} already exists in this area.`, 400);
    }
    console.error("PATCH /api/manager/tables/:id failed:", error);
    return jsonError(res, "Could not update table.");
  }
}

export async function deleteTable(req, res) {
  try {
    const tableId = Number(req.params.id);

    if (!Number.isFinite(tableId) || tableId <= 0) {
      return jsonError(res, "Invalid table id.", 400);
    }

    const deleteRequest = await createDbRequest();
    deleteRequest.input("tableId", sql.SmallInt, tableId);

    const deleteResult = await deleteRequest.query(
      `DELETE FROM dbo.RestaurantTables WHERE table_id = @tableId;`
    );

    if (deleteResult.rowsAffected[0] === 0) {
      return jsonError(res, "Table not found.", 404);
    }

    // Emit socket event to sync frontend
    const io = req.app.get("io");
    if (io) {
      io.to("room:manager").to("room:staff").emit("table:sync", { action: "delete", table_id: tableId });
    }

    return res.json({
      success: true,
      message: "Table deleted successfully",
    });
  } catch (error) {
    const isConstraintViolation = error?.number === 547 || (error?.originalError && error.originalError.number === 547);
    if (isConstraintViolation) {
      return jsonError(res, "Cannot delete table because it has historical data (reservations, orders, etc.). Please mark it as Inactive instead.", 409);
    }
    console.error("DELETE /api/manager/tables/:id failed:", error);
    return jsonError(res, "Could not delete table.");
  }
}
