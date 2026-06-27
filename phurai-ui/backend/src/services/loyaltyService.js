import { getRawPool } from '../db.js';

/**
 * Calculates the exact points balance, total points earned, and total points redeemed for a customer.
 * Uses LoyaltyTransactions ledger as the single source of truth.
 * @param {number} customerId - The user ID of the customer (corresponding to UserAccounts.user_id)
 * @returns {Promise<{totalEarned: number, totalRedeemed: number, balance: number}>}
 */
export async function getCustomerBalance(customerId) {
  const pool = await getRawPool();
  const result = await pool.request()
    .input('customerId', customerId)
    .query(`
      SELECT
        ISNULL(SUM(CASE WHEN points > 0 THEN points END), 0) AS totalEarned,
        ISNULL(SUM(CASE WHEN points < 0 THEN -points END), 0) AS totalRedeemed,
        ISNULL(SUM(points), 0) AS balance
      FROM dbo.LoyaltyTransactions
      WHERE customer_id = @customerId
    `);
  return result.recordset[0] || { totalEarned: 0, totalRedeemed: 0, balance: 0 };
}
