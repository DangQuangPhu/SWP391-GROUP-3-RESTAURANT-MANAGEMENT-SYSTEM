import express from 'express';
import { getDashboardStats, getRecentAuditLogs, getAccounts, toggleAccountStatus, updateStaffJobTitle, getCustomerDetails, deleteCustomer } from '../controllers/adminController.js';
import { getRoles, updateRole, createRole, assignUserRole, searchEmployees } from '../controllers/adminRoleController.js';
import { getPaginatedAuditLogs } from '../controllers/adminAuditController.js';
import { getReservationsAnalytics, getRevenueAnalytics, getOrdersAnalytics, getReviewsAnalytics, getStaffPerformanceAnalytics, getAdminOverview } from '../controllers/adminAnalyticsController.js';
import { getSettings, updateSettings } from '../controllers/adminSettingsController.js';
import { listJobTitles } from '../controllers/employeeController.js';
import { authMiddleware, verifyAdmin } from '../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to all admin routes
router.use(authMiddleware);
router.use(verifyAdmin);

// Dashboard
router.get('/dashboard/stats', getDashboardStats);

// Accounts
router.get('/accounts', getAccounts);
router.put('/accounts/:id/status', toggleAccountStatus);
router.get('/customers/:id', getCustomerDetails);
router.delete('/customers/:id', deleteCustomer);
router.get('/job-titles', listJobTitles);
router.put('/staff/:staffId/job-title', updateStaffJobTitle);

// Employees — paginated search with filters (UC-A03)
router.get('/employees', searchEmployees);

// Roles
router.get('/roles', getRoles);
router.post('/roles', createRole);
router.put('/roles/:id', updateRole);

// User role assignment (UC-A02)
router.patch('/users/:userId/role', assignUserRole);

// Audit Logs
router.get('/audit-logs/recent', getRecentAuditLogs);
router.get('/audit-logs', getPaginatedAuditLogs);

// Analytics
router.get('/analytics/overview', getAdminOverview);
router.get('/analytics/reservations', getReservationsAnalytics);
router.get('/analytics/revenue', getRevenueAnalytics);
router.get('/analytics/orders', getOrdersAnalytics);
router.get('/analytics/reviews', getReviewsAnalytics);
router.get('/analytics/staff-performance', getStaffPerformanceAnalytics);

// Reviews
import { getPaginatedReviews } from '../controllers/adminReviewsController.js';
router.get('/reviews', getPaginatedReviews);

// Settings
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

// Incoming Reports (Submitted by Managers)
import pool from '../db.js';
import path from 'path';
import fs from 'fs';

router.get('/reports/submissions', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        s.submission_id,
        s.manager_id,
        COALESCE(u.full_name, u.email, 'Manager') AS manager_name,
        s.report_type,
        s.date_range_from,
        s.date_range_to,
        s.file_reference,
        s.intent_json,
        s.status,
        s.submitted_at,
        s.reviewed_by,
        s.reviewed_at
      FROM dbo.ReportSubmissions s
      LEFT JOIN dbo.UserAccounts u ON s.manager_id = u.user_id
      ORDER BY s.submitted_at DESC
    `);
    const countUnreviewed = (rows || []).filter(r => r.status === 'Submitted').length;
    return res.json({ success: true, data: rows || [], unreviewed_count: countUnreviewed });
  } catch (error) {
    console.error("[GET /admin/reports/submissions] Error:", error);
    return res.status(500).json({ success: false, message: "Error fetching report submissions" });
  }
});

router.patch('/reports/submissions/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.userId || req.user?.user_id || req.user?.id;

    await pool.query(
      `UPDATE dbo.ReportSubmissions 
       SET status = N'Reviewed', reviewed_by = ?, reviewed_at = SYSDATETIME()
       WHERE submission_id = ?`,
      [adminId, id]
    );

    // AuditLog
    await pool.query(
      `INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, new_value_json) VALUES (?, ?, ?, ?)`,
      [adminId || 1, 'REPORT_REVIEWED_BY_ADMIN', 'dbo.ReportSubmissions', JSON.stringify({ submission_id: id })]
    );

    return res.json({ success: true, message: "Report marked as reviewed" });
  } catch (error) {
    console.error("[PATCH /admin/reports/submissions/:id/review] Error:", error);
    return res.status(500).json({ success: false, message: "Error updating report status" });
  }
});

router.get('/reports/submissions/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT file_reference FROM dbo.ReportSubmissions WHERE submission_id = ?`,
      [id]
    );
    if (!rows || rows.length === 0 || !rows[0].file_reference) {
      return res.status(404).json({ success: false, message: "Submission not found" });
    }

    const relPath = rows[0].file_reference;
    const absPath = path.join(process.cwd(), "backend", relPath);
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ success: false, message: "File not found on server" });
    }

    res.setHeader("Content-Disposition", "attachment; filename=" + path.basename(absPath));
    return res.sendFile(absPath);
  } catch (error) {
    console.error("[GET /admin/reports/submissions/:id/download] Error:", error);
    return res.status(500).json({ success: false, message: "Error downloading file" });
  }
});

router.get('/reports/submissions/:id/view', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT file_reference FROM dbo.ReportSubmissions WHERE submission_id = ?`,
      [id]
    );
    if (!rows || rows.length === 0 || !rows[0].file_reference) {
      return res.status(404).json({ success: false, message: "Submission not found" });
    }

    const relPath = rows[0].file_reference;
    const absPath = path.join(process.cwd(), "backend", relPath);
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ success: false, message: "File not found on server" });
    }

    const ext = path.extname(absPath).toLowerCase();
    if (ext === ".pdf") {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline; filename=" + path.basename(absPath));
    }
    return res.sendFile(absPath);
  } catch (error) {
    console.error("[GET /admin/reports/submissions/:id/view] Error:", error);
    return res.status(500).json({ success: false, message: "Error viewing file" });
  }
});

export default router;
