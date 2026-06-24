import pool from "./server/db.js";
import { checkinReservation } from "./server/controllers/staffReservationController.js";

async function runTest() {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 1. Create a mock unassigned reservation for testing
    // We need a customer ID first, let's grab the first one or just insert a dummy user
    const [users] = await connection.query(`SELECT TOP 1 user_id FROM dbo.UserAccounts`);
    const staffId = users[0] ? users[0].user_id : 1;
    
    // Insert a new reservation with Confirmed status
    await connection.query(`
      INSERT INTO dbo.Reservations (customer_id, reservation_start_at, guest_count, reservation_status, payment_status, contact_name, contact_phone)
      VALUES (?, SYSDATETIME(), 2, N'Confirmed', N'Pending', 'Test User', '123456789')
    `, [staffId]);
    
    // Get the ID of the reservation we just inserted
    const [insertedRes] = await connection.query(`SELECT TOP 1 reservation_id FROM dbo.Reservations ORDER BY reservation_id DESC`);
    const newResId = insertedRes[0].reservation_id;
    console.log(`Created mock reservation ID: ${newResId}`);
    
    // 2. Mock req and res objects
    const req = {
      params: { id: newResId.toString() },
      userId: staffId,
      ip: '127.0.0.1'
    };
    
    const res = {
      statusCode: null,
      jsonBody: null,
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.jsonBody = data;
        return this;
      }
    };
    
    // 3. Call the checkinReservation function
    console.log(`Calling checkinReservation for unassigned reservation ID ${newResId}...`);
    await checkinReservation(req, res);
    
    console.log(`Response Status: ${res.statusCode}`);
    console.log(`Response Body:`, res.jsonBody);
    
    if (res.statusCode === 400 && res.jsonBody.message.includes('Vui lòng xếp bàn')) {
      console.log("✅ TEST PASSED: Validation works and cleanly returns 400 without crashing!");
    } else {
      console.log("❌ TEST FAILED: Expected 400 Bad Request but got", res.statusCode);
      throw new Error("Test failed.");
    }
    
    // Cleanup the mock data
    await connection.query(`DELETE FROM dbo.Reservations WHERE reservation_id = ?`, [newResId]);
    console.log("Cleanup complete.");
    
  } catch (err) {
    console.error("Test execution error:", err);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

runTest();
