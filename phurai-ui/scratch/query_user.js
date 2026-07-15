import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local first to get DB overrides, then .env
const envLocalPath = path.join(__dirname, '../.env.local');
const envPath = path.join(__dirname, '../.env');

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

import pool from '../backend/src/db.js';

async function query() {
  try {
    const [users] = await pool.query(`
      SELECT user_id, role_id, full_name, email, phone, avatar_url, email_verified
      FROM dbo.UserAccounts
      WHERE email = 'quagphu159@gmail.com'
    `);
    console.log("UserAccounts row:");
    console.log(users);

    if (users.length > 0) {
      const [profiles] = await pool.query(`
        SELECT customer_id, user_id, username, date_of_birth, gender, country, [language], bio
        FROM dbo.CustomerProfiles
        WHERE user_id = ?
      `, [users[0].user_id]);
      console.log("CustomerProfiles row:");
      console.log(profiles);
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
query();
