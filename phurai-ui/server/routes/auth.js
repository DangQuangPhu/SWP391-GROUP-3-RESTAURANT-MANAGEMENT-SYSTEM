import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import pool from "../db.js";
import {
  sendVerificationEmail,
  sendOtpEmail,
  isSmtpConfigured,
  RESEND_COOLDOWN_SECONDS,
} from "../email.js";
import {
  hashPassword,
  verifyPassword,
  generateOtpCode,
  generateSecureToken,
  isPasswordStrong,
  PASSWORD_RULES_MESSAGE,
} from "../utils/password.js";
import {
  isValidEmail,
  normalizePhone,
  isValidVietnamPhone,
  validateProfilePayload,
  validatePhoneUpdatePayload,
  isPhoneOnlyProfileUpdate,
  isAtLeast13YearsOld,
  parseDateOfBirth,
} from "../utils/validation.js";
import {
  OTP_EXPIRES_IN_SECONDS,
  OTP_EXPIRES_IN_MS,
  OTP_RESEND_COOLDOWN_SECONDS,
  runOtpLifecycleCleanup,
  saveOtpToken,
  verifyOtpRecord,
  findLatestOtpRecord,
  isVerificationSentExpired,
  invalidatePendingOtps,
  markOtpExpired,
  assertPendingVerificationUser,
  checkOtpResendCooldown,
  buildOtpSuccessResponse,
  getOtpResendRemainingSeconds,
  isVerifyAccountPurpose,
} from "../utils/otpService.js";

const router = express.Router();
const USERS_TABLE = "[dbo].[Users]";
const USER_PROFILES_TABLE = "[dbo].[UserProfiles]";

/** Live SQL Server Users table column names (PascalCase + legacy snake_case profile fields). */
const USER_SQL = {
  id: "UserID",
  username: "Username",
  phoneNumber: "PhoneNumber",
  passwordHash: "PasswordHash",
  avatarUrl: "AvatarUrl",
  updatedAt: "UpdatedAt",
  firstName: "first_name",
  lastName: "last_name",
  dateOfBirth: "date_of_birth",
};

/** Live SQL Server UserProfiles table column names. */
const USER_PROFILE_SQL = {
  userId: "UserID",
  gender: "Gender",
  bio: "Bio",
  address: "AddressLine",
  country: "country",
  language: "language",
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AVATAR_UPLOAD_DIR = path.join(__dirname, "../uploads/avatars");
fs.mkdirSync(AVATAR_UPLOAD_DIR, { recursive: true });

const SYSTEM_AVATAR_PATHS = [
  "/avatars/avatar-1.svg",
  "/avatars/avatar-2.svg",
  "/avatars/avatar-3.svg",
  "/avatars/avatar-4.svg",
  "/avatars/avatar-5.svg",
];

const ALLOWED_SYSTEM_AVATARS = new Set(SYSTEM_AVATAR_PATHS);

function normalizeStoredAvatarUrl(avatarUrl) {
  const trimmed = String(avatarUrl || "").trim();
  if (!trimmed) return "";

  const legacyPng = trimmed.match(/^\/avatars\/avatar-([1-5])\.png$/i);
  if (legacyPng) {
    return `/avatars/avatar-${legacyPng[1]}.svg`;
  }

  return trimmed;
}

function canonicalSystemAvatarPath(avatarUrl) {
  const normalized = normalizeStoredAvatarUrl(avatarUrl);
  if (!normalized.startsWith("/avatars/")) return normalized;
  return ALLOWED_SYSTEM_AVATARS.has(normalized) ? normalized : "";
}

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, AVATAR_UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".png";
      const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext) ? ext : ".png";
      cb(null, `user-${req.params.userId}-${Date.now()}${safeExt}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("INVALID_AVATAR_TYPE"));
    }
    },
  });

const GOOGLE_TOKENINFO = "https://oauth2.googleapis.com/tokeninfo";

const OTP_VERIFY_PURPOSE = "verify_account";
const OTP_RESET_PURPOSE = "reset_password";

function getResendRemainingSeconds(sentAt) {
  return getOtpResendRemainingSeconds(sentAt);
}

function normalizeUserRow(row) {
  if (!row) return null;
  return {
    user_id: row.user_id ?? row.UserID,
    email: row.email ?? row.Email,
    username: row.username ?? row.Username,
    password_hash: row.password_hash ?? row.PasswordHash,
    status: row.status ?? row.AccountStatus,
    is_email_verified: row.is_email_verified ?? row.EmailVerified,
    phone_number: row.phone_number ?? row.PhoneNumber,
    avatar_url: row.avatar_url ?? row.AvatarUrl,
    google_avatar_url: row.google_avatar_url ?? null,
    avatar_source: row.avatar_source ?? "system",
    last_login_at: row.last_login_at ?? row.LastLoginAt,
    created_at: row.created_at ?? row.CreatedAt,
    updated_at: row.updated_at ?? row.UpdatedAt,
    first_name: row.first_name ?? "",
    last_name: row.last_name ?? "",
    date_of_birth: row.date_of_birth ?? null,
    google_sub: row.google_sub ?? null,
    auth_provider: row.auth_provider ?? "LOCAL",
    verification_token: row.verification_token ?? null,
    verification_sent_at: row.verification_sent_at ?? null,
    password_reset_token: row.password_reset_token ?? null,
    password_reset_expires_at: row.password_reset_expires_at ?? null,
    password_reset_sent_at: row.password_reset_sent_at ?? null,
    password_reset_verified_token: row.password_reset_verified_token ?? null,
    LockoutUntil: row.LockoutUntil ?? null,
    FailedLoginCount: row.FailedLoginCount ?? 0,
  };
}

function composeFullName(firstName, lastName) {
  const first = String(firstName || "").trim();
  const last = String(lastName || "").trim();
  if (!first && !last) return "";
  if (!last) return first;
  // Google OAuth sometimes stores the full name in first_name and the family name again in last_name.
  if (first !== last && first.endsWith(last)) return first;
  return `${first} ${last}`.trim();
}

function normalizeProfileRow(row) {
  if (!row) return null;
  return {
    gender: row.gender ?? row.Gender ?? "",
    bio: row.bio ?? row.Bio ?? "",
    address: row.address ?? row.Address ?? row.AddressLine ?? "",
    country: row.country ?? row.Country ?? "",
    language: row.language ?? row.Language ?? "",
  };
}

function mapUserToFrontend(row, profileRow = null) {
  if (!row) return null;
  const normalized = normalizeUserRow(row);
  const profile = normalizeProfileRow(profileRow);
  const firstName = normalized.first_name || "";
  const lastName = normalized.last_name || "";
  const username = normalized.username || "";
  return {
    id: normalized.user_id,
    userId: normalized.user_id,
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    fullName: composeFullName(firstName, lastName) || username,
    username: String(username).trim(),
    nickname: String(firstName || username).trim(),
    email: normalized.email || "",
    phoneNumber: normalized.phone_number || "",
    phone: normalized.phone_number || "",
    dateOfBirth: normalized.date_of_birth
      ? new Date(normalized.date_of_birth).toISOString().slice(0, 10)
      : "",
    gender: profile?.gender || "",
    bio: profile?.bio || "",
    address: profile?.address || "",
    country: profile?.country || "",
    language: profile?.language || "",
    avatarUrl: normalizeStoredAvatarUrl(normalized.avatar_url),
    googleAvatarUrl: normalized.google_avatar_url || "",
    avatarSource: normalized.avatar_source || "system",
    authProvider: normalized.auth_provider || "LOCAL",
    accountStatus: normalized.status || "",
    emailVerified: Boolean(normalized.is_email_verified),
  };
}

async function findUserProfileRow(userId) {
  const [rows] = await pool.query(
    `SELECT TOP 1 * FROM ${USER_PROFILES_TABLE} WHERE [${USER_PROFILE_SQL.userId}] = ?`,
    [userId]
  );
  return rows[0] || null;
}

async function upsertUserProfile(userId, patch = {}) {
  const gender = patch.gender ?? null;
  const bio = patch.bio ?? null;
  const address = patch.address ?? null;
  const country = patch.country ?? null;
  const language = patch.language ?? null;

  const [existing] = await pool.query(
    `SELECT TOP 1 [${USER_PROFILE_SQL.userId}] FROM ${USER_PROFILES_TABLE} WHERE [${USER_PROFILE_SQL.userId}] = ?`,
    [userId]
  );

  if (existing[0]) {
    await pool.query(
      `UPDATE ${USER_PROFILES_TABLE}
       SET [${USER_PROFILE_SQL.gender}] = ?, [${USER_PROFILE_SQL.bio}] = ?, [${USER_PROFILE_SQL.address}] = ?,
           [${USER_PROFILE_SQL.country}] = ?, [${USER_PROFILE_SQL.language}] = ?, [UpdatedAt] = SYSDATETIME()
       WHERE [${USER_PROFILE_SQL.userId}] = ?`,
      [gender, bio, address, country, language, userId]
    );
    return;
  }

  await pool.query(
    `INSERT INTO ${USER_PROFILES_TABLE}
      ([${USER_PROFILE_SQL.userId}], [${USER_PROFILE_SQL.gender}], [${USER_PROFILE_SQL.bio}], [${USER_PROFILE_SQL.address}],
       [${USER_PROFILE_SQL.country}], [${USER_PROFILE_SQL.language}])
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, gender, bio, address, country, language]
  );
}

async function findUserById(userId) {
  const [rows] = await pool.query(
    `SELECT TOP 1 * FROM ${USERS_TABLE} WHERE [UserID] = ?`,
    [userId]
  );
  return normalizeUserRow(rows[0]) || null;
}

async function findUserByEmail(email) {
  const [rows] = await pool.query(
    `SELECT TOP 1 * FROM ${USERS_TABLE} WHERE LOWER([Email]) = LOWER(?)`,
    [email]
  );
  return normalizeUserRow(rows[0]) || null;
}

async function findUserByUsername(username) {
  const [rows] = await pool.query(
    `SELECT TOP 1 * FROM ${USERS_TABLE} WHERE LOWER([Username]) = LOWER(?)`,
    [username]
  );
  return normalizeUserRow(rows[0]) || null;
}

async function findUserByEmailOrUsername(identifier) {
  const trimmed = String(identifier || "").trim();
  const [rows] = await pool.query(
    `SELECT TOP 1 * FROM ${USERS_TABLE}
     WHERE LOWER([Email]) = LOWER(?) OR LOWER([Username]) = LOWER(?)`,
    [trimmed, trimmed]
  );
  return normalizeUserRow(rows[0]) || null;
}

async function findUserByEmailOrPhone(identifier) {
  const trimmed = String(identifier || "").trim();
  if (trimmed.includes("@")) {
    return findUserByEmail(trimmed.toLowerCase());
  }
  const phone = normalizePhone(trimmed);
  const [rows] = await pool.query(
    `SELECT TOP 1 * FROM ${USERS_TABLE} WHERE [PhoneNumber] = ?`,
    [phone]
  );
  return normalizeUserRow(rows[0]) || null;
}

async function buildUniqueUsername(preferred) {
  let username = preferred;
  let suffix = 1;
  while (await findUserByUsername(username)) {
    username = `${preferred}${suffix}`;
    suffix += 1;
  }
      return username;
    }

async function verifyGoogleIdToken(credential) {
  const response = await fetch(
    `${GOOGLE_TOKENINFO}?id_token=${encodeURIComponent(credential)}`
  );
  if (!response.ok) throw new Error("Invalid Google token.");
  const payload = await response.json();
  const expectedClientId = process.env.GOOGLE_CLIENT_ID;
  if (expectedClientId && payload.aud !== expectedClientId) {
    throw new Error("Google token audience mismatch.");
  }
  return payload;
}

async function resolveGooglePayload({ credential, accessToken, email, name, picture }) {
  if (credential) {
    return verifyGoogleIdToken(credential);
  }

  if (accessToken) {
    const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error("Invalid Google access token.");
    const data = await response.json();
    return {
      sub: data.sub,
      email: data.email,
      email_verified: data.email_verified ? "true" : "false",
      given_name: data.given_name,
      family_name: data.family_name,
      picture: data.picture,
    };
  }

  if (email && process.env.NODE_ENV !== "production") {
    const nameParts = String(name || "").trim().split(/\s+/).filter(Boolean);
    return {
      sub: `dev-${String(email).trim().toLowerCase()}`,
      email: String(email).trim().toLowerCase(),
      email_verified: "true",
      given_name: nameParts[0] || String(email).split("@")[0] || "Google",
      family_name: nameParts.slice(1).join(" "),
      picture: picture || "",
    };
  }

  return null;
}

function validateRegisterBody(body) {
  const {
    firstName,
    lastName,
    username,
    email,
    phoneNumber,
    dateOfBirth,
    password,
    confirmPassword,
  } = body;

  const normalized = {
    firstName: String(firstName || "").trim(),
    lastName: String(lastName || "").trim(),
    username: String(username || "").trim(),
    email: String(email || "").trim().toLowerCase(),
    phoneNumber: String(phoneNumber || "").trim(),
    dateOfBirth,
    password: password || "",
    confirmPassword: confirmPassword || "",
  };

  const errors = {};

  if (!normalized.firstName) errors.firstName = "First name is required.";
  if (!normalized.lastName) errors.lastName = "Last name is required.";
  if (!normalized.username) errors.username = "Username is required.";
  if (!normalized.email) errors.email = "Email is required.";
  else if (!isValidEmail(normalized.email)) errors.email = "Enter a valid email address.";
  if (!normalized.phoneNumber) errors.phoneNumber = "Phone number is required.";
  else if (!/^\d+$/.test(normalizePhone(normalized.phoneNumber))) {
    errors.phoneNumber = "Phone number must contain digits only.";
  } else if (!isValidVietnamPhone(normalized.phoneNumber)) {
    errors.phoneNumber = "Phone number must be 10–11 digits.";
  }
  if (!normalized.dateOfBirth) errors.dateOfBirth = "Date of birth is required.";
  else if (!parseDateOfBirth(normalized.dateOfBirth)) {
    errors.dateOfBirth = "Enter a valid date of birth.";
  } else if (!isAtLeast13YearsOld(normalized.dateOfBirth)) {
    errors.dateOfBirth = "You must be at least 13 years old.";
  }
  if (!normalized.password) errors.password = "Password is required.";
  if (!normalized.confirmPassword) errors.confirmPassword = "Confirm password is required.";
  if (normalized.password && normalized.confirmPassword && normalized.password !== normalized.confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }
  if (normalized.password && !isPasswordStrong(normalized.password)) {
    errors.password = PASSWORD_RULES_MESSAGE;
  }

  return { errors, normalized: { ...normalized, phoneNumber: normalizePhone(normalized.phoneNumber) } };
}

// POST /register
router.post("/register", async (req, res) => {
  const { errors, normalized } = validateRegisterBody(req.body);
  if (Object.keys(errors).length) {
    const firstError = Object.values(errors)[0];
    return res.status(400).json({
      success: false,
      message: firstError || "Validation failed.",
      errors,
    });
  }

  try {
    if (await findUserByEmail(normalized.email)) {
      return res.status(409).json({ success: false, field: "email", message: "Email already exists." });
    }
    if (await findUserByUsername(normalized.username)) {
      return res.status(409).json({ success: false, field: "username", message: "Username already exists." });
    }

    const [phoneRows] = await pool.query(
      `SELECT TOP 1 [UserID] FROM ${USERS_TABLE} WHERE [PhoneNumber] = ?`,
      [normalized.phoneNumber]
    );
    if (phoneRows[0]) {
      return res.status(409).json({
        success: false,
        field: "phoneNumber",
        message: "Phone number already exists.",
      });
    }

    const passwordHash = hashPassword(normalized.password);
    const otp = generateOtpCode();

    const [insertRows] = await pool.query(
      `INSERT INTO ${USERS_TABLE}
        ([Email], [Username], [PasswordHash], [AccountStatus], [EmailVerified], [PhoneNumber],
         [CreatedAt], [UpdatedAt], [first_name], [last_name], [date_of_birth], [auth_provider],
         [verification_token], [verification_sent_at])
       OUTPUT INSERTED.[UserID]
       VALUES (?, ?, ?, 'pending_verification', 0, ?, SYSDATETIME(), SYSDATETIME(), ?, ?, ?, 'LOCAL', ?, SYSDATETIME())`,
      [
        normalized.email,
        normalized.username,
        passwordHash,
        normalized.phoneNumber,
        normalized.firstName,
        normalized.lastName,
        normalized.dateOfBirth,
        otp,
      ]
    );

    const userId = insertRows[0]?.UserID ?? insertRows[0]?.user_id;
    if (!userId) {
      return res.status(500).json({ success: false, message: "Registration failed." });
    }

    await sendVerificationEmail(normalized.email, otp);
    await saveOtpToken({
      email: normalized.email,
      purpose: OTP_VERIFY_PURPOSE,
      otp,
      userId,
    });

    return res.status(201).json({
      success: true,
      userId,
      email: normalized.email,
      message: "OTP sent successfully.",
      expiresIn: OTP_EXPIRES_IN_SECONDS,
      resendCooldown: OTP_RESEND_COOLDOWN_SECONDS,
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ success: false, message: err.message || "Registration failed." });
  }
});

// POST /request-otp — email + purpose (OtpTokens table)
router.post("/request-otp", async (req, res) => {
  try {
    const { email, purpose = OTP_VERIFY_PURPOSE } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ success: false, message: "Enter a valid email address." });
    }

    await runOtpLifecycleCleanup();

    let pendingUserId = null;
    if (isVerifyAccountPurpose(purpose)) {
      const pendingCheck = await assertPendingVerificationUser(normalizedEmail);
      if (!pendingCheck.ok) {
        return res.status(pendingCheck.status).json({
          success: false,
          message: pendingCheck.message,
        });
      }
      pendingUserId = pendingCheck.user?.user_id ?? null;
    }

    const otp = generateOtpCode();
    await sendOtpEmail({ to: normalizedEmail, otp, purpose });
    await saveOtpToken({
      email: normalizedEmail,
      purpose,
      otp,
      userId: pendingUserId,
    });

    return res.json(buildOtpSuccessResponse("OTP sent successfully."));
  } catch (error) {
    console.error("[OTP] request failed:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Could not send OTP email.",
    });
  }
});

// POST /resend-otp — invalidate previous code and send a new one
router.post("/resend-otp", async (req, res) => {
  try {
    const { email, purpose = OTP_VERIFY_PURPOSE } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ success: false, message: "Enter a valid email address." });
    }

    await runOtpLifecycleCleanup();

    let pendingUserId = null;
    if (isVerifyAccountPurpose(purpose)) {
      const pendingCheck = await assertPendingVerificationUser(normalizedEmail);
      if (!pendingCheck.ok) {
        return res.status(pendingCheck.status).json({
          success: false,
          message: pendingCheck.message,
        });
      }
      pendingUserId = pendingCheck.user?.user_id ?? null;
    }

    const cooldown = await checkOtpResendCooldown({
      email: normalizedEmail,
      purpose,
      userId: pendingUserId,
    });
    if (!cooldown.allowed) {
      return res.status(429).json({
        success: false,
        message: cooldown.message,
        retryAfter: cooldown.retryAfter,
        retryAfterSeconds: cooldown.retryAfter,
      });
    }

    const otp = generateOtpCode();
    await sendOtpEmail({ to: normalizedEmail, otp, purpose });
    await saveOtpToken({
      email: normalizedEmail,
      purpose,
      otp,
      userId: pendingUserId,
    });

    return res.json(buildOtpSuccessResponse("A new OTP has been sent."));
  } catch (error) {
    console.error("[OTP] resend failed:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Could not resend OTP email.",
    });
  }
});

// POST /verify-otp — email+purpose (OtpTokens) or userId (Users + OtpTokens)
router.post("/verify-otp", async (req, res) => {
  const { email, otp, purpose = OTP_VERIFY_PURPOSE, userId } = req.body;
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (normalizedEmail && !userId) {
    try {
      if (!otp) {
        return res.status(400).json({ success: false, message: "Email and OTP are required." });
      }

      await runOtpLifecycleCleanup();

      if (isVerifyAccountPurpose(purpose)) {
        const pendingCheck = await assertPendingVerificationUser(normalizedEmail);
        if (!pendingCheck.ok) {
          return res.status(pendingCheck.status).json({
            success: false,
            message: pendingCheck.message,
          });
        }
      }

      const result = await verifyOtpRecord({
        email: normalizedEmail,
        purpose,
        otp,
      });

      if (!result.ok) {
        return res.status(result.status).json({ success: false, message: result.message });
      }

      const user = await findUserByEmail(normalizedEmail);
      if (user && purpose === OTP_VERIFY_PURPOSE) {
        await pool.query(
          `UPDATE ${USERS_TABLE}
           SET [EmailVerified] = 1,
               [verification_token] = NULL,
               [verification_sent_at] = NULL,
               [AccountStatus] = 'active',
               [UpdatedAt] = SYSDATETIME()
           WHERE [UserID] = ?`,
          [user.user_id]
        );

        await invalidatePendingOtps({
          email: normalizedEmail,
          purpose: OTP_VERIFY_PURPOSE,
          userId: user.user_id,
        });

        const updated = await findUserById(user.user_id);
        return res.json({
          success: true,
          message: "Email verified successfully.",
          user: mapUserToFrontend(updated),
        });
      }

      return res.json({ success: true, message: "OTP verified successfully." });
    } catch (error) {
      console.error("[OTP] verify failed:", error);
      return res.status(500).json({ success: false, message: "Could not verify OTP." });
    }
  }

  if (!userId || !otp) {
    return res.status(400).json({ success: false, message: "User ID and OTP are required." });
  }

  try {
    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "Account not found." });
    }

    await runOtpLifecycleCleanup();

    if (isVerifyAccountPurpose(OTP_VERIFY_PURPOSE)) {
      const pendingCheck = await assertPendingVerificationUser(user.email);
      if (!pendingCheck.ok) {
        return res.status(pendingCheck.status).json({
          success: false,
          message: pendingCheck.message,
        });
      }
    }

    if (isVerificationSentExpired(user.verification_sent_at)) {
      await pool.query(
        `UPDATE ${USERS_TABLE}
         SET [verification_token] = NULL, [UpdatedAt] = SYSDATETIME()
         WHERE [UserID] = ?`,
        [userId]
      );
      const latest = await findLatestOtpRecord({
        email: user.email,
        purpose: OTP_VERIFY_PURPOSE,
        userId,
      });
      if (latest?.OtpID) {
        await markOtpExpired(latest.OtpID);
      }
      return res.status(400).json({
        success: false,
        message: "Verification code expired. Please resend a new code.",
      });
    }

    const tokenMatchesUser = String(user.verification_token || "").trim() === String(otp).trim();
    const tokenResult = await verifyOtpRecord({
      email: user.email,
      purpose: OTP_VERIFY_PURPOSE,
      otp,
      userId,
    });

    if (!tokenMatchesUser && !tokenResult.ok) {
      return res.status(400).json({
        success: false,
        message: tokenResult.message || "Invalid verification code.",
      });
    }

    if (tokenMatchesUser && !tokenResult.ok) {
      await invalidatePendingOtps({
        email: user.email,
        purpose: OTP_VERIFY_PURPOSE,
        userId,
      });
    }

    await pool.query(
      `UPDATE ${USERS_TABLE}
       SET [EmailVerified] = 1,
           [verification_token] = NULL,
           [verification_sent_at] = NULL,
           [AccountStatus] = 'active',
           [UpdatedAt] = SYSDATETIME()
       WHERE [UserID] = ?`,
      [userId]
    );

    await invalidatePendingOtps({
      email: user.email,
      purpose: OTP_VERIFY_PURPOSE,
      userId,
    });

    const updated = await findUserById(userId);
    return res.json({
      success: true,
      message: "Email verified successfully.",
      user: mapUserToFrontend(updated),
    });
  } catch (err) {
    console.error("Verify OTP error:", err);
    return res.status(500).json({ success: false, message: err.message || "Verification failed." });
  }
});

// GET /verify (link compatibility)
router.get("/verify", async (req, res) => {
  const { uid, token } = req.query;
  if (!uid || !token) return res.status(400).json({ message: "Missing uid or token." });

  try {
    const user = await findUserById(uid);
    if (!user) return res.status(404).json({ message: "Account not found." });
    if (String(user.verification_token || "").trim() !== String(token).trim()) {
      return res.status(400).json({ message: "Invalid verification code." });
    }
    if (isVerificationSentExpired(user.verification_sent_at)) {
      return res.status(400).json({ message: "Verification code expired. Please resend a new code." });
    }
    await pool.query(
      `UPDATE ${USERS_TABLE}
       SET [EmailVerified] = 1, [verification_token] = NULL, [AccountStatus] = 'active', [UpdatedAt] = SYSDATETIME()
       WHERE [UserID] = ?`,
      [uid]
    );
    const updated = await findUserById(uid);
    return res.json({ message: "Email verified successfully.", user: mapUserToFrontend(updated) });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Verification failed." });
  }
});

// POST /resend-verification-code
router.post("/resend-verification-code", async (req, res) => {
  const { userId, email } = req.body;
  const normalizedEmail = String(email || "").trim().toLowerCase();

  try {
    let user = null;
    if (userId) {
      user = await findUserById(userId);
    } else if (normalizedEmail) {
      user = await findUserByEmail(normalizedEmail);
    }

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    if (user.is_email_verified) {
      return res.status(400).json({ success: false, message: "Account is already verified." });
    }

    await runOtpLifecycleCleanup();
    const pendingCheck = await assertPendingVerificationUser(user.email);
    if (!pendingCheck.ok) {
      return res.status(pendingCheck.status).json({
        success: false,
        message: pendingCheck.message,
      });
    }

    const cooldown = await checkOtpResendCooldown({
      email: user.email,
      purpose: OTP_VERIFY_PURPOSE,
      userId: user.user_id,
    });
    if (!cooldown.allowed) {
      return res.status(429).json({
        success: false,
        message: cooldown.message,
        retryAfter: cooldown.retryAfter,
        retryAfterSeconds: cooldown.retryAfter,
      });
    }

    const otp = generateOtpCode();
    await pool.query(
      `UPDATE ${USERS_TABLE}
       SET [verification_token] = ?, [verification_sent_at] = SYSDATETIME(), [UpdatedAt] = SYSDATETIME()
       WHERE [UserID] = ?`,
      [otp, user.user_id]
    );

    await sendVerificationEmail(user.email, otp);
    await saveOtpToken({
      email: user.email,
      purpose: OTP_VERIFY_PURPOSE,
      otp,
      userId: user.user_id,
    });
    return res.json({
      ...buildOtpSuccessResponse("A new OTP has been sent."),
      email: user.email,
    });
  } catch (err) {
    console.error("Resend verification error:", err);
    return res.status(500).json({ success: false, message: err.message || "Resend failed." });
  }
});

// POST /login
router.post("/login", async (req, res) => {
  const { identifier, password } = req.body;
  const trimmed = String(identifier || "").trim();
  if (!trimmed || !password) {
    return res.status(400).json({ message: "Email or username and password are required." });
  }

  try {
    const user = await findUserByEmailOrUsername(trimmed);
    if (!user) {
      return res.status(404).json({
        message: "Account does not exist. Please check your email or username.",
      });
    }

    if (user.LockoutUntil && new Date(user.LockoutUntil).getTime() > Date.now()) {
      return res.status(403).json({ message: "Account is temporarily locked. Try again later." });
    }

    if (!user.password_hash || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ message: "Incorrect password. Please try again." });
    }

    if (!user.is_email_verified) {
      return res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email before logging in.",
        userId: user.user_id,
        email: user.email,
      });
    }

    const status = String(user.status || "").toLowerCase();
    if (status && status !== "active") {
      return res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email before logging in.",
        userId: user.user_id,
        email: user.email,
      });
    }

    await pool.query(
      `UPDATE ${USERS_TABLE} SET [LastLoginAt] = SYSDATETIME(), [UpdatedAt] = SYSDATETIME(), [FailedLoginCount] = 0 WHERE [UserID] = ?`,
      [user.user_id]
    );

    return res.json({
      success: true,
      message: "Login successful.",
      user: mapUserToFrontend(user),
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: err.message || "Login failed." });
  }
});

// POST /google-register
router.post("/google-register", async (req, res) => {
  const { credential, accessToken, email, name, picture } = req.body;

  try {
    console.log("[GOOGLE REGISTER] request received:", {
      hasCredential: Boolean(credential),
      hasAccessToken: Boolean(accessToken),
      email,
    });

    const payload = await resolveGooglePayload({ credential, accessToken, email, name, picture });
    if (!payload) {
      return res.status(400).json({
        success: false,
        message: "Missing Google credential or email.",
      });
    }

    if (payload.email_verified !== "true" && payload.email_verified !== true) {
      return res.status(400).json({ success: false, message: "Google email is not verified." });
    }

    const normalizedEmail = String(payload.email || "").trim().toLowerCase();
    const firstName = payload.given_name || "";
    const lastName = payload.family_name || "";
    const googleSub = payload.sub;
    const avatarUrl = payload.picture || "";
    const usernameBase = (normalizedEmail.split("@")[0] || "user")
      .replace(/[^a-zA-Z0-9._]/g, "")
      .toLowerCase();
    const otp = generateOtpCode();

    let user = await findUserByEmail(normalizedEmail);
    let userId;

    if (user) {
      if (user.is_email_verified) {
        return res.status(409).json({
          success: false,
          message: "This Google account is already registered. Please sign in.",
        });
      }

      userId = user.user_id;
      await pool.query(
        `UPDATE ${USERS_TABLE}
         SET [google_sub] = ?, [first_name] = ?, [last_name] = ?,
             [google_avatar_url] = ?,
             [AvatarUrl] = CASE
               WHEN [avatar_source] = 'custom' OR [avatar_source] = 'system' THEN [AvatarUrl]
               ELSE ?
             END,
             [avatar_source] = CASE
               WHEN [avatar_source] = 'custom' OR [avatar_source] = 'system' THEN [avatar_source]
               ELSE 'google'
             END,
             [auth_provider] = 'GOOGLE', [verification_token] = ?, [verification_sent_at] = SYSDATETIME(),
             [UpdatedAt] = SYSDATETIME()
         WHERE [UserID] = ?`,
        [googleSub, firstName, lastName, avatarUrl || null, avatarUrl || null, otp, userId]
      );
    } else {
      const username = await buildUniqueUsername(usernameBase);
      const [insertRows] = await pool.query(
        `INSERT INTO ${USERS_TABLE}
          ([Email], [Username], [PasswordHash], [AccountStatus], [EmailVerified], [AvatarUrl], [google_avatar_url], [avatar_source],
           [CreatedAt], [UpdatedAt], [first_name], [last_name], [google_sub], [auth_provider],
           [verification_token], [verification_sent_at])
         OUTPUT INSERTED.[UserID]
         VALUES (?, ?, NULL, 'pending', 0, ?, ?, 'google', SYSDATETIME(), SYSDATETIME(), ?, ?, ?, 'GOOGLE', ?, SYSDATETIME())`,
        [
          normalizedEmail,
          username,
          avatarUrl || null,
          avatarUrl || null,
          firstName,
          lastName,
          googleSub,
          otp,
        ]
      );
      userId = insertRows[0]?.UserID ?? insertRows[0]?.user_id;
    }

    if (!userId) {
      return res.status(500).json({ success: false, message: "Google registration failed." });
    }

    await sendVerificationEmail(normalizedEmail, otp);
    await saveOtpToken({
      email: normalizedEmail,
      purpose: OTP_VERIFY_PURPOSE,
      otp,
      userId,
    });

    return res.json({
      success: true,
      message: "Google account registered. Please verify the OTP sent to your email.",
      userId,
      email: normalizedEmail,
      requiresOtp: true,
      expiresIn: OTP_EXPIRES_IN_SECONDS,
      resendCooldown: OTP_RESEND_COOLDOWN_SECONDS,
    });
  } catch (err) {
    console.error("[GOOGLE REGISTER] failed:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Google register failed.",
    });
  }
});

// POST /google — login for verified users
router.post("/google", async (req, res) => {
  const { accessToken, credential, email, name, picture } = req.body;

  try {
    console.log("[GOOGLE LOGIN] request received:", {
      hasCredential: Boolean(credential),
      hasAccessToken: Boolean(accessToken),
      email,
    });

    let normalizedEmail = "";
    let googlePicture = "";

    if (credential || accessToken) {
      const payload = await resolveGooglePayload({ credential, accessToken, email, name, picture });
      if (!payload) {
        return res.status(400).json({
          success: false,
          message: "Missing Google credential or email.",
        });
      }
      normalizedEmail = String(payload.email || "").trim().toLowerCase();
      googlePicture = payload.picture || "";
    } else if (email && process.env.NODE_ENV !== "production") {
      normalizedEmail = String(email).trim().toLowerCase();
      googlePicture = picture || "";
    } else {
      return res.status(400).json({
        success: false,
        message: "Missing Google credential or email.",
      });
    }

    let user = await findUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found. Please create an account with Google first.",
        code: "ACCOUNT_NOT_FOUND",
      });
    }

    if (!user.is_email_verified) {
      return res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email before logging in.",
        userId: user.user_id,
        email: user.email,
      });
    }

    await pool.query(
      `UPDATE ${USERS_TABLE}
       SET [google_avatar_url] = ?,
           [AvatarUrl] = CASE
             WHEN [avatar_source] = 'custom' OR [avatar_source] = 'system' THEN [AvatarUrl]
             ELSE ?
           END,
           [avatar_source] = CASE
             WHEN [avatar_source] = 'custom' OR [avatar_source] = 'system' THEN [avatar_source]
             ELSE 'google'
           END,
           [LastLoginAt] = SYSDATETIME(), [UpdatedAt] = SYSDATETIME()
       WHERE [UserID] = ?`,
      [googlePicture || null, googlePicture || null, user.user_id]
    );
    user = await findUserById(user.user_id);

    return res.json({
      success: true,
      message: "Google login successful.",
      user: mapUserToFrontend(user),
    });
  } catch (err) {
    console.error("[GOOGLE LOGIN] failed:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Google login failed.",
    });
  }
});

// Forgot password
router.post("/forgot-password/request-otp", async (req, res) => {
  try {
    const { email, identifier, purpose = "forgot_password" } = req.body;
    let normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail && identifier) {
      const trimmed = String(identifier || "").trim();
      if (!trimmed) {
        return res.status(400).json({ success: false, message: "Email is required." });
      }

      const isEmail = trimmed.includes("@");
      if (isEmail && !isValidEmail(trimmed)) {
        return res.status(400).json({ success: false, message: "Enter a valid email address." });
      }
      if (!isEmail && !isValidVietnamPhone(trimmed)) {
        return res.status(400).json({
          success: false,
          message: "Phone number must be 10–11 digits.",
        });
      }

      const userByIdentifier = await findUserByEmailOrPhone(trimmed);
      if (!userByIdentifier) {
        return res.status(404).json({
          success: false,
          message: "No account found with this email or phone number.",
        });
      }
      normalizedEmail = String(userByIdentifier.email || "").trim().toLowerCase();
    }

    if (!normalizedEmail) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ success: false, message: "Enter a valid email address." });
    }

    await runOtpLifecycleCleanup();

    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email.",
      });
    }

    const otp = generateOtpCode();
    const expires = new Date(Date.now() + OTP_EXPIRES_IN_MS);

    await pool.query(
      `UPDATE ${USERS_TABLE}
       SET [password_reset_token] = ?,
           [password_reset_expires_at] = ?,
           [password_reset_sent_at] = SYSDATETIME(),
           [UpdatedAt] = SYSDATETIME()
       WHERE [UserID] = ?`,
      [otp, expires, user.user_id]
    );

    await sendVerificationEmail(user.email, otp, { context: "reset" });
    const otpPurpose = purpose === "phone_update" ? "phone_update" : OTP_RESET_PURPOSE;
    await saveOtpToken({
      email: user.email,
      purpose: otpPurpose,
      otp,
      userId: user.user_id,
    });

    return res.json({
      ...buildOtpSuccessResponse("OTP sent successfully."),
      userId: user.user_id,
      email: user.email,
    });
  } catch (err) {
    console.error("[OTP] forgot-password request-otp failed:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Could not send reset code.",
    });
  }
});

router.post("/forgot-password/request", async (req, res) => {
  const { identifier, userId: bodyUserId } = req.body;

  try {
    let user = null;

    if (bodyUserId) {
      user = await findUserById(bodyUserId);
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }
    } else {
      const trimmed = String(identifier || "").trim();
      if (!trimmed) {
        return res.status(400).json({ message: "Email or phone number is required." });
      }

      const isEmail = trimmed.includes("@");
      if (isEmail && !isValidEmail(trimmed)) {
        return res.status(400).json({ message: "Enter a valid email address." });
      }
      if (!isEmail && !isValidVietnamPhone(trimmed)) {
        return res.status(400).json({ message: "Phone number must be 10–11 digits." });
      }

      user = await findUserByEmailOrPhone(trimmed);
    }
    if (!user) {
      return res.status(404).json({
        message: "No account found with this email or phone number.",
      });
    }

    const otp = generateOtpCode();
    const expires = new Date(Date.now() + OTP_EXPIRES_IN_MS);

    await pool.query(
      `UPDATE ${USERS_TABLE}
       SET [password_reset_token] = ?,
           [password_reset_expires_at] = ?,
           [password_reset_sent_at] = SYSDATETIME(),
           [UpdatedAt] = SYSDATETIME()
       WHERE [UserID] = ?`,
      [otp, expires, user.user_id]
    );

    await sendVerificationEmail(user.email, otp, { context: "reset" });
    await saveOtpToken({
      email: user.email,
      purpose: OTP_RESET_PURPOSE,
      otp,
      userId: user.user_id,
    });

    return res.json({
      ...buildOtpSuccessResponse("OTP sent successfully."),
      userId: user.user_id,
      email: user.email,
    });
  } catch (err) {
    console.error("Forgot password request error:", err);
    return res.status(500).json({ message: err.message || "Request failed." });
  }
});

router.post("/forgot-password/verify-otp", async (req, res) => {
  const { userId, otp, email, purpose = "forgot_password", phone } = req.body;
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedOtp = String(otp || "").trim();
  const normalizedPhone = phone ? normalizePhone(phone) : "";

  if (!normalizedOtp) {
    return res.status(400).json({ success: false, message: "OTP is required." });
  }

  if (normalizedEmail && !userId) {
    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required.",
      });
    }

    try {
      await runOtpLifecycleCleanup();

      const user = await findUserByEmail(normalizedEmail);
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found." });
      }

      if (purpose === "phone_update") {
        if (!normalizedPhone) {
          return res.status(400).json({
            success: false,
            message: "Phone number is required.",
          });
        }
        if (!isValidVietnamPhone(normalizedPhone)) {
          return res.status(400).json({
            success: false,
            message: "Enter a valid phone number (10–11 digits).",
          });
        }
      }

      const tokenResult = await verifyOtpRecord({
        email: normalizedEmail,
        purpose,
        otp: normalizedOtp,
        userId: user.user_id,
      });

      if (!tokenResult.ok) {
        return res.status(tokenResult.status).json({
          success: false,
          message: tokenResult.message,
        });
      }

      if (purpose === "phone_update") {
        return res.json({
          success: true,
          userId: user.user_id,
          email: user.email,
          phone: normalizedPhone,
          message: "OTP verified. Phone number can be updated.",
        });
      }

      const resetToken = generateSecureToken();
      await pool.query(
        `UPDATE ${USERS_TABLE}
         SET [password_reset_verified_token] = ?, [UpdatedAt] = SYSDATETIME()
         WHERE [UserID] = ?`,
        [resetToken, user.user_id]
      );

      return res.json({
        success: true,
        userId: user.user_id,
        email: user.email,
        resetToken,
        message: "OTP verified. You can now reset your password.",
      });
    } catch (err) {
      console.error("[OTP] forgot-password verify failed:", err);
      return res.status(500).json({ success: false, message: err.message || "Verification failed." });
    }
  }

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "Email and OTP are required.",
    });
  }

  if (!normalizedOtp) {
    return res.status(400).json({ success: false, message: "OTP is required." });
  }

  try {
    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (
      user.password_reset_expires_at &&
      new Date(user.password_reset_expires_at).getTime() < Date.now()
    ) {
      await pool.query(
        `UPDATE ${USERS_TABLE}
         SET [password_reset_token] = NULL, [UpdatedAt] = SYSDATETIME()
         WHERE [UserID] = ?`,
        [userId]
      );
      const latest = await findLatestOtpRecord({
        email: user.email,
        purpose: OTP_RESET_PURPOSE,
        userId,
      });
      if (latest?.OtpID) {
        await markOtpExpired(latest.OtpID);
      }
      return res.status(400).json({ message: "Reset code has expired. Please resend a new code." });
    }

    const tokenMatchesUser =
      String(user.password_reset_token || "").trim() === normalizedOtp;
    const tokenResult = await verifyOtpRecord({
      email: user.email,
      purpose: OTP_RESET_PURPOSE,
      otp: normalizedOtp,
      userId,
    });

    if (!tokenMatchesUser && !tokenResult.ok) {
      return res.status(400).json({
        message: tokenResult.message || "Invalid reset code.",
      });
    }

    const resetToken = generateSecureToken();
    await pool.query(
      `UPDATE ${USERS_TABLE}
       SET [password_reset_verified_token] = ?, [UpdatedAt] = SYSDATETIME()
       WHERE [UserID] = ?`,
      [resetToken, userId]
    );

    return res.json({
      success: true,
      userId,
      resetToken,
      message: "OTP verified. You can now reset your password.",
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Verification failed." });
  }
});

router.post("/forgot-password/resend-otp", async (req, res) => {
  const { userId, email, purpose = "forgot_password" } = req.body;
  const normalizedEmail = String(email || "").trim().toLowerCase();

  try {
    let user = null;
    if (userId) {
      user = await findUserById(userId);
    } else if (normalizedEmail) {
      user = await findUserByEmail(normalizedEmail);
    }

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    await runOtpLifecycleCleanup();

    const cooldown = await checkOtpResendCooldown({
      email: user.email,
      purpose: purpose === "phone_update" ? "phone_update" : OTP_RESET_PURPOSE,
      userId: user.user_id,
    });
    if (!cooldown.allowed) {
      return res.status(429).json({
        success: false,
        message: cooldown.message,
        retryAfter: cooldown.retryAfter,
        retryAfterSeconds: cooldown.retryAfter,
      });
    }

    const otp = generateOtpCode();
    const expires = new Date(Date.now() + OTP_EXPIRES_IN_MS);
    await pool.query(
      `UPDATE ${USERS_TABLE}
       SET [password_reset_token] = ?, [password_reset_expires_at] = ?, [password_reset_sent_at] = SYSDATETIME(), [UpdatedAt] = SYSDATETIME()
       WHERE [UserID] = ?`,
      [otp, expires, user.user_id]
    );

    await sendVerificationEmail(user.email, otp, { context: "reset" });
    const otpPurpose = purpose === "phone_update" ? "phone_update" : OTP_RESET_PURPOSE;
    await saveOtpToken({
      email: user.email,
      purpose: otpPurpose,
      otp,
      userId: user.user_id,
    });
    return res.json(buildOtpSuccessResponse("A new OTP has been sent."));
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Resend failed." });
  }
});

router.post("/forgot-password/reset", async (req, res) => {
  const { userId, email, resetToken, newPassword, confirmPassword } = req.body;
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail) {
    return res.status(400).json({
      success: false,
      message: "Email is required.",
    });
  }
  if (!resetToken) {
    return res.status(400).json({
      success: false,
      message: "Reset token is required. Please verify your OTP first.",
    });
  }
  if (!newPassword) {
    return res.status(400).json({
      success: false,
      message: "New password is required.",
    });
  }
  if (confirmPassword && newPassword !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match." });
  }
  if (!isPasswordStrong(newPassword)) {
    return res.status(400).json({ message: PASSWORD_RULES_MESSAGE });
  }

  try {
    let user = null;
    if (normalizedEmail) {
      user = await findUserByEmail(normalizedEmail);
    } else if (userId) {
      user = await findUserById(userId);
    }

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    if (
      String(user.password_reset_verified_token || "").trim() !==
      String(resetToken || "").trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset session.",
      });
    }

    const passwordHash = hashPassword(newPassword);
    await pool.query(
      `UPDATE ${USERS_TABLE}
       SET [PasswordHash] = ?,
           [password_reset_token] = NULL,
           [password_reset_verified_token] = NULL,
           [password_reset_expires_at] = NULL,
           [password_reset_sent_at] = NULL,
           [UpdatedAt] = SYSDATETIME()
       WHERE [UserID] = ?`,
      [passwordHash, user.user_id]
    );

    await invalidatePendingOtps({
      email: user.email,
      purpose: OTP_RESET_PURPOSE,
      userId: user.user_id,
    });

    return res.json({
      success: true,
      message: "Password reset successfully. Please sign in again.",
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Password reset failed." });
  }
});

router.post("/change-password", async (req, res) => {
  const { userId, currentPassword, newPassword, confirmPassword } = req.body;
  if (!userId || !currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: "All fields are required." });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match." });
  }
  if (!isPasswordStrong(newPassword)) {
    return res.status(400).json({ message: PASSWORD_RULES_MESSAGE });
  }

  try {
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: "User not found." });
    if (!user.password_hash || !verifyPassword(currentPassword, user.password_hash)) {
      return res.status(401).json({ message: "Old password is incorrect." });
    }
    if (verifyPassword(newPassword, user.password_hash)) {
      return res.status(400).json({ message: "New password must be different from old password." });
    }

    const passwordHash = hashPassword(newPassword);
    await pool.query(
      `UPDATE ${USERS_TABLE}
       SET [${USER_SQL.passwordHash}] = ?,
           [old_password_verified_token] = NULL,
           [old_password_verified_at] = NULL,
           [${USER_SQL.updatedAt}] = SYSDATETIME()
       WHERE [${USER_SQL.id}] = ?`,
      [passwordHash, userId]
    );

    return res.json({
      success: true,
      message: "Password changed successfully. Please sign in again.",
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Password change failed." });
  }
});

// Profile — avatar routes must be registered before /profile/:userId
router.post("/profile/:userId/avatar/upload", (req, res) => {
  avatarUpload.single("avatar")(req, res, async (uploadErr) => {
    const { userId } = req.params;

    if (uploadErr) {
      if (uploadErr.message === "INVALID_AVATAR_TYPE") {
        return res.status(400).json({
          success: false,
          message: "Avatar must be JPG, PNG, or WEBP.",
        });
      }
      if (uploadErr.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "Avatar must be smaller than 2MB.",
        });
      }
      return res.status(400).json({
        success: false,
        message: uploadErr.message || "Avatar upload failed.",
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Avatar file is required." });
  }

  try {
      const user = await findUserById(userId);
      if (!user) return res.status(404).json({ message: "User not found." });

      const publicPath = `/uploads/avatars/${req.file.filename}`;
      try {
        await pool.query(
          `UPDATE ${USERS_TABLE} SET [${USER_SQL.avatarUrl}] = ?, [avatar_source] = 'custom', [${USER_SQL.updatedAt}] = SYSDATETIME() WHERE [${USER_SQL.id}] = ?`,
          [publicPath, req.params.userId]
        );
        return res.json({
          success: true,
          avatarUrl: publicPath,
          message: "Avatar updated successfully.",
        });
      } catch (err) {
        console.error("Avatar upload error:", err);
        return res.status(500).json({ message: err.message || "Avatar upload failed." });
      }
    } catch (err) {
      console.error("Avatar upload error:", err);
      return res.status(500).json({ message: err.message || "Avatar upload failed." });
    }
  });
});

router.put("/profile/:userId/avatar/system", async (req, res) => {
  const { userId } = req.params;
  const { avatarUrl } = req.body;

  if (!avatarUrl || typeof avatarUrl !== "string") {
    return res.status(400).json({ success: false, message: "avatarUrl is required." });
  }

  const canonical = canonicalSystemAvatarPath(avatarUrl);
  if (!canonical) {
    return res.status(400).json({ success: false, message: "Invalid system avatar selection." });
  }

  try {
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    try {
      await pool.query(
        `UPDATE ${USERS_TABLE} SET [${USER_SQL.avatarUrl}] = ?, [avatar_source] = 'system', [${USER_SQL.updatedAt}] = SYSDATETIME() WHERE [${USER_SQL.id}] = ?`,
        [canonical, req.params.userId]
      );
      return res.json({
        success: true,
        avatarUrl: canonical,
        message: "Avatar updated successfully.",
      });
    } catch (err) {
      return res.status(500).json({ message: err.message || "Avatar update failed." });
    }
  } catch (err) {
    return res.status(500).json({ message: err.message || "Avatar update failed." });
  }
});

router.get("/profile/:userId", async (req, res) => {
  try {
    const user = await findUserById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found." });
    const profileRow = await findUserProfileRow(req.params.userId);
    return res.json({ success: true, user: mapUserToFrontend(user, profileRow) });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to load profile." });
  }
});

async function handlePhoneProfileUpdate(req, res) {
  const { userId } = req.params;
  const { errors, normalized } = validatePhoneUpdatePayload(req.body);
  if (Object.keys(errors).length) {
    return res.status(400).json({ success: false, message: "Validation failed.", errors });
  }

  try {
    const current = await findUserById(userId);
    if (!current) return res.status(404).json({ message: "User not found." });

    const [dupPhone] = await pool.query(
      `SELECT TOP 1 [${USER_SQL.id}] FROM ${USERS_TABLE} WHERE [${USER_SQL.phoneNumber}] = ? AND [${USER_SQL.id}] <> ?`,
      [normalized.phoneNumber, userId]
    );
    if (dupPhone[0]) {
      return res.status(409).json({ field: "phoneNumber", message: "Phone number is already in use." });
    }

    await pool.query(
      `UPDATE ${USERS_TABLE} SET [${USER_SQL.phoneNumber}] = ?, [${USER_SQL.updatedAt}] = SYSDATETIME() WHERE [${USER_SQL.id}] = ?`,
      [normalized.phoneNumber, userId]
    );

    const updated = await findUserById(userId);
    const profileRow = await findUserProfileRow(userId);
    return res.json({
      success: true,
      message: "Phone number updated.",
      user: mapUserToFrontend(updated, profileRow),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Phone update failed." });
  }
}

router.patch("/profile/:userId", async (req, res) => {
  if (isPhoneOnlyProfileUpdate(req.body)) {
    return handlePhoneProfileUpdate(req, res);
  }

  const { userId } = req.params;
  const { errors, normalized } = validateProfilePayload(req.body, { partial: true });
  if (Object.keys(errors).length) {
    return res.status(400).json({ success: false, message: "Validation failed.", errors });
  }

  try {
    const current = await findUserById(userId);
    if (!current) return res.status(404).json({ message: "User not found." });

    const username = normalized.username ?? current.username;
    const dupUsername = await findUserByUsername(username);
    if (dupUsername && String(dupUsername.user_id) !== String(userId)) {
      return res.status(409).json({ field: "username", message: "Username is already in use." });
    }

    if (normalized.phoneNumber) {
      const [dupPhone] = await pool.query(
        `SELECT TOP 1 [${USER_SQL.id}] FROM ${USERS_TABLE} WHERE [${USER_SQL.phoneNumber}] = ? AND [${USER_SQL.id}] <> ?`,
        [normalized.phoneNumber, userId]
      );
      if (dupPhone[0]) {
        return res.status(409).json({ field: "phoneNumber", message: "Phone number is already in use." });
      }
    }

    const params = [];
    const setClauses = [];

    if (Object.prototype.hasOwnProperty.call(req.body, "username")) {
      setClauses.push(`[${USER_SQL.username}] = ?`);
      params.push(username);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "phone") || Object.prototype.hasOwnProperty.call(req.body, "phoneNumber")) {
      setClauses.push(`[${USER_SQL.phoneNumber}] = ?`);
      params.push(normalized.phoneNumber);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "firstName") || Object.prototype.hasOwnProperty.call(req.body, "fullName")) {
      setClauses.push(`[${USER_SQL.firstName}] = ?`);
      params.push(normalized.firstName || current.first_name);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "lastName") || Object.prototype.hasOwnProperty.call(req.body, "fullName")) {
      setClauses.push(`[${USER_SQL.lastName}] = ?`);
      params.push(normalized.lastName || current.last_name || "");
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "dateOfBirth")) {
      setClauses.push(`[${USER_SQL.dateOfBirth}] = ?`);
      params.push(normalized.dateOfBirth);
    }
    if (req.body.avatarUrl !== undefined) {
      setClauses.push(`[${USER_SQL.avatarUrl}] = ?`);
      params.push(req.body.avatarUrl || null);
    }

    if (setClauses.length) {
      setClauses.push(`[${USER_SQL.updatedAt}] = SYSDATETIME()`);
      params.push(userId);
      await pool.query(
        `UPDATE ${USERS_TABLE} SET ${setClauses.join(", ")} WHERE [${USER_SQL.id}] = ?`,
        params
      );
    }

    const profilePatch = {};
    if (Object.prototype.hasOwnProperty.call(req.body, "gender")) profilePatch.gender = normalized.gender;
    if (Object.prototype.hasOwnProperty.call(req.body, "bio")) profilePatch.bio = normalized.bio;
    if (Object.prototype.hasOwnProperty.call(req.body, "address")) profilePatch.address = normalized.address;
    if (Object.prototype.hasOwnProperty.call(req.body, "country")) profilePatch.country = normalized.country;
    if (Object.prototype.hasOwnProperty.call(req.body, "language")) profilePatch.language = normalized.language;
    if (Object.keys(profilePatch).length) {
      await upsertUserProfile(userId, profilePatch);
    }

    const updated = await findUserById(userId);
    const profileRow = await findUserProfileRow(userId);
    return res.json({
      success: true,
      message: "Profile updated.",
      user: mapUserToFrontend(updated, profileRow),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Profile update failed." });
  }
});

router.put("/profile/:userId", async (req, res) => {
  const { userId } = req.params;

  if (isPhoneOnlyProfileUpdate(req.body)) {
    return handlePhoneProfileUpdate(req, res);
  }

  const { errors, normalized } = validateProfilePayload(req.body);
  if (Object.keys(errors).length) {
    return res.status(400).json({ success: false, message: "Validation failed.", errors });
  }

  try {
    const current = await findUserById(userId);
    if (!current) return res.status(404).json({ message: "User not found." });

    const dupUsername = await findUserByUsername(normalized.username);
    if (dupUsername && String(dupUsername.user_id) !== String(userId)) {
      return res.status(409).json({ field: "username", message: "Username is already in use." });
    }

    if (normalized.phoneNumber) {
      const [dupPhone] = await pool.query(
        `SELECT TOP 1 [${USER_SQL.id}] FROM ${USERS_TABLE} WHERE [${USER_SQL.phoneNumber}] = ? AND [${USER_SQL.id}] <> ?`,
        [normalized.phoneNumber, userId]
      );
      if (dupPhone[0]) {
        return res.status(409).json({ field: "phoneNumber", message: "Phone number is already in use." });
      }
    }

    const dateOfBirthToSave =
      normalized.dateOfBirth ||
      (current.date_of_birth
        ? new Date(current.date_of_birth).toISOString().slice(0, 10)
        : null);

    const params = [
      normalized.username,
      normalized.phoneNumber,
      normalized.firstName,
      normalized.lastName,
      dateOfBirthToSave,
    ];
    let sql = `UPDATE ${USERS_TABLE}
      SET [${USER_SQL.username}] = ?, [${USER_SQL.phoneNumber}] = ?, [${USER_SQL.firstName}] = ?, [${USER_SQL.lastName}] = ?, [${USER_SQL.dateOfBirth}] = ?`;

    if (req.body.avatarUrl !== undefined) {
      sql += `, [${USER_SQL.avatarUrl}] = ?`;
      params.push(req.body.avatarUrl || null);
    }

    sql += `, [${USER_SQL.updatedAt}] = SYSDATETIME() WHERE [${USER_SQL.id}] = ?`;
    params.push(userId);

    await pool.query(sql, params);

    await upsertUserProfile(userId, {
      gender: normalized.gender,
      bio: normalized.bio,
      address: normalized.address,
      country: normalized.country,
      language: normalized.language,
    });

    const updated = await findUserById(userId);
    const profileRow = await findUserProfileRow(userId);
    return res.json({
      success: true,
      message: "Profile updated.",
      user: mapUserToFrontend(updated, profileRow),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Profile update failed." });
  }
});

router.put("/profile/:userId/avatar/google", async (req, res) => {
  try {
    const user = await findUserById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found." });
    if (!user.google_avatar_url) return res.status(400).json({ message: "No Google avatar available." });

    await pool.query(
      `UPDATE ${USERS_TABLE} SET [${USER_SQL.avatarUrl}] = [google_avatar_url], [avatar_source] = 'google', [${USER_SQL.updatedAt}] = SYSDATETIME() WHERE [${USER_SQL.id}] = ?`,
      [user.user_id]
    );
    const updated = await findUserById(req.params.userId);
    return res.json({
      success: true,
      message: "Avatar updated successfully.",
      user: mapUserToFrontend(updated),
      avatarUrl: updated.google_avatar_url,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Avatar update failed." });
  }
});

router.post("/profile/change-password/verify-old", async (req, res) => {
  const { userId, oldPassword } = req.body;
  if (!userId || !oldPassword) {
    return res.status(400).json({ message: "userId and oldPassword are required." });
  }

  try {
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: "User not found." });
    if (!user.password_hash || !verifyPassword(oldPassword, user.password_hash)) {
      return res.status(401).json({ message: "Old password is incorrect." });
    }

    const token = generateSecureToken();
    await pool.query(
      `UPDATE ${USERS_TABLE}
       SET [old_password_verified_token] = ?, [old_password_verified_at] = SYSDATETIME(), [${USER_SQL.updatedAt}] = SYSDATETIME()
       WHERE [${USER_SQL.id}] = ?`,
      [token, userId]
    );

    return res.json({
      success: true,
      message: "Old password verified.",
      oldPasswordVerifiedToken: token,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Verification failed." });
  }
});

router.post("/profile/change-password/reset", async (req, res) => {
  const { userId, oldPasswordVerifiedToken, newPassword, confirmPassword } = req.body;
  if (!userId || !oldPasswordVerifiedToken || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: "All fields are required." });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match." });
  }
  if (!isPasswordStrong(newPassword)) {
    return res.status(400).json({ message: PASSWORD_RULES_MESSAGE });
  }

  try {
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: "User not found." });
    if (user.old_password_verified_token !== oldPasswordVerifiedToken) {
      return res.status(400).json({ message: "Please verify your old password first." });
    }
    if (user.old_password_verified_at) {
      const age = (Date.now() - new Date(user.old_password_verified_at).getTime()) / 1000;
      if (age > 900) {
        return res.status(400).json({ message: "Session expired. Verify old password again." });
      }
    }
    if (user.password_hash && verifyPassword(newPassword, user.password_hash)) {
      return res.status(400).json({ message: "New password must be different from old password." });
    }

    const passwordHash = hashPassword(newPassword);
    await pool.query(
      `UPDATE ${USERS_TABLE}
       SET [${USER_SQL.passwordHash}] = ?,
           [old_password_verified_token] = NULL,
           [old_password_verified_at] = NULL,
           [${USER_SQL.updatedAt}] = SYSDATETIME()
       WHERE [${USER_SQL.id}] = ?`,
      [passwordHash, userId]
    );

    return res.json({
      success: true,
      message: "Password changed successfully. Please sign in again.",
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Password change failed." });
  }
});

router.post("/test-email", async (req, res) => {
  const { email } = req.body;
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ message: "Valid email is required." });
  }
  const otp = generateOtpCode();
  try {
    await sendVerificationEmail(email.trim(), otp);
    return res.json({
      success: true,
      message: isSmtpConfigured()
        ? `Test email sent to ${email}.`
        : `SMTP not configured. Check server console for [DEV] OTP.`,
      smtpConfigured: isSmtpConfigured(),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
