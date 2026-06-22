import express from 'express';
import { getMenu, createDish, updateDish, deleteDish, syncMenu } from '../controllers/menuController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

const requireManagerOrAdmin = (req, res, next) => {
    const role = req.user?.role_id;
    if (role === 4 || role === 5) {
        next();
    } else {
        return res.status(403).json({ success: false, message: 'Forbidden: Requires Manager or Admin role' });
    }
};

// Public read route (or basic auth)
router.get('/', getMenu);
router.get('/sync', syncMenu);

// Protected write routes
router.use(authMiddleware);
router.post('/', requireManagerOrAdmin, createDish);
router.put('/:id', requireManagerOrAdmin, updateDish);
router.delete('/:id', requireManagerOrAdmin, deleteDish);

export default router;
