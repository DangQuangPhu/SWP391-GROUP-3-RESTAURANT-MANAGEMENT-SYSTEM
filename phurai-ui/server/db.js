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
    poolPromise = sql.connect(config);
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
      release() {},
    };
  },
};

export async function createDbRequest() {
  const connection = await getPool();
  return connection.request();
}

export default pool;