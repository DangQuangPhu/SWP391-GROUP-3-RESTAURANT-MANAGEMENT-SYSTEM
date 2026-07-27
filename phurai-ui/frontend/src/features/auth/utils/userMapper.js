function parsePreferencesValue(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function formatApiDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

export function mapApiUserToFrontend(raw) {
  if (!raw) return null;

  const userId = raw.user_id ?? raw.userId ?? raw.id ?? null;
  const preferences = parsePreferencesValue(raw.preferences);

  let fullName = (raw.full_name ?? raw.fullName ?? raw.name ?? "").trim();
  let firstName = (raw.first_name ?? raw.firstName ?? "").trim();
  let lastName = (raw.last_name ?? raw.lastName ?? "").trim();

  // Auto-split fullName into firstName and lastName if missing
  if (!firstName && !lastName && fullName) {
    const parts = fullName.split(/\s+/);
    if (parts.length === 1) {
      firstName = parts[0];
    } else if (parts.length > 1) {
      lastName = parts.pop();
      firstName = parts.join(" ");
    }
  } else if ((firstName || lastName) && !fullName) {
    fullName = `${firstName} ${lastName}`.trim();
  }

  return {
    userId,
    id: userId,
    roleId: raw.role_id ?? raw.roleId,
    roleName: raw.role_name ?? raw.roleName,
    fullName,
    firstName,
    lastName,
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    email: raw.email ?? "",
    phone: raw.phone ?? raw.phoneNumber ?? "",
    phoneNumber: raw.phone ?? raw.phoneNumber ?? "",
    avatarUrl: raw.avatar_url ?? raw.avatarUrl ?? raw.avatar ?? raw.picture ?? raw.photoURL ?? raw.photo_url ?? "",
    username: raw.username ?? "",
    dateOfBirth: formatApiDate(raw.date_of_birth ?? raw.dateOfBirth ?? raw.dob),
    dob: formatApiDate(raw.date_of_birth ?? raw.dateOfBirth ?? raw.dob),
    gender: raw.gender ?? "",
    country: raw.country ?? "",
    language: raw.language ?? "",
    bio: raw.bio ?? "",
    loyaltyPoints: Number(raw.loyalty_points ?? raw.loyaltyPoints ?? 0),
    preferences,
    googleAvatarUrl: raw.google_avatar_url ?? raw.googleAvatarUrl ?? raw.picture ?? raw.photoURL ?? raw.photo_url ?? "",
    avatarSource: raw.avatar_source ?? raw.avatarSource ?? "",
    created_at: raw.created_at ?? null,
    lastLoginAt: raw.last_login_at ?? raw.lastLoginAt ?? null,
  };
}
