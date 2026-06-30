/**
 * DIRECTIVE A: Migrate 'Seated' → 'Dining' in dbo.Reservations
 * 
 * Executes:
 * 1. UPDATE existing records
 * 2. DROP old CK_Reservations_status constraint
 * 3. ADD new constraint with 'Dining' replacing 'Seated'
 */
import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const config = {
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT) || 1433,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
  },
};

async function run() {
  const pool = await sql.connect(config);
  
  console.log('✓ Connected to Azure SQL Database');
  console.log('🔧 Starting Seated → Dining migration...\n');

  // Step 1: Update existing records
  const updateResult = await pool.request().query(`
    UPDATE dbo.Reservations 
    SET reservation_status = N'Dining', updated_at = SYSDATETIME()
    WHERE reservation_status = N'Seated';
    SELECT @@ROWCOUNT AS rows_updated;
  `);
  const rowsUpdated = updateResult.recordset[0].rows_updated;
  console.log(`✓ Step 1: Updated ${rowsUpdated} record(s) from 'Seated' → 'Dining'`);

  // Step 2: Drop old constraint
  try {
    await pool.request().query(`
      ALTER TABLE dbo.Reservations
      DROP CONSTRAINT CK_Reservations_status;
    `);
    console.log('✓ Step 2: Dropped constraint CK_Reservations_status');
  } catch (err) {
    if (err.message.includes('CK_Reservations_status')) {
      console.warn('⚠  Constraint CK_Reservations_status not found — may already be dropped. Continuing...');
    } else {
      throw err;
    }
  }

  // Step 3: Add new constraint with 'Dining'
  await pool.request().query(`
    ALTER TABLE dbo.Reservations
    ADD CONSTRAINT CK_Reservations_status
    CHECK (reservation_status IN (
      N'Pending Request',
      N'Awaiting Deposit',
      N'Confirmed',
      N'Check-in',
      N'Dining',
      N'Payment Pending',
      N'Completed',
      N'Cancelled',
      N'No Show'
    ));
  `);
  console.log('✓ Step 3: Added new constraint CK_Reservations_status (with Dining)');

  // Verification
  const verify = await pool.request().query(`
    SELECT reservation_status, COUNT(*) AS count
    FROM dbo.Reservations
    GROUP BY reservation_status
    ORDER BY reservation_status;
  `);
  console.log('\n📊 Current reservation_status distribution:');
  verify.recordset.forEach(row => {
    console.log(`   ${row.reservation_status.padEnd(20)} → ${row.count}`);
  });

  await pool.close();
  console.log('\n🎉 Migration complete! Seated → Dining fully applied to Azure SQL Database.');
}

run().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
