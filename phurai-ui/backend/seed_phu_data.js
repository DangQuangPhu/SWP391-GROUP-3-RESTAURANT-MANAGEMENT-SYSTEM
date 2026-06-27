import pool from "./src/db.js";

const sql = `
-- SQL script to seed dummy data for all user accounts named "Dang Quang Phu"
-- This will populate the Customer Dashboard and Loyalty Points screen with actual data!

BEGIN TRANSACTION;

-- Create a temporary table to store the user IDs of "Dang Quang Phu"
DECLARE @PhuUsers TABLE (user_id INT);
INSERT INTO @PhuUsers (user_id)
SELECT user_id FROM dbo.UserAccounts WHERE full_name LIKE N'Dang%Quang%Phu';

-- Clean up and normalize the name in the database to exactly one space
UPDATE dbo.UserAccounts
SET full_name = N'Dang Quang Phu'
WHERE user_id IN (SELECT user_id FROM @PhuUsers);

-- CLEAN UP previous seed data to avoid duplicates or index errors
DELETE FROM dbo.OrderItems WHERE order_id IN (SELECT order_id FROM dbo.Orders WHERE customer_id IN (SELECT user_id FROM @PhuUsers));
DELETE FROM dbo.Payments WHERE order_id IN (SELECT order_id FROM dbo.Orders WHERE customer_id IN (SELECT user_id FROM @PhuUsers));
DELETE FROM dbo.Orders WHERE customer_id IN (SELECT user_id FROM @PhuUsers);
DELETE FROM dbo.Reservations WHERE customer_id IN (SELECT user_id FROM @PhuUsers);
DELETE FROM dbo.CustomerVouchers WHERE customer_id IN (SELECT user_id FROM @PhuUsers);
DELETE FROM dbo.LoyaltyTransactions WHERE customer_id IN (SELECT user_id FROM @PhuUsers);

-- 1. Ensure a CustomerProfile exists for each Phu user
MERGE dbo.CustomerProfiles AS target
USING @PhuUsers AS source
ON target.user_id = source.user_id
WHEN NOT MATCHED THEN
    INSERT (user_id, username, date_of_birth, gender, country, [language], bio, loyalty_points, preferences)
    VALUES (source.user_id, N'phu_customer_' + CAST(source.user_id AS NVARCHAR(10)), '2004-09-08', N'Male', N'Vietnam', N'Vietnamese', N'CEO & Regular VIP customer.', 1010, N'["VIP area","Window seat","Steak"]');

-- Update loyalty points to 1010 so he has Gold status and can redeem vouchers
UPDATE target
SET target.loyalty_points = 1010
FROM dbo.CustomerProfiles target
INNER JOIN @PhuUsers source ON target.user_id = source.user_id;

-- 2. Insert Loyalty Point Transactions (so the user sees points history)
-- We will insert Earn and Redeem transactions
INSERT INTO dbo.LoyaltyTransactions (customer_id, points, transaction_type, reference_type, description, created_at)
SELECT source.user_id, 350, N'Earn', N'Payment', N'Points earned from order payment', DATEADD(day, -15, GETDATE())
FROM @PhuUsers source;

INSERT INTO dbo.LoyaltyTransactions (customer_id, points, transaction_type, reference_type, description, created_at)
SELECT source.user_id, 760, N'Earn', N'Payment', N'Points earned from premium dining', DATEADD(day, -5, GETDATE())
FROM @PhuUsers source;

INSERT INTO dbo.LoyaltyTransactions (customer_id, points, transaction_type, reference_type, description, created_at)
SELECT source.user_id, -100, N'Redeem', N'VoucherRedeem', N'Redeemed 50K Voucher', DATEADD(day, -2, GETDATE())
FROM @PhuUsers source;

-- 3. Insert Vouchers into CustomerVouchers (so the user has active and used vouchers)
INSERT INTO dbo.CustomerVouchers (customer_id, promotion_id, points_spent, voucher_code, status, redeemed_at, expires_at)
SELECT source.user_id, 4, 100, N'PHU50K_' + CAST(source.user_id AS NVARCHAR(10)), N'active', DATEADD(day, -2, GETDATE()), DATEADD(day, 28, GETDATE())
FROM @PhuUsers source;

-- 4. Insert 6-Month Spread of Reservations, Orders, Payments, and OrderItems
-- This creates a beautiful wave-like curve in the Expenditure chart!

DECLARE @TableId INT = 1;

-- ==========================================
-- MONTH 5 AGO (5 months ago)
-- ==========================================
INSERT INTO dbo.Reservations (customer_id, contact_name, contact_phone, contact_email, preferred_area_id, reservation_start_at, reservation_end_at, guest_count, special_request, deposit_amount, final_total, reservation_status, created_at)
SELECT source.user_id, N'Dang Quang Phu', '0901000001', N'phuadmin@phurai.vn', 1, DATEADD(month, -5, GETDATE()), DATEADD(month, -5, DATEADD(hour, 2, GETDATE())), 4, N'Window seat please', 100000.00, 1489000.00, N'Completed', DATEADD(month, -5, DATEADD(day, -5, GETDATE()))
FROM @PhuUsers source;

INSERT INTO dbo.Orders (reservation_id, table_id, customer_id, order_type, order_status, subtotal, discount_amount, service_charge, total_amount, amount_paid, created_at)
SELECT 
    (SELECT TOP 1 reservation_id FROM dbo.Reservations WHERE customer_id = source.user_id AND DATEPART(month, reservation_start_at) = DATEPART(month, DATEADD(month, -5, GETDATE()))),
    @TableId,
    source.user_id,
    N'Dine In',
    N'Paid',
    1489000.00,
    100000.00,
    50000.00,
    1439000.00,
    1439000.00,
    DATEADD(month, -5, GETDATE())
FROM @PhuUsers source;

INSERT INTO dbo.Payments (order_id, payment_method_id, amount_paid, change_given, payment_status, paid_at, created_at)
SELECT 
    (SELECT TOP 1 order_id FROM dbo.Orders WHERE customer_id = source.user_id AND DATEPART(month, created_at) = DATEPART(month, DATEADD(month, -5, GETDATE()))),
    1, 
    1439000.00,
    0,
    N'Completed',
    DATEADD(month, -5, GETDATE()),
    DATEADD(month, -5, GETDATE())
FROM @PhuUsers source;

INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, notes, item_status)
SELECT o.order_id, 13, 1, 890000.00, N'Medium-rare', N'Served'
FROM dbo.Orders o JOIN @PhuUsers pu ON o.customer_id = pu.user_id WHERE DATEPART(month, o.created_at) = DATEPART(month, DATEADD(month, -5, GETDATE()));

INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, notes, item_status)
SELECT o.order_id, 9, 1, 499000.00, N'', N'Served'
FROM dbo.Orders o JOIN @PhuUsers pu ON o.customer_id = pu.user_id WHERE DATEPART(month, o.created_at) = DATEPART(month, DATEADD(month, -5, GETDATE()));

INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, notes, item_status)
SELECT o.order_id, 15, 1, 98000.00, N'', N'Served'
FROM dbo.Orders o JOIN @PhuUsers pu ON o.customer_id = pu.user_id WHERE DATEPART(month, o.created_at) = DATEPART(month, DATEADD(month, -5, GETDATE()));


-- ==========================================
-- MONTH 4 AGO (4 months ago)
-- ==========================================
INSERT INTO dbo.Reservations (customer_id, contact_name, contact_phone, contact_email, preferred_area_id, reservation_start_at, reservation_end_at, guest_count, special_request, deposit_amount, final_total, reservation_status, created_at)
SELECT source.user_id, N'Dang Quang Phu', '0901000001', N'phuadmin@phurai.vn', 1, DATEADD(month, -4, GETDATE()), DATEADD(month, -4, DATEADD(hour, 2, GETDATE())), 2, N'', 100000.00, 1250000.00, N'Completed', DATEADD(month, -4, DATEADD(day, -5, GETDATE()))
FROM @PhuUsers source;

INSERT INTO dbo.Orders (reservation_id, table_id, customer_id, order_type, order_status, subtotal, discount_amount, service_charge, total_amount, amount_paid, created_at)
SELECT 
    (SELECT TOP 1 reservation_id FROM dbo.Reservations WHERE customer_id = source.user_id AND DATEPART(month, reservation_start_at) = DATEPART(month, DATEADD(month, -4, GETDATE()))),
    @TableId,
    source.user_id,
    N'Dine In',
    N'Paid',
    1250000.00,
    100000.00,
    50000.00,
    1200000.00,
    1200000.00,
    DATEADD(month, -4, GETDATE())
FROM @PhuUsers source;

INSERT INTO dbo.Payments (order_id, payment_method_id, amount_paid, change_given, payment_status, paid_at, created_at)
SELECT 
    (SELECT TOP 1 order_id FROM dbo.Orders WHERE customer_id = source.user_id AND DATEPART(month, created_at) = DATEPART(month, DATEADD(month, -4, GETDATE()))),
    1, 
    1200000.00,
    0,
    N'Completed',
    DATEADD(month, -4, GETDATE()),
    DATEADD(month, -4, GETDATE())
FROM @PhuUsers source;

INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, notes, item_status)
SELECT o.order_id, 13, 1, 890000.00, N'', N'Served'
FROM dbo.Orders o JOIN @PhuUsers pu ON o.customer_id = pu.user_id WHERE DATEPART(month, o.created_at) = DATEPART(month, DATEADD(month, -4, GETDATE()));

INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, notes, item_status)
SELECT o.order_id, 14, 1, 360000.00, N'', N'Served'
FROM dbo.Orders o JOIN @PhuUsers pu ON o.customer_id = pu.user_id WHERE DATEPART(month, o.created_at) = DATEPART(month, DATEADD(month, -4, GETDATE()));


-- ==========================================
-- MONTH 3 AGO (3 months ago)
-- ==========================================
INSERT INTO dbo.Reservations (customer_id, contact_name, contact_phone, contact_email, preferred_area_id, reservation_start_at, reservation_end_at, guest_count, special_request, deposit_amount, final_total, reservation_status, created_at)
SELECT source.user_id, N'Dang Quang Phu', '0901000001', N'phuadmin@phurai.vn', 1, DATEADD(month, -3, GETDATE()), DATEADD(month, -3, DATEADD(hour, 2, GETDATE())), 5, N'', 200000.00, 2568000.00, N'Completed', DATEADD(month, -3, DATEADD(day, -5, GETDATE()))
FROM @PhuUsers source;

INSERT INTO dbo.Orders (reservation_id, table_id, customer_id, order_type, order_status, subtotal, discount_amount, service_charge, total_amount, amount_paid, created_at)
SELECT 
    (SELECT TOP 1 reservation_id FROM dbo.Reservations WHERE customer_id = source.user_id AND DATEPART(month, reservation_start_at) = DATEPART(month, DATEADD(month, -3, GETDATE()))),
    @TableId,
    source.user_id,
    N'Dine In',
    N'Paid',
    2568000.00,
    200000.00,
    100000.00,
    2468000.00,
    2468000.00,
    DATEADD(month, -3, GETDATE())
FROM @PhuUsers source;

INSERT INTO dbo.Payments (order_id, payment_method_id, amount_paid, change_given, payment_status, paid_at, created_at)
SELECT 
    (SELECT TOP 1 order_id FROM dbo.Orders WHERE customer_id = source.user_id AND DATEPART(month, created_at) = DATEPART(month, DATEADD(month, -3, GETDATE()))),
    1, 
    2468000.00,
    0,
    N'Completed',
    DATEADD(month, -3, GETDATE()),
    DATEADD(month, -3, GETDATE())
FROM @PhuUsers source;

INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, notes, item_status)
SELECT o.order_id, 20, 2, 990000.00, N'', N'Served'
FROM dbo.Orders o JOIN @PhuUsers pu ON o.customer_id = pu.user_id WHERE DATEPART(month, o.created_at) = DATEPART(month, DATEADD(month, -3, GETDATE()));

INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, notes, item_status)
SELECT o.order_id, 9, 1, 499000.00, N'', N'Served'
FROM dbo.Orders o JOIN @PhuUsers pu ON o.customer_id = pu.user_id WHERE DATEPART(month, o.created_at) = DATEPART(month, DATEADD(month, -3, GETDATE()));

INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, notes, item_status)
SELECT o.order_id, 18, 1, 89000.00, N'', N'Served'
FROM dbo.Orders o JOIN @PhuUsers pu ON o.customer_id = pu.user_id WHERE DATEPART(month, o.created_at) = DATEPART(month, DATEADD(month, -3, GETDATE()));


-- ==========================================
-- MONTH 2 AGO (2 months ago)
-- ==========================================
INSERT INTO dbo.Reservations (customer_id, contact_name, contact_phone, contact_email, preferred_area_id, reservation_start_at, reservation_end_at, guest_count, special_request, deposit_amount, final_total, reservation_status, created_at)
SELECT source.user_id, N'Dang Quang Phu', '0901000001', N'phuadmin@phurai.vn', 1, DATEADD(month, -2, GETDATE()), DATEADD(month, -2, DATEADD(hour, 2, GETDATE())), 3, N'', 150000.00, 1857000.00, N'Completed', DATEADD(month, -2, DATEADD(day, -5, GETDATE()))
FROM @PhuUsers source;

INSERT INTO dbo.Orders (reservation_id, table_id, customer_id, order_type, order_status, subtotal, discount_amount, service_charge, total_amount, amount_paid, created_at)
SELECT 
    (SELECT TOP 1 reservation_id FROM dbo.Reservations WHERE customer_id = source.user_id AND DATEPART(month, reservation_start_at) = DATEPART(month, DATEADD(month, -2, GETDATE()))),
    @TableId,
    source.user_id,
    N'Dine In',
    N'Paid',
    1857000.00,
    150000.00,
    80000.00,
    1787000.00,
    1787000.00,
    DATEADD(month, -2, GETDATE())
FROM @PhuUsers source;

INSERT INTO dbo.Payments (order_id, payment_method_id, amount_paid, change_given, payment_status, paid_at, created_at)
SELECT 
    (SELECT TOP 1 order_id FROM dbo.Orders WHERE customer_id = source.user_id AND DATEPART(month, created_at) = DATEPART(month, DATEADD(month, -2, GETDATE()))),
    1, 
    1787000.00,
    0,
    N'Completed',
    DATEADD(month, -2, GETDATE()),
    DATEADD(month, -2, GETDATE())
FROM @PhuUsers source;

INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, notes, item_status)
SELECT o.order_id, 7, 1, 188000.00, N'', N'Served'
FROM dbo.Orders o JOIN @PhuUsers pu ON o.customer_id = pu.user_id WHERE DATEPART(month, o.created_at) = DATEPART(month, DATEADD(month, -2, GETDATE()));

INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, notes, item_status)
SELECT o.order_id, 13, 1, 890000.00, N'', N'Served'
FROM dbo.Orders o JOIN @PhuUsers pu ON o.customer_id = pu.user_id WHERE DATEPART(month, o.created_at) = DATEPART(month, DATEADD(month, -2, GETDATE()));

INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, notes, item_status)
SELECT o.order_id, 10, 1, 690000.00, N'', N'Served'
FROM dbo.Orders o JOIN @PhuUsers pu ON o.customer_id = pu.user_id WHERE DATEPART(month, o.created_at) = DATEPART(month, DATEADD(month, -2, GETDATE()));

INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, notes, item_status)
SELECT o.order_id, 18, 1, 89000.00, N'', N'Served'
FROM dbo.Orders o JOIN @PhuUsers pu ON o.customer_id = pu.user_id WHERE DATEPART(month, o.created_at) = DATEPART(month, DATEADD(month, -2, GETDATE()));


-- ==========================================
-- MONTH 1 AGO (1 month ago)
-- ==========================================
INSERT INTO dbo.Reservations (customer_id, contact_name, contact_phone, contact_email, preferred_area_id, reservation_start_at, reservation_end_at, guest_count, special_request, deposit_amount, final_total, reservation_status, created_at)
SELECT source.user_id, N'Dang Quang Phu', '0901000001', N'phuadmin@phurai.vn', 1, DATEADD(month, -1, GETDATE()), DATEADD(month, -1, DATEADD(hour, 2, GETDATE())), 4, N'', 200000.00, 2279000.00, N'Completed', DATEADD(month, -1, DATEADD(day, -5, GETDATE()))
FROM @PhuUsers source;

INSERT INTO dbo.Orders (reservation_id, table_id, customer_id, order_type, order_status, subtotal, discount_amount, service_charge, total_amount, amount_paid, created_at)
SELECT 
    (SELECT TOP 1 reservation_id FROM dbo.Reservations WHERE customer_id = source.user_id AND DATEPART(month, reservation_start_at) = DATEPART(month, DATEADD(month, -1, GETDATE()))),
    @TableId,
    source.user_id,
    N'Dine In',
    N'Paid',
    2279000.00,
    200000.00,
    100000.00,
    2179000.00,
    2179000.00,
    DATEADD(month, -1, GETDATE())
FROM @PhuUsers source;

INSERT INTO dbo.Payments (order_id, payment_method_id, amount_paid, change_given, payment_status, paid_at, created_at)
SELECT 
    (SELECT TOP 1 order_id FROM dbo.Orders WHERE customer_id = source.user_id AND DATEPART(month, created_at) = DATEPART(month, DATEADD(month, -1, GETDATE()))),
    1, 
    2179000.00,
    0,
    N'Completed',
    DATEADD(month, -1, GETDATE()),
    DATEADD(month, -1, GETDATE())
FROM @PhuUsers source;

INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, notes, item_status)
SELECT o.order_id, 13, 2, 890000.00, N'', N'Served'
FROM dbo.Orders o JOIN @PhuUsers pu ON o.customer_id = pu.user_id WHERE DATEPART(month, o.created_at) = DATEPART(month, DATEADD(month, -1, GETDATE()));

INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, notes, item_status)
SELECT o.order_id, 9, 1, 499000.00, N'', N'Served'
FROM dbo.Orders o JOIN @PhuUsers pu ON o.customer_id = pu.user_id WHERE DATEPART(month, o.created_at) = DATEPART(month, DATEADD(month, -1, GETDATE()));


-- ==========================================
-- CURRENT MONTH (Today / 15 days ago)
-- ==========================================
INSERT INTO dbo.Reservations (customer_id, contact_name, contact_phone, contact_email, preferred_area_id, reservation_start_at, reservation_end_at, guest_count, special_request, deposit_amount, final_total, reservation_status, created_at)
SELECT source.user_id, N'Dang Quang Phu', '0901000001', N'phuadmin@phurai.vn', 1, DATEADD(day, -15, GETDATE()), DATEADD(day, -15, DATEADD(hour, 2, GETDATE())), 4, N'Window seat', 100000.00, 1250000.00, N'Completed', DATEADD(day, -20, GETDATE())
FROM @PhuUsers source;

INSERT INTO dbo.Orders (reservation_id, table_id, customer_id, order_type, order_status, subtotal, discount_amount, service_charge, total_amount, amount_paid, created_at)
SELECT 
    (SELECT TOP 1 reservation_id FROM dbo.Reservations WHERE customer_id = source.user_id AND DATEPART(month, reservation_start_at) = DATEPART(month, GETDATE()) AND deposit_amount = 100000.00),
    @TableId,
    source.user_id,
    N'Dine In',
    N'Paid',
    1250000.00,
    100000.00,
    50000.00,
    1200000.00,
    1200000.00,
    DATEADD(day, -15, GETDATE())
FROM @PhuUsers source;

INSERT INTO dbo.Payments (order_id, payment_method_id, amount_paid, change_given, payment_status, paid_at, created_at)
SELECT 
    (SELECT TOP 1 order_id FROM dbo.Orders WHERE customer_id = source.user_id AND DATEPART(month, created_at) = DATEPART(month, GETDATE()) AND subtotal = 1250000.00),
    1, 
    1200000.00,
    0,
    N'Completed',
    DATEADD(day, -15, GETDATE()),
    DATEADD(day, -15, GETDATE())
FROM @PhuUsers source;

INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, notes, item_status)
SELECT o.order_id, 13, 1, 890000.00, N'', N'Served'
FROM dbo.Orders o JOIN @PhuUsers pu ON o.customer_id = pu.user_id WHERE DATEPART(month, o.created_at) = DATEPART(month, GETDATE()) AND o.subtotal = 1250000.00;

INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, notes, item_status)
SELECT o.order_id, 14, 1, 360000.00, N'', N'Served'
FROM dbo.Orders o JOIN @PhuUsers pu ON o.customer_id = pu.user_id WHERE DATEPART(month, o.created_at) = DATEPART(month, GETDATE()) AND o.subtotal = 1250000.00;


-- Second order this month
INSERT INTO dbo.Reservations (customer_id, contact_name, contact_phone, contact_email, preferred_area_id, reservation_start_at, reservation_end_at, guest_count, special_request, deposit_amount, final_total, reservation_status, created_at)
SELECT source.user_id, N'Dang Quang Phu', '0901000001', N'phuadmin@phurai.vn', 1, DATEADD(day, -5, GETDATE()), DATEADD(day, -5, DATEADD(hour, 2, GETDATE())), 2, N'Anniversary', 200000.00, 2568000.00, N'Completed', DATEADD(day, -10, GETDATE())
FROM @PhuUsers source;

INSERT INTO dbo.Orders (reservation_id, table_id, customer_id, order_type, order_status, subtotal, discount_amount, service_charge, total_amount, amount_paid, created_at)
SELECT 
    (SELECT TOP 1 reservation_id FROM dbo.Reservations WHERE customer_id = source.user_id AND DATEPART(month, reservation_start_at) = DATEPART(month, GETDATE()) AND deposit_amount = 200000.00),
    @TableId,
    source.user_id,
    N'Dine In',
    N'Paid',
    2568000.00,
    200000.00,
    100000.00,
    2468000.00,
    2468000.00,
    DATEADD(day, -5, GETDATE())
FROM @PhuUsers source;

INSERT INTO dbo.Payments (order_id, payment_method_id, amount_paid, change_given, payment_status, paid_at, created_at)
SELECT 
    (SELECT TOP 1 order_id FROM dbo.Orders WHERE customer_id = source.user_id AND DATEPART(month, created_at) = DATEPART(month, GETDATE()) AND subtotal = 2568000.00),
    1, 
    2468000.00,
    0,
    N'Completed',
    DATEADD(day, -5, GETDATE()),
    DATEADD(day, -5, GETDATE())
FROM @PhuUsers source;

INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, notes, item_status)
SELECT o.order_id, 20, 2, 990000.00, N'', N'Served'
FROM dbo.Orders o JOIN @PhuUsers pu ON o.customer_id = pu.user_id WHERE DATEPART(month, o.created_at) = DATEPART(month, GETDATE()) AND o.subtotal = 2568000.00;

INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, notes, item_status)
SELECT o.order_id, 9, 1, 499000.00, N'', N'Served'
FROM dbo.Orders o JOIN @PhuUsers pu ON o.customer_id = pu.user_id WHERE DATEPART(month, o.created_at) = DATEPART(month, GETDATE()) AND o.subtotal = 2568000.00;

INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, notes, item_status)
SELECT o.order_id, 18, 1, 89000.00, N'', N'Served'
FROM dbo.Orders o JOIN @PhuUsers pu ON o.customer_id = pu.user_id WHERE DATEPART(month, o.created_at) = DATEPART(month, GETDATE()) AND o.subtotal = 2568000.00;


-- Upcoming Confirmed Reservation (No Order/Payment yet)
INSERT INTO dbo.Reservations (customer_id, contact_name, contact_phone, contact_email, preferred_area_id, reservation_start_at, reservation_end_at, guest_count, special_request, deposit_amount, final_total, reservation_status, created_at)
SELECT source.user_id, N'Dang Quang Phu', '0901000001', N'phuadmin@phurai.vn', 1, DATEADD(day, 2, GETDATE()), DATEADD(day, 2, DATEADD(hour, 2, GETDATE())), 6, N'Private room', 500000.00, NULL, N'Confirmed', DATEADD(day, -1, GETDATE())
FROM @PhuUsers source;

COMMIT TRANSACTION;
`;

async function main() {
  console.log("Seeding data for Dang Quang Phu...");
  try {
    await pool.query(sql);
    console.log("✅ Successfully seeded dashboard data for Dang Quang Phu!");
  } catch (err) {
    console.error("❌ Failed to seed data:", err);
  }
  process.exit(0);
}

main();
