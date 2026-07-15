import { getRawPool } from '../backend/src/db.js';
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkReservation() {
  try {
    const pool = await getRawPool();
    console.log('Querying reservation 122...');
    const res = await pool.request().query('SELECT * FROM dbo.Reservations WHERE reservation_id = 122');
    console.log('Reservation details:', res.recordset[0]);
    
    console.log('Querying payments for reservation 122...');
    const payments = await pool.request().query('SELECT * FROM dbo.Payments WHERE reservation_id = 122');
    console.log('Payments:', payments.recordset);
    
    console.log('Querying reservation tables for 122...');
    const tables = await pool.request().query('SELECT * FROM dbo.ReservationTables WHERE reservation_id = 122');
    console.log('Tables:', tables.recordset);

    console.log('Querying table status for tables...');
    if (tables.recordset.length > 0) {
      const tableIds = tables.recordset.map(t => t.table_id).join(',');
      const tblStatus = await pool.request().query(`SELECT * FROM dbo.RestaurantTables WHERE table_id IN (${tableIds})`);
      console.log('Table statuses:', tblStatus.recordset);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

checkReservation();
