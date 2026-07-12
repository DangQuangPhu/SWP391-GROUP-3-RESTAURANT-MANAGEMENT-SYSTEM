import { getRawPool } from '../db.js';

// GET /api/admin/analytics/reservations
export const getReservationsAnalytics = async (req, res) => {
    try {
        const pool = await getRawPool();
        const result = await pool.request().query(`
            SELECT reservation_status, COUNT(*) as count 
            FROM dbo.Reservations 
            GROUP BY reservation_status
        `);
        return res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('[adminAnalyticsController] getReservationsAnalytics error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

// GET /api/admin/analytics/revenue
export const getRevenueAnalytics = async (req, res) => {
    try {
        const pool = await getRawPool();
        const result = await pool.request().query(`
            SELECT CAST(paid_at AS DATE) as date, ISNULL(SUM(amount_paid), 0) as daily_revenue 
            FROM dbo.Payments 
            WHERE payment_status = 'Completed'
            GROUP BY CAST(paid_at AS DATE) 
            ORDER BY date DESC
        `);
        return res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('[adminAnalyticsController] getRevenueAnalytics error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

// GET /api/admin/analytics/orders
export const getOrdersAnalytics = async (req, res) => {
    try {
        const pool = await getRawPool();
        const result = await pool.request().query(`
            SELECT order_status, COUNT(*) as count, ISNULL(AVG(total_amount), 0) as avg_value 
            FROM dbo.Orders 
            GROUP BY order_status
        `);
        return res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('[adminAnalyticsController] getOrdersAnalytics error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

// GET /api/admin/analytics/reviews
export const getReviewsAnalytics = async (req, res) => {
    try {
        const pool = await getRawPool();
        const result = await pool.request().query(`
            SELECT overall_rating, COUNT(*) as count 
            FROM dbo.CustomerReviews 
            GROUP BY overall_rating
        `);
        return res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('[adminAnalyticsController] getReviewsAnalytics error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

// GET /api/admin/analytics/staff-performance
export const getStaffPerformanceAnalytics = async (req, res) => {
    try {
        const pool = await getRawPool();
        const result = await pool.request().query(`
            SELECT sp.staff_code, COUNT(s.log_id) as total_shifts 
            FROM dbo.StaffProfiles sp 
            LEFT JOIN dbo.ShiftLogs s ON sp.user_id = s.staff_user_id 
            GROUP BY sp.staff_code
        `);
        return res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('[adminAnalyticsController] getStaffPerformanceAnalytics error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

/**
 * GET /api/admin/analytics/overview
 * UC-A04 — Admin analytics overview: a single endpoint returning the full dashboard payload.
 */
export const getAdminOverview = async (req, res) => {
    try {
        const pool = await getRawPool();

        const [revenueRes, orderStatusRes, reservationStatusRes, topDishesRes, reviewRes, staffRes, tableRes] = await Promise.all([
            // Revenue: last 30 days + all time
            pool.request().query(`
                SELECT
                    ISNULL(SUM(CASE WHEN paid_at >= DATEADD(day, -30, SYSDATETIME()) THEN amount_paid ELSE 0 END), 0) AS revenue_30d,
                    ISNULL(SUM(amount_paid), 0) AS revenue_all_time
                FROM dbo.Payments
                WHERE payment_status = N'Completed'
            `),
            // Orders breakdown by status
            pool.request().query(`
                SELECT order_status, COUNT(*) AS count, ISNULL(AVG(total_amount), 0) AS avg_value
                FROM dbo.Orders
                GROUP BY order_status
            `),
            // Reservations breakdown by status
            pool.request().query(`
                SELECT reservation_status, COUNT(*) AS count
                FROM dbo.Reservations
                GROUP BY reservation_status
            `),
            // Top 5 dishes by order count (all time)
            pool.request().query(`
                SELECT TOP 5
                    d.dish_id,
                    d.dish_name,
                    mc.category_name,
                    SUM(oi.quantity) AS total_ordered,
                    ISNULL(SUM(oi.quantity * oi.unit_price), 0) AS total_revenue
                FROM dbo.OrderItems oi
                JOIN dbo.Dishes d ON oi.dish_id = d.dish_id
                JOIN dbo.MenuCategories mc ON d.category_id = mc.category_id
                JOIN dbo.Orders o ON oi.order_id = o.order_id
                WHERE o.order_status NOT IN (N'Cancelled')
                GROUP BY d.dish_id, d.dish_name, mc.category_name
                ORDER BY total_ordered DESC
            `),
            // Reviews: average + distribution
            pool.request().query(`
                SELECT
                    ISNULL(AVG(CAST(overall_rating AS DECIMAL(4,2))), 0) AS average_rating,
                    COUNT(*) AS total_reviews
                FROM dbo.CustomerReviews
                WHERE is_visible = 1
            `),
            // Active staff count
            pool.request().query(`
                SELECT COUNT(*) AS active_staff_count
                FROM dbo.UserAccounts ua
                JOIN dbo.Roles r ON ua.role_id = r.role_id
                WHERE ua.is_active = 1
                  AND r.role_name IN (N'Restaurant Staff', N'Manager')

            `),
            // Table occupancy
            pool.request().query(`
                SELECT
                    COUNT(*) AS total_tables,
                    SUM(CASE WHEN table_status = N'Occupied' THEN 1 ELSE 0 END) AS occupied_tables,
                    SUM(CASE WHEN table_status = N'Available' THEN 1 ELSE 0 END) AS available_tables,
                    SUM(CASE WHEN table_status = N'Reserved' THEN 1 ELSE 0 END) AS reserved_tables,
                    SUM(CASE WHEN table_status = N'Cleaning' THEN 1 ELSE 0 END) AS cleaning_tables
                FROM dbo.RestaurantTables
            `)
        ]);

        return res.json({
            success: true,
            data: {
                revenue: revenueRes.recordset[0],
                orders: orderStatusRes.recordset,
                reservations: reservationStatusRes.recordset,
                top_dishes: topDishesRes.recordset,
                reviews: reviewRes.recordset[0],
                staff: staffRes.recordset[0],
                tables: tableRes.recordset[0]
            }
        });
    } catch (error) {
        console.error('[adminAnalyticsController] getAdminOverview error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};
