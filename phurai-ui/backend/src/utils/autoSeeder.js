import { getRawPool } from '../db.js';
import { seedFullMenuDatabase } from "../scripts/seedFullMenu.js";

export async function runAutoSeed() {
  if (process.env.AUTO_SEED_MENU !== "true") {
    console.log("[AutoSeeder] Skipped. Set AUTO_SEED_MENU=true to explicitly seed the full menu.");
    return;
  }

  try {
    const pool = await getRawPool();
    const res = await pool.request().query("SELECT COUNT(*) as count FROM dbo.Dishes");
    const dishCount = res.recordset[0]?.count || 0;

    if (dishCount < 80) {
      console.log(`[AutoSeeder] Dish count in database is ${dishCount} (< 80). Seeding full 93 menu items...`);
      await seedFullMenuDatabase();
      console.log("[AutoSeeder] Full 93 menu items successfully seeded.");
    }
  } catch (err) {
    console.error("[AutoSeeder] Auto-seeding check failed:", err.message);
  }
}
