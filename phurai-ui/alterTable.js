import { getRawPool } from './server/db.js';

async function run() {
  try {
    const pool = await getRawPool();
    // Drop the unique constraint on (customer_id, order_id) since order_id can now be NULL.
    // Actually, SQL Server allows one NULL in UNIQUE constraints, but it's better to recreate it safely or drop it if it blocks.
    // Wait, let's just try to ALTER COLUMN first.
    // But there is a foreign key: FK_CustomerReviews_Orders
    // We don't need to drop FK to alter the column to NULL.
    
    await pool.request().query('ALTER TABLE dbo.CustomerReviews ALTER COLUMN order_id INT NULL;');
    console.log("Successfully altered order_id to NULL");
    process.exit(0);
  } catch (err) {
    console.error("Error altering table:", err);
    process.exit(1);
  }
}

run();
