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
            ? `${bestSellerResult.recordset[0].dish_name} (${bestSellerResult.recordset[0].qty} phần)`
            : "Chưa có món nào được gọi";

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
Bạn là trợ lý AI thông minh chuyên hỗ trợ Quản lý (Manager) của nhà hàng cao cấp Phūrai Premium Restaurant.
Tuyệt đối chỉ trả lời bằng tiếng Việt, ngôn ngữ chuyên nghiệp, lịch sự và rõ ràng.
Nhiệm vụ của bạn là giải đáp các thắc mắc của Manager về hoạt động kinh doanh dựa trên dữ liệu hiện tại và dữ liệu lịch sử dưới đây.

[Dữ liệu Thực Tế Hôm Nay]
- Doanh thu hôm nay: ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(revenueToday)}
- Số lượng đặt bàn hôm nay: ${reservationsToday} lượt
- Bàn trống: ${available} / Tổng số ${totalTables} bàn (Đang dùng/Đã đặt: ${occupied})
- Món bán chạy nhất hôm nay: ${bestSellerStr}
- Đơn hàng đang mở: ${activeOrders}
- Món ăn đang chờ bếp xử lý: ${pendingKitchen} phần
- Điểm đánh giá trung bình: ${avg_rating}/5.0 (từ ${reviewCount} đánh giá)

[Dữ liệu Ảo (Lịch sử & Hoạt động)]
Giả sử nhà hàng đã khai trương và hoạt động được đúng 1 năm.
Dưới đây là Báo cáo Doanh Thu 2 tháng trước (Tháng 4 và Tháng 5 năm ngoái/hoặc tháng gần nhất):
- Tháng 4: Đạt 1.250.000.000 VNĐ. Nguyên nhân tăng trưởng là do ra mắt menu mới (các món Signature) và tổ chức các đêm nhạc Acoustic. Tỷ suất lợi nhuận đạt 62%.
- Tháng 5: Đạt 1.420.000.000 VNĐ. Tăng trưởng bứt phá nhờ việc chốt được 15 tiệc VIP Private Events và các sự kiện sinh nhật/kỷ niệm. Tỷ suất lợi nhuận đạt 65%.
- Chi phí vận hành trung bình (Cost of Goods, Nhân sự, Mặt bằng, Marketing): ~400.000.000 VNĐ/tháng.
- Lợi nhuận biên trung bình: 60 - 65%.
- Top 3 món Signature đóng góp doanh thu cao nhất lịch sử: Bò Wagyu A5 nướng đá muối, Tôm hùm Alaska sốt bơ tỏi, Rượu vang đỏ Chateau Margaux.
- Tổng số nhân sự: 45 người (15 bếp, 20 phục vụ, 5 lễ tân, 5 quản lý).

Hãy sử dụng các dữ liệu này để trả lời câu hỏi của Manager. Nếu Manager hỏi về doanh thu hoặc báo cáo, hãy phân tích một cách chi tiết, liệt kê rõ ràng các số liệu và đưa ra lời khuyên hoặc nhận định ngắn gọn như một chuyên gia quản trị F&B.

Câu hỏi của Manager: "${message}"
`;

        // --- 3. Call AI ---
        const reply = await generateAIResponse(systemPrompt);

        return res.status(200).json({ success: true, reply });

    } catch (error) {
        console.error('[chatController] processChatMessage error:', error);
        return res.status(500).json({ success: false, message: 'Server error processing chat', reply: "Xin lỗi, mình đang gặp sự cố khi kết nối tới hệ thống AI hoặc cơ sở dữ liệu." });
    }
};
