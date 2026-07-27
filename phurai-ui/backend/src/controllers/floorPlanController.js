import { getRawPool } from '../db.js';

export const getFloorPlanData = async (req, res) => {
    try {
        const pool = await getRawPool();
        const result = await pool.request().query(`
            SELECT 
                a.area_id, a.area_name, a.area_type,
                t.table_id, t.table_number, t.capacity, t.is_counter, 
                CAST(CASE WHEN t.table_status = 'Inactive' THEN 0 ELSE 1 END AS BIT) as table_active, 
                t.table_status, t.position_x, t.position_y
            FROM dbo.RestaurantAreas a
            LEFT JOIN dbo.RestaurantTables t ON a.area_id = t.area_id AND (t.table_status IS NULL OR t.table_status != 'Deleted')
            WHERE a.is_active = 1
            ORDER BY a.area_id, LEN(t.table_number), t.table_number
        `);

        // Group into structured JSON
        const areasMap = new Map();
        
        result.recordset.forEach(row => {
            if (!areasMap.has(row.area_id)) {
                areasMap.set(row.area_id, {
                    area_id: row.area_id,
                    area_name: row.area_name,
                    area_type: row.area_type,
                    tables: []
                });
            }
            if (row.table_id != null) {
                areasMap.get(row.area_id).tables.push({
                    table_id: row.table_id,
                    table_number: row.table_number,
                    capacity: row.capacity,
                    is_counter: !!row.is_counter,
                    table_status: row.table_status,
                    is_active: !!row.table_active,
                    position_x: row.position_x,
                    position_y: row.position_y
                });
            }
        });

        const areas = Array.from(areasMap.values());
        
        return res.json({ success: true, data: areas });
    } catch (error) {
        console.error('[floorPlanController] getFloorPlanData error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error fetching floor plan.', error: error.message });
    }
};
