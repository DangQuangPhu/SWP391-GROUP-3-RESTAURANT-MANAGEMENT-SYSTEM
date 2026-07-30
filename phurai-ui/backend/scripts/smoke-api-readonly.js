/**
 * Read-only API smoke test for the four portal roles.
 * It never calls a state-changing endpoint and exits non-zero on a 5xx error.
 * Run the backend first, then: API_BASE=http://127.0.0.1:5002 node backend/scripts/smoke-api-readonly.js
 */
import jwt from "jsonwebtoken";
import sql from "mssql";
import "../src/config.js";

const apiBase = process.env.API_BASE || "http://127.0.0.1:5001";
const config = {
  server: process.env.DB_SERVER || "localhost",
  port: Number(process.env.DB_PORT) || 1433,
  database: process.env.DB_DATABASE || "System_Restaurant",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== "false",
  },
};

function tokenFor(user) {
  return jwt.sign(
    { user_id: user.user_id, role_id: user.role_id, role_name: user.role_name, full_name: user.full_name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "5m" }
  );
}

async function main() {
  const pool = await sql.connect(config);
  try {
    const users = (await pool.request().query(`
      SELECT ua.user_id, ua.role_id, ua.full_name, ua.email, r.role_name
      FROM dbo.UserAccounts ua JOIN dbo.Roles r ON r.role_id = ua.role_id
      WHERE r.role_name IN (N'Customer', N'Restaurant Staff', N'Manager', N'Admin') AND ua.is_active = 1
      ORDER BY CASE r.role_name WHEN N'Admin' THEN 1 WHEN N'Manager' THEN 2 WHEN N'Restaurant Staff' THEN 3 ELSE 4 END, ua.user_id
    `)).recordset;
    const byRole = Object.fromEntries(users.map((user) => [user.role_name, user]));
    for (const role of ["Customer", "Restaurant Staff", "Manager", "Admin"]) {
      if (!byRole[role]) throw new Error(`Missing active ${role} account.`);
    }

    const firstTable = (await pool.request().query("SELECT TOP (1) table_id FROM dbo.RestaurantTables ORDER BY table_id")).recordset[0];
    const firstOrder = (await pool.request().query("SELECT TOP (1) order_id FROM dbo.Orders ORDER BY order_id")).recordset[0];
    const firstReservation = (await pool.request().query("SELECT TOP (1) reservation_id FROM dbo.Reservations ORDER BY reservation_id DESC")).recordset[0];
    if (!firstTable || !firstOrder || !firstReservation) throw new Error("Seed data is incomplete for API smoke testing.");

    const auth = Object.fromEntries(Object.entries(byRole).map(([role, user]) => [role, { Authorization: `Bearer ${tokenFor(user)}`, "X-User-Id": String(user.user_id) }]));
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const checks = [
      ["health", "/health"],
      ["public menu", "/api/menu"],
      ["preorder menu", "/api/dishes/preorder"],
      ["reservation settings", "/api/reservations/settings"],
      ["reservation menu", "/api/reservations/menu"],
      ["availability", `/api/reservations/availability?date=${tomorrow}&time=19:00&guests=2`],
      ["table bookings", `/api/reservations/table-bookings?date=${tomorrow}`],
      ["customer summary", "/api/customer/dashboard/summary", auth.Customer],
      ["customer expenditure", "/api/customer/dashboard/expenditure-trend", auth.Customer],
      ["customer categories", "/api/customer/dashboard/orders-by-category", auth.Customer],
      ["customer activity", "/api/customer/dashboard/recent-activity", auth.Customer],
      ["customer payments", "/api/customer/payments/history", auth.Customer],
      ["profile", "/api/profile/me", auth.Customer],
      ["staff tables", "/api/staff/tables", auth["Restaurant Staff"]],
      ["staff timeline", "/api/staff/tables/timeline", auth["Restaurant Staff"]],
      ["staff reservations", "/api/staff/reservations/today-shift", auth["Restaurant Staff"]],
      ["staff active orders", "/api/staff/orders/active", auth["Restaurant Staff"]],
      ["staff menu", "/api/staff/dishes/menu", auth["Restaurant Staff"]],
      ["staff revenue", "/api/staff/reports/revenue", auth["Restaurant Staff"]],
      ["staff best selling", "/api/staff/best-selling?filter=month", auth["Restaurant Staff"]],
      ["staff order timeline", `/api/staff/orders/${firstOrder.order_id}/timeline`, auth["Restaurant Staff"]],
      ["manager areas", "/api/manager/areas", auth.Manager],
      ["manager floor plan", "/api/manager/floor-plan", auth.Manager],
      ["manager reservations", "/api/manager/reservations/all", auth.Manager],
      ["manager timeline", `/api/manager/tables/${firstTable.table_id}/timeline`, auth.Manager],
      ["manager reservation requests", "/api/manager/reservation-requests", auth.Manager],
      ["manager kitchen metrics", "/api/manager/kitchen/metrics", auth.Manager],
      ["manager audit", "/api/manager/accountability-audit", auth.Manager],
      ["admin dashboard", "/api/admin/dashboard/stats", auth.Admin],
      ["admin accounts", "/api/admin/accounts", auth.Admin],
      ["admin audits", "/api/admin/audit-logs", auth.Admin],
      ["admin reservations analytics", "/api/admin/analytics/reservations", auth.Admin],
      ["admin revenue analytics", "/api/admin/analytics/revenue", auth.Admin],
      ["admin orders analytics", "/api/admin/analytics/orders", auth.Admin],
      ["admin reviews analytics", "/api/admin/analytics/reviews", auth.Admin],
      ["kitchen queue", "/api/kitchen/queue", auth["Restaurant Staff"]],
      ["kitchen tickets", "/api/kitchen/tickets", auth["Restaurant Staff"]],
      ["kds devices", "/api/kds/devices-public"],
      ["reservation timeline", `/api/reservations/${firstReservation.reservation_id}/timeline`, auth.Customer],
    ];

    const failures = [];
    for (const [name, path, headers = {}] of checks) {
      const response = await fetch(`${apiBase}${path}`, { headers });
      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json") ? await response.json() : await response.text();
      const passed = response.status < 500;
      console.log(`${passed ? "PASS" : "FAIL"} ${name}: HTTP ${response.status}`);
      if (!passed) failures.push({ name, status: response.status, payload });
    }
    if (failures.length) throw new Error(`Read-only API smoke failures: ${JSON.stringify(failures)}`);
    console.log(`Read-only API smoke passed (${checks.length} endpoints).`);
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
