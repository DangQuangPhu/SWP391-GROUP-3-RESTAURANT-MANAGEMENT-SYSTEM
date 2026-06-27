import 'dotenv/config';
import pool from './db.js';

async function run() {
  try {
    const { recordset } = await pool.query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'`);
    console.log(recordset.map(r => r.TABLE_NAME));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
run();
