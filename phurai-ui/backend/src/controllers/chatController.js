import { getRawPool } from '../db.js';
import { generateAIResponse } from '../services/aiService.js';

export const processChatMessage = async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ success: false, message: "Invalid message format" });
        }

        const pool = await getRawPool();
        
        // --- 1. Gather Real-Time Database Stats ---
        
        // 1.1 Revenue Today
        const revTodayResult = await pool.request().query(`
            SELECT ISNULL(SUM(p.amount_paid), 0) AS total
            FROM dbo.Payments p
            WHERE p.payment_status = N'Completed'
              AND CAST(p.paid_at AS DATE) = CAST(SYSDATETIME() AS DATE)
        `);
        const revenueToday = revTodayResult.recordset[0].total;

        // 1.2 Table Status
        const tableResult = await pool.request().query(`
            SELECT 
                SUM(CASE WHEN t.table_status IN (N'Occupied', N'Reserved') THEN 1 ELSE 0 END) AS occupied,
                SUM(CASE WHEN t.table_status = N'Available' THEN 1 ELSE 0 END) AS available,
                COUNT(*) as total
            FROM dbo.RestaurantTables t
            JOIN dbo.RestaurantAreas a ON t.area_id = a.area_id
            WHERE a.is_active = 1 AND t.table_status <> N'Inactive'
        `);
        const { occupied, available, total: totalTables } = tableResult.recordset[0];

        // 1.3 Reservations Today
        const resResult = await pool.request().query(`
            SELECT COUNT(*) as count
            FROM dbo.Reservations
            WHERE CAST(reservation_start_at AS DATE) = CAST(SYSDATETIME() AS DATE)
        `);
        const reservationsToday = resResult.recordset[0].count;

        // 1.4 Best Seller Today
        const bestSellerResult = await pool.request().query(`
            SELECT TOP 1 d.dish_name, SUM(oi.quantity) AS qty
            FROM dbo.OrderItems oi
            JOIN dbo.Orders o ON oi.order_id = o.order_id
            JOIN dbo.Dishes d ON oi.dish_id = d.dish_id
            WHERE o.order_status <> N'Cancelled'
              AND CAST(o.created_at AS DATE) = CAST(SYSDATETIME() AS DATE)
            GROUP BY d.dish_id, d.dish_name
            ORDER BY qty DESC
        `);
        const bestSellerStr = bestSellerResult.recordset.length > 0 
            ? `${bestSellerResult.recordset[0].dish_name} (${bestSellerResult.recordset[0].qty} portions)`
            : "No items ordered yet";

        // 1.5 Active Orders & Kitchen
        const ordersResult = await pool.request().query(`
            SELECT COUNT(*) as count FROM dbo.Orders WHERE order_status IN (N'Open', N'Sent To Kitchen', N'Partially Served')
        `);
        const kitchenResult = await pool.request().query(`
            SELECT COUNT(*) as count FROM dbo.KitchenTickets WHERE kitchen_status IN (N'Pending', N'Preparing')
        `);
        const activeOrders = ordersResult.recordset[0].count;
        const pendingKitchen = kitchenResult.recordset[0].count;

        // 1.6 Reviews
        const reviewResult = await pool.request().query(`
            SELECT ISNULL(ROUND(AVG(CAST(overall_rating AS FLOAT)), 1), 0) AS avg_rating, COUNT(*) as count
            FROM dbo.CustomerReviews WHERE is_visible = 1
        `);
        const { avg_rating, count: reviewCount } = reviewResult.recordset[0];

        // --- 2. Build Context for AI ---
        const systemPrompt = `
You are a premium AI assistant specializing in supporting the Executive Director (Manager) of Phūrai Premium Restaurant.
You MUST reply strictly in Vietnamese, utilizing specialized F&B (Food & Beverage), business administration, and fine-dining restaurant management language.
Your mission is to answer all questions from the Manager regarding business operations, staffing, menu, revenue, and restaurant management.

[SUPREME IMPORTANT RULES]
1. REFUSE TO ANSWER IMMEDIATELY if the question is NOT RELATED to the restaurant industry, culinary arts, hospitality management, or the Phūrai system (e.g., coding, general mathematics, general history...). Refuse politely and propose returning to F&B expertise.
2. ALWAYS analyze issues in a detailed, coherent, and direct manner, straight to the point without being verbose.
3. USE OPTIMIZED TERMINOLOGY AND SPECIALIZED F&B VOCABULARY (e.g., cost optimization, profit margin, customer experience, up-selling, cross-selling, COGS, turnover rate, SOP workflows...) to demonstrate professionalism.
4. Fully leverage the real-time data provided below to deliver strategic insights or advice like a real F&B consultant.

[Today's Real-time Data]
- Revenue today: ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(revenueToday)}
- Reservations today: ${reservationsToday} turns
- Available tables: ${available} / Total ${totalTables} tables (Occupied/Booked: ${occupied})
- Best-selling dish today: ${bestSellerStr}
- Active open orders: ${activeOrders}
- Dishes pending kitchen processing: ${pendingKitchen} portions
- Average rating: ${avg_rating}/5.0 (from ${reviewCount} reviews)

[Internal Data (History & Operations)]
- April: Revenue 1,250,000,000 VND. Growth driven by Signature Menu & Acoustic nights. Profit margin: 62%.
- May: Revenue 1,420,000,000 VND. Breakthrough driven by 15 Private VIP Events. Profit margin: 65%.
- Average operating cost (COGS, Personnel, Rent, Marketing): ~400,000,000 VND/month.
- Target profit margin: 60 - 65%.
- Top 3 primary Signature dishes: stone-grilled A5 Wagyu beef, butter garlic Alaska lobster, Chateau Margaux red wine.
- Personnel (45 people): 15 Kitchen, 20 Servers, 5 Receptionists, 5 Managers.

Based on the rules above, please answer the Manager's question below:
"${message}"
`;

        // --- 3. Call AI ---
        const reply = await generateAIResponse(systemPrompt);

        return res.status(200).json({ success: true, reply });

    } catch (error) {
        console.error('[chatController] processChatMessage error:', error);
        return res.status(500).json({ success: false, message: 'Server error processing chat', reply: "Sorry, I am having trouble connecting to the AI system or the database." });
    }
};
