import sql from 'mssql';
import { getRawPool } from './src/db.js';

async function test() {
    const pool = await getRawPool();
    try {
        await pool.query("CREATE TABLE TestBulk (id INT IDENTITY(1,1), name VARCHAR(50))");
        const table = new sql.Table('TestBulk');
        table.create = false;
        table.columns.add('id', sql.Int);
        table.columns.add('name', sql.VarChar(50));
        table.rows.add(10, 'Test');
        const req = new sql.Request(pool);
        await req.bulk(table, { keepNulls: true }); // Wait, mssql exposes keepIdentity? Let's check both
        console.log("Success with default bulk");
    } catch(e) {
        console.log("Error with default bulk:", e.message);
    }
    
    try {
        const table2 = new sql.Table('TestBulk');
        table2.create = false;
        table2.columns.add('id', sql.Int);
        table2.columns.add('name', sql.VarChar(50));
        table2.rows.add(11, 'Test2');
        const req2 = new sql.Request(pool);
        await req2.bulk(table2, { keepNulls: true, keepIdentity: true }); // Let's test if keepIdentity exists
        console.log("Success with keepIdentity: true");
    } catch(e) {
        console.log("Error with keepIdentity:", e.message);
    }

    await pool.query("DROP TABLE TestBulk");
    process.exit(0);
}
test();
