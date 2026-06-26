import express from "express";
import { applyVoucher } from "../controllers/vouchersController.js";

const router = express.Router();

/**
 * POST /api/vouchers/apply
 * Validates and applies a voucher code.
 */
router.post("/apply", applyVoucher);

export default router;
