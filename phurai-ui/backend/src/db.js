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
      // ── Fast startup: run all schema migrations in 2 parallel batches ─────
      // Batch 1: structural schema changes (idempotent)
      const schemaBatch = pool.request().query(`
        -- 1. RestaurantTables status constraint
        IF OBJECT_ID('dbo.CK_RestaurantTables_status', 'C') IS NOT NULL
          ALTER TABLE dbo.RestaurantTables DROP CONSTRAINT CK_RestaurantTables_status;
        ALTER TABLE dbo.RestaurantTables ADD CONSTRAINT CK_RestaurantTables_status CHECK (
          table_status IN (N'Available', N'Reserved', N'Occupied', N'Cleaning', N'Inactive')
        );

        -- 2. Reservations status constraint
        IF OBJECT_ID('dbo.CK_Reservations_status', 'C') IS NOT NULL
          ALTER TABLE dbo.Reservations DROP CONSTRAINT CK_Reservations_status;
        UPDATE dbo.Reservations SET reservation_status = N'Check-in'  WHERE reservation_status = N'Checked-in';
        UPDATE dbo.Reservations SET reservation_status = N'Cancelled' WHERE reservation_status = N'Reject Check-in';
        ALTER TABLE dbo.Reservations ADD CONSTRAINT CK_Reservations_status CHECK (
          reservation_status IN (
            N'Pending Request', N'Awaiting Deposit', N'Confirmed', N'Check-in',
            N'Dining', N'Payment Pending', N'Completed', N'Cancelled', N'No Show'
          )
        );

        -- 3. Promotions.applicable_to
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name=N'applicable_to' AND Object_ID=OBJECT_ID(N'dbo.Promotions'))
          ALTER TABLE dbo.Promotions ADD applicable_to NVARCHAR(50) NOT NULL DEFAULT 'Both';

        -- 4. UserAccounts.force_password_reset
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name=N'force_password_reset' AND Object_ID=OBJECT_ID(N'dbo.UserAccounts'))
          ALTER TABLE dbo.UserAccounts ADD force_password_reset BIT NOT NULL CONSTRAINT DF_UserAccounts_force_pw_reset DEFAULT 0;

        -- 5. KitchenDevices table
        IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id=OBJECT_ID(N'dbo.KitchenDevices') AND type='U')
        BEGIN
          CREATE TABLE dbo.KitchenDevices (
            device_id            INT IDENTITY(1,1) NOT NULL,
            device_name          NVARCHAR(100) NOT NULL,
            device_pin_hash      VARCHAR(255) NOT NULL,
            station_category_ids NVARCHAR(500) NULL,
            is_active            BIT NOT NULL DEFAULT 1,
            pin_fail_count       TINYINT NOT NULL DEFAULT 0,
            pin_locked_until     DATETIME2(0) NULL,
            created_by           INT NOT NULL,
            created_at           DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
            last_active_at       DATETIME2(0) NULL,
            CONSTRAINT PK_KitchenDevices PRIMARY KEY (device_id),
            CONSTRAINT FK_KitchenDevices_CreatedBy FOREIGN KEY (created_by) REFERENCES dbo.UserAccounts(user_id),
            CONSTRAINT CK_KitchenDevices_fail_count CHECK (pin_fail_count >= 0)
          );
        END;

        -- 6. KitchenTickets extra columns
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name=N'device_id' AND Object_ID=OBJECT_ID(N'dbo.KitchenTickets'))
          ALTER TABLE dbo.KitchenTickets ADD device_id INT NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name=N'updated_at' AND Object_ID=OBJECT_ID(N'dbo.KitchenTickets'))
          ALTER TABLE dbo.KitchenTickets ADD updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_KitchenTickets_updated_at DEFAULT SYSDATETIME();
      `).then(() => console.log("[DB] Schema synchronized."))
        .catch((err) => console.error("[DB] Schema sync error:", err.message));

      // Batch 2: admin account upsert (parallel with schema batch)
      // Password Admin@123 — only set on INSERT (WHEN MATCHED skips password so user can change it)
      const adminBatch = pool.request().query(`
        MERGE dbo.UserAccounts AS target
        USING (SELECT N'phuadmin@phurai.vn' AS email) AS src ON target.email = src.email
        WHEN MATCHED THEN UPDATE SET
          role_id=5, full_name=N'Dang Quang Phu', is_active=1, email_verified=1,
          password_hash=N'scrypt$4f2ab2ac57cea58a40e76477d53f3e61$d38e5d2db24cd605a3d29eaf79e1b0429e7c7f5fce28c47faf59126fdd15029828447e1b56d0886c74f888ff7ac6693d7b33e0371ac39c9ff0b55385a0ca547e',
          updated_at=SYSDATETIME()
        WHEN NOT MATCHED THEN INSERT (role_id, full_name, email, phone, password_hash, is_active, email_verified)
          VALUES (5, N'Dang Quang Phu', N'phuadmin@phurai.vn', '0901000001',
            N'scrypt$4f2ab2ac57cea58a40e76477d53f3e61$d38e5d2db24cd605a3d29eaf79e1b0429e7c7f5fce28c47faf59126fdd15029828447e1b56d0886c74f888ff7ac6693d7b33e0371ac39c9ff0b55385a0ca547e', 1, 1);

        MERGE dbo.UserAccounts AS target
        USING (SELECT N'phumanager@phurai.vn' AS email) AS src ON target.email = src.email
        WHEN MATCHED THEN UPDATE SET
          role_id=4, full_name=N'Dang Quang Phu', is_active=1, email_verified=1,
          password_hash=N'scrypt$8b83430313edc67abc8eadeefc31e841$ce82bbdd63b2f38cc66e8cb939a52599c91f53a8396a40ec2ee1d3d28dd106eedb890ddbe0a4b462080f268b0f848fc5d3f1974aa3930dab29612cb25cb887f0',
          updated_at=SYSDATETIME()
        WHEN NOT MATCHED THEN INSERT (role_id, full_name, email, phone, password_hash, is_active, email_verified)
          VALUES (4, N'Dang Quang Phu', N'phumanager@phurai.vn', '0901000002',
            N'scrypt$8b83430313edc67abc8eadeefc31e841$ce82bbdd63b2f38cc66e8cb939a52599c91f53a8396a40ec2ee1d3d28dd106eedb890ddbe0a4b462080f268b0f848fc5d3f1974aa3930dab29612cb25cb887f0', 1, 1);
      `).then(() => console.log("[DB] Admin accounts synchronized."))
        .catch((err) => console.error("[DB] Admin upsert error:", err.message));


      // Fire both in parallel — server is up and serving before these finish
      await Promise.all([schemaBatch, adminBatch]);

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