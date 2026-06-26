import 'dotenv/config';
import { getRawPool } from './db.js';
import sql from "mssql";

async function test() {
  try {
    const pool = await getRawPool();
    const result = await pool.request().query(`
      SELECT 
        v.voucher_id AS promotion_id, 
        v.voucher_code AS promo_code, 
        UPPER(p.discount_type) AS discount_type, 
        p.discount_value, 
        p.max_discount AS max_discount_amount, 
        p.min_order_value, 
        p.start_at AS valid_from, 
        p.end_at AS valid_until, 
        v.usage_limit, 
        v.times_used AS used_count, 
        v.is_active, 
        v.created_at, 
        v.updated_at
      FROM dbo.Vouchers v
      JOIN dbo.Promotions p ON v.promotion_id = p.promotion_id
      ORDER BY v.created_at DESC
    `);
    console.log("Vouchers:", result.recordset);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit(0);
  }
}
test();
