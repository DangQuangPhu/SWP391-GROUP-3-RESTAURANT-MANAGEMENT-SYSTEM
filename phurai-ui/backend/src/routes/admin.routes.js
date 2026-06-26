import express from 'express';
import { getDashboardStats, getRecentAuditLogs, getAccounts } from '../controllers/adminController.js';
import { getRoles, updateRole } from '../controllers/adminRoleController.js';
import { getPaginatedAuditLogs } from '../controllers/adminAuditController.js';
import { getReservationsAnalytics, getRevenueAnalytics, getOrdersAnalytics, getReviewsAnalytics, getStaffPerformanceAnalytics } from '../controllers/adminAnalyticsController.js';
import { getSettings, updateSettings } from '../controllers/adminSettingsController.js';
import { authMiddleware, verifyAdmin } from '../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to all admin routes
router.use(authMiddleware);
router.use(verifyAdmin);

// Dashboard
router.get('/dashboard/stats', getDashboardStats);

// Accounts
router.get('/accounts', getAccounts);

// Roles
router.get('/roles', getRoles);
router.put('/roles/:id', updateRole);

// Audit Logs
router.get('/audit-logs/recent', getRecentAuditLogs);
router.get('/audit-logs', getPaginatedAuditLogs);

// Analytics
router.get('/analytics/reservations', getReservationsAnalytics);
router.get('/analytics/revenue', getRevenueAnalytics);
router.get('/analytics/orders', getOrdersAnalytics);
router.get('/analytics/reviews', getReviewsAnalytics);
router.get('/analytics/staff-performance', getStaffPerformanceAnalytics);

// Settings
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

export default router;
