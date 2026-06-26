import "dotenv/config";
import pool from "./db.js";

async function testQuery() {
  try {
    console.log(`Connecting to ${process.env.DB_SERVER}...`);
    const [rows] = await pool.query(
      `SELECT TOP 5
         a.action_name,
         COALESCE(u.full_name, 'System') AS full_name,
         COALESCE(r.role_name, 'Automated') AS role_name,
         a.created_at,
         JSON_VALUE(a.new_value_json, '$.reservation_status') as new_status
       FROM dbo.AuditLogs a
       LEFT JOIN dbo.UserAccounts u ON a.user_id = u.user_id
       LEFT JOIN dbo.Roles r ON u.role_id = r.role_id
       WHERE a.target_table = 'Reservations'
       ORDER BY a.created_at DESC`
    );
    console.log("Query Results:");
    console.table(rows);
  } catch (err) {
    console.error("Query Error:");
    console.error(err);
  } finally {
    process.exit(0);
  }
}

testQuery();
