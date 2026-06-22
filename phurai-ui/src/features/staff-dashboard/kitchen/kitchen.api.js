import { request, profileRequestHeaders } from "@/core/api/httpClient.js";

/**
 * Fetch the current kitchen queue.
 * Requires Kitchen Staff token or X-User-Id header for dev.
 */
export async function fetchKitchenQueue(userId) {
  return await request("/kitchen/queue", {
    method: "GET",
    headers: profileRequestHeaders(userId)
  });
}

/**
 * Update the status of a ticket in the kitchen.
 * Valid transitions: 'Pending' -> 'Preparing', 'Preparing' -> 'Ready'
 */
export async function updateTicketStatus(ticketId, newStatus, userId) {
  return await request(`/kitchen/tickets/${ticketId}/status`, {
    method: "PATCH",
    headers: profileRequestHeaders(userId, { "Content-Type": "application/json" }),
    body: JSON.stringify({ new_status: newStatus, triggered_by: "touch" }),
  });
}

/**
 * Cancel a ticket from the kitchen queue.
 */
export async function cancelTicket(ticketId, reason, userId) {
  return await request(`/kitchen/tickets/${ticketId}/status`, {
    method: "PATCH",
    headers: profileRequestHeaders(userId, { "Content-Type": "application/json" }),
    body: JSON.stringify({ new_status: "Cancelled", cancel_reason: reason, triggered_by: "touch" }),
  });
}
