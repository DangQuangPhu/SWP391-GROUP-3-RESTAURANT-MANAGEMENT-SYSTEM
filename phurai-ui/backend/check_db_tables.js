import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const config = {
  server: process.env.DB_SERVER || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_DATABASE || 'System_Restaurant',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Phudeptrai@',
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
  }
};

async function run() {
  try {
    const pool = await sql.connect(config);
    console.log("Connected to DB successfully!");
    
    // Check tables count
    const result = await pool.request().query("SELECT * FROM dbo.Tables");
    console.log("Tables in DB:", result.recordset);
    console.log("Total tables count:", result.recordset.length);
    
    await pool.close();
  } catch (err) {
    console.error("DB Error:", err);
  }
}

run();
