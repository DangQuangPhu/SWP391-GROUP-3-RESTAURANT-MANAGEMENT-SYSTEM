import sql from "mssql";
import { config } from "dotenv";

config();

const dbConfig = {
  user: process.env.DB_USER || "sa",
  password: process.env.DB_PASSWORD || "Admin123",
  server: process.env.DB_SERVER || "localhost",
  database: process.env.DB_NAME || "System_Restaurant",
  options: {
    encrypt: false,
    trustServerCertificate: true,
  }
};

async function check() {
  try {
    let pool = await sql.connect(dbConfig);
    let r1 = await pool.request().query("SELECT count(*) as count FROM Reservations WHERE CAST(reservation_start_at AS DATE) = CAST(GETDATE() AS DATE)");
    console.log("Reservations today:", r1.recordset[0].count);
    
    let r2 = await pool.request().query("SELECT count(*) as count FROM StaffSchedules WHERE CAST(work_date AS DATE) = CAST(GETDATE() AS DATE)");
    console.log("Staff schedules today:", r2.recordset[0].count);

    process.exit(0);
  } catch(e) {
    console.error(e);
  }
}
check();
