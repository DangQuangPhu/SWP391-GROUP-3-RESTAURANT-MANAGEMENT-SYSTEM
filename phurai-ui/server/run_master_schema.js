import pool from "./db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log("Dropping all tables forcibly...");
  try {
    await pool.query(`
      WHILE(EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_TYPE = 'FOREIGN KEY'))
      BEGIN
          DECLARE @sql NVARCHAR(2000)
          SELECT TOP 1 @sql=('ALTER TABLE ' + TABLE_SCHEMA + '.[' + TABLE_NAME + '] DROP CONSTRAINT [' + CONSTRAINT_NAME + ']')
          FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
          WHERE CONSTRAINT_TYPE = 'FOREIGN KEY'
          EXEC(@sql)
      END
    `);
    await pool.query(`
      EXEC sp_MSforeachtable 'DROP TABLE ?'
    `);
    console.log("All tables dropped.");
  } catch(e) {
    console.error("Force drop failed:", e);
  }

  const sqlFile = path.join(__dirname, "database/System_Restaurant.sql");
  const content = fs.readFileSync(sqlFile, "utf-8");
  const batches = content.split(/^\s*GO\s*$/im);
  
  console.log(`Executing System_Restaurant.sql in ${batches.length} batches...`);
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i].trim();
    if (!batch) continue;
    try {
      await pool.query(batch);
    } catch (e) {
      console.error(`\n[ERROR IN BATCH ${i+1}]:\n${e.message}`);
      process.exit(1);
    }
  }
  
  console.log("\n✅ Master schema executed successfully!");
  
  console.log("\n--- Executing Q04 ---");
  const q04 = `
    SELECT 
        kt.kitchen_ticket_id,
        o.order_id,
        rt.table_number,
        d.dish_name,
        oi.quantity,
        oi.notes AS special_instructions,
        kt.kitchen_status,
        kt.priority_level,
        DATEDIFF(MINUTE, kt.sent_at, GETDATE()) AS waiting_minutes
    FROM dbo.KitchenTickets kt
    JOIN dbo.OrderItems oi ON kt.order_item_id = oi.order_item_id
    JOIN dbo.Orders o ON oi.order_id = o.order_id
    JOIN dbo.ReservationTables rtab ON o.reservation_id = rtab.reservation_id
    JOIN dbo.RestaurantTables rt ON rtab.table_id = rt.table_id
    JOIN dbo.Dishes d ON oi.dish_id = d.dish_id
    WHERE kt.kitchen_status IN (N'Pending', N'Preparing')
    ORDER BY kt.priority_level ASC, kt.sent_at ASC;
  `;
  try {
    const [rows] = await pool.query(q04);
    console.log("Q04 Result:");
    console.table(rows);
  } catch (e) {
    console.error("Q04 FAILED:", e.message);
  }
  
  process.exit(0);
}

run().catch(console.error);
