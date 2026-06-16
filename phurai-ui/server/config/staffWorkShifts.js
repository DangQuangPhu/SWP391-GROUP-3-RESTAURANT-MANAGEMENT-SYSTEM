/** Logical work-shift definitions (no DB migration). */

import {
  getShiftIdForUserId,
  readShiftMapping,
} from "../services/shiftMappingStore.js";

export const WORK_SHIFTS = {
  morning: {
    id: "morning",
    label: "Morning Shift",
    viewLabel: "Morning View",
    hoursLabel: "06:00 – 14:00",
  },
  afternoon: {
    id: "afternoon",
    label: "Afternoon Shift",
    viewLabel: "Afternoon View",
    hoursLabel: "14:00 – 18:00",
  },
  night: {
    id: "night",
    label: "Night Shift",
    viewLabel: "Night View",
    hoursLabel: "18:00 – 00:30",
  },
};

const PRIVILEGED_ROLE_IDS = new Set([4, 5]); // Manager, Admin

export function isPrivilegedReservationViewer(roleId) {
  return PRIVILEGED_ROLE_IDS.has(Number(roleId));
}

export function resolveWorkShiftForStaff({ userId }, mapping = readShiftMapping()) {
  return getShiftIdForUserId(userId, mapping);
}

export function getWorkShiftMeta(shiftId) {
  return WORK_SHIFTS[shiftId] || null;
}

/** SQL fragment for dbo.Reservations alias `r` — values come from trusted config only. */
export function buildReservationShiftHourClause(shiftId) {
  switch (shiftId) {
    case "morning":
      return "DATEPART(HOUR, r.reservation_start_at) >= 6 AND DATEPART(HOUR, r.reservation_start_at) < 14";
    case "afternoon":
      return "DATEPART(HOUR, r.reservation_start_at) >= 14 AND DATEPART(HOUR, r.reservation_start_at) < 18";
    case "night":
      return "(DATEPART(HOUR, r.reservation_start_at) >= 18 OR (DATEPART(HOUR, r.reservation_start_at) = 0 AND DATEPART(MINUTE, r.reservation_start_at) <= 30))";
    default:
      return null;
  }
}
