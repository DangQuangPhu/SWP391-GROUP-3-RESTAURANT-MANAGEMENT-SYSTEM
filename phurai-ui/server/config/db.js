import sql from 'mssql';

const config = {
  server:   process.env.DB_SERVER   || 'localhost',
  database: process.env.DB_NAME     || 'System_Restaurant',
  user:     process.env.DB_USER     || 'sa',
  password: process.env.DB_PASS     || '',
  options: {
    encrypt:              process.env.DB_ENCRYPT   === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
    enableArithAbort:     true,
  },
  pool: {
    max:             10,
    min:             2,
    idleTimeoutMillis: 30000,
  },
};

let _pool = null;

async function getPool() {
  if (_pool && _pool.connected) return _pool;
  _pool = await sql.connect(config);
  _pool.on('error', (err) => {
    console.error('[DB POOL ERROR]', err.message);
    _pool = null;
  });
  return _pool;
}

export async function query(sqlText, params = {}) {
  const pool = await getPool();
  const req  = pool.request();

  for (const [key, val] of Object.entries(params)) {
    if (val === null || val === undefined) {
      req.input(key, sql.NVarChar, null);
    } else if (val instanceof Date) {
      req.input(key, sql.DateTime2, val);
    } else if (typeof val === 'boolean') {
      req.input(key, sql.Bit, val ? 1 : 0);
    } else if (typeof val === 'number') {
      if (!Number.isFinite(val)) {
        throw new Error(`Parameter "${key}" is not a finite number: ${val}`);
      }
      if (Number.isInteger(val)) {
        if (val >= -32768 && val <= 32767)       req.input(key, sql.SmallInt, val);
        else if (val >= 0 && val <= 255)          req.input(key, sql.TinyInt,  val);
        else                                       req.input(key, sql.Int,      val);
      } else {
        req.input(key, sql.Decimal(12, 2), val);
      }
    } else {
      req.input(key, sql.NVarChar, String(val));
    }
  }

  const result = await req.query(sqlText);
  return result.recordset ?? [];
}

export async function withTransaction(callback) {
  const pool        = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  async function txRequest(sqlText, params = {}) {
    const req = new sql.Request(transaction);
    for (const [key, val] of Object.entries(params)) {
      if (val === null || val === undefined) {
        req.input(key, sql.NVarChar, null);
      } else if (val instanceof Date) {
        req.input(key, sql.DateTime2, val);
      } else if (typeof val === 'boolean') {
        req.input(key, sql.Bit, val ? 1 : 0);
      } else if (typeof val === 'number') {
        if (!Number.isFinite(val)) {
          throw new Error(`Transaction param "${key}" is not finite: ${val}`);
        }
        if (Number.isInteger(val)) {
          if (val >= -32768 && val <= 32767) req.input(key, sql.SmallInt, val);
          else if (val >= 0 && val <= 255)   req.input(key, sql.TinyInt,  val);
          else                                req.input(key, sql.Int,      val);
        } else {
          req.input(key, sql.Decimal(12, 2), val);
        }
      } else {
        req.input(key, sql.NVarChar, String(val));
      }
    }
    const result = await req.query(sqlText);
    return result.recordset ?? [];
  }

  try {
    const result = await callback(txRequest);
    await transaction.commit();
    return result;
  } catch (err) {
    try { await transaction.rollback(); } catch (_) { }
    throw err;
  }
}

export { sql };
