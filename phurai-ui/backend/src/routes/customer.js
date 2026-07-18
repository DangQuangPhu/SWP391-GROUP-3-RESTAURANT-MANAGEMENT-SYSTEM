import express from "express";
import { buyGiftCard } from "../controllers/giftCardController.js";
import {
  getActiveSession,
  validateSession,
  scanStaticQr,
  scanStaticQrCodeUrl,
} from "../controllers/qrSessionController.js";
import { resolveUserId, requireUserId } from "../middleware/authMiddleware.js";
import { requireCustomer } from "../middleware/customerMiddleware.js";
import { 
  getCustomerPaymentHistory,
  getCustomerPaymentDetails,
  getCustomerDashboardSummary,
  getCustomerExpenditureTrend,
  getCustomerOrdersByCategory,
  getCustomerRecentActivity,
  getActivityOrderItems,
  getCustomerDetailedOrderItems,
  getCustomerDetailedItemsByCategory
} from "../controllers/customer.controller.js";
import { getRecommendations } from "../controllers/recommendationController.js";

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
 * POST /api/customer/qr-sessions/scan
 * Body: { table_id }
 * Public — used when scanning physical QR code. Generates/returns session.
 */
router.post("/qr-sessions/scan", scanStaticQr);

/**
 * GET /api/customer/qr-sessions/scan/:qr_code
 * Public — used when scanning physical QR code. Looks up table by static_qr_code. Generates/returns session.
 */
router.get("/qr-sessions/scan/:qr_code", scanStaticQrCodeUrl);

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

/**
 * GET /api/customer/payments/history
 * Auth: X-User-Id header (customer role)
 */
router.get(
  "/payments/history",
  resolveUserId,
  requireUserId,
  requireCustomer,
  getCustomerPaymentHistory
);

/**
 * GET /api/customer/dashboard/summary
 */
router.get(
  "/dashboard/summary",
  resolveUserId,
  requireUserId,
  requireCustomer,
  getCustomerDashboardSummary
);

/**
 * GET /api/customer/dashboard/expenditure-trend
 */
router.get(
  "/dashboard/expenditure-trend",
  resolveUserId,
  requireUserId,
  requireCustomer,
  getCustomerExpenditureTrend
);

/**
 * GET /api/customer/dashboard/orders-by-category
 */
router.get(
  "/dashboard/orders-by-category",
  resolveUserId,
  requireUserId,
  requireCustomer,
  getCustomerOrdersByCategory
);

/**
 * GET /api/customer/dashboard/recent-activity
 */
router.get(
  "/dashboard/recent-activity",
  resolveUserId,
  requireUserId,
  requireCustomer,
  getCustomerRecentActivity
);

router.get(
  "/dashboard/activity-items",
  resolveUserId,
  requireUserId,
  requireCustomer,
  getActivityOrderItems
);

router.get(
  "/dashboard/detailed-order-items",
  resolveUserId,
  requireUserId,
  requireCustomer,
  getCustomerDetailedOrderItems
);

/**
 * GET /api/customer/dashboard/detailed-category-items
 */
router.get(
  "/dashboard/detailed-category-items",
  resolveUserId,
  requireUserId,
  requireCustomer,
  getCustomerDetailedItemsByCategory
);

/**
 * GET /api/customer/payments/:paymentId/details
 */
router.get(
  "/payments/:paymentId/details",
  resolveUserId,
  requireUserId,
  requireCustomer,
  getCustomerPaymentDetails
);

/**
 * GET /api/customer/recommendations?limit=6
 * UC-CU08 — Personalized dish recommendations
 */
router.get(
  "/recommendations",
  resolveUserId,
  requireUserId,
  requireCustomer,
  getRecommendations
);

export default router;
