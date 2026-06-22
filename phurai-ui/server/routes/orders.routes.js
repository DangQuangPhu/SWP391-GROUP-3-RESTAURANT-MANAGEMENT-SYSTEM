import express from 'express';
import { markItemServed, checkoutOrder } from '../controllers/ordersController.js';
import { authMiddleware, requireStaffOrKitchen } from '../middleware/auth.js';

const router = express.Router();

router.patch('/items/:orderItemId/served', authMiddleware, requireStaffOrKitchen, markItemServed);

// Secure checkout for User Ordering
router.post('/checkout', checkoutOrder);

export default router;
