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
 * Returns available promotion templates that can be redeemed.
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
 * Redeems points for a promotion template under SERIALIZABLE isolation to prevent double-spending.
 */
export async function redeemPromotion(req, res) {
  const customerId = req.userId;
  const { promotionTemplateId } = req.body;

  if (!customerId) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  }
  if (!promotionTemplateId) {
    return res.status(400).json({ success: false, message: 'Missing promotionTemplateId.' });
  }

  const pool = await getRawPool();
  const transaction = new sql.Transaction(pool);

  try {
    // 1. Begin transaction at SERIALIZABLE level
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    // 2. Fetch the promotion details and lock the row
    const promoResult = await transaction.request()
      .input('promoId', sql.Int, promotionTemplateId)
      .query(`
        SELECT promotion_id, promotion_name, points_required, validity_duration_hours, total_quantity, remaining_quantity
        FROM dbo.Promotions WITH (UPDLOCK)
        WHERE promotion_id = @promoId AND is_active = 1
      `);

    const promo = promoResult.recordset[0];
    if (!promo) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Promotion template not found or inactive.' });
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
        return res.status(400).json({ success: false, message: 'Promotion is out of stock.' });
      }

      await transaction.request()
        .input('promoId', sql.Int, promotionTemplateId)
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

    // 5. Generate a unique promo code with collision retry handling
    let promoCode = '';
    let generatedUnique = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = `PR-${generateRandomAlphanumeric(6)}`;
      const checkCodeResult = await transaction.request()
        .input('code', sql.NVarChar(50), code)
        .query('SELECT 1 FROM dbo.CustomerPromotions WHERE promo_code = @code');
      
      if (checkCodeResult.recordset.length === 0) {
        promoCode = code;
        generatedUnique = true;
        break;
      }
    }

    if (!generatedUnique) {
      await transaction.rollback();
      return res.status(500).json({ success: false, message: 'Failed to generate a unique promo code. Please try again.' });
    }

    // 6. Insert Loyalty Transaction ledger entry
    await transaction.request()
      .input('customerId', sql.Int, customerId)
      .input('points', sql.Int, -pointsRequired)
      .input('description', sql.NVarChar(255), `Redeemed promotion: ${promo.promotion_name}`)
      .query(`
        INSERT INTO dbo.LoyaltyTransactions (customer_id, points, transaction_type, reference_type, reference_id, description, created_at)
        VALUES (@customerId, @points, N'Redeem', N'PromotionRedeem', NULL, @description, SYSDATETIME());
      `);

    // 7. Calculate promotion expiration date
    const hours = promo.validity_duration_hours || 24;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    // 8. Insert into Customer Promotions
    await transaction.request()
      .input('customerId', sql.Int, customerId)
      .input('promoId', sql.Int, promotionTemplateId)
      .input('pointsSpent', sql.Int, pointsRequired)
      .input('code', sql.NVarChar(50), promoCode)
      .input('expiresAt', sql.DateTime2, expiresAt)
      .query(`
        INSERT INTO dbo.CustomerPromotions (customer_id, promotion_id, points_spent, promo_code, status, redeemed_at, expires_at)
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
      message: 'Promotion redeemed successfully.',
      promotion: {
        code: promoCode,
        expiresAt,
        pointsSpent: pointsRequired
      }
    });
  } catch (err) {
    console.error('[LoyaltyController] redeemPromotion error:', err);
    try {
      await transaction.rollback();
    } catch (rollbackErr) {
      // already rolled back or connection closed
    }
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * GET /api/loyalty/my-promotions
 * Fetches the customer's owned promotions (Active, Used, Expired).
 */
export async function getMyPromotions(req, res) {
  try {
    const customerId = req.userId;
    const { status } = req.query;

    if (!customerId) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }

    const pool = await getRawPool();

    // Auto-expire any customer promotions that have passed their expiry date
    await pool.request()
      .input('customerId', sql.Int, customerId)
      .query(`
        UPDATE dbo.CustomerPromotions
        SET status = N'expired'
        WHERE customer_id = @customerId
          AND status = N'active'
          AND expires_at < SYSDATETIME()
      `);

    let queryStr = `
      SELECT 
        cp.customer_promotion_id,
        cp.promotion_id,
        cp.points_spent,
        cp.promo_code,
        cp.status,
        cp.redeemed_at,
        cp.expires_at,
        cp.used_at,
        p.promotion_name,
        p.description,
        p.discount_type,
        p.discount_value,
        p.min_order_value,
        p.applicable_to,
        p.validity_duration_hours
      FROM dbo.CustomerPromotions cp
      JOIN dbo.Promotions p ON cp.promotion_id = p.promotion_id
      WHERE cp.customer_id = @customerId
    `;

    const request = pool.request().input('customerId', sql.Int, customerId);

    if (status) {
      queryStr += ` AND cp.status = @status`;
      request.input('status', sql.NVarChar(20), status);
    }

    queryStr += ` ORDER BY cp.redeemed_at DESC`;

    const result = await request.query(queryStr);
    return res.json({ success: true, promotions: result.recordset });
  } catch (err) {
    console.error('[LoyaltyController] getMyPromotions error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * GET /api/loyalty/history
 * Returns the customer's point history ledger (+/- transactions).
 */
export async function getHistory(req, res) {
  try {
    const customerId = req.userId;
    if (!customerId) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }

    const pool = await getRawPool();
    const result = await pool.request()
      .input('customerId', sql.Int, customerId)
      .query(`
        SELECT 
          transaction_id,
          points,
          transaction_type,
          reference_type,
          reference_id,
          description,
          created_at
        FROM dbo.LoyaltyTransactions
        WHERE customer_id = @customerId
        ORDER BY created_at DESC
      `);

    return res.json({ success: true, history: result.recordset });
  } catch (err) {
    console.error('[LoyaltyController] getHistory error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * POST /api/loyalty/apply-promotion
 * Validates ownership, applicability and checks active state of a customer promotion before applying it.
 */
export async function applyPromotion(req, res) {
  const customerId = req.userId;
  const { customerPromotionId, orderId, reservationId } = req.body;

  if (!customerId) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  }
  if (!customerPromotionId) {
    return res.status(400).json({ success: false, message: 'Missing customerPromotionId.' });
  }
  if (!orderId && !reservationId) {
    return res.status(400).json({ success: false, message: 'Must apply to either an orderId or reservationId.' });
  }

  const pool = await getRawPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // 1. Check ownership, active state, and expiration details of the customer promotion
    const promoResult = await transaction.request()
      .input('promoId', sql.Int, customerPromotionId)
      .input('customerId', sql.Int, customerId)
      .query(`
        SELECT cp.customer_promotion_id, cp.status, cp.expires_at, p.applicable_to, p.discount_type, p.discount_value, p.min_order_value
        FROM dbo.CustomerPromotions cp
        JOIN dbo.Promotions p ON p.promotion_id = cp.promotion_id
        WHERE cp.customer_promotion_id = @promoId
          AND cp.customer_id = @customerId
      `);

    const promotion = promoResult.recordset[0];
    if (!promotion) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Promotion not found or does not belong to you.' });
    }

    if (promotion.status !== 'active') {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: `Promotion is already ${promotion.status}.` });
    }

    if (new Date(promotion.expires_at) <= new Date()) {
      // Mark as expired in db on-the-fly
      await transaction.request()
        .input('promoId', sql.Int, customerPromotionId)
        .query("UPDATE dbo.CustomerPromotions SET status = N'expired' WHERE customer_promotion_id = @promoId");
      
      await transaction.commit();
      return res.status(400).json({ success: false, message: 'Promotion has expired.' });
    }

    // 2. Validate applicability limits (Order vs Reservation vs Both)
    const targetType = orderId ? 'Order' : 'Reservation';
    if (promotion.applicable_to !== 'Both' && promotion.applicable_to !== targetType) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: `This promotion is only applicable to ${promotion.applicable_to} checkouts.` });
    }

    let discountAmount = 0;
    let newTotalAmount = 0;

    // 3. Process application for Order checkout
    if (orderId) {
      const orderResult = await transaction.request()
        .input('orderId', sql.Int, orderId)
        .query('SELECT subtotal, service_charge, applied_promotion_id FROM dbo.Orders WHERE order_id = @orderId');
      
      const order = orderResult.recordset[0];
      if (!order) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Order not found.' });
      }

      if (order.applied_promotion_id) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Order already has a promotion applied.' });
      }

      const subtotal = parseFloat(order.subtotal);
      if (subtotal < parseFloat(promotion.min_order_value)) {
        await transaction.rollback();
        return res.status(400).json({ 
          success: false, 
          message: `Minimum order subtotal of ${parseFloat(promotion.min_order_value).toLocaleString()} VND required to apply this promotion.` 
        });
      }

      // Calculate discount amount
      let discount = 0;
      if (promotion.discount_type === 'Fixed') {
        discount = parseFloat(promotion.discount_value);
      } else if (promotion.discount_type === 'Percent') {
        discount = subtotal * (parseFloat(promotion.discount_value) / 100);
      }
      discount = Math.min(discount, subtotal); // Discount cannot exceed subtotal

      const serviceCharge = parseFloat(order.service_charge || 0);
      discountAmount = discount;
      newTotalAmount = subtotal - discount + serviceCharge;

      // Update Order total and lock the promotion ID
      await transaction.request()
        .input('orderId', sql.Int, orderId)
        .input('promoId', sql.Int, customerPromotionId)
        .input('discount', sql.Decimal(12, 2), discount)
        .query(`
          UPDATE dbo.Orders
          SET applied_promotion_id = @promoId,
              discount_amount = @discount,
              total_amount = subtotal - @discount + service_charge,
              updated_at = SYSDATETIME()
          WHERE order_id = @orderId
        `);

      // Update Customer Promotion status to used
      await transaction.request()
        .input('promoId', sql.Int, customerPromotionId)
        .input('orderId', sql.Int, orderId)
        .query(`
          UPDATE dbo.CustomerPromotions
          SET status = N'used',
              used_at = SYSDATETIME(),
              used_in_order_id = @orderId
          WHERE customer_promotion_id = @promoId
        `);
    }

    // 4. Process application for Reservation booking flow
    if (reservationId) {
      const resResult = await transaction.request()
        .input('resId', sql.Int, reservationId)
        .query('SELECT deposit_amount, applied_promotion_id FROM dbo.Reservations WHERE reservation_id = @resId');
      
      const reservation = resResult.recordset[0];
      if (!reservation) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Reservation not found.' });
      }

      if (reservation.applied_promotion_id) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Reservation already has a promotion applied.' });
      }

      const deposit = parseFloat(reservation.deposit_amount || 0);
      let discount = 0;
      if (promotion.discount_type === 'Fixed') {
        discount = parseFloat(promotion.discount_value);
      } else if (promotion.discount_type === 'Percent') {
        discount = deposit * (parseFloat(promotion.discount_value) / 100);
      }
      discount = Math.min(discount, deposit);

      discountAmount = discount;
      newTotalAmount = Math.max(0, deposit - discount);

      // Update Reservation and link promotion
      await transaction.request()
        .input('resId', sql.Int, reservationId)
        .input('promoId', sql.Int, customerPromotionId)
        .input('discount', sql.Decimal(12, 2), discount)
        .query(`
          UPDATE dbo.Reservations
          SET applied_promotion_id = @promoId,
              deposit_amount = CASE WHEN deposit_amount - @discount < 0 THEN 0 ELSE deposit_amount - @discount END,
              updated_at = SYSDATETIME()
          WHERE reservation_id = @resId
        `);

      // Update Customer Promotion status
      await transaction.request()
        .input('promoId', sql.Int, customerPromotionId)
        .input('resId', sql.Int, reservationId)
        .query(`
          UPDATE dbo.CustomerPromotions
          SET status = N'used',
              used_at = SYSDATETIME(),
              used_in_reservation_id = @resId
          WHERE customer_promotion_id = @promoId
        `);
    }

    await transaction.commit();
    return res.json({ 
      success: true, 
      message: 'Promotion applied successfully.',
      discountAmount,
      newTotalAmount
    });
  } catch (err) {
    console.error('[LoyaltyController] applyPromotion error:', err);
    try {
      await transaction.rollback();
    } catch (rollErr) {}
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}
