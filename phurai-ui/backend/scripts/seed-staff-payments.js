import pool from "../src/db.js";

async function seedStaffPayments() {
  console.log("🌱 Starting Staff Payments Seed Data Script...");
  try {
    // 1. Fetch available tables or ensure 3 tables exist
    const [tables] = await pool.query(
      `SELECT TOP 5 t.table_id, t.table_number, t.capacity, t.table_status
       FROM dbo.RestaurantTables AS t
       ORDER BY t.table_id ASC`
    );

    if (!tables || tables.length === 0) {
      console.error("❌ No tables found in dbo.RestaurantTables. Please run main database seed first.");
      process.exit(1);
    }

    // 2. Fetch sample dishes
    const [dishes] = await pool.query(
      `SELECT TOP 10 dish_id, dish_name, price
       FROM dbo.Dishes
       WHERE is_available = 1
       ORDER BY dish_id ASC`
    );

    if (!dishes || dishes.length < 3) {
      console.error("❌ Not enough dishes in dbo.Dishes. Please seed dishes first.");
      process.exit(1);
    }

    const occupiedTablesToSeed = tables.slice(0, 3);
    console.log(`📌 Seeding ${occupiedTablesToSeed.length} tables as Occupied...`);

    for (let i = 0; i < occupiedTablesToSeed.length; i++) {
      const table = occupiedTablesToSeed[i];
      const tableId = table.table_id;

      // Mark table as Occupied
      await pool.query(
        `UPDATE dbo.RestaurantTables
         SET table_status = N'Occupied',
             updated_at = SYSDATETIME()
         WHERE table_id = ?`,
        [tableId]
      );

      // Check or create Active QR Session
      const [existingSession] = await pool.query(
        `SELECT TOP 1 qr_session_id FROM dbo.QROrderSessions
         WHERE table_id = ? AND session_status = N'Active'`,
        [tableId]
      );

      let sessionId;
      if (existingSession[0]) {
        sessionId = existingSession[0].qr_session_id;
      } else {
        const token = `SEED-TOKEN-T${table.table_number}-${Date.now()}`;
        const [sessRes] = await pool.query(
          `DECLARE @Out TABLE (qr_session_id INT);
           INSERT INTO dbo.QROrderSessions (table_id, token, session_status, generated_at, expires_at)
           OUTPUT INSERTED.qr_session_id INTO @Out
           VALUES (?, ?, N'Active', SYSDATETIME(), DATEADD(hour, 4, SYSDATETIME()));
           SELECT qr_session_id FROM @Out;`,
          [tableId, token]
        );
        sessionId = sessRes[0]?.qr_session_id;
      }

      // Check or create Active Order
      const [existingOrder] = await pool.query(
        `SELECT TOP 1 order_id FROM dbo.Orders
         WHERE table_id = ? AND order_status NOT IN (N'Paid', N'Cancelled')`,
        [tableId]
      );

      let orderId;
      if (existingOrder[0]) {
        orderId = existingOrder[0].order_id;
      } else {
        const [orderRes] = await pool.query(
          `DECLARE @OutOrder TABLE (order_id INT);
           INSERT INTO dbo.Orders (table_id, qr_session_id, order_type, order_status, subtotal, discount_amount, service_charge, total_amount, created_at, updated_at)
           OUTPUT INSERTED.order_id INTO @OutOrder
           VALUES (?, ?, N'Dine In', N'Open', 0, 0, 0, 0, SYSDATETIME(), SYSDATETIME());
           SELECT order_id FROM @OutOrder;`,
          [tableId, sessionId]
        );
        orderId = orderRes[0]?.order_id;
      }

      // Ensure order items exist for this order
      const [existingItems] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM dbo.OrderItems WHERE order_id = ?`,
        [orderId]
      );

      if (existingItems[0]?.cnt === 0) {
        // Select 3 random dishes
        const sampleDishes = [
          dishes[i % dishes.length],
          dishes[(i + 1) % dishes.length],
          dishes[(i + 2) % dishes.length],
        ];

        let totalSubtotal = 0;
        for (const dish of sampleDishes) {
          const qty = Math.floor(Math.random() * 2) + 1; // 1 or 2
          const unitPrice = Number(dish.price) || 85000;
          const lineTotal = qty * unitPrice;
          totalSubtotal += lineTotal;

          await pool.query(
            `INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, item_status, created_at, updated_at)
             VALUES (?, ?, ?, ?, N'Served', SYSDATETIME(), SYSDATETIME())`,
            [orderId, dish.dish_id, qty, unitPrice]
          );
        }

        // Update Order total
        await pool.query(
          `UPDATE dbo.Orders
           SET subtotal = ?, total_amount = ?
           WHERE order_id = ?`,
          [totalSubtotal, totalSubtotal, orderId]
        );
      }

      console.log(`✅ Table #${table.table_number} (ID: ${tableId}) seeded as OCCUPIED with Order #${orderId}`);
    }

    console.log("🎉 Staff Payments Seed Data successfully created!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding staff payments:", error);
    process.exit(1);
  }
}

seedStaffPayments();
