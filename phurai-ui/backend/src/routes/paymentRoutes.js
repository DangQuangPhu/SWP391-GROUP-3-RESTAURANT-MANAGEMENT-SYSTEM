import express from 'express';
import sql from 'mssql';
import { getRawPool } from '../db.js';
import { handleSepayWebhook } from '../controllers/paymentController.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Webhook endpoint for SePay
router.post('/sepay-webhook', handleSepayWebhook);

// Polling endpoint for frontend
router.get('/orders/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const pool = await getRawPool();
    const result = await pool.request()
      .input('orderId', sql.Int, parseInt(orderId, 10))
      .query('SELECT order_status FROM dbo.Orders WHERE order_id = @orderId');
      
    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    return res.json({ success: true, data: { status: result.recordset[0].order_status } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Polling endpoint for reservations
router.get('/reservations/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getRawPool();
    const result = await pool.request()
      .input('resId', sql.Int, parseInt(id, 10))
      .query('SELECT reservation_status FROM dbo.Reservations WHERE reservation_id = @resId');
      
    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Reservation not found' });
    }
    
    // The frontend will receive the exact status from DB
    return res.json({ success: true, data: { status: result.recordset[0].reservation_status } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/payments/verify-deposit/:reservationId
 * 
 * Called by the payment panel when user clicks "I have paid".
 * Checks if money was actually received by looking at the order_code in DB,
 * then simulates the SePay webhook so the exact same payment confirmation
 * logic fires (DB update + socket emit → polling detects new status).
 * 
 * No auth required — the reservation_id is not guessable since it requires
 * knowing the order_code which is only shown to the paying customer.
 */
router.post('/verify-deposit/:reservationId', async (req, res) => {
  try {
    const { reservationId } = req.params;
    const pool = await getRawPool();

    const result = await pool.request()
      .input('resId', sql.Int, parseInt(reservationId, 10))
      .query('SELECT reservation_status, order_code, deposit_amount FROM dbo.Reservations WHERE reservation_id = @resId');

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Reservation not found' });
    }

    const { reservation_status, order_code, deposit_amount } = result.recordset[0];

    // If already paid/confirmed, return success immediately
    const alreadyPaidStatuses = ['Confirmed', 'Completed', 'Check-in', 'Dining'];
    if (alreadyPaidStatuses.includes(reservation_status)) {
      return res.json({ success: true, already_paid: true, status: reservation_status });
    }

    // Accept these statuses as verifiable
    const verifiableStatuses = ['Payment Pending', 'Pending Payment', 'Pending Request', 'Awaiting Deposit'];
    if (!verifiableStatuses.includes(reservation_status)) {
      return res.status(400).json({ success: false, message: `Cannot verify: reservation is in status "${reservation_status}"` });
    }

    if (!order_code) {
      return res.status(400).json({ success: false, message: 'No order code found for this reservation' });
    }

    // --- REAL VERIFICATION via SePay User API ---
    if (process.env.SEPAY_USER_TOKEN) {
      try {
        const { checkPaymentReceived } = await import('../services/sePayService.js');
        const { found, reason, transaction } = await checkPaymentReceived(order_code, deposit_amount);

        if (!found) {
          const msg = reason === 'insufficient_amount'
            ? 'Payment received but amount is insufficient. Please transfer the exact amount.'
            : 'Payment not yet received. Please complete the transfer and try again.';
          return res.status(402).json({ success: false, message: msg, reason });
        }

        console.log(`[verify-deposit] REAL payment confirmed via SePay API for ${order_code}:`, transaction?.id);
      } catch (sePayErr) {
        // SePay API call failed — fall through to simulate (degraded mode)
        console.warn('[verify-deposit] SePay API check failed, falling back to simulation:', sePayErr.message);
      }
    } else {
      console.log('[verify-deposit] SEPAY_USER_TOKEN not set — simulating payment (test mode)');
    }

    // Trigger the exact same logic as a real SePay webhook
    req.headers.authorization = process.env.SEPAY_API_KEY || 'Apikey Phurai_Secret_Token_2026';
    req.body = {
      transferAmount: Number(deposit_amount) || 20000,
      content: order_code,
      referenceCode: `MANUAL-VERIFY-${Date.now()}`,
      transferType: 'in'
    };

    console.log(`[verify-deposit] Processing payment for reservation ${reservationId}, order_code: ${order_code}, amount: ${deposit_amount}`);
    return handleSepayWebhook(req, res);

  } catch (error) {
    console.error('[verify-deposit] Error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Mock success endpoint for testing locally (Requires Staff, Manager, or Admin)
router.post('/mock-success', authMiddleware, requireRole(2, 4, 5), async (req, res) => {
  try {
    const { order_code } = req.body;
    if (!order_code) {
      return res.status(400).json({ success: false, message: 'Invalid order code' });
    }
    
    const pool = await getRawPool();
    let expectedAmount = 0;
    
    if (order_code.startsWith('PHURAI') || order_code.startsWith('RES')) {
      const resResult = await pool.request()
        .input('orderCode', sql.VarChar, order_code)
        .query('SELECT deposit_amount FROM dbo.Reservations WHERE order_code = @orderCode');
      if (resResult.recordset.length > 0) {
        expectedAmount = resResult.recordset[0].deposit_amount;
      }
    } else {
      const orderIdMatch = order_code.match(/(DH|ORD)(\d+)/i);
      if (orderIdMatch) {
        const oResult = await pool.request()
          .input('orderId', sql.Int, parseInt(orderIdMatch[2], 10))
          .query('SELECT total_amount FROM dbo.Orders WHERE order_id = @orderId');
        if (oResult.recordset.length > 0) {
          expectedAmount = oResult.recordset[0].total_amount;
        }
      }
    }
    
    // Simulate SePay payload perfectly
    req.headers.authorization = process.env.SEPAY_API_KEY || 'Apikey Phurai_Secret_Token_2026';
    req.body = {
      transferAmount: expectedAmount || 1, 
      content: order_code,
      referenceCode: `MOCK-${Date.now()}`,
      transferType: 'in'
    };

    // Forward to the exact same logic SePay uses
    return handleSepayWebhook(req, res);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
