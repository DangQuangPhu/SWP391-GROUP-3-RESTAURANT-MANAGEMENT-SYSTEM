export function normalizePrice(price) {
  const numberPrice = Number(price) || 0;

  if (numberPrice > 0 && numberPrice < 1000) {
    return Math.round(numberPrice * 1000);
  }

  return Math.round(numberPrice);
}

export function formatVND(price) {
  return `${normalizePrice(price).toLocaleString('vi-VN')} VND`;
}

/** @deprecated Use normalizePrice */
export const toVndAmount = normalizePrice;
