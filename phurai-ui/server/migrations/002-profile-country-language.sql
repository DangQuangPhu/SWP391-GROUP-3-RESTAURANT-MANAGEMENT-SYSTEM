-- Add country and language to UserProfiles (SQL Server)
-- Applied against the connection's current database (no USE statement).

IF COL_LENGTH('dbo.UserProfiles', 'country') IS NULL
BEGIN
    ALTER TABLE dbo.UserProfiles ADD country NVARCHAR(100) NULL;
END
GO

IF COL_LENGTH('dbo.UserProfiles', 'language') IS NULL
BEGIN
    ALTER TABLE dbo.UserProfiles ADD language NVARCHAR(50) NULL;
END
GO
