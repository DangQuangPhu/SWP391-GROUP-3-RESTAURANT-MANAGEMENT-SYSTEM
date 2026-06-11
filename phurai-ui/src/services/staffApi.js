/* ============================================================
   Phūrai — Staff/Manager Dashboard API wrapper
   ------------------------------------------------------------
   Calls /api/staff/* endpoints backed by SQL Server. Falls back
   to schema-aligned sample data when the API is unreachable.

   Every getter resolves to: { source: "api" | "mock", data }
   ============================================================ */

import { request } from "@/api/httpClient.js";
import {
  KPI_CARDS,
  REVENUE_SERIES,
  RESERVATIONS,
  TABLES,
  DISHES,
  BEST_SELLERS,
  ORDERS,
  STAFF,
  PROMOTIONS,
  RESERVATION_STATS,
  TABLE_UTILIZATION,
} from "@/data/staffDashboardMockData.js";

const MOCK_DELAY = 220;

function mock(data) {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ source: "mock", data }), MOCK_DELAY);
  });
}

async function staffGet(path, fallback) {
  try {
    const res = await request(path, { method: "GET" });
    if (res?.success) {
      return { source: "api", data: res.data ?? fallback };
    }
  } catch {
    /* fall through to mock */
  }
  return mock(fallback);
}

let overviewCache = null;

async function fetchOverview() {
  if (overviewCache) return overviewCache;
  overviewCache = staffGet("/staff/overview", {
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
  const res = await staffGet("/staff/reports/revenue", { series: REVENUE_SERIES });
  if (res.source === "api") {
    return { source: "api", data: res.data?.series ?? REVENUE_SERIES };
  }
  return res;
}

export function fetchReservations() {
  return staffGet("/staff/reservations/today", RESERVATIONS);
}

export function fetchTables() {
  return staffGet("/staff/tables/status", TABLES);
}

export function fetchDishes() {
  return staffGet("/staff/dishes", DISHES);
}

export function fetchBestSellers() {
  return staffGet("/staff/best-selling", BEST_SELLERS);
}

export function fetchOrders() {
  return staffGet("/staff/orders/active", ORDERS);
}

export function fetchKitchen() {
  return staffGet("/staff/kitchen", []);
}

export function fetchStaff() {
  return staffGet("/staff/staff", STAFF);
}

export function fetchPromotions() {
  return staffGet("/staff/promotions", PROMOTIONS);
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
    return { source: "api", data: res.data.tableUtilization };
  }
  return res.source === "mock"
    ? mock(TABLE_UTILIZATION)
    : mock(res.data?.tableUtilization ?? TABLE_UTILIZATION);
}

/* ---- Write operations (UI-ready, not yet persisted) ------------ */

const NOT_CONNECTED = { connected: false };

export function saveDish() {
  return Promise.resolve(NOT_CONNECTED);
}
export function deleteDish() {
  return Promise.resolve(NOT_CONNECTED);
}
export function saveTable() {
  return Promise.resolve(NOT_CONNECTED);
}
export function deleteTable() {
  return Promise.resolve(NOT_CONNECTED);
}
export function saveStaff() {
  return Promise.resolve(NOT_CONNECTED);
}
export function deleteStaff() {
  return Promise.resolve(NOT_CONNECTED);
}
export function savePromotion() {
  return Promise.resolve(NOT_CONNECTED);
}
export function deletePromotion() {
  return Promise.resolve(NOT_CONNECTED);
}
export function updateReservationStatus() {
  return Promise.resolve(NOT_CONNECTED);
}
export function exportReport() {
  return Promise.resolve(NOT_CONNECTED);
}
