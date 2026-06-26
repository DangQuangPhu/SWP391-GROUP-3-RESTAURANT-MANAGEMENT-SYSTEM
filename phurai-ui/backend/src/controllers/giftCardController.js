import crypto from "node:crypto";
import sql from "mssql";
import { createDbRequest } from "../db.js";

/** Allowed fixed denominations (VND). */
export const GIFT_CARD_AMOUNTS = [500_000, 1_000_000, 2_000_000];

const GIFT_CARD_AMOUNT_SET = new Set(GIFT_CARD_AMOUNTS);
const PROMOTION_NAME = "Gift Card System";
const VOUCHER_PREFIX = "GIFT-";
const VOUCHER_SUFFIX_LENGTH = 10;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_CODE_ATTEMPTS = 8;

function isUniqueConstraintError(error) {
  const number = error?.number ?? error?.originalError?.number;
  if (number === 2627 || number === 2601) return true;
  const message = String(error?.message ?? "");
  return message.includes("UQ_Vouchers_code") || /unique|duplicate/i.test(message);
}

function generateVoucherSuffix(length = VOUCHER_SUFFIX_LENGTH) {
  let suffix = "";
  for (let i = 0; i < length; i += 1) {
    suffix += CODE_CHARS[crypto.randomInt(0, CODE_CHARS.length)];
  }
  return suffix;
}

function buildGiftVoucherCode() {
  return `${VOUCHER_PREFIX}${generateVoucherSuffix()}`;
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

async function insertGiftVoucher(promotionId, voucherCode) {
  const request = await createDbRequest();
  request.input("promotionId", sql.Int, promotionId);
  request.input("voucherCode", sql.NVarChar(40), voucherCode);

  const result = await request.query(
    `INSERT INTO dbo.Vouchers
       (promotion_id, voucher_code, usage_limit, times_used, is_active)
     OUTPUT INSERTED.voucher_code
     VALUES (@promotionId, @voucherCode, 1, 0, 1);`
  );

  return result.recordset[0]?.voucher_code ?? voucherCode;
}

/**
 * POST /api/customer/gift-cards/buy
 * Creates a single-use fixed-value voucher backed by dbo.Promotions + dbo.Vouchers.
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

    let voucherCode = null;
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
      const candidate = buildGiftVoucherCode();
      try {
        voucherCode = await insertGiftVoucher(promotionId, candidate);
        break;
      } catch (error) {
        if (isUniqueConstraintError(error) && attempt < MAX_CODE_ATTEMPTS - 1) {
          continue;
        }
        throw error;
      }
    }

    if (!voucherCode) {
      return res.status(500).json({
        success: false,
        message: "Could not generate voucher code.",
      });
    }

    return res.json({
      success: true,
      voucher_code: voucherCode,
    });
  } catch (error) {
    console.error("POST /api/customer/gift-cards/buy failed:", error);
    return res.status(500).json({
      success: false,
      message: "Could not purchase gift card.",
    });
  }
}
