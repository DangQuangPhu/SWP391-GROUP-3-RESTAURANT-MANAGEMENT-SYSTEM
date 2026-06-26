// Using built-in fetch
import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const HOST = 'host.docker.internal';
const API_BASE = `http://${HOST}:8080/api`;
const SEPAY_WEBHOOK = `http://${HOST}:8080/sepay-webhook`;

const config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'your_password',
  server: HOST, // Override to reach host machine from sandbox
  database: process.env.DB_DATABASE || 'System_Restaurant',
  port: Number(process.env.DB_PORT) || 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
  },
};

async function runTests() {
  console.log('--- STARTING AUTONOMOUS TDD LOOP ---');
  let pool;
  try {
    pool = await sql.connect(config);
    console.log('✅ Connected to database (using host.docker.internal)');

    // Make sure customer_id allows NULL
    try {
        await pool.query('ALTER TABLE dbo.CustomerReviews ALTER COLUMN customer_id INT NULL');
        console.log('✅ Enforced CustomerReviews customer_id INT NULL constraint.');
    } catch(e) {
        console.log('ℹ️ Note on ALTER TABLE:', e.message);
    }

    // SETUP: Create mock data
    console.log('1. Setting up mock data...');
    
    // Check if table 1 exists
    const tableRes = await pool.query(`SELECT table_id FROM dbo.RestaurantTables WHERE table_id = 1`);
    if (tableRes.recordset.length === 0) {
       await pool.query(`INSERT INTO dbo.RestaurantTables (table_id, table_number, seats, table_status) VALUES (1, 'T-1', 4, 'Occupied')`);
    } else {
       await pool.query(`UPDATE dbo.RestaurantTables SET table_status = 'Occupied' WHERE table_id = 1`);
    }

    // Create a mock Reservation
    const resInsert = await pool.request().query(`
      INSERT INTO dbo.Reservations (customer_id, reservation_status, guest_count, deposit_amount, final_total, created_at, updated_at)
      OUTPUT inserted.reservation_id
      VALUES (NULL, N'Seated', 2, 300000, 0, SYSDATETIME(), SYSDATETIME())
    `);
    const reservationId = resInsert.recordset[0].reservation_id;

    // Create a mock Preorder Order
    const preorderInsert = await pool.request()
      .input('resId', sql.Int, reservationId)
      .query(`
        INSERT INTO dbo.Orders (reservation_id, table_id, order_status, order_type, subtotal, total_amount, amount_paid)
        OUTPUT inserted.order_id
        VALUES (@resId, 1, N'Open', N'Preorder', 1000000, 1000000, 300000)
    `);
    const preorderOrderId = preorderInsert.recordset[0].order_id;

    // Create a mock Dish
    const dishRes = await pool.query(`SELECT TOP 1 dish_id, unit_price FROM dbo.Dishes`);
    const dishId = dishRes.recordset[0].dish_id;
    const unitPrice = dishRes.recordset[0].unit_price;

    // Insert Preorder Items
    await pool.request()
      .input('orderId', sql.Int, preorderOrderId)
      .input('dishId', sql.Int, dishId)
      .input('price', sql.Decimal(10,2), unitPrice)
      .query(`
        INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, item_status)
        VALUES (@orderId, @dishId, 1, @price, N'Served')
    `);

    // Create QR Session
    const token = 'test-token-' + Date.now();
    const sessionInsert = await pool.request()
      .input('resId', sql.Int, reservationId)
      .input('token', sql.VarChar, token)
      .query(`
        INSERT INTO dbo.QROrderSessions (table_id, reservation_id, token, session_status, generated_at)
        OUTPUT inserted.qr_session_id
        VALUES (1, @resId, @token, N'Active', SYSDATETIME())
    `);
    const sessionId = sessionInsert.recordset[0].qr_session_id;

    // Create a mock QR Order (Session Order)
    const qrOrderInsert = await pool.request()
      .input('resId', sql.Int, reservationId)
      .input('sessionId', sql.Int, sessionId)
      .query(`
        INSERT INTO dbo.Orders (reservation_id, table_id, qr_session_id, order_status, order_type, subtotal, total_amount, amount_paid)
        OUTPUT inserted.order_id
        VALUES (@resId, 1, @sessionId, N'Open', N'QR Self', 500000, 500000, 0)
    `);
    const qrOrderId = qrOrderInsert.recordset[0].order_id;

    // Insert QR Order Items (Pending, to be cancelled)
    const pendingItemInsert = await pool.request()
      .input('orderId', sql.Int, qrOrderId)
      .input('dishId', sql.Int, dishId)
      .input('price', sql.Decimal(10,2), 500000)
      .query(`
        INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, item_status)
        OUTPUT inserted.order_item_id
        VALUES (@orderId, @dishId, 1, @price, N'Pending')
    `);
    const pendingItemId = pendingItemInsert.recordset[0].order_item_id;
    
    // Insert dummy Kitchen Ticket for the pending item
    await pool.request()
      .input('itemId', sql.Int, pendingItemId)
      .query(`
        INSERT INTO dbo.KitchenTickets (order_item_id, table_id, kitchen_status)
        VALUES (@itemId, 1, N'Pending')
    `);

    console.log(`✅ Setup complete. Token: ${token}, Preorder ID: ${preorderOrderId}, QR Order ID: ${qrOrderId}`);

    // TEST 1: Fetch History
    console.log('\n2. Testing GET /api/public/qr/session/:token/history');
    const historyRes = await fetch(`${API_BASE}/public/qr/session/${token}/history`);
    const historyData = await historyRes.json();
    if (!historyData.success) throw new Error('History fetch failed: ' + historyData.message);
    
    if (historyData.data.summary.subtotal !== 1500000) {
        throw new Error(`Math Error: Expected Subtotal 1500000, got ${historyData.data.summary.subtotal}`);
    }
    if (historyData.data.summary.prepaidDeposit !== 300000) {
        throw new Error(`Math Error: Expected Prepaid 300000, got ${historyData.data.summary.prepaidDeposit}`);
    }
    if (historyData.data.summary.remainingToPay !== 1200000) {
        throw new Error(`Math Error: Expected Remaining 1200000, got ${historyData.data.summary.remainingToPay}`);
    }
    console.log('✅ History fetch and math passed!');

    // TEST 2: Cancel Item
    console.log(`\n3. Testing DELETE /api/public/qr-order/items/${pendingItemId}`);
    const cancelRes = await fetch(`${API_BASE}/public/qr-order/items/${pendingItemId}`, { method: 'DELETE' });
    const cancelData = await cancelRes.json();
    if (!cancelData.success) throw new Error('Cancel failed: ' + cancelData.message);
    
    // Verify math recalculation
    const [recalcOrder] = await pool.query(`SELECT subtotal, total_amount FROM dbo.Orders WHERE order_id = ${qrOrderId}`);
    if (recalcOrder.subtotal !== 0 || recalcOrder.total_amount !== 0) {
        throw new Error(`Recalculation Error: Expected 0, got subtotal=${recalcOrder.subtotal}, total=${recalcOrder.total_amount}`);
    }
    console.log('✅ Item cancelled and math recalculated properly!');

    // TEST 3: SePay Webhook
    console.log('\n4. Testing POST /sepay-webhook (Simulating payment)');
    const webhookRes = await fetch(SEPAY_WEBHOOK, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'authorization': 'Apikey Phurai_Secret_Token_2026'
        },
        body: JSON.stringify({
            transferAmount: 1200000,
            content: `DH${qrOrderId}`,
            referenceCode: 'TEST_TXN_123',
            transferType: 'in'
        })
    });
    const webhookData = await webhookRes.json();
    if (!webhookData.success) throw new Error('Webhook failed: ' + webhookData.message);
    
    // Verify Database state
    const [checkOrder] = await pool.query(`SELECT order_status FROM dbo.Orders WHERE order_id = ${qrOrderId}`);
    if (checkOrder.order_status !== 'Paid') throw new Error(`Order status is ${checkOrder.order_status}, expected Paid`);
    
    const [checkRes] = await pool.query(`SELECT reservation_status FROM dbo.Reservations WHERE reservation_id = ${reservationId}`);
    if (checkRes.reservation_status !== 'Completed') throw new Error(`Reservation status is ${checkRes.reservation_status}, expected Completed`);
    
    const [checkTable] = await pool.query(`SELECT table_status FROM dbo.RestaurantTables WHERE table_id = 1`);
    if (checkTable.table_status !== 'Cleaning') throw new Error(`Table status is ${checkTable.table_status}, expected Cleaning`);
    
    const [checkSession] = await pool.query(`SELECT session_status FROM dbo.QROrderSessions WHERE qr_session_id = ${sessionId}`);
    if (checkSession.session_status !== 'Closed') throw new Error(`Session status is ${checkSession.session_status}, expected Closed`);

    console.log('✅ Webhook automation passed! (Order=Paid, Res=Completed, Table=Cleaning, Session=Closed)');

    // TEST 4: Customer Review
    console.log(`\n5. Testing POST /api/public/reviews/${qrOrderId}`);
    const reviewRes = await fetch(`${API_BASE}/public/reviews/${qrOrderId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: 5, notes: 'Amazing food autonomously tested!' })
    });
    const reviewData = await reviewRes.json();
    
    if (!reviewData.success) {
        throw new Error('Review failed (Possibly missing DB constraint change): ' + reviewData.message);
    }
    console.log('✅ Review submitted successfully with NULL customer_id!');

    console.log('\n🎉 ALL TESTS PASSED! FULL TDD LOOP SUCCESSFUL! 🎉');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  }
}

runTests();
