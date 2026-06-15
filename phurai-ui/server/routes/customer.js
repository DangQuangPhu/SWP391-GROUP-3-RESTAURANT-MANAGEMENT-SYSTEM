import express from "express";
import { buyGiftCard } from "../controllers/giftCardController.js";
import { resolveUserId, requireUserId } from "../middleware/authMiddleware.js";
import { requireCustomer } from "../middleware/customerMiddleware.js";

const router = express.Router();

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
