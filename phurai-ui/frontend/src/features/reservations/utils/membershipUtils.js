export const MEMBERSHIP_RANKS = {
  Bronze: 1,
  Silver: 2,
  Gold: 3,
  Diamond: 4,
};

export const AREA_MINIMUM_TIERS = {
  "Standard Area": "Bronze",
  Standard: "Bronze",
  "Window Area": "Bronze",
  Window: "Bronze",
  "Kitchen View": "Bronze",
  Kitchen: "Bronze",
  "Rooftop Outdoor": "Silver",
  "Rooftop / Outdoor": "Silver",
  Rooftop: "Silver",
  "Premium Area": "Gold",
  Premium: "Gold",
  "VIP Lounge": "Diamond",
  "VIP / Private": "Diamond",
  "Private Room": "Diamond",
  VIP: "Diamond",
};

export const getRequiredTierForArea = (areaName) => {
  if (!areaName) return "Bronze";
  // Look up exact match first, then fallback to partial matching if necessary
  if (AREA_MINIMUM_TIERS[areaName]) return AREA_MINIMUM_TIERS[areaName];
  
  const lower = areaName.toLowerCase();
  if (lower.includes("vip") || lower.includes("private")) return "Diamond";
  if (lower.includes("premium")) return "Gold";
  if (lower.includes("rooftop") || lower.includes("outdoor") || lower.includes("terrace")) return "Silver";
  
  return "Bronze";
};

export const canAccessArea = (membershipTier, areaName) => {
  const userTier = membershipTier || "Bronze";
  const requiredTier = getRequiredTierForArea(areaName);

  const userRank = MEMBERSHIP_RANKS[userTier] || 1;
  const requiredRank = MEMBERSHIP_RANKS[requiredTier] || 1;

  return userRank >= requiredRank;
};
