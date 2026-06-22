import dotenv from "dotenv";
dotenv.config();
import pool from "./db.js";

async function run() {
  try {
    const [result] = await pool.query("UPDATE dbo.RestaurantTables SET static_qr_code = CONVERT(nvarchar(50), NEWID()) WHERE static_qr_code IS NULL;");
    console.log("Success backfill:", result);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit(0);
  }
}
run();
