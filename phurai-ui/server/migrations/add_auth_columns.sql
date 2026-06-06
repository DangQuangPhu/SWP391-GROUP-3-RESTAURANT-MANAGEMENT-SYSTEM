-- Migration: Add missing auth columns to dbo.Users
-- Run this script once against your database to add the required columns.

USE restaurant_management;
GO

-- Add first_name if missing
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'first_name')
    ALTER TABLE dbo.Users ADD first_name NVARCHAR(100) NULL;
GO

-- Add last_name if missing
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'last_name')
    ALTER TABLE dbo.Users ADD last_name NVARCHAR(100) NULL;
GO

-- Add date_of_birth if missing
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'date_of_birth')
    ALTER TABLE dbo.Users ADD date_of_birth DATE NULL;
GO

-- Add google_sub if missing
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'google_sub')
    ALTER TABLE dbo.Users ADD google_sub NVARCHAR(255) NULL;
GO

-- Add auth_provider if missing
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'auth_provider')
    ALTER TABLE dbo.Users ADD auth_provider NVARCHAR(50) NOT NULL CONSTRAINT DF_Users_auth_provider DEFAULT 'LOCAL';
GO

-- Add verification_token if missing
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'verification_token')
    ALTER TABLE dbo.Users ADD verification_token NVARCHAR(255) NULL;
GO

-- Add verification_sent_at if missing
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'verification_sent_at')
    ALTER TABLE dbo.Users ADD verification_sent_at DATETIME2 NULL;
GO

-- Add password_reset_token if missing
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'password_reset_token')
    ALTER TABLE dbo.Users ADD password_reset_token NVARCHAR(255) NULL;
GO

-- Add password_reset_expires_at if missing
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'password_reset_expires_at')
    ALTER TABLE dbo.Users ADD password_reset_expires_at DATETIME2 NULL;
GO

-- Add password_reset_sent_at if missing
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'password_reset_sent_at')
    ALTER TABLE dbo.Users ADD password_reset_sent_at DATETIME2 NULL;
GO

-- Add password_reset_verified_token if missing
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'password_reset_verified_token')
    ALTER TABLE dbo.Users ADD password_reset_verified_token NVARCHAR(255) NULL;
GO

-- Add old_password_verified_token if missing
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'old_password_verified_token')
    ALTER TABLE dbo.Users ADD old_password_verified_token NVARCHAR(255) NULL;
GO

-- Add old_password_verified_at if missing
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'old_password_verified_at')
    ALTER TABLE dbo.Users ADD old_password_verified_at DATETIME2 NULL;
GO

-- Add FailedLoginCount if missing
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'FailedLoginCount')
    ALTER TABLE dbo.Users ADD FailedLoginCount INT NOT NULL CONSTRAINT DF_Users_FailedLoginCount DEFAULT 0;
GO

-- Add LockoutUntil if missing
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'LockoutUntil')
    ALTER TABLE dbo.Users ADD LockoutUntil DATETIME2 NULL;
GO

PRINT 'Migration complete: all auth columns are present in dbo.Users.';
GO
