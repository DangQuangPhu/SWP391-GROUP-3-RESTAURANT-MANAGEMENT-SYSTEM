/* Phūrai — Staff Portal API wrapper. */

import { request, profileRequestHeaders } from "@/core/api/httpClient.js";
import {
  KITCHEN_TICKETS,
  QUEUE_RESERVATIONS,
  STAFF_KDS_DELAYED,
  STAFF_KDS_READY,
  STAFF_MENU_DISHES,
  STAFF_ORDERS,
  STAFF_REPORT_AUDIT,
  STAFF_REPORT_SUMMARY,
  getMockPaymentBill,
} from "@/shared/constants.js";
import { asArray } from "@/core/utils/asArray.js";

const MOCK_DELAY = 220;

const MOCK_GUEST_NAMES = [
  "Nguyen Van An",
  "Tran Thi Mai",
  "Le Hoang Duc",
  "Pham Minh Chau",
  "Hoang Thi Lan",
  "John Doe",
  "Sarah Miller",
  "Bao Nguyen",
  "Lan Anh",
  "Minh Khoa",
  "Thu Huong",
  "Dang Quang Phu",
  "Pham Thi Thuy",
  "Vo Minh Tuan",
  "Nguyen Minh An",
  "Emily Chen",
  "James Wilson",
  "Tran Van Hieu",
  "Le Thi Hong",
  "Pham Van Kiet",
];

const MOCK_TABLES = [
  { table_name: "T-01", area_name: "Standard Area" },
  { table_name: "T-02", area_name: "Standard Area" },
  { table_name: "T-03", area_name: "Standard Area" },
  { table_name: "T-04", area_name: "Standard Area" },
  { table_name: "T-05", area_name: "Window Area" },
  { table_name: "T-06", area_name: "Window Area" },
  { table_name: "VIP-01", area_name: "VIP Lounge" },
  { table_name: "VIP-02", area_name: "VIP Lounge" },
  { table_name: "PR-01", area_name: "Private Room" },
  { table_name: "PR-02", area_name: "Private Room" },
];

const MOCK_STATUS_CYCLE = [
  { reservation_status: "Pending", status: "pending" },
  { reservation_status: "Checked In", status: "checked_in" },
  { reservation_status: "Completed", status: "completed" },
];

/** Shift time slots for today's operational queue (local time). */
const MOCK_SHIFT_SLOTS = [
  ...[7, 0, 8, 15, 9, 30, 10, 0, 11, 30, 12, 0, 13, 30].reduce((slots, _, i, arr) => {
    if (i % 2 === 0) slots.push([arr[i], arr[i + 1]]);
    return slots;
  }, []),
  ...[14, 30, 15, 0, 16, 0, 16, 45, 17, 0, 17, 30].reduce((slots, _, i, arr) => {
    if (i % 2 === 0) slots.push([arr[i], arr[i + 1]]);
    return slots;
  }, []),
  ...[18, 0, 18, 45, 19, 30, 20, 0, 20, 45, 21, 15, 22, 30].reduce((slots, _, i, arr) => {
    if (i % 2 === 0) slots.push([arr[i], arr[i + 1]]);
    return slots;
  }, []),
];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function getTodayLocalParts(referenceDate = new Date()) {
  return {
    year: referenceDate.getFullYear(),
    month: referenceDate.getMonth(),
    day: referenceDate.getDate(),
    dateIso: `${referenceDate.getFullYear()}-${pad2(referenceDate.getMonth() + 1)}-${pad2(referenceDate.getDate())}`,
  };
}

function buildLocalReservationStartAt(hours, minutes, referenceDate = new Date()) {
  const { year, month, day } = getTodayLocalParts(referenceDate);
  return new Date(year, month, day, hours, minutes, 0, 0).toISOString();
}

function formatPhoneForMock(index) {
  const suffix = String(1000000 + index * 17391).slice(-7);
  return `09${suffix}`;
}

/**
 * Generate ~20 realistic reservations for today across morning, afternoon, and night.
 * IDs are 7-digit strings (0000101 … 0000120). Application-layer only — no SQL migrations.
 */
export function generateMockReservations(referenceDate = new Date()) {
  const { dateIso } = getTodayLocalParts(referenceDate);

  return MOCK_SHIFT_SLOTS.map(([hours, minutes], index) => {
    const sequence = 101 + index;
    const reservation_id = String(sequence).padStart(7, "0");
    const guestName = MOCK_GUEST_NAMES[index % MOCK_GUEST_NAMES.length];
    const table = MOCK_TABLES[index % MOCK_TABLES.length];
    const statusMeta = MOCK_STATUS_CYCLE[index % MOCK_STATUS_CYCLE.length];
    const guest_count = (index % 9) + 2;
    const start_time = `${pad2(hours)}:${pad2(minutes)}`;
    const hasTable = statusMeta.status !== "pending" || index % 3 !== 0;

    return {
      reservation_id,
      customer_id: null,
      customer_name: guestName,
      full_name: guestName,
      email: `${guestName.toLowerCase().replace(/\s+/g, ".")}@example.com`,
      phone: formatPhoneForMock(index),
      phone_number: formatPhoneForMock(index),
      reservation_start_at: buildLocalReservationStartAt(hours, minutes, referenceDate),
      reservation_end_at: buildLocalReservationStartAt(hours + 2, minutes, referenceDate),
      reservation_date: dateIso,
      start_time,
      guest_count,
      guest_count,
      area_name: table.area_name,
      table_id: hasTable ? 100 + index : null,
      table_number: hasTable ? table.table_name : null,
      table_name: hasTable ? table.table_name : "—",
      table_label: hasTable ? table.table_name : "—",
      assigned_tables: hasTable
        ? [{ table_id: 100 + index, table_number: table.table_name, capacity: guest_count }]
        : [],
      status: statusMeta.status,
      reservation_status: statusMeta.reservation_status,
      source: "online",
      reservation_source: "Online",
      special_request: index % 4 === 0 ? "Window seat preferred" : "",
      duration_minutes: 120,
      hold_duration_minutes: null,
      preorders: [],
      is_mock: true,
    };
  });
}

export function sortReservationsChronologically(rows) {
  return [...asArray(rows)].sort(
    (a, b) =>
      new Date(a?.reservation_start_at || 0).getTime() -
      new Date(b?.reservation_start_at || 0).getTime()
  );
}

function mergeAndSortReservations(apiRows, mockRows) {
  const byId = new Map();
  [...asArray(apiRows), ...asArray(mockRows)].forEach((row) => {
    if (!row) return;
    byId.set(String(row.reservation_id), row);
  });
  return sortReservationsChronologically([...byId.values()]);
}

function mock(data) {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ source: "mock", data }), MOCK_DELAY);
  });
}

async function staffGet(path, fallback, userId) {
  try {
    const res = await request(path, {
      method: "GET",
      headers: profileRequestHeaders(userId),
    });
    if (res?.success) {
      return { source: "api", data: res.data ?? fallback };
    }
  } catch {
    /* fall through to mock */
  }
  return mock(fallback);
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
export async function fetchTodayReservations(userId, startDate, endDate) {
  try {
    let url = `/staff/reservations/today-shift`;
    if (startDate && endDate) {
      url += `?startDate=${startDate}&endDate=${endDate}`;
    } else if (startDate) {
      url += `?startDate=${startDate}`;
    }

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
      };
    }
  } catch (error) {
    console.error("Fetch error:", error);
  }

  // No mock fallback — show empty state rather than fake data
  return { source: "api", data: [] };
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

export async function checkInStaffReservation(reservationId, userId, { table_id }) {
  const res = await staffPost(
    `/staff/reservations/${reservationId}/check-in`,
    userId,
    { table_id }
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
    `/staff/reservations/${reservationId}/edit`,
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
  const rows = Array.isArray(res.data) ? res.data : STAFF_ORDERS;
  const data = (Array.isArray(rows) ? rows : []).filter((o) => o.kitchen_status !== "done");
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
  const res = await staffGet(
    `/staff/payments/${tableId}`,
    getMockPaymentBill(tableId)
  );
  return { source: res.source, data: res.data };
}

export async function applyStaffVoucher(tableId, userId, voucherCode) {
  return staffPost(`/staff/payments/${tableId}/voucher`, userId, {
    voucher_code: voucherCode,
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
  const rows = Array.isArray(res.data) ? res.data : KITCHEN_TICKETS;
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
