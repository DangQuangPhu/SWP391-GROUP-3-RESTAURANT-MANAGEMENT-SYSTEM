import express from 'express';
import { authMiddleware, requireCustomer } from '../middleware/auth.js';
import * as ctrl from '../controllers/customer.controller.js';

const router = express.Router();

// Customer endpoints
router.post('/reservations', authMiddleware, requireCustomer, ctrl.submitReservation);
router.get('/payments/history', authMiddleware, requireCustomer, ctrl.getCustomerPaymentHistory);

export default router;
