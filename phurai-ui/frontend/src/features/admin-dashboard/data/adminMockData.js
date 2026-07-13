// adminMockData.js
// Frontend-only mock data — KHÔNG chứa password hash (không bao giờ đưa hash
// xuống frontend dù là mock, để tránh thói quen xấu khi nối API thật sau này).
// TODO: đối chiếu lại đúng tên cột thật của bảng accounts/staff khi nối API,
// hiện đang đoán role_id=5 là "Admin" dựa theo dòng INSERT bạn gửi.

export const ROLE_OPTIONS = [
  { id: 1, label: 'Customer' },
  { id: 2, label: 'Staff' },
  { id: 3, label: 'Manager' },
  { id: 4, label: 'Admin' },
];

export function getRoleLabel(roleId) {
  return ROLE_OPTIONS.find((r) => r.id === roleId)?.label || 'Unknown';
}

export const MOCK_ACCOUNTS = [
  {
    id: 1,
    roleId: 4,
    fullName: 'Dang Quang Phu',
    email: 'phuadmin@phurai.vn',
    phone: '0901000001',
    isActive: true,
    createdAt: '2026-05-18T08:00:00',
  },
  {
    id: 2,
    roleId: 3,
    fullName: 'Tran Minh',
    email: 'tranminh@phurai.vn',
    phone: '0901000002',
    isActive: true,
    createdAt: '2026-05-20T09:30:00',
  },
  {
    id: 3,
    roleId: 2,
    fullName: 'Le Hoa',
    email: 'lehoa@phurai.vn',
    phone: '0901000003',
    isActive: true,
    createdAt: '2026-05-22T14:10:00',
  },
  {
    id: 4,
    roleId: 2,
    fullName: 'Nguyen Van A',
    email: 'nguyenvana@phurai.vn',
    phone: '0901000004',
    isActive: false,
    createdAt: '2026-06-01T10:00:00',
  },
];

export const MOCK_AUDIT_LOGS = [
  { time: '10:42', action: 'STAFF_CHECK_IN_RESERVATION', actor: 'Tran Minh' },
  { time: '10:15', action: 'STAFF_MERGE_TABLES', actor: 'Le Hoa' },
  { time: '09:50', action: 'ADMIN_UPDATE_ROLE_PERMISSION', actor: 'Dang Quang Phu' },
  { time: '09:20', action: 'STAFF_REJECT_REQUEST', actor: 'Tran Minh' },
  { time: '08:55', action: 'ADMIN_CREATE_ACCOUNT', actor: 'Dang Quang Phu' },
];

export const MOCK_KPI = {
  totalAccounts: 47,
  activeStaff: 41,
  pendingRoleRequests: 2,
  auditEntriesToday: 63,
  reservations30d: 1085,
  revenue30d: 282300000,
  reviewsNeedingReply: 5,
  staffPerformanceFlags: 1,
};
