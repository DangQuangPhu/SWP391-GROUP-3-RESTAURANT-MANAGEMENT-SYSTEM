/** Coerce API/mock values to a safe array for .map/.filter/.reduce. */
export function asArray(value) {
  return Array.isArray(value) ? value : [];
}
