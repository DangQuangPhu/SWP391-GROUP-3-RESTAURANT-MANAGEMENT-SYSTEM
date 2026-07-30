import express from 'express';
import { getMenu, createDish, updateDish, deleteDish, syncMenu, deactivateDish } from '../controllers/menuController.js';
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

// Public read route (or basic auth)
router.get('/', getMenu);

// Protected management routes. Menu synchronisation changes database records.
router.use(authMiddleware);
router.get('/sync', requireManagerOrAdmin, syncMenu);
router.post('/', requireManagerOrAdmin, createDish);
router.put('/:id', requireManagerOrAdmin, updateDish);
router.patch('/:id/deactivate', requireManagerOrAdmin, deactivateDish); // Soft-disable/enable
router.delete('/:id', requireManagerOrAdmin, deleteDish);

router.get('/fix-404', requireManagerOrAdmin, async (req, res) => {
    try {
        const { getRawPool } = await import('../db.js');
        const pool = await getRawPool();
        const images = [
            '/menu/yellowtail-jalapeno.jpg',
            '/menu/lychee-martini.jpg',
            '/menu/bento-chocolate-cake.jpg',
            '/menu/black-cod-miso.jpg'
        ];
        for (const img of images) {
            await pool.query(`UPDATE dbo.DishImages SET image_url = NULL WHERE image_url = '${img}'`);
            await pool.query(`UPDATE dbo.Dishes SET image_url = NULL WHERE image_url = '${img}'`);
        }
        res.json({ success: true, message: 'Removed 404 images' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
