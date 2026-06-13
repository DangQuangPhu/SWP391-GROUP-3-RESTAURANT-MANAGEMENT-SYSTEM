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

export function createReservation(payload, userId) {
  return request("/reservations", {
    method: "POST",
    headers: profileRequestHeaders(userId),
    body: JSON.stringify(payload),
  });
}

export function getMyReservations(userId) {
  return request("/reservations/my", {
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
