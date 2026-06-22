/* ============================================================
   Phūrai — Manager/Manager Dashboard API wrapper
   ------------------------------------------------------------
   Calls /api/staff/* endpoints backed by SQL Server. Falls back
   to schema-aligned sample data when the API is unreachable.

   Every getter resolves to: { source: "api" | "mock", data }
   ============================================================ */

import { request, profileRequestHeaders, createApiError, loadAuthUser } from "@/core/api/httpClient.js";
import { asArray } from "@/utils/asArray.js";
import {
  KPI_CARDS,
  REVENUE_SERIES,
  RESERVATIONS,
  DISHES,
  BEST_SELLERS,
  ORDERS,
  MANAGER,
  STAFF_ASSIGNABLE_ROLES,
  PROMOTIONS,
  RESERVATION_STATS,
  TABLE_UTILIZATION,
} from "@/shared/constants.js";

const MOCK_DELAY = 220;

function mock(data) {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ source: "mock", data }), MOCK_DELAY);
  });
}

async function managerGet(path, fallback) {
  try {
    const res = await request(path, { method: "GET" });
    if (res?.success) {
      return { source: "api", data: res.data ?? fallback };
    }
  } catch { console.error("fetch API ERROR", arguments);
    /* fall through to mock */
  }
  return mock(fallback);
}

let overviewCache = null;

async function fetchOverview() {
  if (overviewCache) return overviewCache;
  overviewCache = managerGet("/staff/overview", {
    kpis: KPI_CARDS,
    reservationStats: RESERVATION_STATS,
    tableUtilization: TABLE_UTILIZATION,
  });
  return overviewCache;
}

/* ---- Read getters ---------------------------------------------- */

export async function fetchKpis() {
  const res = await fetchOverview();
  if (res.source === "api" && res.data?.kpis) {
    return { source: "api", data: res.data.kpis };
  }
  return res.source === "mock"
    ? res
    : mock(res.data?.kpis?.length ? res.data.kpis : KPI_CARDS);
}

export async function fetchRevenueSeries() {
  const res = await managerGet("/staff/reports/revenue", { series: REVENUE_SERIES });
  if (res.source === "api") {
    return { source: "api", data: res.data?.series ?? REVENUE_SERIES };
  }
  return res;
}

export function sortReservationsChronologically(rows) {
  return [...asArray(rows)].sort(
    (a, b) =>
      new Date(a?.reservation_start_at || 0).getTime() -
      new Date(b?.reservation_start_at || 0).getTime()
  );
}


export async function fetchPendingReservations(userId) {
  try {
    const res = await managerAuthRequest("/manager/reservations/pending", { method: "GET" }, userId);
    if (res?.success) {
      return { source: "api", data: sortReservationsChronologically(res.reservations ?? []) };
    }
  } catch { console.error("fetch API ERROR", arguments);
    /* fall through */
  }
  return mock(RESERVATIONS.filter(r => r.reservation_status === 'Pending'));
}

export async function fetchAllReservations(userId) {
  try {
    const res = await managerAuthRequest("/manager/reservations/all", { method: "GET" }, userId);
    if (res?.success) {
      return { source: "api", data: sortReservationsChronologically(res.reservations ?? []) };
    }
  } catch { console.error("fetch API ERROR", arguments);
    /* fall through */
  }
  return mock(RESERVATIONS);
}

export async function getAllReservations(userId) {
  const res = await managerAuthRequest(
    `/manager/reservations/all`,
    { method: "GET" },
    userId
  );
  if (!res?.success) {
    throw createApiError(res?.message || "Could not fetch reservations.");
  }
  return res.reservations;
}

export async function confirmReservation(reservationId, tableIds, userId) {
  const res = await managerAuthRequest(
    `/manager/reservations/${reservationId}/confirm`,
    {
      method: "PATCH",
      body: JSON.stringify({ table_ids: tableIds }),
    },
    userId
  );
  if (!res?.success) {
    throw createApiError(res?.message || "Could not confirm reservation.");
  }
  return res.data;
}

export async function rejectReservation(reservationId, reason, userId) {
  const res = await managerAuthRequest(
    `/manager/reservations/${reservationId}/reject`,
    {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    },
    userId
  );
  if (!res?.success) {
    throw createApiError(res?.message || "Could not reject reservation.");
  }
  return res;
}

export async function cancelReservation(reservationId, reason, userId) {
  const res = await managerAuthRequest(
    `/manager/reservations/${reservationId}/cancel`,
    {
      method: "PATCH",
      body: JSON.stringify({ cancel_reason: reason }),
    },
    userId
  );
  if (!res?.success) {
    throw createApiError(res?.message || "Could not cancel reservation.");
  }
  return res;
}

export async function getReservationDetails(reservationId, userId) {
  const res = await managerAuthRequest(
    `/manager/reservations/${reservationId}`,
    { method: "GET" },
    userId
  );
  if (!res?.success) {
    throw createApiError(res?.message || "Could not fetch reservation details.");
  }
  return res.data;
}

export async function getReservationHistory(reservationId, userId) {
  const res = await managerAuthRequest(
    `/manager/reservations/${reservationId}/history`,
    { method: "GET" },
    userId
  );
  if (!res?.success) {
    throw createApiError(res?.message || "Could not fetch reservation history.");
  }
  return res.history;
}

export async function updateReservation(reservationId, payload, userId) {
  const res = await managerAuthRequest(
    `/manager/reservations/${reservationId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    userId
  );
  if (!res?.success) {
    throw createApiError(res?.message || "Could not update reservation.");
  }
  return res.data;
}

export async function resolveEditRequest(reservationId, decision, rejectReason, userId) {
  const res = await managerAuthRequest(
    `/manager/reservations/${reservationId}/resolve-edit`,
    {
      method: "POST",
      body: JSON.stringify({ decision, reject_reason: rejectReason || "" }),
    },
    userId
  );
  if (!res?.success) {
    throw createApiError(res?.message || "Could not resolve edit request.");
  }
  return res;
}

export async function seedTestReservations(userId) {
  const res = await managerAuthRequest(
    "/manager/mock-data/seed",
    { method: "POST" },
    userId
  );
  if (!res?.success) {
    throw createApiError(res?.message || "Could not add test reservations.");
  }
  return res;
}

export async function clearTestReservations(userId) {
  const res = await managerAuthRequest(
    "/manager/mock-data/purge",
    { method: "DELETE" },
    userId
  );
  if (!res?.success) {
    throw createApiError(res?.message || "Could not clear test reservations.");
  }
  return res;
}

export function fetchTables() {
  return managerGet("/staff/tables/status", []).then((res) => ({
    ...res,
    data: asArray(res.data),
  }));
}

export function fetchDishes() {
  return managerGet("/menu", DISHES).then((res) => {
    const data = asArray(res.data).map(d => ({
      ...d,
      dish_name: d.dish_name || d.name,
      category_name: d.category_name || d.category,
      prep_minutes: d.prep_minutes !== undefined ? d.prep_minutes : (d.prep_time_minutes || 0)
    }));
    return {
      ...res,
      data,
    };
  });
}

export async function addDish(payload, userId) {
  const res = await managerAuthRequest("/manager/menu", {
    method: "POST",
    body: JSON.stringify(payload)
  }, userId);
  if (!res?.success) throw createApiError(res?.message || "Could not add dish");
  return res;
}

export async function updateDish(dishId, payload, userId) {
  const res = await managerAuthRequest(`/manager/menu/${dishId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  }, userId);
  if (!res?.success) throw createApiError(res?.message || "Could not update dish");
  return res;
}

export async function deleteDish(dishId, userId) {
  const res = await managerAuthRequest(`/manager/menu/${dishId}`, {
    method: "DELETE"
  }, userId);
  if (!res?.success) throw createApiError(res?.message || "Could not delete dish");
  return res;
}

export function fetchBestSellers() {
  return managerGet("/staff/best-selling", BEST_SELLERS).then((res) => ({
    ...res,
    data: asArray(res.data),
  }));
}

export async function updateTableApi(tableId, payload, userId) {
  const res = await managerAuthRequest(
    `/manager/tables/${tableId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    userId
  );
  if (!res?.success) {
    throw createApiError(res?.message || "Could not update table.");
  }
  return res.data;
}

export async function deleteTableApi(tableId, userId) {
  const res = await managerAuthRequest(
    `/manager/tables/${tableId}`,
    { method: "DELETE" },
    userId
  );
  if (!res?.success) {
    throw createApiError(res?.message || "Could not delete table.");
  }
  return res;
}

function inferKitchenStatus(items) {
  const list = asArray(items);
  if (!list.length) return "queued";
  const statuses = list.map((item) =>
    String(item.item_status ?? "").trim().toLowerCase()
  );
  if (statuses.every((s) => s === "served" || s === "done")) return "done";
  if (statuses.some((s) => s === "ready")) return "ready";
  if (statuses.some((s) => s === "cooking" || s === "preparing")) return "cooking";
  return "queued";
}

function mapActiveTablesToOrders(payload) {
  return asArray(payload?.tables)
    .filter((row) => row?.order_id != null)
    .map((row) => {
      const items = asArray(row.items);
      const total = items.reduce(
        (sum, item) =>
          sum + (Number(item.unit_price) || 0) * (Number(item.quantity) || 0),
        0
      );
      return {
        order_id: row.order_id,
        order_number: `#${row.order_id}`,
        table_label: row.table_number ?? row.area_name ?? "—",
        items_count: items.length,
        total,
        status: "in_progress",
        kitchen_status: inferKitchenStatus(items),
      };
    });
}

export async function fetchOrders() {
  const res = await managerGet("/staff/orders/active", ORDERS);
  if (res.source === "api") {
    const data = Array.isArray(res.data)
      ? res.data
      : mapActiveTablesToOrders(res.data);
    return { source: res.source, data };
  }
  return { ...res, data: asArray(res.data) };
}

export function fetchKitchen() {
  return managerGet("/staff/kitchen", []);
}

function filterSubordinateStaff(list) {
  const allowed = new Set(STAFF_ASSIGNABLE_ROLES);
  return (Array.isArray(list) ? list : []).filter((member) =>
    allowed.has(String(member?.role_name ?? "").trim())
  );
}

export async function fetchManager() {
  const res = await managerGet("/staff/staff", MANAGER);
  return { ...res, data: filterSubordinateStaff(res.data) };
}

export function fetchPromotions() {
  return managerGet("/staff/promotions", PROMOTIONS).then((res) => ({
    ...res,
    data: asArray(res.data),
  }));
}

export async function fetchReservationStats() {
  const res = await fetchOverview();
  if (res.source === "api" && res.data?.reservationStats) {
    return { source: "api", data: res.data.reservationStats };
  }
  return res.source === "mock"
    ? mock(RESERVATION_STATS)
    : mock(res.data?.reservationStats ?? RESERVATION_STATS);
}

export async function fetchTableUtilization() {
  const res = await fetchOverview();
  if (res.source === "api" && res.data?.tableUtilization) {
    return { source: "api", data: asArray(res.data.tableUtilization) };
  }
  return res.source === "mock"
    ? mock(TABLE_UTILIZATION)
    : mock(asArray(res.data?.tableUtilization).length ? res.data.tableUtilization : TABLE_UTILIZATION);
}

/* ---- Shift scheduling (/api/manager/*) --------------------------- */

function resolveManagerUserId(userId) {
  const parsed = Number(userId);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function managerAuthRequest(path, options = {}, userId) {
  let uid = resolveManagerUserId(userId);
  if (!uid) {
    const fallbackUser = loadAuthUser();
    uid = resolveManagerUserId(fallbackUser?.user_id || fallbackUser?.id);
  }
  if (!uid) {
    throw createApiError("Manager session required.", { status: 401 });
  }
  return request(path, {
    ...options,
    headers: profileRequestHeaders(uid, options.headers),
  });
}

export async function fetchShifts(userId) {
  try {
    const res = await managerAuthRequest("/manager/shifts", { method: "GET" }, userId);
    if (res?.success) {
      return { source: "api", data: res.data ?? [] };
    }
  } catch { console.error("fetch API ERROR", arguments);
    /* fall through */
  }
  return mock([]);
}

export async function fetchSchedules(date, userId) {
  try {
    const qs = new URLSearchParams({ date });
    const res = await managerAuthRequest(
      `/manager/schedules?${qs.toString()}`,
      { method: "GET" },
      userId
    );
    if (res?.success) {
      return { source: "api", data: res.data ?? [] };
    }
  } catch { console.error("fetch API ERROR", arguments);
    /* fall through */
  }
  return mock([]);
}

export async function assignSchedule({ work_date, user_id, shift_id }, userId) {
  const res = await managerAuthRequest(
    "/manager/schedules",
    {
      method: "POST",
      body: JSON.stringify({ work_date, user_id, shift_id }),
    },
    userId
  );
  if (!res?.success) {
    throw createApiError(res?.message || "Could not assign shift.");
  }
  return res.data;
}

export async function updateScheduleAttendance(scheduleId, attendance_status, userId) {
  const res = await managerAuthRequest(
    `/manager/schedules/${scheduleId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ attendance_status }),
    },
    userId
  );
  if (!res?.success) {
    throw createApiError(res?.message || "Could not update attendance status.");
  }
  return res.data;
}

/* ---- JSON staff work-shift assignments (/api/manager/shift-mapping) */

export async function fetchStaffShiftMapping(userId) {
  try {
    const res = await managerAuthRequest(
      "/manager/shift-mapping",
      { method: "GET" },
      userId
    );
    if (res?.success && res.data && typeof res.data === "object" && !Array.isArray(res.data)) {
      return { source: "api", data: res.data };
    }
  } catch { console.error("fetch API ERROR", arguments);
    /* fall through */
  }
  return { source: "mock", data: {} };
}

export async function updateStaffShift(staffId, shiftName, userId) {
  const res = await managerAuthRequest(
    `/manager/shift-mapping/${staffId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shift: shiftName }),
    },
    userId
  );
  if (!res?.success) {
    throw createApiError(res?.message || "Could not update staff shift.");
  }
  return res.data;
}

/* ---- Table management (/api/manager/*) --------------------------- */

export async function fetchAreas(userId) {
  try {
    const res = await managerAuthRequest("/manager/areas", { method: "GET" }, userId);
    if (res?.success) {
      return { source: "api", data: res.data ?? [] };
    }
  } catch { console.error("fetch API ERROR", arguments);
    /* fall through */
  }
  return mock([]);
}

export async function createTable(payload, userId) {
  const res = await managerAuthRequest(
    "/manager/tables",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    userId
  );
  if (!res?.success) {
    throw createApiError(res?.message || "Could not create table.");
  }
  return res.data;
}

export async function fetchNextTableNumber(areaId, userId, options = {}) {
  const qs = new URLSearchParams({ area_id: String(areaId) });
  const res = await managerAuthRequest(
    `/manager/next-table-number?${qs.toString()}`,
    { method: "GET", signal: options.signal },
    userId
  );
  if (!res?.success) {
    throw createApiError(res?.message || "Could not suggest next table number.");
  }
  return res.data;
}

export async function fetchFilteredTables(filters, userId) {
  try {
    const params = new URLSearchParams();
    if (filters.search) params.append("search", filters.search);
    if (filters.area_id) params.append("area_id", filters.area_id);
    if (filters.statuses) params.append("statuses", filters.statuses);

    const path = `/manager/tables-filtered?${params.toString()}`;
    const res = await managerAuthRequest(path, { method: "GET" }, userId);
    if (res?.success) {
      return { source: "api", data: res.data ?? [] };
    }
  } catch { console.error("fetch API ERROR", arguments);
    /* fall through */
  }

  let list = [];
  return mock(list);
}

export async function mergeTablesApi(sourceId, targetId, userId) {
  const res = await managerAuthRequest(
    "/manager/tables/merge",
    {
      method: "POST",
      body: JSON.stringify({ source_table_id: sourceId, target_table_id: targetId }),
    },
    userId
  );
  if (!res?.success) throw createApiError(res?.message || "Merge failed.");
  return res;
}

export async function unmergeTableApi(tableId, userId) {
  const res = await managerAuthRequest(
    "/manager/tables/unmerge",
    {
      method: "POST",
      body: JSON.stringify({ table_id: tableId }),
    },
    userId
  );
  if (!res?.success) throw createApiError(res?.message || "Unmerge failed.");
  return res;
}

export async function fetchTableTimelineApi(tableId, userId) {
  const res = await managerAuthRequest(
    `/manager/tables/${tableId}/timeline`,
    { method: "GET" },
    userId
  );
  if (!res?.success) throw createApiError(res?.message || "Fetch timeline failed.");
  return res;
}

/* ---- Write operations (UI-ready, not yet persisted) ------------ */

const NOT_CONNECTED = { connected: false };

export function saveTable() {
  return Promise.resolve(NOT_CONNECTED);
}
export function deleteTable() {
  return Promise.resolve(NOT_CONNECTED);
}
export function saveManager() {
  return Promise.resolve(NOT_CONNECTED);
}
export function deleteManager() {
  return Promise.resolve(NOT_CONNECTED);
}
export function savePromotion() {
  return Promise.resolve(NOT_CONNECTED);
}
export function deletePromotion() {
  return Promise.resolve(NOT_CONNECTED);
}
export function exportReport() {
  return Promise.resolve(NOT_CONNECTED);
}
