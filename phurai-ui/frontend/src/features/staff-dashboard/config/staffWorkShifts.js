/** Shift labels and grouping — assignments loaded from shift-mapping API. */

export const WORK_SHIFTS = {
  morning: {
    id: "morning",
    label: "Morning Shift",
    viewLabel: "Morning View",
    hoursLabel: "06:00 – 14:00",
    hint: "06:00 – 13:59",
  },
  afternoon: {
    id: "afternoon",
    label: "Afternoon Shift",
    viewLabel: "Afternoon View",
    hoursLabel: "14:00 – 18:00",
    hint: "14:00 – 17:59",
  },
  night: {
    id: "night",
    label: "Night Shift",
    viewLabel: "Night View",
    hoursLabel: "18:00 – 00:30",
    hint: "18:00 – 23:59",
  },
};

export const RESERVATION_SHIFT_SECTIONS = [
  WORK_SHIFTS.morning,
  WORK_SHIFTS.afternoon,
  WORK_SHIFTS.night,
];

export const WORK_SHIFT_OPTIONS = ["Morning", "Afternoon", "Night"];

export function isPrivilegedReservationViewer(user) {
  if (!user) return false;
  const roleId = Number(user.roleId ?? user.role_id);
  if (roleId === 4 || roleId === 5) return true;
  const role = String(user.roleName ?? user.role_name ?? user.role ?? "")
    .trim()
    .toLowerCase();
  return role === "manager" || role === "admin";
}

/** Manager, admin, and floor staff (restaurant + kitchen) see the 3-shift reservation board. */
export function canViewShiftReservationBoard(user) {
  if (!user) return false;
  if (isPrivilegedReservationViewer(user)) return true;
  const roleId = Number(user.roleId ?? user.role_id);
  return roleId === 2 || roleId === 3;
}

export function shiftLabelToId(label) {
  const text = String(label || "").trim().toLowerCase();
  if (text === "morning") return "morning";
  if (text === "afternoon") return "afternoon";
  if (text === "night") return "night";
  return null;
}

export function shiftIdToLabel(shiftId) {
  if (shiftId === "morning") return "Morning";
  if (shiftId === "afternoon") return "Afternoon";
  if (shiftId === "night") return "Night";
  return "";
}

export function resolveWorkShiftForStaff(user, mapping = null) {
  if (!user || !mapping || typeof mapping !== "object") return null;

  const userId = user.userId ?? user.id ?? user.user_id;
  if (userId == null || userId === "") return null;

  return shiftLabelToId(mapping[String(userId)]);
}

export function getWorkShiftMeta(shiftId) {
  return WORK_SHIFTS[shiftId] || null;
}

export function getStaffMemberKey(member) {
  const id = member?.user_id ?? member?.staff_id ?? member?.manager_id;
  return id == null || id === "" ? null : String(id);
}

export function getReservationHour(reservation) {
  if (reservation?.start_time) {
    const [hours] = String(reservation.start_time).split(":");
    const parsed = Number(hours);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (reservation?.reservation_start_at) {
    const date = new Date(reservation.reservation_start_at);
    if (!Number.isNaN(date.getTime())) return date.getHours();
  }
  return 12;
}

export function getReservationMinute(reservation) {
  if (reservation?.start_time) {
    const parts = String(reservation.start_time).split(":");
    const parsed = Number(parts[1]);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (reservation?.reservation_start_at) {
    const date = new Date(reservation.reservation_start_at);
    if (!Number.isNaN(date.getTime())) return date.getMinutes();
  }
  return 0;
}

export function classifyReservationShift(reservation) {
  const hour = getReservationHour(reservation);
  const minute = getReservationMinute(reservation);

  if (hour >= 18 || (hour === 0 && minute <= 30)) return "night";
  if (hour >= 14) return "afternoon";
  if (hour >= 6) return "morning";
  return "morning";
}

export function groupReservationsByShift(reservations) {
  const grouped = {
    morning: [],
    afternoon: [],
    night: [],
  };

  (Array.isArray(reservations) ? reservations : []).forEach((reservation) => {
    const shiftId = classifyReservationShift(reservation);
    grouped[shiftId].push(reservation);
  });

  return grouped;
}
