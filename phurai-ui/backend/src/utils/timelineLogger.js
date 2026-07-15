import { getRawPool } from "../db.js";
import sql from "mssql";

export const getReservationTimeline = async (req, res) => {
  const reservationId = parseInt(req.params.id, 10);

  if (isNaN(reservationId)) {
    return res.status(400).json({ success: false, message: 'Invalid reservation ID' });
  }

  try {
    const pool = await getRawPool();
    const result = await pool.request()
      .input('resId', sql.Int, reservationId)
      .query(`
        SELECT 
          al.action_name,
          al.new_value_json,
          al.created_at,
          ISNULL(u.full_name, N'System') AS actor_name,
          al.user_id
        FROM dbo.AuditLogs al
        LEFT JOIN dbo.UserAccounts u ON al.user_id = u.user_id
        WHERE al.target_table = 'Reservations' AND al.target_id = @resId
        ORDER BY al.created_at ASC
      `);

    return res.json({
      success: true,
      timeline: result.recordset
    });
  } catch (error) {
    console.error('[timelineLogger] Error fetching reservation timeline:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch timeline logs' });
  }
};
