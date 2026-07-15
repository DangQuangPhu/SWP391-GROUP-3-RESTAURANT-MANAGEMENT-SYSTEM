import 'dotenv/config';
import { getRawPool } from './src/db.js';
getRawPool().then(pool => pool.request().query("SELECT COLUMN_NAME, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'StaffProfiles'")).then(r => console.log(r.recordset)).catch(console.error).finally(() => process.exit());
