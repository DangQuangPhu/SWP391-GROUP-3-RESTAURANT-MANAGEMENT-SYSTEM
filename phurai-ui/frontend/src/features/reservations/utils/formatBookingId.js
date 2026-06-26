/**
 * Pad reservation_id to 6 digits for host-facing booking references.
 * @param {number|string|null|undefined} id
 * @param {{ hash?: boolean }} [options]
 */
export function formatBookingId(id, { hash = true } = {}) {
  if (id == null || id === "") return "—";

  const numeric = Number(id);
  const core = Number.isFinite(numeric)
    ? String(Math.trunc(numeric)).padStart(6, "0")
    : String(id).padStart(6, "0");

  return hash ? `#${core}` : core;
}
