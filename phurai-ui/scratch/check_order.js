import { getRawPool } from '../server/db.js';
import sql from 'mssql';

async function main() {
  try {
    const pool = await getRawPool();
    const result = await pool.request()
      .input('code', sql.VarChar(50), 'PHURAI909846')
      .query("SELECT * FROM dbo.Reservations WHERE order_code = @code");
    console.log("=== Reservation PHURAI909846 ===");
    console.log(result.recordset[0]);
  } catch (error) {
    console.error("Failed:", error);
  } finally {
    process.exit(0);
  }
}
main();
