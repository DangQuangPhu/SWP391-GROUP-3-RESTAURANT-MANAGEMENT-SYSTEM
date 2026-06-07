import pool from "../db.js";

export const OTP_EXPIRES_IN_SECONDS = 5 * 60;
export const OTP_EXPIRES_IN_MS = OTP_EXPIRES_IN_SECONDS * 1000;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const PENDING_ACCOUNT_EXPIRES_IN_SECONDS = 5 * 60;
export const PENDING_ACCOUNT_EXPIRES_IN_MS = PENDING_ACCOUNT_EXPIRES_IN_SECONDS * 1000;

const OTP_TABLE = "[dbo].[OtpTokens]";
const USERS_TABLE = "[dbo].[Users]";

const PURPOSE_ALIASES = {
  verify_account: "EmailVerification",
  email_verification: "EmailVerification",
  EmailVerification: "EmailVerification",
  reset_password: "ForgotPassword",
  forgot_password: "ForgotPassword",
  reset: "ForgotPassword",
  ForgotPassword: "ForgotPassword",
  google_registration: "GoogleRegistration",
  GoogleRegistration: "GoogleRegistration",
  login_mfa: "LoginMfa",
  LoginMfa: "LoginMfa",
  profile_update: "ProfileUpdate",
  ProfileUpdate: "ProfileUpdate",
  phone_update: "ProfileUpdate",
};

export function normalizeOtpPurpose(purpose) {
  const key = String(purpose || "EmailVerification").trim();
  return PURPOSE_ALIASES[key] || "EmailVerification";
}

export function isVerifyAccountPurpose(purpose) {
  return normalizeOtpPurpose(purpose) === "EmailVerification";
}

export function getOtpResendRemainingSeconds(createdAt) {
  if (!createdAt) return 0;
  const elapsed = (Date.now() - new Date(createdAt).getTime()) / 1000;
  return Math.max(0, Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsed));
}

export function isVerificationSentExpired(sentAt) {
  if (!sentAt) return false;
  return Date.now() - new Date(sentAt).getTime() > OTP_EXPIRES_IN_MS;
}

export function isOtpExpired(record) {
  if (!record?.ExpiresAt) return true;
  return new Date(record.ExpiresAt).getTime() < Date.now();
}

function isPendingVerificationUser(user) {
  if (!user) return false;
  if (user.is_email_verified) return false;
  const status = String(user.status || "").toLowerCase();
  return (
    status === "pending" ||
    status === "pending_verification" ||
    status === "inactive" ||
    !status ||
    status !== "active"
  );
}

export async function cleanupExpiredOtps() {
  await pool.query(
    `UPDATE ${OTP_TABLE}
     SET [UsedAt] = SYSDATETIME()
     WHERE [UsedAt] IS NULL
       AND [ExpiresAt] < SYSDATETIME()`
  );
}

export async function cleanupExpiredPendingUsers() {
  const pendingUserFilter = `
    ([EmailVerified] = 0 OR [EmailVerified] IS NULL)
    AND (
      LOWER(COALESCE([AccountStatus], N'')) IN (
        N'pending',
        N'pending_verification',
        N'inactive'
      )
      OR [EmailVerified] = 0
      OR [EmailVerified] IS NULL
    )
    AND [CreatedAt] < DATEADD(SECOND, -?, SYSDATETIME())`;

  await pool.query(
    `UPDATE ${OTP_TABLE}
     SET [UsedAt] = SYSDATETIME()
     WHERE [UsedAt] IS NULL
       AND [UserID] IN (
         SELECT [UserID]
         FROM ${USERS_TABLE}
         WHERE ${pendingUserFilter}
       )`,
    [PENDING_ACCOUNT_EXPIRES_IN_SECONDS]
  );

  await pool.query(
    `DELETE FROM ${OTP_TABLE}
     WHERE [UserID] IN (
       SELECT [UserID]
       FROM ${USERS_TABLE}
       WHERE ${pendingUserFilter}
     )`,
    [PENDING_ACCOUNT_EXPIRES_IN_SECONDS]
  );

  await pool.query(
    `DELETE FROM ${USERS_TABLE}
     WHERE ${pendingUserFilter}`,
    [PENDING_ACCOUNT_EXPIRES_IN_SECONDS]
  );
}

export async function runOtpLifecycleCleanup() {
  await cleanupExpiredOtps();
  await cleanupExpiredPendingUsers();
}

export async function invalidatePendingOtps({ email, purpose, userId = null }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedPurpose = normalizeOtpPurpose(purpose);
  const params = [normalizedEmail, normalizedPurpose];
  let sql = `UPDATE ${OTP_TABLE}
     SET [UsedAt] = SYSDATETIME()
     WHERE LOWER([Email]) = LOWER(?)
       AND [Purpose] = ?
       AND [UsedAt] IS NULL`;

  if (userId != null && userId !== "") {
    sql += ` AND [UserID] = ?`;
    params.push(userId);
  }

  await pool.query(sql, params);
}

export async function saveOtpToken({ email, purpose, otp, userId = null }) {
  const normalizedPurpose = normalizeOtpPurpose(purpose);
  await invalidatePendingOtps({ email, purpose: normalizedPurpose, userId });

  const normalizedEmail = String(email || "").trim().toLowerCase();
  const safeOtp = String(otp || "").trim();

  await pool.query(
    `INSERT INTO ${OTP_TABLE}
      ([UserID], [Email], [Purpose], [OtpHash], [ExpiresAt], [CreatedAt])
     VALUES (?, ?, ?, ?, DATEADD(SECOND, ?, SYSDATETIME()), SYSDATETIME())`,
    [userId || null, normalizedEmail, normalizedPurpose, safeOtp, OTP_EXPIRES_IN_SECONDS]
  );

  return {
    email: normalizedEmail,
    purpose: normalizedPurpose,
    expiresIn: OTP_EXPIRES_IN_SECONDS,
    resendCooldown: OTP_RESEND_COOLDOWN_SECONDS,
  };
}

export async function findLatestOtpRecord({ email, purpose, userId = null }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedPurpose = normalizeOtpPurpose(purpose);
  const params = [normalizedEmail, normalizedPurpose];
  let sql = `SELECT TOP 1 *
     FROM ${OTP_TABLE}
     WHERE LOWER([Email]) = LOWER(?)
       AND [Purpose] = ?
       AND [UsedAt] IS NULL
     ORDER BY [CreatedAt] DESC`;

  if (userId != null && userId !== "") {
    sql = `SELECT TOP 1 *
     FROM ${OTP_TABLE}
     WHERE LOWER([Email]) = LOWER(?)
       AND [Purpose] = ?
       AND [UserID] = ?
       AND [UsedAt] IS NULL
     ORDER BY [CreatedAt] DESC`;
    params.push(userId);
  }

  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
}

export async function markOtpUsed(otpId) {
  await pool.query(
    `UPDATE ${OTP_TABLE}
     SET [UsedAt] = SYSDATETIME()
     WHERE [OtpID] = ?`,
    [otpId]
  );
}

export async function markOtpExpired(otpId) {
  await pool.query(
    `UPDATE ${OTP_TABLE}
     SET [UsedAt] = SYSDATETIME()
     WHERE [OtpID] = ?`,
    [otpId]
  );
}

export async function assertPendingVerificationUser(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const [rows] = await pool.query(
    `SELECT TOP 1 * FROM ${USERS_TABLE} WHERE LOWER([Email]) = LOWER(?)`,
    [normalizedEmail]
  );
  const row = rows[0];
  if (!row) {
    return {
      ok: false,
      status: 410,
      message: "Verification session expired. Please register again.",
    };
  }

  const user = {
    user_id: row.UserID ?? row.user_id,
    email: row.Email ?? row.email,
    is_email_verified: row.EmailVerified ?? row.is_email_verified,
    status: row.AccountStatus ?? row.status,
    created_at: row.CreatedAt ?? row.created_at,
  };

  if (!isPendingVerificationUser(user)) {
    return {
      ok: false,
      status: 400,
      message: "This account is already verified.",
    };
  }

  if (
    user.created_at &&
    Date.now() - new Date(user.created_at).getTime() > PENDING_ACCOUNT_EXPIRES_IN_MS
  ) {
    await cleanupExpiredPendingUsers();
    return {
      ok: false,
      status: 410,
      message: "Verification session expired. Please register again.",
    };
  }

  return { ok: true, user };
}

export async function checkOtpResendCooldown({ email, purpose, userId = null }) {
  const existing = await findLatestOtpRecord({ email, purpose, userId });
  const createdAt = existing?.CreatedAt ?? existing?.createdAt;
  if (!createdAt) {
    return { allowed: true, retryAfter: 0 };
  }

  const retryAfter = getOtpResendRemainingSeconds(createdAt);
  if (retryAfter > 0) {
    return {
      allowed: false,
      retryAfter,
      message: "Please wait before requesting another OTP.",
    };
  }

  return { allowed: true, retryAfter: 0 };
}

export async function verifyOtpRecord({ email, purpose, otp, userId = null }) {
  await runOtpLifecycleCleanup();

  const normalizedPurpose = normalizeOtpPurpose(purpose);

  if (isVerifyAccountPurpose(purpose)) {
    const pendingCheck = await assertPendingVerificationUser(email);
    if (!pendingCheck.ok) {
      return {
        ok: false,
        status: pendingCheck.status,
        message: pendingCheck.message,
      };
    }
  }

  const record = await findLatestOtpRecord({
    email,
    purpose: normalizedPurpose,
    userId,
  });

  if (!record) {
    return {
      ok: false,
      status: 400,
      message: "No active OTP found. Please request a new code.",
    };
  }

  if (isOtpExpired(record)) {
    await markOtpExpired(record.OtpID);
    return {
      ok: false,
      status: 400,
      message: "Verification code expired. Please resend a new code.",
    };
  }

  if (String(record.OtpHash || "").trim() !== String(otp || "").trim()) {
    return { ok: false, status: 400, message: "Invalid verification code." };
  }

  await markOtpUsed(record.OtpID);
  return { ok: true, record };
}

export function buildOtpSuccessResponse(message) {
  return {
    success: true,
    message,
    expiresIn: OTP_EXPIRES_IN_SECONDS,
    resendCooldown: OTP_RESEND_COOLDOWN_SECONDS,
  };
}
