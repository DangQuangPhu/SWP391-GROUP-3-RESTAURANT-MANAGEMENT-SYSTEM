import sql from "mssql";
import { createDbRequest } from "../db.js";

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

function buildQrCode(tableNumber) {
  const slug = String(tableNumber)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  return `qr-${slug}`;
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
  return {
    table_id: row.table_id,
    table_number: row.table_number,
    area_id: row.area_id,
    area_name: row.area_name,
    capacity: row.capacity,
    status: slugStatus(row.table_status),
    table_status: row.table_status,
    qr_code: row.static_qr_code || null,
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
         a.area_name
       FROM dbo.RestaurantTables AS t
       INNER JOIN dbo.RestaurantAreas AS a ON a.area_id = t.area_id
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

    const staticQrCode = buildQrCode(tableNumber);

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

    const created = insertResult.recordset[0];

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
