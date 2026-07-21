import express from "express";
import { applyPromoCode } from "../controllers/promoCodesController.js";

const router = express.Router();

/**
 * POST /api/promotions/apply
 * Validates and applies a promotion promo code.
 */
router.post("/apply", applyPromoCode);

export default router;
