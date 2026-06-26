import 'dotenv/config';
import sql from 'mssql';

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: false, 
        trustServerCertificate: true,
        connectTimeout: 30000,
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
};

async function checkConstraint() {
    try {
        await sql.connect(config);
        const result = await sql.query(`
            SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.CK_Reservations_status')) AS constraint_def
        `);
        console.log("CONSTRAINT DEFINITION:");
        console.log(result.recordset[0].constraint_def);
    } catch (err) {
        console.error("DB Error:", err);
    } finally {
        process.exit(0);
    }
}

checkConstraint();
