import pool from "./db.js";
async function test() {
  try {
    const [rows] = await pool.query('SELECT 1 as num');
    console.log("Connection OK", rows);
  } catch(e) {
    console.error("Connection FAILED", e);
  }
  process.exit(0);
}
test();
