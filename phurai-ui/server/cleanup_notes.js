import sql from 'mssql';

const config = {
  server: "10.211.55.2",
  port: 1433,
  database: "System_Restaurant",
  user: "sa",
  password: "Phudeptrai@",
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

async function run() {
  try {
    await sql.connect(config);
    const result = await sql.query(`
      SELECT reservation_id, special_request FROM dbo.Reservations
      WHERE special_request IS NOT NULL
    `);
    console.log("Rows:", result.recordset);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
