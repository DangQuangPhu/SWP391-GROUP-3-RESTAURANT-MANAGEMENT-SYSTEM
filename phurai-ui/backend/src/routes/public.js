import express from "express";
import { getQrSessionHistory, submitQrOrderPublic, cancelOrderItem, applyPromoCodeToQrSession, updateOrderItemQuantity } from '../controllers/qrSessionController.js';
import { getMenu } from '../controllers/menuController.js';

const router = express.Router();

// Public menu alias used by the landing page and integration clients.
router.get('/menu', getMenu);

router.post("/qr-order/submit", submitQrOrderPublic);
router.delete("/qr-order/items/:itemId", cancelOrderItem);
router.patch("/qr-order/items/:itemId/quantity", updateOrderItemQuantity);
router.get("/qr-order/session/:token/history", getQrSessionHistory);
router.post("/qr-order/session/:token/apply-promo", applyPromoCodeToQrSession);

import { submitOrderReviewPublic } from "../controllers/reviewsController.js";
router.post("/reviews/:orderId", submitOrderReviewPublic);

import { getRawPool } from '../db.js';
import { authMiddleware, requireAdmin } from '../middleware/auth.js';

router.get('/debug-promos', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const rawPool = await getRawPool();
    const result = await rawPool.request().query(`
      SELECT 
        v.promo_code_id AS promotion_id, 
        v.promo_code AS promo_code, 
        UPPER(p.discount_type) AS discount_type, 
        p.discount_value, 
        p.max_discount AS max_discount_amount, 
        p.min_order_value, 
        p.start_at AS valid_from, 
        p.end_at AS valid_until, 
        v.usage_limit, 
        v.times_used AS used_count, 
        v.is_active, 
        v.created_at, 
        v.updated_at
      FROM dbo.PromoCodes v
      JOIN dbo.Promotions p ON v.promotion_id = p.promotion_id
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
