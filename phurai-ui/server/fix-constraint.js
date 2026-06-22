import pool from "./db.js";

async function fixConstraint() {
  try {
    console.log("Dropping old CK_Reservations_status constraint...");
    await pool.query(`ALTER TABLE dbo.Reservations DROP CONSTRAINT CK_Reservations_status`);
    console.log("Adding new CK_Reservations_status constraint...");
    await pool.query(`
      ALTER TABLE dbo.Reservations ADD CONSTRAINT CK_Reservations_status CHECK (reservation_status IN
        (N'Pending', N'Confirmed', N'Checked In', N'Completed', N'Cancelled', N'No Show', N'Pending Request', N'Await Check-in', N'Check-in', N'Occupied', N'Complete Paid', N'Check-out', N'Reject Check-in', N'Reject Request', N'Reject Check-out', N'Paid', N'PaymentFailed'))
    `);
    console.log("Constraint updated successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Error updating constraint:", err);
    process.exit(1);
  }
}

fixConstraint();
