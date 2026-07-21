import { request, profileRequestHeaders } from "@/core/api/httpClient.js";

/**
 * Retrieves the customer's loyalty balance statistics.
 * @param {string|number} userId 
 */
export async function getLoyaltyBalance(userId) {
  return await request('/loyalty/balance', {
    headers: profileRequestHeaders(userId),
  });
}

/**
 * Retrieves the catalog of active redeemable vouchers.
 * @param {string|number} userId 
 */
export async function getLoyaltyCatalog(userId) {
  return await request('/loyalty/catalog', {
    headers: profileRequestHeaders(userId),
  });
}

/**
 * Redeems loyalty points for a promotion template.
 * @param {string|number} userId 
 * @param {number} promotionTemplateId 
 */
export async function redeemPromotion(userId, promotionTemplateId) {
  return await request('/loyalty/redeem', {
    method: 'POST',
    headers: {
      ...profileRequestHeaders(userId),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ promotionTemplateId }),
  });
}

/**
 * Retrieves the list of promotions owned by the customer.
 * @param {string|number} userId 
 * @param {string} [status] - 'active' | 'used' | 'expired'
 */
export async function getMyPromotions(userId, status) {
  let url = '/loyalty/my-promotions';
  if (status) {
    url += `?status=${encodeURIComponent(status)}`;
  }
  return await request(url, {
    headers: profileRequestHeaders(userId),
  });
}

/**
 * Applies a customer promotion to an order or reservation.
 * @param {string|number} userId 
 * @param {object} payload - { customerPromotionId, orderId, reservationId }
 */
export async function applyPromotion(userId, payload) {
  return await request('/loyalty/apply-promotion', {
    method: 'POST',
    headers: {
      ...profileRequestHeaders(userId),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}
