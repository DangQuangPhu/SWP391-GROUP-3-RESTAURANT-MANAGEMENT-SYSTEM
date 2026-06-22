import { getRawPool } from './db.js';

async function checkTriggers() {
    try {
        const pool = await getRawPool();
        const result = await pool.request().query(`
            SELECT 
                t.name AS trigger_name,
                o.name AS table_name,
                m.definition
            FROM sys.triggers t
            INNER JOIN sys.objects o ON t.parent_id = o.object_id
            INNER JOIN sys.sql_modules m ON t.object_id = m.object_id
        `);
        console.log("Triggers:", JSON.stringify(result.recordset, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkTriggers();
