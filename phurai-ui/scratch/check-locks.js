import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config({ path: '../server/.env' });

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

async function checkLocks() {
  try {
    await sql.connect(config);
    const result = await sql.query(`
      SELECT 
        r.session_id, 
        status, 
        command, 
        wait_type, 
        wait_time, 
        blocking_session_id,
        t.text
      FROM sys.dm_exec_requests r
      CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
      WHERE r.session_id <> @@SPID
    `);
    console.log("Active requests:", result.recordset);
    
    const lockResult = await sql.query(`
        SELECT 
            request_session_id AS spid, 
            resource_type AS restype, 
            resource_database_id AS dbid, 
            DB_NAME(resource_database_id) AS dbname, 
            resource_description AS res, 
            resource_associated_entity_id AS id, 
            request_mode AS mode, 
            request_status AS status
        FROM sys.dm_tran_locks
        WHERE request_session_id <> @@SPID
    `);
    console.log("Active locks:", lockResult.recordset.length);

    // Also checking open transactions
    const tranResult = await sql.query(`
      SELECT session_id, is_user_transaction, is_local
      FROM sys.dm_tran_session_transactions
    `);
    console.log("Open transactions:", tranResult.recordset);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkLocks();
