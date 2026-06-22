import pool from "./server/db.js";
async function run() {
  try {
    const [result] = await pool.query("UPDATE dbo.RestaurantTables SET static_qr_code = CONVERT(nvarchar(50), NEWID()) WHERE static_qr_code IS NULL;");
    console.log("Backfill result:", result);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}
run();
