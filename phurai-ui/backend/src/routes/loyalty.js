import express from 'express';
import { resolveUserId, requireUserId } from '../middleware/authMiddleware.js';
import { requireCustomer } from '../middleware/customerMiddleware.js';
import {
  getBalance,
  getCatalog,
  redeemPromotion,
  getMyPromotions,
  applyPromotion,
  getHistory
} from '../controllers/loyaltyController.js';

const router = express.Router();

// All loyalty endpoints require authenticated customer session
router.use(resolveUserId, requireUserId, requireCustomer);

/**
 * GET /api/loyalty/balance
 * Securely retrieves point balance and summary statistics.
 */
router.get('/balance', getBalance);

/**
 * GET /api/loyalty/history
 * Securely retrieves customer point transaction history ledger.
 */
router.get('/history', getHistory);

/**
 * GET /api/loyalty/catalog
 * Securely retrieves active redeemable promotion catalog.
 */
router.get('/catalog', getCatalog);

/**
 * POST /api/loyalty/redeem
 * Securely exchanges points for an active promotion template.
 */
router.post('/redeem', redeemPromotion);

/**
 * GET /api/loyalty/my-promotions
 * Securely retrieves owned customer promotions.
 */
router.get('/my-promotions', getMyPromotions);

/**
 * POST /api/loyalty/apply-promotion
 * Securely applies a customer promotion discount to an order or reservation.
 */
router.post('/apply-promotion', applyPromotion);

export default router;
