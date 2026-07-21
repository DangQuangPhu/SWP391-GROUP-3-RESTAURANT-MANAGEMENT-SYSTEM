/**
 * recommendationController.js
 * UC-CU08 \u2014 Dish Recommendations for logged-in customers.
 *
 * Strategy:
 *  1. Personal history: top dishes the customer has previously ordered.
 *  2. Global best-sellers: fill remaining slots from globally popular dishes.
 *  3. Results are written to dbo.RecommendationLogs.
 */

import { getRawPool } from '../db.js';
import sql from 'mssql';

/**
 * GET /api/customer/recommendations?limit=6
 * Auth: requireCustomer (role_id = 1)
 */
export const getRecommendations = async (req, res) => {
    const customerId = req.user?.user_id;
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 6));

    if (!customerId) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    try {
        const pool = await getRawPool();

        // Step 1: Personal order history for this customer
        const personalRes = await pool.request()
            .input('customerId', sql.Int, customerId)
            .input('limit', sql.Int, limit)
            .query(`
                SELECT TOP (@limit)
                    d.dish_id,
                    d.dish_name,
                    mc.category_name AS category,
                    d.price,
                    d.description,
                    d.spicy_level,
                    d.is_available,
                    d.is_recommended,
                    MAX(CONCAT('/api/dishes/', d.dish_id, '/image')) AS image_url,
                    SUM(oi.quantity) AS order_count,
                    N'personal_history' AS source
                FROM dbo.OrderItems oi
                JOIN dbo.Orders o ON oi.order_id = o.order_id
                JOIN dbo.Dishes d ON oi.dish_id = d.dish_id
                JOIN dbo.MenuCategories mc ON d.category_id = mc.category_id
                WHERE o.customer_id = @customerId
                  AND o.order_status NOT IN (N'Cancelled')
                  AND d.is_available = 1
                GROUP BY d.dish_id, d.dish_name, mc.category_name, d.price, d.description,
                         d.spicy_level, d.is_available, d.is_recommended
                ORDER BY order_count DESC
            `);

        const personalDishes = personalRes.recordset;
        const personalIds = personalDishes.map(d => d.dish_id);
        const remaining = limit - personalDishes.length;

        let globalDishes = [];

        // Step 2: Fill remainder with global best-sellers (excluding already-recommended)
        if (remaining > 0) {
            const excludeClause = personalIds.length > 0
                ? `AND d.dish_id NOT IN (${personalIds.join(',')})`
                : '';

            const globalRes = await pool.request()
                .input('limit', sql.Int, remaining)
                .query(`
                    SELECT TOP (@limit)
                        d.dish_id,
                        d.dish_name,
                        mc.category_name AS category,
                        d.price,
                        d.description,
                        d.spicy_level,
                        d.is_available,
                        d.is_recommended,
                        MAX(CONCAT('/api/dishes/', d.dish_id, '/image')) AS image_url,
                        ISNULL(SUM(oi.quantity), 0) AS order_count,
                        N'global_bestseller' AS source
                    FROM dbo.Dishes d
                    JOIN dbo.MenuCategories mc ON d.category_id = mc.category_id
                    LEFT JOIN dbo.OrderItems oi ON d.dish_id = oi.dish_id
                    LEFT JOIN dbo.Orders o ON oi.order_id = o.order_id AND o.order_status NOT IN (N'Cancelled')
                    WHERE d.is_available = 1
                      ${excludeClause}
                    GROUP BY d.dish_id, d.dish_name, mc.category_name, d.price, d.description,
                             d.spicy_level, d.is_available, d.is_recommended
                    ORDER BY order_count DESC, d.is_recommended DESC
                `);

            globalDishes = globalRes.recordset;
        }

        const recommendations = [...personalDishes, ...globalDishes];

        // Step 3: Log to RecommendationLogs (fire-and-forget, don't fail on error)
        try {
            for (const dish of recommendations) {
                await pool.request()
                    .input('customerId', sql.Int, customerId)
                    .input('dishId', sql.Int, dish.dish_id)
                    .input('source', sql.NVarChar(50), dish.source)
                    .query(`
                        INSERT INTO dbo.RecommendationLogs (customer_id, dish_id, recommended_at, source)
                        VALUES (@customerId, @dishId, SYSDATETIME(), @source)
                    `);
            }
        } catch (logErr) {
            // Non-fatal: just warn
            console.warn('[recommendationController] Failed to log recommendations:', logErr.message);
        }

        return res.json({
            success: true,
            data: recommendations.map(d => ({
                dish_id: d.dish_id,
                dish_name: d.dish_name,
                category: d.category,
                price: d.price,
                description: d.description,
                spicy_level: d.spicy_level,
                is_available: Boolean(d.is_available),
                is_recommended: Boolean(d.is_recommended),
                image_url: d.image_url || null,
                order_count: Number(d.order_count),
                source: d.source
            }))
        });

    } catch (error) {
        console.error('[recommendationController] getRecommendations error:', error);
        return res.status(500).json({ success: false, message: 'Failed to get recommendations.', error: error.message });
    }
};
