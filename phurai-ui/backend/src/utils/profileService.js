import pool from "../db.js";

// Must match CK_CustomerProfiles_gender CHECK constraint in SQL Server
const ALLOWED_GENDERS = new Set(["Male", "Female", "Other"]);

/** Sanitize gender — returns NULL for anything not in the DB whitelist */
function sanitizeGender(value) {
  if (!value) return null;
  const normalized = String(value).trim();
  return ALLOWED_GENDERS.has(normalized) ? normalized : null;
}

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
    cp.preferences,
    sp.staff_code,
    sp.job_title,
    sp.hire_date,
    ua.created_at
  FROM dbo.UserAccounts ua
  LEFT JOIN dbo.Roles r ON ua.role_id = r.role_id
  LEFT JOIN dbo.CustomerProfiles cp ON ua.user_id = cp.user_id
  LEFT JOIN dbo.StaffProfiles sp ON ua.user_id = sp.user_id
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
  const preferences = parsePreferences(row.preferences);

  return {
    user_id: row.user_id,
    role_id: row.role_id,
    role_name: row.role_name,
    full_name: row.full_name || "",
    email: row.email || "",
    phone: row.phone || "",
    avatar_url: row.avatar_url || null,
    // Expose google_avatar_url + avatar_source so the frontend avatarUtils
    // can fall back to the Google profile photo when no custom avatar is set.
    google_avatar_url: row.google_avatar_url || null,
    avatar_source: row.avatar_source || null,
    username: row.username || getEmailPrefix(row.email),
    date_of_birth: formatDateOfBirth(row.date_of_birth),
    gender: row.gender || "",
    country: row.country || "",
    language: row.language || "",
    bio: row.bio || "",
    loyalty_points: loyaltyPoints,
    preferences,
    staff_code: row.staff_code || null,
    job_title: row.job_title || null,
    created_at: row.created_at || null,
    last_login_at: row.last_login_at || null,
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
  try {
    const [rows] = await pool.query(`${PROFILE_SELECT} WHERE ua.user_id = ?`, [userId]);
    return rows[0] || null;
  } catch (error) {
    console.error("fetchProfileByUserId SQL Error:", error.message || error);
    throw new Error(`Database error fetching profile: ${error.message}`);
  }
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

  // Do not automatically create Customer Profiles for Staff/Manager roles
  const roleName = String(existing?.role_name || "").toLowerCase();
  if (roleName.includes("manager") || roleName.includes("staff") || roleName.includes("admin")) {
    return existing;
  }

  const baseUsername = defaults.username || getEmailPrefix(email);
  const safeUsername = baseUsername + '_' + Date.now().toString().slice(-4);
  const preferences = serializePreferences(defaults.preferences || []);

  await pool.query(
    `
    IF NOT EXISTS (SELECT 1 FROM dbo.CustomerProfiles WHERE user_id = ?)
    BEGIN
      INSERT INTO dbo.CustomerProfiles
        (user_id, username, date_of_birth, gender, country, [language], bio,
         loyalty_points, preferences, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, SYSDATETIME(), SYSDATETIME())
    END
    `,
    [
      userId,
      userId,
      safeUsername,
      defaults.date_of_birth || null,
      defaults.gender || null,
      defaults.country || null,
      defaults.language || null,
      defaults.bio || null,
      defaults.loyalty_points ?? 0,
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
     SET full_name = COALESCE(NULLIF(?, ''), full_name),
         phone = COALESCE(NULLIF(?, ''), phone),
         avatar_url = COALESCE(NULLIF(?, ''), avatar_url),
         updated_at = SYSDATETIME()
     WHERE user_id = ?`,
    [
      full_name !== undefined ? full_name : existing.full_name,
      phone !== undefined ? phone : existing.phone,
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
      gender !== undefined ? sanitizeGender(gender) : sanitizeGender(existing.gender),
      country !== undefined ? country || null : existing.country,
      language !== undefined ? language || null : existing.language,
      bio !== undefined ? bio || null : existing.bio,
      prefsJson ?? null,
      userId,
    ]
  );

  const loyaltyPoints = Number(existing.loyalty_points) || 0;
  // Membership tier logic removed per Fine-Dining equality architecture
  return getProfileForUser(userId, { ensureProfile: false });
}

export function buildLoginUserResponse(row) {
  return formatProfileResponse(row);
}
