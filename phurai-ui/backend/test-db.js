import { getRawPool } from './src/db.js';

async function test() {
  console.log("Testing DB connection...");
  try {
    const pool = await getRawPool();
    const result = await pool.request().query('SELECT 1 as result');
    console.log("Connection successful! Result:", result.recordset);
  } catch(e) {
    console.error("Connection failed:", e);
  }
  process.exit(0);
}

test();
