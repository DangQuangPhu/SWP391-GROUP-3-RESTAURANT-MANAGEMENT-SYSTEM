/* Phūrai — Staff Portal API wrapper.
 * Zero mock data — all functions call live API endpoints.
 * On API failure, returns empty state instead of fallback mock data.
 */

import { request, profileRequestHeaders } from "@/core/api/httpClient.js";
import {
  KITCHEN_TICKETS,
  STAFF_KDS_DELAYED,
  STAFF_KDS_READY,
  STAFF_MENU_DISHES,
  STAFF_ORDERS,
  STAFF_REPORT_AUDIT,
  STAFF_REPORT_SUMMARY,
} from "@/shared/constants.js";
import { asArray } from "@/core/utils/asArray.js";

export function sortReservationsChronologically(rows) {
  return [...asArray(rows)].sort(
    (a, b) =>
      new Date(a?.reservation_start_at || 0).getTime() -
      new Date(b?.reservation_start_at || 0).getTime()
  );
}

/**
 * staffGet — calls the live API and returns { source: "api", data }.
 * On failure, returns empty data instead of falling back to mock.
 */
async function staffGet(path, emptyFallback, userId) {
  try {
    const res = await request(path, {
      method: "GET",
      headers: profileRequestHeaders(userId),
    });
    if (res?.success) {
      return { source: "api", data: res.data ?? emptyFallback };
    }
  } catch {
    /* API unavailable — return empty state, not fake data */
  }
  return { source: "api", data: emptyFallback };
}

async function staffPost(path, userId, body = {}) {
  const res = await request(path, {
    method: "POST",
    headers: profileRequestHeaders(userId, {
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(body),
  });
  return res;
}

export const createVnpayUrl = async (orderId, userId) => {
  return request("/payments/create_vnpay_url", {
    method: "POST",
    headers: profileRequestHeaders(userId, {
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ order_id: orderId }),
  });
};

export const checkOrderStatus = async (orderId) => {
  return request(`/payments/orders/${orderId}/status`, {
    method: "GET",
  });
};

async function staffPatch(path, userId, body = {}) {
  const res = await request(path, {
    method: "PATCH",
    headers: profileRequestHeaders(userId, {
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(body),
  });
  return res;
}

/** Normalize DB/API tokens (e.g. "Pending", "Checked In") to slug form. */
export function normalizeQueueToken(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

/** Queue eligibility: dbo.Reservations uses N'Pending' + N'Online'. */
export function isPendingOnlineReservation(reservation) {
  const statusRaw = String(
    reservation?.reservation_status ?? reservation?.status ?? ""
  ).trim();
  const sourceRaw = String(
    reservation?.reservation_source ?? reservation?.source ?? ""
  ).trim();

  const statusOk =
    statusRaw === "Pending" ||
    normalizeQueueToken(reservation?.status ?? reservation?.reservation_status) ===
    "pending";
  const sourceOk =
    sourceRaw === "Online" ||
    normalizeQueueToken(reservation?.source ?? reservation?.reservation_source) ===
    "online";

  return statusOk && sourceOk;
}

export async function fetchReservationQueue(userId) {
  const res = await staffGet("/staff/reservations/today-shift", [], userId);
  const rows = Array.isArray(res.data) ? res.data : [];
  const data = rows.filter(isPendingOnlineReservation);
  return { source: res.source, data };
}

export async function assignStaffTable(reservationId, userId, payload) {
  const res = await staffPost(`/staff/reservations/${reservationId}/assign-table`, userId, payload);
  if (!res?.success) {
    throw new Error(res?.message || "Failed to assign table");
  }
  return res;
}

/** Unwrap reservation array from API / service response shapes. */
export function unwrapReservationList(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return [];
}

/** Full today's reservation list for host check-in (all statuses). */
export async function fetchTodayReservations(userId, params = {}) {
  try {
    const queryStr = new URLSearchParams(params).toString();
    const url = `/manager/reservations/all?${queryStr}`;

    const res = await request(url, {
      method: "GET",
      headers: profileRequestHeaders(userId),
    });
    if (res?.success) {
      const apiRows = unwrapReservationList(res.reservations ?? res.data);
      return {
        source: "api",
        data: sortReservationsChronologically(apiRows),
        current_shift: res.current_shift,
        totalCount: res.totalCount,
        totalPages: res.totalPages,
        currentPage: res.currentPage
      };
    }
  } catch (error) {
    console.error("Fetch error:", error);
  }

  // No mock fallback — show empty state rather than fake data
  return { source: "api", data: [], totalCount: 0, totalPages: 1, currentPage: 1 };
}

/** Alias for fetchTodayReservations (legacy naming). */
export const getTodayReservations = fetchTodayReservations;

export async function fetchShiftMapping() {
  try {
    const res = await request("/staff/shift-mapping", { method: "GET" });
    if (res?.success && res.data && typeof res.data === "object" && !Array.isArray(res.data)) {
      return res.data;
    }
  } catch {
    /* ignore */
  }
  return {};
}

export async function checkInStaffReservation(reservationId, userId, data = {}) {
  const res = await staffPost(
    `/staff/reservations/${reservationId}/check-in`,
    userId,
    data
  );
  if (!res?.success) {
    throw new Error(res?.message || "Reservation check-in failed");
  }
  return res;
}

export async function fetchStaffReservationDetail(reservationId, userId) {
  const res = await request(`/staff/reservations/${reservationId}`, {
    method: "GET",
    headers: profileRequestHeaders(userId),
  });
  if (!res?.success) {
    throw new Error(res?.message || "Failed to fetch reservation detail");
  }
  return res.data;
}

export async function extendReservationErt(reservationId, userId, minutes) {
  const res = await staffPatch(
    `/staff/reservations/${reservationId}/extend-ert`,
    userId,
    { minutes }
  );
  if (!res?.success) {
    throw new Error(res?.message || "Failed to extend estimated release time");
  }
  return res.data;
}

export async function advanceTableStage(tableId, userId) {
  const res = await staffPatch(`/staff/tables/${tableId}/stage/advance`, userId, {});
  if (!res?.success) {
    throw new Error(res?.message || "Failed to advance table stage");
  }
  return res.data;
}

export async function confirmCheckoutReservation(reservationId, userId) {
  const res = await staffPatch(
    `/staff/reservations/${reservationId}/checkout-confirm`,
    userId,
    {}
  );
  if (!res?.success) {
    throw new Error(res?.message || "Checkout confirmation failed");
  }
  return res;
}

export async function sendReservationToKitchenQueue(reservationId, userId) {
  const res = await staffPost(
    `/staff/reservations/${reservationId}/send-cooking-queue`,
    userId,
    {}
  );
  if (!res?.success) {
    throw new Error(res?.message || "Failed to send preorder to kitchen");
  }
  return res;
}

export async function fetchReservationTimeline(reservationId, userId) {
  try {
    const res = await request(`/reservations/${reservationId}/timeline`, {
      method: "GET",
      headers: profileRequestHeaders(userId),
    });
    if (res?.success) return res.timeline ?? [];
  } catch (e) {
    console.error("[fetchReservationTimeline]", e?.message);
  }
  return [];
}

export async function rejectStaffReservation(reservationId, userId, { reason, new_status = "No Show" } = {}) {
  const res = await staffPatch(
    `/staff/reservations/${reservationId}/reject`,
    userId,
    { reason: reason || "No reason provided", new_status }
  );
  if (!res?.success) {
    throw new Error(res?.message || "Reservation rejection failed");
  }
  return res;
}

export async function editStaffReservation(reservationId, userId, payload) {
  const res = await staffPatch(
    `/staff/reservations/${reservationId}/direct-edit`,
    userId,
    payload
  );
  if (!res?.success) {
    throw new Error(res?.message || "Error updating reservation");
  }
  return res;
}

export async function fetchStaffTables(userId) {
  return staffGet("/staff/tables", [], userId);
}

/**
 * Create a Walk-in reservation immediately (Dining, no deposit, no voucher).
 * @param {number} userId  — authenticated staff user_id
 * @param {{ contact_name, contact_phone, contact_email, guest_count, table_id }} payload
 */
export async function createWalkInReservation(userId, payload) {
  const res = await staffPost("/staff/reservations/walk-in", userId, payload);
  if (!res?.success) {
    throw new Error(res?.message || "Failed to create walk-in reservation.");
  }
  return res;
}


export async function checkInStaffTable(tableId, userId) {
  return staffPost(`/staff/tables/${tableId}/check-in`, userId);
}

export async function resetStaffTable(tableId, userId) {
  return staffPost(`/staff/tables/${tableId}/reset`, userId);
}

export async function markStaffTableClean(tableId, userId) {
  const res = await request(`/staff/tables/${tableId}/status`, {
    method: "PATCH",
    headers: profileRequestHeaders(userId, {
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ status: "Available" })
  });
  if (!res?.success) throw new Error(res?.message || "Failed to mark table clean");
  return res;
}

export async function updateStaffTableStatusApi(tableId, status, userId) {
  const res = await request(`/staff/tables/${tableId}/status`, {
    method: "PATCH",
    headers: profileRequestHeaders(userId, {
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ status })
  });
  if (!res?.success) throw new Error(res?.message || "Failed to update table status");
  return res;
}

export async function deleteStaffTableApi(tableId, userId) {
  const res = await request(`/staff/tables/${tableId}`, {
    method: "DELETE",
    headers: profileRequestHeaders(userId),
  });
  if (!res?.success) throw new Error(res?.message || "Failed to delete table");
  return res;
}

export async function createVirtualTableApi(userId, payload = {}) {
  const res = await staffPost("/staff/tables/virtual", userId, payload);
  if (!res?.success) throw new Error(res?.message || "Failed to create virtual table");
  return res;
}

export async function mergeTablesApi(sourceId, targetId, userId) {
  const res = await staffPost(
    "/staff/tables/merge",
    userId,
    { source_table_id: sourceId, target_table_id: targetId }
  );
  if (!res?.success) throw new Error(res?.message || "Merge failed.");
  return res;
}

export async function unmergeTableApi(tableId, userId) {
  const res = await staffPost(
    "/staff/tables/unmerge",
    userId,
    { table_id: tableId }
  );
  if (!res?.success) throw new Error(res?.message || "Unmerge failed.");
  return res;
}

export async function fetchStaffOrders() {
  const res = await staffGet("/staff/orders/active", STAFF_ORDERS);
  const rows = Array.isArray(res.data) ? res.data : [];
  const data = rows.filter((o) => o.kitchen_status !== "done");
  return { source: res.source, data };
}

export async function fetchActiveStaffOrders() {
  const res = await staffGet("/staff/orders/active", { tables: [] });
  const tables = res.data?.tables ?? [];
  return { source: res.source, data: Array.isArray(tables) ? tables : [] };
}

export async function fetchStaffMenuDishes() {
  return staffGet("/staff/dishes/menu", STAFF_MENU_DISHES);
}

export async function addStaffOrderItem(tableId, userId, payload) {
  return staffPost(`/staff/orders/${tableId}/items`, userId, payload);
}

export async function updateStaffOrderItemStatus(itemId, userId, payload) {
  return staffPatch(`/staff/orders/items/${itemId}/status`, userId, payload);
}

export async function voidStaffOrderItem(itemId, userId) {
  return staffPatch(`/staff/orders/items/${itemId}/void`, userId, {});
}

export async function fetchStaffBill(tableId) {
  const res = await staffGet(`/staff/payments/${tableId}`, null);
  return { source: res.source, data: res.data };
}

export async function applyStaffPromoCode(tableId, userId, promoCode) {
  return staffPost(`/staff/payments/${tableId}/voucher`, userId, {
    promo_code: promoCode,
  });
}

export async function checkoutStaffPayment(tableId, userId, payload) {
  return staffPost(`/staff/payments/${tableId}/checkout`, userId, payload);
}

export async function voidStaffBill(tableId, userId) {
  return staffPost(`/staff/payments/${tableId}/void`, userId, {});
}

export async function splitOrderItemsApi(orderId, userId, items) {
  return staffPost(`/staff/orders/${orderId}/split-items`, userId, { items });
}

export async function fetchKitchenQueue() {
  const res = await staffGet("/staff/kitchen/queue", KITCHEN_TICKETS);
  const rows = Array.isArray(res.data) ? res.data : [];
  const data = rows.filter((t) => ["queued", "cooking", "ready"].includes(t.kitchen_status));
  return { source: res.source, data };
}

export async function fetchKdsReadyQueue() {
  return staffGet("/staff/kds/ready", STAFF_KDS_READY);
}

export async function fetchKdsDelayedItems() {
  return staffGet("/staff/kds/delayed", STAFF_KDS_DELAYED);
}

export async function fetchShiftReportSummary() {
  return staffGet("/staff/reports/summary", STAFF_REPORT_SUMMARY);
}

export async function fetchShiftReportAudit() {
  return staffGet("/staff/reports/audit", STAFF_REPORT_AUDIT);
}

/** PATCH /api/kitchen/tickets/:id/status — FSM ticket transition (Staff: Served, Sent To Kitchen, Cancel) */
export async function updateKitchenTicketFSM(ticketId, payload) {
  // payload: { new_status, cancel_reason?, expected_updated_at? }
  return staffPatch(`/kitchen/tickets/${ticketId}/status`, null, payload);
}

/** GET /api/kitchen/queue — full FSM kitchen queue (user-JWT Staff view) */
export async function fetchKitchenQueueFSM() {
  const FALLBACK = [];
  const res = await staffGet("/kitchen/queue", FALLBACK);
  return res;
}

export async function fetchOrderTimeline(orderId) {
  const res = await staffGet(`/staff/orders/${orderId}/timeline`, []);
  return { source: res.source, data: res.data };
}

export async function verifyCustomerEmailApi(email) {
  return request(`/staff/customers/verify?email=${encodeURIComponent(email)}`, {
    method: "GET",
  });
}

export async function fetchTableUpcomingReservations(tableId, userId, date) {
  try {
    const query = date ? `?date=${encodeURIComponent(date)}` : "";
    const res = await request(`/staff/tables/${tableId}/upcoming-reservations${query}`, {
      method: "GET",
      headers: profileRequestHeaders(userId),
    });
    if (res?.success) {
      return res.data ?? [];
    }
  } catch (err) {
    console.error("fetchTableUpcomingReservations failed:", err);
  }
  return [];
}

