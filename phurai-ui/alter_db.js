import pool from "./server/db.js";

async function run() {
  try {
    const connection = await pool.getConnection();
    console.log("Connected to DB.");

    try {
      await connection.query(`ALTER TABLE dbo.CustomerReviews DROP CONSTRAINT UQ_CustomerReviews_customer_order;`);
      console.log("Dropped old constraint.");
    } catch (e) {
      console.log("Old constraint drop failed (maybe doesn't exist):", e.message);
    }

    try {
      await connection.query(`ALTER TABLE dbo.CustomerReviews ALTER COLUMN customer_id INT NULL;`);
      console.log("Altered customer_id to NULL.");
    } catch (e) {
      console.log("Alter column failed:", e.message);
    }

    try {
      await connection.query(`ALTER TABLE dbo.CustomerReviews ADD CONSTRAINT UQ_CustomerReviews_order UNIQUE (order_id);`);
      console.log("Added new constraint.");
    } catch (e) {
      console.log("New constraint failed (maybe already exists):", e.message);
    }

    connection.release();
    console.log("Done.");
  } catch (error) {
    console.error("DB connection error:", error);
  }
  process.exit(0);
}

run();
