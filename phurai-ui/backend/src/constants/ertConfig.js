export const DEFAULT_ERT_DURATION_MIN = {
  partySmall: 60,
  partyMedium: 90,
  partyLarge: 120,
  privateRoom: 150,
};

export function isPrivateDiningArea(areaName = "") {
  const normalized = String(areaName).trim().toLowerCase();
  return (
    normalized.includes("private") ||
    normalized.includes("vip") ||
    normalized.includes("premium")
  );
}

export function getDefaultErtDurationMin(guestCount, areaName = "") {
  if (isPrivateDiningArea(areaName)) return DEFAULT_ERT_DURATION_MIN.privateRoom;

  const count = Number(guestCount) || 1;
  if (count <= 2) return DEFAULT_ERT_DURATION_MIN.partySmall;
  if (count <= 4) return DEFAULT_ERT_DURATION_MIN.partyMedium;
  return DEFAULT_ERT_DURATION_MIN.partyLarge;
}
