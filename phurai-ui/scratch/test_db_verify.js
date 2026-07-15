import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env files
const envLocalPath = "./.env.local";
const envPath = "./.env";

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

import pool from '../backend/src/db.js';
import { getProfileForUser } from '../backend/src/utils/profileService.js';

async function test() {
  try {
    console.log("Connecting to database...");
    const [testRow] = await pool.query("SELECT TOP 1 user_id, email FROM dbo.UserAccounts");
    console.log("Database connection successful. Top user:", testRow);

    const email = "quagphu159@gmail.com";
    console.log(`Fetching profile for: ${email}`);
    const [userRows] = await pool.query(
      `SELECT user_id, email, email_verified, is_active FROM dbo.UserAccounts WHERE email = ?`,
      [email]
    );
    console.log("User accounts matching email:", userRows);

    if (userRows.length > 0) {
      const userId = userRows[0].user_id;
      console.log(`Getting profile for user ID: ${userId}`);
      const profile = await getProfileForUser(userId, { ensureProfile: true, email });
      console.log("Profile retrieved successfully:", profile);
    } else {
      console.log("No user found with this email to fetch profile.");
    }
  } catch (error) {
    console.error("TEST FAILED WITH ERROR:", error);
  } finally {
    process.exit(0);
  }
}

test();
