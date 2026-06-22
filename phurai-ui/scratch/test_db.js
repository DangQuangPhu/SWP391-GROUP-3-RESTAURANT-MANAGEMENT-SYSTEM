import pool from './server/db.js';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

async function run() {
  try {
    const res = await pool.query(
      `INSERT INTO dbo.ReservationTables (reservation_id, table_id) VALUES (?, ?)`,
      [99999, undefined]
    );
    console.log("Success?", res);
  } catch(e) {
    console.error("Error:", e.message);
  }
  process.exit(0);
}
run();
