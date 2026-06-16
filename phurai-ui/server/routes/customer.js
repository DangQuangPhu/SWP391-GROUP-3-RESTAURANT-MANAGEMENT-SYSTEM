import express from "express";
import { buyGiftCard } from "../controllers/giftCardController.js";
import {
  getActiveSession,
  validateSession,
} from "../controllers/qrSessionController.js";
import { resolveUserId, requireUserId } from "../middleware/authMiddleware.js";
import { requireCustomer } from "../middleware/customerMiddleware.js";

const router = express.Router();

/**
 * GET /api/customer/qr-sessions/active
 * Auth: X-User-Id header (customer role)
 */
router.get(
  "/qr-sessions/active",
  resolveUserId,
  requireUserId,
  requireCustomer,
  getActiveSession
);

/**
 * GET /api/customer/qr-sessions/validate?table_id=&session_id=
 * Public — used when scanning QR / opening menu deep link.
 */
router.get("/qr-sessions/validate", validateSession);

/**
 * POST /api/customer/gift-cards/buy
 * Body: { amount: 500000 | 1000000 }
 * Auth: X-User-Id header (customer role)
 */
router.post(
  "/gift-cards/buy",
  resolveUserId,
  requireUserId,
  requireCustomer,
  buyGiftCard
);

export default router;
