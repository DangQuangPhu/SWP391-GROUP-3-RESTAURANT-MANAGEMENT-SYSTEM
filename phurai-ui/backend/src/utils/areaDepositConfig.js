/**
 * Area Deposit Surcharge Configuration & Utility
 * 
 * Luxury areas (Premium Area, Private Room, VIP Lounge) require tiered deposit surcharges
 * based on table capacity (2, 4, 6, 8+ seats).
 */

const AREA_SURCHARGE_MATRIX = {
  "Premium Area": {
    2: 30000,
    4: 50000,
    6: 80000,
    8: 120000,
  },
  "Private Room": {
    2: 50000,
    4: 100000,
    6: 150000,
    8: 200000,
  },
  "VIP Lounge": {
    2: 50000,
    4: 100000,
    6: 150000,
    8: 200000,
  },
};

/**
 * Calculate the area deposit surcharge for a given area name and table capacity.
 * @param {string|null|undefined} areaName
 * @param {number|string|null|undefined} capacity
 * @returns {{ surcharge: number, description: string, isLuxury: boolean }}
 */
export function getAreaSurcharge(areaName, capacity) {
  const cleanArea = String(areaName || "").trim();
  const cap = Number(capacity) || 2;

  const areaRates = AREA_SURCHARGE_MATRIX[cleanArea];
  if (!areaRates) {
    return { surcharge: 0, description: "", isLuxury: false };
  }

  // Determine capacity tier bracket (2, 4, 6, 8)
  let tier = 2;
  if (cap >= 8) tier = 8;
  else if (cap >= 6) tier = 6;
  else if (cap >= 4) tier = 4;
  else tier = 2;

  const surcharge = areaRates[tier] || 0;
  const description = `${cleanArea} (${cap} seats) Surcharge: +${surcharge.toLocaleString("vi-VN")} VND`;

  return {
    surcharge,
    description,
    isLuxury: surcharge > 0,
    areaName: cleanArea,
    capacity: cap,
  };
}
