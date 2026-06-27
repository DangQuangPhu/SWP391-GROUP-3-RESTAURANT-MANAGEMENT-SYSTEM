import express from 'express';
import { resolveUserId, requireUserId } from '../middleware/authMiddleware.js';
import { requireCustomer } from '../middleware/customerMiddleware.js';
import {
  getBalance,
  getCatalog,
  redeemVoucher,
  getMyVouchers,
  applyVoucher
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
 * GET /api/loyalty/catalog
 * Securely retrieves active redeemable voucher catalog.
 */
router.get('/catalog', getCatalog);

/**
 * POST /api/loyalty/redeem
 * Securely exchanges points for an active voucher template.
 */
router.post('/redeem', redeemVoucher);

/**
 * GET /api/loyalty/my-vouchers
 * Securely retrieves owned customer vouchers.
 */
router.get('/my-vouchers', getMyVouchers);

/**
 * POST /api/loyalty/apply-voucher
 * Securely applies a voucher discount to an order or reservation.
 */
router.post('/apply-voucher', applyVoucher);

export default router;
