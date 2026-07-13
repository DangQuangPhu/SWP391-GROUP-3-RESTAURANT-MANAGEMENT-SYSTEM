import { getRawPool } from "./db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const CONFIRM   = process.argv.includes("--confirm");
const SEED_FULL = process.argv.includes("--seed-full");   // local: 1-year historical
// Default (no extra flag + --confirm) → demo seed for production

// ─────────────────────────────────────────────────────────────────────────────
// Helper: execute a .sql file split by GO
// ─────────────────────────────────────────────────────────────────────────────
async function runSqlFile(filePath, rawPool) {
  const label   = path.basename(filePath);
  const content = fs.readFileSync(filePath, "utf-8");
  const batches = content.split(/^\s*GO\s*$/im);
  console.log(`  → ${label}  (${batches.length} batches)`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i].trim();
    if (!batch) continue;
    try {
      await rawPool.query(batch);
    } catch (e) {
      console.error(`\n[ERROR] ${label} — batch ${i + 1}:\n${e.message}`);
      process.exit(1);
    }
  }
  console.log(`  ✓ ${label} done.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
const LOCK_FILE = path.join(process.cwd(), ".db-sync-lock");

async function run() {
  if (!CONFIRM) {
    console.error(`
╔══════════════════════════════════════════════════════════╗
║  [DANGER] This WIPES ALL DATA and rebuilds the database. ║
╚══════════════════════════════════════════════════════════╝

  Production  (small demo seed, ~80 rows, fast):
    npm run db:init:prod

  Local Dev  (1-year historical data, native bulk insert):
    npm run db:init:local

  Manual with flags:
    npm run db:init -- --confirm              ← demo seed (default)
    npm run db:init -- --confirm --seed-full  ← 1-year seed
`);
    process.exit(1);
  }

  // Create lock file to prevent concurrent auto-seeding
  fs.writeFileSync(LOCK_FILE, "1");

  const rawPool = await getRawPool();

  // ── 1. Drop all constraints then tables ───────────────────────────────────
  console.log("\nDropping all tables...");
  try {
    await rawPool.query(`
      WHILE(EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                   WHERE CONSTRAINT_TYPE = 'FOREIGN KEY'))
      BEGIN
        DECLARE @sql NVARCHAR(2000)
        SELECT TOP 1 @sql = (
          'ALTER TABLE ' + TABLE_SCHEMA + '.[' + TABLE_NAME +
          '] DROP CONSTRAINT [' + CONSTRAINT_NAME + ']')
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_TYPE = 'FOREIGN KEY'
        EXEC(@sql)
      END
    `);
    await rawPool.query(`
      DECLARE @dropSql NVARCHAR(MAX) = N'';
      SELECT @dropSql += 'DROP TABLE ' + QUOTENAME(TABLE_SCHEMA) +
                         '.' + QUOTENAME(TABLE_NAME) + ';'
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE';
      IF @dropSql <> '' EXEC sp_executesql @dropSql;
    `);
    console.log("  ✓ All tables dropped.");
  } catch (e) {
    console.error("Force-drop failed:", e.message);
    process.exit(1);
  }

  // ── 2. Base schema (DDL + static lookup data) ─────────────────────────────
  console.log("\nApplying base schema...");
  const schemaFile = path.join(__dirname, "../../database/System_Restaurant.sql");
  let content = fs.readFileSync(schemaFile, "utf-8");
  
  const marker = 'seed-demo.sql';
  const hasDemoSeed = content.includes(marker);
  
  if (SEED_FULL && hasDemoSeed) {
    console.log("  [INFO] Splitting schema from demo seed to avoid local conflicts...");
    content = content.split('-- seed-demo.sql')[0];
  }

  const batches = content.split(/^\s*GO\s*$/im);
  console.log(`  → System_Restaurant.sql  (${batches.length} batches)`);
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i].trim();
    if (!batch) continue;
    try {
      await rawPool.query(batch);
    } catch (e) {
      console.error(`\n[ERROR] System_Restaurant.sql — batch ${i + 1}:\n${e.message}`);
      process.exit(1);
    }
  }
  console.log(`  ✓ System_Restaurant.sql done.`);

  // ── 3. Seed — choose profile ──────────────────────────────────────────────
  if (SEED_FULL) {
    console.log("\n[LOCAL] Running 1-year historical seed (native bulk insert)...");
    const seedModule = path.join(__dirname, "../scripts/seed-local.js");
    const { generateAndSeed } = await import(seedModule);
    await generateAndSeed(rawPool);
    console.log("  ✓ 1-year local seed complete.");
  }

  console.log("\n🎉 ALL DATABASE INITIALIZATION & SEEDING COMPLETE!");
  try { fs.unlinkSync(LOCK_FILE); } catch(e) {}
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  try { fs.unlinkSync(LOCK_FILE); } catch(e) {}
  process.exit(1);
});
