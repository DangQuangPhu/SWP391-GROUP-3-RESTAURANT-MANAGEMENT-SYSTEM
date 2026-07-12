import { format, parseISO } from "date-fns";
import { formatBookingId } from "@/features/reservations/utils/formatBookingId.js";
import { normalizeQueueToken } from "../services/staffApi.js";
import { DASHBOARD_TODAY } from "@/shared/constants.js";
import { RESERVATION_STATUS_META } from "@/shared/reservationStatus.js";
import { asArray } from "@/core/utils/asArray.js";

export const RESERVATION_QUEUE_FILTERS = [
  { id: "all", label: "All" },
  { id: "pending request", label: "Pending Request" },
  { id: "check-in", label: "Check-in" },
  { id: "reject request", label: "Reject Request" },
  { id: "reject check-in", label: "Reject Check-in" }
];

export function getReservationStatusKey(reservation) {
  return (
    normalizeQueueToken(reservation?.display_status ?? reservation?.status ?? reservation?.reservation_status) ||
    "pending request"
  );
}

export function isRejectedReservation(reservation) {
  const status = getReservationStatusKey(reservation);
  return status === "reject check-in" || status === "reject request";
}

export function getReservationDateIso(reservation) {
  if (reservation?.reservation_date) return reservation.reservation_date;
  if (reservation?.reservation_start_at) {
    return String(reservation.reservation_start_at).slice(0, 10);
  }
  return format(DASHBOARD_TODAY, "yyyy-MM-dd");
}

/** Host-facing display: DD/MM/YYYY - HH:mm */
export function formatReservationDateTime(reservation) {
  const timeStr = reservation?.start_time || "—";
  const dateIso = getReservationDateIso(reservation);
  try {
    const day = parseISO(`${dateIso}T12:00:00`);
    return `${format(day, "dd/MM/yyyy")} - ${timeStr}`;
  } catch {
    return `${dateIso} - ${timeStr}`;
  }
}

/** Table "Time" column: DD/MM - HH:mm */
export function formatReservationTimeDisplay(reservation) {
  const timeStr = String(reservation?.start_time || "—").slice(0, 5);
  const dateIso = getReservationDateIso(reservation);
  try {
    const day = parseISO(`${dateIso}T12:00:00`);
    return `${format(day, "dd/MM")} - ${timeStr}`;
  } catch {
    return `${dateIso} - ${timeStr}`;
  }
}

export function getReservationDisplayMeta(statusKey) {
  return RESERVATION_STATUS_META[statusKey] || RESERVATION_STATUS_META["pending request"];
}

export function matchesReservationQueueFilter(reservation, filterId) {
  const status = getReservationStatusKey(reservation);
  if (filterId === "all") {
    return !isRejectedReservation(reservation);
  }
  if (filterId === "pending") {
    return status === "pending" || status === "confirmed";
  }
  if (filterId === "checked_in") {
    return status === "checked_in" || status === "completed" || status === "seated" || status === "occupied";
  }
  if (filterId === "rejected") {
    return isRejectedReservation(reservation);
  }
  return true;
}

export function reservationMatchesSearch(reservation, query) {
  const trimmed = String(query ?? "").trim();
  if (!trimmed) return true;

  const q = trimmed.toLowerCase();
  const qDigits = q.replace(/\D/g, "");
  const name = String(
    reservation?.customer_name ?? reservation?.full_name ?? ""
  ).toLowerCase();
  const phone = String(reservation?.phone ?? reservation?.phone_number ?? "")
    .replace(/\s/g, "")
    .toLowerCase();
  const bookingId = formatBookingId(reservation?.reservation_id).toLowerCase();
  const rawId = String(reservation?.reservation_id ?? "");

  if (name.includes(q)) return true;
  if (phone && phone.includes(q.replace(/\s/g, ""))) return true;
  if (bookingId.includes(q) || bookingId.replace("#", "").includes(qDigits)) {
    return true;
  }
  if (qDigits && rawId.replace(/\D/g, "").includes(qDigits)) return true;

  return false;
}

export function sortReservationsByStartAt(rows) {
  return [...asArray(rows)].sort(
    (a, b) =>
      new Date(a?.reservation_start_at || 0).getTime() -
      new Date(b?.reservation_start_at || 0).getTime()
  );
}

export function filterReservationQueue(rows, { searchTerm = "", statusFilter = "all" } = {}) {
  return sortReservationsByStartAt(
    asArray(rows)
      .filter((reservation) => matchesReservationQueueFilter(reservation, statusFilter))
      .filter((reservation) => reservationMatchesSearch(reservation, searchTerm))
  );
}

export function getVerifiedReservationPatch() {
  return {
    status: "confirmed",
    reservation_status: "Confirmed",
  };
}

export function getRejectedReservationPatch() {
  return {
    status: "cancelled",
    reservation_status: "Rejected",
    table_id: null,
    table_number: null,
    table_label: "—",
    table_name: "—",
    assigned_tables: [],
  };
}

/** Keep session-local verify/reject changes when mock rows are re-fetched. */
export function mergePreservedReservationStatuses(previousRows, incomingRows) {
  const overrides = new Map(
    asArray(previousRows)
      .filter((row) => {
        const key = getReservationStatusKey(row);
        return key === "cancelled" || key === "confirmed";
      })
      .map((row) => [String(row.reservation_id), row])
  );

  if (overrides.size === 0) return asArray(incomingRows);

  return asArray(incomingRows).map((row) => {
    const kept = overrides.get(String(row.reservation_id));
    return kept ?? row;
  });
}

export function sameReservationId(left, right) {
  if (left == null || right == null) return false;
  return String(left) === String(right);
}
