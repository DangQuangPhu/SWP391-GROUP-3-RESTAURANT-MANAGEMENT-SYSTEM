-- Safe additive migrations for Phūrai auth (SQL Server)
-- Run against restaurant_management database. Does not drop data.

USE restaurant_management;
GO

IF COL_LENGTH('dbo.Users', 'first_name') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD first_name NVARCHAR(100) NULL;
END
GO

IF COL_LENGTH('dbo.Users', 'last_name') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD last_name NVARCHAR(100) NULL;
END
GO

IF COL_LENGTH('dbo.Users', 'date_of_birth') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD date_of_birth DATE NULL;
END
GO

IF COL_LENGTH('dbo.Users', 'google_sub') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD google_sub NVARCHAR(255) NULL;
END
GO

IF COL_LENGTH('dbo.Users', 'auth_provider') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD auth_provider NVARCHAR(30) NULL CONSTRAINT DF_Users_auth_provider DEFAULT N'LOCAL';
END
GO

IF COL_LENGTH('dbo.Users', 'verification_token') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD verification_token NVARCHAR(20) NULL;
END
GO

IF COL_LENGTH('dbo.Users', 'verification_sent_at') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD verification_sent_at DATETIME2 NULL;
END
GO

IF COL_LENGTH('dbo.Users', 'password_reset_token') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD password_reset_token NVARCHAR(20) NULL;
END
GO

IF COL_LENGTH('dbo.Users', 'password_reset_verified_token') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD password_reset_verified_token NVARCHAR(100) NULL;
END
GO

IF COL_LENGTH('dbo.Users', 'password_reset_expires_at') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD password_reset_expires_at DATETIME2 NULL;
END
GO

IF COL_LENGTH('dbo.Users', 'password_reset_sent_at') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD password_reset_sent_at DATETIME2 NULL;
END
GO

IF COL_LENGTH('dbo.Users', 'old_password_verified_token') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD old_password_verified_token NVARCHAR(100) NULL;
END
GO

IF COL_LENGTH('dbo.Users', 'old_password_verified_at') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD old_password_verified_at DATETIME2 NULL;
END
GO

-- Lowercase users table alias (if project uses users instead of Users)
IF OBJECT_ID(N'dbo.users', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
    -- no-op: only Users exists in standard schema
    PRINT 'Using dbo.Users';
END
GO
