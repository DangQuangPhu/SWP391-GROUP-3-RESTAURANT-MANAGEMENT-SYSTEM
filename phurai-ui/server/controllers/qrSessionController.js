import pool from "../db.js";

const SESSION_SELECT = `
  SELECT TOP 1
    qs.qr_session_id AS session_id,
    qs.table_id,
    qs.token,
    qs.session_status,
    qs.expires_at,
    qs.customer_id,
    t.table_number,
    t.static_qr_code,
    a.area_name
  FROM dbo.QROrderSessions AS qs
  INNER JOIN dbo.RestaurantTables AS t ON qs.table_id = t.table_id
  LEFT JOIN dbo.RestaurantAreas AS a ON t.area_id = a.area_id
`;

function mapSessionRow(row) {
  if (!row) return null;

  return {
    session_id: row.session_id,
    table_id: row.table_id,
    token: row.token,
    session_status: row.session_status,
    expires_at: row.expires_at,
    customer_id: row.customer_id,
    table_number: row.table_number,
    static_qr_code: row.static_qr_code,
    area_name: row.area_name ?? null,
  };
}

/**
 * GET /api/customer/qr-sessions/active
 * Returns the logged-in customer's active dine-in QR session, if any.
 */
export async function getActiveSession(req, res) {
  try {
    const userId = req.userId;

    const [rows] = await pool.query(
      `${SESSION_SELECT}
       WHERE qs.customer_id = ?
         AND qs.session_status = N'Active'
         AND (qs.expires_at IS NULL OR qs.expires_at > SYSUTCDATETIME())
       ORDER BY qs.generated_at DESC;`,
      [userId]
    );

    const session = mapSessionRow(rows[0]) ?? null;

    return res.json({
      success: true,
      hasActiveSession: Boolean(session),
      session,
    });
  } catch (error) {
    console.error("getActiveSession failed:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load active table session.",
    });
  }
}

/**
 * GET /api/customer/qr-sessions/validate?table_id=&session_id=
 * Confirms a table/session pair is active (QR scan or deep link).
 */
export async function validateSession(req, res) {
  try {
    const tableId = Number(req.query.table_id);
    const sessionId = Number(req.query.session_id);

    if (!Number.isFinite(tableId) || tableId <= 0 || !Number.isFinite(sessionId) || sessionId <= 0) {
      return res.status(400).json({
        success: false,
        message: "table_id and session_id are required.",
      });
    }

    const [rows] = await pool.query(
      `${SESSION_SELECT}
       WHERE qs.qr_session_id = ?
         AND qs.table_id = ?
         AND qs.session_status = N'Active'
         AND (qs.expires_at IS NULL OR qs.expires_at > SYSUTCDATETIME());`,
      [sessionId, tableId]
    );

    const session = mapSessionRow(rows[0]);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "This table session is not active or has expired.",
      });
    }

    return res.json({
      success: true,
      session,
    });
  } catch (error) {
    console.error("validateSession failed:", error);
    return res.status(500).json({
      success: false,
      message: "Could not validate table session.",
    });
  }
}
