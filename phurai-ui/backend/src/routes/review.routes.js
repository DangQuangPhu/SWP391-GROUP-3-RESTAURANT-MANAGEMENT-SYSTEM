import express from 'express';
import { submitReview, getManagerReviews } from '../controllers/reviewController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

const requireManagerOrAdmin = (req, res, next) => {
    const role = req.user?.role_id;
    if (role === 3 || role === 4 || role === 5) {
        next();
    } else {
        return res.status(403).json({ success: false, message: 'Forbidden: Requires Manager or Admin role' });
    }
};

// Public/Customer routes
router.post('/submit/:orderId', submitReview);

// Manager/Admin routes
router.use(authMiddleware);
router.get('/manager', requireManagerOrAdmin, getManagerReviews);

export default router;
