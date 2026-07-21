import express from 'express';
import { markItemServed, checkoutOrder, applyPromoCode } from '../controllers/ordersController.js';
import { authMiddleware, requireStaff } from '../middleware/auth.js';

const router = express.Router();

router.patch('/items/:orderItemId/served', authMiddleware, requireStaff, markItemServed);


// Secure checkout for User Ordering
router.post('/checkout', checkoutOrder);

// Apply promo code (Immediate Deduction Logic)
router.post('/:orderId/apply-promo', applyPromoCode);

export default router;
