import { getRawPool } from './db.js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function run() {
  const pool = await getRawPool();
  const result = await pool.request().query("SELECT ua.email, cp.username FROM dbo.UserAccounts ua LEFT JOIN dbo.CustomerProfiles cp ON ua.user_id = cp.user_id WHERE ua.role_id = 3");
  console.log(result.recordset);
  process.exit(0);
}
run();
