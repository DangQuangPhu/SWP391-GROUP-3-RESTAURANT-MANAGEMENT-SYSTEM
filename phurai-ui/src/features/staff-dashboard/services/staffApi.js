/* Phūrai — Staff Portal API wrapper (reservation queue). */

import { request } from "@/core/api/httpClient.js";
import { QUEUE_RESERVATIONS } from "../data/staffDashboardMockData.js";

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

/** Normalize DB/API tokens (e.g. "Pending", "Checked In") to slug form. */
export function normalizeQueueToken(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function getReservationStatus(reservation) {
  return normalizeQueueToken(reservation?.status ?? reservation?.reservation_status);
}

function getReservationSource(reservation) {
  return normalizeQueueToken(reservation?.source ?? reservation?.reservation_source);
}

/** Queue eligibility: dbo.Reservations uses N'Pending' + N'Online' (case-insensitive). */
export function isPendingOnlineReservation(reservation) {
  const statusRaw = String(
    reservation?.reservation_status ?? reservation?.status ?? ""
  ).trim();
  const sourceRaw = String(
    reservation?.reservation_source ?? reservation?.source ?? ""
  ).trim();

  const statusOk =
    statusRaw === "Pending" || getReservationStatus(reservation) === "pending";
  const sourceOk =
    sourceRaw === "Online" || getReservationSource(reservation) === "online";

  return statusOk && sourceOk;
}

export async function fetchReservationQueue() {
  const res = await staffGet("/staff/reservations/today", QUEUE_RESERVATIONS);
  const rows = Array.isArray(res.data) ? res.data : QUEUE_RESERVATIONS;
  const data = rows.filter(isPendingOnlineReservation);
  return { source: res.source, data };
}
