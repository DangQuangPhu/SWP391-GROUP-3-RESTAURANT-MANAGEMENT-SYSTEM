import pool from "./db.js";

console.log({
  DB_SERVER: process.env.DB_SERVER,
  DB_PORT: process.env.DB_PORT,
  DB_DATABASE: process.env.DB_DATABASE,
  DB_USER: process.env.DB_USER,
  hasPassword: Boolean(process.env.DB_PASSWORD),
});

async function testDB() {
  try {
    const [rows] = await pool.query(`
      SELECT
        ua.user_id,
        ua.full_name,
        ua.email,
        ua.phone,
        ua.password_hash,
        ua.is_active,
        ua.email_verified,
        ua.last_login_at,
        ua.created_at,
        ua.updated_at,
        r.role_name,
        cp.username,
        cp.loyalty_points,
        cp.membership_tier,
        cp.preferences
      FROM dbo.UserAccounts ua
      JOIN dbo.Roles r ON ua.role_id = r.role_id
      LEFT JOIN dbo.CustomerProfiles cp ON ua.user_id = cp.user_id
      ORDER BY ua.user_id ASC
    `);

    console.log("Connect database OK");
    console.table(rows);
  } catch (error) {
    console.error("Connect database FAILED");
    console.error(error);
  }
}

testDB();