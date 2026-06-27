-- ============================================================================
-- PHŪRAI PREMIUM RESTAURANT MANAGEMENT SYSTEM
-- Master Database Script (Fixed Docker Init, Constraints & Selects)
-- Target: Microsoft SQL Server / Docker
-- Normalization target: 3NF
-- ============================================================================

-- Khởi tạo Database an toàn (Chống lỗi 911 trên Docker và tránh chèn nhầm vào master)
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'System_Restaurant')
BEGIN
    CREATE DATABASE [System_Restaurant];
END
GO

USE [System_Restaurant];
GO

-- ============================================================================
-- 0. CLEANUP: DROP EXISTING TABLES (Từ Con đến Cha)
-- ============================================================================
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
DROP TABLE IF EXISTS dbo.BillSplits;
DROP TABLE IF EXISTS dbo.KitchenTickets;
DROP TABLE IF EXISTS dbo.OrderItems;
DROP TABLE IF EXISTS dbo.Orders;
DROP TABLE IF EXISTS dbo.QROrderSessions;
DROP TABLE IF EXISTS dbo.PreorderItems;
DROP TABLE IF EXISTS dbo.ReservationTimelines;
DROP TABLE IF EXISTS dbo.ReservationTables;
DROP TABLE IF EXISTS dbo.Reservations;
DROP TABLE IF EXISTS dbo.DishImages;
DROP TABLE IF EXISTS dbo.Dishes;
DROP TABLE IF EXISTS dbo.MenuCategories;
DROP TABLE IF EXISTS dbo.ShiftLogs;
DROP TABLE IF EXISTS dbo.StaffSchedules;
DROP TABLE IF EXISTS dbo.Shifts;
DROP TABLE IF EXISTS dbo.RestaurantTables;
DROP TABLE IF EXISTS dbo.RestaurantAreas;
DROP TABLE IF EXISTS dbo.RestaurantSettings;
DROP TABLE IF EXISTS dbo.StaffProfiles;
DROP TABLE IF EXISTS dbo.CustomerProfiles;
DROP TABLE IF EXISTS dbo.OtpTokens;
DROP TABLE IF EXISTS dbo.UserAccounts;
DROP TABLE IF EXISTS dbo.Roles;
GO

-- ============================================================================
-- MODULE 1: SYSTEM SETUP & AUTHENTICATION
-- ============================================================================

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
    preferences       NVARCHAR(1000) NULL,
    created_at        DATETIME2(0) NOT NULL CONSTRAINT DF_CustomerProfiles_created_at DEFAULT SYSDATETIME(),
    updated_at        DATETIME2(0) NOT NULL CONSTRAINT DF_CustomerProfiles_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_CustomerProfiles PRIMARY KEY (customer_id),
    CONSTRAINT UQ_CustomerProfiles_user UNIQUE (user_id),
    CONSTRAINT UQ_CustomerProfiles_username UNIQUE (username),
    CONSTRAINT FK_CustomerProfiles_UserAccounts FOREIGN KEY (user_id) REFERENCES dbo.UserAccounts(user_id) ON DELETE CASCADE,
    CONSTRAINT CK_CustomerProfiles_loyalty CHECK (loyalty_points >= 0),
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

-- ============================================================================
-- MODULE 2: RESTAURANT INFRASTRUCTURE & STAFFING
-- ============================================================================

CREATE TABLE dbo.RestaurantAreas (
    area_id        SMALLINT IDENTITY(1,1) NOT NULL,
    area_name      NVARCHAR(80) NOT NULL,
    area_type      NVARCHAR(20) NOT NULL CONSTRAINT DF_RestaurantAreas_type DEFAULT N'Regular',
    description    NVARCHAR(255) NULL,
    is_active      BIT NOT NULL CONSTRAINT DF_RestaurantAreas_is_active DEFAULT 1,
    created_at     DATETIME2(0) NOT NULL CONSTRAINT DF_RestaurantAreas_created_at DEFAULT SYSDATETIME(),
    updated_at     DATETIME2(0) NOT NULL CONSTRAINT DF_RestaurantAreas_updated_at DEFAULT SYSDATETIME(),
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
    static_qr_code NVARCHAR(120) NULL,
    notes          NVARCHAR(255) NULL,
    is_counter     BIT NOT NULL CONSTRAINT DF_RestaurantTables_is_counter DEFAULT 0,
    merged_into_table_id SMALLINT NULL REFERENCES dbo.RestaurantTables(table_id),
    created_at     DATETIME2(0) NOT NULL CONSTRAINT DF_RestaurantTables_created_at DEFAULT SYSDATETIME(),
    updated_at     DATETIME2(0) NOT NULL CONSTRAINT DF_RestaurantTables_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_RestaurantTables PRIMARY KEY (table_id),
    CONSTRAINT UQ_RestaurantTables_table_number UNIQUE (table_number),
    CONSTRAINT UQ_RestaurantTables_static_qr_code UNIQUE (static_qr_code),
    CONSTRAINT FK_RestaurantTables_RestaurantAreas FOREIGN KEY (area_id) REFERENCES dbo.RestaurantAreas(area_id),
    CONSTRAINT CK_RestaurantTables_capacity CHECK (capacity > 0),
    CONSTRAINT CK_RestaurantTables_status CHECK (table_status IN
        (N'Available', N'Reserved', N'Occupied', N'Cleaning', N'Inactive', N'Overdue'))
);
GO

CREATE TABLE dbo.Shifts (
    shift_id       TINYINT IDENTITY(1,1) NOT NULL,
    shift_name     NVARCHAR(50) NOT NULL,
    start_time     TIME(0) NOT NULL,
    end_time       TIME(0) NOT NULL,
    is_active      BIT NOT NULL CONSTRAINT DF_Shifts_is_active DEFAULT 1,
    CONSTRAINT PK_Shifts PRIMARY KEY (shift_id)
);
GO

CREATE TABLE dbo.StaffSchedules (
    schedule_id       INT IDENTITY(1,1) NOT NULL,
    user_id           INT NOT NULL,
    shift_id          TINYINT NOT NULL,
    work_date         DATE NOT NULL,
    attendance_status NVARCHAR(20) NOT NULL CONSTRAINT DF_StaffSchedules_status DEFAULT N'Scheduled',
    assigned_by       INT NULL, 
    created_at        DATETIME2(0) NOT NULL CONSTRAINT DF_StaffSchedules_created_at DEFAULT SYSDATETIME(),
    updated_at        DATETIME2(0) NOT NULL CONSTRAINT DF_StaffSchedules_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_StaffSchedules PRIMARY KEY (schedule_id),
    CONSTRAINT UQ_StaffSchedules_user_date_shift UNIQUE (user_id, work_date, shift_id),
    CONSTRAINT FK_StaffSchedules_UserAccounts FOREIGN KEY (user_id) REFERENCES dbo.UserAccounts(user_id) ON DELETE CASCADE,
    CONSTRAINT FK_StaffSchedules_Shifts FOREIGN KEY (shift_id) REFERENCES dbo.Shifts(shift_id) ON DELETE CASCADE,
    CONSTRAINT FK_StaffSchedules_AssignedBy FOREIGN KEY (assigned_by) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT CK_StaffSchedules_status CHECK (attendance_status IN (N'Scheduled', N'Present', N'Absent', N'On Leave'))
);
GO

CREATE TABLE dbo.ShiftLogs (
    log_id         INT IDENTITY(1,1) NOT NULL,
    staff_user_id  INT NOT NULL, 
    shift_id       TINYINT NULL,      
    check_in_time  DATETIME2(0) NOT NULL CONSTRAINT DF_ShiftLogs_checkin DEFAULT SYSDATETIME(),
    check_out_time DATETIME2(0) NULL,
    total_hours    DECIMAL(5,2) NULL, 
    status         NVARCHAR(20) NOT NULL CONSTRAINT DF_ShiftLogs_status DEFAULT N'Active',
    CONSTRAINT PK_ShiftLogs PRIMARY KEY (log_id),
    CONSTRAINT FK_ShiftLogs_Staff FOREIGN KEY (staff_user_id) REFERENCES dbo.UserAccounts(user_id) ON DELETE CASCADE,
    CONSTRAINT FK_ShiftLogs_Shift FOREIGN KEY (shift_id) REFERENCES dbo.Shifts(shift_id) ON DELETE SET NULL,
    CONSTRAINT CK_ShiftLogs_status CHECK (status IN (N'Active', N'Completed'))
);
GO

-- ============================================================================
-- MODULE 3: MENU & INVENTORY
-- ============================================================================

CREATE TABLE dbo.MenuCategories (
    category_id    SMALLINT IDENTITY(1,1) NOT NULL,
    category_name  NVARCHAR(80) NOT NULL,
    display_order  TINYINT NOT NULL CONSTRAINT DF_MenuCategories_display DEFAULT 0,
    is_active      BIT NOT NULL CONSTRAINT DF_MenuCategories_is_active DEFAULT 1,
    created_at     DATETIME2(0) NOT NULL CONSTRAINT DF_MenuCategories_created_at DEFAULT SYSDATETIME(),
    updated_at     DATETIME2(0) NOT NULL CONSTRAINT DF_MenuCategories_updated_at DEFAULT SYSDATETIME(),
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
    is_preorderable  BIT NOT NULL CONSTRAINT DF_Dishes_is_preorderable DEFAULT 1,
    created_at       DATETIME2(0) NOT NULL CONSTRAINT DF_Dishes_created_at DEFAULT SYSDATETIME(),
    updated_at       DATETIME2(0) NOT NULL CONSTRAINT DF_Dishes_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_Dishes PRIMARY KEY (dish_id),
    CONSTRAINT FK_Dishes_MenuCategories FOREIGN KEY (category_id) REFERENCES dbo.MenuCategories(category_id) ON DELETE CASCADE,
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

-- ============================================================================
-- MODULE 4: RESERVATION SYSTEM
-- ============================================================================

CREATE TABLE dbo.Reservations (
    reservation_id        INT IDENTITY(1,1) NOT NULL,
    customer_id           INT NULL,
    contact_name          NVARCHAR(100) NULL,
    contact_phone         NVARCHAR(20) NULL,
    contact_email         NVARCHAR(100) NULL,
    created_by_staff_id   INT NULL,
    preferred_area_id     SMALLINT NULL,
    reservation_start_at  DATETIME2(0) NOT NULL,
    reservation_end_at    DATETIME2(0) NOT NULL,
    guest_count           TINYINT NOT NULL,
    special_request       NVARCHAR(1000) NULL,
    deposit_amount        DECIMAL(12, 2) NULL,
    final_total           DECIMAL(12, 2) NULL,
    applied_promo_code    VARCHAR(50) NULL,
    preorder_json         NVARCHAR(MAX) NULL,
    order_code            VARCHAR(50) NULL,
    reservation_status    NVARCHAR(25) NOT NULL CONSTRAINT DF_Reservations_status DEFAULT N'Pending Request',
    reservation_source    NVARCHAR(20) NOT NULL CONSTRAINT DF_Reservations_source DEFAULT N'Online',
    confirmed_by_staff_id INT NULL,
    confirmed_at          DATETIME2(0) NULL,
    checked_in_at         DATETIME2(0) NULL,
    cancelled_at          DATETIME2(0) NULL,
    checked_out_at        DATETIME2(0) NULL,
    cancel_reason         NVARCHAR(255) NULL,
    reminder_sent         BIT NOT NULL CONSTRAINT DF_Reservations_reminder DEFAULT 0,
    has_pending_request   BIT NOT NULL CONSTRAINT DF_Reservations_HasPendingRequest DEFAULT 0,
    pending_changes_json  NVARCHAR(MAX) NULL,
    edit_used_count       INT NOT NULL CONSTRAINT DF_Reservations_EditUsedCount DEFAULT 0,
    request_type          NVARCHAR(20) NULL,
    rejected_at           DATETIME2(0) NULL,
    rejected_by           INT NULL,
    resolved_at           DATETIME2(0) NULL,
    resolved_by           INT NULL,
    created_at            DATETIME2(0) NOT NULL CONSTRAINT DF_Reservations_created_at DEFAULT SYSDATETIME(),
    updated_at            DATETIME2(0) NOT NULL CONSTRAINT DF_Reservations_updated_at DEFAULT SYSDATETIME(),
    applied_voucher_id    INT NULL,
    CONSTRAINT PK_Reservations PRIMARY KEY (reservation_id),
    CONSTRAINT FK_Reservations_Customer FOREIGN KEY (customer_id) REFERENCES dbo.UserAccounts(user_id) ON DELETE SET NULL,
    CONSTRAINT FK_Reservations_CreatedByStaff FOREIGN KEY (created_by_staff_id) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT FK_Reservations_PreferredArea FOREIGN KEY (preferred_area_id) REFERENCES dbo.RestaurantAreas(area_id) ON DELETE SET NULL,
    CONSTRAINT FK_Reservations_ConfirmedByStaff FOREIGN KEY (confirmed_by_staff_id) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT FK_Reservations_RejectedBy FOREIGN KEY (rejected_by) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT FK_Reservations_ResolvedBy FOREIGN KEY (resolved_by) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT CK_Reservations_guest_count CHECK (guest_count > 0),
    CONSTRAINT CK_Reservations_time CHECK (reservation_end_at > reservation_start_at),
    CONSTRAINT CK_Reservations_status CHECK (reservation_status IN (
        N'Pending Request', N'Awaiting Deposit', N'Confirmed', 
        N'Check-in', N'Seated', N'Payment Pending', 
        N'Completed', N'Cancelled', N'No Show'
    )),
    CONSTRAINT CK_Reservations_source CHECK (reservation_source IN (N'Online', N'Walk-in', N'Phone')),
    CONSTRAINT CK_Reservations_RequestType CHECK (request_type IN (N'edit', N'cancel') OR request_type IS NULL)
);
GO

CREATE TABLE dbo.ReservationTables (
    reservation_id       INT NOT NULL,
    table_id             SMALLINT NOT NULL,
    assigned_by_staff_id INT NULL,
    assigned_at          DATETIME2(0) NOT NULL CONSTRAINT DF_ReservationTables_assigned_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_ReservationTables PRIMARY KEY (reservation_id, table_id),
    CONSTRAINT FK_ReservationTables_Reservations FOREIGN KEY (reservation_id) REFERENCES dbo.Reservations(reservation_id) ON DELETE CASCADE,
    CONSTRAINT FK_ReservationTables_RestaurantTables FOREIGN KEY (table_id) REFERENCES dbo.RestaurantTables(table_id) ON DELETE CASCADE,
    CONSTRAINT FK_ReservationTables_AssignedBy FOREIGN KEY (assigned_by_staff_id) REFERENCES dbo.UserAccounts(user_id)
);
GO

CREATE TABLE dbo.ReservationTimelines (
    timeline_id    INT IDENTITY(1,1) NOT NULL,
    reservation_id INT NOT NULL,
    event_type     NVARCHAR(50) NOT NULL, -- e.g. 'PAYMENT_FAILED', 'REJECT_CHECKOUT', 'CHECKIN_INITIATED'
    performed_by   INT NULL,              -- UserAccount ID of customer or staff who did it
    notes          NVARCHAR(1000) NULL,
    created_at     DATETIME2(0) NOT NULL CONSTRAINT DF_ReservationTimelines_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_ReservationTimelines PRIMARY KEY (timeline_id),
    CONSTRAINT FK_ReservationTimelines_Reservations FOREIGN KEY (reservation_id) REFERENCES dbo.Reservations(reservation_id) ON DELETE CASCADE,
    CONSTRAINT FK_ReservationTimelines_UserAccounts FOREIGN KEY (performed_by) REFERENCES dbo.UserAccounts(user_id)
);
GO

CREATE TABLE dbo.PreorderItems (
    preorder_item_id  INT IDENTITY(1,1) NOT NULL,
    reservation_id    INT NULL,
    dish_id           INT NOT NULL,
    quantity          SMALLINT NOT NULL CONSTRAINT DF_PreorderItems_quantity DEFAULT 1,
    unit_price        DECIMAL(12,2) NOT NULL,
    notes             NVARCHAR(255) NULL,
    created_at        DATETIME2(0) NOT NULL CONSTRAINT DF_PreorderItems_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_PreorderItems PRIMARY KEY (preorder_item_id),
    CONSTRAINT FK_PreorderItems_Reservations FOREIGN KEY (reservation_id) REFERENCES dbo.Reservations(reservation_id) ON DELETE CASCADE,
    CONSTRAINT FK_PreorderItems_Dishes FOREIGN KEY (dish_id) REFERENCES dbo.Dishes(dish_id) ON DELETE CASCADE,
    CONSTRAINT CK_PreorderItems_quantity CHECK (quantity > 0),
    CONSTRAINT CK_PreorderItems_unit_price CHECK (unit_price >= 0)
);
GO

-- ============================================================================
-- MODULE 5: ORDERING & KITCHEN DISPLAY
-- ============================================================================

CREATE TABLE dbo.QROrderSessions (
    qr_session_id         INT IDENTITY(1,1) NOT NULL,
    table_id              SMALLINT NOT NULL,
    scanned_table_id      SMALLINT NULL,
    reservation_id        INT NULL,
    customer_id           INT NULL,
    token                 NVARCHAR(120) NOT NULL,
    session_status        NVARCHAR(20) NOT NULL CONSTRAINT DF_QROrderSessions_status DEFAULT N'Active',
    generated_by_staff_id INT NULL,
    generated_at          DATETIME2(0) NOT NULL CONSTRAINT DF_QROrderSessions_generated_at DEFAULT SYSDATETIME(),
    expires_at            DATETIME2(0) NULL,
    closed_at             DATETIME2(0) NULL,
    CONSTRAINT PK_QROrderSessions PRIMARY KEY (qr_session_id),
    CONSTRAINT UQ_QROrderSessions_token UNIQUE (token),
    CONSTRAINT FK_QROrderSessions_Table FOREIGN KEY (table_id) REFERENCES dbo.RestaurantTables(table_id) ON DELETE CASCADE,
    CONSTRAINT FK_QROrderSessions_ScannedTable FOREIGN KEY (scanned_table_id) REFERENCES dbo.RestaurantTables(table_id),
    CONSTRAINT FK_QROrderSessions_Reservation FOREIGN KEY (reservation_id) REFERENCES dbo.Reservations(reservation_id) ON DELETE CASCADE,
    CONSTRAINT FK_QROrderSessions_Customer FOREIGN KEY (customer_id) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT FK_QROrderSessions_GeneratedBy FOREIGN KEY (generated_by_staff_id) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT CK_QROrderSessions_status CHECK (session_status IN (N'Pending', N'Active', N'Closed', N'Expired', N'Cancelled')),
    CONSTRAINT CK_QROrderSessions_expiry CHECK (expires_at IS NULL OR expires_at > generated_at)
);
GO

CREATE TABLE dbo.Orders (
    order_id            INT IDENTITY(1,1) NOT NULL,
    reservation_id      INT NULL,
    table_id            SMALLINT NOT NULL,
    customer_id         INT NULL,
    created_by_staff_id INT NULL,
    qr_session_id       INT NULL,
    parent_order_id     INT NULL,
    order_type          NVARCHAR(20) NOT NULL CONSTRAINT DF_Orders_type DEFAULT N'Dine In',
    order_status        NVARCHAR(25) NOT NULL CONSTRAINT DF_Orders_status DEFAULT N'Open',
    order_note          NVARCHAR(1000) NULL,
    subtotal            DECIMAL(12,2) NOT NULL CONSTRAINT DF_Orders_subtotal DEFAULT 0,
    discount_amount     DECIMAL(12,2) NOT NULL CONSTRAINT DF_Orders_discount DEFAULT 0,
    service_charge      DECIMAL(12,2) NOT NULL CONSTRAINT DF_Orders_service DEFAULT 0,
    total_amount        DECIMAL(12,2) NOT NULL CONSTRAINT DF_Orders_total DEFAULT 0,
    amount_paid         DECIMAL(12,2) NOT NULL CONSTRAINT DF_Orders_paid DEFAULT 0,
    applied_promo_code  NVARCHAR(40) NULL,
    created_at          DATETIME2(0) NOT NULL CONSTRAINT DF_Orders_created_at DEFAULT SYSDATETIME(),
    updated_at          DATETIME2(0) NOT NULL CONSTRAINT DF_Orders_updated_at DEFAULT SYSDATETIME(),
    applied_voucher_id  INT NULL,
    CONSTRAINT PK_Orders PRIMARY KEY (order_id),
    CONSTRAINT FK_Orders_Reservations FOREIGN KEY (reservation_id) REFERENCES dbo.Reservations(reservation_id) ON DELETE SET NULL,
    CONSTRAINT FK_Orders_RestaurantTables FOREIGN KEY (table_id) REFERENCES dbo.RestaurantTables(table_id) ON DELETE CASCADE,
    CONSTRAINT FK_Orders_Customer FOREIGN KEY (customer_id) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT FK_Orders_CreatedByStaff FOREIGN KEY (created_by_staff_id) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT FK_Orders_QROrderSessions FOREIGN KEY (qr_session_id) REFERENCES dbo.QROrderSessions(qr_session_id),
    CONSTRAINT FK_Orders_ParentOrder FOREIGN KEY (parent_order_id) REFERENCES dbo.Orders(order_id),
    CONSTRAINT CK_Orders_type CHECK (order_type IN (N'Dine In', N'Preorder', N'QR Self')),
    CONSTRAINT CK_Orders_status CHECK (order_status IN
        (N'Open', N'Sent To Kitchen', N'Partially Served', N'Served', N'Billed', N'Paid', N'Cancelled')),
    CONSTRAINT CK_Orders_amounts CHECK (
        subtotal >= 0 AND discount_amount >= 0 AND service_charge >= 0 AND total_amount >= 0
    )
);
GO

CREATE TABLE dbo.OrderItems (
    order_item_id   INT IDENTITY(1,1) NOT NULL,
    order_id        INT NOT NULL,
    dish_id         INT NOT NULL,
    quantity        INT NOT NULL,
    unit_price      DECIMAL(12,2) NOT NULL,
    notes           NVARCHAR(255) NULL,
    snapshot_table_name NVARCHAR(255) NULL,
    item_status     NVARCHAR(25) NOT NULL CONSTRAINT DF_OrderItems_status DEFAULT N'Pending',
    line_total      AS (CONVERT(DECIMAL(12,2), quantity * unit_price)) PERSISTED,
    created_at      DATETIME2(0) NOT NULL CONSTRAINT DF_OrderItems_created_at DEFAULT SYSDATETIME(),
    updated_at      DATETIME2(0) NOT NULL CONSTRAINT DF_OrderItems_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_OrderItems PRIMARY KEY (order_item_id),
    CONSTRAINT FK_OrderItems_Orders FOREIGN KEY (order_id) REFERENCES dbo.Orders(order_id) ON DELETE CASCADE,
    CONSTRAINT FK_OrderItems_Dishes FOREIGN KEY (dish_id) REFERENCES dbo.Dishes(dish_id) ON DELETE CASCADE,
    CONSTRAINT CK_OrderItems_quantity CHECK (quantity > 0),
    CONSTRAINT CK_OrderItems_unit_price CHECK (unit_price >= 0),
    CONSTRAINT CK_OrderItems_status CHECK (item_status IN
        (N'Pending', N'Sent To Kitchen', N'Preparing', N'Ready', N'Served', N'Cancelled'))
);
GO

CREATE TABLE dbo.KitchenTickets (
    kitchen_ticket_id    INT IDENTITY(1,1) NOT NULL,
    order_item_id        INT NOT NULL,
    kitchen_status       NVARCHAR(20) NOT NULL CONSTRAINT DF_KitchenTickets_status DEFAULT N'Pending',
    priority_level       TINYINT NOT NULL CONSTRAINT DF_KitchenTickets_priority DEFAULT 3,
    assigned_to_staff_id INT NULL,
    sent_at              DATETIME2(0) NOT NULL CONSTRAINT DF_KitchenTickets_sent_at DEFAULT SYSDATETIME(),
    started_at           DATETIME2(0) NULL,
    ready_at             DATETIME2(0) NULL,
    cancelled_at         DATETIME2(0) NULL,
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

-- ============================================================================
-- MODULE 6: FINANCE & PROMOTIONS
-- ============================================================================

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
    payment_id            INT IDENTITY(1,1) NOT NULL,
    order_id              INT NULL,
    reservation_id        INT NULL,
    payment_method_id     TINYINT NOT NULL,
    amount_paid           DECIMAL(12,2) NOT NULL,
    change_given          DECIMAL(12,2) NOT NULL CONSTRAINT DF_Payments_change DEFAULT 0,
    payment_status        NVARCHAR(20) NOT NULL CONSTRAINT DF_Payments_status DEFAULT N'Pending',
    transaction_ref       NVARCHAR(120) NULL,
    processed_by_staff_id INT NULL,
    paid_at               DATETIME2(0) NULL,
    created_at            DATETIME2(0) NOT NULL CONSTRAINT DF_Payments_created_at DEFAULT SYSDATETIME(),
    updated_at            DATETIME2(0) NOT NULL CONSTRAINT DF_Payments_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_Payments PRIMARY KEY (payment_id),
    CONSTRAINT FK_Payments_Orders FOREIGN KEY (order_id) REFERENCES dbo.Orders(order_id) ON DELETE CASCADE,
    CONSTRAINT FK_Payments_Reservations FOREIGN KEY (reservation_id) REFERENCES dbo.Reservations(reservation_id) ON DELETE CASCADE,
    CONSTRAINT FK_Payments_PaymentMethods FOREIGN KEY (payment_method_id) REFERENCES dbo.PaymentMethods(payment_method_id) ON DELETE CASCADE,
    CONSTRAINT FK_Payments_ProcessedBy FOREIGN KEY (processed_by_staff_id) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT CK_Payments_order_or_res CHECK (order_id IS NOT NULL OR reservation_id IS NOT NULL),
    CONSTRAINT CK_Payments_amount CHECK (amount_paid > 0),
    CONSTRAINT CK_Payments_change CHECK (change_given >= 0),
    CONSTRAINT CK_Payments_status CHECK (payment_status IN (N'Pending', N'Completed', N'Refunded', N'Failed'))
);
GO

CREATE TABLE dbo.Promotions (
    promotion_id        INT IDENTITY(1,1) NOT NULL,
    promotion_name      NVARCHAR(150) NOT NULL,
    description         NVARCHAR(1000) NULL,
    discount_type       NVARCHAR(20) NOT NULL,
    discount_value      DECIMAL(12,2) NOT NULL,
    min_order_value     DECIMAL(12,2) NOT NULL CONSTRAINT DF_Promotions_min_order DEFAULT 0,
    max_discount        DECIMAL(12,2) NULL,
    start_at            DATETIME2(0) NOT NULL,
    end_at              DATETIME2(0) NOT NULL,
    is_active           BIT NOT NULL CONSTRAINT DF_Promotions_is_active DEFAULT 1,
    applicable_to       NVARCHAR(20) NOT NULL CONSTRAINT DF_Promotions_applicable DEFAULT N'Both',
    points_required     INT NULL,
    validity_duration_hours INT NOT NULL CONSTRAINT DF_Promotions_validity DEFAULT 24,
    total_quantity      INT NULL,
    remaining_quantity  INT NULL,
    created_by_staff_id INT NULL,
    created_at          DATETIME2(0) NOT NULL CONSTRAINT DF_Promotions_created_at DEFAULT SYSDATETIME(),
    updated_at          DATETIME2(0) NOT NULL CONSTRAINT DF_Promotions_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_Promotions PRIMARY KEY (promotion_id),
    CONSTRAINT FK_Promotions_CreatedBy FOREIGN KEY (created_by_staff_id) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT CK_Promotions_discount_type CHECK (discount_type IN (N'Percent', N'Fixed')),
    CONSTRAINT CK_Promotions_discount_value CHECK (
        discount_value > 0 AND
        ((discount_type = N'Percent' AND discount_value <= 100) OR discount_type = N'Fixed')
    ),
    CONSTRAINT CK_Promotions_min_order CHECK (min_order_value >= 0),
    CONSTRAINT CK_Promotions_max_discount CHECK (max_discount IS NULL OR max_discount >= 0),
    CONSTRAINT CK_Promotions_date CHECK (end_at > start_at),
    CONSTRAINT CK_Promotions_applicable CHECK (applicable_to IN (N'Reservation', N'Order', N'Both'))
);
GO

CREATE TABLE dbo.Vouchers (
    voucher_id    INT IDENTITY(1,1) NOT NULL,
    promotion_id  INT NOT NULL,
    voucher_code  NVARCHAR(40) NOT NULL,
    usage_limit   INT NOT NULL CONSTRAINT DF_Vouchers_usage_limit DEFAULT 1,
    times_used    INT NOT NULL CONSTRAINT DF_Vouchers_times_used DEFAULT 0,
    is_active     BIT NOT NULL CONSTRAINT DF_Vouchers_is_active DEFAULT 1,
    created_at    DATETIME2(0) NOT NULL CONSTRAINT DF_Vouchers_created_at DEFAULT SYSDATETIME(),
    updated_at    DATETIME2(0) NOT NULL CONSTRAINT DF_Vouchers_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_Vouchers PRIMARY KEY (voucher_id),
    CONSTRAINT UQ_Vouchers_code UNIQUE (voucher_code),
    CONSTRAINT FK_Vouchers_Promotions FOREIGN KEY (promotion_id) REFERENCES dbo.Promotions(promotion_id) ON DELETE CASCADE,
    CONSTRAINT CK_Vouchers_usage CHECK (usage_limit > 0 AND times_used >= 0 AND times_used <= usage_limit)
);
GO

CREATE TABLE dbo.VoucherRedemptions (
    redemption_id    INT IDENTITY(1,1) NOT NULL,
    voucher_id       INT NOT NULL,
    payment_id       INT NOT NULL,
    customer_id      INT NULL,
    discount_amount  DECIMAL(12,2) NOT NULL,
    redeemed_at      DATETIME2(0) NOT NULL CONSTRAINT DF_VoucherRedemptions_redeemed_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_VoucherRedemptions PRIMARY KEY (redemption_id),
    CONSTRAINT UQ_VoucherRedemptions_payment UNIQUE (payment_id),
    CONSTRAINT FK_VoucherRedemptions_Vouchers FOREIGN KEY (voucher_id) REFERENCES dbo.Vouchers(voucher_id) ON DELETE CASCADE,
    CONSTRAINT FK_VoucherRedemptions_Payments FOREIGN KEY (payment_id) REFERENCES dbo.Payments(payment_id) ON DELETE CASCADE,
    CONSTRAINT FK_VoucherRedemptions_Customer FOREIGN KEY (customer_id) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT CK_VoucherRedemptions_discount CHECK (discount_amount >= 0)
);
GO

CREATE TABLE dbo.CustomerVouchers (
    customer_voucher_id INT IDENTITY(1,1) NOT NULL,
    customer_id         INT NOT NULL,
    promotion_id        INT NOT NULL,
    points_spent        INT NOT NULL,
    voucher_code        NVARCHAR(50) NOT NULL,
    status              NVARCHAR(20) NOT NULL CONSTRAINT DF_CustomerVouchers_status DEFAULT N'active', -- 'active', 'used', 'expired'
    redeemed_at         DATETIME2(0) NOT NULL CONSTRAINT DF_CustomerVouchers_redeemed DEFAULT SYSDATETIME(),
    expires_at          DATETIME2(0) NOT NULL,
    used_at             DATETIME2(0) NULL,
    used_in_order_id    INT NULL,
    used_in_reservation_id INT NULL,
    CONSTRAINT PK_CustomerVouchers PRIMARY KEY (customer_voucher_id),
    CONSTRAINT UQ_CustomerVouchers_code UNIQUE (voucher_code),
    CONSTRAINT FK_CustomerVouchers_Customer FOREIGN KEY (customer_id) REFERENCES dbo.UserAccounts(user_id) ON DELETE CASCADE,
    CONSTRAINT FK_CustomerVouchers_Promotions FOREIGN KEY (promotion_id) REFERENCES dbo.Promotions(promotion_id) ON DELETE CASCADE,
    CONSTRAINT FK_CustomerVouchers_Orders FOREIGN KEY (used_in_order_id) REFERENCES dbo.Orders(order_id) ON DELETE SET NULL,
    CONSTRAINT FK_CustomerVouchers_Reservations FOREIGN KEY (used_in_reservation_id) REFERENCES dbo.Reservations(reservation_id) ON DELETE SET NULL,
    CONSTRAINT CK_CustomerVouchers_status CHECK (status IN (N'active', N'used', N'expired'))
);
GO

CREATE INDEX IX_CustomerVouchers_StatusExpiry ON dbo.CustomerVouchers (status, expires_at);
GO

CREATE TABLE dbo.LoyaltyTransactions (
    transaction_id   INT IDENTITY(1,1) NOT NULL,
    customer_id      INT NOT NULL,
    points           INT NOT NULL,
    transaction_type NVARCHAR(20) NOT NULL,
    reference_type   NVARCHAR(50) NOT NULL,
    reference_id     INT NULL,
    description      NVARCHAR(255) NULL,
    created_at       DATETIME2(0) NOT NULL CONSTRAINT DF_LoyaltyTransactions_created DEFAULT SYSDATETIME(),
    CONSTRAINT PK_LoyaltyTransactions PRIMARY KEY (transaction_id),
    CONSTRAINT FK_LoyaltyTransactions_Customer FOREIGN KEY (customer_id) REFERENCES dbo.UserAccounts(user_id) ON DELETE CASCADE,
    CONSTRAINT CK_LoyaltyTransactions_type CHECK (transaction_type IN (N'Earn', N'Redeem')),
    CONSTRAINT CK_LoyaltyTransactions_refType CHECK (reference_type IN (N'Order', N'Reservation', N'Payment', N'VoucherRedeem'))
);
GO

CREATE INDEX IX_LoyaltyTransactions_Customer ON dbo.LoyaltyTransactions (customer_id);
GO

-- Add constraints for applied_voucher_id
ALTER TABLE dbo.Orders
ADD CONSTRAINT FK_Orders_AppliedVoucher FOREIGN KEY (applied_voucher_id) REFERENCES dbo.CustomerVouchers(customer_voucher_id);
GO

ALTER TABLE dbo.Reservations
ADD CONSTRAINT FK_Reservations_AppliedVoucher FOREIGN KEY (applied_voucher_id) REFERENCES dbo.CustomerVouchers(customer_voucher_id);
GO

CREATE TABLE dbo.BillSplits (
    split_id       INT IDENTITY(1,1) NOT NULL,
    order_id       INT NOT NULL, 
    split_name     NVARCHAR(50) NULL, 
    split_amount   DECIMAL(12,2) NOT NULL,
    payment_status NVARCHAR(20) NOT NULL CONSTRAINT DF_BillSplits_status DEFAULT N'Pending',
    paid_at        DATETIME2(0) NULL,
    created_at     DATETIME2(0) NOT NULL CONSTRAINT DF_BillSplits_created DEFAULT SYSDATETIME(),
    CONSTRAINT PK_BillSplits PRIMARY KEY (split_id),
    CONSTRAINT FK_BillSplits_Order FOREIGN KEY (order_id) REFERENCES dbo.Orders(order_id) ON DELETE CASCADE,
    CONSTRAINT CK_BillSplits_amount CHECK (split_amount > 0),
    CONSTRAINT CK_BillSplits_status CHECK (payment_status IN (N'Pending', N'Paid', N'Cancelled'))
);
GO

-- ============================================================================
-- MODULE 7: AUDIT, REVIEWS & LOGS
-- ============================================================================

CREATE TABLE dbo.Notifications (
    notification_id   INT IDENTITY(1,1) NOT NULL,
    user_id           INT NOT NULL,
    notification_type NVARCHAR(40) NOT NULL,
    title             NVARCHAR(200) NOT NULL,
    message_body      NVARCHAR(2000) NOT NULL,
    is_read           BIT NOT NULL CONSTRAINT DF_Notifications_is_read DEFAULT 0,
    sent_at           DATETIME2(0) NOT NULL CONSTRAINT DF_Notifications_sent_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_Notifications PRIMARY KEY (notification_id),
    CONSTRAINT FK_Notifications_UserAccounts FOREIGN KEY (user_id) REFERENCES dbo.UserAccounts(user_id) ON DELETE CASCADE,
    CONSTRAINT CK_Notifications_type CHECK (notification_type IN
        (N'Booking Confirmed', N'Booking Rejected', N'Booking Cancelled', N'Booking Reminder',
         N'Booking Changed', N'Order Ready', N'Payment Receipt', N'Promotion', N'System'))
);
GO

CREATE TABLE dbo.CustomerReviews (
    review_id        INT IDENTITY(1,1) NOT NULL,
    customer_id      INT NULL,
    reservation_id   INT NULL,
    order_id         INT NULL,
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
    CONSTRAINT FK_CustomerReviews_Customer FOREIGN KEY (customer_id) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT FK_CustomerReviews_Reservations FOREIGN KEY (reservation_id) REFERENCES dbo.Reservations(reservation_id) ON DELETE SET NULL,
    CONSTRAINT FK_CustomerReviews_Orders FOREIGN KEY (order_id) REFERENCES dbo.Orders(order_id) ON DELETE CASCADE,
    CONSTRAINT CK_CustomerReviews_food CHECK (food_rating BETWEEN 1 AND 5),
    CONSTRAINT CK_CustomerReviews_service CHECK (service_rating BETWEEN 1 AND 5),
    CONSTRAINT CK_CustomerReviews_ambiance CHECK (ambiance_rating IS NULL OR ambiance_rating BETWEEN 1 AND 5)
);
GO

CREATE TABLE dbo.ReportSnapshots (
    snapshot_id           INT IDENTITY(1,1) NOT NULL,
    report_type           NVARCHAR(40) NOT NULL,
    report_date           DATE NOT NULL,
    snapshot_json         NVARCHAR(MAX) NOT NULL,
    generated_by_staff_id INT NULL,
    generated_at          DATETIME2(0) NOT NULL CONSTRAINT DF_ReportSnapshots_generated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_ReportSnapshots PRIMARY KEY (snapshot_id),
    CONSTRAINT UQ_ReportSnapshots_type_date UNIQUE (report_type, report_date),
    CONSTRAINT FK_ReportSnapshots_GeneratedBy FOREIGN KEY (generated_by_staff_id) REFERENCES dbo.UserAccounts(user_id) ON DELETE SET NULL,
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
    CONSTRAINT FK_AuditLogs_UserAccounts FOREIGN KEY (user_id) REFERENCES dbo.UserAccounts(user_id) ON DELETE SET NULL,
    CONSTRAINT CK_AuditLogs_old_json CHECK (old_value_json IS NULL OR ISJSON(old_value_json) = 1),
    CONSTRAINT CK_AuditLogs_new_json CHECK (new_value_json IS NULL OR ISJSON(new_value_json) = 1)
);
GO

CREATE TABLE dbo.RecommendationLogs (
    recommendation_id INT IDENTITY(1,1) NOT NULL,
    customer_id       INT NULL,
    dish_id           INT NOT NULL,
    score             DECIMAL(5,4) NOT NULL CONSTRAINT DF_RecommendationLogs_score DEFAULT 0,
    reason            NVARCHAR(255) NULL,
    shown_at          DATETIME2(0) NOT NULL CONSTRAINT DF_RecommendationLogs_shown_at DEFAULT SYSDATETIME(),
    was_ordered       BIT NOT NULL CONSTRAINT DF_RecommendationLogs_was_ordered DEFAULT 0,
    CONSTRAINT PK_RecommendationLogs PRIMARY KEY (recommendation_id),
    CONSTRAINT FK_RecommendationLogs_Customer FOREIGN KEY (customer_id) REFERENCES dbo.UserAccounts(user_id) ON DELETE CASCADE,
    CONSTRAINT FK_RecommendationLogs_Dishes FOREIGN KEY (dish_id) REFERENCES dbo.Dishes(dish_id) ON DELETE CASCADE,
    CONSTRAINT CK_RecommendationLogs_score CHECK (score BETWEEN 0 AND 1)
);
GO

-- ============================================================================
-- INDEXES
-- ============================================================================
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
CREATE UNIQUE INDEX UQ_CustomerReviews_order ON dbo.CustomerReviews(order_id) WHERE order_id IS NOT NULL;
CREATE UNIQUE INDEX UQ_CustomerReviews_reservation ON dbo.CustomerReviews(reservation_id) WHERE reservation_id IS NOT NULL;
CREATE INDEX IX_CustomerReviews_order ON dbo.CustomerReviews(order_id);
CREATE INDEX IX_Notifications_user_read ON dbo.Notifications(user_id, is_read);
CREATE INDEX IX_OtpTokens_email_purpose_created ON dbo.OtpTokens(email, purpose, created_at DESC);
CREATE INDEX IX_OtpTokens_user_purpose_created ON dbo.OtpTokens(user_id, purpose, created_at DESC);
CREATE INDEX IX_ShiftLogs_staff_time ON dbo.ShiftLogs(staff_user_id, check_in_time);
CREATE INDEX IX_BillSplits_order_status ON dbo.BillSplits(order_id, payment_status);
GO

CREATE TRIGGER dbo.TR_Payments_Loyalty
ON dbo.Payments
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;

  -- 1. EARN: payment transitioned to 'Completed', credit only if not previously credited
  INSERT INTO dbo.LoyaltyTransactions (customer_id, points, transaction_type, reference_type, reference_id, description)
  SELECT 
      COALESCE(o.customer_id, r.customer_id) AS customer_id,
      FLOOR(i.amount_paid / 10000) AS points,
      N'Earn' AS transaction_type,
      N'Payment' AS reference_type,
      i.payment_id AS reference_id,
      N'Earned from payment' AS description
  FROM inserted i
  LEFT JOIN deleted d ON d.payment_id = i.payment_id
  LEFT JOIN dbo.Orders o ON o.order_id = i.order_id
  LEFT JOIN dbo.Reservations r ON r.reservation_id = i.reservation_id
  WHERE i.payment_status = N'Completed' 
    AND (d.payment_status IS NULL OR d.payment_status <> N'Completed')
    AND COALESCE(o.customer_id, r.customer_id) IS NOT NULL
    AND FLOOR(i.amount_paid / 10000) > 0
    AND NOT EXISTS (
      SELECT 1 FROM dbo.LoyaltyTransactions lt
      WHERE lt.reference_type = N'Payment' AND lt.reference_id = i.payment_id AND lt.transaction_type = N'Earn'
    );

  -- 2. CLAWBACK: payment was Completed, but now changed to Refunded or Failed
  INSERT INTO dbo.LoyaltyTransactions (customer_id, points, transaction_type, reference_type, reference_id, description)
  SELECT 
      COALESCE(o.customer_id, r.customer_id) AS customer_id,
      -FLOOR(i.amount_paid / 10000) AS points,
      N'Redeem' AS transaction_type,
      N'Payment' AS reference_type,
      i.payment_id AS reference_id,
      N'Clawback - payment reversed' AS description
  FROM inserted i
  JOIN deleted d ON d.payment_id = i.payment_id
  LEFT JOIN dbo.Orders o ON o.order_id = i.order_id
  LEFT JOIN dbo.Reservations r ON r.reservation_id = i.reservation_id
  WHERE d.payment_status = N'Completed' 
    AND i.payment_status IN (N'Refunded', N'Failed')
    AND COALESCE(o.customer_id, r.customer_id) IS NOT NULL
    AND FLOOR(i.amount_paid / 10000) > 0
    AND EXISTS (
      SELECT 1 FROM dbo.LoyaltyTransactions lt 
      WHERE lt.reference_type = N'Payment' AND lt.reference_id = i.payment_id AND lt.transaction_type = N'Earn'
    )
    AND NOT EXISTS (
      SELECT 1 FROM dbo.LoyaltyTransactions lt
      WHERE lt.reference_type = N'Payment' AND lt.reference_id = i.payment_id AND lt.description = N'Clawback - payment reversed'
    );

  -- 3. Update cached balance on CustomerProfiles to prevent drift
  UPDATE cp
  SET cp.loyalty_points = (
    SELECT ISNULL(SUM(points), 0) 
    FROM dbo.LoyaltyTransactions 
    WHERE customer_id = cp.user_id
  ),
  cp.updated_at = SYSDATETIME()
  FROM dbo.CustomerProfiles cp
  WHERE cp.user_id IN (
    SELECT COALESCE(o.customer_id, r.customer_id)
    FROM inserted i
    LEFT JOIN dbo.Orders o ON o.order_id = i.order_id
    LEFT JOIN dbo.Reservations r ON r.reservation_id = i.reservation_id
    WHERE COALESCE(o.customer_id, r.customer_id) IS NOT NULL
  );
END
GO

-- ============================================================================
-- MOCK DATA (DML) - INSERT STATEMENTS IN ENGLISH
-- ============================================================================

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
(1, 5, N'Dang Quang Phu',  N'phuadmin@phurai.vn',    '0901000001', N'$2b$10$NKnVpBImQPDDAB9pkSw00edPtrHpEWUmwGwPvlaAnNRMcX5HFWwkW',   1, 1, '2026-05-18T08:00:00'),
(2, 4, N'Dang Quang Phu',  N'phumanager@phurai.vn',  '0901000002', N'$2b$10$e04PpX9xUpPuRyW89qcv7.X/Lgfq.6sl319ehCioPrEW1nLXeQis6', 1, 1, '2026-05-18T08:10:00'),
(3, 2, N'Dang Quang Phu',       N'phustaff1@phurai.vn',   '0901000003', N'$2b$10$.s0tXgRsluKKb9rvQOvLB.8Xk6NNncuUhw3EIbrqp70Ap6knasgP6',  1, 1, '2026-05-18T08:30:00'),
(4, 2, N'Pham Thi Thuy',    N'thuystaff@phurai.vn',   '0901000004', N'$2b$10$.s0tXgRsluKKb9rvQOvLB.8Xk6NNncuUhw3EIbrqp70Ap6knasgP6',  1, 1, NULL),
(5, 3, N'Hoang Van Tho',    N'kitchen1@phurai.vn', '0901000005', N'$2b$10$.s0tXgRsluKKb9rvQOvLB.8Xk6NNncuUhw3EIbrqp70Ap6knasgP6',   1, 1, '2026-05-18T09:00:00'),
(6, 3, N'Do Thi Hao',       N'kitchen2@phurai.vn', '0901000006', N'$2b$10$.s0tXgRsluKKb9rvQOvLB.8Xk6NNncuUhw3EIbrqp70Ap6knasgP6',   1, 1, NULL),
(7, 1, N'Minh Khoa',         N'khoa@gmail.com',     '0908000001', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6',   1, 1, '2026-05-17T20:00:00'),
(8, 1, N'Thu Huong',         N'huong@gmail.com',    '0908000002', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6',   1, 1, '2026-05-17T21:00:00'),
(9, 1, N'Bao Nguyen',        N'bao@gmail.com',      '0908000003', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6',   1, 0, NULL),
(10,1, N'Lan Anh',           N'lananh@gmail.com',   '0908000004', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6',   1, 1, NULL),
(11,1, N'Nguyen Minh An',    N'nguyenminhan@gmail.com', '0909000001', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, NULL),
(12,1, N'Tran My Linh',       N'tranmylinh@gmail.com',   '0909000002', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, NULL),
(13,1, N'Le Bao Khanh',       N'lebaokhanh@gmail.com',   '0909000003', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, NULL),
(14, 2, N'Le Huy Manh Tan',    N'tanstaff@phurai.vn',   '0901000004', N'$2b$10$.s0tXgRsluKKb9rvQOvLB.8Xk6NNncuUhw3EIbrqp70Ap6knasgP6',  1, 1, NULL);
SET IDENTITY_INSERT dbo.UserAccounts OFF;
GO

SET IDENTITY_INSERT dbo.CustomerProfiles ON;
INSERT INTO dbo.CustomerProfiles
(customer_id, user_id, username, date_of_birth, gender, country, [language], bio, loyalty_points, preferences)
VALUES
(1, 7,  N'minhkhoa',  '2003-02-10', N'Male',   N'Vietnam', N'Vietnamese', N'Likes salmon and quiet seating.', 150,  N'["Salmon","Quiet seating","Window seat"]'),
(2, 8,  N'thuhuong',  '2002-09-05', N'Female', N'Vietnam', N'English', N'Prefers VIP area and elegant dining experience.', 520,  N'["VIP area","Desserts","Light spicy"]'),
(3, 9,  N'baonguyen', '2004-01-20', N'Male',   N'Vietnam', N'Vietnamese', N'Prefers simple food and no spicy dishes.', 80,   N'["No spicy food","Main dining","Orange juice"]'),
(4, 10, N'lananh',    '2001-12-15', N'Female', N'Vietnam', N'English', N'Usually books private rooms for business dinners.', 980,  N'["Private room","Business dinner","Chef recommendation"]'),
(5, 11, N'annguyen',  '2004-01-12', N'Male',   N'Vietnam', N'Vietnamese', N'Enjoys casual dining and signature dishes.', 120,  N'["Window seat","Mild spicy","Salmon sushi"]'),
(6, 12, N'linhtran',  '2003-08-21', N'Female', N'Vietnam', N'English', N'Prefers elegant seating and light desserts.', 620,  N'["VIP area","Desserts","No seafood allergy"]'),
(7, 13, N'baokhanh',  '2001-12-05', N'Other',  N'Vietnam', N'Vietnamese', N'Guest who often books private rooms.', 1800, N'["Private room","Chef recommendation","Premium wine pairing"]');
SET IDENTITY_INSERT dbo.CustomerProfiles OFF;
GO

INSERT INTO dbo.LoyaltyTransactions (customer_id, points, transaction_type, reference_type, reference_id, description, created_at) VALUES
(7, 150, N'Earn', N'Payment', NULL, N'Initial loyalty points seeder', DATEADD(day, -5, SYSDATETIME())),
(8, 520, N'Earn', N'Payment', NULL, N'Initial loyalty points seeder', DATEADD(day, -5, SYSDATETIME())),
(9, 80, N'Earn', N'Payment', NULL, N'Initial loyalty points seeder', DATEADD(day, -5, SYSDATETIME())),
(10, 980, N'Earn', N'Payment', NULL, N'Initial loyalty points seeder', DATEADD(day, -5, SYSDATETIME())),
(11, 120, N'Earn', N'Payment', NULL, N'Initial loyalty points seeder', DATEADD(day, -5, SYSDATETIME())),
(12, 620, N'Earn', N'Payment', NULL, N'Initial loyalty points seeder', DATEADD(day, -5, SYSDATETIME())),
(13, 1800, N'Earn', N'Payment', NULL, N'Initial loyalty points seeder', DATEADD(day, -5, SYSDATETIME()));
GO

SET IDENTITY_INSERT dbo.StaffProfiles ON;
INSERT INTO dbo.StaffProfiles (staff_id, user_id, staff_code, job_title, hire_date, employment_status, base_salary)
VALUES
(1, 1, 'ADM001', 'System Admin',       '2025-01-01', N'Active', 25000000),
(2, 2, 'MGR001', 'Restaurant Manager', '2025-01-15', N'Active', 22000000),
(3, 3, 'STF001', 'Receptionist',       '2025-02-01', N'Active', 12000000),
(4, 4, 'STF002', 'Waiter',              '2025-02-05', N'Active', 11000000),
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
(N'cancel_deadline_h',N'2',                         N'Hours before reservation to cancel', 1),
(N'hours_mon_thu',    N'7:00 AM — 12:00 AM',        N'Opening hours: Monday to Thursday', 1),
(N'hours_fri_sat',    N'7:00 AM — 12:00 AM',        N'Opening hours: Friday to Saturday', 1),
(N'hours_sunday',     N'7:00 PM — 10:00 PM',        N'Opening hours: Sunday', 1),
(N'hours_happy',      N'4:00 PM — 7:00 PM Daily',   N'Happy Hour timing', 1);
GO

SET IDENTITY_INSERT dbo.Shifts ON;
INSERT INTO dbo.Shifts (shift_id, shift_name, start_time, end_time) VALUES
(1, N'Morning Shift',   '06:30:00', '14:30:00'), 
(2, N'Afternoon Shift', '14:00:00', '22:00:00'), 
(3, N'Night Shift',     '16:30:00', '00:30:00'); 
SET IDENTITY_INSERT dbo.Shifts OFF;
GO

SET IDENTITY_INSERT dbo.RestaurantAreas ON;
INSERT INTO dbo.RestaurantAreas (area_id, area_name, area_type, description) VALUES
(1, N'Window Area',      N'Regular', N'Window-side seating for guests who prefer natural light and quiet dining'),
(2, N'Standard Area',    N'Regular', N'Primary dining area with regular restaurant tables'),
(3, N'Premium Area',     N'VIP',     N'Elevated premium seating with better spacing and atmosphere'),
(4, N'VIP Lounge',       N'VIP',     N'VIP seating area for premium guests and special occasions'),
(5, N'Private Room',     N'Private', N'Private dining room for business dinners, birthdays and celebrations'),
(6, N'Kitchen View',     N'Bar',     N'Chef counter seating near the open kitchen'),
(7, N'Rooftop Outdoor',  N'Outdoor', N'Outdoor rooftop seating with open-air dining experience'),
(8, N'Wine Bar',         N'Bar',     N'Counter seating for wine tasting'),
(9, N'Event Corner',     N'Regular', N'Flexible space for events'),
(10, N'Rooftop Terrace', N'Outdoor', N'Outdoor open-air seating');
SET IDENTITY_INSERT dbo.RestaurantAreas OFF;
GO

SET IDENTITY_INSERT dbo.RestaurantTables ON;
INSERT INTO dbo.RestaurantTables
(table_id, area_id, table_number, capacity, table_status, static_qr_code, is_counter)
VALUES
-- Area 1: Window Area (Cửa sổ: 2, 4, 6, 8 ghế)
(1,  1, N'WIN-A', 2, N'Available', N'qr-win-a', 0),
(2,  1, N'WIN-B', 4, N'Available', N'qr-win-b', 0),
(3,  1, N'WIN-C', 6, N'Available', N'qr-win-c', 0),
(4,  1, N'WIN-D', 8, N'Available', N'qr-win-d', 0),

-- Area 4: VIP Lounge (Phòng VIP: 3 phòng x 6 ghế)
(5,  4, N'VIP-1', 6, N'Available', N'qr-vip-1', 0),
(6,  4, N'VIP-2', 6, N'Occupied',  N'qr-vip-2', 0), -- Khớp UI: Đang có khách
(7,  4, N'VIP-3', 6, N'Available', N'qr-vip-3', 0),

-- Area 2: Standard Dining Area (Sảnh thường: 12 bàn x 4 ghế)
(8,  2, N'S-01',  4, N'Available', N'qr-s-01', 0),
(9,  2, N'S-02',  4, N'Available', N'qr-s-02', 0),
(10, 2, N'S-03',  4, N'Occupied',  N'qr-s-03', 0), -- Khớp UI: Đang có khách
(11, 2, N'S-04',  4, N'Available', N'qr-s-04', 0),
(12, 2, N'S-05',  4, N'Available', N'qr-s-05', 0),
(13, 2, N'S-06',  4, N'Available', N'qr-s-06', 0),
(14, 2, N'S-07',  4, N'Occupied',  N'qr-s-07', 0), -- Khớp UI: Đang có khách
(15, 2, N'S-08',  4, N'Available', N'qr-s-08', 0),
(16, 2, N'S-09',  4, N'Available', N'qr-s-09', 0),
(17, 2, N'S-10',  4, N'Available', N'qr-s-10', 0),
(18, 2, N'S-11',  4, N'Available', N'qr-s-11', 0),
(19, 2, N'S-12',  4, N'Available', N'qr-s-12', 0),

-- Area 3: Premium Area (Sảnh Premium: 4 bàn x 4 ghế)
(20, 3, N'PRE-01',4, N'Available', N'qr-pre-01', 0),
(21, 3, N'PRE-02',4, N'Available', N'qr-pre-02', 0),
(22, 3, N'PRE-03',4, N'Available', N'qr-pre-03', 0),
(23, 3, N'PRE-04',4, N'Available', N'qr-pre-04', 0),

-- Area 5: Private Rooms (Phòng riêng: 2, 4, 6, 8 ghế)
(24, 5, N'PR-01', 2, N'Occupied',  N'qr-pr-01', 0), -- Khớp UI: Đang có khách
(25, 5, N'PR-02', 4, N'Available', N'qr-pr-02', 0),
(26, 5, N'PR-03', 6, N'Available', N'qr-pr-03', 0),
(27, 5, N'PR-04', 8, N'Available', N'qr-pr-04', 0),

-- Area 6: Kitchen View Area (Khu sát bếp: 4 bàn x 4 ghế)
(28, 6, N'K-01',  4, N'Available', N'qr-k-01', 1),
(29, 6, N'K-02',  4, N'Available', N'qr-k-02', 1),
(30, 6, N'K-03',  4, N'Available', N'qr-k-03', 1),
(31, 6, N'K-04',  4, N'Available', N'qr-k-04', 1);
SET IDENTITY_INSERT dbo.RestaurantTables OFF;
GO



SET IDENTITY_INSERT dbo.MenuCategories ON;
INSERT INTO dbo.MenuCategories (category_id, category_name, display_order) VALUES
(1, N'Sushi & Sashimi',     1),
(2, N'Noodle & Rice',        2),
(3, N'Signature Dish',      3),
(4, N'Seafood',              4),
(5, N'Barbecue & Grill',     5),
(6, N'Desserts',             6),
(7, N'Beverages',            7),
(8, N'Chef''s Set Menu',     8);
SET IDENTITY_INSERT dbo.MenuCategories OFF;
GO

SET IDENTITY_INSERT dbo.Dishes ON;
INSERT INTO dbo.Dishes
(dish_id, category_id, dish_name, description, price, cost_price, is_available, is_recommended, spicy_level, prep_time_min, allow_preorder, preorder_sort)
VALUES
(1,  1, N'YELLOWTAIL JALAPEÑO',        N'thinly sliced yellowtail, yuzu soy sauce, garlic puree', 168000,  58000, 1, 1, 1, 10, 1, 1),
(2,  1, N'TORO TARTARE WITH CAVIAR',   N'finely chopped fatty tuna with wasabi soy and oscietra caviar', 428000, 150000, 1, 1, 0, 12, 0, NULL),
(3,  1, N'FLUKE SASHIMI DRY MISO',     N'yuzu juice, extra virgin olive oil, dry miso, chives', 188000,  65000, 1, 0, 0, 10, 0, NULL),
(4,  1, N'NEW STYLE SASHIMI',          N'seared sashimi with sesame seeds, chives, ginger, garlic soy', 228000,  80000, 1, 1, 0, 12, 1, 4),
(5,  1, N'SALMON NEW STYLE',           N'atlantic salmon, thinly sliced, seared with hot olive oil', 168000,  58000, 1, 1, 0, 10, 1, 5),
(6,  2, N'SEAFOOD UDON',               N'thick wheat noodles with assorted seafood in rich dashi broth', 148000,  52000, 1, 0, 0, 15, 0, NULL),
(7,  2, N'WAGYU FRIED RICE',           N'wok-charred rice with premium wagyu beef and vegetables', 188000,  66000, 1, 1, 0, 14, 1, 7),
(8,  2, N'LOBSTER FRIED RICE',         N'delicate jasmine rice with butter-poached lobster and garlic', 260000,  91000, 1, 1, 0, 16, 0, NULL),
(9,  3, N'BLACK COD WITH MISO',        N'tender black cod marinated for three days in a sweet miso glaze', 499000, 175000, 1, 1, 0, 22, 1, 9),
(10, 3, N'ROCK SHRIMP TEMPURA',        N'served with either creamy spicy sauce or butter ponzu', 690000, 240000, 1, 1, 1, 18, 1, 10),
(11, 4, N'LOBSTER WASABI PEPPER',      N'whole lobster sautéed with black pepper, wasabi, and greens', 690000, 240000, 1, 1, 2, 25, 0, NULL),
(12, 4, N'GRILLED SALMON',             N'anticucho or teriyaki glaze, served with crispy baby bok choy', 248000,  87000, 1, 1, 0, 18, 1, 12),
(13, 5, N'JAPANESE A5 WAGYU',          N'the pinnacle of beef quality, flame-grilled over binchotan', 890000, 310000, 1, 1, 0, 20, 1, 13),
(14, 5, N'GRILLED LAMB CHOPS',         N'marinated in rosemary and garlic, served with rosemary-miso sauce', 360000, 126000, 1, 0, 0, 22, 0, NULL),
(15, 6, N'BENTO BOX CHOCOLATE CAKE',   N'warm chocolate fondant with green tea matcha ice cream', 98000,  34000, 1, 1, 0,  8, 1, 15),
(16, 6, N'MISO CAPPUCCINO',             N'coffee soil, miso foam, salted caramel ice cream', 118000,  41000, 1, 0, 0, 10, 0, NULL),
(17, 7, N'HOKUSETSU JUNMAI',           N'premium house sake, clean and dry profile', 89000,  31000, 1, 1, 0,  2, 0, NULL),
(18, 7, N'LYCHEE MARTINI',             N'vodka, lychee liqueur, fresh lychee juice', 89000,  31000, 1, 1, 0,  3, 1, 18),
(19, 8, N'OMAKASE EXPERIENCE',          N'a personalized multi-course journey designed by our head chef', 1290000, 450000, 1, 1, 0, 90, 0, NULL),
(20, 8, N'SIGNATURE TASTING',           N'a curated seven-course menu featuring our world-renowned dishes', 990000, 346000, 1, 1, 0, 75, 1, 20);
SET IDENTITY_INSERT dbo.Dishes OFF;
GO

SET IDENTITY_INSERT dbo.DishImages ON;
INSERT INTO dbo.DishImages (image_id, dish_id, image_url, is_primary) VALUES
(1,  1,  N'/menu/yellowtail-jalapeno.jpg',    1),
(2,  2,  N'/menu/toro-tartare.jpg',            1),
(3,  3,  N'/menu/fluke-sashimi.jpg',           1),
(4,  4,  N'/menu/new-style-sashimi.jpg',       1),
(5,  5,  N'/menu/salmon-new-style.jpg',           1),
(6,  6,  N'/menu/seafood-udon.jpg',            1),
(7,  7,  N'/menu/wagyu-fried-rice.jpg',        1),
(8,  8,  N'/menu/lobster-fried-rice.jpg',     1),
(9,  9,  N'/menu/black-cod-miso.jpg',          1),
(10, 10, N'/menu/rock-shrimp-tempura.jpg',    1),
(11, 11, N'/menu/lobster-wasabi-pepper.jpg',  1),
(12, 12, N'/menu/grilled-salmon.jpg',          1),
(13, 13, N'/menu/japanese-a5-wagyu.jpg',       1),
(14, 14, N'/menu/grilled-lamb-chops.jpg',     1),
(15, 15, N'/menu/bento-chocolate-cake.jpg',    1),
(16, 16, N'/menu/miso-cappuccino.jpg',         1),
(17, 17, N'/menu/hokusetsu-junmai.jpg',        1),
(18, 18, N'/menu/lychee-martini.jpg',          1),
(19, 19, N'/menu/omakase-experience.jpg',      1),
(20, 20, N'/menu/signature-tasting.jpg',       1);
SET IDENTITY_INSERT dbo.DishImages OFF;
GO

SET IDENTITY_INSERT dbo.Reservations ON;
INSERT INTO dbo.Reservations
(reservation_id, customer_id, created_by_staff_id, preferred_area_id, reservation_start_at, reservation_end_at,
 guest_count, special_request, reservation_status, reservation_source, confirmed_by_staff_id, confirmed_at, checked_in_at)
VALUES
(1,  7, NULL, 1, '2026-05-20T18:30:00', '2026-05-20T20:30:00', 2, N'Window seat if possible', N'Confirmed',  N'Online',  3, '2026-05-18T09:15:00', NULL),
(2,  8, NULL, 4, '2026-05-20T19:00:00', '2026-05-20T21:00:00', 4, N'VIP area requested',       N'Confirmed',  N'Online',  3, '2026-05-18T10:00:00', NULL),
(3,  9, NULL, 2, '2026-05-21T12:00:00', '2026-05-21T14:00:00', 3, NULL,                        N'Pending Request',     N'Online',  NULL, NULL, NULL),
(4, 10, NULL, 5, '2026-05-21T20:00:00', '2026-05-21T22:00:00', 6, N'Business dinner',          N'Confirmed',  N'Online',  4, '2026-05-19T08:00:00', NULL),
(5, NULL,3,    2, '2026-05-18T18:00:00', '2026-05-18T20:00:00', 2, N'Walk-in guest',            N'Check-in', N'Walk-in', 3, '2026-05-18T17:55:00', '2026-05-18T18:00:00'),
(6,  7, NULL, 2, '2026-04-10T19:00:00', '2026-04-10T21:00:00', 2, NULL,                        N'Completed',  N'Online',  3, '2026-04-08T10:00:00', '2026-04-10T18:55:00'),
(7,  8, NULL, 4, '2026-04-15T20:00:00', '2026-04-15T22:00:00', 4, N'VIP birthday dinner',      N'Completed',  N'Online',  4, '2026-04-13T09:30:00', '2026-04-15T19:55:00'),
(8, 10, NULL, 1, '2026-06-25T19:00:00', '2026-06-25T21:00:00', 3, N'Customer requested date change', N'Pending Request', N'Online', 3, '2026-06-18T10:00:00', NULL),
(9,  7, NULL, 1, '2026-06-24T18:30:00', '2026-06-24T20:30:00', 2, N'[Dining Purpose: Casual Date]', N'Confirmed',  N'Online',  3, '2026-06-20T09:15:00', NULL),
(10, 8, NULL, 4, '2026-06-24T19:00:00', '2026-06-24T21:00:00', 4, N'[Dining Purpose: Business] window seat', N'Pending Request', N'Online', NULL, NULL, NULL),
(11, 9, NULL, 2, '2026-06-24T12:00:00', '2026-06-24T14:00:00', 3, N'[Dining Purpose: Casual Dining]', N'Awaiting Deposit', N'Online', NULL, NULL, NULL),
(12, 10, NULL, 5, '2026-06-24T20:00:00', '2026-06-24T22:00:00', 6, N'[Dining Purpose: Birthday] extra cake', N'Check-in', N'Online', 4, '2026-06-24T08:00:00', '2026-06-24T19:55:00'),
(13, NULL, 3, 2, '2026-06-24T18:00:00', '2026-06-24T20:00:00', 2, N'[Dining Purpose: Anniversary]', N'Seated', N'Walk-in', 3, '2026-06-24T17:55:00', '2026-06-24T18:00:00'),
(14, 7, NULL, 2, '2026-06-24T19:00:00', '2026-06-24T21:00:00', 2, N'[Dining Purpose: Casual Dining]', N'Payment Pending', N'Online', 3, '2026-06-20T10:00:00', '2026-06-24T18:55:00'),
(15, 8, NULL, 4, '2026-06-24T20:00:00', '2026-06-24T22:00:00', 4, N'[Dining Purpose: Celebration]', N'Completed', N'Online', 4, '2026-06-20T09:30:00', '2026-06-24T19:55:00'),
(16, 10, NULL, 1, '2026-06-24T19:00:00', '2026-06-24T21:00:00', 3, N'[Dining Purpose: Casual Date]', N'Cancelled', N'Online', 3, '2026-06-20T10:00:00', NULL),
(17, 9, NULL, 2, '2026-06-24T18:30:00', '2026-06-24T20:30:00', 2, N'[Dining Purpose: Business]', N'No Show', N'Online', 3, '2026-06-20T11:00:00', NULL),
(18, 7, NULL, 1, '2026-06-24T20:00:00', '2026-06-24T22:00:00', 2, N'[Dining Purpose: Casual Dining]', N'Confirmed', N'Online', 3, '2026-06-20T12:00:00', NULL);
SET IDENTITY_INSERT dbo.Reservations OFF;
GO

INSERT INTO dbo.ReservationTables (reservation_id, table_id, assigned_by_staff_id) VALUES
(1, 1, 3),   -- Res 1 gán vào WIN-A (ID 1)
(2, 5, 3),   -- Res 2 gán vào VIP-1 (ID 5)
(4, 24, 4),  -- Res 4 gán vào PR-01 (ID 24 - Đang có khách)
(5, 10, 3),  -- Res 5 gán vào S-03 (ID 10 - Đang có khách)
(6, 14, 3),  -- Res 6 gán vào S-07 (ID 14 - Đang có khách)
(7, 6, 4);   -- Res 7 gán vào VIP-2 (ID 6 - Đang có khách)
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
(1, 10, NULL, NULL, N'qr-session-t03-20260518-1900', N'Active', 3, '2026-05-18T19:00:00', '2026-05-18T22:00:00'), -- Khớp S-03
(2, 6, 2, 8,    N'qr-session-v02-20260520-1900', N'Active', 3, '2026-05-20T18:50:00', '2026-05-20T22:00:00'), -- Khớp VIP-2
(3, 1, 9, NULL, N'qr-session-wina-live-demo', N'Active', 3, SYSDATETIME(), DATEADD(hour, 4, SYSDATETIME())); -- Live QR Session cho Bàn WIN-A (Res 9)
SET IDENTITY_INSERT dbo.QROrderSessions OFF;
GO

SET IDENTITY_INSERT dbo.Orders ON;
INSERT INTO dbo.Orders
(order_id, reservation_id, table_id, customer_id, created_by_staff_id, qr_session_id, order_type, order_status,
 subtotal, discount_amount, service_charge, total_amount, created_at)
VALUES
(1, 5, 10, NULL, 3, NULL, N'Dine In',  N'Paid',             444000,     0, 22200,  466200, '2026-05-18T18:10:00'), -- Khớp S-03
(2, 6, 14, 7,    3, NULL, N'Dine In',  N'Paid',            1316000, 50000, 63300, 1329300, '2026-04-10T19:10:00'), -- Khớp S-07
(3, 7, 6,  8,    4, NULL, N'Dine In',  N'Paid',            1380000, 50000, 66500, 1396500, '2026-04-15T20:10:00'), -- Khớp VIP-2
(4, 1, 1,  7,    3, NULL, N'Dine In',  N'Open',             425000,     0,     0,  425000, '2026-05-20T18:40:00'), -- Khớp WIN-A
(5, 2, 5,  8,    3, 2,    N'Preorder', N'Sent To Kitchen', 1567000,     0, 78350, 1645350, '2026-05-20T19:00:00'), -- Khớp VIP-1
(6, NULL, 10, NULL, NULL, 1,  N'QR Self',  N'Sent To Kitchen',  336000,     0,     0,  336000, '2026-05-18T19:05:00'), -- Khớp S-03
(7, 9, 1, NULL, NULL, 3,  N'QR Self',  N'Sent To Kitchen',  747000,     0,     0,  747000, SYSDATETIME()); -- Live QR Order cho Bàn WIN-A (KDS Test)
SET IDENTITY_INSERT dbo.Orders OFF;
GO

SET IDENTITY_INSERT dbo.OrderItems ON;
INSERT INTO dbo.OrderItems
(order_item_id, order_id, dish_id, quantity, unit_price, notes, item_status)
VALUES
(1,  1,  1, 1, 168000, NULL,             N'Served'),
(2,  1, 18, 2,  89000, NULL,             N'Served'),
(3,  1, 15, 1,  98000, NULL,             N'Served'),
(4,  2, 13, 1, 890000, N'Well done',     N'Served'),
(5,  2, 12, 1, 248000, NULL,             N'Served'),
(6,  2, 17, 2,  89000, NULL,             N'Served'),
(7,  3, 11, 1, 690000, N'Extra wasabi', N'Served'),
(8,  3, 10, 1, 690000, NULL,             N'Served'),
(9,  4,  1, 2, 168000, NULL,             N'Pending'),
(10, 4, 18, 1,  89000, NULL,             N'Pending'),
(11, 5, 13, 1, 890000, N'Medium rare',  N'Preparing'),
(12, 5,  9, 1, 499000, NULL,             N'Preparing'),
(13, 5, 18, 2,  89000, NULL,             N'Ready'),
(14, 6,  7, 1, 188000, NULL,             N'Preparing'),
(15, 6,  6, 1, 148000, N'No mushrooms', N'Pending'),
(16, 7,  9, 1, 499000, N'QR Món 1 (Live)', N'Sent To Kitchen'),
(17, 7, 12, 1, 248000, N'QR Món 2 (Live)', N'Sent To Kitchen');
SET IDENTITY_INSERT dbo.OrderItems OFF;
GO

SET IDENTITY_INSERT dbo.KitchenTickets ON;
INSERT INTO dbo.KitchenTickets
(kitchen_ticket_id, order_item_id, kitchen_status, priority_level, assigned_to_staff_id, sent_at, started_at, ready_at)
VALUES
(1, 11, N'Preparing', 2, 5, '2026-05-20T19:00:00', '2026-05-20T19:02:00', NULL),
(2, 12, N'Preparing', 2, 5, '2026-05-20T19:00:00', '2026-05-20T19:02:00', NULL),
(3, 13, N'Ready',   3, 6, '2026-05-20T19:00:00', '2026-05-20T19:01:00', '2026-05-20T19:08:00'),
(4, 14, N'Preparing', 3, 5, '2026-05-18T19:05:00', '2026-05-18T19:07:00', NULL),
(5, 15, N'Pending',   3, NULL,'2026-05-18T19:05:00', NULL, NULL),
(6, 16, N'Pending',   3, NULL, SYSDATETIME(), NULL, NULL),
(7, 17, N'Pending',   3, NULL, SYSDATETIME(), NULL, NULL);
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
(1, 1, 1, 466200, 0, N'Completed', NULL,                  3, '2026-05-18T20:30:00'),
(2, 2, 2, 1329300, 0, N'Completed', N'QR-20260410-001',   3, '2026-04-10T21:00:00'),
(3, 3, 3, 1396500, 0, N'Completed', N'CARD-20260415-001', 4, '2026-04-15T21:30:00');
SET IDENTITY_INSERT dbo.Payments OFF;
GO

SET IDENTITY_INSERT dbo.Promotions ON;
INSERT INTO dbo.Promotions
(promotion_id, promotion_name, description, discount_type, discount_value, min_order_value, max_discount, start_at, end_at, is_active, applicable_to, points_required, validity_duration_hours, total_quantity, remaining_quantity, created_by_staff_id)
VALUES
(1, N'Weekend Special 10%', N'10% off during weekends', N'Percent', 10.00, 200000, 50000, '2026-01-01T00:00:00', '2026-12-31T23:59:59', 1, N'Both', NULL, 24, NULL, NULL, 1),
(2, N'New Member 50K',      N'Fixed 50K discount for new members', N'Fixed', 50000, 150000, NULL, '2026-01-01T00:00:00', '2026-12-31T23:59:59', 1, N'Both', NULL, 24, NULL, NULL, 1),
(3, N'VIP Summer 15%',      N'VIP area summer discount', N'Percent', 15.00, 500000, 100000, '2026-06-01T00:00:00', '2026-08-31T23:59:59', 1, N'Both', NULL, 24, NULL, NULL, 1),
(4, N'Loyalty Reward 50K',  N'Exchange 100 points for 50K voucher', N'Fixed', 50000, 150000, NULL, '2026-01-01T00:00:00', '2027-12-31T23:59:59', 1, N'Both', 100, 48, 100, 95, 1),
(5, N'Loyalty Reward 100K', N'Exchange 180 points for 100K voucher', N'Fixed', 100000, 250000, NULL, '2026-01-01T00:00:00', '2027-12-31T23:59:59', 1, N'Both', 180, 72, 50, 47, 1),
(6, N'Loyalty VIP Reward 200K', N'Exchange 300 points for 200K voucher', N'Fixed', 200000, 400000, NULL, '2026-01-01T00:00:00', '2027-12-31T23:59:59', 1, N'Both', 300, 120, 20, 19, 1);
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
(1, 7, N'Booking Confirmed', N'Booking Confirmed',
    N'Your booking on 20/05/2026 at 18:30 for 2 guests has been confirmed.', 1, '2026-05-18T09:15:00'),
(2, 8, N'Booking Confirmed', N'Booking Confirmed',
    N'Your booking on 20/05/2026 at 19:00 for 4 guests in the VIP area has been confirmed.', 0, '2026-05-18T10:00:00'),
(3, 7, N'Booking Reminder', N'Booking Reminder',
    N'You have a booking on 20/05/2026 at 18:30. We look forward to seeing you at Phūrai!', 0, '2026-05-19T09:00:00');
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
(1, 3, N'CONFIRM_RESERVATION',        N'Reservations', 1,
 N'{"reservation_status":"Pending"}',
 N'{"reservation_status":"Confirmed"}',
 '127.0.0.1', '2026-05-18T09:15:00'),
(2, 4, N'MANAGER_RESOLVE_REQUEST',    N'Reservations', 8,
 N'{"reservation_status":"Request"}',
 N'{"reservation_status":"Confirmed"}',
 '127.0.0.1', '2026-06-18T10:05:00'),
(3, 4, N'ASSIGN_TABLE',               N'Reservations', 12,
 N'{"reservation_status":"Check-in","table_id":null}',
 N'{"reservation_status":"Seated","table_id":10}',
 '127.0.0.1', '2026-06-24T19:55:00');
SET IDENTITY_INSERT dbo.AuditLogs OFF;
GO

SET IDENTITY_INSERT dbo.RecommendationLogs ON;
INSERT INTO dbo.RecommendationLogs
(recommendation_id, customer_id, dish_id, score, reason, shown_at, was_ordered)
VALUES
(1, 7, 13, 0.9200, N'Customer often orders premium wagyu and grill items', '2026-05-18T12:00:00', 1),
(2, 8, 11, 0.8700, N'Popular VIP table seafood selection',                  '2026-05-18T12:05:00', 1);
SET IDENTITY_INSERT dbo.RecommendationLogs OFF;
GO

-- ============================================================================
-- CÁC LỆNH TRUY VẤN MẪU TỪNG BẢNG (DQL - SELECT QUERIES)
-- ============================================================================

-- tiếng việt -- 1. Lấy dữ liệu bảng Quyền truy cập (Roles)
SELECT role_id, role_name, description, created_at FROM dbo.Roles;
GO

-- tiếng việt -- 2. Lấy dữ liệu bảng Tài khoản người dùng (UserAccounts)
SELECT user_id, role_id, full_name, email, phone, password_hash, avatar_url, is_active, email_verified, last_login_at, created_at, updated_at FROM dbo.UserAccounts;
GO

-- tiếng việt -- 3. Lấy dữ liệu bảng Mã xác thực OTP (OtpTokens)
SELECT otp_id, user_id, email, purpose, otp_hash, expires_at, verified_at, consumed_at, created_at FROM dbo.OtpTokens;
GO

-- tiếng việt -- 4. Lấy dữ liệu bảng Hồ sơ Khách hàng (CustomerProfiles)
SELECT customer_id, user_id, username, date_of_birth, gender, country, [language], bio, loyalty_points, preferences, created_at, updated_at FROM dbo.CustomerProfiles;
GO

-- tiếng việt -- 5. Lấy dữ liệu bảng Hồ sơ Nhân viên (StaffProfiles)
SELECT staff_id, user_id, staff_code, job_title, hire_date, employment_status, base_salary, created_at, updated_at FROM dbo.StaffProfiles;
GO

-- tiếng việt -- 6. Lấy dữ liệu bảng Cài đặt Nhà hàng (RestaurantSettings)
SELECT setting_key, setting_value, description, updated_by, updated_at FROM dbo.RestaurantSettings;
GO

-- tiếng việt -- 7. Lấy dữ liệu bảng Khu vực Nhà hàng (RestaurantAreas)
SELECT area_id, area_name, area_type, description, is_active, created_at, updated_at FROM dbo.RestaurantAreas;
GO

-- tiếng việt -- 8. Lấy dữ liệu bảng Bàn ăn (RestaurantTables)
SELECT table_id, area_id, table_number, capacity, table_status, static_qr_code, notes, is_counter, merged_into_table_id, created_at, updated_at FROM dbo.RestaurantTables;
GO

-- tiếng việt -- 9. Lấy dữ liệu bảng Ca làm việc (Shifts)
SELECT shift_id, shift_name, start_time, end_time, is_active FROM dbo.Shifts;
GO

-- tiếng việt -- 10. Lấy dữ liệu bảng Lịch làm việc Nhân viên (StaffSchedules)
SELECT schedule_id, user_id, shift_id, work_date, attendance_status, assigned_by, created_at, updated_at FROM dbo.StaffSchedules;
GO

-- tiếng việt -- 11. Lấy dữ liệu bảng Chấm công (ShiftLogs)
SELECT log_id, staff_user_id, shift_id, check_in_time, check_out_time, total_hours, status FROM dbo.ShiftLogs;
GO

-- tiếng việt -- 12. Lấy dữ liệu bảng Danh mục Thực đơn (MenuCategories)
SELECT category_id, category_name, display_order, is_active, created_at, updated_at FROM dbo.MenuCategories;
GO

-- tiếng việt -- 13. Lấy dữ liệu bảng Món ăn (Dishes)
SELECT dish_id, category_id, dish_name, description, price, cost_price, is_available, is_recommended, allow_preorder, preorder_sort, spicy_level, prep_time_min, is_preorderable, created_at, updated_at FROM dbo.Dishes;
GO

-- tiếng việt -- 14. Lấy dữ liệu bảng Hình ảnh Món ăn (DishImages)
SELECT image_id, dish_id, image_url, is_primary, created_at FROM dbo.DishImages;
GO

-- tiếng việt -- 15. Lấy dữ liệu bảng Đặt bàn (Reservations)
SELECT reservation_id, customer_id, contact_name, contact_phone, contact_email, created_by_staff_id, preferred_area_id, reservation_start_at, reservation_end_at, guest_count, special_request, reservation_status, reservation_source, confirmed_by_staff_id, confirmed_at, checked_in_at, cancelled_at, checked_out_at, cancel_reason, reminder_sent, has_pending_request, pending_changes_json, edit_used_count, request_type, rejected_at, rejected_by, resolved_at, resolved_by, created_at, updated_at FROM dbo.Reservations;
GO

-- tiếng việt -- 16. Lấy dữ liệu bảng Bàn được giữ chỗ (ReservationTables)
SELECT reservation_id, table_id, assigned_by_staff_id, assigned_at FROM dbo.ReservationTables;
GO

-- tiếng việt -- 17. Lấy dữ liệu bảng Món ăn đặt trước (PreorderItems)
SELECT preorder_item_id, reservation_id, dish_id, quantity, unit_price, notes, created_at FROM dbo.PreorderItems;
GO

-- tiếng việt -- 18. Lấy dữ liệu bảng Phiên quét QR gọi món (QROrderSessions)
SELECT qr_session_id, table_id, scanned_table_id, reservation_id, customer_id, token, session_status, generated_by_staff_id, generated_at, expires_at, closed_at FROM dbo.QROrderSessions;
GO

-- tiếng việt -- 19. Lấy dữ liệu bảng Đơn hàng (Orders)
SELECT order_id, reservation_id, table_id, customer_id, created_by_staff_id, qr_session_id, parent_order_id, order_type, order_status, order_note, subtotal, discount_amount, service_charge, total_amount, amount_paid, created_at, updated_at FROM dbo.Orders;
GO

-- tiếng việt -- 20. Lấy dữ liệu bảng Món ăn trong Đơn hàng (OrderItems)
SELECT order_item_id, order_id, dish_id, quantity, unit_price, notes, snapshot_table_name, item_status, line_total, created_at, updated_at FROM dbo.OrderItems;
GO

-- tiếng việt -- 21. Lấy dữ liệu bảng Phiếu bếp KDS (KitchenTickets)
SELECT kitchen_ticket_id, order_item_id, kitchen_status, priority_level, assigned_to_staff_id, sent_at, started_at, ready_at, cancelled_at FROM dbo.KitchenTickets;
GO

-- tiếng việt -- 22. Lấy dữ liệu bảng Phương thức Thanh toán (PaymentMethods)
SELECT payment_method_id, method_name, is_active, created_at FROM dbo.PaymentMethods;
GO

-- tiếng việt -- 23. Lấy dữ liệu bảng Thanh toán (Payments)
SELECT payment_id, order_id, reservation_id, payment_method_id, amount_paid, change_given, payment_status, transaction_ref, processed_by_staff_id, paid_at, created_at, updated_at FROM dbo.Payments;
GO

-- tiếng việt -- 24. Lấy dữ liệu bảng Chương trình Khuyến mãi (Promotions)
SELECT promotion_id, promotion_name, description, discount_type, discount_value, min_order_value, max_discount, start_at, end_at, is_active, created_by_staff_id, created_at, updated_at FROM dbo.Promotions;
GO

-- tiếng việt -- 25. Lấy dữ liệu bảng Mã Giảm giá (Vouchers)
SELECT voucher_id, promotion_id, voucher_code, usage_limit, times_used, is_active, created_at, updated_at FROM dbo.Vouchers;
GO

-- tiếng việt -- 26. Lấy dữ liệu bảng Lịch sử Dùng Mã Giảm giá (VoucherRedemptions)
SELECT redemption_id, voucher_id, payment_id, customer_id, discount_amount, redeemed_at FROM dbo.VoucherRedemptions;
GO

-- tiếng việt -- 27. Lấy dữ liệu bảng Chia tiền hóa đơn (BillSplits)
SELECT split_id, order_id, split_name, split_amount, payment_status, paid_at, created_at FROM dbo.BillSplits;
GO

-- tiếng việt -- 28. Lấy dữ liệu bảng Thông báo (Notifications)
SELECT notification_id, user_id, notification_type, title, message_body, is_read, sent_at FROM dbo.Notifications;
GO

-- tiếng việt -- 29. Lấy dữ liệu bảng Đánh giá của Khách hàng (CustomerReviews)
SELECT review_id, customer_id, order_id, food_rating, service_rating, ambiance_rating, overall_rating, comment, is_visible, created_at FROM dbo.CustomerReviews;
GO

-- tiếng việt -- 30. Lấy dữ liệu bảng Báo cáo Thống kê (ReportSnapshots)
SELECT snapshot_id, report_type, report_date, snapshot_json, generated_by_staff_id, generated_at FROM dbo.ReportSnapshots;
GO

-- tiếng việt -- 31. Lấy dữ liệu bảng Nhật ký Hệ thống (AuditLogs)
SELECT audit_log_id, user_id, action_name, target_table, target_id, old_value_json, new_value_json, ip_address, created_at FROM dbo.AuditLogs;
GO

-- tiếng việt -- 32. Lấy dữ liệu bảng Lịch sử Gợi ý Món ăn (RecommendationLogs)
SELECT recommendation_id, customer_id, dish_id, score, reason, shown_at, was_ordered FROM dbo.RecommendationLogs;
GO

-- tiếng việt -- 33. Lấy dữ liệu bảng Nhật ký Trạng thái Đặt bàn (ReservationTimelines)
SELECT timeline_id, reservation_id, event_type, performed_by, notes, created_at FROM dbo.ReservationTimelines;
GO

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
        INSERT INTO dbo.Reservations (contact_name, contact_phone, reservation_start_at, reservation_end_at, guest_count, reservation_status, created_at, updated_at)
        VALUES (N'AutoMock ' + CAST(@days_ago AS NVARCHAR) + '-' + CAST(@i AS NVARCHAR), '0900000000', 
                DATEADD(hour, 19, CAST(CAST(@current_date AS DATE) AS DATETIME2)), 
                DATEADD(hour, 21, CAST(CAST(@current_date AS DATE) AS DATETIME2)), 
                FLOOR(RAND() * 4) + 2, 
                CASE WHEN @days_ago > 0 THEN N'Completed' ELSE N'Seated' END, 
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