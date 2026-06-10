import pool from "../db.js";
import { getMembershipInfo } from "./membership.js";

const PROFILE_SELECT = `
  SELECT
    ua.user_id,
    ua.role_id,
    ua.full_name,
    ua.email,
    ua.phone,
    ua.avatar_url,
    ua.is_active,
    ua.email_verified,
    r.role_name,
    cp.customer_id,
    cp.username,
    cp.date_of_birth,
    cp.gender,
    cp.country,
    cp.[language],
    cp.bio,
    cp.loyalty_points,
    cp.membership_tier,
    cp.preferences
  FROM dbo.UserAccounts ua
  LEFT JOIN dbo.Roles r ON ua.role_id = r.role_id
  LEFT JOIN dbo.CustomerProfiles cp ON ua.user_id = cp.user_id
`;

export function getEmailPrefix(email = "") {
  const normalized = String(email || "").trim().toLowerCase();
  return normalized.includes("@") ? normalized.split("@")[0] : normalized;
}

export function parsePreferences(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function serializePreferences(preferences) {
  if (!preferences) return "[]";
  const list = Array.isArray(preferences) ? preferences.map(String) : [];
  return JSON.stringify(list);
}

function formatDateOfBirth(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function formatProfileResponse(row) {
  if (!row) return null;

  const loyaltyPoints = Number(row.loyalty_points) || 0;
  const membership = getMembershipInfo(loyaltyPoints);
  const preferences = parsePreferences(row.preferences);

  return {
    user_id: row.user_id,
    role_id: row.role_id,
    role_name: row.role_name,
    full_name: row.full_name || "",
    email: row.email || "",
    phone: row.phone || "",
    avatar_url: row.avatar_url || null,
    username: row.username || getEmailPrefix(row.email),
    date_of_birth: formatDateOfBirth(row.date_of_birth),
    gender: row.gender || "",
    country: row.country || "",
    language: row.language || "",
    bio: row.bio || "",
    loyalty_points: loyaltyPoints,
    membership_tier: membership.membership_tier,
    membership_icon: membership.membership_icon,
    next_tier: membership.next_tier,
    points_to_next_tier: membership.points_to_next_tier,
    progress_percent: membership.progress_percent,
    preferences,
  };
}

export async function getCustomerRoleId() {
  const [rows] = await pool.query(
    `SELECT TOP 1 role_id FROM dbo.Roles WHERE role_name = ?`,
    ["Customer"]
  );
  return rows[0]?.role_id ?? 1;
}

export async function fetchProfileByUserId(userId) {
  const [rows] = await pool.query(`${PROFILE_SELECT} WHERE ua.user_id = ?`, [userId]);
  return rows[0] || null;
}

export async function fetchProfileByEmail(email) {
  const [rows] = await pool.query(
    `${PROFILE_SELECT} WHERE LOWER(ua.email) = LOWER(?)`,
    [email]
  );
  return rows[0] || null;
}

export async function ensureCustomerProfile(userId, email, defaults = {}) {
  const existing = await fetchProfileByUserId(userId);
  if (existing?.customer_id != null) {
    return existing;
  }

  const username = defaults.username || getEmailPrefix(email);
  const preferences = serializePreferences(defaults.preferences || []);
  const membership = getMembershipInfo(defaults.loyalty_points ?? 0);

  await pool.query(
    `INSERT INTO dbo.CustomerProfiles
      (user_id, username, date_of_birth, gender, country, [language], bio,
       loyalty_points, membership_tier, preferences, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, SYSDATETIME(), SYSDATETIME())`,
    [
      userId,
      username,
      defaults.date_of_birth || null,
      defaults.gender || null,
      defaults.country || null,
      defaults.language || null,
      defaults.bio || null,
      defaults.loyalty_points ?? 0,
      membership.membership_tier,
      preferences,
    ]
  );

  return fetchProfileByUserId(userId);
}

export async function getProfileForUser(userId, { ensureProfile = true, email } = {}) {
  let row = await fetchProfileByUserId(userId);
  if (!row) return null;

  if (ensureProfile && row.customer_id == null) {
    row = await ensureCustomerProfile(userId, email || row.email);
  }

  return formatProfileResponse(row);
}

export async function updateUserProfile(userId, payload) {
  const {
    full_name,
    phone,
    avatar_url,
    username,
    date_of_birth,
    gender,
    country,
    language,
    bio,
    preferences,
  } = payload;

  const existing = await fetchProfileByUserId(userId);
  if (!existing) {
    return null;
  }

  if (existing.customer_id == null) {
    await ensureCustomerProfile(userId, existing.email, { username });
  }

  await pool.query(
    `UPDATE dbo.UserAccounts
     SET full_name = ?,
         phone = ?,
         avatar_url = ?,
         updated_at = SYSDATETIME()
     WHERE user_id = ?`,
    [
      full_name ?? existing.full_name,
      phone ?? existing.phone,
      avatar_url !== undefined ? avatar_url : existing.avatar_url,
      userId,
    ]
  );

  const prefsJson = preferences !== undefined ? serializePreferences(preferences) : undefined;

  await pool.query(
    `UPDATE dbo.CustomerProfiles
     SET username = ?,
         date_of_birth = ?,
         gender = ?,
         country = ?,
         [language] = ?,
         bio = ?,
         preferences = COALESCE(?, preferences),
         updated_at = SYSDATETIME()
     WHERE user_id = ?`,
    [
      username ?? existing.username ?? getEmailPrefix(existing.email),
      date_of_birth !== undefined ? date_of_birth || null : existing.date_of_birth,
      gender !== undefined ? gender || null : existing.gender,
      country !== undefined ? country || null : existing.country,
      language !== undefined ? language || null : existing.language,
      bio !== undefined ? bio || null : existing.bio,
      prefsJson ?? null,
      userId,
    ]
  );

  const loyaltyPoints = Number(existing.loyalty_points) || 0;
  const membership = getMembershipInfo(loyaltyPoints);
  await pool.query(
    `UPDATE dbo.CustomerProfiles
     SET membership_tier = ?, updated_at = SYSDATETIME()
     WHERE user_id = ?`,
    [membership.membership_tier, userId]
  );

  return getProfileForUser(userId, { ensureProfile: false });
}

export function buildLoginUserResponse(row) {
  return formatProfileResponse(row);
}
