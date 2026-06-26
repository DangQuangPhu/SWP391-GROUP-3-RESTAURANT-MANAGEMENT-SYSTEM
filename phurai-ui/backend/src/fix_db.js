import dotenv from 'dotenv';
dotenv.config();

import { getRawPool } from './db.js';

async function fixDatabase() {
  try {
    const pool = await getRawPool();
    console.log("Connected to DB, applying fixes...");
    
    // 1. Add reservation_id column if not exists
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID(N'dbo.CustomerReviews') 
        AND name = 'reservation_id'
      )
      BEGIN
        ALTER TABLE dbo.CustomerReviews ADD reservation_id INT NULL;
        ALTER TABLE dbo.CustomerReviews ADD CONSTRAINT FK_CustomerReviews_Reservations FOREIGN KEY (reservation_id) REFERENCES dbo.Reservations(reservation_id) ON DELETE SET NULL;
        PRINT 'Added reservation_id column and foreign key';
      END
    `);

    // 2. Drop the old strict UNIQUE constraint on order_id
    await pool.request().query(`
      IF EXISTS (
        SELECT * FROM sys.objects 
        WHERE object_id = OBJECT_ID(N'dbo.UQ_CustomerReviews_order')
      )
      BEGIN
        ALTER TABLE dbo.CustomerReviews DROP CONSTRAINT UQ_CustomerReviews_order;
        PRINT 'Dropped old UQ_CustomerReviews_order constraint';
      END
      
      -- Alter order_id to allow NULLs
      BEGIN TRY
        ALTER TABLE dbo.CustomerReviews ALTER COLUMN order_id INT NULL;
        PRINT 'Altered order_id to allow NULLs';
      END TRY
      BEGIN CATCH
        PRINT 'Could not alter order_id, it might already be NULL or an index is preventing it.';
      END CATCH
    `);

    // 3. Create the filtered unique index for order_id
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.indexes 
        WHERE name = 'UQ_CustomerReviews_order' 
        AND object_id = OBJECT_ID(N'dbo.CustomerReviews')
      )
      BEGIN
        CREATE UNIQUE INDEX UQ_CustomerReviews_order ON dbo.CustomerReviews(order_id) WHERE order_id IS NOT NULL;
        PRINT 'Created filtered UQ_CustomerReviews_order index';
      END
    `);

    // 4. Create the filtered unique index for reservation_id
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.indexes 
        WHERE name = 'UQ_CustomerReviews_reservation' 
        AND object_id = OBJECT_ID(N'dbo.CustomerReviews')
      )
      BEGIN
        CREATE UNIQUE INDEX UQ_CustomerReviews_reservation ON dbo.CustomerReviews(reservation_id) WHERE reservation_id IS NOT NULL;
        PRINT 'Created filtered UQ_CustomerReviews_reservation index';
      END
    `);

    console.log("Database schema fix applied successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error applying DB fixes:", error);
    process.exit(1);
  }
}

fixDatabase();
