import bcrypt from "bcryptjs";
import pool from "../db.js";

export const OTP_EXPIRES_IN_SECONDS = 5 * 60;
export const OTP_EXPIRES_IN_MS = OTP_EXPIRES_IN_SECONDS * 1000;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const PENDING_ACCOUNT_EXPIRES_IN_SECONDS = 5 * 60;
export const PENDING_ACCOUNT_EXPIRES_IN_MS = PENDING_ACCOUNT_EXPIRES_IN_SECONDS * 1000;

const OTP_TABLE = "[dbo].[OtpTokens]";
const USERS_TABLE = "[dbo].[UserAccounts]";

/** Values allowed by CK_OtpTokens_purpose on dbo.OtpTokens */
const ALLOWED_PURPOSES = new Set([
  "EMAIL_VERIFY",
  "PASSWORD_RESET",
  "LOGIN_VERIFY",
  "CHANGE_PASSWORD",
]);

const PURPOSE_ALIASES = {
  verify_account: "EMAIL_VERIFY",
  email_verification: "EMAIL_VERIFY",
  email_verify: "EMAIL_VERIFY",
  EMAIL_VERIFY: "EMAIL_VERIFY",
  EmailVerification: "EMAIL_VERIFY",
  reset_password: "PASSWORD_RESET",
  forgot_password: "PASSWORD_RESET",
  reset: "PASSWORD_RESET",
  PASSWORD_RESET: "PASSWORD_RESET",
  ForgotPassword: "PASSWORD_RESET",
  google_registration: "EMAIL_VERIFY",
  login_mfa: "LOGIN_VERIFY",
  LOGIN_VERIFY: "LOGIN_VERIFY",
  profile_update: "CHANGE_PASSWORD",
  phone_update: "CHANGE_PASSWORD",
  CHANGE_PASSWORD: "CHANGE_PASSWORD",
};

export function normalizeOtpPurpose(purpose) {
  const key = String(purpose || "EMAIL_VERIFY").trim();
  const normalized = PURPOSE_ALIASES[key] || "EMAIL_VERIFY";
  return ALLOWED_PURPOSES.has(normalized) ? normalized : "EMAIL_VERIFY";
}

export function isVerifyAccountPurpose(purpose) {
  return normalizeOtpPurpose(purpose) === "EMAIL_VERIFY";
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
  const expiresAt = record?.expires_at;
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() < Date.now();
}

function isPendingVerificationUser(user) {
  if (!user) return false;
  return !user.email_verified;
}

export async function cleanupExpiredOtps() {
  await pool.query(
    `UPDATE ${OTP_TABLE}
     SET consumed_at = SYSDATETIME()
     WHERE consumed_at IS NULL
       AND verified_at IS NULL
       AND expires_at < SYSDATETIME()`
  );

  await pool.query(
    `DELETE FROM ${OTP_TABLE}
     WHERE consumed_at IS NOT NULL
       AND expires_at < DATEADD(DAY, -7, SYSDATETIME())`
  );
}

export async function cleanupExpiredPendingUsers() {
  await pool.query(
    `DELETE FROM ${OTP_TABLE}
     WHERE consumed_at IS NOT NULL
       AND expires_at < DATEADD(DAY, -7, SYSDATETIME())`
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
     SET consumed_at = SYSDATETIME()
     WHERE LOWER(email) = LOWER(?)
       AND purpose = ?
       AND consumed_at IS NULL`;

  if (userId != null && userId !== "") {
    sql += ` AND user_id = ?`;
    params.push(userId);
  }

  await pool.query(sql, params);
}

export async function saveOtpToken({ email, purpose, otp, userId = null }) {
  const normalizedPurpose = normalizeOtpPurpose(purpose);
  await invalidatePendingOtps({ email, purpose: normalizedPurpose, userId });

  const normalizedEmail = String(email || "").trim().toLowerCase();
  const safeOtp = String(otp || "").trim();
  const otpHash = await bcrypt.hash(safeOtp, 10);

  await pool.query(
    `INSERT INTO ${OTP_TABLE}
      (user_id, email, purpose, otp_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, DATEADD(MINUTE, 5, SYSDATETIME()), SYSDATETIME())`,
    [userId || null, normalizedEmail, normalizedPurpose, otpHash]
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
  let sql = `SELECT TOP 1
       otp_id,
       user_id,
       email,
       purpose,
       otp_hash,
       expires_at,
       verified_at,
       consumed_at,
       created_at
     FROM ${OTP_TABLE}
     WHERE LOWER(email) = LOWER(?)
       AND purpose = ?
       AND consumed_at IS NULL
       AND verified_at IS NULL
     ORDER BY created_at DESC`;

  if (userId != null && userId !== "") {
    sql = `SELECT TOP 1
       otp_id,
       user_id,
       email,
       purpose,
       otp_hash,
       expires_at,
       verified_at,
       consumed_at,
       created_at
     FROM ${OTP_TABLE}
     WHERE LOWER(email) = LOWER(?)
       AND purpose = ?
       AND user_id = ?
       AND consumed_at IS NULL
       AND verified_at IS NULL
     ORDER BY created_at DESC`;
    params.push(userId);
  }

  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
}

export async function findLatestValidOtpForVerify({ email, purpose }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedPurpose = normalizeOtpPurpose(purpose);

  const [rows] = await pool.query(
    `SELECT TOP 1
       otp_id,
       user_id,
       email,
       purpose,
       otp_hash,
       expires_at,
       verified_at,
       consumed_at,
       created_at
     FROM ${OTP_TABLE}
     WHERE LOWER(email) = LOWER(?)
       AND purpose = ?
       AND consumed_at IS NULL
       AND verified_at IS NULL
     ORDER BY created_at DESC`,
    [normalizedEmail, normalizedPurpose]
  );

  return rows[0] || null;
}

export async function markOtpUsed(otpId) {
  await pool.query(
    `UPDATE ${OTP_TABLE}
     SET consumed_at = SYSDATETIME(), verified_at = SYSDATETIME()
     WHERE otp_id = ?`,
    [otpId]
  );
}

export async function markOtpExpired(otpId) {
  await pool.query(
    `UPDATE ${OTP_TABLE}
     SET consumed_at = SYSDATETIME()
     WHERE otp_id = ?`,
    [otpId]
  );
}

export async function markUserEmailVerified(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  await pool.query(
    `UPDATE ${USERS_TABLE}
     SET email_verified = 1, updated_at = SYSDATETIME()
     WHERE LOWER(email) = LOWER(?)`,
    [normalizedEmail]
  );
}

export async function assertPendingVerificationUser(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const [rows] = await pool.query(
    `SELECT TOP 1 user_id, email, email_verified, is_active, created_at
     FROM ${USERS_TABLE}
     WHERE LOWER(email) = LOWER(?)`,
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

  if (!isPendingVerificationUser(row)) {
    return {
      ok: false,
      status: 400,
      message: "This account is already verified.",
    };
  }

  if (
    row.created_at &&
    Date.now() - new Date(row.created_at).getTime() > PENDING_ACCOUNT_EXPIRES_IN_MS
  ) {
    await cleanupExpiredPendingUsers();
    return {
      ok: false,
      status: 410,
      message: "Verification session expired. Please register again.",
    };
  }

  return { ok: true, user: row };
}

export async function checkOtpResendCooldown({ email, purpose, userId = null }) {
  const existing = await findLatestOtpRecord({ email, purpose, userId });
  const createdAt = existing?.created_at;
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

export async function verifyOtpRecord({ email, purpose, otp }) {
  const normalizedPurpose = normalizeOtpPurpose(purpose);
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const submittedOtp = String(otp || "").trim();

  const record = await findLatestValidOtpForVerify({
    email: normalizedEmail,
    purpose: normalizedPurpose,
  });

  if (!record) {
    return {
      ok: false,
      status: 410,
      message: "Verification session expired. Please request a new code.",
    };
  }

  const expiresAt = record.expires_at ? new Date(record.expires_at) : null;
  if (!expiresAt || expiresAt.getTime() <= Date.now()) {
    await markOtpExpired(record.otp_id);
    return {
      ok: false,
      status: 410,
      message: "Verification code expired. Please request a new code.",
    };
  }

  const otpMatches = await bcrypt.compare(submittedOtp, String(record.otp_hash || ""));
  if (!otpMatches) {
    return { ok: false, status: 400, message: "Invalid verification code." };
  }

  await markOtpUsed(record.otp_id);

  if (isVerifyAccountPurpose(normalizedPurpose)) {
    await markUserEmailVerified(normalizedEmail);
  }

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

export async function verifyPasswordResetOtp({ email, otp }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const submittedOtp = String(otp || "").trim();

  const record = await findLatestValidOtpForVerify({
    email: normalizedEmail,
    purpose: "PASSWORD_RESET",
  });

  if (!record) {
    return {
      ok: false,
      status: 410,
      message: "Verification session expired. Please request a new code.",
    };
  }

  const expiresAt = record.expires_at ? new Date(record.expires_at) : null;
  if (!expiresAt || expiresAt.getTime() <= Date.now()) {
    await markOtpExpired(record.otp_id);
    return {
      ok: false,
      status: 410,
      message: "Verification code expired. Please request a new code.",
    };
  }

  const otpMatches = await bcrypt.compare(submittedOtp, String(record.otp_hash || ""));
  if (!otpMatches) {
    return { ok: false, status: 400, message: "Invalid OTP." };
  }

  return { ok: true, record };
}

export async function consumePasswordResetOtp(otpId) {
  await markOtpUsed(otpId);
}
