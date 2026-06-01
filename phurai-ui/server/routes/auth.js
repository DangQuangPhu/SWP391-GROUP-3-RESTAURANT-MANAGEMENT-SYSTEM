import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import pool from "../db.js";
import { sendVerificationEmail, isSmtpConfigured } from "../email.js";
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
  isAtLeast13YearsOld,
  parseDateOfBirth,
} from "../utils/validation.js";

const router = express.Router();
const USERS_TABLE = "[dbo].[Users]";
const RESEND_COOLDOWN_SECONDS = 30;

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

function getResendRemainingSeconds(sentAt) {
  if (!sentAt) return 0;
  const elapsed = (Date.now() - new Date(sentAt).getTime()) / 1000;
  return Math.max(0, Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed));
}

function mapUserToFrontend(row) {
  if (!row) return null;
  const firstName = row.first_name || "";
  const lastName = row.last_name || "";
  const username = row.Username || "";
  return {
    id: row.UserID,
    userId: row.UserID,
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    fullName: `${firstName} ${lastName}`.trim() || username,
    username: String(username).trim(),
    nickname: String(firstName || username).trim(),
    email: row.Email || "",
    phoneNumber: row.PhoneNumber || "",
    phone: row.PhoneNumber || "",
    dateOfBirth: row.date_of_birth
      ? new Date(row.date_of_birth).toISOString().slice(0, 10)
      : "",
    avatarUrl: normalizeStoredAvatarUrl(row.AvatarUrl),
    authProvider: row.auth_provider || "LOCAL",
    accountStatus: row.AccountStatus || "",
    emailVerified: Boolean(row.EmailVerified),
  };
}

async function findUserById(userId) {
  const [rows] = await pool.query(
    `SELECT TOP 1 * FROM ${USERS_TABLE} WHERE [UserID] = ?`,
    [userId]
  );
  return rows[0] || null;
}

async function findUserByEmail(email) {
  const [rows] = await pool.query(
    `SELECT TOP 1 * FROM ${USERS_TABLE} WHERE LOWER([Email]) = LOWER(?)`,
    [email]
  );
  return rows[0] || null;
}

async function findUserByUsername(username) {
  const [rows] = await pool.query(
    `SELECT TOP 1 * FROM ${USERS_TABLE} WHERE [Username] = ?`,
    [username]
  );
  return rows[0] || null;
}

async function findUserByEmailOrUsername(identifier) {
  const trimmed = String(identifier || "").trim();
  const [rows] = await pool.query(
    `SELECT TOP 1 * FROM ${USERS_TABLE}
     WHERE LOWER([Email]) = LOWER(?) OR LOWER([Username]) = LOWER(?)`,
    [trimmed, trimmed]
  );
  return rows[0] || null;
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
  return rows[0] || null;
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
       VALUES (?, ?, ?, 'pending', 0, ?, SYSDATETIME(), SYSDATETIME(), ?, ?, ?, 'LOCAL', ?, SYSDATETIME())`,
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

    const userId = insertRows[0]?.UserID;
    if (!userId) {
      return res.status(500).json({ success: false, message: "Registration failed." });
    }

    await sendVerificationEmail(normalized.email, otp);

    return res.status(201).json({
      success: true,
      userId,
      email: normalized.email,
      message: "Verification code sent to your email.",
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ success: false, message: err.message || "Registration failed." });
  }
});

// POST /verify-otp
router.post("/verify-otp", async (req, res) => {
  const { userId, otp } = req.body;
  if (!userId || !otp) {
    return res.status(400).json({ success: false, message: "User ID and OTP are required." });
  }

  try {
    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "Account not found." });
    }

    if (String(user.verification_token || "").trim() !== String(otp).trim()) {
      return res.status(400).json({ success: false, message: "Invalid verification code." });
    }

    await pool.query(
      `UPDATE ${USERS_TABLE}
       SET [EmailVerified] = 1,
           [verification_token] = NULL,
           [AccountStatus] = 'active',
           [UpdatedAt] = SYSDATETIME()
       WHERE [UserID] = ?`,
      [userId]
    );

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
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: "userId is required." });

  try {
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: "User not found." });
    if (user.EmailVerified) {
      return res.status(400).json({ message: "Account is already verified." });
    }

    if (user.verification_sent_at) {
      const remaining = getResendRemainingSeconds(user.verification_sent_at);
      if (remaining > 0) {
        return res.status(429).json({
          success: false,
          message: "Please wait before requesting another code.",
          retryAfterSeconds: remaining,
        });
      }
    }

    const otp = generateOtpCode();
    await pool.query(
      `UPDATE ${USERS_TABLE}
       SET [verification_token] = ?, [verification_sent_at] = SYSDATETIME(), [UpdatedAt] = SYSDATETIME()
       WHERE [UserID] = ?`,
      [otp, userId]
    );

    await sendVerificationEmail(user.Email, otp);
    return res.json({ success: true, message: "Verification code sent.", email: user.Email });
  } catch (err) {
    console.error("Resend verification error:", err);
    return res.status(500).json({ message: err.message || "Resend failed." });
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

    if (!user.PasswordHash || !verifyPassword(password, user.PasswordHash)) {
      return res.status(401).json({ message: "Incorrect password. Please try again." });
    }

    if (!user.EmailVerified) {
      return res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email before logging in.",
        userId: user.UserID,
        email: user.Email,
      });
    }

    const status = String(user.AccountStatus || "").toLowerCase();
    if (status && status !== "active") {
      return res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email before logging in.",
        userId: user.UserID,
        email: user.Email,
      });
    }

    await pool.query(
      `UPDATE ${USERS_TABLE} SET [LastLoginAt] = SYSDATETIME(), [UpdatedAt] = SYSDATETIME(), [FailedLoginCount] = 0 WHERE [UserID] = ?`,
      [user.UserID]
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
  const { credential, accessToken } = req.body;

  try {
    let payload;
    if (credential) {
      payload = await verifyGoogleIdToken(credential);
    } else if (accessToken) {
      const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error("Invalid Google access token.");
      const data = await response.json();
      payload = {
        sub: data.sub,
        email: data.email,
        email_verified: data.email_verified ? "true" : "false",
        given_name: data.given_name,
        family_name: data.family_name,
        picture: data.picture,
      };
    } else {
      return res.status(400).json({ message: "Google credential is required." });
    }

    if (payload.email_verified !== "true" && payload.email_verified !== true) {
      return res.status(400).json({ message: "Google email is not verified." });
    }

    const email = String(payload.email || "").trim().toLowerCase();
    const firstName = payload.given_name || "";
    const lastName = payload.family_name || "";
    const googleSub = payload.sub;
    const avatarUrl = payload.picture || "";
    const usernameBase = (email.split("@")[0] || "user").replace(/[^a-zA-Z0-9._]/g, "").toLowerCase();
    const otp = generateOtpCode();

    let user = await findUserByEmail(email);
    let userId;

    if (user) {
      if (user.EmailVerified) {
        return res.status(409).json({
          message: "This Google account is already registered. Please sign in.",
        });
      }

      userId = user.UserID;
      const keepAvatar =
        user.AvatarUrl && String(user.AvatarUrl).trim()
          ? user.AvatarUrl
          : avatarUrl || null;
      await pool.query(
        `UPDATE ${USERS_TABLE}
         SET [google_sub] = ?, [first_name] = ?, [last_name] = ?,
             [AvatarUrl] = CASE
               WHEN [AvatarUrl] IS NOT NULL AND LTRIM(RTRIM([AvatarUrl])) <> '' THEN [AvatarUrl]
               ELSE ?
             END,
             [auth_provider] = 'GOOGLE', [verification_token] = ?, [verification_sent_at] = SYSDATETIME(),
             [UpdatedAt] = SYSDATETIME()
         WHERE [UserID] = ?`,
        [googleSub, firstName, lastName, keepAvatar, otp, userId]
      );
    } else {
      const username = await buildUniqueUsername(usernameBase);
      const [insertRows] = await pool.query(
        `INSERT INTO ${USERS_TABLE}
          ([Email], [Username], [PasswordHash], [AccountStatus], [EmailVerified], [AvatarUrl],
           [CreatedAt], [UpdatedAt], [first_name], [last_name], [google_sub], [auth_provider],
           [verification_token], [verification_sent_at])
         OUTPUT INSERTED.[UserID]
         VALUES (?, ?, NULL, 'pending', 0, ?, SYSDATETIME(), SYSDATETIME(), ?, ?, ?, 'GOOGLE', ?, SYSDATETIME())`,
        [email, username, avatarUrl || null, firstName, lastName, googleSub, otp]
      );
      userId = insertRows[0]?.UserID;
    }

    await sendVerificationEmail(email, otp);

    return res.json({
      success: true,
      message: "Google account registered. Please verify the OTP sent to your email.",
      userId,
      email,
      requiresOtp: true,
    });
  } catch (err) {
    console.error("Google register error:", err);
    return res.status(500).json({ message: err.message || "Google registration failed." });
  }
});

// POST /google — login for verified users
router.post("/google", async (req, res) => {
  const { accessToken, credential } = req.body;

  try {
    let email;

    let googlePicture = "";

    if (credential) {
      const payload = await verifyGoogleIdToken(credential);
      email = String(payload.email || "").trim().toLowerCase();
      googlePicture = payload.picture || "";
    } else if (accessToken) {
      const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error("Invalid Google access token.");
      const data = await response.json();
      email = String(data.email || "").trim().toLowerCase();
      googlePicture = data.picture || "";
    } else {
      return res.status(400).json({ message: "Google credential or access token required." });
    }

    let user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({
        message: "No account found. Please create an account with Google first.",
        code: "ACCOUNT_NOT_FOUND",
      });
    }

    if (!user.EmailVerified) {
      return res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email before logging in.",
        userId: user.UserID,
        email: user.Email,
      });
    }

    const hasAvatar = user.AvatarUrl && String(user.AvatarUrl).trim();
    if (!hasAvatar && googlePicture) {
      await pool.query(
        `UPDATE ${USERS_TABLE}
         SET [AvatarUrl] = ?, [LastLoginAt] = SYSDATETIME(), [UpdatedAt] = SYSDATETIME()
         WHERE [UserID] = ?`,
        [googlePicture, user.UserID]
      );
      user = await findUserById(user.UserID);
    } else {
      await pool.query(
        `UPDATE ${USERS_TABLE} SET [LastLoginAt] = SYSDATETIME(), [UpdatedAt] = SYSDATETIME() WHERE [UserID] = ?`,
        [user.UserID]
      );
    }

    return res.json({ success: true, message: "Google Sign-In successful.", user: mapUserToFrontend(user) });
  } catch (err) {
    console.error("Google login error:", err);
    return res.status(500).json({ message: err.message || "Google Sign-In failed." });
  }
});

// Forgot password
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
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    await pool.query(
      `UPDATE ${USERS_TABLE}
       SET [password_reset_token] = ?,
           [password_reset_expires_at] = ?,
           [password_reset_sent_at] = SYSDATETIME(),
           [UpdatedAt] = SYSDATETIME()
       WHERE [UserID] = ?`,
      [otp, expires, user.UserID]
    );

    await sendVerificationEmail(user.Email, otp, { context: "reset" });

    return res.json({
      success: true,
      userId: user.UserID,
      email: user.Email,
      message: "Password reset code sent to your email.",
    });
  } catch (err) {
    console.error("Forgot password request error:", err);
    return res.status(500).json({ message: err.message || "Request failed." });
  }
});

router.post("/forgot-password/verify-otp", async (req, res) => {
  const { userId, otp } = req.body;
  if (!userId || !otp) return res.status(400).json({ message: "userId and otp are required." });

  try {
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    if (String(user.password_reset_token || "").trim() !== String(otp).trim()) {
      return res.status(400).json({ message: "Invalid reset code." });
    }
    if (user.password_reset_expires_at && new Date(user.password_reset_expires_at).getTime() < Date.now()) {
      return res.status(400).json({ message: "Reset code has expired." });
    }

    const resetToken = generateSecureToken();
    await pool.query(
      `UPDATE ${USERS_TABLE} SET [password_reset_verified_token] = ?, [UpdatedAt] = SYSDATETIME() WHERE [UserID] = ?`,
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
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: "userId is required." });

  try {
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    if (user.password_reset_sent_at) {
      const remaining = getResendRemainingSeconds(user.password_reset_sent_at);
      if (remaining > 0) {
        return res.status(429).json({
          success: false,
          message: "Please wait before requesting another code.",
          retryAfterSeconds: remaining,
        });
      }
    }

    const otp = generateOtpCode();
    const expires = new Date(Date.now() + 5 * 60 * 1000);
    await pool.query(
      `UPDATE ${USERS_TABLE}
       SET [password_reset_token] = ?, [password_reset_expires_at] = ?, [password_reset_sent_at] = SYSDATETIME(), [UpdatedAt] = SYSDATETIME()
       WHERE [UserID] = ?`,
      [otp, expires, userId]
    );

    await sendVerificationEmail(user.Email, otp, { context: "reset" });
    return res.json({
      success: true,
      message: "A new reset code has been sent.",
      retryAfterSeconds: RESEND_COOLDOWN_SECONDS,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Resend failed." });
  }
});

router.post("/forgot-password/reset", async (req, res) => {
  const { userId, resetToken, newPassword, confirmPassword } = req.body;
  if (!userId || !resetToken || !newPassword || !confirmPassword) {
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
    if (user.password_reset_verified_token !== resetToken) {
      return res.status(400).json({ message: "Invalid or expired reset session." });
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
      [passwordHash, userId]
    );

    return res.json({
      success: true,
      message: "Password reset successfully. Please sign in again.",
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Reset failed." });
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
      await pool.query(
        `UPDATE ${USERS_TABLE} SET [AvatarUrl] = ?, [UpdatedAt] = SYSDATETIME() WHERE [UserID] = ?`,
        [publicPath, userId]
      );

      const updated = await findUserById(userId);
      return res.json({
        success: true,
        avatarUrl: publicPath,
        message: "Avatar updated successfully.",
        user: mapUserToFrontend(updated),
      });
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

      await pool.query(
      `UPDATE ${USERS_TABLE} SET [AvatarUrl] = ?, [UpdatedAt] = SYSDATETIME() WHERE [UserID] = ?`,
      [canonical, userId]
    );

    const updated = await findUserById(userId);
    return res.json({
      success: true,
      avatarUrl: canonical,
      message: "Avatar updated successfully.",
      user: mapUserToFrontend(updated),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Avatar update failed." });
  }
});

router.get("/profile/:userId", async (req, res) => {
  try {
    const user = await findUserById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found." });
    return res.json({ success: true, user: mapUserToFrontend(user) });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to load profile." });
  }
});

router.put("/profile/:userId", async (req, res) => {
  const { userId } = req.params;
  const { errors, normalized } = validateProfilePayload(req.body);
  if (Object.keys(errors).length) {
    return res.status(400).json({ success: false, message: "Validation failed.", errors });
  }

  try {
    const current = await findUserById(userId);
    if (!current) return res.status(404).json({ message: "User not found." });

    const dupUsername = await findUserByUsername(normalized.username);
    if (dupUsername && String(dupUsername.UserID) !== String(userId)) {
      return res.status(409).json({ field: "username", message: "Username is already in use." });
    }

    const [dupPhone] = await pool.query(
      `SELECT TOP 1 [UserID] FROM ${USERS_TABLE} WHERE [PhoneNumber] = ? AND [UserID] <> ?`,
      [normalized.phoneNumber, userId]
    );
    if (dupPhone[0]) {
      return res.status(409).json({ field: "phoneNumber", message: "Phone number is already in use." });
    }

    const params = [
      normalized.username,
      normalized.phoneNumber,
      normalized.firstName,
      normalized.lastName,
      normalized.dateOfBirth,
    ];
    let sql = `UPDATE ${USERS_TABLE}
      SET [Username] = ?, [PhoneNumber] = ?, [first_name] = ?, [last_name] = ?, [date_of_birth] = ?`;

    if (req.body.avatarUrl !== undefined) {
      sql += `, [AvatarUrl] = ?`;
      params.push(req.body.avatarUrl || null);
    }

    sql += `, [UpdatedAt] = SYSDATETIME() WHERE [UserID] = ?`;
    params.push(userId);

    await pool.query(sql, params);

    const updated = await findUserById(userId);
    return res.json({ success: true, message: "Profile updated.", user: mapUserToFrontend(updated) });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Profile update failed." });
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
    if (!user.PasswordHash || !verifyPassword(oldPassword, user.PasswordHash)) {
      return res.status(401).json({ message: "Old password is incorrect." });
    }

    const token = generateSecureToken();
      await pool.query(
      `UPDATE ${USERS_TABLE}
       SET [old_password_verified_token] = ?, [old_password_verified_at] = SYSDATETIME(), [UpdatedAt] = SYSDATETIME()
       WHERE [UserID] = ?`,
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
    if (user.PasswordHash && verifyPassword(newPassword, user.PasswordHash)) {
      return res.status(400).json({ message: "New password must be different from old password." });
    }

    const passwordHash = hashPassword(newPassword);
    await pool.query(
      `UPDATE ${USERS_TABLE}
       SET [PasswordHash] = ?,
           [old_password_verified_token] = NULL,
           [old_password_verified_at] = NULL,
           [UpdatedAt] = SYSDATETIME()
       WHERE [UserID] = ?`,
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
