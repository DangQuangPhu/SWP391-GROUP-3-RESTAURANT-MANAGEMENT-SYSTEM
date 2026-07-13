import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const file = path.resolve(__dirname, '../../database/System_Restaurant.sql');

let content = fs.readFileSync(file, 'utf-8');

// Split the file into Schema and Mock Data sections
const marker = '-- MOCK DATA (DML) - INSERT STATEMENTS IN ENGLISH';
const parts = content.split(marker);

if (parts.length > 1) {
    let mockData = parts[1];

    // Tables to completely remove INSERTs for in the MOCK DATA section:
    const tablesToRemove = [
      'CustomerProfiles',
      'LoyaltyTransactions',
      'Reservations',
      'ReservationTables',
      'PreorderItems',
      'QROrderSessions',
      'Orders',
      'OrderItems',
      'KitchenTickets',
      'Payments',
      'VoucherRedemptions',
      'Notifications',
      'CustomerReviews',
      'ReportSnapshots',
      'AuditLogs',
      'RecommendationLogs'
    ];

    for (const table of tablesToRemove) {
      // Safely delete SET IDENTITY_INSERT ON if it exists just before the INSERT
      const regex = new RegExp(`(?:SET IDENTITY_INSERT dbo\\.${table} ON;\\s*)?INSERT INTO dbo\\.${table}[\\s\\S]*?GO`, 'g');
      mockData = mockData.replace(regex, '');
    }

    content = parts[0] + marker + mockData;
}

// Custom block replacement for UserAccounts: we want to keep Staff (1-6, 14) and remove Customers (7-13).
const userAccountRegex = /INSERT INTO dbo\.UserAccounts[\s\S]*?GO/g;

content = content.replace(userAccountRegex, `INSERT INTO dbo.UserAccounts
(user_id, role_id, full_name, email, phone, password_hash, is_active, email_verified, last_login_at)
VALUES
(1, 5, N'Dang Quang Phu',  N'phuadmin@phurai.vn',    '0901000001', N'scrypt$4f2ab2ac57cea58a40e76477d53f3e61$d38e5d2db24cd605a3d29eaf79e1b0429e7c7f5fce28c47faf59126fdd15029828447e1b56d0886c74f888ff7ac6693d7b33e0371ac39c9ff0b55385a0ca547e',   1, 1, '2026-05-18T08:00:00'),
(2, 4, N'Dang Quang Phu',  N'phumanager@phurai.vn',  '0901000002', N'scrypt$8b83430313edc67abc8eadeefc31e841$ce82bbdd63b2f38cc66e8cb939a52599c91f53a8396a40ec2ee1d3d28dd106eedb890ddbe0a4b462080f268b0f848fc5d3f1974aa3930dab29612cb25cb887f0', 1, 1, '2026-05-18T08:10:00'),
(3, 2, N'Dang Quang Phu',       N'phustaff1@phurai.vn',   '0901000003', N'$2b$10$.s0tXgRsluKKb9rvQOvLB.8Xk6NNncuUhw3EIbrqp70Ap6knasgP6',  1, 1, '2026-05-18T08:30:00'),
(4, 2, N'Pham Thi Thuy',    N'thuystaff@phurai.vn',   '0901000004', N'$2b$10$.s0tXgRsluKKb9rvQOvLB.8Xk6NNncuUhw3EIbrqp70Ap6knasgP6',  1, 1, NULL),
(5, 3, N'Hoang Van Tho',    N'kitchen1@phurai.vn', '0901000005', N'$2b$10$.s0tXgRsluKKb9rvQOvLB.8Xk6NNncuUhw3EIbrqp70Ap6knasgP6',   0, 1, '2026-05-18T09:00:00'),
(6, 3, N'Do Thi Hao',       N'kitchen2@phurai.vn', '0901000006', N'$2b$10$.s0tXgRsluKKb9rvQOvLB.8Xk6NNncuUhw3EIbrqp70Ap6knasgP6',   0, 1, NULL),
(14, 2, N'Le Huy Manh Tan',    N'tanstaff@phurai.vn',   '0901000004', N'$2b$10$.s0tXgRsluKKb9rvQOvLB.8Xk6NNncuUhw3EIbrqp70Ap6knasgP6',  1, 1, NULL);
SET IDENTITY_INSERT dbo.UserAccounts OFF;
GO`);

// Clean StaffProfiles (Remove staff 7-13 if they exist)
const staffProfileRegex = /INSERT INTO dbo\.StaffProfiles[\s\S]*?GO/g;
content = content.replace(staffProfileRegex, `INSERT INTO dbo.StaffProfiles 
(staff_id, user_id, staff_code, job_title, job_title_id, hire_date, employment_status, base_salary, has_system_account)
VALUES
(1, 2, N'MGR001', N'Restaurant Manager', 1, '2025-01-15', N'Active', 25000000, 1),
(2, 3, N'STF001', N'Senior Server',      3, '2025-06-01', N'Active',  9000000, 1),
(3, 4, N'STF002', N'Server',             4, '2025-08-15', N'Active',  7500000, 1),
(4, 5, N'KIT001', N'Head Chef',          2, '2025-01-10', N'Active', 35000000, 1),
(5, 6, N'KIT002', N'Line Cook',          5, '2025-03-20', N'Active', 12000000, 1),
(6, 14, N'STF003', N'Server',            4, '2025-09-01', N'Active',  7500000, 1);
SET IDENTITY_INSERT dbo.StaffProfiles OFF;
GO`);

// Clean whitespace
content = content.replace(/\\n{3,}/g, '\\n\\n');

fs.writeFileSync(file, content);
console.log('✅ Cleaned SQL successfully');
