import crypto from "node:crypto";
import sql from "mssql";
import { createDbRequest } from "../db.js";

/** Allowed fixed denominations (VND). */
export const GIFT_CARD_AMOUNTS = [500_000, 1_000_000, 2_000_000];

const GIFT_CARD_AMOUNT_SET = new Set(GIFT_CARD_AMOUNTS);
const PROMOTION_NAME = "Gift Card System";
const PROMO_CODE_PREFIX = "GIFT-";
const PROMO_CODE_SUFFIX_LENGTH = 10;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_CODE_ATTEMPTS = 8;

function isUniqueConstraintError(error) {
  const number = error?.number ?? error?.originalError?.number;
  if (number === 2627 || number === 2601) return true;
  const message = String(error?.message ?? "");
  return message.includes("UQ_PromoCodes_code") || /unique|duplicate/i.test(message);
}

function generatePromoCodeSuffix(length = PROMO_CODE_SUFFIX_LENGTH) {
  let suffix = "";
  for (let i = 0; i < length; i += 1) {
    suffix += CODE_CHARS[crypto.randomInt(0, CODE_CHARS.length)];
  }
  return suffix;
}

function buildGiftPromoCode() {
  return `${PROMO_CODE_PREFIX}${generatePromoCodeSuffix()}`;
}

async function findGiftCardPromotionId(amount) {
  const request = await createDbRequest();
  request.input("promotionName", sql.NVarChar(150), PROMOTION_NAME);
  request.input("discountValue", sql.Decimal(12, 2), amount);

  const result = await request.query(
    `SELECT TOP 1 promotion_id
     FROM dbo.Promotions
     WHERE promotion_name = @promotionName
       AND discount_type = N'Fixed'
       AND discount_value = @discountValue;`
  );

  return result.recordset[0]?.promotion_id ?? null;
}

async function createGiftCardPromotion(amount) {
  const startAt = new Date();
  const endAt = new Date(startAt);
  endAt.setFullYear(endAt.getFullYear() + 1);

  const request = await createDbRequest();
  request.input("promotionName", sql.NVarChar(150), PROMOTION_NAME);
  request.input(
    "description",
    sql.NVarChar(1000),
    `Fixed-value gift card (${amount.toLocaleString("en-US")} VND)`
  );
  request.input("discountValue", sql.Decimal(12, 2), amount);
  request.input("startAt", sql.DateTime2, startAt);
  request.input("endAt", sql.DateTime2, endAt);

  const result = await request.query(
    `INSERT INTO dbo.Promotions
       (promotion_name, description, discount_type, discount_value,
        min_order_value, max_discount, start_at, end_at, is_active, created_by_staff_id)
     OUTPUT INSERTED.promotion_id
     VALUES
       (@promotionName, @description, N'Fixed', @discountValue,
        0, NULL, @startAt, @endAt, 1, NULL);`
  );

  return result.recordset[0]?.promotion_id ?? null;
}

async function insertGiftPromoCode(promotionId, promoCode) {
  const request = await createDbRequest();
  request.input("promotionId", sql.Int, promotionId);
  request.input("promoCode", sql.NVarChar(40), promoCode);

  const result = await request.query(
    `INSERT INTO dbo.PromoCodes
       (promotion_id, promo_code, usage_limit, times_used, is_active)
     OUTPUT INSERTED.promo_code
     VALUES (@promotionId, @promoCode, 1, 0, 1);`
  );

  return result.recordset[0]?.promo_code ?? promoCode;
}

/**
 * POST /api/customer/gift-cards/buy
 * Creates a single-use fixed-value promo code backed by dbo.Promotions + dbo.PromoCodes.
 */
export async function buyGiftCard(req, res) {
  try {
    const amount = Number(req.body?.amount);

    if (!Number.isFinite(amount) || !GIFT_CARD_AMOUNT_SET.has(amount)) {
      return res.status(400).json({
        success: false,
        message: "Invalid gift card amount. Allowed values: 500000, 1000000, 2000000.",
      });
    }

    let promotionId = await findGiftCardPromotionId(amount);
    if (!promotionId) {
      promotionId = await createGiftCardPromotion(amount);
    }

    if (!promotionId) {
      return res.status(500).json({
        success: false,
        message: "Could not prepare gift card promotion.",
      });
    }

    let promoCode = null;
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
      const candidate = buildGiftPromoCode();
      try {
        promoCode = await insertGiftPromoCode(promotionId, candidate);
        break;
      } catch (error) {
        if (isUniqueConstraintError(error) && attempt < MAX_CODE_ATTEMPTS - 1) {
          continue;
        }
        throw error;
      }
    }

    if (!promoCode) {
      return res.status(500).json({
        success: false,
        message: "Could not generate promo code.",
      });
    }

    return res.json({
      success: true,
      promo_code: promoCode,
    });
  } catch (error) {
    console.error("POST /api/customer/gift-cards/buy failed:", error);
    return res.status(500).json({
      success: false,
      message: "Could not purchase gift card.",
    });
  }
}
