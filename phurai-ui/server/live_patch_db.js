import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

async function patchLiveDb() {
  try {
    const pool = await sql.connect(config);
    console.log("Connected to DB.");

    // Drop old constraint
    try {
      await pool.request().query(`ALTER TABLE dbo.Reservations DROP CONSTRAINT CK_Reservations_status`);
      console.log("Dropped old constraint CK_Reservations_status.");
    } catch (e) {
      console.log("Constraint might not exist or failed to drop:", e.message);
    }

    // Add new constraint
    await pool.request().query(`
      ALTER TABLE dbo.Reservations ADD CONSTRAINT CK_Reservations_status CHECK (reservation_status IN (N'Pending Request', N'Pending Payment', N'Reserved', N'Confirmed', N'Cancelled', N'Completed', N'No Show', N'Seated', N'Cleaning', N'Check-out', N'Reject Check-in', N'Reject Request', N'Reject Check-out', N'Paid', N'PaymentFailed', N'Pending', N'Await Check-in', N'Check-in', N'Occupied', N'Complete Paid'))
    `);
    console.log("Successfully added updated CK_Reservations_status constraint.");

    process.exit(0);
  } catch (err) {
    console.error("Error running script:", err);
    process.exit(1);
  }
}

patchLiveDb();
