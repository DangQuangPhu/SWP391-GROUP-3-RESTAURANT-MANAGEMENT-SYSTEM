import sql from 'mssql';
import { getRawPool } from '../db.js';
import { getCustomerBalance } from '../services/loyaltyService.js';

// Helper to generate a random alphanumeric string
function generateRandomAlphanumeric(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * GET /api/loyalty/balance
 * Returns the customer's point balance and transaction totals.
 */
export async function getBalance(req, res) {
  try {
    const customerId = req.userId;
    if (!customerId) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }

    const balanceData = await getCustomerBalance(customerId);
    return res.json({ success: true, ...balanceData });
  } catch (err) {
    console.error('[LoyaltyController] getBalance error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * GET /api/loyalty/catalog
 * Returns available voucher templates that can be redeemed.
 */
export async function getCatalog(req, res) {
  try {
    const pool = await getRawPool();
    const result = await pool.request().query(`
      SELECT 
        promotion_id,
        promotion_name,
        description,
        discount_type,
        discount_value,
        min_order_value,
        max_discount,
        points_required,
        validity_duration_hours,
        total_quantity,
        remaining_quantity,
        applicable_to
      FROM dbo.Promotions
      WHERE points_required > 0
        AND is_active = 1
        AND (start_at IS NULL OR start_at <= SYSDATETIME())
        AND (end_at IS NULL OR end_at > SYSDATETIME())
        AND (remaining_quantity IS NULL OR remaining_quantity > 0)
      ORDER BY points_required ASC
    `);

    return res.json({ success: true, catalog: result.recordset });
  } catch (err) {
    console.error('[LoyaltyController] getCatalog error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * POST /api/loyalty/redeem
 * Redeems points for a voucher template under SERIALIZABLE isolation to prevent double-spending.
 */
export async function redeemVoucher(req, res) {
  const customerId = req.userId;
  const { voucherTemplateId } = req.body;

  if (!customerId) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  }
  if (!voucherTemplateId) {
    return res.status(400).json({ success: false, message: 'Missing voucherTemplateId.' });
  }

  const pool = await getRawPool();
  const transaction = new sql.Transaction(pool);

  try {
    // 1. Begin transaction at SERIALIZABLE level
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    // 2. Fetch the promotion details and lock the row
    const promoResult = await transaction.request()
      .input('promoId', sql.Int, voucherTemplateId)
      .query(`
        SELECT promotion_id, promotion_name, points_required, validity_duration_hours, total_quantity, remaining_quantity
        FROM dbo.Promotions WITH (UPDLOCK)
        WHERE promotion_id = @promoId AND is_active = 1
      `);

    const promo = promoResult.recordset[0];
    if (!promo) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Voucher template not found or inactive.' });
    }

    const pointsRequired = promo.points_required;
    if (!pointsRequired || pointsRequired <= 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Selected promotion is not available for point redemption.' });
    }

    // 3. Atomically check & decrement stock
    if (promo.remaining_quantity !== null) {
      if (promo.remaining_quantity <= 0) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Voucher is out of stock.' });
      }

      await transaction.request()
        .input('promoId', sql.Int, voucherTemplateId)
        .query(`
          UPDATE dbo.Promotions
          SET remaining_quantity = remaining_quantity - 1
          WHERE promotion_id = @promoId AND remaining_quantity > 0
        `);
    }

    // 4. Check current customer balance inside the serializable transaction
    const balanceResult = await transaction.request()
      .input('customerId', sql.Int, customerId)
      .query(`
        SELECT ISNULL(SUM(points), 0) AS balance
        FROM dbo.LoyaltyTransactions
        WHERE customer_id = @customerId
      `);
    
    const balance = balanceResult.recordset[0]?.balance || 0;
    if (balance < pointsRequired) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Insufficient points balance.' });
    }

    // 5. Generate a unique voucher code with collision retry handling
    let voucherCode = '';
    let generatedUnique = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = `PR-${generateRandomAlphanumeric(6)}`;
      const checkCodeResult = await transaction.request()
        .input('code', sql.NVarChar(50), code)
        .query('SELECT 1 FROM dbo.CustomerVouchers WHERE voucher_code = @code');
      
      if (checkCodeResult.recordset.length === 0) {
        voucherCode = code;
        generatedUnique = true;
        break;
      }
    }

    if (!generatedUnique) {
      await transaction.rollback();
      return res.status(500).json({ success: false, message: 'Failed to generate a unique voucher code. Please try again.' });
    }

    // 6. Insert Loyalty Transaction ledger entry
    const insertTxResult = await transaction.request()
      .input('customerId', sql.Int, customerId)
      .input('points', sql.Int, -pointsRequired)
      .input('description', sql.NVarChar(255), `Redeemed voucher: ${promo.promotion_name}`)
      .query(`
        INSERT INTO dbo.LoyaltyTransactions (customer_id, points, transaction_type, reference_type, reference_id, description, created_at)
        VALUES (@customerId, @points, N'Redeem', N'VoucherRedeem', NULL, @description, SYSDATETIME());
      `);

    // 7. Calculate voucher expiration date
    const hours = promo.validity_duration_hours || 24;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    // 8. Insert into Customer Vouchers
    const insertVoucherResult = await transaction.request()
      .input('customerId', sql.Int, customerId)
      .input('promoId', sql.Int, voucherTemplateId)
      .input('pointsSpent', sql.Int, pointsRequired)
      .input('code', sql.NVarChar(50), voucherCode)
      .input('expiresAt', sql.DateTime2, expiresAt)
      .query(`
        INSERT INTO dbo.CustomerVouchers (customer_id, promotion_id, points_spent, voucher_code, status, redeemed_at, expires_at)
        VALUES (@customerId, @promoId, @pointsSpent, @code, N'active', SYSDATETIME(), @expiresAt)
      `);

    // 9. Recompute cached loyalty points on CustomerProfile to prevent drift
    await transaction.request()
      .input('customerId', sql.Int, customerId)
      .query(`
        UPDATE dbo.CustomerProfiles
        SET loyalty_points = (
          SELECT ISNULL(SUM(points), 0)
          FROM dbo.LoyaltyTransactions
          WHERE customer_id = @customerId
        ),
        updated_at = SYSDATETIME()
        WHERE user_id = @customerId
      `);

    await transaction.commit();

    return res.json({
      success: true,
      message: 'Voucher redeemed successfully.',
      voucher: {
        code: voucherCode,
        expiresAt,
        pointsSpent: pointsRequired
      }
    });
  } catch (err) {
    console.error('[LoyaltyController] redeemVoucher error:', err);
    try {
      await transaction.rollback();
    } catch (rollbackErr) {
      // already rolled back or connection closed
    }
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * GET /api/loyalty/my-vouchers
 * Fetches the customer's owned vouchers (Active, Used, Expired).
 */
export async function getMyVouchers(req, res) {
  try {
    const customerId = req.userId;
    const { status } = req.query;

    if (!customerId) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }

    const pool = await getRawPool();

    // Auto-expire any vouchers that have passed their expiry date
    await pool.request()
      .input('customerId', sql.Int, customerId)
      .query(`
        UPDATE dbo.CustomerVouchers
        SET status = N'expired'
        WHERE customer_id = @customerId
          AND status = N'active'
          AND expires_at < SYSDATETIME()
      `);

    let queryStr = `
      SELECT 
        cv.customer_voucher_id,
        cv.promotion_id,
        cv.points_spent,
        cv.voucher_code,
        cv.status,
        cv.redeemed_at,
        cv.expires_at,
        cv.used_at,
        p.promotion_name,
        p.description,
        p.discount_type,
        p.discount_value,
        p.min_order_value,
        p.applicable_to,
        p.validity_duration_hours
      FROM dbo.CustomerVouchers cv
      JOIN dbo.Promotions p ON cv.promotion_id = p.promotion_id
      WHERE cv.customer_id = @customerId
    `;

    const request = pool.request().input('customerId', sql.Int, customerId);

    if (status) {
      queryStr += ` AND cv.status = @status`;
      request.input('status', sql.NVarChar(20), status);
    }

    queryStr += ` ORDER BY cv.redeemed_at DESC`;

    const result = await request.query(queryStr);
    return res.json({ success: true, vouchers: result.recordset });
  } catch (err) {
    console.error('[LoyaltyController] getMyVouchers error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}


/**
 * POST /api/loyalty/apply-voucher
 * Validates ownership, applicability and checks active state of a voucher before applying it.
 */
export async function applyVoucher(req, res) {
  const customerId = req.userId;
  const { customerVoucherId, orderId, reservationId } = req.body;

  if (!customerId) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  }
  if (!customerVoucherId) {
    return res.status(400).json({ success: false, message: 'Missing customerVoucherId.' });
  }
  if (!orderId && !reservationId) {
    return res.status(400).json({ success: false, message: 'Must apply to either an orderId or reservationId.' });
  }

  const pool = await getRawPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // 1. Check ownership, active state, and expiration details of the voucher
    const voucherResult = await transaction.request()
      .input('voucherId', sql.Int, customerVoucherId)
      .input('customerId', sql.Int, customerId)
      .query(`
        SELECT cv.customer_voucher_id, cv.status, cv.expires_at, p.applicable_to, p.discount_type, p.discount_value, p.min_order_value
        FROM dbo.CustomerVouchers cv
        JOIN dbo.Promotions p ON p.promotion_id = cv.promotion_id
        WHERE cv.customer_voucher_id = @voucherId
          AND cv.customer_id = @customerId
      `);

    const voucher = voucherResult.recordset[0];
    if (!voucher) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Voucher not found or does not belong to you.' });
    }

    if (voucher.status !== 'active') {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: `Voucher is already ${voucher.status}.` });
    }

    if (new Date(voucher.expires_at) <= new Date()) {
      // Mark as expired in db on-the-fly
      await transaction.request()
        .input('voucherId', sql.Int, customerVoucherId)
        .query("UPDATE dbo.CustomerVouchers SET status = N'expired' WHERE customer_voucher_id = @voucherId");
      
      await transaction.commit();
      return res.status(400).json({ success: false, message: 'Voucher has expired.' });
    }

    // 2. Validate applicability limits (Order vs Reservation vs Both)
    const targetType = orderId ? 'Order' : 'Reservation';
    if (voucher.applicable_to !== 'Both' && voucher.applicable_to !== targetType) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: `This voucher is only applicable to ${voucher.applicable_to} checkouts.` });
    }

    let discountAmount = 0;
    let newTotalAmount = 0;

    // 3. Process application for Order checkout
    if (orderId) {
      const orderResult = await transaction.request()
        .input('orderId', sql.Int, orderId)
        .query('SELECT subtotal, service_charge, applied_voucher_id FROM dbo.Orders WHERE order_id = @orderId');
      
      const order = orderResult.recordset[0];
      if (!order) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Order not found.' });
      }

      if (order.applied_voucher_id) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Order already has a voucher applied.' });
      }

      const subtotal = parseFloat(order.subtotal);
      if (subtotal < parseFloat(voucher.min_order_value)) {
        await transaction.rollback();
        return res.status(400).json({ 
          success: false, 
          message: `Minimum order subtotal of ${parseFloat(voucher.min_order_value).toLocaleString()} VND required to apply this voucher.` 
        });
      }

      // Calculate discount amount
      let discount = 0;
      if (voucher.discount_type === 'Fixed') {
        discount = parseFloat(voucher.discount_value);
      } else if (voucher.discount_type === 'Percent') {
        discount = subtotal * (parseFloat(voucher.discount_value) / 100);
      }
      discount = Math.min(discount, subtotal); // Discount cannot exceed subtotal

      const serviceCharge = parseFloat(order.service_charge || 0);
      discountAmount = discount;
      newTotalAmount = subtotal - discount + serviceCharge;

      // Update Order total and lock the voucher ID
      await transaction.request()
        .input('orderId', sql.Int, orderId)
        .input('voucherId', sql.Int, customerVoucherId)
        .input('discount', sql.Decimal(12, 2), discount)
        .query(`
          UPDATE dbo.Orders
          SET applied_voucher_id = @voucherId,
              discount_amount = @discount,
              total_amount = subtotal - @discount + service_charge,
              updated_at = SYSDATETIME()
          WHERE order_id = @orderId
        `);

      // Update Customer Voucher status to used
      await transaction.request()
        .input('voucherId', sql.Int, customerVoucherId)
        .input('orderId', sql.Int, orderId)
        .query(`
          UPDATE dbo.CustomerVouchers
          SET status = N'used',
              used_at = SYSDATETIME(),
              used_in_order_id = @orderId
          WHERE customer_voucher_id = @voucherId
        `);
    }

    // 4. Process application for Reservation booking flow
    if (reservationId) {
      const resResult = await transaction.request()
        .input('resId', sql.Int, reservationId)
        .query('SELECT deposit_amount, applied_voucher_id FROM dbo.Reservations WHERE reservation_id = @resId');
      
      const reservation = resResult.recordset[0];
      if (!reservation) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Reservation not found.' });
      }

      if (reservation.applied_voucher_id) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Reservation already has a voucher applied.' });
      }

      const deposit = parseFloat(reservation.deposit_amount || 0);
      let discount = 0;
      if (voucher.discount_type === 'Fixed') {
        discount = parseFloat(voucher.discount_value);
      } else if (voucher.discount_type === 'Percent') {
        discount = deposit * (parseFloat(voucher.discount_value) / 100);
      }
      discount = Math.min(discount, deposit);

      discountAmount = discount;
      newTotalAmount = Math.max(0, deposit - discount);

      // Update Reservation and link voucher
      await transaction.request()
        .input('resId', sql.Int, reservationId)
        .input('voucherId', sql.Int, customerVoucherId)
        .input('discount', sql.Decimal(12, 2), discount)
        .query(`
          UPDATE dbo.Reservations
          SET applied_voucher_id = @voucherId,
              deposit_amount = CASE WHEN deposit_amount - @discount < 0 THEN 0 ELSE deposit_amount - @discount END,
              updated_at = SYSDATETIME()
          WHERE reservation_id = @resId
        `);

      // Update Customer Voucher status
      await transaction.request()
        .input('voucherId', sql.Int, customerVoucherId)
        .input('resId', sql.Int, reservationId)
        .query(`
          UPDATE dbo.CustomerVouchers
          SET status = N'used',
              used_at = SYSDATETIME(),
              used_in_reservation_id = @resId
          WHERE customer_voucher_id = @voucherId
        `);
    }

    await transaction.commit();
    return res.json({ 
      success: true, 
      message: 'Voucher applied successfully.',
      discountAmount,
      newTotalAmount
    });
  } catch (err) {
    console.error('[LoyaltyController] applyVoucher error:', err);
    try {
      await transaction.rollback();
    } catch (rollErr) {}
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}
