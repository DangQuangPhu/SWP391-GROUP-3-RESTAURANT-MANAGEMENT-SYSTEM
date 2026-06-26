import { profileRequestHeaders, request } from "@/core/api/httpClient.js";
// Force Vite HMR Cache Bust: 2026-06-22


/**
 * GET /api/customer/qr-sessions/active
 * @param {number} userId
 */
export async function fetchActiveQrSession(userId) {
  return request("/customer/qr-sessions/active", {
    method: "GET",
    headers: profileRequestHeaders(userId),
  });
}

/**
 * GET /api/customer/qr-sessions/validate?table_id=&session_id=
 */
export async function validateQrSession(tableId, sessionId) {
  const params = new URLSearchParams({
    table_id: String(tableId),
    session_id: String(sessionId),
  });
  return request(`/customer/qr-sessions/validate?${params.toString()}`, {
    method: "GET",
  });
}

/**
 * GET /api/customer/qr-sessions/scan/:qr_code
 */
export async function scanStaticQrCode(qrCode) {
  return request(`/customer/qr-sessions/scan/${qrCode}`, {
    method: "GET",
  });
}
