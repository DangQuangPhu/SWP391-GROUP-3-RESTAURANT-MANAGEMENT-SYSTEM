import { request, profileRequestHeaders } from "@/core/api/httpClient.js";

export function createPreSaveReservation(payload, userId) {
  return request("/reservations/pre-save", {
    method: "POST",
    headers: profileRequestHeaders(userId),
    body: JSON.stringify(payload),
  });
}
