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
DROP TABLE IF EXISTS dbo.TableOccupancySessions;
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
DROP TABLE IF EXISTS dbo.KitchenDevices;   -- KDS Device Auth
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
DROP TABLE IF EXISTS dbo.PerformanceReviews; -- Employee Registry
DROP TABLE IF EXISTS dbo.StaffProfiles;
DROP TABLE IF EXISTS dbo.CustomerProfiles;
DROP TABLE IF EXISTS dbo.OtpTokens;
DROP TABLE IF EXISTS dbo.UserAccounts;
DROP TABLE IF EXISTS dbo.JobTitles;          -- Employee Registry lookup
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
    user_id              INT IDENTITY(1,1) NOT NULL,
    role_id              TINYINT NOT NULL,
    full_name            NVARCHAR(120) NOT NULL,
    email                NVARCHAR(180) NOT NULL,
    phone                VARCHAR(25) NULL,
    password_hash        NVARCHAR(255) NOT NULL,
    avatar_url           NVARCHAR(500) NULL,
    is_active            BIT NOT NULL CONSTRAINT DF_UserAccounts_is_active DEFAULT 1,
    email_verified       BIT NOT NULL CONSTRAINT DF_UserAccounts_email_verified DEFAULT 0,
    force_password_reset BIT NOT NULL CONSTRAINT DF_UserAccounts_force_pw_reset DEFAULT 0,
    session_revoked_at   DATETIME2(0) NULL,   -- Phase 2: force-logout on access revocation
    last_login_at        DATETIME2(0) NULL,
    created_at           DATETIME2(0) NOT NULL CONSTRAINT DF_UserAccounts_created_at DEFAULT SYSDATETIME(),
    updated_at           DATETIME2(0) NOT NULL CONSTRAINT DF_UserAccounts_updated_at DEFAULT SYSDATETIME(),

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
        (N'EMAIL_VERIFY', N'PASSWORD_RESET', N'LOGIN_VERIFY', N'CHANGE_PASSWORD', N'FIRST_LOGIN')),
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

-- ============================================================================
-- Job Titles lookup table (Employee Registry — KDS Plan Part B)
-- ============================================================================
CREATE TABLE dbo.JobTitles (
    job_title_id           TINYINT IDENTITY(1,1) NOT NULL,
    title_name             NVARCHAR(80) NOT NULL,
    -- Phase 2: Slot-based access control per job title
    requires_system_access BIT NOT NULL CONSTRAINT DF_JobTitles_sys_access DEFAULT 0,
    default_role_id        TINYINT NULL,   -- FK set after Roles table is created
    CONSTRAINT PK_JobTitles PRIMARY KEY (job_title_id),
    CONSTRAINT UQ_JobTitles_title_name UNIQUE (title_name)
);
GO

CREATE TABLE dbo.StaffProfiles (
    staff_id           INT IDENTITY(1,1) NOT NULL,
    -- user_id is nullable: employees can exist in the registry WITHOUT a system account.
    -- When NULL, has_system_account MUST be 0.
    user_id            INT NULL,
    staff_code         VARCHAR(30) NOT NULL,
    job_title          NVARCHAR(80) NOT NULL,          -- free-text legacy column (kept for backward compat)
    job_title_id       TINYINT NULL,                   -- FK to JobTitles lookup
    hire_date          DATE NOT NULL,
    employment_status  NVARCHAR(20) NOT NULL CONSTRAINT DF_StaffProfiles_status DEFAULT N'Active',
    department         NVARCHAR(60) NULL,              -- new HR column
    has_system_account BIT NOT NULL CONSTRAINT DF_StaffProfiles_has_sys_acct DEFAULT 0,  -- 1 when user_id is linked
    -- contact info fields for employees without a UserAccounts row
    full_name          NVARCHAR(200) NULL,
    email              NVARCHAR(255) NULL,
    phone              NVARCHAR(20) NULL,
    created_at         DATETIME2(0) NOT NULL CONSTRAINT DF_StaffProfiles_created_at DEFAULT SYSDATETIME(),
    updated_at         DATETIME2(0) NOT NULL CONSTRAINT DF_StaffProfiles_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_StaffProfiles PRIMARY KEY (staff_id),
    CONSTRAINT UQ_StaffProfiles_staff_code UNIQUE (staff_code),
    CONSTRAINT FK_StaffProfiles_UserAccounts FOREIGN KEY (user_id) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT FK_StaffProfiles_JobTitles FOREIGN KEY (job_title_id) REFERENCES dbo.JobTitles(job_title_id),
    CONSTRAINT CK_StaffProfiles_status CHECK (employment_status IN (N'Active', N'On Leave', N'Resigned')),
    CONSTRAINT CK_StaffProfiles_sys_acct CHECK (
        (has_system_account = 0 AND user_id IS NULL) OR has_system_account = 1
    )
);
GO

CREATE UNIQUE NONCLUSTERED INDEX UX_StaffProfiles_user_id_filtered
ON dbo.StaffProfiles(user_id)
WHERE user_id IS NOT NULL;
GO

-- PerformanceReviews: manager/admin-only history of staff ratings
CREATE TABLE dbo.PerformanceReviews (
    review_id   INT IDENTITY(1,1) NOT NULL,
    staff_id    INT NOT NULL,
    rating      DECIMAL(3,1) NOT NULL,
    notes       NVARCHAR(1000) NULL,
    reviewed_by INT NOT NULL,
    review_date DATE NOT NULL CONSTRAINT DF_PerformanceReviews_date DEFAULT CAST(SYSDATETIME() AS DATE),
    created_at  DATETIME2(0) NOT NULL CONSTRAINT DF_PerformanceReviews_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_PerformanceReviews PRIMARY KEY (review_id),
    CONSTRAINT FK_PerformanceReviews_Staff FOREIGN KEY (staff_id) REFERENCES dbo.StaffProfiles(staff_id) ON DELETE CASCADE,
    CONSTRAINT FK_PerformanceReviews_ReviewedBy FOREIGN KEY (reviewed_by) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT CK_PerformanceReviews_rating CHECK (rating BETWEEN 1.0 AND 5.0)
);
CREATE INDEX IX_PerformanceReviews_staff ON dbo.PerformanceReviews(staff_id, review_date DESC);
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
    table_id             SMALLINT IDENTITY(1,1) NOT NULL,
    area_id              SMALLINT NOT NULL,
    table_number         NVARCHAR(20) NOT NULL,
    capacity             TINYINT NOT NULL,
    table_status         NVARCHAR(20) NOT NULL CONSTRAINT DF_RestaurantTables_status DEFAULT N'Available',
    -- Phase 1: Structured price tier for financial impact checks (not string-matching area names)
    price_tier           NVARCHAR(20) NOT NULL CONSTRAINT DF_RestaurantTables_tier DEFAULT N'Standard',
    static_qr_code       NVARCHAR(120) NULL,
    notes                NVARCHAR(255) NULL,
    is_counter           BIT NOT NULL CONSTRAINT DF_RestaurantTables_is_counter DEFAULT 0,
    position_x           SMALLINT NOT NULL CONSTRAINT DF_RestaurantTables_px DEFAULT 0,
    position_y           SMALLINT NOT NULL CONSTRAINT DF_RestaurantTables_py DEFAULT 0,
    merged_into_table_id SMALLINT NULL REFERENCES dbo.RestaurantTables(table_id),
    created_at           DATETIME2(0) NOT NULL CONSTRAINT DF_RestaurantTables_created_at DEFAULT SYSDATETIME(),
    updated_at           DATETIME2(0) NOT NULL CONSTRAINT DF_RestaurantTables_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_RestaurantTables PRIMARY KEY (table_id),
    CONSTRAINT UQ_RestaurantTables_table_number UNIQUE (table_number),
    CONSTRAINT UQ_RestaurantTables_static_qr_code UNIQUE (static_qr_code),
    CONSTRAINT FK_RestaurantTables_RestaurantAreas FOREIGN KEY (area_id) REFERENCES dbo.RestaurantAreas(area_id),
    CONSTRAINT CK_RestaurantTables_capacity CHECK (capacity > 0),
    CONSTRAINT CK_RestaurantTables_tier CHECK (price_tier IN (N'Standard', N'Premium', N'VIP')),
    CONSTRAINT CK_RestaurantTables_status CHECK (table_status IN
        (N'Available', N'Reserved', N'Occupied', N'Cleaning', N'Inactive'))
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
    dining_purpose        NVARCHAR(100) NULL,
    deposit_amount        DECIMAL(12, 2) NULL,
    -- Phase 1: deposit_required computed from settings at creation time
    deposit_required      BIT NOT NULL CONSTRAINT DF_Reservations_deposit_req DEFAULT 0,
    final_total           DECIMAL(12, 2) NULL,
    applied_promo_code    VARCHAR(50) NULL,
    preorder_json         NVARCHAR(MAX) NULL,
    order_code            VARCHAR(50) NULL,
    reservation_status    NVARCHAR(25) NOT NULL CONSTRAINT DF_Reservations_status DEFAULT N'Pending Request',
    reservation_source    NVARCHAR(20) NOT NULL CONSTRAINT DF_Reservations_source DEFAULT N'Online',
    confirmed_by_staff_id INT NULL,
    confirmed_at          DATETIME2(0) NULL,
    checked_in_at         DATETIME2(0) NULL,
    seated_at             DATETIME2(0) NULL,
    cancelled_at          DATETIME2(0) NULL,
    checked_out_at        DATETIME2(0) NULL,
    completed_at          DATETIME2(0) NULL,
    cancel_reason         NVARCHAR(255) NULL,
    reminder_sent         BIT NOT NULL CONSTRAINT DF_Reservations_reminder DEFAULT 0,
    -- Phase 1: has_pending_request derived from ReservationChangeRequests (no dual-write)
    -- NOTE: computed column added after ReservationChangeRequests is created (see ALTER below)
    pending_changes_json  NVARCHAR(MAX) NULL,     -- kept for backward compat with editRequest flow
    edit_used_count       INT NOT NULL CONSTRAINT DF_Reservations_EditUsedCount DEFAULT 0,
    request_type          NVARCHAR(20) NULL,       -- kept for backward compat
    -- Phase 1: no-show grace period (minutes), configurable per-reservation
    no_show_grace_minutes INT NOT NULL CONSTRAINT DF_Reservations_NoShowGrace DEFAULT 20,
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
        N'Pending Request', N'Awaiting Deposit', N'Await Check-in',
        N'Dining', N'Pending Payment', N'Completed', N'Cancelled', N'No Show'
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

-- ============================================================================
-- MODULE 4b: RESERVATION CHANGE REQUESTS (Phase 1 — replaces dual-write flag)
-- ============================================================================
-- This table is the single source of truth for pending requests.
-- Reservations.has_pending_request is a computed column derived from this table.
-- ============================================================================
CREATE TABLE dbo.ReservationChangeRequests (
    request_id                   INT IDENTITY(1,1) NOT NULL,
    reservation_id               INT NOT NULL,
    -- Requestor info (customer_id OR contact details for guest bookings)
    requested_by_customer_id     INT NULL,
    requested_by_contact_email   NVARCHAR(100) NULL,
    request_type                 NVARCHAR(20) NOT NULL,
    -- Requested new values (nullable — only the changed fields are populated)
    requested_table_id           SMALLINT NULL,
    requested_start_at           DATETIME2(0) NULL,
    requested_end_at             DATETIME2(0) NULL,
    requested_party_size         TINYINT NULL,
    reason                       NVARCHAR(500) NULL,
    -- Status lifecycle: Pending → StaffResolved | PendingManagerApproval
    --   PendingManagerApproval → ManagerApproved | ManagerRejected
    request_status               NVARCHAR(30) NOT NULL CONSTRAINT DF_RCR_status DEFAULT N'Pending',
    requires_financial_approval  BIT NOT NULL CONSTRAINT DF_RCR_financial DEFAULT 0,
    -- Resolution tracking
    resolved_by_staff_id         INT NULL,
    resolved_by_manager_id       INT NULL,
    manager_reason               NVARCHAR(500) NULL,
    created_at                   DATETIME2(0) NOT NULL CONSTRAINT DF_RCR_created_at DEFAULT SYSDATETIME(),
    resolved_at                  DATETIME2(0) NULL,
    CONSTRAINT PK_ReservationChangeRequests PRIMARY KEY (request_id),
    CONSTRAINT FK_RCR_Reservations FOREIGN KEY (reservation_id) REFERENCES dbo.Reservations(reservation_id) ON DELETE CASCADE,
    CONSTRAINT FK_RCR_Customer FOREIGN KEY (requested_by_customer_id) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT FK_RCR_ResolvedTable FOREIGN KEY (requested_table_id) REFERENCES dbo.RestaurantTables(table_id),
    CONSTRAINT FK_RCR_StaffResolver FOREIGN KEY (resolved_by_staff_id) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT FK_RCR_ManagerResolver FOREIGN KEY (resolved_by_manager_id) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT CK_RCR_type CHECK (request_type IN (N'TableChange', N'TimeChange', N'PartySizeChange', N'Cancel', N'edit', N'cancel')),
    CONSTRAINT CK_RCR_status CHECK (request_status IN (
        N'Pending', N'StaffResolved', N'PendingManagerApproval',
        N'ManagerApproved', N'ManagerRejected', N'Rejected'
    ))
);
GO

-- ── Computed has_pending_request derived from ReservationChangeRequests ───────
-- This runs AFTER both Reservations AND ReservationChangeRequests are created.
-- Eliminates the dual-write race condition entirely.
CREATE OR ALTER FUNCTION dbo.fn_HasPendingRequest (@res_id INT)
RETURNS BIT
AS
BEGIN
    DECLARE @res BIT = 0;
    IF EXISTS (
        SELECT 1 FROM dbo.ReservationChangeRequests rcr
        WHERE rcr.reservation_id = @res_id
          AND rcr.request_status = N'Pending'
    )
        SET @res = 1;
    RETURN @res;
END;
GO

ALTER TABLE dbo.Reservations
ADD has_pending_request AS dbo.fn_HasPendingRequest(reservation_id);
GO

-- ── FK: JobTitles.default_role_id → Roles (added after Roles table exists) ───
ALTER TABLE dbo.JobTitles
ADD CONSTRAINT FK_JobTitles_DefaultRole FOREIGN KEY (default_role_id) REFERENCES dbo.Roles(role_id);
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
    CONSTRAINT FK_OrderItems_Dishes FOREIGN KEY (dish_id) REFERENCES dbo.Dishes(dish_id) ON DELETE NO ACTION,
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
    -- KDS Device Auth: which physical KDS device processed this ticket (nullable — set after device auth)
    device_id            INT NULL,
    sent_at              DATETIME2(0) NOT NULL CONSTRAINT DF_KitchenTickets_sent_at DEFAULT SYSDATETIME(),
    started_at           DATETIME2(0) NULL,
    ready_at             DATETIME2(0) NULL,
    cancelled_at         DATETIME2(0) NULL,
    -- updated_at supports optimistic locking (CAS) when concurrent KDS devices update the same ticket
    updated_at           DATETIME2(0) NOT NULL CONSTRAINT DF_KitchenTickets_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_KitchenTickets PRIMARY KEY (kitchen_ticket_id),
    CONSTRAINT UQ_KitchenTickets_order_item UNIQUE (order_item_id),
    CONSTRAINT FK_KitchenTickets_OrderItems FOREIGN KEY (order_item_id) REFERENCES dbo.OrderItems(order_item_id) ON DELETE CASCADE,
    CONSTRAINT FK_KitchenTickets_AssignedTo FOREIGN KEY (assigned_to_staff_id) REFERENCES dbo.UserAccounts(user_id),
    -- FK_KitchenTickets_Device is added below after KitchenDevices is created (forward ref prevention)
    CONSTRAINT CK_KitchenTickets_status CHECK (kitchen_status IN (N'Pending', N'Sent To Kitchen', N'Preparing', N'Ready', N'Served', N'Cancelled')),
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
-- KitchenDevices — Device-Based KDS Authentication (KDS Plan Part A)
-- Replaces individual Kitchen Staff accounts (role_id=3, deprecated/soft-deleted).
-- Each physical KDS terminal has a PIN → exchanges for a 12-hour JWT.
-- station_category_ids: JSON int array of category_ids this device serves (NULL = all).
-- ============================================================================
CREATE TABLE dbo.KitchenDevices (
    device_id            INT IDENTITY(1,1) NOT NULL,
    device_name          NVARCHAR(100) NOT NULL,
    device_pin_hash      VARCHAR(255) NOT NULL,
    -- Multi-station routing: JSON array e.g. '[1,3]'. NULL = catch-all (all categories).
    station_category_ids NVARCHAR(500) NULL,
    is_active            BIT NOT NULL CONSTRAINT DF_KitchenDevices_is_active DEFAULT 1,
    pin_fail_count       TINYINT NOT NULL CONSTRAINT DF_KitchenDevices_fail_count DEFAULT 0,
    pin_locked_until     DATETIME2(0) NULL,
    created_by           INT NOT NULL,
    created_at           DATETIME2(0) NOT NULL CONSTRAINT DF_KitchenDevices_created_at DEFAULT SYSDATETIME(),
    last_active_at       DATETIME2(0) NULL,
    CONSTRAINT PK_KitchenDevices PRIMARY KEY (device_id),
    CONSTRAINT FK_KitchenDevices_CreatedBy FOREIGN KEY (created_by) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT CK_KitchenDevices_fail_count CHECK (pin_fail_count >= 0)
);
GO

-- Now add the FK from KitchenTickets.device_id → KitchenDevices (added after KitchenDevices is created)
ALTER TABLE dbo.KitchenTickets
ADD CONSTRAINT FK_KitchenTickets_Device FOREIGN KEY (device_id) REFERENCES dbo.KitchenDevices(device_id);
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
         N'Booking Changed', N'Order Ready', N'Payment Receipt', N'Promotion', N'System', N'Overrun Warning'))
);
GO

CREATE TABLE dbo.TableOccupancySessions (
    session_id            INT IDENTITY(1,1) NOT NULL,
    table_id              SMALLINT NOT NULL,
    reservation_id        INT NULL,
    order_id              INT NULL,
    guest_count           TINYINT NOT NULL CONSTRAINT DF_TOS_guest_count DEFAULT 1,
    check_in_at           DATETIME2(0) NOT NULL CONSTRAINT DF_TOS_check_in_at DEFAULT SYSDATETIME(),
    estimated_duration_min INT NOT NULL,
    buffer_min            INT NOT NULL CONSTRAINT DF_TOS_buffer_min DEFAULT 15,
    estimated_release_at  DATETIME2(0) NOT NULL,
    released_at           DATETIME2(0) NULL,
    release_trigger       NVARCHAR(30) NULL,
    released_by_staff_id  INT NULL,
    overrun_alerted       BIT NOT NULL CONSTRAINT DF_TOS_overrun_alerted DEFAULT 0,
    created_at            DATETIME2(0) NOT NULL CONSTRAINT DF_TOS_created_at DEFAULT SYSDATETIME(),
    updated_at            DATETIME2(0) NOT NULL CONSTRAINT DF_TOS_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_TableOccupancySessions PRIMARY KEY (session_id),
    CONSTRAINT FK_TOS_RestaurantTables FOREIGN KEY (table_id)
        REFERENCES dbo.RestaurantTables(table_id) ON DELETE CASCADE,
    CONSTRAINT FK_TOS_Reservations FOREIGN KEY (reservation_id)
        REFERENCES dbo.Reservations(reservation_id) ON DELETE SET NULL,
    CONSTRAINT FK_TOS_Orders FOREIGN KEY (order_id)
        REFERENCES dbo.Orders(order_id),
    CONSTRAINT FK_TOS_Staff FOREIGN KEY (released_by_staff_id)
        REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT CK_TOS_release_trigger CHECK (
        release_trigger IN (N'OnlinePayment', N'StaffCashConfirm', N'ManualRelease') OR release_trigger IS NULL
    ),
    CONSTRAINT CK_TOS_duration CHECK (estimated_duration_min > 0),
    CONSTRAINT CK_TOS_buffer CHECK (buffer_min >= 0)
);
GO

CREATE INDEX IX_TOS_table_open ON dbo.TableOccupancySessions(table_id, released_at)
    WHERE released_at IS NULL;
GO

CREATE INDEX IX_TOS_overrun_check ON dbo.TableOccupancySessions(estimated_release_at, released_at, overrun_alerted)
    WHERE released_at IS NULL;
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
(2, N'Restaurant Staff', N'Receptionist, waiter and floor staff'),
(3, N'Manager', N'Restaurant manager with operational and reporting access'),
(4, N'Admin', N'System administrator or restaurant owner');
SET IDENTITY_INSERT dbo.Roles OFF;
GO

SET IDENTITY_INSERT dbo.UserAccounts ON;
INSERT INTO dbo.UserAccounts
(user_id, role_id, full_name, email, phone, password_hash, is_active, email_verified, last_login_at)
VALUES
(1, 4, N'Dang Quang Phu', N'phuadmin@phurai.vn', '0901000001', N'scrypt$4f2ab2ac57cea58a40e76477d53f3e61$d38e5d2db24cd605a3d29eaf79e1b0429e7c7f5fce28c47faf59126fdd15029828447e1b56d0886c74f888ff7ac6693d7b33e0371ac39c9ff0b55385a0ca547e', 1, 1, '2026-05-18T08:00:00'),

(2, 3, N'Dang Quang Phu', N'phumanager@phurai.vn', '0901000002', N'scrypt$8b83430313edc67abc8eadeefc31e841$ce82bbdd63b2f38cc66e8cb939a52599c91f53a8396a40ec2ee1d3d28dd106eedb890ddbe0a4b462080f268b0f848fc5d3f1974aa3930dab29612cb25cb887f0', 1, 1, '2026-05-18T08:10:00'),
(3, 2, N'Dang Quang Phu', N'phustaff1@phurai.vn', '0901000003', N'$2b$10$.s0tXgRsluKKb9rvQOvLB.8Xk6NNncuUhw3EIbrqp70Ap6knasgP6', 1, 1, '2026-05-18T08:30:00'),
(4, 2, N'Pham Thi Thuy', N'thuystaff@phurai.vn', '0901000004', N'$2b$10$.s0tXgRsluKKb9rvQOvLB.8Xk6NNncuUhw3EIbrqp70Ap6knasgP6', 1, 1, NULL),
(7, 1, N'Minh Khoa', N'khoa@gmail.com', '0908000001', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, '2026-05-17T20:00:00'),
(8, 1, N'Thu Huong', N'huong@gmail.com', '0908000002', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, '2026-05-17T21:00:00'),
(9, 1, N'Bao Nguyen', N'bao@gmail.com', '0908000003', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 0, NULL),
(10, 1, N'Lan Anh', N'lananh@gmail.com', '0908000004', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, NULL),
(11, 1, N'Nguyen Minh An', N'nguyenminhan@gmail.com', '0909000001', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, NULL),
(12, 1, N'Tran My Linh', N'tranmylinh@gmail.com', '0909000002', N'$2b$10$Al78.9LQ9vPbFK9gnbV8Z.sjNOz28idW6tqD5Y5Am8Kc.1jYENt7K', 1, 1, NULL),
(13, 1, N'Le Bao Khanh', N'lebaokhanh@gmail.com', '0909000003', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, NULL),
(14, 2, N'Le Huy Manh Tan', N'tanstaff@phurai.vn', '0901000014', N'$2b$10$.s0tXgRsluKKb9rvQOvLB.8Xk6NNncuUhw3EIbrqp70Ap6knasgP6', 1, 1, NULL),
(15, 1, N'Đặng Quang Phú', N'quagphu159@gmail.com', '0964813966', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, NULL),
-- 3 additional staff accounts
(20, 2, N'Nguyễn Văn Hùng', N'hungnv@phurai.vn', '0901000020', N'$2b$10$.s0tXgRsluKKb9rvQOvLB.8Xk6NNncuUhw3EIbrqp70Ap6knasgP6', 1, 1, NULL),
(21, 2, N'Trần Thị Mai', N'maitt@phurai.vn', '0901000021', N'$2b$10$.s0tXgRsluKKb9rvQOvLB.8Xk6NNncuUhw3EIbrqp70Ap6knasgP6', 1, 1, NULL),
(22, 2, N'Lê Hoàng Nam', N'namlh@phurai.vn', '0901000022', N'$2b$10$.s0tXgRsluKKb9rvQOvLB.8Xk6NNncuUhw3EIbrqp70Ap6knasgP6', 1, 1, NULL),
(23, 2, N'Phạm Hồng Sơn', N'sonph@phurai.vn', '0901000023', N'$2b$10$.s0tXgRsluKKb9rvQOvLB.8Xk6NNncuUhw3EIbrqp70Ap6knasgP6', 1, 1, NULL),
(24, 2, N'Vũ Thị Hà', N'havt@phurai.vn', '0901000024', N'$2b$10$.s0tXgRsluKKb9rvQOvLB.8Xk6NNncuUhw3EIbrqp70Ap6knasgP6', 1, 1, NULL),
(25, 2, N'Đỗ Anh Tuấn', N'tuanda@phurai.vn', '0901000025', N'$2b$10$.s0tXgRsluKKb9rvQOvLB.8Xk6NNncuUhw3EIbrqp70Ap6knasgP6', 1, 1, NULL),
(26, 2, N'Hoàng Kim Chi', N'chihk@phurai.vn', '0901000026', N'$2b$10$.s0tXgRsluKKb9rvQOvLB.8Xk6NNncuUhw3EIbrqp70Ap6knasgP6', 1, 1, NULL),
(27, 2, N'Ngô Quốc Bảo', N'baonq@phurai.vn', '0901000027', N'$2b$10$.s0tXgRsluKKb9rvQOvLB.8Xk6NNncuUhw3EIbrqp70Ap6knasgP6', 1, 1, NULL),
(28, 2, N'Bùi Minh Quân', N'quanbm@phurai.vn', '0901000028', N'$2b$10$.s0tXgRsluKKb9rvQOvLB.8Xk6NNncuUhw3EIbrqp70Ap6knasgP6', 1, 1, NULL),
(29, 2, N'Võ Thị Ngọc', N'ngocvt@phurai.vn', '0901000029', N'$2b$10$.s0tXgRsluKKb9rvQOvLB.8Xk6NNncuUhw3EIbrqp70Ap6knasgP6', 1, 1, NULL),
(101, 1, N'Nguyễn Hữu Trí', N'seeduser1@gmail.com', '0908000001', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 0, 1, NULL),
(102, 1, N'Trần Phương Ly', N'seeduser2@gmail.com', '0908000002', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 0, 1, NULL),
(103, 1, N'Lê Bích Ngọc', N'seeduser3@gmail.com', '0908000003', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 0, 1, NULL),
(104, 1, N'Phạm Công Thành', N'seeduser4@gmail.com', '0908000004', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 0, 1, NULL),
(105, 1, N'Vũ Đức Tâm', N'seeduser5@gmail.com', '0908000005', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 0, 1, NULL),
(106, 1, N'Hoàng Minh Trí', N'seeduser6@gmail.com', '0908000006', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, NULL),
(107, 1, N'Ngô Thanh Sơn', N'seeduser7@gmail.com', '0908000007', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, NULL),
(108, 1, N'Đỗ Quỳnh Anh', N'seeduser8@gmail.com', '0908000008', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, NULL),
(109, 1, N'Bùi Ngọc Yến', N'seeduser9@gmail.com', '0908000009', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, NULL),
(110, 1, N'Trịnh Hữu Minh', N'seeduser10@gmail.com', '0908000010', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, NULL),
(111, 1, N'Phan Đình Phùng', N'seeduser11@gmail.com', '0908000011', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, NULL),
(112, 1, N'Võ Thị Thanh', N'seeduser12@gmail.com', '0908000012', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, NULL),
(113, 1, N'Lý Quang Vinh', N'seeduser13@gmail.com', '0908000013', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, NULL),
(114, 1, N'Hồ Bích Phương', N'seeduser14@gmail.com', '0908000014', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, NULL),
(115, 1, N'Đinh Tiến Đạt', N'seeduser15@gmail.com', '0908000015', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, NULL),
(116, 1, N'Đoàn Bảo Châu', N'seeduser16@gmail.com', '0908000016', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, NULL),
(117, 1, N'Lâm Thu Hiền', N'seeduser17@gmail.com', '0908000017', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, NULL),
(118, 1, N'Đặng Đức Giang', N'seeduser18@gmail.com', '0908000018', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, NULL),
(119, 1, N'Cao Quỳnh Hương', N'seeduser19@gmail.com', '0908000019', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, NULL),
(120, 1, N'Mai Vĩnh Phát', N'seeduser20@gmail.com', '0908000020', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, NULL),
(121, 1, N'Châu Tuấn Kiệt', N'seeduser21@gmail.com', '0908000021', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, NULL),
(122, 1, N'Thạch Kim Lan', N'seeduser22@gmail.com', '0908000022', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, NULL),
(123, 1, N'Trương Hải Nam', N'seeduser23@gmail.com', '0908000023', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, NULL),
(124, 1, N'Khúc Tường Vy', N'seeduser24@gmail.com', '0908000024', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, NULL),
(125, 1, N'Diệp Vấn', N'seeduser25@gmail.com', '0908000025', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, NULL);
SET IDENTITY_INSERT dbo.UserAccounts OFF;
GO

UPDATE dbo.UserAccounts
SET created_at = '2025-07-13T00:00:00', updated_at = '2025-07-13T00:00:00'
WHERE user_id = 15;
GO

SET IDENTITY_INSERT dbo.CustomerProfiles ON;
INSERT INTO dbo.CustomerProfiles
(customer_id, user_id, username, date_of_birth, gender, country, [language], bio, loyalty_points, preferences)
VALUES
(1, 7, N'minhkhoa', '2003-02-10', N'Male', N'Vietnam', N'Vietnamese', N'Likes salmon and quiet seating.', 150, N'["Salmon","Quiet seating","Window seat"]'),
(2, 8, N'thuhuong', '2002-09-05', N'Female', N'Vietnam', N'English', N'Prefers VIP area and elegant dining experience.', 520, N'["VIP area","Desserts","Light spicy"]'),
(3, 9, N'baonguyen', '2004-01-20', N'Male', N'Vietnam', N'Vietnamese', N'Prefers simple food and no spicy dishes.', 80, N'["No spicy food","Main dining","Orange juice"]'),
(4, 10, N'lananh', '2001-12-15', N'Female', N'Vietnam', N'English', N'Usually books private rooms for business dinners.', 980, N'["Private room","Business dinner","Chef recommendation"]'),
(5, 11, N'annguyen', '2004-01-12', N'Male', N'Vietnam', N'Vietnamese', N'Enjoys casual dining and signature dishes.', 120, N'["Window seat","Mild spicy","Salmon sushi"]'),
(6, 12, N'linhtran', '2003-08-21', N'Female', N'Vietnam', N'English', N'Prefers elegant seating and light desserts.', 823, N'["VIP area","Desserts","No seafood allergy"]'),
(7, 13, N'baokhanh', '2001-12-05', N'Other', N'Vietnam', N'Vietnamese', N'Guest who often books private rooms.', 1800, N'["Private room","Chef recommendation","Premium wine pairing"]'),
(8, 15, N'dangquangphu', '2004-12-29', N'Male', N'Vietnam', N'Vietnamese', N'VIP customer since 2025.', 1250, N'["Quiet seating","Window seat"]'),
(11, 101, N'nguyễnhữutrí', '1990-01-01', N'Other', N'Vietnam', N'English', N'VIP Customer', 0, N'[]'),
(12, 102, N'trầnphươngly', '1990-01-01', N'Other', N'Vietnam', N'English', N'VIP Customer', 0, N'[]'),
(13, 103, N'lêbíchngọc', '1990-01-01', N'Other', N'Vietnam', N'English', N'VIP Customer', 0, N'[]'),
(14, 104, N'phạmcôngthành', '1990-01-01', N'Other', N'Vietnam', N'English', N'VIP Customer', 0, N'[]'),
(15, 105, N'vũđứctâm', '1990-01-01', N'Other', N'Vietnam', N'English', N'VIP Customer', 0, N'[]'),
(16, 106, N'hoàngminhtrí', '1990-01-01', N'Other', N'Vietnam', N'English', N'VIP Customer', 0, N'[]'),
(17, 107, N'ngôthanhsơn', '1990-01-01', N'Other', N'Vietnam', N'English', N'VIP Customer', 0, N'[]'),
(18, 108, N'đỗquỳnhanh', '1990-01-01', N'Other', N'Vietnam', N'English', N'VIP Customer', 0, N'[]'),
(19, 109, N'bùingọcyến', '1990-01-01', N'Other', N'Vietnam', N'English', N'VIP Customer', 0, N'[]'),
(20, 110, N'trịnhhữuminh', '1990-01-01', N'Other', N'Vietnam', N'English', N'VIP Customer', 0, N'[]'),
(21, 111, N'phanđìnhphùng', '1990-01-01', N'Other', N'Vietnam', N'English', N'VIP Customer', 0, N'[]'),
(22, 112, N'võthịthanh', '1990-01-01', N'Other', N'Vietnam', N'English', N'VIP Customer', 0, N'[]'),
(23, 113, N'lýquangvinh', '1990-01-01', N'Other', N'Vietnam', N'English', N'VIP Customer', 0, N'[]'),
(24, 114, N'hồbíchphương', '1990-01-01', N'Other', N'Vietnam', N'English', N'VIP Customer', 0, N'[]'),
(25, 115, N'đinhtiếnđạt', '1990-01-01', N'Other', N'Vietnam', N'English', N'VIP Customer', 0, N'[]'),
(26, 116, N'đoànbảochâu', '1990-01-01', N'Other', N'Vietnam', N'English', N'VIP Customer', 0, N'[]'),
(27, 117, N'lâmthuhiền', '1990-01-01', N'Other', N'Vietnam', N'English', N'VIP Customer', 0, N'[]'),
(28, 118, N'đặngđứcgiang', '1990-01-01', N'Other', N'Vietnam', N'English', N'VIP Customer', 0, N'[]'),
(29, 119, N'caoquỳnhhương', '1990-01-01', N'Other', N'Vietnam', N'English', N'VIP Customer', 0, N'[]'),
(30, 120, N'maivĩnhphát', '1990-01-01', N'Other', N'Vietnam', N'English', N'VIP Customer', 0, N'[]'),
(31, 121, N'châutuấnkiệt', '1990-01-01', N'Other', N'Vietnam', N'English', N'VIP Customer', 0, N'[]'),
(32, 122, N'thạchkimlan', '1990-01-01', N'Other', N'Vietnam', N'English', N'VIP Customer', 0, N'[]'),
(33, 123, N'trươnghảinam', '1990-01-01', N'Other', N'Vietnam', N'English', N'VIP Customer', 0, N'[]'),
(34, 124, N'khúctườngvy', '1990-01-01', N'Other', N'Vietnam', N'English', N'VIP Customer', 0, N'[]'),
(35, 125, N'diệpvấn', '1990-01-01', N'Other', N'Vietnam', N'English', N'VIP Customer', 0, N'[]');
SET IDENTITY_INSERT dbo.CustomerProfiles OFF;
GO

UPDATE dbo.UserAccounts
SET avatar_url = N'/avatars/avatar-2.svg', created_at = '2025-07-13T00:00:00', updated_at = '2025-07-13T00:00:00'
WHERE user_id = 12;
GO

UPDATE dbo.CustomerProfiles
SET created_at = '2025-07-13T00:00:00', updated_at = '2025-07-13T00:00:00'
WHERE user_id = 12;
GO

UPDATE dbo.CustomerProfiles
SET created_at = '2025-07-13T00:00:00', updated_at = '2025-07-13T00:00:00'
WHERE customer_id = 8;
GO


INSERT INTO dbo.LoyaltyTransactions (customer_id, points, transaction_type, reference_type, reference_id, description, created_at) VALUES
(7, 150, N'Earn', N'Payment', NULL, N'Initial loyalty points seeder', DATEADD(day, -5, SYSDATETIME())),
(8, 520, N'Earn', N'Payment', NULL, N'Initial loyalty points seeder', DATEADD(day, -5, SYSDATETIME())),
(9, 80, N'Earn', N'Payment', NULL, N'Initial loyalty points seeder', DATEADD(day, -5, SYSDATETIME())),
(10, 980, N'Earn', N'Payment', NULL, N'Initial loyalty points seeder', DATEADD(day, -5, SYSDATETIME())),
(11, 120, N'Earn', N'Payment', NULL, N'Initial loyalty points seeder', DATEADD(day, -5, SYSDATETIME())),
(12, 620, N'Earn', N'Payment', NULL, N'Initial loyalty points seeder', '2025-07-13T20:00:00'),
(12, 132, N'Earn', N'Payment', NULL, N'Loyalty points earned from dining order', DATEADD(day, -5, SYSDATETIME())),
(12, 71, N'Earn', N'Payment', NULL, N'Loyalty points earned from dining order', DATEADD(day, -12, SYSDATETIME())),
(13, 1800, N'Earn', N'Payment', NULL, N'Initial loyalty points seeder', DATEADD(day, -5, SYSDATETIME())),
(8, 1250, N'Earn', N'Payment', NULL, N'Initial loyalty points seeder', '2025-07-13T21:00:00');
GO

-- ── Seed: JobTitles lookup ──────────────────────────────────────────────────
-- Columns: (job_title_id, title_name, requires_system_access, default_role_id)
-- requires_system_access=1 → Manager/Admin should grant a system account for this role
-- default_role_id: 2=Staff, 3=Manager, 4=Admin, NULL=no system access
SET IDENTITY_INSERT dbo.JobTitles ON;
INSERT INTO dbo.JobTitles (job_title_id, title_name, requires_system_access, default_role_id) VALUES
(1, N'System Admin', 1, 4),
(2, N'Manager', 1, 3),
(3, N'Receptionist', 1, 2),
(4, N'Waiter', 0, NULL),
(5, N'Head Chef', 0, NULL),
(6, N'Sous Chef', 0, NULL),
(7, N'Bartender', 0, NULL),
(8, N'Host/Hostess', 0, NULL),
(10, N'Kitchen Porter', 0, NULL),
(11, N'Pastry Chef', 0, NULL),
(12, N'Line Cook', 0, NULL),
(13, N'Server', 0, NULL);
SET IDENTITY_INSERT dbo.JobTitles OFF;
GO

-- ── Seed: StaffProfiles ─────────────────────────────────────────────────────
-- has_system_account=1 for all rows that have a linked UserAccounts row.
-- Kitchen staff (KIT001/KIT002) kept as Resigned since their UserAccounts are soft-deleted.
SET IDENTITY_INSERT dbo.StaffProfiles ON;
INSERT INTO dbo.StaffProfiles (staff_id, user_id, staff_code, job_title, job_title_id, hire_date, employment_status, has_system_account, full_name, email, phone)
VALUES
(1, 1, 'ADM001', N'System Admin', 1, '2025-01-01', N'Active', 1, NULL, NULL, NULL),
(2, 2, 'MGR001', N'Restaurant Manager', 2, '2025-01-15', N'Active', 1, NULL, NULL, NULL),
(3, 3, 'STF001', N'Receptionist', 3, '2025-02-01', N'Active', 1, NULL, NULL, NULL),
(4, 4, 'STF002', N'Receptionist', 3, '2025-02-05', N'Active', 1, NULL, NULL, NULL),
(7, 14, 'STF003', N'Receptionist', 3, '2025-04-01', N'Active', 1, NULL, NULL, NULL),
-- 10 additional staff profiles (including ones without system accounts populated with contact info)
(8, 20, 'STF004', N'Waiter', 4, '2025-05-01', N'Active', 1, NULL, NULL, NULL),
(9, 21, 'STF005', N'Receptionist', 3, '2025-05-02', N'Active', 1, NULL, NULL, NULL),
(10, 22, 'STF006', N'Waiter', 4, '2025-05-03', N'Active', 1, NULL, NULL, NULL),
(11, NULL, 'STF007', N'Bartender', 7, '2025-05-04', N'Active', 0, N'Nguyễn Hoàng Nam', N'namnh@phurai.vn', '0902000007'),
(12, NULL, 'STF008', N'Host/Hostess', 8, '2025-05-05', N'Active', 0, N'Trần Thị Hương', N'huongtt@phurai.vn', '0902000008'),
(14, NULL, 'STF010', N'Server', 13, '2025-05-07', N'Active', 0, N'Lê Thanh Hải', N'hailt@phurai.vn', '0902000010'),
(15, NULL, 'STF011', N'Waiter', 4, '2025-05-08', N'Active', 0, N'Hoàng Đức Anh', N'anhhd@phurai.vn', '0902000011'),
(16, NULL, 'STF012', N'Bartender', 7, '2025-05-09', N'Active', 0, N'Phan Quốc Khánh', N'khanhpq@phurai.vn', '0902000012'),
(17, NULL, 'STF013', N'Receptionist', 3, '2025-05-10', N'Active', 0, N'Vũ Ngọc Linh', N'linhvn@phurai.vn', '0902000013'),
(18, NULL, 'STF014', N'Pastry Chef', 11, '2025-05-11', N'Active', 0, N'Đặng Gia Bảo', N'baodg@phurai.vn', '0902000014'),
(19, NULL, 'STF015', N'Line Cook', 12, '2025-05-12', N'Active', 0, N'Bùi Hữu Đạt', N'datbh@phurai.vn', '0902000015'),
(20, NULL, 'STF016', N'Kitchen Porter', 10, '2025-05-13', N'Active', 0, N'Vũ Văn Dũng', N'dungvv@phurai.vn', '0902000016');
SET IDENTITY_INSERT dbo.StaffProfiles OFF;
GO



INSERT INTO dbo.RestaurantSettings (setting_key, setting_value, description, updated_by) VALUES
(N'restaurant_name', N'Phūrai Premium Restaurant', N'Display name', 1),
(N'open_time', N'10:00', N'Opening time', 1),
(N'close_time', N'22:00', N'Closing time', 1),
(N'table_hold_min', N'15', N'Minutes to hold reserved table', 1),
(N'service_charge', N'5', N'Service charge percent', 1),
(N'max_guests', N'12', N'Max guests per reservation', 1),
(N'cancel_deadline_h', N'2', N'Hours before reservation to cancel', 1),
(N'hours_mon_thu', N'7:00 AM — 12:00 AM', N'Opening hours: Monday to Thursday', 1),
(N'hours_fri_sat', N'7:00 AM — 12:00 AM', N'Opening hours: Friday to Saturday', 1),
(N'hours_sunday', N'7:00 PM — 10:00 PM', N'Opening hours: Sunday', 1),
(N'hours_happy', N'4:00 PM — 7:00 PM Daily', N'Happy Hour timing', 1),
-- Phase 1: Deposit threshold configuration (editable via Admin Settings UI)
(N'deposit_party_size_threshold', N'8', N'Min party size to require a deposit', 1),
(N'deposit_min_table_tier', N'VIP', N'Min table tier (Standard/Premium/VIP) to require a deposit', 1),
(N'no_show_grace_default_min', N'20', N'Default grace period in minutes before marking No Show', 1),
(N'cleaning_buffer_min', N'15', N'Buffer minutes added to EstimatedDuration to calculate EstimatedReleaseTime', 1);
GO



SET IDENTITY_INSERT dbo.RestaurantAreas ON;
INSERT INTO dbo.RestaurantAreas (area_id, area_name, area_type, description) VALUES
(1, N'Window Area', N'Regular', N'Window-side seating for guests who prefer natural light and quiet dining'),
(2, N'Standard Area', N'Regular', N'Primary dining area with regular restaurant tables'),
(3, N'Premium Area', N'VIP', N'Elevated premium seating with better spacing and atmosphere'),
(4, N'VIP Lounge', N'VIP', N'VIP seating area for premium guests and special occasions'),
(5, N'Private Room', N'Private', N'Private dining room for business dinners, birthdays and celebrations'),
(6, N'Kitchen View', N'Bar', N'Chef counter seating near the open kitchen'),
(7, N'Rooftop Outdoor', N'Outdoor', N'Outdoor rooftop seating with open-air dining experience'),
(8, N'Wine Bar', N'Bar', N'Counter seating for wine tasting'),
(9, N'Event Corner', N'Regular', N'Flexible space for events'),
(10, N'Rooftop Terrace', N'Outdoor', N'Outdoor open-air seating');
SET IDENTITY_INSERT dbo.RestaurantAreas OFF;
GO

SET IDENTITY_INSERT dbo.RestaurantTables ON;
INSERT INTO dbo.RestaurantTables
(table_id, area_id, table_number, capacity, table_status, price_tier, static_qr_code, is_counter)
VALUES
-- Area 1: Window Area (Cửa sổ: 2, 4, 6, 8 ghế)
(1, 1, N'WIN-A', 2, N'Available', N'Standard', N'qr-win-a', 0),
(2, 1, N'WIN-B', 4, N'Available', N'Standard', N'qr-win-b', 0),
(3, 1, N'WIN-C', 6, N'Available', N'Standard', N'qr-win-c', 0),
(4, 1, N'WIN-D', 8, N'Available', N'Standard', N'qr-win-d', 0),

-- Area 4: VIP Lounge (Phòng VIP: 3 phòng x 6 ghế) — price_tier = VIP
(5, 4, N'VIP-1', 6, N'Available', N'VIP', N'qr-vip-1', 0),
(6, 4, N'VIP-2', 6, N'Occupied', N'VIP', N'qr-vip-2', 0), -- Khớp UI: Đang có khách
(7, 4, N'VIP-3', 6, N'Available', N'VIP', N'qr-vip-3', 0),

-- Area 2: Standard Dining Area (Sảnh thường: 12 bàn x 4 ghế)
(8, 2, N'S-01', 4, N'Available', N'Standard', N'qr-s-01', 0),
(9, 2, N'S-02', 4, N'Available', N'Standard', N'qr-s-02', 0),
(10, 2, N'S-03', 4, N'Occupied', N'Standard', N'qr-s-03', 0), -- Khớp UI: Đang có khách
(11, 2, N'S-04', 4, N'Available', N'Standard', N'qr-s-04', 0),
(12, 2, N'S-05', 4, N'Available', N'Standard', N'qr-s-05', 0),
(13, 2, N'S-06', 4, N'Available', N'Standard', N'qr-s-06', 0),
(14, 2, N'S-07', 4, N'Occupied', N'Standard', N'qr-s-07', 0), -- Khớp UI: Đang có khách
(15, 2, N'S-08', 4, N'Available', N'Standard', N'qr-s-08', 0),
(16, 2, N'S-09', 4, N'Available', N'Standard', N'qr-s-09', 0),
(17, 2, N'S-10', 4, N'Available', N'Standard', N'qr-s-10', 0),
(18, 2, N'S-11', 4, N'Available', N'Standard', N'qr-s-11', 0),
(19, 2, N'S-12', 4, N'Available', N'Standard', N'qr-s-12', 0),

-- Area 3: Premium Area (Sảnh Premium: 4 bàn x 4 ghế) — price_tier = Premium
(20, 3, N'PRE-01', 4, N'Available', N'Premium', N'qr-pre-01', 0),
(21, 3, N'PRE-02', 4, N'Available', N'Premium', N'qr-pre-02', 0),
(22, 3, N'PRE-03', 4, N'Available', N'Premium', N'qr-pre-03', 0),
(23, 3, N'PRE-04', 4, N'Available', N'Premium', N'qr-pre-04', 0),

-- Area 5: Private Rooms (Phòng riêng: 2, 4, 6, 8 ghế) — price_tier = VIP
(24, 5, N'PR-01', 2, N'Occupied', N'VIP', N'qr-pr-01', 0), -- Khớp UI: Đang có khách
(25, 5, N'PR-02', 4, N'Available', N'VIP', N'qr-pr-02', 0),
(26, 5, N'PR-03', 6, N'Available', N'VIP', N'qr-pr-03', 0),
(27, 5, N'PR-04', 8, N'Available', N'VIP', N'qr-pr-04', 0),

-- Area 6: Kitchen View Area (Khu sát bếp: 4 bàn x 4 ghế)
(28, 6, N'K-01', 4, N'Available', N'Standard', N'qr-k-01', 1),
(29, 6, N'K-02', 4, N'Available', N'Standard', N'qr-k-02', 1),
(30, 6, N'K-03', 4, N'Available', N'Standard', N'qr-k-03', 1),
(31, 6, N'K-04', 4, N'Available', N'Standard', N'qr-k-04', 1);
SET IDENTITY_INSERT dbo.RestaurantTables OFF;
GO



SET IDENTITY_INSERT dbo.MenuCategories ON;
INSERT INTO dbo.MenuCategories (category_id, category_name, display_order) VALUES
(1, N'Sushi & Sashimi', 1),
(2, N'Noodle & Rice', 2),
(3, N'Signature Dish', 3),
(4, N'Seafood', 4),
(5, N'Barbecue & Grill', 5),
(6, N'Desserts', 6),
(7, N'Beverages', 7),
(8, N'Chef''s Set Menu', 8);
SET IDENTITY_INSERT dbo.MenuCategories OFF;
GO

SET IDENTITY_INSERT dbo.Dishes ON;
INSERT INTO dbo.Dishes
(dish_id, category_id, dish_name, description, price, cost_price, is_available, is_recommended, spicy_level, prep_time_min, allow_preorder, preorder_sort)
VALUES
(1, 1, N'YELLOWTAIL JALAPEÑO', N'thinly sliced yellowtail, yuzu soy sauce, garlic puree', 168000, 58000, 1, 1, 1, 10, 1, 1),
(2, 1, N'TORO TARTARE WITH CAVIAR', N'finely chopped fatty tuna with wasabi soy and oscietra caviar', 428000, 150000, 1, 1, 0, 12, 0, NULL),
(3, 1, N'FLUKE SASHIMI DRY MISO', N'yuzu juice, extra virgin olive oil, dry miso, chives', 188000, 65000, 1, 0, 0, 10, 0, NULL),
(4, 1, N'NEW STYLE SASHIMI', N'seared sashimi with sesame seeds, chives, ginger, garlic soy', 228000, 80000, 1, 1, 0, 12, 1, 4),
(5, 1, N'SALMON NEW STYLE', N'atlantic salmon, thinly sliced, seared with hot olive oil', 168000, 58000, 1, 1, 0, 10, 1, 5),
(6, 2, N'SEAFOOD UDON', N'thick wheat noodles with assorted seafood in rich dashi broth', 148000, 52000, 1, 0, 0, 15, 0, NULL),
(7, 2, N'WAGYU FRIED RICE', N'wok-charred rice with premium wagyu beef and vegetables', 188000, 66000, 1, 1, 0, 14, 1, 7),
(8, 2, N'LOBSTER FRIED RICE', N'delicate jasmine rice with butter-poached lobster and garlic', 260000, 91000, 1, 1, 0, 16, 0, NULL),
(9, 3, N'BLACK COD WITH MISO', N'tender black cod marinated for three days in a sweet miso glaze', 499000, 175000, 1, 1, 0, 22, 1, 9),
(10, 3, N'ROCK SHRIMP TEMPURA', N'served with either creamy spicy sauce or butter ponzu', 690000, 240000, 1, 1, 1, 18, 1, 10),
(11, 4, N'LOBSTER WASABI PEPPER', N'whole lobster sautéed with black pepper, wasabi, and greens', 690000, 240000, 1, 1, 2, 25, 0, NULL),
(12, 4, N'GRILLED SALMON', N'anticucho or teriyaki glaze, served with crispy baby bok choy', 248000, 87000, 1, 1, 0, 18, 1, 12),
(13, 5, N'JAPANESE A5 WAGYU', N'the pinnacle of beef quality, flame-grilled over binchotan', 890000, 310000, 1, 1, 0, 20, 1, 13),
(14, 5, N'GRILLED LAMB CHOPS', N'marinated in rosemary and garlic, served with rosemary-miso sauce', 360000, 126000, 1, 0, 0, 22, 0, NULL),
(15, 6, N'BENTO BOX CHOCOLATE CAKE', N'warm chocolate fondant with green tea matcha ice cream', 98000, 34000, 1, 1, 0, 8, 1, 15),
(16, 6, N'MISO CAPPUCCINO', N'coffee soil, miso foam, salted caramel ice cream', 118000, 41000, 1, 0, 0, 10, 0, NULL),
(17, 7, N'HOKUSETSU JUNMAI', N'premium house sake, clean and dry profile', 89000, 31000, 1, 1, 0, 2, 0, NULL),
(18, 7, N'LYCHEE MARTINI', N'vodka, lychee liqueur, fresh lychee juice', 89000, 31000, 1, 1, 0, 3, 1, 18),
(19, 8, N'OMAKASE EXPERIENCE', N'a personalized multi-course journey designed by our head chef', 1290000, 450000, 1, 1, 0, 90, 0, NULL),
(20, 8, N'SIGNATURE TASTING', N'a curated seven-course menu featuring our world-renowned dishes', 990000, 346000, 1, 1, 0, 75, 1, 20);
SET IDENTITY_INSERT dbo.Dishes OFF;
GO

SET IDENTITY_INSERT dbo.DishImages ON;
INSERT INTO dbo.DishImages (image_id, dish_id, image_url, is_primary) VALUES
(1, 1, N'/menu/yellowtail-jalapeno.jpg', 1),
(2, 2, N'/menu/toro-tartare.jpg', 1),
(3, 3, N'/menu/fluke-sashimi.jpg', 1),
(4, 4, N'/menu/new-style-sashimi.jpg', 1),
(5, 5, N'/menu/salmon-new-style.jpg', 1),
(6, 6, N'/menu/seafood-udon.jpg', 1),
(7, 7, N'/menu/wagyu-fried-rice.jpg', 1),
(8, 8, N'/menu/lobster-fried-rice.jpg', 1),
(9, 9, N'/menu/black-cod-miso.jpg', 1),
(10, 10, N'/menu/rock-shrimp-tempura.jpg', 1),
(11, 11, N'/menu/lobster-wasabi-pepper.jpg', 1),
(12, 12, N'/menu/grilled-salmon.jpg', 1),
(13, 13, N'/menu/japanese-a5-wagyu.jpg', 1),
(14, 14, N'/menu/grilled-lamb-chops.jpg', 1),
(15, 15, N'/menu/bento-chocolate-cake.jpg', 1),
(16, 16, N'/menu/miso-cappuccino.jpg', 1),
(17, 17, N'/menu/hokusetsu-junmai.jpg', 1),
(18, 18, N'/menu/lychee-martini.jpg', 1),
(19, 19, N'/menu/omakase-experience.jpg', 1),
(20, 20, N'/menu/signature-tasting.jpg', 1);
SET IDENTITY_INSERT dbo.DishImages OFF;
GO

-- ── Seed: KitchenDevices ────────────────────────────────────────────────────
-- PIN hashes below = bcrypt of '1234' (test only — regenerate in production).
-- station_category_ids NULL = catch-all device.
-- created_by = user_id 1 (Admin).
SET IDENTITY_INSERT dbo.KitchenDevices ON;
INSERT INTO dbo.KitchenDevices (device_id, device_name, device_pin_hash, station_category_ids, is_active, created_by)
VALUES
(1, N'KDS - Main Kitchen', N'$2b$10$NKnVpBImQPDDAB9pkSw00edPtrHpEWUmwGwPvlaAnNRMcX5HFWwkW', NULL, 1, 1),
(2, N'KDS - Dessert Bar', N'$2b$10$NKnVpBImQPDDAB9pkSw00edPtrHpEWUmwGwPvlaAnNRMcX5HFWwkW', N'[6]', 1, 1);
SET IDENTITY_INSERT dbo.KitchenDevices OFF;
GO

SET IDENTITY_INSERT dbo.PaymentMethods ON;
INSERT INTO dbo.PaymentMethods (payment_method_id, method_name, is_active) VALUES
(1, N'Cash', 1),
(2, N'QR Code', 1),
(3, N'Bank Card', 1),
(4, N'Mock Pay', 1);
SET IDENTITY_INSERT dbo.PaymentMethods OFF;
GO

-- ============================================================================
-- seed-demo.sql — Production / Staging Demo Seed
-- 
-- PURPOSE : Give the live server enough realistic data to make the
--           dashboard, charts and tables look populated.
--           ~60 rows total, runs in < 2 seconds.
--
-- USAGE   : Called automatically by `npm run db:init:prod`
--           DO NOT run this on local — use `npm run db:init:local` instead.
-- ============================================================================

SET IDENTITY_INSERT dbo.Reservations ON;
INSERT INTO dbo.Reservations
(reservation_id, customer_id, created_by_staff_id, preferred_area_id, reservation_start_at, reservation_end_at,
 guest_count, special_request, dining_purpose, reservation_status, reservation_source, confirmed_by_staff_id, confirmed_at, checked_in_at,
 contact_name, contact_phone, contact_email)
VALUES
(100001, 7, NULL, 1, '2026-05-20T18:30:00', '2026-05-20T20:30:00', 2, N'Window seat if possible', N'Casual Dining', N'Await Check-in', N'Online', 3, '2026-05-18T09:15:00', NULL, NULL, NULL, NULL),
(100002, 8, NULL, 4, '2026-05-20T19:00:00', '2026-05-20T21:00:00', 4, N'VIP area requested', N'Anniversary', N'Await Check-in', N'Online', 3, '2026-05-18T10:00:00', NULL, NULL, NULL, NULL),
(100003, 9, NULL, 2, '2026-05-21T12:00:00', '2026-05-21T14:00:00', 3, NULL, N'Casual Dining', N'Pending Request', N'Online', NULL, NULL, NULL, NULL, NULL, NULL),
(100004, 10, NULL, 5, '2026-05-21T20:00:00', '2026-05-21T22:00:00', 6, N'Business dinner', N'Business', N'Await Check-in', N'Online', 4, '2026-05-19T08:00:00', NULL, NULL, NULL, NULL),
(100005, NULL, 3, 2, '2026-05-18T18:00:00', '2026-05-18T20:00:00', 2, N'Walk-in guest', N'Casual Dining', N'Await Check-in', N'Walk-in', 3, '2026-05-18T17:55:00', '2026-05-18T18:00:00', N'Nguyen Hoang An', '0908111222', 'hoangan@gmail.com'),
(100006, 7, NULL, 2, '2026-04-10T19:00:00', '2026-04-10T21:00:00', 2, NULL, N'Casual Dining', N'Completed', N'Online', 3, '2026-04-08T10:00:00', '2026-04-10T18:55:00', NULL, NULL, NULL),
(100007, 12, NULL, 4, '2026-04-15T20:00:00', '2026-04-15T22:00:00', 4, N'VIP birthday dinner', N'Birthday', N'Completed', N'Online', 4, '2026-04-13T09:30:00', '2026-04-15T19:55:00', NULL, NULL, NULL),
(100008, 10, NULL, 1, '2026-06-25T19:00:00', '2026-06-25T21:00:00', 3, N'Customer requested date change', N'Casual Dining', N'Pending Request', N'Online', 3, '2026-06-18T10:00:00', NULL, NULL, NULL, NULL),
(100009, 7, NULL, 1, '2026-06-24T18:30:00', '2026-06-24T20:30:00', 2, NULL, N'Casual Date', N'Await Check-in', N'Online', 3, '2026-06-20T09:15:00', NULL, NULL, NULL, NULL),
(100010, 8, NULL, 4, '2026-06-24T19:00:00', '2026-06-24T21:00:00', 4, N'window seat', N'Business', N'Pending Request', N'Online', NULL, NULL, NULL, NULL, NULL, NULL),
(100011, 9, NULL, 2, '2026-06-24T12:00:00', '2026-06-24T14:00:00', 3, NULL, N'Casual Dining', N'Awaiting Deposit', N'Online', NULL, NULL, NULL, NULL, NULL, NULL),
(100012, 12, NULL, 5, DATEADD(hour, 1, SYSDATETIME()), DATEADD(hour, 3, SYSDATETIME()), 6, N'extra cake', N'Birthday', N'Await Check-in', N'Online', 4, DATEADD(day, -1, SYSDATETIME()), NULL, NULL, NULL, NULL),
(100013, NULL, 3, 2, '2026-06-24T18:00:00', '2026-06-24T20:00:00', 2, NULL, N'Anniversary', N'Dining', N'Walk-in', 3, '2026-06-24T17:55:00', '2026-06-24T18:00:00', N'Pham Minh Tuan', '0909555666', 'minhtuan@gmail.com'),
(100014, 7, NULL, 2, '2026-06-24T19:00:00', '2026-06-24T21:00:00', 2, NULL, N'Casual Dining', N'Awaiting Deposit', N'Online', 3, '2026-06-20T10:00:00', '2026-06-24T18:55:00', NULL, NULL, NULL),
(100015, 8, NULL, 4, '2026-06-24T20:00:00', '2026-06-24T22:00:00', 4, NULL, N'Celebration', N'Completed', N'Online', 4, '2026-06-20T09:30:00', '2026-06-24T19:55:00', NULL, NULL, NULL),
(100016, 10, NULL, 1, '2026-06-24T19:00:00', '2026-06-24T21:00:00', 3, NULL, N'Casual Date', N'Cancelled', N'Online', 3, '2026-06-20T10:00:00', NULL, NULL, NULL, NULL),
(100017, 9, NULL, 2, '2026-06-24T18:30:00', '2026-06-24T20:30:00', 2, NULL, N'Business', N'No Show', N'Online', 3, '2026-06-20T11:00:00', NULL, NULL, NULL, NULL),
(100018, 7, NULL, 1, '2026-06-24T20:00:00', '2026-06-24T22:00:00', 2, NULL, N'Casual Dining', N'Await Check-in', N'Online', 3, '2026-06-20T12:00:00', NULL, NULL, NULL, NULL),
(100019, 12, NULL, 1, DATEADD(day, -2, SYSDATETIME()), DATEADD(hour, 2, DATEADD(day, -2, SYSDATETIME())), 2, NULL, N'Anniversary', N'Completed', N'Online', 3, DATEADD(day, -4, SYSDATETIME()), DATEADD(minute, -5, DATEADD(day, -2, SYSDATETIME())), NULL, NULL, NULL);

SET IDENTITY_INSERT dbo.Reservations OFF;
GO

INSERT INTO dbo.ReservationTables (reservation_id, table_id, assigned_by_staff_id) VALUES
(100001, 1, 3),   -- Res 1 gán vào WIN-A (ID 1)
(100002, 5, 3),   -- Res 2 gán vào VIP-1 (ID 5)
(100004, 24, 4),  -- Res 4 gán vào PR-01 (ID 24 - Đang có khách)
(100005, 10, 3),  -- Res 5 gán vào S-03 (ID 10 - Đang có khách)
(100006, 14, 3),  -- Res 6 gán vào S-07 (ID 14 - Đang có khách)
(100007, 6, 4),   -- Res 7 gán vào VIP-2 (ID 6 - Đang có khách)
(100019, 1, 3);
GO

SET IDENTITY_INSERT dbo.PreorderItems ON;
INSERT INTO dbo.PreorderItems (preorder_item_id, reservation_id, dish_id, quantity, unit_price, notes) VALUES
(1, 100002, 13, 1, 890000, N'Medium rare please'),
(2, 100002, 9, 1, 499000, NULL),
(3, 100002, 18, 2, 89000, NULL),
(4, 100004, 11, 1, 690000, N'Extra wasabi pepper'),
(5, 100004, 10, 2, 690000, NULL);
SET IDENTITY_INSERT dbo.PreorderItems OFF;
GO

SET IDENTITY_INSERT dbo.QROrderSessions ON;
INSERT INTO dbo.QROrderSessions
(qr_session_id, table_id, reservation_id, customer_id, token, session_status, generated_by_staff_id, generated_at, expires_at)
VALUES
(1, 10, NULL, NULL, N'qr-session-t03-20260518-1900', N'Active', 3, '2026-05-18T19:00:00', '2026-05-18T22:00:00'), -- Khớp S-03
(2, 6, 100002, 8, N'qr-session-v02-20260520-1900', N'Active', 3, '2026-05-20T18:50:00', '2026-05-20T22:00:00'), -- Khớp VIP-2
(3, 1, 100009, NULL, N'qr-session-wina-live-demo', N'Active', 3, SYSDATETIME(), DATEADD(hour, 4, SYSDATETIME())); -- Live QR Session cho Bàn WIN-A (Res 9)
SET IDENTITY_INSERT dbo.QROrderSessions OFF;
GO

SET IDENTITY_INSERT dbo.Orders ON;
INSERT INTO dbo.Orders
(order_id, reservation_id, table_id, customer_id, created_by_staff_id, qr_session_id, order_type, order_status,
 subtotal, discount_amount, service_charge, total_amount, created_at)
VALUES
(100001, 100005, 10, NULL, 3, NULL, N'Dine In', N'Paid', 444000, 0, 22200, 466200, '2026-05-18T18:10:00'), -- Khớp S-03
(100002, 100006, 14, 7, 3, NULL, N'Dine In', N'Paid', 1316000, 50000, 63300, 1329300, '2026-04-10T19:10:00'), -- Khớp S-07
(100003, 100007, 6, 12, 4, NULL, N'Dine In', N'Paid', 1380000, 50000, 66500, 1396500, '2026-04-15T20:10:00'), -- Khớp VIP-2
(100004, 100001, 1, 7, 3, NULL, N'Dine In', N'Open', 425000, 0, 0, 425000, '2026-05-20T18:40:00'), -- Khớp WIN-A
(100005, 100002, 5, 8, 3, 2, N'Preorder', N'Sent To Kitchen', 1567000, 0, 78350, 1645350, '2026-05-20T19:00:00'), -- Khớp VIP-1
(100006, NULL, 10, NULL, NULL, 1, N'QR Self', N'Sent To Kitchen', 336000, 0, 0, 336000, '2026-05-18T19:05:00'), -- Khớp S-03
(100007, 100009, 1, NULL, NULL, 3, N'QR Self', N'Sent To Kitchen', 747000, 0, 0, 747000, SYSDATETIME()), -- Live QR Order cho Bàn WIN-A (KDS Test)
(100008, 100019, 1, 12, 3, NULL, N'Dine In', N'Paid', 1250000, 0, 62500, 1312500, DATEADD(minute, 10, DATEADD(day, -2, SYSDATETIME()))),
(100009, NULL, 2, 12, 3, NULL, N'Dine In', N'Paid', 800000, 0, 40000, 840000, '2026-01-20T19:30:00'),
(100010, NULL, 3, 12, 3, NULL, N'Dine In', N'Paid', 1200000, 0, 60000, 1260000, '2026-02-18T18:45:00'),
(100011, NULL, 1, 12, 4, NULL, N'Dine In', N'Paid', 950000, 0, 47500, 997500, '2026-03-22T20:15:00'),
(100012, NULL, 2, 12, 3, NULL, N'Dine In', N'Paid', 1100000, 0, 55000, 1155000, '2026-05-25T19:10:00'),
(100013, NULL, 4, 12, 4, NULL, N'Dine In', N'Paid', 1400000, 0, 70000, 1470000, '2026-06-15T20:30:00');
SET IDENTITY_INSERT dbo.Orders OFF;
GO

SET IDENTITY_INSERT dbo.OrderItems ON;
INSERT INTO dbo.OrderItems
(order_item_id, order_id, dish_id, quantity, unit_price, notes, item_status)
VALUES
(1, 100001, 1, 1, 168000, NULL, N'Served'),
(2, 100001, 18, 2, 89000, NULL, N'Served'),
(3, 100001, 15, 1, 98000, NULL, N'Served'),
(4, 100002, 13, 1, 890000, N'Well done', N'Served'),
(5, 100002, 12, 1, 248000, NULL, N'Served'),
(6, 100002, 17, 2, 89000, NULL, N'Served'),
(7, 100003, 11, 1, 690000, N'Extra wasabi', N'Served'),
(8, 100003, 10, 1, 690000, NULL, N'Served'),
(9, 100004, 1, 2, 168000, NULL, N'Pending'),
(10, 100004, 18, 1, 89000, NULL, N'Pending'),
(11, 100005, 13, 1, 890000, N'Medium rare', N'Preparing'),
(12, 100005, 9, 1, 499000, NULL, N'Preparing'),
(13, 100005, 18, 2, 89000, NULL, N'Ready'),
(14, 100006, 7, 1, 188000, NULL, N'Preparing'),
(15, 100006, 6, 1, 148000, N'No mushrooms', N'Pending'),
(16, 100007, 9, 1, 499000, NULL, N'Sent To Kitchen'),
(17, 100007, 12, 1, 248000, NULL, N'Sent To Kitchen'),
(18, 100008, 13, 1, 890000, N'Completed order', N'Served'),
(19, 100008, 18, 2, 89000, NULL, N'Served'),
(20, 100008, 7, 1, 182000, NULL, N'Served');
SET IDENTITY_INSERT dbo.OrderItems OFF;
GO

SET IDENTITY_INSERT dbo.KitchenTickets ON;
INSERT INTO dbo.KitchenTickets
(kitchen_ticket_id, order_item_id, kitchen_status, priority_level, assigned_to_staff_id, sent_at, started_at, ready_at)
VALUES
-- assigned_to_staff_id NULL: kitchen staff accounts (user_id 5, 6) are soft-deleted; KDS is device-based now.
(1, 11, N'Preparing', 2, NULL, '2026-05-20T19:00:00', '2026-05-20T19:02:00', NULL),
(2, 12, N'Preparing', 2, NULL, '2026-05-20T19:00:00', '2026-05-20T19:02:00', NULL),
(3, 13, N'Ready', 3, NULL, '2026-05-20T19:00:00', '2026-05-20T19:01:00', '2026-05-20T19:08:00'),
(4, 14, N'Preparing', 3, NULL, '2026-05-18T19:05:00', '2026-05-18T19:07:00', NULL),
(5, 15, N'Pending', 3, NULL, '2026-05-18T19:05:00', NULL, NULL),
(6, 16, N'Pending', 3, NULL, SYSDATETIME(), NULL, NULL),
(7, 17, N'Pending', 3, NULL, SYSDATETIME(), NULL, NULL);
SET IDENTITY_INSERT dbo.KitchenTickets OFF;
GO

SET IDENTITY_INSERT dbo.Payments ON;
INSERT INTO dbo.Payments
(payment_id, order_id, payment_method_id, amount_paid, change_given, payment_status, transaction_ref, processed_by_staff_id, paid_at, created_at)
VALUES
(100001, 100001, 1, 466200, 0, N'Completed', NULL, 3, '2026-05-18T20:30:00', '2026-05-18T20:30:00'),
(100002, 100002, 2, 1329300, 0, N'Completed', N'QR-20260410-001', 3, '2026-04-10T21:00:00', '2026-04-10T21:00:00'),
(100003, 100003, 3, 1396500, 0, N'Completed', N'CARD-20260415-001', 4, '2026-04-15T21:30:00', '2026-04-15T21:30:00'),
(100004, 100008, 2, 1312500, 0, N'Completed', N'QR-LIVE-001', 3, DATEADD(minute, 15, DATEADD(day, -2, SYSDATETIME())), DATEADD(minute, 15, DATEADD(day, -2, SYSDATETIME()))),
(100005, 100009, 2, 840000, 0, N'Completed', N'CARD-20260120-001', 3, '2026-01-20T21:00:00', '2026-01-20T21:00:00'),
(100006, 100010, 1, 1260000, 0, N'Completed', N'QR-20260218-001', 3, '2026-02-18T20:15:00', '2026-02-18T20:15:00'),
(100007, 100011, 2, 997500, 0, N'Completed', N'CARD-20260322-001', 4, '2026-03-22T21:45:00', '2026-03-22T21:45:00'),
(100008, 100012, 2, 1155000, 0, N'Completed', N'QR-20260525-001', 3, '2026-05-25T20:30:00', '2026-05-25T20:30:00'),
(100009, 100013, 3, 1470000, 0, N'Completed', N'CARD-20260615-001', 4, '2026-06-15T22:00:00', '2026-06-15T22:00:00');
SET IDENTITY_INSERT dbo.Payments OFF;
GO

SET IDENTITY_INSERT dbo.Promotions ON;
INSERT INTO dbo.Promotions
(promotion_id, promotion_name, description, discount_type, discount_value, min_order_value, max_discount, start_at, end_at, is_active, applicable_to, points_required, validity_duration_hours, total_quantity, remaining_quantity, created_by_staff_id)
VALUES
(1, N'Weekend Special 10%', N'10% off during weekends', N'Percent', 10.00, 200000, 50000, '2026-01-01T00:00:00', '2026-12-31T23:59:59', 1, N'Both', NULL, 24, NULL, NULL, 1),
(2, N'New Member 50K', N'Fixed 50K discount for new members', N'Fixed', 50000, 150000, NULL, '2026-01-01T00:00:00', '2026-12-31T23:59:59', 1, N'Both', NULL, 24, NULL, NULL, 1),
(3, N'VIP Summer 15%', N'VIP area summer discount', N'Percent', 15.00, 500000, 100000, '2026-06-01T00:00:00', '2026-08-31T23:59:59', 1, N'Both', NULL, 24, NULL, NULL, 1),
(4, N'Loyalty Reward 50K', N'Exchange 100 points for 50K voucher', N'Fixed', 50000, 150000, NULL, '2026-01-01T00:00:00', '2027-12-31T23:59:59', 1, N'Both', 100, 48, 100, 95, 1),
(5, N'Loyalty Reward 100K', N'Exchange 180 points for 100K voucher', N'Fixed', 100000, 250000, NULL, '2026-01-01T00:00:00', '2027-12-31T23:59:59', 1, N'Both', 180, 72, 50, 47, 1),
(6, N'Loyalty VIP Reward 200K', N'Exchange 300 points for 200K voucher', N'Fixed', 200000, 400000, NULL, '2026-01-01T00:00:00', '2027-12-31T23:59:59', 1, N'Both', 300, 120, 20, 19, 1);
SET IDENTITY_INSERT dbo.Promotions OFF;
GO

SET IDENTITY_INSERT dbo.Vouchers ON;
INSERT INTO dbo.Vouchers (voucher_id, promotion_id, voucher_code, usage_limit, times_used, is_active) VALUES
(1, 1, N'WEEKEND10', 100, 12, 1),
(2, 2, N'NEWMEM50', 200, 5, 1),
(3, 2, N'WELCOME50', 200, 3, 1),
(4, 3, N'VIPSUMMER', 50, 1, 1);
SET IDENTITY_INSERT dbo.Vouchers OFF;
GO

SET IDENTITY_INSERT dbo.VoucherRedemptions ON;
INSERT INTO dbo.VoucherRedemptions (redemption_id, voucher_id, payment_id, customer_id, discount_amount, redeemed_at) VALUES
(1, 2, 100002, 7, 50000, '2026-04-10T21:00:00'),
(2, 1, 100003, 8, 50000, '2026-04-15T21:30:00');
SET IDENTITY_INSERT dbo.VoucherRedemptions OFF;
GO

SET IDENTITY_INSERT dbo.Notifications ON;
INSERT INTO dbo.Notifications
(notification_id, user_id, notification_type, title, message_body, is_read, sent_at)
VALUES
(1, 7, N'Booking Confirmed', N'Booking Confirmed', N'Your booking on 20/05/2026 at 18:30 for 2 guests has been confirmed.', 1, '2026-05-18T09:15:00'),
(2, 8, N'Booking Confirmed', N'Booking Confirmed', N'Your booking on 20/05/2026 at 19:00 for 4 guests in the VIP area has been confirmed.', 0, '2026-05-18T10:00:00'),
(3, 7, N'Booking Reminder', N'Booking Reminder', N'You have a booking on 20/05/2026 at 18:30. We look forward to seeing you at Phūrai!', 0, '2026-05-19T09:00:00');
SET IDENTITY_INSERT dbo.Notifications OFF;
GO

SET IDENTITY_INSERT dbo.CustomerReviews ON;
INSERT INTO dbo.CustomerReviews (review_id, customer_id, order_id, food_rating, service_rating, ambiance_rating, comment) VALUES
(1, 7, 100002, 5, 5, 4, N'Japanese A5 Wagyu was exceptional. Attentive service — we will return for omakase.'),
(2, 8, 100003, 4, 5, 5, N'Lobster Wasabi Pepper was bold and memorable. The VIP lounge felt refined and comfortable.');
SET IDENTITY_INSERT dbo.CustomerReviews OFF;
GO

SET IDENTITY_INSERT dbo.ReportSnapshots ON;
INSERT INTO dbo.ReportSnapshots
(snapshot_id, report_type, report_date, snapshot_json, generated_by_staff_id, generated_at)
VALUES
(1, N'Daily Revenue', '2026-05-18', N'{"totalPayments":1,"netRevenue":466200}', 2, '2026-05-18T22:00:00'),
(2, N'Best Selling', '2026-04-30', N'{"topDish":"JAPANESE A5 WAGYU","quantity":2}', 2, '2026-04-30T22:00:00');
SET IDENTITY_INSERT dbo.ReportSnapshots OFF;
GO

SET IDENTITY_INSERT dbo.AuditLogs ON;
INSERT INTO dbo.AuditLogs
(audit_log_id, user_id, action_name, target_table, target_id, old_value_json, new_value_json, ip_address, created_at)
VALUES
(1, 3, N'CONFIRM_RESERVATION', N'Reservations', 100001, N'{"reservation_status":"Pending"}', N'{"reservation_status":"Confirmed"}', '127.0.0.1', '2026-05-18T09:15:00'),
(2, 4, N'MANAGER_RESOLVE_REQUEST', N'Reservations', 100008, N'{"reservation_status":"Request"}', N'{"reservation_status":"Confirmed"}', '127.0.0.1', '2026-06-18T10:05:00'),
(3, 4, N'ASSIGN_TABLE', N'Reservations', 100012, N'{"reservation_status":"Check-in","table_id":null}', N'{"reservation_status":"Dining","table_id":10}', '127.0.0.1', '2026-06-24T19:55:00');
SET IDENTITY_INSERT dbo.AuditLogs OFF;
GO

SET IDENTITY_INSERT dbo.RecommendationLogs ON;
INSERT INTO dbo.RecommendationLogs
(recommendation_id, customer_id, dish_id, score, reason, shown_at, was_ordered)
VALUES
(1, 7, 13, 0.9200, N'Customer often orders premium wagyu and grill items', '2026-05-18T12:00:00', 1),
(2, 8, 11, 0.8700, N'Popular VIP table seafood selection', '2026-05-18T12:05:00', 1);
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
SELECT staff_id, user_id, staff_code, job_title, hire_date, employment_status, created_at, updated_at FROM dbo.StaffProfiles;
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

-- tiếng việt -- 34. Lấy dữ liệu bảng Danh mục Chức danh (JobTitles)
SELECT job_title_id, title_name FROM dbo.JobTitles;
GO

-- tiếng việt -- 35. Lấy dữ liệu bảng Thiết bị KDS (KitchenDevices)
SELECT device_id, device_name, station_category_ids, is_active, pin_fail_count, pin_locked_until, created_by, created_at, last_active_at FROM dbo.KitchenDevices;
GO

-- tiếng việt -- 36. Lấy dữ liệu bảng Lịch sử Đánh giá Hiệu suất (PerformanceReviews)
SELECT review_id, staff_id, rating, notes, reviewed_by, review_date, created_at FROM dbo.PerformanceReviews;
GO

-- ---------------------------------------------------------------------------
-- Phu / Admin test accounts (always upsert so they survive re-init)
-- ---------------------------------------------------------------------------
SET IDENTITY_INSERT dbo.UserAccounts ON;
MERGE dbo.UserAccounts AS target
USING (VALUES
  (1,  4, N'Dang Quang Phu',     N'phuadmin@phurai.vn',  '0901000001',
      N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1),
  (2,  3, N'Dang Quang Phu',     N'phumanager@phurai.vn', '0901000002',
      N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1),
  (3,  2, N'Dang Quang Phu',     N'phustaff1@phurai.vn',  '0901000003',
      N'$2b$10$.s0tXgRsluKKb9rvQOvLB.8Xk6NNncuUhw3EIbrqp70Ap6knasgP6',  1, 1)
) AS source (user_id, role_id, full_name, email, phone, password_hash, is_active, email_verified)
ON target.user_id = source.user_id
WHEN MATCHED THEN UPDATE SET
  role_id = source.role_id, full_name = source.full_name,
  email = source.email, is_active = 1, email_verified = 1
WHEN NOT MATCHED THEN INSERT
  (user_id, role_id, full_name, email, phone, password_hash, is_active, email_verified)
  VALUES (source.user_id, source.role_id, source.full_name, source.email,
          source.phone, source.password_hash, source.is_active, source.email_verified);
SET IDENTITY_INSERT dbo.UserAccounts OFF;
GO

-- ---------------------------------------------------------------------------
-- 30 daily revenue rows for the Revenue Overview chart
-- Uses a tally-table trick — no loops, no stored procedures needed
-- ---------------------------------------------------------------------------
WITH Days AS (
  SELECT TOP 30 ROW_NUMBER() OVER (ORDER BY object_id) AS n FROM sys.objects
)
INSERT INTO dbo.Payments
  (order_id, payment_method_id, amount_paid, change_given,
   payment_status, paid_at, created_at)
SELECT
  ((n % 3) + 1) + 100000                                        AS order_id,
  (n % 2) + 1                                                   AS payment_method_id,
  CAST(300000 + (n * 51300 % 1500000) AS DECIMAL(18,2))         AS amount_paid,
  0                                                             AS change_given,
  N'Completed'                                                  AS payment_status,
  DATEADD(day, -(30 - n), CAST(GETDATE() AS DATE))              AS paid_at,
  DATEADD(day, -(30 - n), CAST(GETDATE() AS DATE))              AS created_at
FROM Days
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.Payments p
  WHERE CAST(p.paid_at AS DATE) = DATEADD(day, -(30 - n), CAST(GETDATE() AS DATE))
    AND p.payment_status = N'Completed'
);
GO

-- ---------------------------------------------------------------------------
-- Demo Reservations — IDs start at 100 to avoid conflict with static data
-- ---------------------------------------------------------------------------
SET IDENTITY_INSERT dbo.Reservations ON;
INSERT INTO dbo.Reservations
  (reservation_id, customer_id, contact_name, contact_phone,
   reservation_start_at, reservation_end_at, guest_count,
   reservation_status, reservation_source, confirmed_by_staff_id, confirmed_at, created_at)
VALUES
-- Upcoming Confirmed
(100100, 7, N'Nguyen Minh Khoa', '0901111001', DATEADD(day, 1, CAST(CAST(GETDATE() AS DATE) AS DATETIME)), DATEADD(day, 1, DATEADD(hour, 2, CAST(CAST(GETDATE() AS DATE) AS DATETIME))), 2, N'Await Check-in', N'Online', 3, GETDATE(), GETDATE()),
(100101, 8, N'Pham Thu Huong', '0901111002', DATEADD(day, 2, CAST(CAST(GETDATE() AS DATE) AS DATETIME)), DATEADD(day, 2, DATEADD(hour, 2, CAST(CAST(GETDATE() AS DATE) AS DATETIME))), 4, N'Await Check-in', N'Online', 3, GETDATE(), GETDATE()),
(100102, 9, N'Le Bao Nguyen', '0901111003', DATEADD(day, 3, CAST(CAST(GETDATE() AS DATE) AS DATETIME)), DATEADD(day, 3, DATEADD(hour, 2, CAST(CAST(GETDATE() AS DATE) AS DATETIME))), 3, N'Pending Request', N'Online', NULL, NULL, GETDATE()),
(100103, 10, N'Nguyen Lan Anh', '0901111004', DATEADD(day, 5, CAST(CAST(GETDATE() AS DATE) AS DATETIME)), DATEADD(day, 5, DATEADD(hour, 2, CAST(CAST(GETDATE() AS DATE) AS DATETIME))), 6, N'Await Check-in', N'Online', 4, GETDATE(), GETDATE()),
-- Pending (manager needs to action)
(100104, 11, N'Tran An Nguyen', '0901111005', DATEADD(day, 2, CAST(CAST(GETDATE() AS DATE) AS DATETIME)), DATEADD(day, 2, DATEADD(hour, 2, CAST(CAST(GETDATE() AS DATE) AS DATETIME))), 4, N'Pending Request', N'Online', NULL, NULL, GETDATE()),
(100105, 12, N'Tran My Linh', '0909000002', DATEADD(day, 4, CAST(CAST(GETDATE() AS DATE) AS DATETIME)), DATEADD(day, 4, DATEADD(hour, 2, CAST(CAST(GETDATE() AS DATE) AS DATETIME))), 2, N'Pending Request', N'Online', NULL, NULL, GETDATE()),
-- Recent Completed
(100106, 8, N'Pham Thu Huong', '0901111002', DATEADD(day, -3, CAST(CAST(GETDATE() AS DATE) AS DATETIME)), DATEADD(day, -3, DATEADD(hour, 2, CAST(CAST(GETDATE() AS DATE) AS DATETIME))), 4, N'Completed', N'Online', 3, DATEADD(day, -5, GETDATE()), DATEADD(day, -5, GETDATE())),
(100107, 9, N'Le Bao Nguyen', '0901111003', DATEADD(day, -7, CAST(CAST(GETDATE() AS DATE) AS DATETIME)), DATEADD(day, -7, DATEADD(hour, 2, CAST(CAST(GETDATE() AS DATE) AS DATETIME))), 3, N'Completed', N'Online', 4, DATEADD(day, -9, GETDATE()), DATEADD(day, -9, GETDATE())),
(100108, 10, N'Nguyen Lan Anh', '0901111004', DATEADD(day, -10, CAST(CAST(GETDATE() AS DATE) AS DATETIME)), DATEADD(day, -10, DATEADD(hour, 2, CAST(CAST(GETDATE() AS DATE) AS DATETIME))), 5, N'Completed', N'Online', 3, DATEADD(day, -12, GETDATE()), DATEADD(day, -12, GETDATE())),
(100109, 7, N'Nguyen Minh Khoa', '0901111001', DATEADD(day, -14, CAST(CAST(GETDATE() AS DATE) AS DATETIME)), DATEADD(day, -14, DATEADD(hour, 2, CAST(CAST(GETDATE() AS DATE) AS DATETIME))), 2, N'Completed', N'Online', 3, DATEADD(day, -16, GETDATE()), DATEADD(day, -16, GETDATE())),
-- Cancelled / No Show
(100110, 12, N'Tran My Linh', '0909000002', DATEADD(day, -2, CAST(CAST(GETDATE() AS DATE) AS DATETIME)), DATEADD(day, -2, DATEADD(hour, 2, CAST(CAST(GETDATE() AS DATE) AS DATETIME))), 2, N'Cancelled', N'Online', NULL, NULL, DATEADD(day, -4, GETDATE())),
(100111, 8, N'Pham Thu Huong', '0901111002', DATEADD(day, -5, CAST(CAST(GETDATE() AS DATE) AS DATETIME)), DATEADD(day, -5, DATEADD(hour, 2, CAST(CAST(GETDATE() AS DATE) AS DATETIME))), 3, N'No Show', N'Online', 3, DATEADD(day, -7, GETDATE()), DATEADD(day, -7, GETDATE())),
-- Realistic Completed Dining for customer 12 (Tran My Linh)
(100112, 12, N'Tran My Linh', '0909000002', DATEADD(day, -5, DATEADD(hour, 19, CAST(CAST(GETDATE() AS DATE) AS DATETIME))), DATEADD(day, -5, DATEADD(hour, 21, CAST(CAST(GETDATE() AS DATE) AS DATETIME))), 2, N'Completed', N'Online', 3, DATEADD(day, -6, GETDATE()), DATEADD(day, -5, GETDATE())),
(100113, 12, N'Tran My Linh', '0909000002', DATEADD(day, -12, DATEADD(hour, 18, DATEADD(minute, 30, CAST(CAST(GETDATE() AS DATE) AS DATETIME)))), DATEADD(day, -12, DATEADD(hour, 20, DATEADD(minute, 30, CAST(CAST(GETDATE() AS DATE) AS DATETIME)))), 2, N'Completed', N'Online', 3, DATEADD(day, -13, GETDATE()), DATEADD(day, -12, GETDATE()));
SET IDENTITY_INSERT dbo.Reservations OFF;
GO

-- Assign demo reservations to tables
INSERT INTO dbo.ReservationTables (reservation_id, table_id, assigned_by_staff_id) VALUES
(100100, 1, 3), (100101, 5, 3), (100103, 24, 4),
(100106, 5, 3), (100107, 11, 4), (100108, 24, 3), (100109, 1, 3),
(100112, 5, 3), (100113, 1, 3);
GO

-- ---------------------------------------------------------------------------
-- Demo Orders + Payments for completed reservations
-- ---------------------------------------------------------------------------
SET IDENTITY_INSERT dbo.Orders ON;
INSERT INTO dbo.Orders
  (order_id, reservation_id, table_id, customer_id, created_by_staff_id,
   order_type, order_status, subtotal, discount_amount, service_charge, total_amount, created_at)
VALUES
(100100, 100106, 5, 8, 3, N'Dine In', N'Paid', 1316000, 50000, 63300, 1329300, DATEADD(day, -3, GETDATE())),
(100101, 100107, 11, 9, 4, N'Dine In', N'Paid', 1030000, 0, 51500, 1081500, DATEADD(day, -7, GETDATE())),
(100102, 100108, 24, 10, 3, N'Dine In', N'Paid', 1890000, 50000, 92000, 1932000, DATEADD(day, -10, GETDATE())),
(100103, 100109, 1, 7, 3, N'Dine In', N'Paid', 680000, 0, 34000, 714000, DATEADD(day, -14, GETDATE())),
(100104, 100112, 5, 12, 3, N'Dine In', N'Paid', 1316000, 50000, 63300, 1329300, DATEADD(day, -5, DATEADD(hour, 19, CAST(CAST(GETDATE() AS DATE) AS DATETIME)))),
(100105, 100113, 1, 12, 3, N'Dine In', N'Paid', 680000, 0, 34000, 714000, DATEADD(day, -12, DATEADD(hour, 18, DATEADD(minute, 30, CAST(CAST(GETDATE() AS DATE) AS DATETIME)))));
SET IDENTITY_INSERT dbo.Orders OFF;
GO

INSERT INTO dbo.Payments
  (order_id, payment_method_id, amount_paid, change_given, payment_status, paid_at, created_at)
VALUES
(100100, 2, 1329300, 0, N'Completed', DATEADD(day, -3, GETDATE()), DATEADD(day, -3, GETDATE())),
(100101, 1, 1100000, 18500, N'Completed', DATEADD(day, -7, GETDATE()), DATEADD(day, -7, GETDATE())),
(100102, 2, 1932000, 0, N'Completed', DATEADD(day, -10, GETDATE()), DATEADD(day, -10, GETDATE())),
(100103, 1, 714000, 0, N'Completed', DATEADD(day, -14, GETDATE()), DATEADD(day, -14, GETDATE())),
(100104, 2, 1329300, 0, N'Completed', DATEADD(day, -5, DATEADD(hour, 19, CAST(CAST(GETDATE() AS DATE) AS DATETIME))), DATEADD(day, -5, DATEADD(hour, 19, CAST(CAST(GETDATE() AS DATE) AS DATETIME)))),
(100105, 1, 714000, 0, N'Completed', DATEADD(day, -12, DATEADD(hour, 18, DATEADD(minute, 30, CAST(CAST(GETDATE() AS DATE) AS DATETIME)))), DATEADD(day, -12, DATEADD(hour, 18, DATEADD(minute, 30, CAST(CAST(GETDATE() AS DATE) AS DATETIME)))));
GO

SET IDENTITY_INSERT dbo.OrderItems ON;
INSERT INTO dbo.OrderItems
  (order_item_id, order_id, dish_id, quantity, unit_price, item_status)
VALUES
(1000, 100100, 13, 1, 890000, N'Served'),
(1001, 100100, 12, 1, 248000, N'Served'),
(1002, 100100, 17, 2, 89000, N'Served'),
(1003, 100101, 11, 1, 690000, N'Served'),
(1004, 100101, 15, 1, 98000, N'Served'),
(1005, 100101, 18, 3, 89000, N'Served'),
(1006, 100102, 19, 1, 1290000, N'Served'),
(1007, 100102, 10, 1, 690000, N'Served'),
(1008, 100103, 1, 2, 168000, N'Served'),
(1009, 100103, 15, 1, 98000, N'Served'),
(1010, 100103, 17, 2, 89000, N'Served'),
(1011, 100104, 13, 1, 890000, N'Served'),
(1012, 100104, 12, 1, 248000, N'Served'),
(1013, 100104, 17, 2, 89000, N'Served'),
(1014, 100105, 1, 2, 168000, N'Served'),
(1015, 100105, 15, 1, 98000, N'Served'),
(1016, 100105, 17, 2, 89000, N'Served');
SET IDENTITY_INSERT dbo.OrderItems OFF;
GO

-- Demo reviews
SET IDENTITY_INSERT dbo.CustomerReviews ON;
INSERT INTO dbo.CustomerReviews
  (review_id, customer_id, order_id, food_rating, service_rating, ambiance_rating, comment)
VALUES
(100, 8, 100100, 5, 5, 4, N'Absolutely stunning. Japanese A5 Wagyu was perfect.'),
(101, 9, 100101, 4, 5, 5, N'Black Cod Miso was divine. Staff were warm throughout.'),
(102, 10, 100102, 5, 4, 5, N'Best tasting menu in the city. Every dish was a work of art.'),
(103, 7, 100103, 4, 5, 4, N'Salmon Mentaiko beautifully presented. Will return for omakase.'),
(104, 12, 100104, 5, 5, 5, N'Wonderful service and Wagyu was incredibly delicious!');
SET IDENTITY_INSERT dbo.CustomerReviews OFF;
GO

-- Demo performance reviews
INSERT INTO dbo.PerformanceReviews (staff_id, rating, notes, reviewed_by, review_date, created_at)
SELECT sp.staff_id, 4.5, N'Strong performance this period.', 2, GETDATE(), GETDATE()
FROM dbo.StaffProfiles sp
WHERE sp.employment_status = N'Active'
  AND NOT EXISTS (
    SELECT 1 FROM dbo.PerformanceReviews pr
    WHERE pr.staff_id = sp.staff_id
      AND CAST(pr.review_date AS DATE) = CAST(GETDATE() AS DATE)
  );
GO

PRINT N'✅ seed-demo.sql complete — production demo data inserted.';
GO


-- ==========================================
-- PHU TEST DATA OVERRIDE
-- ==========================================
BEGIN TRANSACTION;

DECLARE @CustomerRoleId TINYINT;
SELECT @CustomerRoleId = role_id FROM dbo.Roles WHERE role_name = N'Customer';

-- Ensure phuadmin@phurai.vn stays Admin — never demote it
UPDATE dbo.UserAccounts
SET role_id = 4, is_active = 1, email_verified = 1
WHERE email = N'phuadmin@phurai.vn';

-- Upsert the customer test account
MERGE dbo.UserAccounts AS target
USING (SELECT N'quagphu159@gmail.com' AS email) AS source
ON target.email = source.email
WHEN MATCHED THEN
    UPDATE SET
        role_id        = @CustomerRoleId,
        full_name      = N'Dang Quang Phu',
        is_active      = 1,
        email_verified = 1,
        created_at     = DATEADD(month, -6, SYSDATETIME())
WHEN NOT MATCHED THEN
    INSERT (role_id, full_name, email, password_hash, is_active, email_verified, created_at, updated_at)
    VALUES (@CustomerRoleId, N'Dang Quang Phu', source.email,
            N'$2b$10$.s0tXgRsluKKb9rvQOvLB.8Xk6NNncuUhw3EIbrqp70Ap6knasgP6',
            1, 1, DATEADD(month, -6, SYSDATETIME()), DATEADD(month, -6, SYSDATETIME()));

-- Target ONLY the customer account for all subsequent seed data
DECLARE @PhuUsers TABLE (user_id INT);
INSERT INTO @PhuUsers (user_id)
SELECT user_id FROM dbo.UserAccounts WHERE email = N'quagphu159@gmail.com';


-- CLEAN UP previous seed data to avoid duplicates or index errors
DELETE FROM dbo.OrderItems WHERE order_id IN (SELECT order_id FROM dbo.Orders WHERE customer_id IN (SELECT user_id FROM @PhuUsers));
DELETE FROM dbo.Payments WHERE order_id IN (SELECT order_id FROM dbo.Orders WHERE customer_id IN (SELECT user_id FROM @PhuUsers));
DELETE FROM dbo.Orders WHERE customer_id IN (SELECT user_id FROM @PhuUsers);
DELETE FROM dbo.Reservations WHERE customer_id IN (SELECT user_id FROM @PhuUsers);
DELETE FROM dbo.CustomerVouchers WHERE customer_id IN (SELECT user_id FROM @PhuUsers);
DELETE FROM dbo.LoyaltyTransactions WHERE customer_id IN (SELECT user_id FROM @PhuUsers);

-- 1. Ensure a CustomerProfile exists for the customer account
MERGE dbo.CustomerProfiles AS target
USING @PhuUsers AS source
ON target.user_id = source.user_id
WHEN MATCHED THEN
    UPDATE SET created_at = DATEADD(month, -6, SYSDATETIME())
WHEN NOT MATCHED THEN
    INSERT (user_id, username, date_of_birth, gender, country, [language], bio, loyalty_points, preferences, created_at, updated_at)
    VALUES (source.user_id, N'quagphu159', '2004-12-29', N'Male', N'Vietnam', N'Vietnamese', N'CEO & Regular VIP customer.', 1010, N'["VIP area","Window seat","Steak"]', DATEADD(month, -6, SYSDATETIME()), DATEADD(month, -6, SYSDATETIME()));

-- Update loyalty points to 1010 so he has Gold status and can redeem vouchers
-- Also set username to quagphu159 for his Google account
UPDATE target
SET target.loyalty_points = 1010,
    target.username = CASE WHEN ua.email = 'quagphu159@gmail.com' THEN 'quagphu159' ELSE target.username END
FROM dbo.CustomerProfiles target
INNER JOIN @PhuUsers source ON target.user_id = source.user_id
INNER JOIN dbo.UserAccounts ua ON target.user_id = ua.user_id;

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

DECLARE @TableId INT;
SELECT TOP 1 @TableId = table_id FROM dbo.RestaurantTables;

DECLARE @AreaId INT;
SELECT TOP 1 @AreaId = area_id FROM dbo.RestaurantAreas;

-- ==========================================
-- MONTH 5 AGO (5 months ago)
-- ==========================================
INSERT INTO dbo.Reservations (customer_id, contact_name, contact_phone, contact_email, preferred_area_id, reservation_start_at, reservation_end_at, guest_count, special_request, deposit_amount, final_total, reservation_status, created_at)
SELECT source.user_id, N'Dang Quang Phu', '0964813966', N'phuadmin@phurai.vn', @AreaId, DATEADD(month, -5, GETDATE()), DATEADD(month, -5, DATEADD(hour, 2, GETDATE())), 4, N'Window seat please', 100000.00, 1489000.00, N'Completed', DATEADD(month, -5, DATEADD(day, -5, GETDATE()))
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
SELECT source.user_id, N'Dang Quang Phu', '0901000001', N'phuadmin@phurai.vn', @AreaId, DATEADD(month, -4, GETDATE()), DATEADD(month, -4, DATEADD(hour, 2, GETDATE())), 2, N'', 100000.00, 1250000.00, N'Completed', DATEADD(month, -4, DATEADD(day, -5, GETDATE()))
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
SELECT source.user_id, N'Dang Quang Phu', '0901000001', N'phuadmin@phurai.vn', @AreaId, DATEADD(month, -3, GETDATE()), DATEADD(month, -3, DATEADD(hour, 2, GETDATE())), 5, N'', 200000.00, 2568000.00, N'Completed', DATEADD(month, -3, DATEADD(day, -5, GETDATE()))
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
SELECT source.user_id, N'Dang Quang Phu', '0901000001', N'phuadmin@phurai.vn', @AreaId, DATEADD(month, -2, GETDATE()), DATEADD(month, -2, DATEADD(hour, 2, GETDATE())), 3, N'', 150000.00, 1857000.00, N'Completed', DATEADD(month, -2, DATEADD(day, -5, GETDATE()))
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
SELECT source.user_id, N'Dang Quang Phu', '0901000001', N'phuadmin@phurai.vn', @AreaId, DATEADD(month, -1, GETDATE()), DATEADD(month, -1, DATEADD(hour, 2, GETDATE())), 4, N'', 200000.00, 2279000.00, N'Completed', DATEADD(month, -1, DATEADD(day, -5, GETDATE()))
FROM @PhuUsers source;

INSERT INTO dbo.Orders (reservation_id, table_id, customer_id, order_type, order_status, subtotal, discount_amount, service_charge, total_amount, amount_paid, created_at)
SELECT 
    (SELECT TOP 1 reservation_id FROM dbo.Reservations WHERE customer_id = source.user_id AND DATEPART(month, reservation_start_at) = DATEPART(month, DATEADD(month, -1, GETDATE()))),
    @TableId,
    source.user_id,
    N'Dine In',
    N'Paid',
    5279000.00,
    200000.00,
    100000.00,
    5179000.00,
    5179000.00,
    DATEADD(day, -45, GETDATE())
FROM @PhuUsers source;

INSERT INTO dbo.Payments (order_id, payment_method_id, amount_paid, change_given, payment_status, paid_at, created_at)
SELECT 
    (SELECT TOP 1 order_id FROM dbo.Orders WHERE customer_id = source.user_id AND DATEPART(month, created_at) = DATEPART(month, DATEADD(day, -45, GETDATE())) ORDER BY created_at DESC),
    1, 
    5179000.00,
    0,
    N'Completed',
    DATEADD(day, -45, GETDATE()),
    DATEADD(day, -45, GETDATE())
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
SELECT source.user_id, N'Dang Quang Phu', '0901000001', N'phuadmin@phurai.vn', @AreaId, DATEADD(day, -15, GETDATE()), DATEADD(day, -15, DATEADD(hour, 2, GETDATE())), 4, N'Window seat', 100000.00, 1250000.00, N'Completed', DATEADD(day, -20, GETDATE())
FROM @PhuUsers source;

INSERT INTO dbo.Orders (reservation_id, table_id, customer_id, order_type, order_status, subtotal, discount_amount, service_charge, total_amount, amount_paid, created_at)
SELECT 
    (SELECT TOP 1 reservation_id FROM dbo.Reservations WHERE customer_id = source.user_id AND DATEPART(month, reservation_start_at) = DATEPART(month, DATEADD(day, -15, GETDATE())) AND deposit_amount = 100000.00),
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
    (SELECT TOP 1 order_id FROM dbo.Orders WHERE customer_id = source.user_id AND DATEPART(month, created_at) = DATEPART(month, DATEADD(day, -15, GETDATE())) AND subtotal = 1250000.00),
    1, 
    1200000.00,
    0,
    N'Completed',
    DATEADD(day, -15, GETDATE()),
    DATEADD(day, -15, GETDATE())
FROM @PhuUsers source;

INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, notes, item_status)
SELECT o.order_id, 13, 1, 890000.00, N'', N'Served'
FROM dbo.Orders o JOIN @PhuUsers pu ON o.customer_id = pu.user_id WHERE DATEPART(month, o.created_at) = DATEPART(month, DATEADD(day, -15, GETDATE())) AND o.subtotal = 1250000.00;

INSERT INTO dbo.OrderItems (order_id, dish_id, quantity, unit_price, notes, item_status)
SELECT o.order_id, 14, 1, 360000.00, N'', N'Served'
FROM dbo.Orders o JOIN @PhuUsers pu ON o.customer_id = pu.user_id WHERE DATEPART(month, o.created_at) = DATEPART(month, DATEADD(day, -15, GETDATE())) AND o.subtotal = 1250000.00;


-- Second order this month
INSERT INTO dbo.Reservations (customer_id, contact_name, contact_phone, contact_email, preferred_area_id, reservation_start_at, reservation_end_at, guest_count, special_request, deposit_amount, final_total, reservation_status, created_at)
SELECT source.user_id, N'Dang Quang Phu', '0901000001', N'phuadmin@phurai.vn', @AreaId, DATEADD(day, -5, GETDATE()), DATEADD(day, -5, DATEADD(hour, 2, GETDATE())), 2, N'Anniversary', 200000.00, 2568000.00, N'Completed', DATEADD(day, -10, GETDATE())
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
SELECT source.user_id, N'Dang Quang Phu', '0901000001', N'phuadmin@phurai.vn', @AreaId, DATEADD(day, 2, GETDATE()), DATEADD(day, 2, DATEADD(hour, 2, GETDATE())), 6, N'Private room', 500000.00, NULL, N'Await Check-in', DATEADD(day, -1, GETDATE())
FROM @PhuUsers source;

COMMIT TRANSACTION;
GO



-- ==========================================
-- 100 REALISTIC MOCK REVIEWS SEED
-- ==========================================
DELETE FROM dbo.CustomerReviews;
GO
INSERT INTO dbo.CustomerReviews (customer_id, order_id, food_rating, service_rating, ambiance_rating, comment, is_visible, created_at) VALUES
(9, NULL, 3, 2, 3, NULL, 1, '2026-07-12 23:02:55'),
(9, NULL, 4, 5, 5, N'Black Cod Miso was divine. Staff were warm throughout.', 1, '2026-03-26 23:02:55'),
(12, NULL, 5, 5, 5, NULL, 1, '2026-05-28 23:02:55'),
(13, NULL, 3, 2, 2, N'Food was bland and overpriced. Will not return.', 1, '2026-05-31 23:02:55'),
(11, NULL, 4, 3, 2, NULL, 1, '2026-05-01 23:02:55'),
(11, NULL, 4, 5, 4, NULL, 1, '2026-01-30 23:02:55'),
(13, NULL, 1, 2, 2, N'The meat was cold and tough. Very disappointed.', 1, '2026-05-24 23:02:55'),
(15, NULL, 5, 4, 5, N'Salmon Mentaiko beautifully presented. Will return for omakase.', 1, '2026-05-11 23:02:55'),
(8, NULL, 1, 3, 2, N'The meat was cold and tough. Very disappointed.', 1, '2026-04-14 23:02:55'),
(13, NULL, 4, 5, 3, N'A truly memorable meal. The wagyu beef literally melted in my mouth.', 1, '2026-01-21 23:02:55'),
(7, NULL, 5, 5, 4, N'Fabulous food! The presentation was as good as the taste.', 1, '2026-03-12 23:02:55'),
(11, NULL, 5, 5, 4, N'Black Cod Miso was divine. Staff were warm throughout.', 1, '2026-05-29 23:02:55'),
(11, NULL, 4, 4, 3, N'Highly recommend the chef''s special. Will definitely come back.', 1, '2026-02-13 23:02:55'),
(13, NULL, 4, 4, 5, N'Superb experience. Highly professional staff and great flavors.', 1, '2026-06-02 23:02:55'),
(8, NULL, 3, 3, 2, N'Good drinks, but the main courses took too long to arrive.', 1, '2026-01-20 23:02:55'),
(9, NULL, 3, 3, 2, N'Decent steak, but nothing special. Ambiance was nice though.', 1, '2026-04-25 23:02:55'),
(10, NULL, 4, 4, 5, N'Highly recommend the chef''s special. Will definitely come back.', 1, '2026-06-13 23:02:55'),
(15, NULL, 2, 1, 1, N'Bad experience. The staff was rude when we complained about the food.', 1, '2026-07-06 23:02:55'),
(11, NULL, 4, 4, 4, N'Best tasting menu in the city. Every dish was a work of art.', 1, '2026-03-11 23:02:55'),
(12, NULL, 2, 1, 1, NULL, 1, '2026-07-06 23:02:55'),
(13, NULL, 2, 3, 3, N'Decent experience. Food was okay, service could be improved.', 1, '2026-06-25 23:02:55'),
(15, NULL, 3, 4, 5, N'Attentive staff and great food. The desserts were amazing.', 1, '2026-06-15 23:02:55'),
(10, NULL, 4, 5, 3, N'Salmon Mentaiko beautifully presented. Will return for omakase.', 1, '2026-01-17 23:02:55'),
(12, NULL, 3, 4, 3, NULL, 1, '2026-04-01 23:02:55'),
(7, NULL, 3, 4, 2, NULL, 1, '2026-07-05 23:02:55'),
(11, NULL, 4, 2, 4, NULL, 1, '2026-01-22 23:02:55'),
(11, NULL, 4, 4, 5, N'Excellent service and food quality. A must-visit place.', 1, '2026-05-31 23:02:55'),
(12, NULL, 5, 4, 4, N'Absolutely stunning. Japanese A5 Wagyu was perfect.', 1, '2026-06-15 23:02:55'),
(9, NULL, 4, 2, 4, NULL, 1, '2026-06-04 23:02:55'),
(7, NULL, 2, 2, 2, N'Too expensive for subpar quality. Service was also inattentive.', 1, '2026-02-15 23:02:55'),
(11, NULL, 3, 3, 3, NULL, 1, '2026-06-18 23:02:55'),
(11, NULL, 2, 2, 3, N'Food was bland and overpriced. Will not return.', 1, '2026-04-09 23:02:55'),
(8, NULL, 5, 3, 3, NULL, 1, '2026-03-03 23:02:55'),
(9, NULL, 2, 2, 3, NULL, 1, '2026-03-22 23:02:55'),
(11, NULL, 4, 4, 3, N'Superb experience. Highly professional staff and great flavors.', 1, '2026-01-29 23:02:55'),
(9, NULL, 3, 4, 3, NULL, 1, '2026-05-19 23:02:55'),
(13, NULL, 1, 1, 3, N'Extremely noisy and the table was dirty. Food was cold.', 1, '2026-07-02 23:02:55'),
(13, NULL, 3, 2, 3, N'The food was decent but service was quite slow.', 1, '2026-04-20 23:02:55'),
(8, NULL, 2, 2, 1, N'Worst service ever. We waited 45 minutes for our table.', 1, '2026-04-09 23:02:55'),
(7, NULL, 2, 2, 2, N'Worst service ever. We waited 45 minutes for our table.', 1, '2026-04-25 23:02:55'),
(12, NULL, 2, 3, 2, N'Poor customer service. No one checked on our table.', 1, '2026-05-31 23:02:55'),
(11, NULL, 4, 2, 3, N'Decent experience. Food was okay, service could be improved.', 1, '2026-02-19 23:02:55'),
(9, NULL, 4, 4, 4, NULL, 1, '2026-03-27 23:02:55'),
(7, NULL, 4, 5, 5, N'Highly recommend the chef''s special. Will definitely come back.', 1, '2026-02-21 23:02:55'),
(13, NULL, 1, 2, 1, N'Food was bland and overpriced. Will not return.', 1, '2026-06-02 23:02:55'),
(8, NULL, 3, 3, 4, NULL, 1, '2026-05-16 23:02:55'),
(9, NULL, 3, 2, 3, NULL, 1, '2026-04-04 23:02:55'),
(15, NULL, 2, 3, 2, N'Very slow service, and the food was not cooked properly.', 1, '2026-07-12 23:02:55'),
(7, NULL, 4, 3, 4, N'Outstanding dishes, every bite was flavorful.', 1, '2026-04-12 23:02:55'),
(13, NULL, 4, 5, 5, NULL, 1, '2026-03-10 23:02:55'),
(8, NULL, 4, 5, 5, N'Attentive staff and great food. The desserts were amazing.', 1, '2026-05-22 23:02:55'),
(8, NULL, 5, 5, 4, NULL, 1, '2026-07-13 23:02:55'),
(13, NULL, 1, 2, 1, N'Poor customer service. No one checked on our table.', 1, '2026-07-12 23:02:55'),
(15, NULL, 1, 3, 2, NULL, 1, '2026-02-15 23:02:55'),
(11, NULL, 5, 5, 3, NULL, 1, '2026-06-01 23:02:55'),
(12, NULL, 4, 5, 4, N'Outstanding dishes, every bite was flavorful.', 1, '2026-03-29 23:02:55'),
(9, NULL, 1, 2, 1, N'Too expensive for subpar quality. Service was also inattentive.', 1, '2026-04-22 23:02:55'),
(15, NULL, 4, 4, 5, N'Fabulous food! The presentation was as good as the taste.', 1, '2026-03-01 23:02:55'),
(7, NULL, 5, 4, 3, NULL, 1, '2026-04-29 23:02:55'),
(11, NULL, 2, 3, 3, NULL, 1, '2026-05-03 23:02:55'),
(8, NULL, 5, 5, 5, NULL, 1, '2026-06-01 23:02:55'),
(11, NULL, 4, 3, 5, N'Outstanding dishes, every bite was flavorful.', 1, '2026-06-17 23:02:55'),
(10, NULL, 3, 3, 4, N'Decent experience. Food was okay, service could be improved.', 1, '2026-05-23 23:02:55'),
(12, NULL, 5, 5, 5, N'Best tasting menu in the city. Every dish was a work of art.', 1, '2026-04-12 23:02:55'),
(12, NULL, 4, 3, 3, NULL, 1, '2026-06-12 23:02:55'),
(15, NULL, 2, 2, 2, N'Bad experience. The staff was rude when we complained about the food.', 1, '2026-07-12 23:02:55'),
(13, NULL, 2, 1, 1, N'Extremely noisy and the table was dirty. Food was cold.', 1, '2026-05-26 23:02:55'),
(9, NULL, 2, 2, 2, NULL, 1, '2026-02-13 23:02:55'),
(10, NULL, 4, 4, 5, N'Superb experience. Highly professional staff and great flavors.', 1, '2026-06-03 23:02:55'),
(8, NULL, 3, 3, 5, NULL, 1, '2026-05-09 23:02:55'),
(13, NULL, 4, 2, 2, NULL, 1, '2026-07-02 23:02:55'),
(7, NULL, 3, 3, 2, N'The food was decent but service was quite slow.', 1, '2026-04-06 23:02:55'),
(9, NULL, 3, 3, 2, N'Average experience. The atmosphere was good but food was a bit salty.', 1, '2026-05-22 23:02:55'),
(15, NULL, 2, 3, 3, N'A bit overpriced for the portion size, but taste was okay.', 1, '2026-06-21 23:02:55'),
(13, NULL, 5, 3, 5, N'Wonderful service and Wagyu was incredibly delicious!', 1, '2026-05-17 23:02:55'),
(12, NULL, 4, 3, 5, NULL, 1, '2026-06-03 23:02:55'),
(7, NULL, 4, 4, 3, N'Highly recommend the chef''s special. Will definitely come back.', 1, '2026-01-25 23:02:55'),
(10, NULL, 5, 4, 5, N'Attentive staff and great food. The desserts were amazing.', 1, '2026-05-16 23:02:55'),
(12, NULL, 2, 2, 4, NULL, 1, '2026-03-24 23:02:55'),
(15, NULL, 5, 5, 5, N'Exquisite dining experience! The ambiance was lovely.', 1, '2026-03-28 23:02:55'),
(8, NULL, 3, 3, 2, NULL, 1, '2026-01-22 23:02:55'),
(12, NULL, 5, 5, 5, N'Exquisite dining experience! The ambiance was lovely.', 1, '2026-07-11 23:02:55'),
(12, NULL, 4, 2, 3, N'Good drinks, but the main courses took too long to arrive.', 1, '2026-04-23 23:02:55'),
(13, NULL, 4, 5, 4, N'Salmon Mentaiko beautifully presented. Will return for omakase.', 1, '2026-02-12 23:02:55'),
(12, NULL, 2, 2, 3, N'Extremely noisy and the table was dirty. Food was cold.', 1, '2026-05-27 23:02:55'),
(15, NULL, 4, 5, 4, N'Fabulous food! The presentation was as good as the taste.', 1, '2026-03-07 23:02:55'),
(10, NULL, 4, 5, 4, NULL, 1, '2026-06-19 23:02:55'),
(7, NULL, 3, 4, 3, NULL, 1, '2026-04-17 23:02:55'),
(11, NULL, 4, 2, 2, N'The food was decent but service was quite slow.', 1, '2026-06-09 23:02:55'),
(13, NULL, 3, 5, 3, N'Black Cod Miso was divine. Staff were warm throughout.', 1, '2026-05-22 23:02:55'),
(13, NULL, 4, 4, 3, NULL, 1, '2026-01-15 23:02:55'),
(15, NULL, 1, 2, 2, NULL, 1, '2026-02-03 23:02:55'),
(7, NULL, 5, 5, 5, N'Salmon Mentaiko beautifully presented. Will return for omakase.', 1, '2026-04-01 23:02:55'),
(13, NULL, 5, 4, 4, NULL, 1, '2026-02-28 23:02:55'),
(9, NULL, 5, 5, 4, NULL, 1, '2026-05-26 23:02:55'),
(7, NULL, 4, 2, 4, N'Good drinks, but the main courses took too long to arrive.', 1, '2026-04-28 23:02:55'),
(9, NULL, 3, 3, 2, N'Nothing outstanding, just your average restaurant.', 1, '2026-06-11 23:02:55'),
(10, NULL, 2, 4, 4, N'Decent steak, but nothing special. Ambiance was nice though.', 1, '2026-06-16 23:02:55'),
(10, NULL, 2, 4, 2, NULL, 1, '2026-04-23 23:02:55'),
(13, NULL, 2, 1, 2, N'Food was bland and overpriced. Will not return.', 1, '2026-05-09 23:02:55');
GO

-- Seed active sessions for Occupied tables (VIP-2 [6], S-03 [10], S-07 [14], PR-01 [24])
INSERT INTO dbo.TableOccupancySessions
  (table_id, reservation_id, order_id, guest_count, check_in_at, estimated_duration_min, buffer_min, estimated_release_at, released_at)
VALUES
  (6,  100007, NULL, 4, DATEADD(minute, -45, SYSDATETIME()), 90, 15, DATEADD(minute, 60, SYSDATETIME()), NULL),
  (10, 100005, NULL, 2, DATEADD(minute, -30, SYSDATETIME()), 60, 15, DATEADD(minute, 45, SYSDATETIME()), NULL),
  (14, NULL,   NULL, 3, DATEADD(minute, -75, SYSDATETIME()), 90, 15, DATEADD(minute, 30, SYSDATETIME()), NULL),
  (24, 100004, NULL, 2, DATEADD(minute, -10, SYSDATETIME()), 60, 15, DATEADD(minute, 65, SYSDATETIME()), NULL);
GO
