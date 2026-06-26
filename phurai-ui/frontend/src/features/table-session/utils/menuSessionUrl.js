/**
 * Build menu deep-link path for QR payload (supports /menu alias → /menus).
 */
export function buildMenuSessionPath(tableId, sessionId) {
  const params = new URLSearchParams({
    table_id: String(tableId),
    session_id: String(sessionId),
  });
  return `/menu?${params.toString()}`;
}

export function buildMenuSessionUrl(tableId, sessionId) {
  const path = buildMenuSessionPath(tableId, sessionId);
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
}

export function buildQrImageUrl(payloadUrl, size = 240) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(payloadUrl)}`;
}
