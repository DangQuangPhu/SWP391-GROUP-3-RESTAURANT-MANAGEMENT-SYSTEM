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

  return {
    userId,
    id: userId,
    roleId: raw.role_id ?? raw.roleId,
    roleName: raw.role_name ?? raw.roleName,
    fullName: raw.full_name ?? raw.fullName ?? "",
    firstName: raw.first_name ?? raw.firstName ?? "",
    lastName: raw.last_name ?? raw.lastName ?? "",
    email: raw.email ?? "",
    phone: raw.phone ?? raw.phoneNumber ?? "",
    phoneNumber: raw.phone ?? raw.phoneNumber ?? "",
    avatarUrl: raw.avatar_url ?? raw.avatarUrl ?? "",
    username: raw.username ?? "",
    dateOfBirth: formatApiDate(raw.date_of_birth ?? raw.dateOfBirth),
    dob: formatApiDate(raw.date_of_birth ?? raw.dateOfBirth),
    gender: raw.gender ?? "",
    country: raw.country ?? "",
    language: raw.language ?? "",
    bio: raw.bio ?? "",
    loyaltyPoints: Number(raw.loyalty_points ?? raw.loyaltyPoints ?? 0),
    preferences,
    googleAvatarUrl: raw.google_avatar_url ?? raw.googleAvatarUrl ?? "",
    avatarSource: raw.avatar_source ?? raw.avatarSource ?? "",
    created_at: raw.created_at ?? null,
    lastLoginAt: raw.last_login_at ?? raw.lastLoginAt ?? null,
  };
}
