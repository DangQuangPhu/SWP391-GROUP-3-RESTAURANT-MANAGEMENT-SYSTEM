/**
 * Restores the complete reservation floor-plan inventory.
 *
 * The SVG contains 31 bookable tables. The reception marker is deliberately
 * not a table. This script is idempotent: it preserves existing table IDs and
 * statuses, renames the accidental compact seed codes, and adds only missing
 * rows. It never deletes a table, reservation, order, or payment.
 *
 * Usage: node backend/src/scripts/sync-floor-plan-inventory.js
 */
import pool from "../db.js";

const areas = [
  ["Window Area", "Regular", "Window-side seating"],
  ["Standard Area", "Regular", "Primary dining area"],
  ["Premium Area", "VIP", "Premium dining area"],
  ["VIP Lounge", "VIP", "VIP rooms"],
  ["Private Room", "Private", "Private dining rooms"],
  ["Kitchen View", "Bar", "Open-kitchen seating"],
];

const tables = [
  ["WIN-A", "Window Area", 2], ["WIN-B", "Window Area", 4], ["WIN-C", "Window Area", 6], ["WIN-D", "Window Area", 8],
  ["VIP-1", "VIP Lounge", 6], ["VIP-2", "VIP Lounge", 6], ["VIP-3", "VIP Lounge", 6],
  ...Array.from({ length: 12 }, (_, index) => [`S-${String(index + 1).padStart(2, "0")}`, "Standard Area", 4]),
  ...Array.from({ length: 4 }, (_, index) => [`PRE-${String(index + 1).padStart(2, "0")}`, "Premium Area", 4]),
  ["PR-01", "Private Room", 2], ["PR-02", "Private Room", 4], ["PR-03", "Private Room", 6], ["PR-04", "Private Room", 8],
  ...Array.from({ length: 4 }, (_, index) => [`K-${String(index + 1).padStart(2, "0")}`, "Kitchen View", 4]),
];

// The 16-row accidental seed used these compact values. Rename instead of
// deleting so historic FKs continue pointing at the exact same table rows.
const compactCodeMap = {
  K01: "K-01", K02: "K-02", K03: "K-03", K04: "K-04",
  P01: "PRE-01", P02: "PRE-02", P03: "PRE-03", P04: "PRE-04",
  R01: "PR-01", R02: "PR-02", R03: "PR-03",
  S01: "S-01", S02: "S-02", S03: "S-03", S04: "S-04", S05: "S-05",
};

async function sync() {
  for (const [name, type, description] of areas) {
    await pool.query(
      `IF NOT EXISTS (SELECT 1 FROM dbo.RestaurantAreas WHERE area_name = ?)
         INSERT INTO dbo.RestaurantAreas (area_name, area_type, description)
         VALUES (?, ?, ?);`,
      [name, name, type, description],
    );
  }

  for (const [compact, canonical] of Object.entries(compactCodeMap)) {
    await pool.query(
      `IF EXISTS (SELECT 1 FROM dbo.RestaurantTables WHERE table_number = ?)
        AND NOT EXISTS (SELECT 1 FROM dbo.RestaurantTables WHERE table_number = ?)
         UPDATE dbo.RestaurantTables SET table_number = ?, updated_at = SYSDATETIME()
         WHERE table_number = ?;`,
      [compact, canonical, canonical, compact],
    );
  }

  for (const [tableNumber, areaName, capacity] of tables) {
    const staticQr = `qr-${tableNumber.toLowerCase()}`;
    await pool.query(
      `DECLARE @areaId SMALLINT = (SELECT TOP 1 area_id FROM dbo.RestaurantAreas WHERE area_name = ?);
       IF @areaId IS NULL THROW 50001, 'Required restaurant area is missing.', 1;
       IF EXISTS (SELECT 1 FROM dbo.RestaurantTables WHERE table_number = ?)
         UPDATE dbo.RestaurantTables
         SET area_id = @areaId, capacity = ?, updated_at = SYSDATETIME()
         WHERE table_number = ?;
       ELSE
         INSERT INTO dbo.RestaurantTables (area_id, table_number, capacity, table_status, static_qr_code)
         VALUES (@areaId, ?, ?, N'Available', ?);`,
      [areaName, tableNumber, capacity, tableNumber, tableNumber, capacity, staticQr],
    );
  }

  const [rows] = await pool.query(
    `SELECT table_number, capacity, table_status
     FROM dbo.RestaurantTables
     WHERE table_number IN (${tables.map(() => "?").join(", ")})
     ORDER BY table_number;`,
    tables.map(([tableNumber]) => tableNumber),
  );
  if (rows.length !== tables.length) {
    throw new Error(`Inventory sync incomplete: expected ${tables.length}, found ${rows.length}.`);
  }
  console.log(JSON.stringify({ success: true, tableCount: rows.length, tables: rows }, null, 2));
}

sync().catch((error) => {
  console.error("Floor-plan inventory sync failed:", error);
  process.exitCode = 1;
});
