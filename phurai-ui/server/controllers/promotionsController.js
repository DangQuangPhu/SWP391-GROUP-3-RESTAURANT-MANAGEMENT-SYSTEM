import { getRawPool } from "../db.js";
import sql from "mssql";

export const getAllPromotions = async (req, res) => {
  try {
    const pool = await getRawPool();
    const result = await pool.request().query(`
      SELECT 
        promotion_id, promo_code, discount_type, discount_value, 
        max_discount_amount, min_order_value, valid_from, 
        valid_until, usage_limit, used_count, is_active, 
        created_at, updated_at
      FROM dbo.Promotions
      ORDER BY created_at DESC
    `);
    
    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error("Error fetching promotions:", error);
    res.status(500).json({ success: false, message: "Failed to fetch promotions" });
  }
};

export const createPromotion = async (req, res) => {
  try {
    const { 
      promo_code, discount_type, discount_value, max_discount_amount, 
      min_order_value, valid_from, valid_until, usage_limit 
    } = req.body;

    if (!promo_code || !discount_type || discount_value === undefined || !valid_from || !valid_until) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    if (isNaN(discount_value) || discount_value <= 0) {
      return res.status(400).json({ success: false, message: "Discount value must be a positive number" });
    }

    if (discount_type === 'PERCENT' && discount_value > 100) {
      return res.status(400).json({ success: false, message: "Percentage discount cannot exceed 100%" });
    }

    const pool = await getRawPool();

    // Check uniqueness
    const checkResult = await pool.request()
      .input('promo_code', sql.VarChar(50), promo_code)
      .query(`SELECT promotion_id FROM dbo.Promotions WHERE promo_code = @promo_code`);
      
    if (checkResult.recordset.length > 0) {
      return res.status(409).json({ success: false, message: "Promotion code already exists" });
    }

    const result = await pool.request()
      .input('promo_code', sql.VarChar(50), promo_code)
      .input('discount_type', sql.VarChar(20), discount_type)
      .input('discount_value', sql.Decimal(12, 2), discount_value)
      .input('max_discount_amount', sql.Decimal(12, 2), max_discount_amount || null)
      .input('min_order_value', sql.Decimal(12, 2), min_order_value || 0)
      .input('valid_from', sql.DateTime2, valid_from)
      .input('valid_until', sql.DateTime2, valid_until)
      .input('usage_limit', sql.Int, usage_limit || null)
      .query(`
        INSERT INTO dbo.Promotions (
          promo_code, discount_type, discount_value, max_discount_amount, 
          min_order_value, valid_from, valid_until, usage_limit, is_active, 
          used_count, created_at, updated_at
        )
        OUTPUT inserted.*
        VALUES (
          @promo_code, @discount_type, @discount_value, @max_discount_amount,
          @min_order_value, @valid_from, @valid_until, @usage_limit, 1,
          0, SYSDATETIME(), SYSDATETIME()
        )
      `);

    res.status(201).json({
      success: true,
      message: "Promotion created successfully",
      data: result.recordset[0]
    });
  } catch (error) {
    console.error("Error creating promotion:", error);
    res.status(500).json({ success: false, message: "Failed to create promotion" });
  }
};

export const togglePromotionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getRawPool();
    
    // Toggle logic: is_active = is_active ^ 1
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        UPDATE dbo.Promotions 
        SET is_active = is_active ^ 1, updated_at = SYSDATETIME()
        OUTPUT inserted.is_active
        WHERE promotion_id = @id
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ success: false, message: "Promotion not found" });
    }

    res.json({
      success: true,
      message: "Promotion status updated",
      is_active: result.recordset[0].is_active
    });
  } catch (error) {
    console.error("Error toggling promotion status:", error);
    res.status(500).json({ success: false, message: "Failed to update promotion status" });
  }
};

export const deletePromotion = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getRawPool();
    
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        DELETE FROM dbo.Promotions
        WHERE promotion_id = @id
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ success: false, message: "Promotion not found" });
    }

    res.json({
      success: true,
      message: "Promotion deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting promotion:", error);
    if (error.number === 547) {
      // Foreign key constraint violation
      return res.status(409).json({ success: false, message: "Cannot delete promotion because it is referenced in other records." });
    }
    res.status(500).json({ success: false, message: "Failed to delete promotion" });
  }
};

/**
 * CUSTOMER API: Validate Promo Code
 * Endpoint: GET /api/promotions/validate/:code?order_value=100000
 */
export const validatePromoCode = async (req, res) => {
  try {
    const { code } = req.params;
    const { order_value } = req.query;

    const result = await checkPromoValidity(code, order_value);
    
    if (!result.isValid) {
      return res.status(400).json({ success: false, message: result.message });
    }

    return res.json({
      success: true,
      data: result.promo
    });
  } catch (error) {
    console.error("Error validating promotion:", error);
    res.status(500).json({ success: false, message: "Failed to validate promotion" });
  }
};

/**
 * Shared utility to validate a promo code
 * @param {string} code - The promo code
 * @param {number} orderValue - The current cart/order total
 * @returns {object} { isValid: boolean, message?: string, promo?: object }
 */
export const checkPromoValidity = async (code, orderValue) => {
  if (!code) return { isValid: false, message: "No code provided" };
  const val = parseFloat(orderValue) || 0;

  const pool = await getRawPool();
  const result = await pool.request()
    .input('promo_code', sql.VarChar(50), code)
    .query(`
      SELECT promotion_id, promo_code, discount_type, discount_value, max_discount_amount, min_order_value, usage_limit, used_count
      FROM dbo.Promotions 
      WHERE promo_code = @promo_code 
        AND is_active = 1 
        AND valid_from <= SYSDATETIME() 
        AND valid_until >= SYSDATETIME()
    `);

  if (result.recordset.length === 0) {
    return { isValid: false, message: "Invalid or expired promo code." };
  }

  const promo = result.recordset[0];

  if (promo.usage_limit && promo.used_count >= promo.usage_limit) {
    return { isValid: false, message: "This promo code has reached its usage limit." };
  }

  if (val < parseFloat(promo.min_order_value)) {
    return { isValid: false, message: `Order minimum of ${promo.min_order_value} required.` };
  }

  return { isValid: true, promo };
};
