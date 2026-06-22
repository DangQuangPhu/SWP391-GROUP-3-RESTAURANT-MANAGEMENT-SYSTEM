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
      /* Try/catch auto-patch DB block disabled as DB is the Single Source of Truth (Phase 3.1)
      try {
        // Auto-patch migration: clean up legacy statuses
        await pool.request().query(`
          UPDATE dbo.Reservations SET reservation_status = 'Confirmed' WHERE reservation_status = 'Await Check-in';
          UPDATE dbo.Reservations SET reservation_status = 'Seated' WHERE reservation_status IN ('Check-in', 'Occupied');
          UPDATE dbo.Reservations SET reservation_status = 'Completed' WHERE reservation_status = 'Complete Paid';
        `);

        // Automatically patch the DB constraint to allow all used statuses across different versions
        await pool.request().query(`
          IF OBJECT_ID('dbo.CK_Reservations_status', 'C') IS NOT NULL
          BEGIN
              ALTER TABLE dbo.Reservations DROP CONSTRAINT CK_Reservations_status;
          END
          ALTER TABLE dbo.Reservations ADD CONSTRAINT CK_Reservations_status CHECK (reservation_status IN (
            N'Pending', N'Confirmed', N'Checked In', N'Completed', N'Cancelled', N'No Show', 
            N'Pending Request', N'Pending Payment', N'Reserved', N'Await Check-in', N'Check-in', N'Occupied', N'Complete Paid', 
            N'Check-out', N'Reject Check-in', N'Reject Request', N'Reject Check-out', N'Paid', N'PaymentFailed',
            N'Request', N'Rejected'
          ));
        `);
      } catch (err) {
        console.error("Auto constraint patch failed (safe to ignore if already applied):", err.message);
      }
      */
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