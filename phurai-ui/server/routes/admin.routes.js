import express from 'express';
import { getAuditLogs, getSettings, updateSettings } from '../controllers/adminController.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to all admin routes
router.use(authMiddleware);

// Middleware to strictly restrict to Admin (5)
const requireAdmin = (req, res, next) => {
    const role = req.user?.role_id;
    if (role === 5) {
        next();
    } else {
        return res.status(403).json({ success: false, message: 'Forbidden: Requires Admin role' });
    }
};

router.use(requireAdmin);

router.get('/audit-logs', getAuditLogs);
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

export default router;
