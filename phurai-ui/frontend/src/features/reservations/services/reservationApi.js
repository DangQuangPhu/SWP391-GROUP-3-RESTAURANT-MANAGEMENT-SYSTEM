import { request, profileRequestHeaders } from "@/core/api/httpClient.js";

/**
 * Reservation API client.
 * All booking logic is enforced on the backend (SQL Server, transactional);
 * these helpers only shape requests and forward the logged-in user id.
 */

export function getReservationSettings() {
  return request("/reservations/settings", { method: "GET" });
}

export function getAvailability({
  date,
  time,
  durationMinutes = 120,
  guestCount = 1,
  areaType,
  eventType,
} = {}) {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  if (time) params.set("time", time);
  params.set("durationMinutes", String(durationMinutes));
  params.set("guestCount", String(guestCount));
  if (areaType) params.set("areaType", areaType);
  if (eventType) params.set("eventType", eventType);

  return request(`/reservations/availability?${params.toString()}`, {
    method: "GET",
  });
}

export function createReservationVnpayUrl(reservationId, amount) {
  return request("/reservations/create_vnpay_url", {
    method: "POST",
    body: JSON.stringify({ reservation_id: reservationId, amount }),
  });
}

export function getReservationPaymentStatus(txnRef) {
  return request(`/reservations/status?txn_ref=${encodeURIComponent(txnRef)}`);
}

export function createReservation(payload, userId) {
  return request("/reservations", {
    method: "POST",
    headers: profileRequestHeaders(userId),
    body: JSON.stringify(payload),
  });
}

// BUST VITE CACHE
export function createPreSaveReservation(payload, userId) {
  return request("/reservations/pre-save", {
    method: "POST",
    headers: profileRequestHeaders(userId),
    body: JSON.stringify(payload),
  });
}

export function getMyReservations(userId, { date } = {}) {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  const query = params.toString();

  return request(`/reservations/my${query ? `?${query}` : ""}`, {
    method: "GET",
    headers: profileRequestHeaders(userId),
  });
}

export function cancelReservation(reservationId, userId, cancelReason) {
  return request(`/reservations/${reservationId}/cancel`, {
    method: "PATCH",
    headers: profileRequestHeaders(userId),
    body: JSON.stringify({ cancel_reason: cancelReason }),
  });
}

/* --- Optional Phase 2: pre-order --------------------------------- */

export function getPreorderMenu() {
  return request("/reservations/menu", { method: "GET" });
}

/**
 * Replace a reservation's pre-order list.
 * items: [{ dish_id, quantity, notes? }] — pass [] to clear.
 */
export function savePreorder(reservationId, items, userId) {
  return request(`/reservations/${reservationId}/preorder`, {
    method: "POST",
    headers: profileRequestHeaders(userId),
    body: JSON.stringify({ items }),
  });
}

/* --- Flow B: Customer edit/cancel requests ----------------------- */

/**
 * Submit an edit request for a Confirmed booking.
 * The booking stays Confirmed; manager reviews the pending_changes_json.
 */
export function requestEdit(reservationId, userId, changes) {
  return request(`/reservations/${reservationId}/request-edit`, {
    method: "POST",
    headers: profileRequestHeaders(userId),
    body: JSON.stringify({ changes }),
  });
}

export function getUpgradeQuoteApi(reservationId, userId, payload) {
  return request(`/reservations/${reservationId}/upgrade-quote`, {
    method: "POST",
    headers: profileRequestHeaders(userId),
    body: JSON.stringify(payload),
  });
}

export function verifyUpgradePaymentApi(reservationId, userId, payload) {
  return request(`/reservations/${reservationId}/verify-upgrade`, {
    method: "POST",
    headers: profileRequestHeaders(userId),
    body: JSON.stringify(payload),
  });
}

/**
 * Submit a cancellation request for a Confirmed booking.
 * The booking stays Confirmed until the manager processes it.
 */
export function requestCancel(reservationId, userId, cancelReason) {
  return request(`/reservations/${reservationId}/request-cancel`, {
    method: "POST",
    headers: profileRequestHeaders(userId),
    body: JSON.stringify({ cancel_reason: cancelReason || null }),
  });
}

export function submitReview(reservationId, payload, userId) {
  return request(`/reservations/${reservationId}/review`, {
    method: "POST",
    headers: profileRequestHeaders(userId),
    body: JSON.stringify(payload),
  });
}
