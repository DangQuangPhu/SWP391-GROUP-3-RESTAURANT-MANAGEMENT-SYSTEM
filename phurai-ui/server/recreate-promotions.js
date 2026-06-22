import { getRawPool } from './db.js';

async function run() {
  try {
    const pool = await getRawPool();
    console.log("Connected to DB. Checking schema...");
    
    // Check if we need to drop Vouchers first to avoid FK constraint issues
    await pool.request().query(`
      IF OBJECT_ID('dbo.Vouchers', 'U') IS NOT NULL 
        DROP TABLE dbo.Vouchers;
    `);

    // Drop Promotions table if exists
    await pool.request().query(`
      IF OBJECT_ID('dbo.Promotions', 'U') IS NOT NULL 
        DROP TABLE dbo.Promotions;
    `);

    // Create Promotions table as per spec
    await pool.request().query(`
      CREATE TABLE dbo.Promotions (
          promotion_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          promo_code VARCHAR(50) NOT NULL UNIQUE,
          discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('PERCENT', 'FIXED')),
          discount_value DECIMAL(12,2) NOT NULL,
          max_discount_amount DECIMAL(12,2) NULL,
          min_order_value DECIMAL(12,2) NOT NULL DEFAULT 0,
          valid_from DATETIME2 NOT NULL,
          valid_until DATETIME2 NOT NULL,
          usage_limit INT NULL,
          used_count INT NOT NULL DEFAULT 0,
          is_active BIT NOT NULL DEFAULT 1,
          created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
          updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
      );
    `);
    console.log("Table dbo.Promotions created successfully.");

    // Insert Seed data
    await pool.request().query(`
      INSERT INTO dbo.Promotions (
        promo_code, discount_type, discount_value, max_discount_amount, min_order_value, 
        valid_from, valid_until, usage_limit, is_active
      ) VALUES
      ('SUMMER20', 'PERCENT', 20.00, 50000.00, 200000.00, SYSDATETIME(), DATEADD(day, 30, SYSDATETIME()), 100, 1),
      ('WELCOME50K', 'FIXED', 50000.00, NULL, 300000.00, SYSDATETIME(), DATEADD(day, 30, SYSDATETIME()), 50, 1),
      ('FREEDRINK', 'FIXED', 25000.00, NULL, 0.00, SYSDATETIME(), DATEADD(day, 30, SYSDATETIME()), 200, 1)
    `);
    console.log("Seeded 3 sample vouchers.");

    // Verify
    const result = await pool.request().query(`SELECT * FROM dbo.Promotions`);
    console.log("Current Promotions Table Data:");
    console.table(result.recordset);

    process.exit(0);
  } catch (e) {
    console.error("Error:", e);
    process.exit(1);
  }
}
run();
