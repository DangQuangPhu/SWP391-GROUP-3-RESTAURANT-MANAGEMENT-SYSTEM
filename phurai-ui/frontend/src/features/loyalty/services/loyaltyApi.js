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
 * Redeems loyalty points for a voucher template.
 * @param {string|number} userId 
 * @param {number} voucherTemplateId 
 */
export async function redeemVoucher(userId, voucherTemplateId) {
  return await request('/loyalty/redeem', {
    method: 'POST',
    headers: {
      ...profileRequestHeaders(userId),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ voucherTemplateId }),
  });
}

/**
 * Retrieves the list of vouchers owned by the customer.
 * @param {string|number} userId 
 * @param {string} [status] - 'active' | 'used' | 'expired'
 */
export async function getMyVouchers(userId, status) {
  let url = '/loyalty/my-vouchers';
  if (status) {
    url += `?status=${encodeURIComponent(status)}`;
  }
  return await request(url, {
    headers: profileRequestHeaders(userId),
  });
}

/**
 * Applies a customer voucher to an order or reservation.
 * @param {string|number} userId 
 * @param {object} payload - { customerVoucherId, orderId, reservationId }
 */
export async function applyVoucher(userId, payload) {
  return await request('/loyalty/apply-voucher', {
    method: 'POST',
    headers: {
      ...profileRequestHeaders(userId),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}
