import { profileRequestHeaders, request } from "@/core/api/httpClient.js";

/**
 * POST /api/customer/gift-cards/buy
 * @param {number} userId
 * @param {number} amount - 500000 | 1000000 | 2000000
 */
export async function buyGiftCard(userId, amount) {
  return request("/customer/gift-cards/buy", {
    method: "POST",
    headers: profileRequestHeaders(userId),
    body: JSON.stringify({ amount }),
  });
}
