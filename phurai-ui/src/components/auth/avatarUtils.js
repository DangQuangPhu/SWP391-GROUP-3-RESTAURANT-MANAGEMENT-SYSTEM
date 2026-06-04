/** Valid system avatars (SVG — PNG copies were invalid and removed). */
export const SYSTEM_AVATARS = [
  "/avatars/avatar-1.svg",
  "/avatars/avatar-2.svg",
  "/avatars/avatar-3.svg",
  "/avatars/avatar-4.svg",
  "/avatars/avatar-5.svg",
];

export function getApiOrigin() {
  const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api";
  return apiBase.replace(/\/api\/?$/, "");
}

/** Map legacy broken /avatars/avatar-N.png paths to working SVG. */
export function normalizeStoredAvatarUrl(avatarUrl) {
  const trimmed = String(avatarUrl || "").trim();
  if (!trimmed) return "";

  const legacyPng = trimmed.match(/^\/avatars\/avatar-([1-5])\.png$/i);
  if (legacyPng) {
    return `/avatars/avatar-${legacyPng[1]}.svg`;
  }

  return trimmed;
}

/** Resolve AvatarUrl for <img src>. */
export function resolveAvatarUrl(avatarUrl) {
  const trimmed = normalizeStoredAvatarUrl(avatarUrl);
  if (!trimmed) return "";

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }

  if (trimmed.startsWith("/uploads/")) {
    return `${getApiOrigin()}${trimmed}`;
  }

  if (trimmed.startsWith("/avatars/")) {
    return trimmed;
  }

  return trimmed;
}

export function getAvatarSrc(userOrProfile) {
  return normalizeStoredAvatarUrl(
    userOrProfile?.avatarUrl || userOrProfile?.AvatarUrl || ""
  );
}

export function getAvatarInitial(user) {
  const letter =
    user?.firstName?.[0] ||
    user?.username?.[0] ||
    user?.email?.[0] ||
    "U";
  return String(letter).toUpperCase();
}

export function isSystemAvatarPath(path) {
  return SYSTEM_AVATARS.includes(normalizeStoredAvatarUrl(path));
}
