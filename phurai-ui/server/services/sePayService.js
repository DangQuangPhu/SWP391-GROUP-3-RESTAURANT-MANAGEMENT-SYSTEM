/**
 * SePay Transaction Service
 * 
 * Actively polls SePay's User API to verify payment transactions.
 * This is MORE reliable than waiting for webhooks alone — it verifies
 * the actual bank transaction has occurred.
 * 
 * Requires SEPAY_USER_TOKEN in server/.env
 * Get it from: https://my.sepay.vn → Settings → API Token
 */

const SEPAY_API_BASE = 'https://my.sepay.vn/userapi';

/**
 * Fetch recent transactions from SePay API
 * @param {Object} options
 * @param {number} options.limit - max transactions to return (default 20)
 * @param {string} options.since - ISO date string to filter transactions after
 * @returns {Promise<Array>} list of transactions
 */
export async function fetchRecentTransactions({ limit = 20, since = null } = {}) {
  const token = process.env.SEPAY_USER_TOKEN;
  if (!token) {
    throw new Error('SEPAY_USER_TOKEN not configured in .env');
  }

  let url = `${SEPAY_API_BASE}/transactions/list?limit=${limit}`;
  if (since) {
    url += `&transaction_date_min=${encodeURIComponent(since)}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`SePay API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.transactions || [];
}

/**
 * Check if a specific order_code has been paid via SePay
 * Searches recent transactions for content matching the order code
 * 
 * @param {string} orderCode - e.g. "PHURAI960835"
 * @param {number} expectedAmount - the deposit amount in VND
 * @returns {Promise<{found: boolean, transaction?: Object}>}
 */
export async function checkPaymentReceived(orderCode, expectedAmount) {
  try {
    // Look back at last 30 minutes of transactions
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const transactions = await fetchRecentTransactions({ limit: 50, since });

    console.log(`[SePay] Checking ${transactions.length} recent transactions for order ${orderCode}`);

    for (const txn of transactions) {
      const content = (txn.transaction_content || txn.content || '').toUpperCase();
      const code = orderCode.toUpperCase();

      if (content.includes(code)) {
        const amount = parseFloat(txn.amount_in || txn.transfer_amount || 0);
        console.log(`[SePay] Found matching transaction: content="${txn.transaction_content}", amount=${amount}, expected=${expectedAmount}`);

        if (amount + 0.01 >= parseFloat(expectedAmount)) {
          return { found: true, transaction: txn };
        } else {
          console.warn(`[SePay] Amount mismatch: received ${amount}, expected ${expectedAmount}`);
          return { found: false, reason: 'insufficient_amount', transaction: txn };
        }
      }
    }

    return { found: false, reason: 'not_found' };
  } catch (err) {
    console.error('[SePay] checkPaymentReceived error:', err.message);
    throw err;
  }
}

/**
 * Get bank account list from SePay (for diagnostics)
 */
export async function getBankAccounts() {
  const token = process.env.SEPAY_USER_TOKEN;
  if (!token) throw new Error('SEPAY_USER_TOKEN not configured');

  const response = await fetch(`${SEPAY_API_BASE}/bankaccounts/list`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  const data = await response.json();
  return data.bankaccounts || [];
}
