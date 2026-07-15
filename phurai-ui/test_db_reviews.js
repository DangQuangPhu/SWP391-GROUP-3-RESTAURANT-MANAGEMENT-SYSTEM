import pool from './backend/src/db.js';

async function test() {
  try {
    const [cols] = await pool.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'CustomerReviews'
    `);
    console.table(cols);
    
    // Test the specific JOIN query the user asked for
    const [testQuery] = await pool.query(`
      SELECT TOP 5
        cr.review_id,
        cr.food_rating,
        cr.service_rating,
        cr.overall_rating,
        cr.comment,
        cr.order_id
      FROM dbo.CustomerReviews cr
      JOIN dbo.Orders o ON cr.order_id = o.order_id
    `);
    console.log("Sample rows:");
    console.table(testQuery);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
test();
