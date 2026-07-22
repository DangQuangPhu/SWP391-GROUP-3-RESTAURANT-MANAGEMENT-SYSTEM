import { getRawPool } from '../src/db.js';

async function resetAllTablesToAvailable() {
  try {
    console.log("Connecting to database...");
    const pool = await getRawPool();
    
    // Close any active occupancy sessions
    await pool.request().query(`
      UPDATE dbo.TableOccupancySessions
      SET released_at = SYSDATETIME()
      WHERE released_at IS NULL;
    `);

    // Reset all tables to Available
    const result = await pool.request().query(`
      UPDATE dbo.RestaurantTables
      SET table_status = N'Available',
          merged_into_table_id = NULL,
          updated_at = SYSDATETIME()
      WHERE table_status != N'Inactive';
    `);

    console.log(`✅ Successfully updated ${result.rowsAffected[0]} tables to 'Available'!`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to update table status:", err.message);
    process.exit(1);
  }
}

resetAllTablesToAvailable();
