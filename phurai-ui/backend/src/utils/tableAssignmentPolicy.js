const DEFAULT_CONFIRMED_ASSIGNMENT_WINDOW_HOURS = 3;
const DEFAULT_FINALIZATION_ALERT_THRESHOLD_MINUTES = 30;

export const CONFIRMED_ASSIGNMENT_WINDOW_HOURS =
  Number(process.env.CONFIRMED_ASSIGNMENT_WINDOW_HOURS) ||
  DEFAULT_CONFIRMED_ASSIGNMENT_WINDOW_HOURS;

export const FINALIZATION_ALERT_THRESHOLD_MINUTES =
  Number(process.env.TABLE_ASSIGNMENT_ALERT_THRESHOLD_MINUTES) ||
  DEFAULT_FINALIZATION_ALERT_THRESHOLD_MINUTES;

export const TABLE_ASSIGNMENT_STATUS = Object.freeze({
  PREFERRED: "Preferred",
  CONFIRMED: "Confirmed",
});

export function getAssignmentMode(startAt, now = new Date()) {
  const start = startAt instanceof Date ? startAt : new Date(startAt);
  const reference = now instanceof Date ? now : new Date(now);

  if (Number.isNaN(start.getTime()) || Number.isNaN(reference.getTime())) {
    return TABLE_ASSIGNMENT_STATUS.PREFERRED;
  }

  const hoursUntilStart = (start.getTime() - reference.getTime()) / 36e5;
  return hoursUntilStart <= CONFIRMED_ASSIGNMENT_WINDOW_HOURS
    ? TABLE_ASSIGNMENT_STATUS.CONFIRMED
    : TABLE_ASSIGNMENT_STATUS.PREFERRED;
}

export function isConfirmedAssignmentWindow(startAt, now = new Date()) {
  return getAssignmentMode(startAt, now) === TABLE_ASSIGNMENT_STATUS.CONFIRMED;
}

export function appendPreferredTableTags(
  specialRequest,
  { tableId, tableNumber, assignmentMode } = {}
) {
  const base = String(specialRequest || "")
    .replace(/\s*\[PreferredTable:[^\]]*\]/gi, "")
    .replace(/\s*\[PreferredTableId:[^\]]*\]/gi, "")
    .replace(/\s*\[Assignment:[^\]]*\]/gi, "")
    .trim();

  const tags = [];
  if (tableNumber) tags.push(`[PreferredTable: ${String(tableNumber).trim()}]`);
  if (tableId) tags.push(`[PreferredTableId: ${Number(tableId)}]`);
  if (assignmentMode) tags.push(`[Assignment: ${assignmentMode}]`);

  return [base, ...tags].filter(Boolean).join(" ").slice(0, 1000) || null;
}

export function parsePreferredTableTags(specialRequest) {
  const text = String(specialRequest || "");
  const tableNumber = text.match(/\[PreferredTable:\s*([^\]]+)\]/i)?.[1]?.trim() || null;
  const tableIdRaw = text.match(/\[PreferredTableId:\s*([^\]]+)\]/i)?.[1]?.trim() || null;
  const assignmentMode = text.match(/\[Assignment:\s*([^\]]+)\]/i)?.[1]?.trim() || null;
  const tableId = Number(tableIdRaw);

  return {
    preferred_table_number: tableNumber,
    preferred_table_id: Number.isFinite(tableId) && tableId > 0 ? tableId : null,
    table_assignment_status:
      assignmentMode === TABLE_ASSIGNMENT_STATUS.CONFIRMED
        ? TABLE_ASSIGNMENT_STATUS.CONFIRMED
        : assignmentMode === TABLE_ASSIGNMENT_STATUS.PREFERRED
          ? TABLE_ASSIGNMENT_STATUS.PREFERRED
          : null,
  };
}

export function stripAssignmentTags(specialRequest) {
  return String(specialRequest || "")
    .replace(/\s*\[PreferredTable:[^\]]*\]/gi, "")
    .replace(/\s*\[PreferredTableId:[^\]]*\]/gi, "")
    .replace(/\s*\[Assignment:[^\]]*\]/gi, "")
    .trim();
}
