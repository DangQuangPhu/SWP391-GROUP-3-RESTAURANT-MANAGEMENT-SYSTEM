const TIERS = [
  { name: "Bronze", min: 0, max: 299, icon: "🥉" },
  { name: "Silver", min: 300, max: 799, icon: "🥈" },
  { name: "Gold", min: 800, max: 1499, icon: "🥇" },
  { name: "Diamond", min: 1500, max: Infinity, icon: "💎" },
];

export function getTierForPoints(points) {
  const value = Math.max(0, Number(points) || 0);
  return TIERS.find((tier) => value >= tier.min && value <= tier.max) || TIERS[0];
}

export function getMembershipInfo(loyaltyPoints) {
  const points = Math.max(0, Number(loyaltyPoints) || 0);
  const current = getTierForPoints(points);
  const currentIndex = TIERS.findIndex((tier) => tier.name === current.name);
  const next = currentIndex < TIERS.length - 1 ? TIERS[currentIndex + 1] : null;

  let pointsToNextTier = 0;
  let progressPercent = 100;

  if (next) {
    const rangeStart = current.min;
    const rangeEnd = next.min;
    pointsToNextTier = Math.max(0, rangeEnd - points);
    const span = rangeEnd - rangeStart;
    progressPercent = span > 0 ? Math.min(100, Math.round(((points - rangeStart) / span) * 100)) : 0;
  }

  return {
    membership_tier: current.name,
    membership_icon: current.icon,
    next_tier: next?.name ?? null,
    points_to_next_tier: pointsToNextTier,
    progress_percent: progressPercent,
  };
}
