import { getRawPool } from './db.js';

async function patchLiveDb() {
  try {
    const pool = await getRawPool();
    console.log("Connected to DB. Running Migration...");

    const request = pool.request();
    await request.query(`
      BEGIN TRANSACTION;

      UPDATE dbo.Reservations SET reservation_status = 'Confirmed'
      WHERE reservation_status = 'Await Check-in';

      UPDATE dbo.Reservations SET reservation_status = 'Dining'
      WHERE reservation_status IN ('Check-in', 'Occupied', 'Seated');

      UPDATE dbo.Reservations SET reservation_status = 'Completed'
      WHERE reservation_status = 'Complete Paid';

      COMMIT TRANSACTION;
    `);

    console.log("Migration finished.");
    
    const result = await request.query(`SELECT DISTINCT reservation_status FROM dbo.Reservations;`);
    console.log("Current statuses in DB:", result.recordset);

    process.exit(0);
  } catch (err) {
    console.error("Error running script:", err);
    process.exit(1);
  }
}

patchLiveDb();
