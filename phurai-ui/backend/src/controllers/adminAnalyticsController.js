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
