import pool from "../db.js";

const ACCOUNTABILITY_ACTIONS = [
  "ORDER_PLACED",
  "TICKET_SENT_TO_KITCHEN",
  "ORDER_SERVED",
  "BILL_REQUESTED",
  "PAYMENT_CONFIRMED",
  "TABLE_RELEASED",
  "ERT_EXTENDED",
  "WALKIN_SEATED",
  "RESERVATION_CHECKED_IN",
];

function jsonOk(res, data) {
  return res.json({ success: true, data });
}

function jsonError(res, message, status = 500) {
  return res.status(status).json({ success: false, message });
}

function parsePositiveInt(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function summarizeLogs(rows) {
  const actionCounts = {};
  const staffIds = new Set();
  const tableCounts = {};

  rows.forEach((row) => {
    actionCounts[row.action_name] = (actionCounts[row.action_name] || 0) + 1;
    if (row.actor_user_id) staffIds.add(row.actor_user_id);
    if (row.table_id) {
      tableCounts[row.table_id] = (tableCounts[row.table_id] || 0) + 1;
    }
  });

  const busiestTable = Object.entries(tableCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([tableId, count]) => ({ table_id: Number(tableId), count }))[0] ?? null;

  return {
    total_events: rows.length,
    active_staff_count: staffIds.size,
    order_served_count: actionCounts.ORDER_SERVED || 0,
    bill_requested_count: actionCounts.BILL_REQUESTED || 0,
    busiest_table: busiestTable,
    action_counts: actionCounts,
  };
}

export async function getAccountabilityAudit(req, res) {
  try {
    const tableId = parsePositiveInt(req.query.table_id);
    const staffId = parsePositiveInt(req.query.staff_id);
    const action = String(req.query.action ?? "").trim();
    const date = String(req.query.date ?? "").trim();
    const limit = Math.min(200, Math.max(25, Number(req.query.limit) || 100));

    const allowedActions = new Set(ACCOUNTABILITY_ACTIONS);
    const where = [
      `al.action_name IN (${ACCOUNTABILITY_ACTIONS.map(() => "?").join(", ")})`,
    ];
    const params = [...ACCOUNTABILITY_ACTIONS];

    if (tableId) {
      where.push(
        `COALESCE(
           JSON_VALUE(al.new_value_json, '$.table_id'),
           JSON_VALUE(al.old_value_json, '$.table_id'),
           CASE WHEN al.target_table = N'RestaurantTables' THEN CONVERT(NVARCHAR(20), al.target_id) END
         ) = ?`
      );
      params.push(String(tableId));
    }

    if (staffId) {
      where.push(`al.user_id = ?`);
      params.push(staffId);
    }

    if (action && allowedActions.has(action)) {
      where.push(`al.action_name = ?`);
      params.push(action);
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      where.push(`CAST(al.created_at AS DATE) = CAST(? AS DATE)`);
      params.push(date);
    }

    const [rows] = await pool.query(
      `SELECT TOP (${limit})
         al.audit_log_id,
         al.user_id AS actor_user_id,
         COALESCE(ua.full_name, N'SYSTEM') AS actor_name,
         COALESCE(r.role_name, N'SYSTEM') AS actor_role,
         al.action_name,
         al.target_table,
         al.target_id,
         COALESCE(
           JSON_VALUE(al.new_value_json, '$.table_id'),
           JSON_VALUE(al.old_value_json, '$.table_id'),
           CASE WHEN al.target_table = N'RestaurantTables' THEN CONVERT(NVARCHAR(20), al.target_id) END
         ) AS table_id,
         COALESCE(
           JSON_VALUE(al.new_value_json, '$.reservation_id'),
           JSON_VALUE(al.old_value_json, '$.reservation_id')
         ) AS reservation_id,
         COALESCE(
           JSON_VALUE(al.new_value_json, '$.customer_id'),
           JSON_VALUE(al.old_value_json, '$.customer_id')
         ) AS customer_id,
         COALESCE(
           JSON_VALUE(al.new_value_json, '$.order_id'),
           JSON_VALUE(al.old_value_json, '$.order_id')
         ) AS order_id,
         COALESCE(
           JSON_VALUE(al.new_value_json, '$.course_stage'),
           JSON_VALUE(al.old_value_json, '$.course_stage')
         ) AS course_stage,
         al.old_value_json,
         al.new_value_json,
         al.ip_address,
         al.created_at
       FROM dbo.AuditLogs AS al
       LEFT JOIN dbo.UserAccounts AS ua ON ua.user_id = al.user_id
       LEFT JOIN dbo.Roles AS r ON r.role_id = ua.role_id
       WHERE ${where.join(" AND ")}
       ORDER BY al.created_at DESC, al.audit_log_id DESC;`,
      params
    );

    const logs = rows.map((row) => ({
      audit_log_id: row.audit_log_id,
      actor_user_id: row.actor_user_id ?? null,
      actor_name: row.actor_name,
      actor_role: row.actor_role,
      action_name: row.action_name,
      target_table: row.target_table,
      target_id: row.target_id,
      table_id: row.table_id ? Number(row.table_id) : null,
      reservation_id: row.reservation_id ? Number(row.reservation_id) : null,
      customer_id: row.customer_id ? Number(row.customer_id) : null,
      order_id: row.order_id ? Number(row.order_id) : null,
      course_stage: row.course_stage ?? null,
      old_value_json: row.old_value_json ?? null,
      new_value_json: row.new_value_json ?? null,
      ip_address: row.ip_address ?? null,
      created_at: row.created_at,
    }));

    return jsonOk(res, {
      logs,
      summary: summarizeLogs(logs),
      actions: ACCOUNTABILITY_ACTIONS,
    });
  } catch (error) {
    console.error("GET /api/manager/accountability-audit failed:", error);
    return jsonError(res, "Could not load accountability audit.");
  }
}
