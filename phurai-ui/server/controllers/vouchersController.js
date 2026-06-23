import { getRawPool } from "../db.js";
import sql from "mssql";

/**
 * CUSTOMER API: Validate & Apply Voucher Code
 * Endpoint: POST /api/vouchers/apply
 * Payload: { voucher_code, cart_total }
 */
export const applyVoucher = async (req, res) => {
  try {
    const { voucher_code, cart_total } = req.body;
    
    if (!voucher_code || typeof cart_total === 'undefined') {
      return res.status(400).json({ success: false, message: "Missing voucher_code or cart_total" });
    }

    const result = await checkVoucherValidity(voucher_code, cart_total);
    
    if (!result.isValid) {
      return res.status(400).json({ success: false, message: result.message });
    }

    return res.json({
      success: true,
      discount_amount: result.discount_amount,
      final_total: cart_total - result.discount_amount,
      promotion_name: result.promo.promotion_name
    });
  } catch (error) {
    console.error("Error applying voucher:", error);
    res.status(500).json({ success: false, message: "Failed to apply voucher" });
  }
};

/**
 * Shared utility to validate a voucher code and calculate the discount.
 * Enforces the 4-stage strict checkpoints against the database.
 * 
 * @param {string} code - The voucher code (case-insensitive)
 * @param {number} orderValue - The current cart/order total
 * @returns {object} { isValid: boolean, message?: string, promo?: object, discount_amount?: number }
 */
export const checkVoucherValidity = async (code, orderValue) => {
  if (!code) return { isValid: false, message: "No code provided." };
  const val = parseFloat(orderValue) || 0;

  const pool = await getRawPool();
  
  // Stage 1: Look up voucher and eager load promotion
  const result = await pool.request()
    .input('voucher_code', sql.NVarChar(40), code)
    .query(`
      SELECT 
        v.voucher_id, v.voucher_code, v.usage_limit, v.times_used, v.is_active AS voucher_active,
        p.promotion_id, p.promotion_name, p.discount_type, p.discount_value, 
        p.min_order_value, p.max_discount, p.start_at, p.end_at, p.is_active AS promo_active
      FROM dbo.Vouchers v
      INNER JOIN dbo.Promotions p ON v.promotion_id = p.promotion_id
      WHERE v.voucher_code = @voucher_code
    `);

  if (result.recordset.length === 0) {
    return { isValid: false, message: "Invalid voucher code." };
  }

  const data = result.recordset[0];

  // Stage 2: Check is_active
  if (!data.voucher_active || !data.promo_active) {
    return { isValid: false, message: "This voucher is no longer active." };
  }

  // Stage 3: Timeline Check (Current timestamp must be between start_at and end_at)
  const now = new Date();
  if (now < new Date(data.start_at) || now > new Date(data.end_at)) {
    return { isValid: false, message: "This voucher is expired or not yet active." };
  }

  // Stage 4: Limits Check
  if (data.times_used >= data.usage_limit) {
    return { isValid: false, message: "This voucher has reached its usage limit." };
  }

  // Stage 5: Minimum Order Value Check
  if (val < parseFloat(data.min_order_value)) {
    return { isValid: false, message: `A minimum order value of ${data.min_order_value} is required.` };
  }

  // Secure Calculation Logic
  let discount = 0;
  const discountValue = parseFloat(data.discount_value);

  if (data.discount_type === 'Fixed') {
    discount = discountValue;
  } else if (data.discount_type === 'Percent') {
    discount = (val * discountValue) / 100;
  } else {
    return { isValid: false, message: "Invalid discount type configuration." };
  }

  // Cap maximum discount
  if (data.max_discount !== null) {
    const maxDiscount = parseFloat(data.max_discount);
    if (discount > maxDiscount) {
      discount = maxDiscount;
    }
  }

  // Ensure discount does not exceed cart_total
  if (discount > val) {
    discount = val;
  }

  // Ensure precision
  discount = Math.round(discount * 100) / 100;

  return { isValid: true, promo: data, discount_amount: discount };
};
