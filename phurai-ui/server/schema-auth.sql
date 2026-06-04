CREATE DATABASE IF NOT EXISTS restaurant_management
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE restaurant_management;

CREATE TABLE IF NOT EXISTS Users (
  user_id INT PRIMARY KEY AUTO_INCREMENT,
  username NVARCHAR(100) NOT NULL UNIQUE,
  email NVARCHAR(255) NOT NULL UNIQUE,
  phone_number NVARCHAR(20),
  password_hash NVARCHAR(255) NOT NULL,
  avatar_url NVARCHAR(500),
  status NVARCHAR(30) NOT NULL DEFAULT 'INACTIVE',
  is_email_verified BIT NOT NULL DEFAULT 0,
  is_phone_verified BIT NOT NULL DEFAULT 0,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_deleted BIT NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL
);

CREATE TABLE IF NOT EXISTS UserProfiles (
  profile_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL UNIQUE,
  first_name NVARCHAR(100),
  last_name NVARCHAR(100),
  gender NVARCHAR(20),
  date_of_birth DATE,
  address NVARCHAR(500),
  bio NVARCHAR(1000),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_profiles_user
    FOREIGN KEY (user_id) REFERENCES Users(user_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Roles (
  role_id INT PRIMARY KEY AUTO_INCREMENT,
  role_name NVARCHAR(50) NOT NULL UNIQUE,
  description NVARCHAR(255),
  is_active BIT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS UserRoles (
  user_role_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  role_id INT NOT NULL,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_roles_user_role (user_id, role_id),
  CONSTRAINT fk_user_roles_user
    FOREIGN KEY (user_id) REFERENCES Users(user_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_role
    FOREIGN KEY (role_id) REFERENCES Roles(role_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Customers (
  customer_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL UNIQUE,
  customer_code NVARCHAR(50) NOT NULL UNIQUE,
  membership_level NVARCHAR(50) NOT NULL DEFAULT 'BRONZE',
  total_spent DECIMAL(18,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_customers_user
    FOREIGN KEY (user_id) REFERENCES Users(user_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS OtpTokens (
  otp_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  otp_code CHAR(6) NOT NULL,
  purpose NVARCHAR(50) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  attempt_count INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_otp_tokens_user
    FOREIGN KEY (user_id) REFERENCES Users(user_id)
    ON DELETE CASCADE
);

INSERT INTO Roles (role_name, description, is_active)
VALUES
  ('ADMIN', 'Full system access', 1),
  ('MANAGER', 'Manage restaurant operations', 1),
  ('STAFF', 'Serve customers and handle orders', 1),
  ('CUSTOMER', 'Restaurant customer account', 1)
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  is_active = VALUES(is_active);
