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
      // Automatic pool reset on connection loss or socket hang up
      pool.on("error", (err) => {
        console.error("[DB] Connection pool error:", err.message);
        if (
          err.code === "ECONNRESET" ||
          err.message.includes("Connection lost") ||
          err.message.includes("socket hang up")
        ) {
          console.log("[DB] Resetting poolPromise to allow reconnection on next query.");
          poolPromise = null;
        }
      });

      const isInitScript = process.argv.some(arg =>
        arg.includes("run_master_schema") ||
        arg.includes("seed") ||
        arg.includes("migrate")
      );
      if (isInitScript) {
        return pool;
      }

      // Check if dbo.UserAccounts table exists. If not, auto-initialize the master schema.
      try {
        const tableCheck = await pool.request().query(`
          SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'UserAccounts'
        `);
        
        if (tableCheck.recordset.length === 0) {
          console.log("[DB] dbo.UserAccounts table not found. Auto-initializing master schema...");
          
          const fs = await import("fs");
          const path = await import("path");
          const { fileURLToPath } = await import("url");
          
          const __filename = fileURLToPath(import.meta.url);
          const __dirname = path.dirname(__filename);
          const schemaFile = path.join(__dirname, "../../database/System_Restaurant.sql");
          
          if (fs.existsSync(schemaFile)) {
            const content = fs.readFileSync(schemaFile, "utf-8");
            const batches = content.split(/^\s*GO\s*$/im);
            console.log(`[DB] Executing System_Restaurant.sql (${batches.length} batches)...`);
            
            for (let i = 0; i < batches.length; i++) {
              const batch = batches[i].trim();
              if (!batch) continue;
              await pool.request().query(batch);
            }
            console.log("[DB] Master schema successfully auto-initialized!");
          } else {
            console.error(`[DB] Schema file not found at ${schemaFile}`);
          }
        }
      } catch (checkErr) {
        console.error("[DB] Table check/auto-initialize error:", checkErr.message);
      }

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
        
        -- Sanitize old values to prevent check constraint conflicts
        UPDATE dbo.Reservations SET reservation_status = N'Await Check-in' WHERE reservation_status IN (N'Confirmed', N'Confirm');
        UPDATE dbo.Reservations SET reservation_status = N'Dining' WHERE reservation_status IN (N'Checked-in', N'Check-in');
        UPDATE dbo.Reservations SET reservation_status = N'Cancelled' WHERE reservation_status IN (N'Reject Check-in', N'Check-in Rejected', N'Rejected');
        
        -- Fallback safety update for any unknown/outdated values
        UPDATE dbo.Reservations
        SET reservation_status = N'Cancelled'
        WHERE reservation_status NOT IN (
          N'Pending Request', N'Awaiting Deposit', N'Await Check-in',
          N'Dining', N'Pending Payment', N'Completed', N'Cancelled', N'No Show'
        );

        ALTER TABLE dbo.Reservations ADD CONSTRAINT CK_Reservations_status CHECK (
          reservation_status IN (
            N'Pending Request', N'Awaiting Deposit', N'Await Check-in',
            N'Dining', N'Pending Payment', N'Completed', N'Cancelled', N'No Show'
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

        -- 7. RestaurantTables position columns
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name=N'position_x' AND Object_ID=OBJECT_ID(N'dbo.RestaurantTables'))
          ALTER TABLE dbo.RestaurantTables ADD position_x SMALLINT NOT NULL CONSTRAINT DF_RestaurantTables_px DEFAULT 0;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name=N'position_y' AND Object_ID=OBJECT_ID(N'dbo.RestaurantTables'))
          ALTER TABLE dbo.RestaurantTables ADD position_y SMALLINT NOT NULL CONSTRAINT DF_RestaurantTables_py DEFAULT 0;

        -- 8. Drop Roles name check constraint to support custom roles
        IF OBJECT_ID('dbo.CK_Roles_role_name', 'C') IS NOT NULL
          ALTER TABLE dbo.Roles DROP CONSTRAINT CK_Roles_role_name;

        -- 9. TableOccupancySessions
        IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TableOccupancySessions' AND schema_id = SCHEMA_ID('dbo'))
        BEGIN
            CREATE TABLE dbo.TableOccupancySessions (
                session_id            INT IDENTITY(1,1) NOT NULL,
                table_id              SMALLINT NOT NULL,
                reservation_id        INT NULL,
                order_id              INT NULL,
                guest_count           TINYINT NOT NULL CONSTRAINT DF_TOS_guest_count DEFAULT 1,
                check_in_at           DATETIME2(0) NOT NULL CONSTRAINT DF_TOS_check_in_at DEFAULT SYSDATETIME(),
                estimated_duration_min INT NOT NULL,
                buffer_min            INT NOT NULL CONSTRAINT DF_TOS_buffer_min DEFAULT 15,
                estimated_release_at  DATETIME2(0) NOT NULL,
                released_at           DATETIME2(0) NULL,
                release_trigger       NVARCHAR(30) NULL,
                released_by_staff_id  INT NULL,
                overrun_alerted       BIT NOT NULL CONSTRAINT DF_TOS_overrun_alerted DEFAULT 0,
                created_at            DATETIME2(0) NOT NULL CONSTRAINT DF_TOS_created_at DEFAULT SYSDATETIME(),
                updated_at            DATETIME2(0) NOT NULL CONSTRAINT DF_TOS_updated_at DEFAULT SYSDATETIME(),
                CONSTRAINT PK_TableOccupancySessions PRIMARY KEY (session_id),
                CONSTRAINT FK_TOS_RestaurantTables FOREIGN KEY (table_id)
                    REFERENCES dbo.RestaurantTables(table_id) ON DELETE CASCADE,
                CONSTRAINT FK_TOS_Reservations FOREIGN KEY (reservation_id)
                    REFERENCES dbo.Reservations(reservation_id) ON DELETE SET NULL,
                CONSTRAINT FK_TOS_Orders FOREIGN KEY (order_id)
                    REFERENCES dbo.Orders(order_id),
                CONSTRAINT FK_TOS_Staff FOREIGN KEY (released_by_staff_id)
                    REFERENCES dbo.UserAccounts(user_id),
                CONSTRAINT CK_TOS_release_trigger CHECK (
                    release_trigger IN (N'OnlinePayment', N'StaffCashConfirm', N'ManualRelease') OR release_trigger IS NULL
                ),
                CONSTRAINT CK_TOS_duration CHECK (estimated_duration_min > 0),
                CONSTRAINT CK_TOS_buffer CHECK (buffer_min >= 0)
            );

            CREATE INDEX IX_TOS_table_open ON dbo.TableOccupancySessions(table_id, released_at)
                WHERE released_at IS NULL;

            CREATE INDEX IX_TOS_overrun_check ON dbo.TableOccupancySessions(estimated_release_at, released_at, overrun_alerted)
                WHERE released_at IS NULL;
        END;

        -- 10. Update CK_Notifications_type
        IF EXISTS (
            SELECT 1 FROM sys.check_constraints
            WHERE name = 'CK_Notifications_type'
            AND parent_object_id = OBJECT_ID('dbo.Notifications')
        )
        BEGIN
            ALTER TABLE dbo.Notifications DROP CONSTRAINT CK_Notifications_type;
        END;

        ALTER TABLE dbo.Notifications ADD CONSTRAINT CK_Notifications_type CHECK (
            notification_type IN (
                N'Booking Confirmed', N'Booking Rejected', N'Booking Cancelled', N'Booking Reminder',
                N'Booking Changed', N'Order Ready', N'Payment Receipt', N'Promotion',
                N'System', N'Overrun Warning'
            )
        );

        -- 11. RestaurantSettings cleaning_buffer_min & Opening Hours defaults
        IF NOT EXISTS (SELECT 1 FROM dbo.RestaurantSettings WHERE setting_key = N'cleaning_buffer_min')
        BEGIN
            INSERT INTO dbo.RestaurantSettings (setting_key, setting_value, description, updated_by)
            VALUES (N'cleaning_buffer_min', N'15', N'Buffer minutes added to EstimatedDuration to calculate EstimatedReleaseTime', 1);
        END;

        IF NOT EXISTS (SELECT 1 FROM dbo.RestaurantSettings WHERE setting_key = N'hours_mon_thu')
            INSERT INTO dbo.RestaurantSettings (setting_key, setting_value, description, updated_by) VALUES (N'hours_mon_thu', N'7:00 AM — 12:00 AM', N'Opening hours: Monday to Thursday', 1);
        IF NOT EXISTS (SELECT 1 FROM dbo.RestaurantSettings WHERE setting_key = N'hours_fri_sat')
            INSERT INTO dbo.RestaurantSettings (setting_key, setting_value, description, updated_by) VALUES (N'hours_fri_sat', N'7:00 AM — 12:00 AM', N'Opening hours: Friday to Saturday', 1);
        IF NOT EXISTS (SELECT 1 FROM dbo.RestaurantSettings WHERE setting_key = N'hours_sunday')
            INSERT INTO dbo.RestaurantSettings (setting_key, setting_value, description, updated_by) VALUES (N'hours_sunday', N'7:00 PM — 10:00 PM', N'Opening hours: Sunday', 1);
        IF NOT EXISTS (SELECT 1 FROM dbo.RestaurantSettings WHERE setting_key = N'hours_happy')
            INSERT INTO dbo.RestaurantSettings (setting_key, setting_value, description, updated_by) VALUES (N'hours_happy', N'4:00 PM — 7:00 PM Daily', N'Happy Hour timing', 1);
        IF NOT EXISTS (SELECT 1 FROM dbo.RestaurantSettings WHERE setting_key = N'closed_days')
            INSERT INTO dbo.RestaurantSettings (setting_key, setting_value, description, updated_by) VALUES (N'closed_days', N'', N'Closed days or dates (e.g. Sunday or 2026-07-27)', 1);

      `).then(() => console.log("[DB] Schema synchronized."))
        .catch((err) => console.error("[DB] Schema sync error:", err.message));

      // Batch 2: admin account upsert (parallel with schema batch).
      // Existing password hashes must never be overwritten during startup.
      const adminBatch = pool.request().query(`
        MERGE dbo.UserAccounts AS target
        USING (SELECT N'phuadmin@phurai.vn' AS email) AS src ON target.email = src.email
        WHEN MATCHED THEN UPDATE SET
          role_id=4, full_name=N'Dang Quang Phu', is_active=1, email_verified=1,
          updated_at=SYSDATETIME()
        WHEN NOT MATCHED THEN INSERT (role_id, full_name, email, phone, password_hash, is_active, email_verified)
          VALUES (4, N'Dang Quang Phu', N'phuadmin@phurai.vn', '0901000001',
            N'scrypt$3fc41cd9111a05256c622615de15c504$8478e9821bc1955d78e788229acce921aa4e9b7be840afe40b8551b486c10f6d565a17afffe7d8aee279a2782dda8b4fddbf3bd99bba6f46b9df11c0d73f0af6', 1, 1);

        MERGE dbo.UserAccounts AS target
        USING (SELECT N'phumanager@phurai.vn' AS email) AS src ON target.email = src.email
        WHEN MATCHED THEN UPDATE SET
          role_id=3, full_name=N'Dang Quang Phu', is_active=1, email_verified=1,
          updated_at=SYSDATETIME()
        WHEN NOT MATCHED THEN INSERT (role_id, full_name, email, phone, password_hash, is_active, email_verified)
          VALUES (3, N'Dang Quang Phu', N'phumanager@phurai.vn', '0901000002',
            N'scrypt$3fc41cd9111a05256c622615de15c504$8478e9821bc1955d78e788229acce921aa4e9b7be840afe40b8551b486c10f6d565a17afffe7d8aee279a2782dda8b4fddbf3bd99bba6f46b9df11c0d73f0af6', 1, 1);
      `).then(() => console.log("[DB] Admin accounts synchronized."))
        .catch((err) => console.error("[DB] Admin upsert error:", err.message));


      // Run startup migrations serially.  Running DDL and account upserts in
      // parallel can race on a fresh database and produce transient constraint
      // errors even though both batches are individually idempotent.
      await adminBatch;
      await schemaBatch;

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
    try {
      const connection = await getPool();
      return await runQuery(connection, statement, params);
    } catch (err) {
      if (
        err.code === "ECONNRESET" ||
        (err.message && (err.message.includes("Connection lost") || err.message.includes("socket hang up")))
      ) {
        console.log("[DB] Connection loss detected on query. Resetting poolPromise.");
        poolPromise = null;
      }
      throw err;
    }
  },

  async getConnection() {
    try {
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
    } catch (err) {
      if (
        err.code === "ECONNRESET" ||
        (err.message && (err.message.includes("Connection lost") || err.message.includes("socket hang up")))
      ) {
        console.log("[DB] Connection loss detected on getConnection. Resetting poolPromise.");
        poolPromise = null;
      }
      throw err;
    }
  },
};

export async function createDbRequest() {
  try {
    const connection = await getPool();
    return connection.request();
  } catch (err) {
    if (
      err.code === "ECONNRESET" ||
      (err.message && (err.message.includes("Connection lost") || err.message.includes("socket hang up")))
    ) {
      poolPromise = null;
    }
    throw err;
  }
}

export async function getRawPool() {
  try {
    return await getPool();
  } catch (err) {
    if (
      err.code === "ECONNRESET" ||
      (err.message && (err.message.includes("Connection lost") || err.message.includes("socket hang up")))
    ) {
      poolPromise = null;
    }
    throw err;
  }
}

export default pool;
