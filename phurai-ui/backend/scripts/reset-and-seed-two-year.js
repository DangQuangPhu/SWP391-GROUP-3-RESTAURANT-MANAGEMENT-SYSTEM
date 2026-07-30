/**
 * Rebuilds deterministic, coherent development/staging data for the last two
 * years. It deliberately preserves every non-Customer account and never runs
 * unless the operator supplies both safety acknowledgements.
 *
 * Usage:
 *   node backend/scripts/reset-and-seed-two-year.js --confirm-dev-staging --confirm-backup --execute
 *   node backend/scripts/reset-and-seed-two-year.js --confirm-dev-staging --confirm-backup --verify
 *
 * --verify executes the complete transaction and always rolls it back.
 */
import sql from "mssql";
import "../src/config.js";

const flags = new Set(process.argv.slice(2));
const execute = flags.has("--execute");
const verifyOnly = flags.has("--verify");

if ((!execute && !verifyOnly) || !flags.has("--confirm-dev-staging") || !flags.has("--confirm-backup")) {
  console.error(
    "Refusing to change data. Supply --confirm-dev-staging --confirm-backup and either --execute or --verify."
  );
  process.exit(2);
}
if (execute && verifyOnly) {
  console.error("Choose exactly one of --execute or --verify.");
  process.exit(2);
}

const config = {
  server: process.env.DB_SERVER || "localhost",
  port: Number(process.env.DB_PORT) || 1433,
  database: process.env.DB_DATABASE || "System_Restaurant",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  requestTimeout: 600000,
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== "false",
  },
};

const sqlText = String.raw`
SET XACT_ABORT ON;
SET NOCOUNT ON;

DECLARE @OpenDate DATE = '2024-07-30';
DECLARE @SeedEndDate DATE = '2026-07-30';
DECLARE @CustomerRoleId TINYINT = (SELECT role_id FROM dbo.Roles WHERE role_name = N'Customer');
DECLARE @ActorStaffId INT = (SELECT TOP (1) ua.user_id FROM dbo.UserAccounts ua JOIN dbo.Roles r ON r.role_id = ua.role_id WHERE r.role_name = N'Restaurant Staff' AND ua.is_active = 1 ORDER BY ua.user_id);
DECLARE @ManagerId INT = (SELECT TOP (1) ua.user_id FROM dbo.UserAccounts ua JOIN dbo.Roles r ON r.role_id = ua.role_id WHERE r.role_name = N'Manager' AND ua.is_active = 1 ORDER BY ua.user_id);
DECLARE @AdminId INT = (SELECT TOP (1) ua.user_id FROM dbo.UserAccounts ua JOIN dbo.Roles r ON r.role_id = ua.role_id WHERE r.role_name = N'Admin' AND ua.is_active = 1 ORDER BY ua.user_id);

IF @CustomerRoleId IS NULL OR @ActorStaffId IS NULL OR @ManagerId IS NULL OR @AdminId IS NULL
  THROW 51000, 'Required Customer, Restaurant Staff, Manager, or Admin account is missing.', 1;
IF DB_NAME() NOT LIKE '%Restaurant%'
  THROW 51001, 'Database name does not match the expected development/staging restaurant database.', 1;

/* Delete children first. Non-customer accounts, StaffProfiles, JobTitles,
   KitchenDevices, PaymentMethods, Roles, and RestaurantSettings are preserved. */
IF OBJECT_ID(N'dbo.ReportSubmissions', N'U') IS NOT NULL DELETE FROM dbo.ReportSubmissions;
DELETE FROM dbo.AuditLogs;
DELETE FROM dbo.ReportSnapshots;
DELETE FROM dbo.RecommendationLogs;
DELETE FROM dbo.CustomerReviews;
DELETE FROM dbo.Notifications;
DELETE FROM dbo.TableOccupancySessions;
DELETE FROM dbo.PromotionRedemptions;
DELETE FROM dbo.Payments;
DELETE FROM dbo.BillSplits;
DELETE FROM dbo.KitchenTickets;
DELETE FROM dbo.OrderItems;
DELETE FROM dbo.Orders;
DELETE FROM dbo.QROrderSessions;
DELETE FROM dbo.PreorderItems;
DELETE FROM dbo.ReservationChangeRequests;
DELETE FROM dbo.ReservationTimelines;
DELETE FROM dbo.ReservationTables;
DELETE FROM dbo.Reservations;
DELETE FROM dbo.PromoCodes;
DELETE FROM dbo.CustomerPromotions;
DELETE FROM dbo.Promotions;
DELETE FROM dbo.LoyaltyTransactions;
DELETE FROM dbo.CustomerProfiles;
DELETE FROM dbo.OtpTokens;
DELETE FROM dbo.UserAccounts WHERE role_id = @CustomerRoleId;
DELETE FROM dbo.Dishes;
DELETE FROM dbo.MenuCategories;
UPDATE dbo.RestaurantTables SET merged_into_table_id = NULL;
DELETE FROM dbo.RestaurantTables;
DELETE FROM dbo.RestaurantAreas;

/* Canonical restaurant layout. */
INSERT dbo.RestaurantAreas (area_name, area_type, description, is_active, created_at, updated_at) VALUES
  (N'Kitchen View', N'Regular', N'Open-kitchen dining area.', 1, @OpenDate, @OpenDate),
  (N'Premium Area', N'VIP', N'Premium dining tables.', 1, @OpenDate, @OpenDate),
  (N'Private Room', N'Private', N'Private rooms for groups and events.', 1, @OpenDate, @OpenDate),
  (N'Standard Area', N'Regular', N'Main dining room.', 1, @OpenDate, @OpenDate);

DECLARE @Layout TABLE (area_name NVARCHAR(80), table_number NVARCHAR(20), capacity TINYINT, price_tier NVARCHAR(20), x SMALLINT, y SMALLINT);
INSERT @Layout VALUES
 (N'Kitchen View',N'K01',2,N'Standard',80,80),(N'Kitchen View',N'K02',4,N'Standard',180,80),(N'Kitchen View',N'K03',4,N'Standard',280,80),(N'Kitchen View',N'K04',6,N'Premium',380,80),
 (N'Premium Area',N'P01',2,N'Premium',80,220),(N'Premium Area',N'P02',4,N'Premium',180,220),(N'Premium Area',N'P03',4,N'Premium',280,220),(N'Premium Area',N'P04',6,N'VIP',380,220),
 (N'Private Room',N'R01',6,N'VIP',80,360),(N'Private Room',N'R02',8,N'VIP',220,360),(N'Private Room',N'R03',10,N'VIP',380,360),
 (N'Standard Area',N'S01',2,N'Standard',80,500),(N'Standard Area',N'S02',4,N'Standard',180,500),(N'Standard Area',N'S03',4,N'Standard',280,500),(N'Standard Area',N'S04',6,N'Standard',380,500),(N'Standard Area',N'S05',8,N'Premium',480,500);
INSERT dbo.RestaurantTables (area_id,table_number,capacity,table_status,price_tier,static_qr_code,position_x,position_y,created_at,updated_at)
SELECT a.area_id,l.table_number,l.capacity,N'Available',l.price_tier,N'RES-SEED-'+l.table_number,l.x,l.y,@OpenDate,@OpenDate
FROM @Layout l JOIN dbo.RestaurantAreas a ON a.area_name=l.area_name;

INSERT dbo.MenuCategories (category_name,display_order,is_active,created_at,updated_at) VALUES
 (N'Appetizers',1,1,@OpenDate,@OpenDate),(N'Signature Mains',2,1,@OpenDate,@OpenDate),(N'Seafood',3,1,@OpenDate,@OpenDate),(N'Grill',4,1,@OpenDate,@OpenDate),
 (N'Noodles and Rice',5,1,@OpenDate,@OpenDate),(N'Desserts',6,1,@OpenDate,@OpenDate),(N'Beverages',7,1,@OpenDate,@OpenDate),(N'Wine and Cocktails',8,1,@OpenDate,@OpenDate);
DECLARE @Menu TABLE (category_name NVARCHAR(80), dish_name NVARCHAR(150), price DECIMAL(12,2), recommended BIT, prep SMALLINT);
INSERT @Menu VALUES
 (N'Appetizers',N'Fresh Spring Rolls',89000,0,10),(N'Appetizers',N'Crispy Calamari',148000,1,12),(N'Appetizers',N'Tuna Tartare',188000,0,12),
 (N'Signature Mains',N'Pho Braised Beef',218000,1,18),(N'Signature Mains',N'Lemongrass Chicken',198000,0,18),(N'Signature Mains',N'Five Spice Duck',328000,1,25),
 (N'Seafood',N'Grilled Tiger Prawns',368000,1,22),(N'Seafood',N'Sea Bass in Banana Leaf',428000,1,25),(N'Seafood',N'Seafood Fried Rice',248000,0,18),
 (N'Grill',N'Australian Ribeye',690000,1,25),(N'Grill',N'Grilled Pork Chop',248000,0,20),(N'Grill',N'Wagyu Striploin',990000,1,30),
 (N'Noodles and Rice',N'Beef Pho',168000,1,12),(N'Noodles and Rice',N'Chicken Fried Rice',148000,0,14),(N'Noodles and Rice',N'Spicy Seafood Noodles',228000,0,16),
 (N'Desserts',N'Coconut Panna Cotta',98000,0,8),(N'Desserts',N'Chocolate Lava Cake',128000,1,12),(N'Desserts',N'Mango Sticky Rice',108000,0,8),
 (N'Beverages',N'Vietnamese Iced Coffee',69000,1,5),(N'Beverages',N'Passionfruit Soda',79000,0,5),(N'Beverages',N'Jasmine Tea',59000,0,5),
 (N'Wine and Cocktails',N'House Red Wine',168000,0,5),(N'Wine and Cocktails',N'Signature Mojito',148000,1,5),(N'Wine and Cocktails',N'Lychee Martini',158000,0,5);
INSERT dbo.Dishes (category_id,dish_name,description,price,cost_price,is_available,is_recommended,allow_preorder,preorder_sort,spicy_level,prep_time_min,is_preorderable,created_at,updated_at)
SELECT c.category_id,m.dish_name,N'Realistic two-year seed menu item.',m.price,ROUND(m.price*.35,2),1,m.recommended,1,NULL,0,m.prep,1,@OpenDate,@OpenDate
FROM @Menu m JOIN dbo.MenuCategories c ON c.category_name=m.category_name;

/* Exactly 20 reproducible customer accounts. The password hash is the existing
   development demo hash; it is intentionally not printed by this script. */
DECLARE @CustomerSeed TABLE (n INT PRIMARY KEY, full_name NVARCHAR(120), email NVARCHAR(180), phone VARCHAR(25));
INSERT @CustomerSeed VALUES
 (1,N'Dang Quang Phu',N'quagphu159@gmail.com','0964813966'),(2,N'Tran Gia Han',N'customer02@seed.local','0901000002'),(3,N'Le Quoc Bao',N'customer03@seed.local','0901000003'),(4,N'Pham Thanh Mai',N'customer04@seed.local','0901000004'),(5,N'Hoang Duc Long',N'customer05@seed.local','0901000005'),
 (6,N'Vu Thao Linh',N'customer06@seed.local','0901000006'),(7,N'Dang Huu Phuc',N'customer07@seed.local','0901000007'),(8,N'Bui Ngoc Chau',N'customer08@seed.local','0901000008'),(9,N'Phan Tuan Kiet',N'customer09@seed.local','0901000009'),(10,N'Vo Khanh Vy',N'customer10@seed.local','0901000010'),
 (11,N'Nguyen Hai Nam',N'customer11@seed.local','0901000011'),(12,N'Tran My Duyen',N'customer12@seed.local','0901000012'),(13,N'Le Gia Huy',N'customer13@seed.local','0901000013'),(14,N'Pham Nhu Quynh',N'customer14@seed.local','0901000014'),(15,N'Hoang Bao Tran',N'customer15@seed.local','0901000015'),
 (16,N'Vu Minh Khoa',N'customer16@seed.local','0901000016'),(17,N'Dang Thu Ha',N'customer17@seed.local','0901000017'),(18,N'Bui Tien Dat',N'customer18@seed.local','0901000018'),(19,N'Phan Yen Nhi',N'customer19@seed.local','0901000019'),(20,N'Vo Quang Huy',N'customer20@seed.local','0901000020');
INSERT dbo.UserAccounts (role_id,full_name,email,phone,password_hash,is_active,email_verified,created_at,updated_at)
SELECT @CustomerRoleId,full_name,email,phone,N'scrypt$3fc41cd9111a05256c622615de15c504$8478e9821bc1955d78e788229acce921aa4e9b7be840afe40b8551b486c10f6d565a17afffe7d8aee279a2782dda8b4fddbf3bd99bba6f46b9df11c0d73f0af6',1,1,DATEADD(day,-(n*13),@SeedEndDate),@SeedEndDate FROM @CustomerSeed;
INSERT dbo.CustomerProfiles (user_id,username,gender,country,[language],date_of_birth,bio,loyalty_points,created_at,updated_at)
SELECT ua.user_id,CASE WHEN ua.email = N'quagphu159@gmail.com' THEN N'quagphu159' ELSE N'seed_customer_'+CONVERT(NVARCHAR(10),s.n) END,CASE WHEN ua.email = N'quagphu159@gmail.com' THEN N'Male' ELSE NULL END,N'Vietnam',CASE WHEN ua.email = N'quagphu159@gmail.com' THEN N'Vietnamese' ELSE N'English' END,CASE WHEN ua.email = N'quagphu159@gmail.com' THEN '2004-12-29' ELSE NULL END,CASE WHEN ua.email = N'quagphu159@gmail.com' THEN N'VIP customer since 2025.' ELSE NULL END,0,CASE WHEN ua.email = N'quagphu159@gmail.com' THEN '2026-01-25 00:00:00' ELSE ua.created_at END,@SeedEndDate FROM @CustomerSeed s JOIN dbo.UserAccounts ua ON ua.email=s.email;
IF NOT EXISTS (SELECT 1 FROM dbo.CustomerProfiles WHERE user_id = 1) INSERT dbo.CustomerProfiles (user_id,username,loyalty_points,country,[language],created_at,updated_at) VALUES (1,N'dangquangphu',0,N'Vietnam',N'English',DATEADD(month,-6,@SeedEndDate),@SeedEndDate);

IF NOT EXISTS (SELECT 1 FROM dbo.PaymentMethods WHERE method_name=N'Cash') INSERT dbo.PaymentMethods(method_name,is_active) VALUES(N'Cash',1);
IF NOT EXISTS (SELECT 1 FROM dbo.PaymentMethods WHERE method_name=N'Bank Transfer') INSERT dbo.PaymentMethods(method_name,is_active) VALUES(N'Bank Transfer',1);
IF NOT EXISTS (SELECT 1 FROM dbo.PaymentMethods WHERE method_name=N'MoMo') INSERT dbo.PaymentMethods(method_name,is_active) VALUES(N'MoMo',1);
INSERT dbo.Promotions (promotion_name,description,discount_type,discount_value,min_order_value,max_discount,start_at,end_at,is_active,applicable_to,created_by_staff_id,created_at,updated_at) VALUES
 (N'Weekday Welcome',N'Historical weekday promotion',N'Percent',10,300000,150000,@OpenDate,@SeedEndDate,0,N'Both',@ManagerId,@OpenDate,@SeedEndDate),
 (N'Weekend Dining',N'Historical weekend promotion',N'Percent',12,500000,200000,@OpenDate,@SeedEndDate,0,N'Order',@ManagerId,@OpenDate,@SeedEndDate),
 (N'Current Loyalty Reward',N'Active demonstration promotion',N'Fixed',100000,600000,NULL,@SeedEndDate,DATEADD(day,90,@SeedEndDate),1,N'Both',@ManagerId,@SeedEndDate,@SeedEndDate);
INSERT dbo.PromoCodes(promotion_id,promo_code,usage_limit,times_used,is_active,created_at,updated_at)
SELECT promotion_id,CASE promotion_name WHEN N'Weekday Welcome' THEN N'WELCOME10' WHEN N'Weekend Dining' THEN N'WEEKEND12' ELSE N'LOYAL100' END,99999,0,CASE WHEN is_active=1 THEN 1 ELSE 0 END,@OpenDate,@SeedEndDate FROM dbo.Promotions;

DECLARE @Customers TABLE (rn INT PRIMARY KEY, user_id INT, full_name NVARCHAR(120), phone VARCHAR(25), email NVARCHAR(180));
INSERT @Customers SELECT ROW_NUMBER() OVER(ORDER BY ua.user_id),ua.user_id,ua.full_name,ua.phone,ua.email FROM dbo.UserAccounts ua WHERE ua.role_id=@CustomerRoleId;
DECLARE @Tables TABLE (rn INT PRIMARY KEY, table_id SMALLINT, area_id SMALLINT, capacity TINYINT);
INSERT @Tables SELECT ROW_NUMBER() OVER(ORDER BY table_id),table_id,area_id,capacity FROM dbo.RestaurantTables;
DECLARE @Dishes TABLE (rn INT PRIMARY KEY, dish_id INT, price DECIMAL(12,2));
INSERT @Dishes SELECT ROW_NUMBER() OVER(ORDER BY dish_id),dish_id,price FROM dbo.Dishes;
DECLARE @Staff TABLE (rn INT PRIMARY KEY, user_id INT);
INSERT @Staff SELECT ROW_NUMBER() OVER(ORDER BY ua.user_id),ua.user_id FROM dbo.UserAccounts ua JOIN dbo.Roles r ON r.role_id=ua.role_id WHERE r.role_name=N'Restaurant Staff' AND ua.is_active=1;

DECLARE @SeedReservations TABLE (seed_key INT PRIMARY KEY, start_at DATETIME2(0), end_at DATETIME2(0), guest_count TINYINT, reservation_status NVARCHAR(25), reservation_source NVARCHAR(20), customer_id INT NULL, contact_name NVARCHAR(100), contact_phone NVARCHAR(20), contact_email NVARCHAR(100), table_id SMALLINT, area_id SMALLINT, actor_id INT, created_at DATETIME2(0));
;WITH Days AS (
  SELECT TOP (DATEDIFF(day,@OpenDate,@SeedEndDate)+1) ROW_NUMBER() OVER(ORDER BY (SELECT NULL))-1 AS d
  FROM sys.all_objects a CROSS JOIN sys.all_objects b
), Volume AS (
  SELECT d,4+d/120+CASE WHEN DATEPART(weekday,DATEADD(day,d,@OpenDate)) IN (1,7) THEN 3 WHEN DATEPART(weekday,DATEADD(day,d,@OpenDate))=6 THEN 2 ELSE 0 END+CASE WHEN MONTH(DATEADD(day,d,@OpenDate)) IN (2,12) THEN 2 ELSE 0 END AS total
  FROM Days
), Slots AS (
  SELECT v.d,n.n FROM Volume v CROSS APPLY (SELECT TOP(v.total) ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) n FROM sys.all_objects) n
), Base AS (
  SELECT d,n,d*100+n AS seed_key,DATEADD(minute,CASE WHEN n%3=0 THEN 690+(n*11)%150 ELSE 1110+(n*13)%150 END,CONVERT(DATETIME2(0),DATEADD(day,d,@OpenDate))) AS start_at
  FROM Slots
)
INSERT @SeedReservations
SELECT b.seed_key,b.start_at,DATEADD(minute,90+(b.n%3)*30,b.start_at),CONVERT(TINYINT,1+(ABS(CHECKSUM(b.seed_key))%6)),
 CASE WHEN b.d=DATEDIFF(day,@OpenDate,@SeedEndDate) AND b.n%4=0 THEN N'Await Check-in' WHEN (CHECKSUM(CONVERT(NVARCHAR(10),b.d)+N':'+CONVERT(NVARCHAR(10),b.n)) & 2147483647)%100 BETWEEN 0 AND 6 THEN N'No Show' WHEN (CHECKSUM(CONVERT(NVARCHAR(10),b.d)+N':'+CONVERT(NVARCHAR(10),b.n)) & 2147483647)%100 BETWEEN 7 AND 15 THEN N'Cancelled' ELSE N'Completed' END,
 CASE WHEN b.seed_key%10<4 THEN N'Walk-in' WHEN b.seed_key%10<6 THEN N'Phone' ELSE N'Online' END,
 CASE WHEN b.seed_key%10<4 THEN NULL ELSE c.user_id END,CASE WHEN b.seed_key%10<4 THEN CONCAT(N'Walk-in Guest ',b.seed_key) ELSE c.full_name END,CASE WHEN b.seed_key%10<4 THEN CONCAT(N'0908',RIGHT(CONCAT(N'000000',b.seed_key),6)) ELSE c.phone END,CASE WHEN b.seed_key%10<4 THEN NULL ELSE c.email END,
 t.table_id,t.area_id,s.user_id,DATEADD(hour,-(12+(b.n%36)),b.start_at)
FROM Base b JOIN @Tables t ON t.rn=1+(ABS(CHECKSUM(b.seed_key))%(SELECT COUNT(*) FROM @Tables)) LEFT JOIN @Customers c ON c.rn=1+((b.d*3+b.n)%20) JOIN @Staff s ON s.rn=1+(ABS(CHECKSUM(b.seed_key*31))%(SELECT COUNT(*) FROM @Staff));

INSERT dbo.Reservations(customer_id,contact_name,contact_phone,contact_email,created_by_staff_id,preferred_area_id,reservation_start_at,reservation_end_at,guest_count,special_request,dining_purpose,deposit_amount,deposit_required,order_code,reservation_status,reservation_source,confirmed_by_staff_id,confirmed_at,checked_in_at,seated_at,cancelled_at,checked_out_at,completed_at,cancel_reason,created_at,updated_at)
SELECT customer_id,contact_name,contact_phone,contact_email,actor_id,area_id,start_at,end_at,guest_count,CASE WHEN seed_key%13=0 THEN N'Window seat if available' ELSE NULL END,N'Dining',0,0,CONCAT('SEED-2Y-',seed_key),reservation_status,reservation_source,actor_id,DATEADD(hour,1,created_at),CASE WHEN reservation_status=N'Completed' THEN DATEADD(minute,5,start_at) END,CASE WHEN reservation_status=N'Completed' THEN DATEADD(minute,8,start_at) END,CASE WHEN reservation_status=N'Cancelled' THEN DATEADD(hour,-2,start_at) END,CASE WHEN reservation_status=N'Completed' THEN end_at END,CASE WHEN reservation_status=N'Completed' THEN end_at END,CASE WHEN reservation_status=N'Cancelled' THEN N'Guest cancelled before arrival' END,created_at,CASE WHEN reservation_status=N'Completed' THEN end_at ELSE created_at END FROM @SeedReservations;
INSERT dbo.ReservationTables(reservation_id,table_id,assigned_by_staff_id,assigned_at)
SELECT r.reservation_id,s.table_id,s.actor_id,DATEADD(hour,1,s.created_at) FROM @SeedReservations s JOIN dbo.Reservations r ON r.order_code=CONCAT('SEED-2Y-',s.seed_key);
INSERT dbo.PreorderItems(reservation_id,dish_id,quantity,unit_price,notes,created_at)
SELECT r.reservation_id,d.dish_id,1,d.price,N'Preordered for reservation',DATEADD(hour,1,s.created_at) FROM @SeedReservations s JOIN dbo.Reservations r ON r.order_code=CONCAT('SEED-2Y-',s.seed_key) JOIN @Dishes d ON d.rn=1+(s.seed_key%(SELECT COUNT(*) FROM @Dishes)) WHERE s.seed_key%10=0;

/* A small future set makes Gantt conflict detection demonstrable. */
DECLARE @ConflictTable SMALLINT=(SELECT TOP(1) table_id FROM dbo.RestaurantTables WHERE table_number=N'P02');
DECLARE @ConflictArea SMALLINT=(SELECT area_id FROM dbo.RestaurantTables WHERE table_id=@ConflictTable);
INSERT dbo.Reservations(customer_id,contact_name,contact_phone,contact_email,created_by_staff_id,preferred_area_id,reservation_start_at,reservation_end_at,guest_count,order_code,reservation_status,reservation_source,confirmed_by_staff_id,confirmed_at,created_at,updated_at)
SELECT c.user_id,c.full_name,c.phone,c.email,@ActorStaffId,@ConflictArea,DATEADD(hour,18,CONVERT(DATETIME2(0),DATEADD(day,v.n,@SeedEndDate))),DATEADD(minute,105,DATEADD(hour,18,CONVERT(DATETIME2(0),DATEADD(day,v.n,@SeedEndDate)))),4,CONCAT('SEED-CONFLICT-',v.n),N'Await Check-in',N'Online',@ActorStaffId,@SeedEndDate,@SeedEndDate,@SeedEndDate FROM (VALUES(1),(1),(2),(2)) v(n) CROSS JOIN (SELECT TOP(1) * FROM @Customers ORDER BY rn) c;
INSERT dbo.ReservationTables(reservation_id,table_id,assigned_by_staff_id,assigned_at) SELECT reservation_id,@ConflictTable,@ActorStaffId,@SeedEndDate FROM dbo.Reservations WHERE order_code LIKE 'SEED-CONFLICT-%';

INSERT dbo.QROrderSessions(table_id,scanned_table_id,reservation_id,customer_id,token,session_status,generated_by_staff_id,generated_at,expires_at,closed_at)
SELECT s.table_id,s.table_id,r.reservation_id,s.customer_id,CONCAT(N'seed-qr-',s.seed_key),N'Closed',s.actor_id,DATEADD(minute,5,s.start_at),DATEADD(hour,4,s.start_at),s.end_at FROM @SeedReservations s JOIN dbo.Reservations r ON r.order_code=CONCAT('SEED-2Y-',s.seed_key) WHERE s.reservation_status=N'Completed' AND s.seed_key%5=0;
INSERT dbo.Orders(reservation_id,table_id,customer_id,created_by_staff_id,qr_session_id,order_type,order_status,order_note,subtotal,discount_amount,service_charge,total_amount,amount_paid,created_at,updated_at)
SELECT r.reservation_id,s.table_id,COALESCE(s.customer_id, c.user_id),s.actor_id,q.qr_session_id,CASE WHEN q.qr_session_id IS NULL THEN N'Dine In' ELSE N'QR Self' END,N'Paid',CONCAT(N'Two-year seed:',s.seed_key),0,0,0,0,0,DATEADD(minute,12,s.start_at),s.end_at FROM @SeedReservations s JOIN dbo.Reservations r ON r.order_code=CONCAT('SEED-2Y-',s.seed_key) LEFT JOIN dbo.QROrderSessions q ON q.reservation_id=r.reservation_id CROSS APPLY(SELECT TOP(1)* FROM @Customers WHERE rn=1+(s.seed_key%20))c WHERE s.reservation_status=N'Completed';
;WITH SeedOrders AS (SELECT o.order_id,TRY_CONVERT(INT,REPLACE(o.order_note,N'Two-year seed:',N'')) seed_key FROM dbo.Orders o WHERE o.order_note LIKE N'Two-year seed:%'), Lines AS (SELECT so.order_id,so.seed_key,v.n FROM SeedOrders so CROSS APPLY (VALUES(1),(2),(3),(4)) v(n) WHERE v.n<=2+(so.seed_key%3))
INSERT dbo.OrderItems(order_id,dish_id,quantity,unit_price,notes,item_status,created_at,updated_at)
SELECT l.order_id,d.dish_id,1+(l.seed_key+l.n)%2,d.price,NULL,N'Served',o.created_at,DATEADD(minute,35,o.created_at) FROM Lines l JOIN dbo.Orders o ON o.order_id=l.order_id JOIN @Dishes d ON d.rn=CASE WHEN (l.seed_key+l.n)%10<5 THEN 1+(l.seed_key+l.n)%6 ELSE 1+(ABS(CHECKSUM(l.seed_key*l.n))%(SELECT COUNT(*) FROM @Dishes)) END;
UPDATE o SET subtotal=x.subtotal,discount_amount=CASE WHEN TRY_CONVERT(INT,REPLACE(o.order_note,N'Two-year seed:',N''))%7=0 THEN ROUND(x.subtotal*.10,2) ELSE 0 END,service_charge=0,total_amount=x.subtotal-CASE WHEN TRY_CONVERT(INT,REPLACE(o.order_note,N'Two-year seed:',N''))%7=0 THEN ROUND(x.subtotal*.10,2) ELSE 0 END,amount_paid=x.subtotal-CASE WHEN TRY_CONVERT(INT,REPLACE(o.order_note,N'Two-year seed:',N''))%7=0 THEN ROUND(x.subtotal*.10,2) ELSE 0 END,updated_at=DATEADD(minute,90,o.created_at) FROM dbo.Orders o CROSS APPLY(SELECT SUM(line_total) subtotal FROM dbo.OrderItems WHERE order_id=o.order_id)x WHERE o.order_note LIKE N'Two-year seed:%';
INSERT dbo.KitchenTickets(order_item_id,kitchen_status,priority_level,assigned_to_staff_id,sent_at,started_at,ready_at,updated_at)
SELECT oi.order_item_id,N'Served',3,s.actor_id,DATEADD(minute,2,o.created_at),DATEADD(minute,6,o.created_at),DATEADD(minute,24,o.created_at),DATEADD(minute,35,o.created_at) FROM dbo.OrderItems oi JOIN dbo.Orders o ON o.order_id=oi.order_id JOIN @SeedReservations s ON o.order_note=CONCAT(N'Two-year seed:',s.seed_key);
INSERT dbo.Payments(order_id,reservation_id,payment_method_id,amount_paid,change_given,payment_status,transaction_ref,processed_by_staff_id,paid_at,created_at,updated_at)
SELECT o.order_id,o.reservation_id,pm.payment_method_id,o.total_amount,0,N'Completed',CONCAT(N'SEED-PAY-',o.order_id),s.actor_id,DATEADD(minute,95,o.created_at),DATEADD(minute,95,o.created_at),DATEADD(minute,95,o.created_at) FROM dbo.Orders o JOIN @SeedReservations s ON o.order_note=CONCAT(N'Two-year seed:',s.seed_key) CROSS APPLY(SELECT TOP(1) payment_method_id FROM dbo.PaymentMethods WHERE is_active=1 ORDER BY CASE WHEN payment_method_id=1 THEN s.seed_key%3 ELSE payment_method_id END,payment_method_id)pm;
INSERT dbo.TableOccupancySessions(table_id,reservation_id,order_id,guest_count,check_in_at,estimated_duration_min,buffer_min,estimated_release_at,released_at,release_trigger,released_by_staff_id,created_at,updated_at)
SELECT o.table_id,o.reservation_id,o.order_id,s.guest_count,DATEADD(minute,8,s.start_at),DATEDIFF(minute,s.start_at,s.end_at),15,DATEADD(minute,15,s.end_at),s.end_at,N'StaffCashConfirm',s.actor_id,DATEADD(minute,8,s.start_at),s.end_at FROM dbo.Orders o JOIN @SeedReservations s ON o.order_note=CONCAT(N'Two-year seed:',s.seed_key);

INSERT dbo.ReservationTimelines(reservation_id,event_type,performed_by,notes,created_at)
SELECT r.reservation_id,N'CHECK_IN',s.actor_id,N'Guest checked in by seed staff.',DATEADD(minute,5,s.start_at) FROM @SeedReservations s JOIN dbo.Reservations r ON r.order_code=CONCAT('SEED-2Y-',s.seed_key) WHERE s.reservation_status=N'Completed';
INSERT dbo.ReservationTimelines(reservation_id,event_type,performed_by,notes,created_at)
SELECT r.reservation_id,N'NO_SHOW',s.actor_id,N'No-show recorded after grace period.',DATEADD(minute,20,s.start_at) FROM @SeedReservations s JOIN dbo.Reservations r ON r.order_code=CONCAT('SEED-2Y-',s.seed_key) WHERE s.reservation_status=N'No Show';
INSERT dbo.ReservationChangeRequests(reservation_id,requested_by_customer_id,request_type,reason,request_status,created_at)
SELECT TOP(2) r.reservation_id,r.customer_id,N'Cancel',N'Customer requested cancellation.',N'Pending',DATEADD(hour,-1,r.reservation_start_at) FROM dbo.Reservations r WHERE r.reservation_status=N'Cancelled' AND r.customer_id IS NOT NULL ORDER BY r.reservation_start_at DESC;

INSERT dbo.AuditLogs(user_id,action_name,target_table,target_id,new_value_json,ip_address,created_at)
SELECT s.actor_id,N'CHECK_IN',N'Reservations',r.reservation_id,N'{"status":"Dining","source":"two-year-seed"}','127.0.0.1',DATEADD(minute,5,s.start_at) FROM @SeedReservations s JOIN dbo.Reservations r ON r.order_code=CONCAT('SEED-2Y-',s.seed_key) WHERE s.reservation_status=N'Completed';
INSERT dbo.AuditLogs(user_id,action_name,target_table,target_id,new_value_json,ip_address,created_at)
SELECT p.processed_by_staff_id,N'PAYMENT_COMPLETED',N'Payments',p.payment_id,CONCAT(N'{"order_id":',p.order_id,N',"amount":',CONVERT(NVARCHAR(30),p.amount_paid),N'}'),'127.0.0.1',p.paid_at FROM dbo.Payments p;
INSERT dbo.AuditLogs(user_id,action_name,target_table,target_id,new_value_json,ip_address,created_at)
SELECT s.actor_id,N'NO_SHOW',N'Reservations',r.reservation_id,N'{"status":"No Show"}','127.0.0.1',DATEADD(minute,20,s.start_at) FROM @SeedReservations s JOIN dbo.Reservations r ON r.order_code=CONCAT('SEED-2Y-',s.seed_key) WHERE s.reservation_status=N'No Show';
INSERT dbo.AuditLogs(user_id,action_name,target_table,target_id,new_value_json,ip_address,created_at)
SELECT @ActorStaffId,N'RESERVATION_CHANGE_REQUESTED',N'Reservations',reservation_id,N'{"request_type":"Cancel","status":"Pending"}','127.0.0.1',created_at FROM dbo.ReservationChangeRequests;

-- Seed CustomerReviews across 2-year range
INSERT dbo.CustomerReviews (customer_id, order_id, food_rating, service_rating, ambiance_rating, comment, is_visible, created_at)
SELECT 
  o.customer_id,
  o.order_id,
  3 + (o.order_id % 3),
  3 + ((o.order_id + 1) % 3),
  4 + (o.order_id % 2),
  CASE WHEN o.order_id % 3 = 0 THEN N'Great dining experience! Delicious food and friendly staff.'
       WHEN o.order_id % 3 = 1 THEN N'Pho Braised Beef and Australian Ribeye were exquisite.'
       ELSE NULL END,
  1,
  o.created_at
FROM dbo.Orders o
WHERE o.customer_id IS NOT NULL AND o.order_id % 5 = 0;

-- Seed LoyaltyTransactions from paid orders (1 point per 10,000 VND)
INSERT dbo.LoyaltyTransactions (customer_id, points, transaction_type, reference_type, reference_id, description, created_at)
SELECT 
  o.customer_id,
  CAST(ROUND(o.amount_paid / 10000.0, 0) AS INT),
  N'Earn',
  N'Order',
  o.order_id,
  CONCAT(N'Points earned for paid Order #', o.order_id),
  o.created_at
FROM dbo.Orders o
WHERE o.customer_id IS NOT NULL AND o.amount_paid > 0;

-- Update CustomerProfiles total loyalty points
UPDATE cp
SET loyalty_points = ISNULL(lt.total_pts, 0)
FROM dbo.CustomerProfiles cp
CROSS APPLY (
  SELECT SUM(points) AS total_pts
  FROM dbo.LoyaltyTransactions
  WHERE customer_id = cp.user_id AND transaction_type = N'Earn'
) lt;

-- Seed CustomerPromotions
INSERT dbo.CustomerPromotions (customer_id, promotion_id, points_spent, promo_code, status, redeemed_at, expires_at)
SELECT 
  ua.user_id,
  p.promotion_id,
  0,
  CONCAT(N'SEED-PROMO-', ua.user_id, N'-', p.promotion_id),
  N'active',
  ua.created_at,
  DATEADD(day, 180, @SeedEndDate)
FROM dbo.UserAccounts ua
CROSS JOIN (SELECT TOP 2 promotion_id FROM dbo.Promotions) p
WHERE ua.role_id = @CustomerRoleId OR ua.user_id = 1;

/* Fail the transaction if a key invariant is not true. */
IF (SELECT COUNT(*) FROM dbo.UserAccounts WHERE role_id=@CustomerRoleId) <> 20 THROW 51010, 'Expected exactly 20 seeded customer accounts.', 1;
IF (SELECT COUNT(*) FROM dbo.Orders) < 1000 THROW 51016, 'Seed volume is unexpectedly low.', 1;
IF (SELECT COUNT(*) FROM dbo.Reservations WHERE reservation_status=N'No Show') < 250 THROW 51017, 'No-show distribution is unexpectedly low.', 1;
IF EXISTS (SELECT 1 FROM dbo.Reservations WHERE reservation_start_at<DATEADD(day,-1,@SeedEndDate) AND reservation_status IN(N'Pending Request',N'Awaiting Deposit',N'Await Check-in',N'Dining',N'Pending Payment')) THROW 51011, 'Historical reservations cannot remain open.', 1;
IF EXISTS (SELECT 1 FROM dbo.Orders WHERE ABS((subtotal-discount_amount)-total_amount)>0.01 OR amount_paid<>total_amount) THROW 51012, 'Order financial formula failed.', 1;
IF EXISTS (SELECT 1 FROM dbo.Payments p JOIN dbo.Orders o ON o.order_id=p.order_id WHERE p.payment_status=N'Completed' AND p.amount_paid<>o.total_amount) THROW 51013, 'Payment total does not match order total.', 1;
IF EXISTS (SELECT 1 FROM dbo.Reservations r WHERE r.reservation_status=N'Completed' AND NOT EXISTS(SELECT 1 FROM dbo.AuditLogs a WHERE a.target_table=N'Reservations' AND a.target_id=r.reservation_id AND a.action_name=N'CHECK_IN')) THROW 51014, 'Completed reservation is missing check-in audit data.', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.Reservations r JOIN dbo.ReservationTables rt ON rt.reservation_id=r.reservation_id WHERE r.order_code LIKE N'SEED-CONFLICT-%' GROUP BY rt.table_id,CONVERT(DATE,r.reservation_start_at) HAVING COUNT(*)>=2) THROW 51015, 'Timeline conflict test data is missing.', 1;

SELECT
 (SELECT COUNT(*) FROM dbo.Reservations) reservations,
 (SELECT COUNT(*) FROM dbo.Orders) orders,
 (SELECT COUNT(*) FROM dbo.OrderItems) order_items,
 (SELECT COUNT(*) FROM dbo.Payments) payments,
 (SELECT COUNT(*) FROM dbo.AuditLogs) audit_logs,
 (SELECT COUNT(*) FROM dbo.UserAccounts WHERE role_id=@CustomerRoleId) customer_accounts;
`;

const pool = await sql.connect(config);
const transaction = new sql.Transaction(pool);
try {
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  const result = await new sql.Request(transaction).batch(sqlText);
  if (verifyOnly) {
    await transaction.rollback();
    console.log("Verification passed; all changes were rolled back.", result.recordset[0]);
  } else {
    await transaction.commit();
    console.log("Two-year development/staging seed committed.", result.recordset[0]);
  }
} catch (error) {
  try { await transaction.rollback(); } catch { /* Transaction may already be rolled back. */ }
  console.error("Seed failed; transaction was rolled back.", error.message, error.lineNumber ? `(SQL line ${error.lineNumber})` : "");
  process.exitCode = 1;
} finally {
  await pool.close();
}
