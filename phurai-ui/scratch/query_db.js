import { getRawPool } from '../server/db.js';

async function main() {
  try {
    const pool = await getRawPool();
    
    console.log("=== Restaurant Tables ===");
    const tables = await pool.request().query("SELECT TOP 5 table_id, table_number, capacity, table_status FROM dbo.RestaurantTables");
    console.table(tables.recordset);
    
    console.log("=== Dishes ===");
    const dishes = await pool.request().query("SELECT TOP 5 dish_id, dish_name, price, is_available FROM dbo.Dishes");
    console.table(dishes.recordset);
    
    console.log("=== Vouchers ===");
    const vouchers = await pool.request().query("SELECT v.voucher_id, v.voucher_code, p.discount_type, p.discount_value, p.min_order_value FROM dbo.Vouchers v INNER JOIN dbo.Promotions p ON v.promotion_id = p.promotion_id");
    console.table(vouchers.recordset);
    
  } catch (error) {
    console.error("DB Query failed:", error);
  } finally {
    process.exit(0);
  }
}

main();
