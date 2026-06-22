import 'dotenv/config';
import pool from './db.js';

async function check() {
  try {
    const [pRows] = await pool.query('SELECT COUNT(*) as c FROM dbo.PreorderItems');
    console.log('PreorderItems count:', pRows[0].c);

    const [kRows] = await pool.query('SELECT COUNT(*) as c FROM dbo.KitchenTickets');
    console.log('KitchenTickets count:', kRows[0].c);
    
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

check();
