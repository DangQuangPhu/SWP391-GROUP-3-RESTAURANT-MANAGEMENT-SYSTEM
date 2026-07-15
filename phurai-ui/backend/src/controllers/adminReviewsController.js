import { getRawPool } from '../db.js';
import sql from 'mssql';

export const getPaginatedReviews = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', rating = '', startDate, endDate } = req.query;
        const pageNumber = parseInt(page, 10);
        const pageSize = parseInt(limit, 10);
        const offset = (pageNumber - 1) * pageSize;

        const pool = await getRawPool();
        
        let baseQuery = `
            FROM dbo.CustomerReviews r
            LEFT JOIN dbo.UserAccounts u ON r.customer_id = u.user_id
            WHERE 1=1
        `;

        const applyParams = (req) => {
            if (search) {
                req.input('search', sql.NVarChar(255), `%${search}%`);
            }
            if (rating) {
                req.input('rating', sql.TinyInt, parseInt(rating, 10));
            }
            if (startDate) {
                req.input('startDate', sql.DateTime2, startDate);
            }
            if (endDate) {
                const inclusiveEnd = endDate.includes('T') ? endDate : `${endDate} 23:59:59`;
                req.input('endDate', sql.DateTime2, inclusiveEnd);
            }
        };

        if (search) baseQuery += ` AND (u.full_name LIKE @search OR r.comment LIKE @search) `;
        if (rating) baseQuery += ` AND r.overall_rating = @rating `;
        if (startDate && endDate) {
            baseQuery += ` AND r.created_at >= @startDate AND r.created_at <= @endDate `;
        }

        // Get total count
        const countRequest = pool.request();
        applyParams(countRequest);
        const countResult = await countRequest.query(`SELECT COUNT(*) as total ${baseQuery}`);
        const total = countResult.recordset[0].total;

        const dataQuery = `
            SELECT 
                r.review_id, r.reservation_id, r.customer_id, r.order_id, r.overall_rating, r.food_rating, r.service_rating, r.ambiance_rating,
                r.comment, r.is_visible, r.created_at,
                u.full_name as customer_name,
                (SELECT TOP 1 reservation_start_at FROM dbo.Reservations WHERE reservation_id = r.reservation_id) as reservation_date
            ${baseQuery}
            ORDER BY r.created_at DESC
            OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY
        `;

        const dataRequest = pool.request();
        applyParams(dataRequest);
        const dataResult = await dataRequest.query(dataQuery);

        return res.json({
            success: true,
            data: dataResult.recordset,
            pagination: {
                total,
                page: pageNumber,
                limit: pageSize,
                totalPages: Math.ceil(total / pageSize)
            }
        });

    } catch (error) {
        console.error('[adminReviewsController] getPaginatedReviews error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};
