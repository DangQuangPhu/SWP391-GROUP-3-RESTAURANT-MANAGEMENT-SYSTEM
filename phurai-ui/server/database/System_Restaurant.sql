-- =============================================================
-- PHŪRAI PREMIUM RESTAURANT MANAGEMENT SYSTEM
-- SQL Server Relational Database Design
-- Target: Microsoft SQL Server / SSMS
-- Normalization target: 3NF
-- =============================================================

IF DB_ID(N'System_Restaurant') IS NULL
BEGIN
    CREATE DATABASE [System_Restaurant];
END
GO

USE [System_Restaurant];
GO

-- Re-runnable cleanup: drop child tables before parent tables.
DROP TABLE IF EXISTS dbo.RecommendationLogs;
DROP TABLE IF EXISTS dbo.AuditLogs;
DROP TABLE IF EXISTS dbo.ReportSnapshots;
DROP TABLE IF EXISTS dbo.CustomerReviews;
DROP TABLE IF EXISTS dbo.Notifications;
DROP TABLE IF EXISTS dbo.VoucherRedemptions;
DROP TABLE IF EXISTS dbo.Vouchers;
DROP TABLE IF EXISTS dbo.Promotions;
DROP TABLE IF EXISTS dbo.Payments;
DROP TABLE IF EXISTS dbo.PaymentMethods;
DROP TABLE IF EXISTS dbo.KitchenTickets;
DROP TABLE IF EXISTS dbo.OrderItems;
DROP TABLE IF EXISTS dbo.Orders;
DROP TABLE IF EXISTS dbo.QROrderSessions;
DROP TABLE IF EXISTS dbo.PreorderItems;
DROP TABLE IF EXISTS dbo.ReservationTables;
DROP TABLE IF EXISTS dbo.Reservations;
DROP TABLE IF EXISTS dbo.DishImages;
DROP TABLE IF EXISTS dbo.Dishes;
DROP TABLE IF EXISTS dbo.MenuCategories;
DROP TABLE IF EXISTS dbo.RestaurantTables;
DROP TABLE IF EXISTS dbo.RestaurantAreas;
DROP TABLE IF EXISTS dbo.RestaurantSettings;
DROP TABLE IF EXISTS dbo.StaffProfiles;
DROP TABLE IF EXISTS dbo.CustomerProfiles;
DROP TABLE IF EXISTS dbo.OtpTokens;
DROP TABLE IF EXISTS dbo.UserAccounts;
DROP TABLE IF EXISTS dbo.Roles;
GO

-- =============================================================
-- 1. USER ACCOUNTS AND ROLES
-- =============================================================

CREATE TABLE dbo.Roles (
    role_id        TINYINT IDENTITY(1,1) NOT NULL,
    role_name      NVARCHAR(50) NOT NULL,
    description    NVARCHAR(255) NULL,
    created_at     DATETIME2(0) NOT NULL CONSTRAINT DF_Roles_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_Roles PRIMARY KEY (role_id),
    CONSTRAINT UQ_Roles_role_name UNIQUE (role_name),
    CONSTRAINT CK_Roles_role_name CHECK (role_name IN
        (N'Customer', N'Restaurant Staff', N'Kitchen Staff', N'Manager', N'Admin'))
);
GO

CREATE TABLE dbo.UserAccounts (
    user_id          INT IDENTITY(1,1) NOT NULL,
    role_id          TINYINT NOT NULL,
    full_name        NVARCHAR(120) NOT NULL,
    email            NVARCHAR(180) NOT NULL,
    phone            VARCHAR(25) NULL,
    password_hash    NVARCHAR(255) NOT NULL,
    avatar_url       NVARCHAR(500) NULL,
    is_active        BIT NOT NULL CONSTRAINT DF_UserAccounts_is_active DEFAULT 1,
    email_verified   BIT NOT NULL CONSTRAINT DF_UserAccounts_email_verified DEFAULT 0,
    last_login_at    DATETIME2(0) NULL,
    created_at       DATETIME2(0) NOT NULL CONSTRAINT DF_UserAccounts_created_at DEFAULT SYSDATETIME(),
    updated_at       DATETIME2(0) NOT NULL CONSTRAINT DF_UserAccounts_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_UserAccounts PRIMARY KEY (user_id),
    CONSTRAINT UQ_UserAccounts_email UNIQUE (email),
    CONSTRAINT FK_UserAccounts_Roles FOREIGN KEY (role_id) REFERENCES dbo.Roles(role_id),
    CONSTRAINT CK_UserAccounts_email_basic CHECK (email LIKE N'%_@_%._%')
);
GO


CREATE TABLE dbo.OtpTokens (
    otp_id       BIGINT IDENTITY(1,1) NOT NULL,
    user_id      INT NULL,
    email        NVARCHAR(180) NOT NULL,
    purpose      NVARCHAR(40) NOT NULL,
    otp_hash     NVARCHAR(255) NOT NULL,
    expires_at   DATETIME2(0) NOT NULL,
    verified_at  DATETIME2(0) NULL,
    consumed_at  DATETIME2(0) NULL,
    created_at   DATETIME2(0) NOT NULL CONSTRAINT DF_OtpTokens_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_OtpTokens PRIMARY KEY (otp_id),
    CONSTRAINT FK_OtpTokens_UserAccounts FOREIGN KEY (user_id) REFERENCES dbo.UserAccounts(user_id) ON DELETE CASCADE,
    CONSTRAINT CK_OtpTokens_purpose CHECK (purpose IN
        (N'EMAIL_VERIFY', N'PASSWORD_RESET', N'LOGIN_VERIFY', N'CHANGE_PASSWORD')),
    CONSTRAINT CK_OtpTokens_expiry CHECK (expires_at > created_at)
);
GO


CREATE TABLE dbo.CustomerProfiles (
    customer_id       INT IDENTITY(1,1) NOT NULL,
    user_id           INT NOT NULL,
    username          NVARCHAR(50) NULL,
    date_of_birth     DATE NULL,
    gender            NVARCHAR(20) NULL,
    country           NVARCHAR(80) NULL,
    [language]        NVARCHAR(80) NULL,
    bio               NVARCHAR(1000) NULL,
    loyalty_points    INT NOT NULL CONSTRAINT DF_CustomerProfiles_loyalty DEFAULT 0,
    membership_tier   NVARCHAR(20) NOT NULL CONSTRAINT DF_CustomerProfiles_tier DEFAULT N'Bronze',
    preferences       NVARCHAR(1000) NULL,
    created_at        DATETIME2(0) NOT NULL CONSTRAINT DF_CustomerProfiles_created_at DEFAULT SYSDATETIME(),
    updated_at        DATETIME2(0) NOT NULL CONSTRAINT DF_CustomerProfiles_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_CustomerProfiles PRIMARY KEY (customer_id),
    CONSTRAINT UQ_CustomerProfiles_user UNIQUE (user_id),
    CONSTRAINT UQ_CustomerProfiles_username UNIQUE (username),
    CONSTRAINT FK_CustomerProfiles_UserAccounts FOREIGN KEY (user_id) REFERENCES dbo.UserAccounts(user_id) ON DELETE CASCADE,
    CONSTRAINT CK_CustomerProfiles_loyalty CHECK (loyalty_points >= 0),
    CONSTRAINT CK_CustomerProfiles_tier CHECK (membership_tier IN (N'Bronze', N'Silver', N'Gold', N'Diamond')),
    CONSTRAINT CK_CustomerProfiles_gender CHECK (gender IS NULL OR gender IN (N'Male', N'Female', N'Other'))
);
GO

CREATE TABLE dbo.StaffProfiles (
    staff_id           INT IDENTITY(1,1) NOT NULL,
    user_id            INT NOT NULL,
    staff_code         VARCHAR(30) NOT NULL,
    job_title          NVARCHAR(80) NOT NULL,
    hire_date          DATE NOT NULL,
    employment_status  NVARCHAR(20) NOT NULL CONSTRAINT DF_StaffProfiles_status DEFAULT N'Active',
    base_salary        DECIMAL(12,2) NULL,
    created_at         DATETIME2(0) NOT NULL CONSTRAINT DF_StaffProfiles_created_at DEFAULT SYSDATETIME(),
    updated_at         DATETIME2(0) NOT NULL CONSTRAINT DF_StaffProfiles_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_StaffProfiles PRIMARY KEY (staff_id),
    CONSTRAINT UQ_StaffProfiles_user UNIQUE (user_id),
    CONSTRAINT UQ_StaffProfiles_staff_code UNIQUE (staff_code),
    CONSTRAINT FK_StaffProfiles_UserAccounts FOREIGN KEY (user_id) REFERENCES dbo.UserAccounts(user_id) ON DELETE CASCADE,
    CONSTRAINT CK_StaffProfiles_status CHECK (employment_status IN (N'Active', N'On Leave', N'Resigned')),
    CONSTRAINT CK_StaffProfiles_salary CHECK (base_salary IS NULL OR base_salary >= 0)
);
GO

CREATE TABLE dbo.RestaurantSettings (
    setting_key     NVARCHAR(100) NOT NULL,
    setting_value   NVARCHAR(1000) NOT NULL,
    description     NVARCHAR(255) NULL,
    updated_by      INT NULL,
    updated_at      DATETIME2(0) NOT NULL CONSTRAINT DF_RestaurantSettings_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_RestaurantSettings PRIMARY KEY (setting_key),
    CONSTRAINT FK_RestaurantSettings_UserAccounts FOREIGN KEY (updated_by) REFERENCES dbo.UserAccounts(user_id)
);
GO

-- =============================================================
-- 2. RESTAURANT AREAS, TABLES, MENU
-- =============================================================

CREATE TABLE dbo.RestaurantAreas (
    area_id       SMALLINT IDENTITY(1,1) NOT NULL,
    area_name     NVARCHAR(80) NOT NULL,
    area_type     NVARCHAR(20) NOT NULL CONSTRAINT DF_RestaurantAreas_type DEFAULT N'Regular',
    description   NVARCHAR(255) NULL,
    is_active     BIT NOT NULL CONSTRAINT DF_RestaurantAreas_is_active DEFAULT 1,
    created_at    DATETIME2(0) NOT NULL CONSTRAINT DF_RestaurantAreas_created_at DEFAULT SYSDATETIME(),
    updated_at    DATETIME2(0) NOT NULL CONSTRAINT DF_RestaurantAreas_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_RestaurantAreas PRIMARY KEY (area_id),
    CONSTRAINT UQ_RestaurantAreas_area_name UNIQUE (area_name),
    CONSTRAINT CK_RestaurantAreas_type CHECK (area_type IN (N'Regular', N'VIP', N'Outdoor', N'Bar', N'Private'))
);
GO

CREATE TABLE dbo.RestaurantTables (
    table_id       SMALLINT IDENTITY(1,1) NOT NULL,
    area_id        SMALLINT NOT NULL,
    table_number   NVARCHAR(20) NOT NULL,
    capacity       TINYINT NOT NULL,
    table_status   NVARCHAR(20) NOT NULL CONSTRAINT DF_RestaurantTables_status DEFAULT N'Available',
    static_qr_code  NVARCHAR(120) NULL,
    notes           NVARCHAR(255) NULL,
    created_at      DATETIME2(0) NOT NULL CONSTRAINT DF_RestaurantTables_created_at DEFAULT SYSDATETIME(),
    updated_at      DATETIME2(0) NOT NULL CONSTRAINT DF_RestaurantTables_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_RestaurantTables PRIMARY KEY (table_id),
    CONSTRAINT UQ_RestaurantTables_table_number UNIQUE (table_number),
    CONSTRAINT UQ_RestaurantTables_static_qr_code UNIQUE (static_qr_code),
    CONSTRAINT FK_RestaurantTables_RestaurantAreas FOREIGN KEY (area_id) REFERENCES dbo.RestaurantAreas(area_id),
    CONSTRAINT CK_RestaurantTables_capacity CHECK (capacity > 0),
    CONSTRAINT CK_RestaurantTables_status CHECK (table_status IN
        (N'Available', N'Reserved', N'Occupied', N'Cleaning', N'Inactive'))
);
GO

CREATE TABLE dbo.MenuCategories (
    category_id     SMALLINT IDENTITY(1,1) NOT NULL,
    category_name   NVARCHAR(80) NOT NULL,
    display_order   TINYINT NOT NULL CONSTRAINT DF_MenuCategories_display DEFAULT 0,
    is_active       BIT NOT NULL CONSTRAINT DF_MenuCategories_is_active DEFAULT 1,
    created_at      DATETIME2(0) NOT NULL CONSTRAINT DF_MenuCategories_created_at DEFAULT SYSDATETIME(),
    updated_at      DATETIME2(0) NOT NULL CONSTRAINT DF_MenuCategories_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_MenuCategories PRIMARY KEY (category_id),
    CONSTRAINT UQ_MenuCategories_category_name UNIQUE (category_name)
);
GO

CREATE TABLE dbo.Dishes (
    dish_id          INT IDENTITY(1,1) NOT NULL,
    category_id      SMALLINT NOT NULL,
    dish_name        NVARCHAR(150) NOT NULL,
    description      NVARCHAR(1000) NULL,
    price            DECIMAL(12,2) NOT NULL,
    cost_price       DECIMAL(12,2) NULL,
    is_available     BIT NOT NULL CONSTRAINT DF_Dishes_is_available DEFAULT 1,
    is_recommended   BIT NOT NULL CONSTRAINT DF_Dishes_is_recommended DEFAULT 0,
    allow_preorder   BIT NOT NULL CONSTRAINT DF_Dishes_allow_preorder DEFAULT 0,
    preorder_sort    INT NULL,
    spicy_level      TINYINT NOT NULL CONSTRAINT DF_Dishes_spicy DEFAULT 0,
    prep_time_min    SMALLINT NULL,
    created_at       DATETIME2(0) NOT NULL CONSTRAINT DF_Dishes_created_at DEFAULT SYSDATETIME(),
    updated_at       DATETIME2(0) NOT NULL CONSTRAINT DF_Dishes_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_Dishes PRIMARY KEY (dish_id),
    CONSTRAINT FK_Dishes_MenuCategories FOREIGN KEY (category_id) REFERENCES dbo.MenuCategories(category_id),
    CONSTRAINT CK_Dishes_price CHECK (price >= 0),
    CONSTRAINT CK_Dishes_cost_price CHECK (cost_price IS NULL OR cost_price >= 0),
    CONSTRAINT CK_Dishes_spicy_level CHECK (spicy_level BETWEEN 0 AND 5),
    CONSTRAINT CK_Dishes_prep_time CHECK (prep_time_min IS NULL OR prep_time_min > 0)
);
GO

CREATE TABLE dbo.DishImages (
    image_id      INT IDENTITY(1,1) NOT NULL,
    dish_id       INT NOT NULL,
    image_url     NVARCHAR(500) NOT NULL,
    is_primary    BIT NOT NULL CONSTRAINT DF_DishImages_is_primary DEFAULT 0,
    created_at    DATETIME2(0) NOT NULL CONSTRAINT DF_DishImages_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_DishImages PRIMARY KEY (image_id),
    CONSTRAINT FK_DishImages_Dishes FOREIGN KEY (dish_id) REFERENCES dbo.Dishes(dish_id) ON DELETE CASCADE
);
GO

-- =============================================================
-- 3. RESERVATION AND PRE-ORDERING
-- =============================================================

CREATE TABLE dbo.Reservations (
    reservation_id        INT IDENTITY(1,1) NOT NULL,
    customer_id           INT NULL,
    created_by_staff_id   INT NULL,
    preferred_area_id     SMALLINT NULL,
    reservation_start_at  DATETIME2(0) NOT NULL,
    reservation_end_at    DATETIME2(0) NOT NULL,
    guest_count           TINYINT NOT NULL,
    special_request       NVARCHAR(1000) NULL,
    reservation_status    NVARCHAR(20) NOT NULL CONSTRAINT DF_Reservations_status DEFAULT N'Pending',
    reservation_source    NVARCHAR(20) NOT NULL CONSTRAINT DF_Reservations_source DEFAULT N'Online',
    confirmed_by_staff_id INT NULL,
    confirmed_at          DATETIME2(0) NULL,
    checked_in_at         DATETIME2(0) NULL,
    cancelled_at          DATETIME2(0) NULL,
    cancel_reason         NVARCHAR(255) NULL,
    reminder_sent         BIT NOT NULL CONSTRAINT DF_Reservations_reminder DEFAULT 0,
    created_at            DATETIME2(0) NOT NULL CONSTRAINT DF_Reservations_created_at DEFAULT SYSDATETIME(),
    updated_at            DATETIME2(0) NOT NULL CONSTRAINT DF_Reservations_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_Reservations PRIMARY KEY (reservation_id),
    CONSTRAINT FK_Reservations_Customer FOREIGN KEY (customer_id) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT FK_Reservations_CreatedByStaff FOREIGN KEY (created_by_staff_id) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT FK_Reservations_PreferredArea FOREIGN KEY (preferred_area_id) REFERENCES dbo.RestaurantAreas(area_id),
    CONSTRAINT FK_Reservations_ConfirmedByStaff FOREIGN KEY (confirmed_by_staff_id) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT CK_Reservations_guest_count CHECK (guest_count > 0),
    CONSTRAINT CK_Reservations_time CHECK (reservation_end_at > reservation_start_at),
    CONSTRAINT CK_Reservations_status CHECK (reservation_status IN
        (N'Pending', N'Confirmed', N'Checked In', N'Completed', N'Cancelled', N'No Show')),
    CONSTRAINT CK_Reservations_source CHECK (reservation_source IN (N'Online', N'Walk-in', N'Phone'))
);
GO

CREATE TABLE dbo.ReservationTables (
    reservation_id   INT NOT NULL,
    table_id         SMALLINT NOT NULL,
    assigned_by_staff_id INT NULL,
    assigned_at      DATETIME2(0) NOT NULL CONSTRAINT DF_ReservationTables_assigned_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_ReservationTables PRIMARY KEY (reservation_id, table_id),
    CONSTRAINT FK_ReservationTables_Reservations FOREIGN KEY (reservation_id) REFERENCES dbo.Reservations(reservation_id) ON DELETE CASCADE,
    CONSTRAINT FK_ReservationTables_RestaurantTables FOREIGN KEY (table_id) REFERENCES dbo.RestaurantTables(table_id),
    CONSTRAINT FK_ReservationTables_AssignedBy FOREIGN KEY (assigned_by_staff_id) REFERENCES dbo.UserAccounts(user_id)
);
GO

CREATE TABLE dbo.PreorderItems (
    preorder_item_id  INT IDENTITY(1,1) NOT NULL,
    reservation_id    INT NOT NULL,
    dish_id           INT NOT NULL,
    quantity          SMALLINT NOT NULL CONSTRAINT DF_PreorderItems_quantity DEFAULT 1,
    unit_price        DECIMAL(12,2) NOT NULL,
    notes             NVARCHAR(255) NULL,
    created_at        DATETIME2(0) NOT NULL CONSTRAINT DF_PreorderItems_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_PreorderItems PRIMARY KEY (preorder_item_id),
    CONSTRAINT FK_PreorderItems_Reservations FOREIGN KEY (reservation_id) REFERENCES dbo.Reservations(reservation_id) ON DELETE CASCADE,
    CONSTRAINT FK_PreorderItems_Dishes FOREIGN KEY (dish_id) REFERENCES dbo.Dishes(dish_id),
    CONSTRAINT CK_PreorderItems_quantity CHECK (quantity > 0),
    CONSTRAINT CK_PreorderItems_unit_price CHECK (unit_price >= 0)
);
GO

-- =============================================================
-- 4. QR ORDERING, ORDERS, KITCHEN DISPLAY
-- =============================================================

CREATE TABLE dbo.QROrderSessions (
    qr_session_id      INT IDENTITY(1,1) NOT NULL,
    table_id           SMALLINT NOT NULL,
    reservation_id     INT NULL,
    customer_id        INT NULL,
    token              NVARCHAR(120) NOT NULL,
    session_status     NVARCHAR(20) NOT NULL CONSTRAINT DF_QROrderSessions_status DEFAULT N'Active',
    generated_by_staff_id INT NULL,
    generated_at       DATETIME2(0) NOT NULL CONSTRAINT DF_QROrderSessions_generated_at DEFAULT SYSDATETIME(),
    expires_at         DATETIME2(0) NULL,
    closed_at          DATETIME2(0) NULL,
    CONSTRAINT PK_QROrderSessions PRIMARY KEY (qr_session_id),
    CONSTRAINT UQ_QROrderSessions_token UNIQUE (token),
    CONSTRAINT FK_QROrderSessions_Table FOREIGN KEY (table_id) REFERENCES dbo.RestaurantTables(table_id),
    CONSTRAINT FK_QROrderSessions_Reservation FOREIGN KEY (reservation_id) REFERENCES dbo.Reservations(reservation_id),
    CONSTRAINT FK_QROrderSessions_Customer FOREIGN KEY (customer_id) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT FK_QROrderSessions_GeneratedBy FOREIGN KEY (generated_by_staff_id) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT CK_QROrderSessions_status CHECK (session_status IN (N'Active', N'Closed', N'Expired', N'Cancelled')),
    CONSTRAINT CK_QROrderSessions_expiry CHECK (expires_at IS NULL OR expires_at > generated_at)
);
GO

CREATE TABLE dbo.Orders (
    order_id           INT IDENTITY(1,1) NOT NULL,
    reservation_id     INT NULL,
    table_id           SMALLINT NOT NULL,
    customer_id        INT NULL,
    created_by_staff_id INT NULL,
    qr_session_id      INT NULL,
    order_type         NVARCHAR(20) NOT NULL CONSTRAINT DF_Orders_type DEFAULT N'Dine In',
    order_status       NVARCHAR(25) NOT NULL CONSTRAINT DF_Orders_status DEFAULT N'Open',
    order_note         NVARCHAR(1000) NULL,
    subtotal           DECIMAL(12,2) NOT NULL CONSTRAINT DF_Orders_subtotal DEFAULT 0,
    discount_amount    DECIMAL(12,2) NOT NULL CONSTRAINT DF_Orders_discount DEFAULT 0,
    service_charge     DECIMAL(12,2) NOT NULL CONSTRAINT DF_Orders_service DEFAULT 0,
    total_amount       DECIMAL(12,2) NOT NULL CONSTRAINT DF_Orders_total DEFAULT 0,
    created_at         DATETIME2(0) NOT NULL CONSTRAINT DF_Orders_created_at DEFAULT SYSDATETIME(),
    updated_at         DATETIME2(0) NOT NULL CONSTRAINT DF_Orders_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_Orders PRIMARY KEY (order_id),
    CONSTRAINT FK_Orders_Reservations FOREIGN KEY (reservation_id) REFERENCES dbo.Reservations(reservation_id),
    CONSTRAINT FK_Orders_RestaurantTables FOREIGN KEY (table_id) REFERENCES dbo.RestaurantTables(table_id),
    CONSTRAINT FK_Orders_Customer FOREIGN KEY (customer_id) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT FK_Orders_CreatedByStaff FOREIGN KEY (created_by_staff_id) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT FK_Orders_QROrderSessions FOREIGN KEY (qr_session_id) REFERENCES dbo.QROrderSessions(qr_session_id),
    CONSTRAINT CK_Orders_type CHECK (order_type IN (N'Dine In', N'Preorder', N'QR Self')),
    CONSTRAINT CK_Orders_status CHECK (order_status IN
        (N'Open', N'Sent To Kitchen', N'Partially Served', N'Served', N'Billed', N'Paid', N'Cancelled')),
    CONSTRAINT CK_Orders_amounts CHECK (
        subtotal >= 0 AND discount_amount >= 0 AND service_charge >= 0 AND total_amount >= 0
        AND total_amount >= 0
    )
);
GO

CREATE TABLE dbo.OrderItems (
    order_item_id   INT IDENTITY(1,1) NOT NULL,
    order_id        INT NOT NULL,
    dish_id         INT NOT NULL,
    quantity        SMALLINT NOT NULL CONSTRAINT DF_OrderItems_quantity DEFAULT 1,
    unit_price      DECIMAL(12,2) NOT NULL,
    notes           NVARCHAR(255) NULL,
    item_status     NVARCHAR(25) NOT NULL CONSTRAINT DF_OrderItems_status DEFAULT N'Pending',
    line_total      AS (CONVERT(DECIMAL(12,2), quantity * unit_price)) PERSISTED,
    created_at      DATETIME2(0) NOT NULL CONSTRAINT DF_OrderItems_created_at DEFAULT SYSDATETIME(),
    updated_at      DATETIME2(0) NOT NULL CONSTRAINT DF_OrderItems_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_OrderItems PRIMARY KEY (order_item_id),
    CONSTRAINT FK_OrderItems_Orders FOREIGN KEY (order_id) REFERENCES dbo.Orders(order_id) ON DELETE CASCADE,
    CONSTRAINT FK_OrderItems_Dishes FOREIGN KEY (dish_id) REFERENCES dbo.Dishes(dish_id),
    CONSTRAINT CK_OrderItems_quantity CHECK (quantity > 0),
    CONSTRAINT CK_OrderItems_unit_price CHECK (unit_price >= 0),
    CONSTRAINT CK_OrderItems_status CHECK (item_status IN
        (N'Pending', N'Sent To Kitchen', N'Preparing', N'Ready', N'Served', N'Cancelled'))
);
GO

CREATE TABLE dbo.KitchenTickets (
    kitchen_ticket_id INT IDENTITY(1,1) NOT NULL,
    order_item_id     INT NOT NULL,
    kitchen_status    NVARCHAR(20) NOT NULL CONSTRAINT DF_KitchenTickets_status DEFAULT N'Pending',
    priority_level    TINYINT NOT NULL CONSTRAINT DF_KitchenTickets_priority DEFAULT 3,
    assigned_to_staff_id INT NULL,
    sent_at           DATETIME2(0) NOT NULL CONSTRAINT DF_KitchenTickets_sent_at DEFAULT SYSDATETIME(),
    started_at        DATETIME2(0) NULL,
    ready_at          DATETIME2(0) NULL,
    cancelled_at      DATETIME2(0) NULL,
    CONSTRAINT PK_KitchenTickets PRIMARY KEY (kitchen_ticket_id),
    CONSTRAINT UQ_KitchenTickets_order_item UNIQUE (order_item_id),
    CONSTRAINT FK_KitchenTickets_OrderItems FOREIGN KEY (order_item_id) REFERENCES dbo.OrderItems(order_item_id) ON DELETE CASCADE,
    CONSTRAINT FK_KitchenTickets_AssignedTo FOREIGN KEY (assigned_to_staff_id) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT CK_KitchenTickets_status CHECK (kitchen_status IN (N'Pending', N'Preparing', N'Ready', N'Cancelled')),
    CONSTRAINT CK_KitchenTickets_priority CHECK (priority_level BETWEEN 1 AND 5),
    CONSTRAINT CK_KitchenTickets_timeline CHECK (
        (started_at IS NULL OR started_at >= sent_at)
        AND (ready_at IS NULL OR started_at IS NOT NULL)
        AND (ready_at IS NULL OR ready_at >= started_at)
        AND (cancelled_at IS NULL OR cancelled_at >= sent_at)
    )
);
GO

-- =============================================================
-- 5. PAYMENTS, PROMOTIONS, VOUCHERS
-- =============================================================

CREATE TABLE dbo.PaymentMethods (
    payment_method_id TINYINT IDENTITY(1,1) NOT NULL,
    method_name       NVARCHAR(50) NOT NULL,
    is_active         BIT NOT NULL CONSTRAINT DF_PaymentMethods_is_active DEFAULT 1,
    created_at        DATETIME2(0) NOT NULL CONSTRAINT DF_PaymentMethods_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_PaymentMethods PRIMARY KEY (payment_method_id),
    CONSTRAINT UQ_PaymentMethods_method_name UNIQUE (method_name)
);
GO

CREATE TABLE dbo.Payments (
    payment_id        INT IDENTITY(1,1) NOT NULL,
    order_id          INT NOT NULL,
    payment_method_id TINYINT NOT NULL,
    amount_paid       DECIMAL(12,2) NOT NULL,
    change_given      DECIMAL(12,2) NOT NULL CONSTRAINT DF_Payments_change DEFAULT 0,
    payment_status    NVARCHAR(20) NOT NULL CONSTRAINT DF_Payments_status DEFAULT N'Pending',
    transaction_ref   NVARCHAR(120) NULL,
    processed_by_staff_id INT NULL,
    paid_at           DATETIME2(0) NULL,
    created_at        DATETIME2(0) NOT NULL CONSTRAINT DF_Payments_created_at DEFAULT SYSDATETIME(),
    updated_at        DATETIME2(0) NOT NULL CONSTRAINT DF_Payments_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_Payments PRIMARY KEY (payment_id),
    CONSTRAINT FK_Payments_Orders FOREIGN KEY (order_id) REFERENCES dbo.Orders(order_id),
    CONSTRAINT FK_Payments_PaymentMethods FOREIGN KEY (payment_method_id) REFERENCES dbo.PaymentMethods(payment_method_id),
    CONSTRAINT FK_Payments_ProcessedBy FOREIGN KEY (processed_by_staff_id) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT CK_Payments_amount CHECK (amount_paid > 0),
    CONSTRAINT CK_Payments_change CHECK (change_given >= 0),
    CONSTRAINT CK_Payments_status CHECK (payment_status IN (N'Pending', N'Completed', N'Refunded', N'Failed'))
);
GO

CREATE TABLE dbo.Promotions (
    promotion_id       INT IDENTITY(1,1) NOT NULL,
    promotion_name     NVARCHAR(150) NOT NULL,
    description        NVARCHAR(1000) NULL,
    discount_type      NVARCHAR(20) NOT NULL,
    discount_value     DECIMAL(12,2) NOT NULL,
    min_order_value    DECIMAL(12,2) NOT NULL CONSTRAINT DF_Promotions_min_order DEFAULT 0,
    max_discount       DECIMAL(12,2) NULL,
    start_at           DATETIME2(0) NOT NULL,
    end_at             DATETIME2(0) NOT NULL,
    is_active          BIT NOT NULL CONSTRAINT DF_Promotions_is_active DEFAULT 1,
    created_by_staff_id INT NULL,
    created_at         DATETIME2(0) NOT NULL CONSTRAINT DF_Promotions_created_at DEFAULT SYSDATETIME(),
    updated_at         DATETIME2(0) NOT NULL CONSTRAINT DF_Promotions_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_Promotions PRIMARY KEY (promotion_id),
    CONSTRAINT FK_Promotions_CreatedBy FOREIGN KEY (created_by_staff_id) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT CK_Promotions_discount_type CHECK (discount_type IN (N'Percent', N'Fixed')),
    CONSTRAINT CK_Promotions_discount_value CHECK (
        discount_value > 0 AND
        ((discount_type = N'Percent' AND discount_value <= 100) OR discount_type = N'Fixed')
    ),
    CONSTRAINT CK_Promotions_min_order CHECK (min_order_value >= 0),
    CONSTRAINT CK_Promotions_max_discount CHECK (max_discount IS NULL OR max_discount >= 0),
    CONSTRAINT CK_Promotions_date CHECK (end_at > start_at)
);
GO

CREATE TABLE dbo.Vouchers (
    voucher_id       INT IDENTITY(1,1) NOT NULL,
    promotion_id     INT NOT NULL,
    voucher_code     NVARCHAR(40) NOT NULL,
    usage_limit      INT NOT NULL CONSTRAINT DF_Vouchers_usage_limit DEFAULT 1,
    times_used       INT NOT NULL CONSTRAINT DF_Vouchers_times_used DEFAULT 0,
    is_active        BIT NOT NULL CONSTRAINT DF_Vouchers_is_active DEFAULT 1,
    created_at       DATETIME2(0) NOT NULL CONSTRAINT DF_Vouchers_created_at DEFAULT SYSDATETIME(),
    updated_at       DATETIME2(0) NOT NULL CONSTRAINT DF_Vouchers_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_Vouchers PRIMARY KEY (voucher_id),
    CONSTRAINT UQ_Vouchers_code UNIQUE (voucher_code),
    CONSTRAINT FK_Vouchers_Promotions FOREIGN KEY (promotion_id) REFERENCES dbo.Promotions(promotion_id) ON DELETE CASCADE,
    CONSTRAINT CK_Vouchers_usage CHECK (usage_limit > 0 AND times_used >= 0 AND times_used <= usage_limit)
);
GO

CREATE TABLE dbo.VoucherRedemptions (
    redemption_id       INT IDENTITY(1,1) NOT NULL,
    voucher_id          INT NOT NULL,
    payment_id          INT NOT NULL,
    customer_id         INT NULL,
    discount_amount     DECIMAL(12,2) NOT NULL,
    redeemed_at         DATETIME2(0) NOT NULL CONSTRAINT DF_VoucherRedemptions_redeemed_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_VoucherRedemptions PRIMARY KEY (redemption_id),
    CONSTRAINT UQ_VoucherRedemptions_payment UNIQUE (payment_id),
    CONSTRAINT FK_VoucherRedemptions_Vouchers FOREIGN KEY (voucher_id) REFERENCES dbo.Vouchers(voucher_id),
    CONSTRAINT FK_VoucherRedemptions_Payments FOREIGN KEY (payment_id) REFERENCES dbo.Payments(payment_id),
    CONSTRAINT FK_VoucherRedemptions_Customer FOREIGN KEY (customer_id) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT CK_VoucherRedemptions_discount CHECK (discount_amount >= 0)
);
GO

-- =============================================================
-- 6. REVIEWS, NOTIFICATIONS, REPORTS, AUDIT, RECOMMENDATIONS
-- =============================================================

CREATE TABLE dbo.Notifications (
    notification_id    INT IDENTITY(1,1) NOT NULL,
    user_id            INT NOT NULL,
    notification_type  NVARCHAR(40) NOT NULL,
    title              NVARCHAR(200) NOT NULL,
    message_body       NVARCHAR(2000) NOT NULL,
    is_read            BIT NOT NULL CONSTRAINT DF_Notifications_is_read DEFAULT 0,
    sent_at            DATETIME2(0) NOT NULL CONSTRAINT DF_Notifications_sent_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_Notifications PRIMARY KEY (notification_id),
    CONSTRAINT FK_Notifications_UserAccounts FOREIGN KEY (user_id) REFERENCES dbo.UserAccounts(user_id) ON DELETE CASCADE,
    CONSTRAINT CK_Notifications_type CHECK (notification_type IN
        (N'Booking Confirmed', N'Booking Rejected', N'Booking Reminder',
         N'Order Ready', N'Payment Receipt', N'Promotion', N'System'))
);
GO

CREATE TABLE dbo.CustomerReviews (
    review_id        INT IDENTITY(1,1) NOT NULL,
    customer_id      INT NOT NULL,
    order_id         INT NOT NULL,
    food_rating      TINYINT NOT NULL,
    service_rating   TINYINT NOT NULL,
    ambiance_rating  TINYINT NULL,
    overall_rating   AS (CONVERT(TINYINT, ROUND(
                         (CONVERT(DECIMAL(4,2), food_rating)
                         + CONVERT(DECIMAL(4,2), service_rating)
                         + CONVERT(DECIMAL(4,2), ISNULL(ambiance_rating, food_rating))) / 3.0, 0))) PERSISTED,
    comment          NVARCHAR(1000) NULL,
    is_visible       BIT NOT NULL CONSTRAINT DF_CustomerReviews_is_visible DEFAULT 1,
    created_at       DATETIME2(0) NOT NULL CONSTRAINT DF_CustomerReviews_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_CustomerReviews PRIMARY KEY (review_id),
    CONSTRAINT UQ_CustomerReviews_customer_order UNIQUE (customer_id, order_id),
    CONSTRAINT FK_CustomerReviews_Customer FOREIGN KEY (customer_id) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT FK_CustomerReviews_Orders FOREIGN KEY (order_id) REFERENCES dbo.Orders(order_id),
    CONSTRAINT CK_CustomerReviews_food CHECK (food_rating BETWEEN 1 AND 5),
    CONSTRAINT CK_CustomerReviews_service CHECK (service_rating BETWEEN 1 AND 5),
    CONSTRAINT CK_CustomerReviews_ambiance CHECK (ambiance_rating IS NULL OR ambiance_rating BETWEEN 1 AND 5)
);
GO

CREATE TABLE dbo.ReportSnapshots (
    snapshot_id       INT IDENTITY(1,1) NOT NULL,
    report_type       NVARCHAR(40) NOT NULL,
    report_date       DATE NOT NULL,
    snapshot_json     NVARCHAR(MAX) NOT NULL,
    generated_by_staff_id INT NULL,
    generated_at      DATETIME2(0) NOT NULL CONSTRAINT DF_ReportSnapshots_generated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_ReportSnapshots PRIMARY KEY (snapshot_id),
    CONSTRAINT UQ_ReportSnapshots_type_date UNIQUE (report_type, report_date),
    CONSTRAINT FK_ReportSnapshots_GeneratedBy FOREIGN KEY (generated_by_staff_id) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT CK_ReportSnapshots_type CHECK (report_type IN
        (N'Daily Revenue', N'Weekly Revenue', N'Monthly Revenue',
         N'Best Selling', N'Reservation Stats', N'Table Utilization')),
    CONSTRAINT CK_ReportSnapshots_json CHECK (ISJSON(snapshot_json) = 1)
);
GO

CREATE TABLE dbo.AuditLogs (
    audit_log_id   BIGINT IDENTITY(1,1) NOT NULL,
    user_id        INT NULL,
    action_name    NVARCHAR(100) NOT NULL,
    target_table   NVARCHAR(128) NULL,
    target_id      INT NULL,
    old_value_json NVARCHAR(MAX) NULL,
    new_value_json NVARCHAR(MAX) NULL,
    ip_address     VARCHAR(45) NULL,
    created_at     DATETIME2(0) NOT NULL CONSTRAINT DF_AuditLogs_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_AuditLogs PRIMARY KEY (audit_log_id),
    CONSTRAINT FK_AuditLogs_UserAccounts FOREIGN KEY (user_id) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT CK_AuditLogs_old_json CHECK (old_value_json IS NULL OR ISJSON(old_value_json) = 1),
    CONSTRAINT CK_AuditLogs_new_json CHECK (new_value_json IS NULL OR ISJSON(new_value_json) = 1)
);
GO

CREATE TABLE dbo.RecommendationLogs (
    recommendation_id INT IDENTITY(1,1) NOT NULL,
    customer_id       INT NOT NULL,
    dish_id           INT NOT NULL,
    score             DECIMAL(5,4) NOT NULL CONSTRAINT DF_RecommendationLogs_score DEFAULT 0,
    reason            NVARCHAR(255) NULL,
    shown_at          DATETIME2(0) NOT NULL CONSTRAINT DF_RecommendationLogs_shown_at DEFAULT SYSDATETIME(),
    was_ordered       BIT NOT NULL CONSTRAINT DF_RecommendationLogs_was_ordered DEFAULT 0,
    CONSTRAINT PK_RecommendationLogs PRIMARY KEY (recommendation_id),
    CONSTRAINT FK_RecommendationLogs_Customer FOREIGN KEY (customer_id) REFERENCES dbo.UserAccounts(user_id) ON DELETE CASCADE,
    CONSTRAINT FK_RecommendationLogs_Dishes FOREIGN KEY (dish_id) REFERENCES dbo.Dishes(dish_id),
    CONSTRAINT CK_RecommendationLogs_score CHECK (score BETWEEN 0 AND 1)
);
GO
-- 1. Bảng cấu hình Ca làm việc (Ví dụ: Ca Sáng, Ca Tối)
CREATE TABLE dbo.Shifts (
    shift_id        TINYINT IDENTITY(1,1) NOT NULL,
    shift_name      NVARCHAR(50) NOT NULL,
    start_time      TIME(0) NOT NULL,
    end_time        TIME(0) NOT NULL,
    is_active       BIT NOT NULL CONSTRAINT DF_Shifts_is_active DEFAULT 1,
    CONSTRAINT PK_Shifts PRIMARY KEY (shift_id)
);
GO

-- 2. Bảng Xếp lịch làm việc (Nhân viên nào, làm ca nào, ngày nào)
CREATE TABLE dbo.StaffSchedules (
    schedule_id     INT IDENTITY(1,1) NOT NULL,
    user_id         INT NOT NULL, -- Tham chiếu tới nhân viên
    shift_id        TINYINT NOT NULL,
    work_date       DATE NOT NULL,
    attendance_status NVARCHAR(20) NOT NULL CONSTRAINT DF_StaffSchedules_status DEFAULT N'Scheduled',
    assigned_by     INT NULL, -- Manager nào xếp lịch
    created_at      DATETIME2(0) NOT NULL CONSTRAINT DF_StaffSchedules_created_at DEFAULT SYSDATETIME(),
    updated_at      DATETIME2(0) NOT NULL CONSTRAINT DF_StaffSchedules_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_StaffSchedules PRIMARY KEY (schedule_id),
    CONSTRAINT UQ_StaffSchedules_user_date_shift UNIQUE (user_id, work_date, shift_id),
    CONSTRAINT FK_StaffSchedules_UserAccounts FOREIGN KEY (user_id) REFERENCES dbo.UserAccounts(user_id) ON DELETE CASCADE,
    CONSTRAINT FK_StaffSchedules_Shifts FOREIGN KEY (shift_id) REFERENCES dbo.Shifts(shift_id),
    CONSTRAINT FK_StaffSchedules_AssignedBy FOREIGN KEY (assigned_by) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT CK_StaffSchedules_status CHECK (attendance_status IN (N'Scheduled', N'Present', N'Absent', N'On Leave'))
);
GO

-- =============================================================
-- INDEXES
-- =============================================================
CREATE INDEX IX_UserAccounts_role_id ON dbo.UserAccounts(role_id);
CREATE INDEX IX_RestaurantTables_area_status ON dbo.RestaurantTables(area_id, table_status);
CREATE INDEX IX_Dishes_category_available ON dbo.Dishes(category_id, is_available);
CREATE INDEX IX_Dishes_preorder_available ON dbo.Dishes(allow_preorder, is_available, preorder_sort);
CREATE INDEX IX_Reservations_start_status ON dbo.Reservations(reservation_start_at, reservation_status);
CREATE INDEX IX_Reservations_customer ON dbo.Reservations(customer_id);
CREATE INDEX IX_PreorderItems_reservation ON dbo.PreorderItems(reservation_id);
CREATE INDEX IX_QROrderSessions_table_status ON dbo.QROrderSessions(table_id, session_status);
CREATE INDEX IX_Orders_status_created ON dbo.Orders(order_status, created_at);
CREATE INDEX IX_Orders_table ON dbo.Orders(table_id);
CREATE INDEX IX_OrderItems_order ON dbo.OrderItems(order_id);
CREATE INDEX IX_OrderItems_dish ON dbo.OrderItems(dish_id);
CREATE INDEX IX_KitchenTickets_status_sent ON dbo.KitchenTickets(kitchen_status, sent_at);
CREATE INDEX IX_Payments_paid_at ON dbo.Payments(paid_at);
CREATE INDEX IX_Payments_order ON dbo.Payments(order_id);
CREATE INDEX IX_Vouchers_promotion ON dbo.Vouchers(promotion_id);
CREATE INDEX IX_CustomerReviews_order ON dbo.CustomerReviews(order_id);
CREATE INDEX IX_Notifications_user_read ON dbo.Notifications(user_id, is_read);
CREATE INDEX IX_OtpTokens_email_purpose_created ON dbo.OtpTokens(email, purpose, created_at DESC);
CREATE INDEX IX_OtpTokens_user_purpose_created ON dbo.OtpTokens(user_id, purpose, created_at DESC);
GO

-- =============================================================
-- SAMPLE INSERT DATA
-- =============================================================

SET IDENTITY_INSERT dbo.Roles ON;
INSERT INTO dbo.Roles (role_id, role_name, description) VALUES
(1, N'Customer', N'Registered customer using the public web app'),
(2, N'Restaurant Staff', N'Receptionist, waiter, cashier and floor staff'),
(3, N'Kitchen Staff', N'Kitchen users working with the Kitchen Display System'),
(4, N'Manager', N'Restaurant manager with operational and reporting access'),
(5, N'Admin', N'System administrator or restaurant owner');
SET IDENTITY_INSERT dbo.Roles OFF;
GO

SET IDENTITY_INSERT dbo.UserAccounts ON;
INSERT INTO dbo.UserAccounts
(user_id, role_id, full_name, email, phone, password_hash, is_active, email_verified, last_login_at)
VALUES
(1, 5, N'Nguyen Van Admin',  N'admin@phurai.vn',    '0901000001', N'$2b$12$admin_hash',   1, 1, '2026-05-18T08:00:00'),
(2, 4, N'Dang Quang Phu',  N'phumanager@phurai.vn',  '0901000002', N'$2b$10$e04PpX9xUpPuRyW89qcv7.X/Lgfq.6sl319ehCioPrEW1nLXeQis6', 1, 1, '2026-05-18T08:10:00'),
(3, 2, N'Dang Quang Phu',      N'phustaff1@phurai.vn',   '0901000003', N'$2b$10$.s0tXgRsluKKb9rvQOvLB.8Xk6NNncuUhw3EIbrqp70Ap6knasgP6',  1, 1, '2026-05-18T08:30:00'),
(4, 2, N'Pham Thi Thuy',    N'thuystaff@phurai.vn',   '0901000004', N'$2b$10$.s0tXgRsluKKb9rvQOvLB.8Xk6NNncuUhw3EIbrqp70Ap6knasgP6',  1, 1, NULL),
(5, 3, N'Hoang Van Chef',    N'kitchen1@phurai.vn', '0901000005', N'$2b$12$chef1_hash',   1, 1, '2026-05-18T09:00:00'),
(6, 3, N'Do Thi Chef',       N'kitchen2@phurai.vn', '0901000006', N'$2b$12$chef2_hash',   1, 1, NULL),

-- Existing customer accounts
(7, 1, N'Minh Khoa',         N'khoa@gmail.com',     '0908000001', N'$2b$12$cust1_hash',   1, 1, '2026-05-17T20:00:00'),
(8, 1, N'Thu Huong',         N'huong@gmail.com',    '0908000002', N'$2b$12$cust2_hash',   1, 1, '2026-05-17T21:00:00'),
(9, 1, N'Bao Nguyen',        N'bao@gmail.com',      '0908000003', N'$2b$12$cust3_hash',   1, 0, NULL),
(10,1, N'Lan Anh',           N'lananh@gmail.com',   '0908000004', N'$2b$12$cust4_hash',   1, 1, NULL),

-- New customer accounts for login/profile testing
(11,1, N'Nguyen Minh An',    N'nguyenminhan@gmail.com', '0909000001', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, NULL),
(12,1, N'Tran My Linh',      N'tranmylinh@gmail.com',   '0909000002', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, NULL),
(13,1, N'Le Bao Khanh',      N'lebaokhanh@gmail.com',   '0909000003', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, NULL);
SET IDENTITY_INSERT dbo.UserAccounts OFF;
GO

SET IDENTITY_INSERT dbo.CustomerProfiles ON;
INSERT INTO dbo.CustomerProfiles
(customer_id, user_id, username, date_of_birth, gender, country, [language], bio, loyalty_points, membership_tier, preferences)
VALUES
(1, 7,  N'minhkhoa',  '2003-02-10', N'Male',   N'Vietnam', N'Vietnamese',
    N'Likes salmon and quiet seating.',
    150,  N'Bronze',
    N'["Salmon","Quiet seating","Window seat"]'),

(2, 8,  N'thuhuong',  '2002-09-05', N'Female', N'Vietnam', N'English',
    N'Prefers VIP area and elegant dining experience.',
    520,  N'Silver',
    N'["VIP area","Desserts","Light spicy"]'),

(3, 9,  N'baonguyen', '2004-01-20', N'Male',   N'Vietnam', N'Vietnamese',
    N'Prefers simple food and no spicy dishes.',
    80,   N'Bronze',
    N'["No spicy food","Main dining","Orange juice"]'),

(4, 10, N'lananh',    '2001-12-15', N'Female', N'Vietnam', N'English',
    N'Usually books private rooms for business dinners.',
    980,  N'Gold',
    N'["Private room","Business dinner","Chef recommendation"]'),

-- New profile test users
(5, 11, N'annguyen',  '2004-01-12', N'Male',   N'Vietnam', N'Vietnamese',
    N'Enjoys casual dining and signature dishes.',
    120,  N'Bronze',
    N'["Window seat","Mild spicy","Salmon sushi"]'),

(6, 12, N'linhtran',  '2003-08-21', N'Female', N'Vietnam', N'English',
    N'Prefers elegant seating and light desserts.',
    620,  N'Silver',
    N'["VIP area","Desserts","No seafood allergy"]'),

(7, 13, N'baokhanh',  '2001-12-05', N'Other',  N'Vietnam', N'Vietnamese',
    N'Diamond member who often books private rooms.',
    1800, N'Diamond',
    N'["Private room","Chef recommendation","Premium wine pairing"]');
SET IDENTITY_INSERT dbo.CustomerProfiles OFF;
GO

SET IDENTITY_INSERT dbo.StaffProfiles ON;
INSERT INTO dbo.StaffProfiles (staff_id, user_id, staff_code, job_title, hire_date, employment_status, base_salary)
VALUES
(1, 1, 'ADM001', 'System Admin',       '2025-01-01', N'Active', 25000000),
(2, 2, 'MGR001', 'Restaurant Manager', '2025-01-15', N'Active', 22000000),
(3, 3, 'STF001', 'Receptionist',       '2025-02-01', N'Active', 12000000),
(4, 4, 'STF002', 'Waiter',             '2025-02-05', N'Active', 11000000),
(5, 5, 'KIT001', 'Head Chef',          '2025-01-20', N'Active', 18000000),
(6, 6, 'KIT002', 'Sous Chef',          '2025-03-01', N'Active', 15000000);
SET IDENTITY_INSERT dbo.StaffProfiles OFF;
GO

INSERT INTO dbo.RestaurantSettings (setting_key, setting_value, description, updated_by) VALUES
(N'restaurant_name',  N'Phūrai Premium Restaurant', N'Display name', 1),
(N'open_time',        N'10:00',                     N'Opening time', 1),
(N'close_time',       N'22:00',                     N'Closing time', 1),
(N'table_hold_min',   N'15',                        N'Minutes to hold reserved table', 1),
(N'service_charge',   N'5',                         N'Service charge percent', 1),
(N'max_guests',       N'12',                        N'Max guests per reservation', 1),
(N'cancel_deadline_h',N'2',                         N'Hours before reservation to cancel', 1);
GO

SET IDENTITY_INSERT dbo.RestaurantAreas ON;
INSERT INTO dbo.RestaurantAreas (area_id, area_name, area_type, description) VALUES
(1, N'Window Area',      N'Regular', N'Window-side seating for guests who prefer natural light and quiet dining'),
(2, N'Standard Area',    N'Regular', N'Primary dining area with regular restaurant tables'),
(3, N'Premium Area',     N'VIP',     N'Elevated premium seating with better spacing and atmosphere'),
(4, N'VIP Lounge',       N'VIP',     N'VIP seating area for premium guests and special occasions'),
(5, N'Private Room',     N'Private', N'Private dining room for business dinners, birthdays and celebrations'),
(6, N'Kitchen View',     N'Bar',     N'Chef counter seating near the open kitchen'),
(7, N'Rooftop Outdoor',  N'Outdoor', N'Outdoor rooftop seating with open-air dining experience');
SET IDENTITY_INSERT dbo.RestaurantAreas OFF;
GO

SET IDENTITY_INSERT dbo.RestaurantTables ON;
INSERT INTO dbo.RestaurantTables
(table_id, area_id, table_number, capacity, table_status, static_qr_code)
VALUES
-- Window Area
(1,  1, N'W-01',   2, N'Available', N'qr-w-01'),
(2,  1, N'W-02',   2, N'Available', N'qr-w-02'),
(3,  1, N'W-03',   4, N'Reserved',  N'qr-w-03'),
(4,  1, N'W-04',   4, N'Occupied',  N'qr-w-04'),
(5,  1, N'W-05',   2, N'Available', N'qr-w-05'),

-- Standard Area
(6,  2, N'S-01',   2, N'Available', N'qr-s-01'),
(7,  2, N'S-02',   2, N'Available', N'qr-s-02'),
(8,  2, N'S-03',   4, N'Available', N'qr-s-03'),
(9,  2, N'S-04',   4, N'Occupied',  N'qr-s-04'),
(10, 2, N'S-05',   6, N'Reserved',  N'qr-s-05'),
(11, 2, N'S-06',   6, N'Cleaning',  N'qr-s-06'),
(12, 2, N'S-07',   4, N'Available', N'qr-s-07'),
(13, 2, N'S-08',   6, N'Reserved',  N'qr-s-08'),

-- Premium Area
(14, 3, N'PRE-01', 2, N'Available', N'qr-pre-01'),
(15, 3, N'PRE-02', 4, N'Available', N'qr-pre-02'),
(16, 3, N'PRE-03', 6, N'Reserved',  N'qr-pre-03'),
(17, 3, N'PRE-04', 4, N'Available', N'qr-pre-04'),

-- VIP Lounge
(18, 4, N'VIP-01', 4, N'Available', N'qr-vip-01'),
(19, 4, N'VIP-02', 6, N'Occupied',  N'qr-vip-02'),
(20, 4, N'VIP-03', 8, N'Available', N'qr-vip-03'),

-- Private Room
(21, 5, N'PR-01', 10, N'Available', N'qr-pr-01'),
(22, 5, N'PR-02',  8, N'Occupied',  N'qr-pr-02'),

-- Kitchen View
(23, 6, N'K-01',   1, N'Available', N'qr-k-01'),
(24, 6, N'K-02',   2, N'Cleaning',  N'qr-k-02'),
(25, 6, N'K-03',   1, N'Available', N'qr-k-03'),

-- Rooftop / Outdoor
(26, 7, N'R-01',   4, N'Available', N'qr-r-01'),
(27, 7, N'R-02',   6, N'Reserved',  N'qr-r-02'),
(28, 7, N'R-03',   4, N'Cleaning',  N'qr-r-03');
SET IDENTITY_INSERT dbo.RestaurantTables OFF;
GO

SET IDENTITY_INSERT dbo.MenuCategories ON;
INSERT INTO dbo.MenuCategories (category_id, category_name, display_order) VALUES
(1, N'Sushi & Sashimi',     1),
(2, N'Noodle & Rice',       2),
(3, N'Signature Dish',      3),
(4, N'Seafood',             4),
(5, N'Barbecue & Grill',    5),
(6, N'Desserts',            6),
(7, N'Beverages',           7),
(8, N'Chef''s Set Menu',    8);
SET IDENTITY_INSERT dbo.MenuCategories OFF;
GO

SET IDENTITY_INSERT dbo.Dishes ON;
INSERT INTO dbo.Dishes
(dish_id, category_id, dish_name, description, price, cost_price, is_available, is_recommended, spicy_level, prep_time_min)
VALUES
(1,  1, N'YELLOWTAIL JALAPEÑO',        N'thinly sliced yellowtail, yuzu soy sauce, garlic puree, jalapeño',                          168000,  58000, 1, 1, 1, 10),
(2,  1, N'TORO TARTARE WITH CAVIAR',    N'finely chopped fatty tuna with wasabi soy and oscietra caviar',                           428000, 150000, 1, 1, 0, 12),
(3,  1, N'FLUKE SASHIMI DRY MISO',      N'yuzu juice, extra virgin olive oil, dry miso, chives',                                    188000,  65000, 1, 0, 0, 10),
(4,  1, N'NEW STYLE SASHIMI',           N'seared sashimi with sesame seeds, chives, ginger, and garlic soy',                      228000,  80000, 1, 1, 0, 12),
(5,  1, N'SALMON NEW STYLE',            N'atlantic salmon, thinly sliced, seared with hot olive oil',                               168000,  58000, 1, 1, 0, 10),
(6,  2, N'SEAFOOD UDON',                N'thick wheat noodles with assorted seafood in a rich dashi broth',                          148000,  52000, 1, 0, 0, 15),
(7,  2, N'WAGYU FRIED RICE',            N'wok-charred rice with premium wagyu beef and seasonal vegetables',                        188000,  66000, 1, 1, 0, 14),
(8,  2, N'LOBSTER FRIED RICE',          N'delicate jasmine rice with butter-poached lobster and garlic',                              260000,  91000, 1, 1, 0, 16),
(9,  3, N'BLACK COD WITH MISO',         N'tender black cod marinated for three days in a sweet miso glaze',                         499000, 175000, 1, 1, 0, 22),
(10, 3, N'ROCK SHRIMP TEMPURA',         N'served with either creamy spicy sauce or butter ponzu',                                   690000, 240000, 1, 1, 1, 18),
(11, 4, N'LOBSTER WASABI PEPPER',       N'whole lobster sautéed with black pepper, wasabi, and seasonal greens',                    690000, 240000, 1, 1, 2, 25),
(12, 4, N'GRILLED SALMON',              N'anticucho or teriyaki glaze, served with crispy baby bok choy',                           248000,  87000, 1, 1, 0, 18),
(13, 5, N'JAPANESE A5 WAGYU',           N'the pinnacle of beef quality, flame-grilled over binchotan charcoal',                     890000, 310000, 1, 1, 0, 20),
(14, 5, N'GRILLED LAMB CHOPS',          N'marinated in rosemary and garlic, served with rosemary-miso sauce',                       360000, 126000, 1, 0, 0, 22),
(15, 6, N'BENTO BOX CHOCOLATE CAKE',    N'warm chocolate fondant with green tea matcha ice cream',                                   98000,  34000, 1, 1, 0,  8),
(16, 6, N'MISO CAPPUCCINO',             N'coffee soil, miso foam, salted caramel ice cream',                                        118000,  41000, 1, 0, 0, 10),
(17, 7, N'HOKUSETSU JUNMAI',            N'premium house sake, clean and dry profile',                                               89000,  31000, 1, 1, 0,  2),
(18, 7, N'LYCHEE MARTINI',              N'vodka, lychee liqueur, fresh lychee juice',                                                89000,  31000, 1, 1, 0,  3),
(19, 8, N'OMAKASE EXPERIENCE',          N'a personalized multi-course journey designed by our head chef',                          1290000, 450000, 1, 1, 0, 90),
(20, 8, N'SIGNATURE TASTING',           N'a curated seven-course menu featuring our world-renowned signature dishes',                990000, 346000, 1, 1, 0, 75);
SET IDENTITY_INSERT dbo.Dishes OFF;
GO

UPDATE dbo.Dishes
SET allow_preorder = 1,
    preorder_sort = dish_id
WHERE dish_id IN (1, 4, 5, 7, 9, 10, 12, 13, 15, 18, 20);
GO

SET IDENTITY_INSERT dbo.DishImages ON;
INSERT INTO dbo.DishImages (image_id, dish_id, image_url, is_primary) VALUES
(1,  1,  N'/images/menu/yellowtail-jalapeno.jpg',    1),
(2,  2,  N'/images/menu/toro-tartare.jpg',           1),
(3,  3,  N'/images/menu/fluke-sashimi.jpg',          1),
(4,  4,  N'/images/menu/new-style-sashimi.jpg',      1),
(5,  5,  N'/images/menu/salmon-new-style.jpg',         1),
(6,  6,  N'/images/menu/seafood-udon.jpg',           1),
(7,  7,  N'/images/menu/wagyu-fried-rice.jpg',       1),
(8,  8,  N'/images/menu/lobster-fried-rice.jpg',     1),
(9,  9,  N'/images/menu/black-cod-miso.jpg',         1),
(10, 10, N'/images/menu/rock-shrimp-tempura.jpg',    1),
(11, 11, N'/images/menu/lobster-wasabi-pepper.jpg',  1),
(12, 12, N'/images/menu/grilled-salmon.jpg',         1),
(13, 13, N'/images/menu/japanese-a5-wagyu.jpg',      1),
(14, 14, N'/images/menu/grilled-lamb-chops.jpg',     1),
(15, 15, N'/images/menu/bento-chocolate-cake.jpg',   1),
(16, 16, N'/images/menu/miso-cappuccino.jpg',        1),
(17, 17, N'/images/menu/hokusetsu-junmai.jpg',       1),
(18, 18, N'/images/menu/lychee-martini.jpg',         1),
(19, 19, N'/images/menu/omakase-experience.jpg',     1),
(20, 20, N'/images/menu/signature-tasting.jpg',      1);
SET IDENTITY_INSERT dbo.DishImages OFF;
GO

SET IDENTITY_INSERT dbo.Reservations ON;
INSERT INTO dbo.Reservations
(reservation_id, customer_id, created_by_staff_id, preferred_area_id, reservation_start_at, reservation_end_at,
 guest_count, special_request, reservation_status, reservation_source, confirmed_by_staff_id, confirmed_at, checked_in_at)
VALUES
(1,  7, NULL, 1, '2026-05-20T18:30:00', '2026-05-20T20:30:00', 2, N'Window seat if possible', N'Confirmed',  N'Online',  3, '2026-05-18T09:15:00', NULL),
(2,  8, NULL, 4, '2026-05-20T19:00:00', '2026-05-20T21:00:00', 4, N'VIP area requested',      N'Confirmed',  N'Online',  3, '2026-05-18T10:00:00', NULL),
(3,  9, NULL, 2, '2026-05-21T12:00:00', '2026-05-21T14:00:00', 3, NULL,                       N'Pending',    N'Online',  NULL, NULL, NULL),
(4, 10, NULL, 5, '2026-05-21T20:00:00', '2026-05-21T22:00:00', 6, N'Business dinner',          N'Confirmed',  N'Online',  4, '2026-05-19T08:00:00', NULL),
(5, NULL,3,    2, '2026-05-18T18:00:00', '2026-05-18T20:00:00', 2, N'Walk-in guest',           N'Checked In', N'Walk-in', 3, '2026-05-18T17:55:00', '2026-05-18T18:00:00'),
(6,  7, NULL, 2, '2026-04-10T19:00:00', '2026-04-10T21:00:00', 2, NULL,                       N'Completed',  N'Online',  3, '2026-04-08T10:00:00', '2026-04-10T18:55:00'),
(7,  8, NULL, 4, '2026-04-15T20:00:00', '2026-04-15T22:00:00', 4, N'VIP birthday dinner',      N'Completed',  N'Online',  4, '2026-04-13T09:30:00', '2026-04-15T19:55:00');
SET IDENTITY_INSERT dbo.Reservations OFF;
GO

INSERT INTO dbo.ReservationTables (reservation_id, table_id, assigned_by_staff_id) VALUES
(1, 1, 3),    -- W-01
(2, 18, 3),   -- VIP-01
(4, 21, 4),   -- PR-01
(5, 6, 3),    -- S-01
(6, 7, 3),    -- S-02
(7, 18, 4);   -- VIP-01
GO

SET IDENTITY_INSERT dbo.PreorderItems ON;
INSERT INTO dbo.PreorderItems (preorder_item_id, reservation_id, dish_id, quantity, unit_price, notes) VALUES
(1, 2, 13, 1, 890000, N'Medium rare please'),
(2, 2, 9,  1, 499000, NULL),
(3, 2, 18, 2,  89000, NULL),
(4, 4, 11, 1, 690000, N'Extra wasabi pepper'),
(5, 4, 10, 2, 690000, NULL);
SET IDENTITY_INSERT dbo.PreorderItems OFF;
GO

SET IDENTITY_INSERT dbo.QROrderSessions ON;
INSERT INTO dbo.QROrderSessions
(qr_session_id, table_id, reservation_id, customer_id, token, session_status, generated_by_staff_id, generated_at, expires_at)
VALUES
(1, 3, NULL, NULL, N'qr-session-t03-20260518-1900', N'Active', 3, '2026-05-18T19:00:00', '2026-05-18T22:00:00'),
(2, 6, 2, 8,    N'qr-session-v02-20260520-1900', N'Active', 3, '2026-05-20T18:50:00', '2026-05-20T22:00:00');
SET IDENTITY_INSERT dbo.QROrderSessions OFF;
GO

SET IDENTITY_INSERT dbo.Orders ON;
INSERT INTO dbo.Orders
(order_id, reservation_id, table_id, customer_id, created_by_staff_id, qr_session_id, order_type, order_status,
 subtotal, discount_amount, service_charge, total_amount, created_at)
VALUES
(1, 5, 2, NULL, 3, NULL, N'Dine In',  N'Paid',            444000,     0, 22200,  466200, '2026-05-18T18:10:00'),
(2, 6, 2, 7,    3, NULL, N'Dine In',  N'Paid',           1316000, 50000, 63300, 1329300, '2026-04-10T19:10:00'),
(3, 7, 5, 8,    4, NULL, N'Dine In',  N'Paid',           1380000, 50000, 66500, 1396500, '2026-04-15T20:10:00'),
(4, 1, 1, 7,    3, NULL, N'Dine In',  N'Open',            425000,     0,     0,  425000, '2026-05-20T18:40:00'),
(5, 2, 6, 8,    3, 2,    N'Preorder', N'Sent To Kitchen', 1567000,     0, 78350, 1645350, '2026-05-20T19:00:00'),
(6, NULL,3,NULL,NULL,1,  N'QR Self',  N'Sent To Kitchen',  336000,     0,     0,  336000, '2026-05-18T19:05:00');
SET IDENTITY_INSERT dbo.Orders OFF;
GO

SET IDENTITY_INSERT dbo.OrderItems ON;
INSERT INTO dbo.OrderItems
(order_item_id, order_id, dish_id, quantity, unit_price, notes, item_status)
VALUES
(1,  1,  1, 1, 168000, NULL,            N'Served'),
(2,  1, 18, 2,  89000, NULL,            N'Served'),
(3,  1, 15, 1,  98000, NULL,            N'Served'),
(4,  2, 13, 1, 890000, N'Well done',    N'Served'),
(5,  2, 12, 1, 248000, NULL,            N'Served'),
(6,  2, 17, 2,  89000, NULL,            N'Served'),
(7,  3, 11, 1, 690000, N'Extra wasabi', N'Served'),
(8,  3, 10, 1, 690000, NULL,            N'Served'),
(9,  4,  1, 2, 168000, NULL,            N'Pending'),
(10, 4, 18, 1,  89000, NULL,            N'Pending'),
(11, 5, 13, 1, 890000, N'Medium rare',  N'Preparing'),
(12, 5,  9, 1, 499000, NULL,            N'Preparing'),
(13, 5, 18, 2,  89000, NULL,            N'Ready'),
(14, 6,  7, 1, 188000, NULL,            N'Preparing'),
(15, 6,  6, 1, 148000, N'No mushrooms', N'Pending');
SET IDENTITY_INSERT dbo.OrderItems OFF;
GO

SET IDENTITY_INSERT dbo.KitchenTickets ON;
INSERT INTO dbo.KitchenTickets
(kitchen_ticket_id, order_item_id, kitchen_status, priority_level, assigned_to_staff_id, sent_at, started_at, ready_at)
VALUES
(1, 11, N'Preparing', 2, 5, '2026-05-20T19:00:00', '2026-05-20T19:02:00', NULL),
(2, 12, N'Preparing', 2, 5, '2026-05-20T19:00:00', '2026-05-20T19:02:00', NULL),
(3, 13, N'Ready',     3, 6, '2026-05-20T19:00:00', '2026-05-20T19:01:00', '2026-05-20T19:08:00'),
(4, 14, N'Preparing', 3, 5, '2026-05-18T19:05:00', '2026-05-18T19:07:00', NULL),
(5, 15, N'Pending',   3, NULL,'2026-05-18T19:05:00', NULL, NULL);
SET IDENTITY_INSERT dbo.KitchenTickets OFF;
GO

SET IDENTITY_INSERT dbo.PaymentMethods ON;
INSERT INTO dbo.PaymentMethods (payment_method_id, method_name, is_active) VALUES
(1, N'Cash',      1),
(2, N'QR Code',   1),
(3, N'Bank Card', 1),
(4, N'Mock Pay',  1);
SET IDENTITY_INSERT dbo.PaymentMethods OFF;
GO

SET IDENTITY_INSERT dbo.Payments ON;
INSERT INTO dbo.Payments
(payment_id, order_id, payment_method_id, amount_paid, change_given, payment_status, transaction_ref, processed_by_staff_id, paid_at)
VALUES
(1, 1, 1, 466200, 0, N'Completed', NULL,                 3, '2026-05-18T20:30:00'),
(2, 2, 2, 1329300, 0, N'Completed', N'QR-20260410-001',   3, '2026-04-10T21:00:00'),
(3, 3, 3, 1396500, 0, N'Completed', N'CARD-20260415-001', 4, '2026-04-15T21:30:00');
SET IDENTITY_INSERT dbo.Payments OFF;
GO

SET IDENTITY_INSERT dbo.Promotions ON;
INSERT INTO dbo.Promotions
(promotion_id, promotion_name, description, discount_type, discount_value, min_order_value, max_discount, start_at, end_at, is_active, created_by_staff_id)
VALUES
(1, N'Weekend Special 10%', N'10% off during weekends', N'Percent', 10.00, 200000, 50000, '2026-01-01T00:00:00', '2026-12-31T23:59:59', 1, 1),
(2, N'New Member 50K',      N'Fixed 50K discount for new members', N'Fixed', 50000, 150000, NULL, '2026-01-01T00:00:00', '2026-06-30T23:59:59', 1, 1),
(3, N'VIP Summer 15%',      N'VIP area summer discount', N'Percent', 15.00, 500000, 100000, '2026-06-01T00:00:00', '2026-08-31T23:59:59', 1, 1);
SET IDENTITY_INSERT dbo.Promotions OFF;
GO

SET IDENTITY_INSERT dbo.Vouchers ON;
INSERT INTO dbo.Vouchers (voucher_id, promotion_id, voucher_code, usage_limit, times_used, is_active) VALUES
(1, 1, N'WEEKEND10', 100, 12, 1),
(2, 2, N'NEWMEM50',  200,  5, 1),
(3, 2, N'WELCOME50', 200,  3, 1),
(4, 3, N'VIPSUMMER',  50,  1, 1);
SET IDENTITY_INSERT dbo.Vouchers OFF;
GO

SET IDENTITY_INSERT dbo.VoucherRedemptions ON;
INSERT INTO dbo.VoucherRedemptions (redemption_id, voucher_id, payment_id, customer_id, discount_amount, redeemed_at) VALUES
(1, 2, 2, 7, 50000, '2026-04-10T21:00:00'),
(2, 1, 3, 8, 50000, '2026-04-15T21:30:00');
SET IDENTITY_INSERT dbo.VoucherRedemptions OFF;
GO

SET IDENTITY_INSERT dbo.Notifications ON;
INSERT INTO dbo.Notifications
(notification_id, user_id, notification_type, title, message_body, is_read, sent_at)
VALUES
(1, 7, N'Booking Confirmed', N'Đặt bàn đã được xác nhận',
    N'Đặt bàn ngày 20/05/2026 lúc 18:30 cho 2 người đã được xác nhận.', 1, '2026-05-18T09:15:00'),
(2, 8, N'Booking Confirmed', N'Đặt bàn đã được xác nhận',
    N'Đặt bàn ngày 20/05/2026 lúc 19:00 cho 4 người tại khu VIP đã được xác nhận.', 0, '2026-05-18T10:00:00'),
(3, 7, N'Booking Reminder', N'Nhắc lịch đặt bàn',
    N'Quý khách có đặt bàn vào ngày 20/05/2026 lúc 18:30. Hẹn gặp quý khách tại Phūrai!', 0, '2026-05-19T09:00:00');
SET IDENTITY_INSERT dbo.Notifications OFF;
GO

SET IDENTITY_INSERT dbo.CustomerReviews ON;
INSERT INTO dbo.CustomerReviews (review_id, customer_id, order_id, food_rating, service_rating, ambiance_rating, comment) VALUES
(1, 7, 2, 5, 5, 4, N'Japanese A5 Wagyu was exceptional. Attentive service — we will return for omakase.'),
(2, 8, 3, 4, 5, 5, N'Lobster Wasabi Pepper was bold and memorable. The VIP lounge felt refined and comfortable.');
SET IDENTITY_INSERT dbo.CustomerReviews OFF;
GO

SET IDENTITY_INSERT dbo.ReportSnapshots ON;
INSERT INTO dbo.ReportSnapshots
(snapshot_id, report_type, report_date, snapshot_json, generated_by_staff_id, generated_at)
VALUES
(1, N'Daily Revenue', '2026-05-18', N'{"totalPayments":1,"netRevenue":466200}', 2, '2026-05-18T22:00:00'),
(2, N'Best Selling',  '2026-04-30', N'{"topDish":"JAPANESE A5 WAGYU","quantity":2}', 2, '2026-04-30T22:00:00');
SET IDENTITY_INSERT dbo.ReportSnapshots OFF;
GO

SET IDENTITY_INSERT dbo.AuditLogs ON;
INSERT INTO dbo.AuditLogs
(audit_log_id, user_id, action_name, target_table, target_id, old_value_json, new_value_json, ip_address, created_at)
VALUES
(1, 3, N'CONFIRM_RESERVATION', N'Reservations', 1,
 N'{"reservation_status":"Pending"}',
 N'{"reservation_status":"Confirmed"}',
 '127.0.0.1', '2026-05-18T09:15:00');
SET IDENTITY_INSERT dbo.AuditLogs OFF;
GO

SET IDENTITY_INSERT dbo.RecommendationLogs ON;
INSERT INTO dbo.RecommendationLogs
(recommendation_id, customer_id, dish_id, score, reason, shown_at, was_ordered)
VALUES
(1, 7, 13, 0.9200, N'Customer often orders premium wagyu and grill items', '2026-05-18T12:00:00', 1),
(2, 8, 11, 0.8700, N'Popular VIP table seafood selection',                 '2026-05-18T12:05:00', 1);
SET IDENTITY_INSERT dbo.RecommendationLogs OFF;
GO


INSERT INTO dbo.RestaurantSettings (setting_key, setting_value, description, updated_by) VALUES
(N'hours_mon_thu', N'7:00 AM — 12:00 AM',      N'Opening hours: Monday to Thursday', 1),
(N'hours_fri_sat', N'7:00 AM — 12:00 AM',      N'Opening hours: Friday to Saturday', 1),
(N'hours_sunday',  N'7:00 PM — 10:00 PM',      N'Opening hours: Sunday', 1),
(N'hours_happy',   N'4:00 PM — 7:00 PM Daily', N'Happy Hour timing', 1);
GO

-- 3. Cập nhật luôn lại bảng Shifts (Ca làm việc) cho khớp với giờ mở cửa thực tế
-- Khách vào lúc 7:00 AM thì nhân viên phải có mặt từ 6:30 AM
DELETE FROM dbo.Shifts;
DBCC CHECKIDENT ('dbo.Shifts', RESEED, 0); -- Reset Identity ID về lại từ đầu

INSERT INTO dbo.Shifts (shift_name, start_time, end_time) VALUES
(N'Morning Shift',   '06:30:00', '14:30:00'), -- Ca Sáng: Bao gồm cả giờ chuẩn bị quán
(N'Afternoon Shift', '14:00:00', '22:00:00'), -- Ca Chiều
(N'Night Shift',     '16:30:00', '00:30:00'); -- Ca Tối: Đóng cửa lúc 12:00 AM, dọn dẹp đến 00:30
GO

SET IDENTITY_INSERT dbo.RestaurantAreas ON;

INSERT INTO dbo.RestaurantAreas (area_id, area_name, area_type, description) VALUES
(8, N'Wine Bar',        N'Bar',      N'Counter seating for wine tasting'),
(9, N'Event Corner',    N'Regular',  N'Flexible space for events'),
(10, N'Rooftop Terrace', N'Outdoor',  N'Outdoor open-air seating');

SET IDENTITY_INSERT dbo.RestaurantAreas OFF;
GO
-- =============================================================
-- SAMPLE SELECT QUERIES
-- =============================================================

-- Q01. Reservation management: reservations for a selected date.
DECLARE @ReservationDate DATE = '2026-05-20';

SELECT
    r.reservation_id,
    COALESCE(c.full_name, N'Walk-in Guest') AS customer_name,
    c.phone,
    r.reservation_start_at,
    r.reservation_end_at,
    r.guest_count,
    a.area_name AS preferred_area,
    a.area_type,
    STRING_AGG(t.table_number, N', ') WITHIN GROUP (ORDER BY t.table_number) AS assigned_tables,
    r.reservation_status,
    r.reservation_source,
    staff.full_name AS confirmed_by,
    r.confirmed_at
FROM dbo.Reservations r
LEFT JOIN dbo.UserAccounts c ON r.customer_id = c.user_id
LEFT JOIN dbo.RestaurantAreas a ON r.preferred_area_id = a.area_id
LEFT JOIN dbo.ReservationTables rt ON r.reservation_id = rt.reservation_id
LEFT JOIN dbo.RestaurantTables t ON rt.table_id = t.table_id
LEFT JOIN dbo.UserAccounts staff ON r.confirmed_by_staff_id = staff.user_id
WHERE CAST(r.reservation_start_at AS DATE) = @ReservationDate
GROUP BY
    r.reservation_id, c.full_name, c.phone, r.reservation_start_at, r.reservation_end_at,
    r.guest_count, a.area_name, a.area_type, r.reservation_status, r.reservation_source,
    staff.full_name, r.confirmed_at
ORDER BY r.reservation_start_at;
GO

-- Q02. Pre-order dishes for a reservation.
DECLARE @ReservationId INT = 2;

SELECT
    r.reservation_id,
    c.full_name AS customer_name,
    r.reservation_start_at,
    d.dish_name,
    pi.quantity,
    pi.unit_price,
    pi.quantity * pi.unit_price AS line_total,
    pi.notes
FROM dbo.PreorderItems pi
JOIN dbo.Reservations r ON pi.reservation_id = r.reservation_id
LEFT JOIN dbo.UserAccounts c ON r.customer_id = c.user_id
JOIN dbo.Dishes d ON pi.dish_id = d.dish_id
WHERE pi.reservation_id = @ReservationId
ORDER BY pi.preorder_item_id;
GO

-- Q03. Order management: order detail / receipt view.
DECLARE @OrderId INT = 5;

SELECT
    o.order_id,
    t.table_number,
    o.order_type,
    o.order_status,
    d.dish_name,
    oi.quantity,
    oi.unit_price,
    oi.line_total,
    oi.notes,
    oi.item_status
FROM dbo.Orders o
JOIN dbo.OrderItems oi ON o.order_id = oi.order_id
JOIN dbo.Dishes d ON oi.dish_id = d.dish_id
JOIN dbo.RestaurantTables t ON o.table_id = t.table_id
WHERE o.order_id = @OrderId
ORDER BY oi.order_item_id;
GO

-- Q04. Kitchen Display System: pending and preparing tickets.
SELECT
    kt.kitchen_ticket_id,
    o.order_id,
    t.table_number,
    d.dish_name,
    oi.quantity,
    oi.notes AS special_notes,
    kt.priority_level,
    kt.kitchen_status,
    chef.full_name AS assigned_to,
    kt.sent_at,
    DATEDIFF(MINUTE, kt.sent_at, SYSDATETIME()) AS wait_minutes
FROM dbo.KitchenTickets kt
JOIN dbo.OrderItems oi ON kt.order_item_id = oi.order_item_id
JOIN dbo.Orders o ON oi.order_id = o.order_id
JOIN dbo.RestaurantTables t ON o.table_id = t.table_id
JOIN dbo.Dishes d ON oi.dish_id = d.dish_id
LEFT JOIN dbo.UserAccounts chef ON kt.assigned_to_staff_id = chef.user_id
WHERE kt.kitchen_status IN (N'Pending', N'Preparing')
ORDER BY kt.priority_level ASC, kt.sent_at ASC;
GO

-- Q05. Payment history with method and voucher details.
SELECT
    p.payment_id,
    p.paid_at,
    o.order_id,
    t.table_number,
    COALESCE(c.full_name, N'Guest') AS customer_name,
    pm.method_name AS payment_method,
    o.subtotal,
    o.discount_amount,
    o.service_charge,
    o.total_amount,
    p.amount_paid,
    p.change_given,
    p.payment_status,
    v.voucher_code,
    pr.promotion_name,
    cashier.full_name AS processed_by
FROM dbo.Payments p
JOIN dbo.Orders o ON p.order_id = o.order_id
JOIN dbo.RestaurantTables t ON o.table_id = t.table_id
JOIN dbo.PaymentMethods pm ON p.payment_method_id = pm.payment_method_id
LEFT JOIN dbo.UserAccounts c ON o.customer_id = c.user_id
LEFT JOIN dbo.UserAccounts cashier ON p.processed_by_staff_id = cashier.user_id
LEFT JOIN dbo.VoucherRedemptions vr ON p.payment_id = vr.payment_id
LEFT JOIN dbo.Vouchers v ON vr.voucher_id = v.voucher_id
LEFT JOIN dbo.Promotions pr ON v.promotion_id = pr.promotion_id
ORDER BY p.paid_at DESC;
GO

-- Q06. Daily revenue report for the last 30 days.
SELECT
    CAST(p.paid_at AS DATE) AS revenue_date,
    COUNT(DISTINCT p.payment_id) AS total_transactions,
    COUNT(DISTINCT o.customer_id) AS registered_customers,
    SUM(o.subtotal) AS gross_revenue,
    SUM(o.discount_amount) AS total_discounts,
    SUM(o.service_charge) AS service_charges,
    SUM(p.amount_paid) AS net_revenue
FROM dbo.Payments p
JOIN dbo.Orders o ON p.order_id = o.order_id
WHERE p.payment_status = N'Completed'
  AND p.paid_at >= DATEADD(DAY, -30, SYSDATETIME())
GROUP BY CAST(p.paid_at AS DATE)
ORDER BY revenue_date DESC;
GO

-- Q07. Monthly revenue report for the current year.
SELECT
    YEAR(p.paid_at) AS revenue_year,
    MONTH(p.paid_at) AS revenue_month,
    FORMAT(p.paid_at, 'yyyy-MM') AS month_label,
    COUNT(DISTINCT p.payment_id) AS total_payments,
    SUM(p.amount_paid) AS net_revenue
FROM dbo.Payments p
WHERE p.payment_status = N'Completed'
  AND p.paid_at >= DATEFROMPARTS(YEAR(SYSDATETIME()), 1, 1)
  AND p.paid_at < DATEFROMPARTS(YEAR(SYSDATETIME()) + 1, 1, 1)
GROUP BY YEAR(p.paid_at), MONTH(p.paid_at), FORMAT(p.paid_at, 'yyyy-MM')
ORDER BY revenue_year, revenue_month;
GO

-- Q08. Best-selling dishes by quantity sold.
SELECT TOP (10)
    d.dish_id,
    d.dish_name,
    mc.category_name,
    d.price AS current_price,
    SUM(oi.quantity) AS total_quantity_sold,
    SUM(oi.line_total) AS total_sales_amount,
    COUNT(DISTINCT oi.order_id) AS number_of_orders,
    CAST(AVG(CAST(cr.food_rating AS DECIMAL(4,2))) AS DECIMAL(4,2)) AS avg_food_rating
FROM dbo.OrderItems oi
JOIN dbo.Dishes d ON oi.dish_id = d.dish_id
JOIN dbo.MenuCategories mc ON d.category_id = mc.category_id
JOIN dbo.Orders o ON oi.order_id = o.order_id
LEFT JOIN dbo.CustomerReviews cr ON o.order_id = cr.order_id
WHERE oi.item_status <> N'Cancelled'
GROUP BY d.dish_id, d.dish_name, mc.category_name, d.price
ORDER BY total_quantity_sold DESC, total_sales_amount DESC;
GO

-- Q09. Table availability for a selected time window.
DECLARE @SlotStart DATETIME2(0) = '2026-05-20T18:00:00';
DECLARE @SlotEnd   DATETIME2(0) = '2026-05-20T20:30:00';

SELECT
    t.table_id,
    t.table_number,
    a.area_name,
    a.area_type,
    t.capacity,
    t.table_status AS current_status,
    CASE
        WHEN t.table_status IN (N'Occupied', N'Cleaning', N'Inactive') THEN N'Unavailable'
        WHEN EXISTS (
            SELECT 1
            FROM dbo.ReservationTables rt
            JOIN dbo.Reservations r 
                ON rt.reservation_id = r.reservation_id
            WHERE rt.table_id = t.table_id
              AND r.reservation_status IN (N'Pending', N'Confirmed', N'Checked In')
              AND r.reservation_start_at < @SlotEnd
              AND r.reservation_end_at > @SlotStart
        ) THEN N'Reserved'
        ELSE N'Available'
    END AS availability_at_slot
FROM dbo.RestaurantTables t
JOIN dbo.RestaurantAreas a 
    ON t.area_id = a.area_id
WHERE a.is_active = 1
ORDER BY a.area_type, t.table_number;
GO

-- Q10. Customer booking and payment history.
DECLARE @CustomerUserId INT = 7;

SELECT
    r.reservation_id,
    r.reservation_start_at,
    r.guest_count,
    a.area_name,
    r.reservation_status,
    o.order_id,
    o.order_status,
    o.total_amount,
    p.payment_status,
    p.paid_at
FROM dbo.Reservations r
LEFT JOIN dbo.RestaurantAreas a ON r.preferred_area_id = a.area_id
LEFT JOIN dbo.Orders o ON r.reservation_id = o.reservation_id
LEFT JOIN dbo.Payments p ON o.order_id = p.order_id
WHERE r.customer_id = @CustomerUserId
ORDER BY r.reservation_start_at DESC;
GO

-- Q11. Review report with calculated overall rating.
SELECT
    cr.review_id,
    c.full_name AS customer_name,
    o.order_id,
    t.table_number,
    cr.food_rating,
    cr.service_rating,
    cr.ambiance_rating,
    cr.overall_rating,
    cr.comment,
    cr.created_at
FROM dbo.CustomerReviews cr
JOIN dbo.UserAccounts c ON cr.customer_id = c.user_id
JOIN dbo.Orders o ON cr.order_id = o.order_id
JOIN dbo.RestaurantTables t ON o.table_id = t.table_id
WHERE cr.is_visible = 1
ORDER BY cr.created_at DESC;
GO



-- End of Phūrai SQL Server Database Script
-- Reset DB--

SELECT * FROM dbo.UserAccounts
SELECT
    a.area_name,
    t.table_id,
    t.table_number,
    t.capacity,
    t.table_status
FROM dbo.RestaurantTables t
JOIN dbo.RestaurantAreas a ON t.area_id = a.area_id
ORDER BY t.table_id;

SELECT
    d.dish_id,
    d.dish_name,
    d.description,
    d.price,
    d.spicy_level,
    d.prep_time_min,
    c.category_name,
    img.image_url
FROM dbo.Dishes d
JOIN dbo.MenuCategories c
    ON d.category_id = c.category_id
LEFT JOIN dbo.DishImages img
    ON d.dish_id = img.dish_id
   AND img.is_primary = 1
WHERE d.is_available = 1
  AND d.allow_preorder = 1
ORDER BY
    ISNULL(d.preorder_sort, 9999),
    c.display_order,
    d.dish_name;

-- 1. Kiểm tra lại bảng cấu hình giờ mở cửa
SELECT setting_key, setting_value, description 
FROM dbo.RestaurantSettings 
WHERE setting_key LIKE 'hours_%';

-- 2. Kiểm tra lại bảng Ca làm việc
SELECT shift_id, shift_name, start_time, end_time, is_active 
FROM dbo.Shifts;


--Add more row---
ALTER TABLE dbo.RestaurantTables 
ADD is_counter BIT NOT NULL CONSTRAINT DF_RestaurantTables_is_counter DEFAULT 0;
GO


-- Reset DB

USE master;
GO

ALTER DATABASE [System_Restaurant]
SET SINGLE_USER
WITH ROLLBACK IMMEDIATE;
GO

DROP DATABASE [System_Restaurant];
GO
