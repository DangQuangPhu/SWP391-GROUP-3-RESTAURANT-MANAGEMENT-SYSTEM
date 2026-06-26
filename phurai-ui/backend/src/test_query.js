import sql from 'mssql';

async function run() {
  try {
    const config = {
      server: "127.0.0.1",
      port: 1433,
      user: "sa",
      password: "Phudeptrai123@",
      database: "System_Restaurant",
      options: {
        encrypt: false,
        trustServerCertificate: true
      }
    };
    const pool = await sql.connect(config);
    const result = await pool.request().query('SELECT * FROM dbo.Vouchers');
    console.log(result.recordset);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}
run();
