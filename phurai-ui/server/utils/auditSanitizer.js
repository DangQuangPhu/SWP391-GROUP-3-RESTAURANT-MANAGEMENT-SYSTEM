/**
 * auditSanitizer.js
 * Phūrai Restaurant Management System
 *
 * Shared utility: build a sanitized, allow-listed payload for dbo.AuditLogs.
 * Never write raw req.body — use this builder everywhere an audit row is inserted.
 *
 * Protocol #4 (from ARCHITECTURE.md): NEVER stringify raw req.body into AuditLogs.
 * This function is the single source of truth for that rule.
 */

/** Fields allowed in any reservation-related audit new_value_json. */
const RESERVATION_AUDIT_FIELDS = [
  "reservation_start_at",
  "reservation_end_at",
  "guest_count",
  "contact_name",
  "contact_phone",
  "contact_email",
  "special_request",
  "table_ids",
  "table_id",
  "preorder_items",
  "reservation_status",
  "has_pending_request",
  "request_type",
  "edit_used_count",
  "cancel_reason",
];

/**
 * Build a sanitized audit payload from an arbitrary source object.
 *
 * @param {Record<string, unknown>} source - The object to sanitize (e.g. req.body or a diff object).
 * @param {string[]} [extraFields] - Additional field names to allow beyond the default list.
 * @returns {Record<string, unknown>} Sanitized object containing only allowed keys.
 */
export function buildSanitizedAuditPayload(source = {}, extraFields = []) {
  const allowList = new Set([...RESERVATION_AUDIT_FIELDS, ...extraFields]);
  const sanitized = {};
  for (const [key, value] of Object.entries(source)) {
    if (allowList.has(key)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Build the diff between two reservation objects — only include keys that changed.
 * Used by resolveEditRequest to produce a narrow audit log entry.
 *
 * @param {Record<string, unknown>} original - Current DB row values.
 * @param {Record<string, unknown>} requested - Values from pending_changes_json.
 * @returns {Record<string, unknown>} Object containing only keys where values differ.
 */
export function buildDiffPayload(original, requested) {
  const diff = {};
  for (const [key, newVal] of Object.entries(requested)) {
    const oldVal = original[key];
    // Shallow comparison; for arrays (preorder_items), always include if present
    if (Array.isArray(newVal) || String(oldVal) !== String(newVal)) {
      diff[key] = { from: oldVal ?? null, to: newVal };
    }
  }
  return diff;
}
