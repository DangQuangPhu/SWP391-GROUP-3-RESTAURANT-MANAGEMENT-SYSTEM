/**
 * Isolated integration check for a two-table event reservation.
 *
 * It proves the party-size rule (8 guests / 2 tables), automatic table merge,
 * QR scanning from either table, QR ordering, and KDS linkage. Test records are
 * removed even when an assertion fails.
 *
 * Run with the API running: node backend/scripts/test-two-table-qr-kds-flow.js
 */
import sql from 'mssql';
import { getRawPool } from '../src/db.js';

const apiBase = (process.env.API_BASE_URL || 'http://localhost:5001').replace(/\/$/, '');
const testCode = `AUTOTEST-2TABLE-${Date.now()}`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function api(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  assert(response.ok && body.success !== false, `${options.method || 'GET'} ${path} failed: ${body.error || body.message || response.status}`);
  return body;
}

async function run() {
  const pool = await getRawPool();
  let reservationId;
  let tableIds = [];

  try {
    await api('/health');

    // Use only clean, available tables. The required capacity makes the test
    // fail if a party of 8 could incorrectly continue with insufficient seats.
    const tables = await pool.request().query(`
      WITH eligible AS (
        SELECT t.table_id, t.area_id, t.capacity, t.table_status
        FROM dbo.RestaurantTables t
        WHERE t.is_counter = 0
          AND t.table_status = N'Available'
          AND t.merged_into_table_id IS NULL
          -- A single table must be insufficient, so the 8-guest party really
          -- has to select both tables.
          AND t.capacity < 8
          AND NOT EXISTS (
            SELECT 1
            FROM dbo.ReservationTables rt
            JOIN dbo.Reservations r ON r.reservation_id = rt.reservation_id
            WHERE rt.table_id = t.table_id
              AND r.reservation_status IN (N'Await Check-in', N'Dining', N'Pending Payment')
          )
      ), chosen_area AS (
        SELECT TOP 1 area_id
        FROM eligible
        GROUP BY area_id
        HAVING COUNT(*) >= 2 AND SUM(capacity) >= 8
        ORDER BY MIN(area_id)
      )
      SELECT TOP 2 table_id, capacity, table_status
      FROM eligible
      WHERE area_id = (SELECT area_id FROM chosen_area)
      ORDER BY table_id;
    `);
    assert(tables.recordset.length === 2, 'Need two clean tables in one area with combined capacity of at least 8.');
    assert(tables.recordset.reduce((sum, row) => sum + Number(row.capacity), 0) >= 8, 'Two selected tables do not cover 8 guests.');
    assert(tables.recordset.every((row) => Number(row.capacity) < 8), 'A single selected table can seat 8 guests, so this is not a multi-table capacity test.');
    tableIds = tables.recordset.map((row) => Number(row.table_id));

    const dishResult = await pool.request().query(`
      SELECT TOP 1 dish_id, dish_name, price
      FROM dbo.Dishes
      WHERE is_available = 1
      ORDER BY dish_id;
    `);
    const dish = dishResult.recordset[0];
    assert(dish, 'No available dish exists for the QR → KDS test.');

    const customerResult = await pool.request()
      .input('email', sql.NVarChar(100), 'quagphu159@gmail.com')
      .query(`SELECT TOP 1 user_id FROM dbo.UserAccounts WHERE email = @email`);
    const customerId = customerResult.recordset[0]?.user_id ?? null;

    const reservationResult = await pool.request()
      .input('code', sql.VarChar(50), testCode)
      .input('customerId', sql.Int, customerId)
      .input('name', sql.NVarChar(100), 'AUTOTEST Two-table Event')
      .query(`
        INSERT INTO dbo.Reservations (
          order_code, customer_id, contact_name, contact_phone, reservation_start_at,
          reservation_end_at, guest_count, dining_purpose, reservation_status,
          reservation_source, deposit_amount, final_total, created_at, updated_at
        )
        OUTPUT INSERTED.reservation_id
        VALUES (
          @code, @customerId, @name, N'0900000000',
          DATEADD(minute, -10, SYSUTCDATETIME()), DATEADD(hour, 2, SYSUTCDATETIME()),
          8, N'Birthday', N'Dining', N'Online', 0, 0, SYSDATETIME(), SYSDATETIME()
        );
      `);
    reservationId = Number(reservationResult.recordset[0].reservation_id);

    for (const tableId of tableIds) {
      await pool.request().input('reservationId', sql.Int, reservationId).input('tableId', sql.Int, tableId).query(`
        INSERT INTO dbo.ReservationTables (reservation_id, table_id) VALUES (@reservationId, @tableId);
        UPDATE dbo.RestaurantTables SET table_status = N'Occupied', updated_at = SYSDATETIME() WHERE table_id = @tableId;
      `);
    }

    const primaryScan = await api('/api/customer/qr-sessions/scan', {
      method: 'POST', body: JSON.stringify({ table_id: tableIds[0] }),
    });
    const sessionId = Number(primaryScan.session?.session_id);
    assert(sessionId > 0, 'Primary-table QR scan did not return a session.');
    assert(Number(primaryScan.session.reservation_id) === reservationId, 'QR session is not linked to the event reservation.');

    const childScan = await api('/api/customer/qr-sessions/scan', {
      method: 'POST', body: JSON.stringify({ table_id: tableIds[1] }),
    });
    assert(Number(childScan.session?.session_id) === sessionId, 'Scanning the second table created a separate QR session.');

    const checkout = await api('/api/orders/checkout', {
      method: 'POST',
      body: JSON.stringify({
        session_id: sessionId,
        table_id: tableIds[1],
        items: [{ dish_id: dish.dish_id, quantity: 1, price: Number(dish.price) }],
      }),
    });
    const orderId = Number(checkout.data?.order_id);
    assert(orderId > 0, 'QR checkout did not create an order.');

    // Exercise the real online-payment controller (the same route SePay calls),
    // not a direct SQL update. It must complete the reservation, write Revenue
    // through Payments, close QR sessions, and release both tables.
    await api('/api/payments/sepay-webhook', {
      method: 'POST',
      headers: { Authorization: process.env.SEPAY_API_KEY || 'Apikey Phurai_Secret_Token_2026' },
      body: JSON.stringify({
        transferAmount: Number(dish.price),
        content: `ORD${orderId}`,
        referenceCode: `AUTOTEST-PAY-${Date.now()}`,
        transferType: 'in',
      }),
    });

    const verification = await pool.request()
      .input('reservationId', sql.Int, reservationId)
      .input('sessionId', sql.Int, sessionId)
      .input('orderId', sql.Int, orderId)
      .query(`
        SELECT
          (SELECT COUNT(*) FROM dbo.ReservationTables WHERE reservation_id = @reservationId) AS linked_tables,
          (SELECT COUNT(*) FROM dbo.QROrderSessions WHERE reservation_id = @reservationId AND session_status IN (N'Active', N'Pending')) AS active_sessions,
          (SELECT COUNT(*) FROM dbo.RestaurantTables WHERE table_id IN (SELECT table_id FROM dbo.ReservationTables WHERE reservation_id = @reservationId) AND table_status = N'Cleaning' AND merged_into_table_id IS NULL) AS released_tables,
          (SELECT COUNT(*) FROM dbo.Orders WHERE order_id = @orderId AND reservation_id = @reservationId AND qr_session_id = @sessionId) AS linked_order,
          (SELECT COUNT(*) FROM dbo.KitchenTickets kt JOIN dbo.OrderItems oi ON oi.order_item_id = kt.order_item_id JOIN dbo.Orders o ON o.order_id = oi.order_id WHERE o.order_id = @orderId AND o.reservation_id = @reservationId AND o.qr_session_id = @sessionId) AS linked_kds_tickets,
          (SELECT COUNT(*) FROM dbo.Payments WHERE order_id = @orderId AND reservation_id = @reservationId AND payment_status = N'Completed') AS completed_payments,
          (SELECT reservation_status FROM dbo.Reservations WHERE reservation_id = @reservationId) AS reservation_status;
      `);
    const result = verification.recordset[0];
    assert(Number(result.linked_tables) === 2, 'Staff/Manager source record does not retain both selected tables.');
    assert(Number(result.active_sessions) === 0, 'Payment completed but an active QR session remains.');
    assert(Number(result.released_tables) === 2, 'Payment did not release both merged tables.');
    assert(Number(result.linked_order) === 1, 'Order does not share reservation_id and qr_session_id.');
    assert(Number(result.linked_kds_tickets) >= 1, 'KDS ticket does not trace back to the same reservation/session.');
    assert(Number(result.completed_payments) === 1, 'Completed payment was not recorded for Revenue.');
    assert(result.reservation_status === 'Completed', 'Reservation did not transition to Completed after payment.');

    console.log(JSON.stringify({ pass: true, reservation_id: reservationId, qr_session_id: sessionId, order_id: orderId, tables: tableIds }, null, 2));
  } finally {
    if (reservationId) {
      const cleanup = pool.request().input('reservationId', sql.Int, reservationId);
      await cleanup.query(`
        DELETE kt FROM dbo.KitchenTickets kt
        JOIN dbo.OrderItems oi ON oi.order_item_id = kt.order_item_id
        JOIN dbo.Orders o ON o.order_id = oi.order_id
        WHERE o.reservation_id = @reservationId;
        DELETE oi FROM dbo.OrderItems oi JOIN dbo.Orders o ON o.order_id = oi.order_id WHERE o.reservation_id = @reservationId;
        DELETE FROM dbo.Payments WHERE order_id IN (SELECT order_id FROM dbo.Orders WHERE reservation_id = @reservationId);
        DELETE FROM dbo.Orders WHERE reservation_id = @reservationId;
        DELETE FROM dbo.QROrderSessions WHERE reservation_id = @reservationId;
        DELETE FROM dbo.ReservationTables WHERE reservation_id = @reservationId;
        DELETE FROM dbo.Reservations WHERE reservation_id = @reservationId;
      `);
    }
    for (const tableId of tableIds) {
      await pool.request().input('tableId', sql.Int, tableId).query(`
        UPDATE dbo.RestaurantTables
        SET table_status = N'Available', merged_into_table_id = NULL, updated_at = SYSDATETIME()
        WHERE table_id = @tableId;
      `);
    }
  }
}

run().catch((error) => {
  console.error(`Two-table QR/KDS test failed: ${error.message}`);
  process.exitCode = 1;
});
