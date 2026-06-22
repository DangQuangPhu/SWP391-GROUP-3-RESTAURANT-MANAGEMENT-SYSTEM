import express from "express";

const router = express.Router();


import { validatePromoCode } from "../controllers/promotionsController.js";

/**
 * GET /api/promotions/validate/:code
 */
router.get("/validate/:code", validatePromoCode);

export default router;
