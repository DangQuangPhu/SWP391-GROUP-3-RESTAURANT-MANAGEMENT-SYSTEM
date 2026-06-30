import sql from "mssql";
import "./config.js";

const config = {
  server: process.env.DB_SERVER || "localhost",
  port: Number(process.env.DB_PORT) || 1433,
  database: process.env.DB_DATABASE || "System_Restaurant",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== "false",
  },
};

let poolPromise;

function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(config).then(async (pool) => {
      // 1. Chuẩn hóa trạng thái cho Bàn (RestaurantTables)
      try {
        await pool.request().query(`
          IF OBJECT_ID('dbo.CK_RestaurantTables_status', 'C') IS NOT NULL
          BEGIN
              ALTER TABLE dbo.RestaurantTables DROP CONSTRAINT CK_RestaurantTables_status;
          END
          ALTER TABLE dbo.RestaurantTables ADD CONSTRAINT CK_RestaurantTables_status CHECK (
              table_status IN (
                  N'Available', -- Bàn trống, sẵn sàng đón khách
                  N'Reserved',  -- Đã gán cho một Reservation nhưng khách chưa tới
                  N'Occupied',  -- Khách đang ngồi ăn
                  N'Cleaning',  -- Khách đã về, đang dọn dẹp
                  N'Inactive'   -- Bàn hỏng/Bảo trì
              )
          );
        `);
        console.log("Database RestaurantTables status constraint synchronized.");
      } catch (err) {
        console.error("Auto constraint patch (RestaurantTables) failed:", err.message);
      }

      // 2. Chuẩn hóa trạng thái cho Đơn đặt bàn (Reservations)
      try {
        await pool.request().query(`
          IF OBJECT_ID('dbo.CK_Reservations_status', 'C') IS NOT NULL
          BEGIN
              ALTER TABLE dbo.Reservations DROP CONSTRAINT CK_Reservations_status;
          END

          -- Normalize any legacy 'Checked-in' rows to the canonical 'Check-in' value.
          UPDATE dbo.Reservations SET reservation_status = N'Check-in' WHERE reservation_status = N'Checked-in';
          UPDATE dbo.Reservations SET reservation_status = N'Cancelled' WHERE reservation_status = N'Reject Check-in';

          ALTER TABLE dbo.Reservations ADD CONSTRAINT CK_Reservations_status CHECK (
              reservation_status IN (
                  N'Pending Request',  -- Khách vừa đặt online, chờ duyệt
                  N'Awaiting Deposit', -- Chờ khách cọc tiền
                  N'Confirmed',        -- Đã duyệt/Đã cọc (Bàn sẽ chuyển sang Reserved)
                  N'Check-in',         -- Lễ tân đã xác nhận khách đến cửa
                  N'Dining',           -- Khách đang dùng bữa (Bàn sẽ chuyển sang Occupied)
                  N'Payment Pending',  -- Đang chờ thanh toán
                  N'Completed',        -- Đã thanh toán xong
                  N'Cancelled',        -- Hủy đơn
                  N'No Show'           -- Khách không đến
              )
          );
        `);
        console.log("Database Reservations status constraint synchronized.");
      } catch (err) {
        console.error("Auto constraint patch (Reservations) failed:", err.message);
      }

      // 3. Ensure applicable_to column exists on Promotions
      try {
        await pool.request().query(`
          IF NOT EXISTS (
              SELECT * FROM sys.columns 
              WHERE Name = N'applicable_to' 
              AND Object_ID = Object_ID(N'dbo.Promotions')
          )
          BEGIN
              ALTER TABLE dbo.Promotions ADD applicable_to NVARCHAR(50) DEFAULT 'Both' NOT NULL;
          END
        `);
        console.log("Database Promotions applicable_to column synchronized.");
      } catch (err) {
        console.error("Auto constraint patch (Promotions applicable_to) failed:", err.message);
      }

      // 4. DIAGNOSTIC: Log all tables in the database to see why OrderItems is missing
      try {
        const tablesResult = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'");
        console.log("Tables in database:", tablesResult.recordset.map(t => t.TABLE_NAME));
      } catch (err) {
        console.error("Diagnostic tables check failed:", err.message);
      }

      return pool;
    });
  }

  return poolPromise;
}

function rewriteSqlForSqlServer(statement) {
  let rewritten = statement
    .replace(/`([^`]+)`/g, "[$1]")
    .replace(/TABLE_SCHEMA\s*=\s*DATABASE\(\)/gi, "TABLE_CATALOG = DB_NAME()");

  rewritten = rewritten.replace(
    /^\s*SELECT\s+\*\s+FROM\s+(\[[^\]]+\])([\s\S]*?)\s+LIMIT\s+1\s*$/i,
    "SELECT TOP 1 * FROM $1$2"
  );

  return rewritten;
}

function bindParams(request, statement, params = []) {
  let index = 0;

  const rewritten = statement.replace(/\?/g, () => {
    const name = `p${index}`;
    request.input(name, params[index]);
    index += 1;
    return `@${name}`;
  });

  return rewritten;
}

async function runQuery(executor, statement, params = []) {
  const request = executor.request();
  const sqlText = bindParams(request, rewriteSqlForSqlServer(statement), params);
  const result = await request.query(sqlText);
  return [result.recordset || [], result];
}

const pool = {
  async query(statement, params = []) {
    const connection = await getPool();
    return runQuery(connection, statement, params);
  },

  async getConnection() {
    const connection = await getPool();
    const transaction = new sql.Transaction(connection);

    return {
      async beginTransaction() {
        await transaction.begin();
      },
      async query(statement, params = []) {
        return runQuery(transaction, statement, params);
      },
      async commit() {
        await transaction.commit();
      },
      async rollback() {
        await transaction.rollback();
      },
      release() { },
    };
  },
};

export async function createDbRequest() {
  const connection = await getPool();
  return connection.request();
}

export async function getRawPool() {
  return await getPool();
}

export default pool;