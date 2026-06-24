import { getRawPool } from './db.js';

async function run() {
  try {
    const pool = await getRawPool();
    await pool.request().query('ALTER TABLE dbo.CustomerReviews ALTER COLUMN order_id INT NULL;');
    console.log("Successfully altered order_id to NULL");
    process.exit(0);
  } catch (err) {
    console.error("Error altering table:", err);
    process.exit(1);
  }
}

run();
