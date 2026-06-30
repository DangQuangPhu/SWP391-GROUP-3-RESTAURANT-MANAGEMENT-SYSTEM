const fs = require('fs');
const path = require('path');

const scriptPath = path.join(__dirname, 'System_Restaurant.sql');
const sqlToAppend = `

-- ====================================================================================
-- SCRIPT TỰ ĐỘNG TẠO DỮ LIỆU GIẢ LẬP (MOCK DATA) CHO 60 NGÀY QUA DÀNH CHO BẢNG ĐIỀU KHIỂN
-- ====================================================================================

-- 1. Xóa dữ liệu giả lập cũ (nếu có) để tránh trùng lặp
DELETE FROM dbo.KitchenTickets WHERE order_item_id IN (SELECT order_item_id FROM dbo.OrderItems WHERE order_id IN (SELECT order_id FROM dbo.Orders WHERE order_note = N'AutoMock'));
DELETE FROM dbo.Payments WHERE order_id IN (SELECT order_id FROM dbo.Orders WHERE order_note = N'AutoMock');
DELETE FROM dbo.OrderItems WHERE order_id IN (SELECT order_id FROM dbo.Orders WHERE order_note = N'AutoMock');
DELETE FROM dbo.Orders WHERE order_note = N'AutoMock';
DELETE FROM dbo.Reservations WHERE contact_name LIKE N'AutoMock%';

-- 2. Khai báo biến vòng lặp
DECLARE @days_ago INT = 60;
DECLARE @current_date DATETIME2;
DECLARE @daily_orders INT;
DECLARE @random_rev DECIMAL(12,2);
DECLARE @res_count INT;
DECLARE @i INT;
DECLARE @order_id INT;
DECLARE @order_item_id INT;

WHILE @days_ago >= 0
BEGIN
    SET @current_date = DATEADD(day, -@days_ago, SYSDATETIME());
    
    -- Tạo 10-20 đơn hàng mỗi ngày
    SET @daily_orders = FLOOR(RAND() * 11) + 10;
    
    -- Tạo 2-5 đặt bàn mỗi ngày
    SET @res_count = FLOOR(RAND() * 4) + 2;
    
    SET @i = 0;
    WHILE @i < @res_count
    BEGIN
        INSERT INTO dbo.Reservations (contact_name, contact_phone, reservation_start_at, guest_count, reservation_status, created_at, updated_at)
        VALUES (N'AutoMock ' + CAST(@days_ago AS NVARCHAR) + '-' + CAST(@i AS NVARCHAR), '0900000000', 
                DATEADD(hour, 19, CAST(CAST(@current_date AS DATE) AS DATETIME2)), 
                FLOOR(RAND() * 4) + 2, 
                CASE WHEN @days_ago > 0 THEN N'Completed' ELSE N'Dining' END, 
                @current_date, @current_date);
        SET @i = @i + 1;
    END

    SET @i = 0;
    WHILE @i < @daily_orders
    BEGIN
        SET @random_rev = FLOOR(RAND() * 1500000) + 500000;
        
        INSERT INTO dbo.Orders (table_id, order_type, order_status, order_note, subtotal, discount_amount, service_charge, total_amount, amount_paid, created_at, updated_at)
        VALUES (1, N'Dine In', CASE WHEN @days_ago > 0 THEN N'Paid' ELSE N'Sent To Kitchen' END, N'AutoMock', @random_rev, 0, 0, @random_rev, @random_rev, @current_date, @current_date);
        
        SET @order_id = SCOPE_IDENTITY();

        INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, item_status, created_at, updated_at)
        VALUES (@order_id, FLOOR(RAND() * 5) + 1, FLOOR(RAND() * 3) + 1, 100000, N'Served', @current_date, @current_date);
        
        SET @order_item_id = SCOPE_IDENTITY();

        IF @days_ago > 0
        BEGIN
            INSERT INTO dbo.Payments (order_id, payment_method_id, amount_paid, change_given, payment_status, paid_at, created_at, updated_at)
            VALUES (@order_id, 1, @random_rev, 0, N'Completed', @current_date, @current_date, @current_date);
        END
        ELSE
        BEGIN
            -- Nếu là ngày hôm nay, giả lập có bếp đang làm
            INSERT INTO dbo.KitchenTickets (order_item_id, kitchen_status, priority_level, sent_at)
            VALUES (@order_item_id, N'Preparing', 2, @current_date);
        END

        SET @i = @i + 1;
    END

    SET @days_ago = @days_ago - 1;
END
GO
`;

fs.appendFileSync(scriptPath, sqlToAppend, 'utf8');
console.log('Appended successfully');
