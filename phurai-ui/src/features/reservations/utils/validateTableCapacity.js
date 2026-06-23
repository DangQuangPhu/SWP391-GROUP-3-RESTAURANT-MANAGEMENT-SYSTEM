/**
 * Validate if a given guest count is suitable for a table's capacity.
 * A table is only valid if guestCount <= tableCapacity and guestCount >= Math.ceil(tableCapacity / 2).
 * 
 * @param {number|string} guestCount 
 * @param {number|string} tableCapacity 
 * @returns {boolean}
 */
export function validateTableCapacity(guestCount, tableCapacity) {
  const gc = Number(guestCount);
  const tc = Number(tableCapacity);

  if (!guestCount || isNaN(gc) || isNaN(tc) || gc <= 0 || tc <= 0) {
    return false;
  }

  return gc <= tc && gc >= Math.ceil(tc / 2);
}
