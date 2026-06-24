import pool from '../server/db.js';

async function main() {
  try {
    const [statuses] = await pool.query("SELECT DISTINCT reservation_status FROM dbo.Reservations");
    console.log("Distinct Reservation Statuses:");
    console.table(statuses);
    
    const [invalid] = await pool.query(`
      SELECT reservation_id, reservation_status 
      FROM dbo.Reservations 
      WHERE reservation_status NOT IN (
        N'Pending Request', N'Awaiting Deposit', N'Confirmed', 
        N'Check-in', N'Seated', N'Payment Pending', 
        N'Completed', N'Cancelled', N'No Show', N'Reject Check-in'
      )
    `);
    console.log("Invalid Reservations:");
    console.table(invalid);
  } catch (error) {
    console.error("Failed:", error);
  } finally {
    process.exit(0);
  }
}

main();
