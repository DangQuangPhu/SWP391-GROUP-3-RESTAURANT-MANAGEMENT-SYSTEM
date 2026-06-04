IF DB_ID(N'restaurant_management') IS NULL
BEGIN
    CREATE DATABASE restaurant_management;
END;
GO

USE restaurant_management;
GO

IF OBJECT_ID(N'dbo.UserRoles', N'U') IS NOT NULL DROP TABLE dbo.UserRoles;
IF OBJECT_ID(N'dbo.OtpTokens', N'U') IS NOT NULL DROP TABLE dbo.OtpTokens;
IF OBJECT_ID(N'dbo.Customers', N'U') IS NOT NULL DROP TABLE dbo.Customers;
IF OBJECT_ID(N'dbo.UserProfiles', N'U') IS NOT NULL DROP TABLE dbo.UserProfiles;
IF OBJECT_ID(N'dbo.Roles', N'U') IS NOT NULL DROP TABLE dbo.Roles;
IF OBJECT_ID(N'dbo.Users', N'U') IS NOT NULL DROP TABLE dbo.Users;
GO

CREATE TABLE dbo.Users (
    user_id INT IDENTITY(1,1) PRIMARY KEY,
    username NVARCHAR(100) NOT NULL UNIQUE,
    email NVARCHAR(255) NOT NULL UNIQUE,
    phone_number NVARCHAR(20) NULL,
    password_hash NVARCHAR(255) NULL,
    avatar_url NVARCHAR(500) NULL,
    google_avatar_url NVARCHAR(500) NULL,
    avatar_source NVARCHAR(50) NULL CONSTRAINT DF_Users_avatar_source DEFAULT N'system',
    status NVARCHAR(30) NOT NULL CONSTRAINT DF_Users_status DEFAULT N'INACTIVE',
    is_email_verified BIT NOT NULL CONSTRAINT DF_Users_email_verified DEFAULT 0,
    is_phone_verified BIT NOT NULL CONSTRAINT DF_Users_phone_verified DEFAULT 0,
    last_login_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_Users_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_Users_updated_at DEFAULT SYSUTCDATETIME(),
    is_deleted BIT NOT NULL CONSTRAINT DF_Users_is_deleted DEFAULT 0,
    deleted_at DATETIME2 NULL
);
GO

CREATE TABLE dbo.UserProfiles (
    profile_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    first_name NVARCHAR(100) NULL,
    last_name NVARCHAR(100) NULL,
    gender NVARCHAR(20) NULL,
    date_of_birth DATE NULL,
    address NVARCHAR(500) NULL,
    bio NVARCHAR(1000) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_UserProfiles_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_UserProfiles_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_UserProfiles_Users
        FOREIGN KEY (user_id) REFERENCES dbo.Users(user_id)
        ON DELETE CASCADE
);
GO

CREATE TABLE dbo.Roles (
    role_id INT IDENTITY(1,1) PRIMARY KEY,
    role_name NVARCHAR(50) NOT NULL UNIQUE,
    description NVARCHAR(255) NULL,
    is_active BIT NOT NULL CONSTRAINT DF_Roles_is_active DEFAULT 1,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_Roles_created_at DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE dbo.UserRoles (
    user_role_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    assigned_at DATETIME2 NOT NULL CONSTRAINT DF_UserRoles_assigned_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_UserRoles_user_role UNIQUE (user_id, role_id),
    CONSTRAINT FK_UserRoles_Users
        FOREIGN KEY (user_id) REFERENCES dbo.Users(user_id)
        ON DELETE CASCADE,
    CONSTRAINT FK_UserRoles_Roles
        FOREIGN KEY (role_id) REFERENCES dbo.Roles(role_id)
        ON DELETE CASCADE
);
GO

CREATE TABLE dbo.Customers (
    customer_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    customer_code NVARCHAR(50) NOT NULL UNIQUE,
    membership_level NVARCHAR(50) NOT NULL CONSTRAINT DF_Customers_membership DEFAULT N'BRONZE',
    total_spent DECIMAL(18,2) NOT NULL CONSTRAINT DF_Customers_total_spent DEFAULT 0,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_Customers_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Customers_Users
        FOREIGN KEY (user_id) REFERENCES dbo.Users(user_id)
        ON DELETE CASCADE
);
GO

CREATE TABLE dbo.OtpTokens (
    otp_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    otp_code CHAR(6) NOT NULL,
    purpose NVARCHAR(50) NOT NULL,
    expires_at DATETIME2 NOT NULL,
    used_at DATETIME2 NULL,
    attempt_count INT NOT NULL CONSTRAINT DF_OtpTokens_attempt_count DEFAULT 0,
    max_attempts INT NOT NULL CONSTRAINT DF_OtpTokens_max_attempts DEFAULT 5,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_OtpTokens_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_OtpTokens_Users
        FOREIGN KEY (user_id) REFERENCES dbo.Users(user_id)
        ON DELETE CASCADE
);
GO

INSERT INTO dbo.Roles (role_name, description, is_active)
SELECT N'ADMIN', N'Full system access', 1
WHERE NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE role_name = N'ADMIN');

INSERT INTO dbo.Roles (role_name, description, is_active)
SELECT N'MANAGER', N'Manage restaurant operations', 1
WHERE NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE role_name = N'MANAGER');

INSERT INTO dbo.Roles (role_name, description, is_active)
SELECT N'STAFF', N'Serve customers and handle orders', 1
WHERE NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE role_name = N'STAFF');

INSERT INTO dbo.Roles (role_name, description, is_active)
SELECT N'CUSTOMER', N'Restaurant customer account', 1
WHERE NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE role_name = N'CUSTOMER');
GO
