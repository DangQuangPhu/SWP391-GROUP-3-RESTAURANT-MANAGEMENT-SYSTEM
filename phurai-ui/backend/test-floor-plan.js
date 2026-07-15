import { getRawPool } from './src/db.js';

async function test() {
    try {
        const pool = await getRawPool();
        const result = await pool.request().query(`
            SELECT 
                a.area_id, a.area_name, a.area_type,
                t.table_id, t.table_number, t.capacity, t.is_counter, 
                CAST(CASE WHEN t.table_status = 'Inactive' THEN 0 ELSE 1 END AS BIT) as table_active, 
                t.table_status
            FROM dbo.RestaurantAreas a
            LEFT JOIN dbo.RestaurantTables t ON a.area_id = t.area_id AND t.table_status != 'Inactive'
            WHERE a.is_active = 1
            ORDER BY a.area_id, LEN(t.table_number), t.table_number
        `);
        console.log("Success", result.recordset.length);
    } catch(err) {
        console.error("Error:", err.message);
    }
    process.exit(0);
}
test();
