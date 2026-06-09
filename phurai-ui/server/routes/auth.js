import express from "express";
import pool from "../db.js";
import { sendOtpEmail } from "../email.js";
import { hashPassword, generateOtpCode, generateSecureToken, isPasswordStrong, verifyStoredPassword } from "../utils/password.js";
import {
  saveOtpToken,
  verifyOtpRecord,
  checkOtpResendCooldown,
  buildOtpSuccessResponse,
  normalizeOtpPurpose,
  isVerifyAccountPurpose,
  verifyPasswordResetOtp,
  consumePasswordResetOtp,
} from "../utils/otpService.js";
import {
  findUserAccountByIdOrEmail,
  updateUserPasswordHash,
  verifyUserOldPassword,
} from "../utils/accountPassword.js";
import { isDevOtpSampleEmail, logDevOtp, logOtpSent } from "../utils/otpDev.js";
import { verifyGoogleAccessToken, verifyGoogleIdToken } from "../utils/googleAuth.js";
import {
  buildLoginUserResponse,
  ensureCustomerProfile,
  fetchProfileByEmail,
  getCustomerRoleId,
  getEmailPrefix,
  getProfileForUser,
  serializePreferences,
} from "../utils/profileService.js";
import { getMembershipInfo } from "../utils/membership.js";
import { validateRegisterPayload } from "../utils/validation.js";

const router = express.Router();

const PROFILE_SELECT = `
  SELECT
    ua.user_id,
    ua.role_id,
    ua.full_name,
    ua.email,
    ua.phone,
    ua.password_hash,
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
  JOIN dbo.Roles r ON ua.role_id = r.role_id
  LEFT JOIN dbo.CustomerProfiles cp ON ua.user_id = cp.user_id
`;

async function sendOtpForUser({ email, purpose, userId = null }) {
  const otp = generateOtpCode();
  const timing = await saveOtpToken({ email, purpose, otp, userId });
  const normalizedPurpose = normalizeOtpPurpose(purpose);

  if (isDevOtpSampleEmail(email)) {
    logDevOtp(email, normalizedPurpose, otp);
  } else {
    await sendOtpEmail({ to: email, otp, purpose });
    logOtpSent(email);
  }

  return { ...timing, otp };
}

router.post("/login", async (req, res) => {
  try {
    const { email, emailOrUsername, identifier, password } = req.body;
    const loginIdentifier = String(email || emailOrUsername || identifier || "").trim();
    const isEmailLogin = loginIdentifier.includes("@");

    if (!loginIdentifier || !password) {
      return res.status(400).json({
        message: "Email/username and password are required.",
      });
    }

    const [users] = await pool.query(
      `${PROFILE_SELECT}
       WHERE
       (
         ? = 1 AND LOWER(ua.email) = LOWER(?)
       )
       OR
       (
         ? = 0 AND LOWER(cp.username) = LOWER(?)
       )`,
      [
        isEmailLogin ? 1 : 0,
        loginIdentifier,
        isEmailLogin ? 1 : 0,
        loginIdentifier,
      ]
    );
    const user = users[0];

    if (!user) {
      return res.status(404).json({
        message: "Account does not exist. Please check your email or username.",
      });
    }

    if (!user.is_active) {
      return res.status(403).json({ message: "Your account is inactive." });
    }

    if (!user.email_verified) {
      return res.status(403).json({
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email before signing in.",
        userId: user.user_id,
        email: user.email,
      });
    }

    const hash = String(user.password_hash || "");
    const isPasswordValid = await verifyStoredPassword(password, hash);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid password." });
    }

    if (user.customer_id == null) {
      await ensureCustomerProfile(user.user_id, user.email);
      const refreshed = await fetchProfileByEmail(user.email);
      if (refreshed) Object.assign(user, refreshed);
    }

    await pool.query(
      `UPDATE dbo.UserAccounts
       SET last_login_at = SYSDATETIME(), updated_at = SYSDATETIME()
       WHERE user_id = ?`,
      [user.user_id]
    );

    return res.json({
      message: "Login successful.",
      user: buildLoginUserResponse(user),
    });
  } catch (error) {
    console.error("Login failed:", error);
    return res.status(500).json({ message: "Login failed.", error: error.message });
  }
});

router.post("/register", async (req, res) => {
  try {
    const { errors, normalized } = validateRegisterPayload(req.body);
    if (Object.keys(errors).length) {
      return res.status(400).json({ message: "Validation failed.", errors });
    }

    if (!isPasswordStrong(normalized.password)) {
      return res.status(400).json({
        message: "Password must meet security requirements.",
        errors: { password: "Password must meet security requirements." },
      });
    }

    const [existingEmail] = await pool.query(
      `SELECT user_id FROM dbo.UserAccounts WHERE LOWER(email) = LOWER(?)`,
      [normalized.email]
    );
    if (existingEmail[0]) {
      return res.status(409).json({
        message: "Email is already registered.",
        errors: { email: "Email is already registered." },
      });
    }

    const [existingUsername] = await pool.query(
      `SELECT cp.customer_id
       FROM dbo.CustomerProfiles cp
       WHERE LOWER(cp.username) = LOWER(?)`,
      [normalized.username]
    );
    if (existingUsername[0]) {
      return res.status(409).json({
        message: "Username is already taken.",
        errors: { username: "Username is already taken." },
      });
    }

    const roleId = await getCustomerRoleId();
    const fullName = `${normalized.firstName} ${normalized.lastName}`.trim();
    const passwordHash = hashPassword(normalized.password);

    const [insertResult] = await pool.query(
      `INSERT INTO dbo.UserAccounts
        (role_id, full_name, email, phone, password_hash, avatar_url, is_active, email_verified, created_at, updated_at)
       OUTPUT INSERTED.user_id
       VALUES (?, ?, ?, ?, ?, NULL, 1, 0, SYSDATETIME(), SYSDATETIME())`,
      [roleId, fullName, normalized.email, normalized.phoneNumber, passwordHash]
    );

    const userId = insertResult[0]?.user_id;
    const membership = getMembershipInfo(0);

    await pool.query(
      `INSERT INTO dbo.CustomerProfiles
        (user_id, username, date_of_birth, gender, country, [language], bio,
         loyalty_points, membership_tier, preferences, created_at, updated_at)
       VALUES (?, ?, ?, NULL, NULL, NULL, NULL, 0, ?, ?, SYSDATETIME(), SYSDATETIME())`,
      [
        userId,
        normalized.username,
        normalized.dateOfBirth,
        membership.membership_tier,
        serializePreferences([]),
      ]
    );

    const timing = await sendOtpForUser({
      email: normalized.email,
      purpose: "EMAIL_VERIFY",
      userId,
    });

    return res.status(201).json({
      message: "Registration successful. Please verify your email.",
      userId,
      email: normalized.email,
      ...buildOtpSuccessResponse("Verification code sent."),
      expiresIn: timing.expiresIn,
      resendCooldown: timing.resendCooldown,
    });
  } catch (error) {
    console.error("Register failed:", error);
    return res.status(500).json({ message: "Registration failed.", error: error.message });
  }
});

async function handleRequestOtp(req, res) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const purpose = req.body.purpose || "EMAIL_VERIFY";
    const userId = req.body.userId ?? null;

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const [users] = await pool.query(
      `SELECT user_id, email_verified FROM dbo.UserAccounts WHERE LOWER(email) = LOWER(?)`,
      [email]
    );
    const user = users[0];
    if (!user) {
      return res.status(404).json({ message: "Account not found." });
    }

    if (isVerifyAccountPurpose(purpose) && user.email_verified) {
      return res.status(400).json({ message: "This account is already verified." });
    }

    const cooldown = await checkOtpResendCooldown({
      email,
      purpose,
      userId: userId ?? user.user_id,
    });
    if (!cooldown.allowed) {
      return res.status(429).json({
        message: cooldown.message,
        retryAfter: cooldown.retryAfter,
      });
    }

    const timing = await sendOtpForUser({
      email,
      purpose,
      userId: userId ?? user.user_id,
    });

    return res.json({
      ...buildOtpSuccessResponse("Verification code sent."),
      userId: user.user_id,
      email,
      expiresIn: timing.expiresIn,
      resendCooldown: timing.resendCooldown,
    });
  } catch (error) {
    console.error("Request OTP failed:", error);
    return res.status(500).json({ message: "Could not send verification code." });
  }
}

router.post("/auth/request-otp", handleRequestOtp);
router.post("/auth/resend-otp", handleRequestOtp);

router.post("/auth/verify-otp", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const otp = String(req.body.otp || "").trim();
    const purpose = req.body.purpose || "EMAIL_VERIFY";
    const userId = req.body.userId ?? null;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    const result = await verifyOtpRecord({ email, purpose, otp });
    if (!result.ok) {
      return res.status(result.status || 400).json({ message: result.message });
    }

    const profile = await getProfileForUser(
      userId || (await fetchProfileByEmail(email))?.user_id,
      { ensureProfile: true, email }
    );

    return res.json({
      success: true,
      message: "Verification successful.",
      email,
      user: profile,
    });
  } catch (error) {
    console.error("Verify OTP failed:", error);
    return res.status(500).json({ message: "Verification failed." });
  }
});

async function upsertGoogleUser(googleProfile, { requireOtp = false } = {}) {
  const existing = await fetchProfileByEmail(googleProfile.email);
  const emailVerified = googleProfile.emailVerified && !requireOtp ? 1 : 0;

  if (existing) {
    await pool.query(
      `UPDATE dbo.UserAccounts
       SET full_name = COALESCE(?, full_name),
           avatar_url = COALESCE(?, avatar_url),
           email_verified = CASE WHEN ? = 1 THEN 1 ELSE email_verified END,
           updated_at = SYSDATETIME()
       WHERE user_id = ?`,
      [googleProfile.fullName, googleProfile.picture, emailVerified, existing.user_id]
    );

    if (existing.customer_id == null) {
      await ensureCustomerProfile(existing.user_id, googleProfile.email, {
        username: getEmailPrefix(googleProfile.email),
      });
    }

    return fetchProfileByEmail(googleProfile.email);
  }

  const roleId = await getCustomerRoleId();
  const [insertResult] = await pool.query(
    `INSERT INTO dbo.UserAccounts
      (role_id, full_name, email, phone, password_hash, avatar_url, is_active, email_verified, created_at, updated_at)
     OUTPUT INSERTED.user_id
     VALUES (?, ?, ?, NULL, ?, ?, 1, ?, SYSDATETIME(), SYSDATETIME())`,
    [
      roleId,
      googleProfile.fullName || getEmailPrefix(googleProfile.email),
      googleProfile.email,
      hashPassword(generateSecureToken()),
      googleProfile.picture,
      emailVerified,
    ]
  );

  const userId = insertResult[0]?.user_id;
  const membership = getMembershipInfo(0);

  await pool.query(
    `INSERT INTO dbo.CustomerProfiles
      (user_id, username, loyalty_points, membership_tier, preferences, created_at, updated_at)
     VALUES (?, ?, 0, ?, ?, SYSDATETIME(), SYSDATETIME())`,
    [userId, getEmailPrefix(googleProfile.email), membership.membership_tier, serializePreferences([])]
  );

  return fetchProfileByEmail(googleProfile.email);
}

router.post("/auth/google", async (req, res) => {
  try {
    const { accessToken, credential } = req.body;
    const googleProfile = credential
      ? await verifyGoogleIdToken(credential)
      : await verifyGoogleAccessToken(accessToken);

    const row = await fetchProfileByEmail(googleProfile.email);
    if (!row) {
      return res.status(404).json({
        code: "ACCOUNT_NOT_FOUND",
        message: "No account found for this Google email.",
        email: googleProfile.email,
      });
    }

    if (!row.email_verified) {
      return res.status(403).json({
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email before signing in.",
        userId: row.user_id,
        email: row.email,
      });
    }

    await pool.query(
      `UPDATE dbo.UserAccounts
       SET full_name = COALESCE(?, full_name),
           avatar_url = COALESCE(?, avatar_url),
           last_login_at = SYSDATETIME(),
           updated_at = SYSDATETIME()
       WHERE user_id = ?`,
      [googleProfile.fullName, googleProfile.picture, row.user_id]
    );

    const profile = await getProfileForUser(row.user_id, { ensureProfile: true });
    return res.json({ message: "Login successful.", user: profile });
  } catch (error) {
    console.error("Google login failed:", error);
    return res.status(500).json({ message: error.message || "Google login failed." });
  }
});

router.post("/auth/google-register", async (req, res) => {
  try {
    const { accessToken, credential } = req.body;
    const googleProfile = credential
      ? await verifyGoogleIdToken(credential)
      : await verifyGoogleAccessToken(accessToken);

    const row = await upsertGoogleUser(googleProfile, { requireOtp: true });

    if (row.email_verified) {
      return res.json({
        message: "Account already verified.",
        userId: row.user_id,
        email: row.email,
        user: buildLoginUserResponse(row),
      });
    }

    const timing = await sendOtpForUser({
      email: row.email,
      purpose: "EMAIL_VERIFY",
      userId: row.user_id,
    });

    return res.status(201).json({
      message: "Google account created. Please verify your email.",
      userId: row.user_id,
      email: row.email,
      ...buildOtpSuccessResponse("Verification code sent."),
      expiresIn: timing.expiresIn,
      resendCooldown: timing.resendCooldown,
    });
  } catch (error) {
    console.error("Google register failed:", error);
    return res.status(500).json({ message: error.message || "Google registration failed." });
  }
});

router.post("/auth/change-password", async (req, res) => {
  try {
    const userId = req.body.user_id ?? req.body.userId ?? null;
    const email = req.body.email ?? null;
    const oldPassword = req.body.old_password ?? req.body.currentPassword ?? "";
    const newPassword = req.body.new_password ?? req.body.newPassword ?? "";

    if ((!userId && !email) || !oldPassword || !newPassword) {
      return res.status(400).json({ message: "User, old password, and new password are required." });
    }

    const user = await findUserAccountByIdOrEmail({ userId, email });
    if (!user) {
      return res.status(404).json({ message: "Account not found." });
    }

    if (!user.is_active) {
      return res.status(403).json({ message: "Your account is inactive." });
    }

    const oldPasswordValid = await verifyUserOldPassword(user, oldPassword);
    if (!oldPasswordValid) {
      return res.status(401).json({ message: "Invalid old password." });
    }

    const updateResult = await updateUserPasswordHash(user.user_id, newPassword);
    if (!updateResult.ok) {
      return res.status(500).json({ message: "Could not change password." });
    }

    return res.json({ message: "Password updated successfully." });
  } catch (error) {
    console.error("Change password failed:", error);
    return res.status(500).json({ message: "Could not change password." });
  }
});

router.post("/auth/forgot-password/request-otp", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const user = await findUserAccountByIdOrEmail({ email });
    if (!user) {
      return res.status(404).json({ message: "Account does not exist." });
    }

    const cooldown = await checkOtpResendCooldown({
      email,
      purpose: "PASSWORD_RESET",
      userId: user.user_id,
    });
    if (!cooldown.allowed) {
      return res.status(429).json({
        message: cooldown.message,
        retryAfter: cooldown.retryAfter,
      });
    }

    const timing = await sendOtpForUser({
      email,
      purpose: "PASSWORD_RESET",
      userId: user.user_id,
    });

    return res.json({
      ...buildOtpSuccessResponse("Verification code sent."),
      userId: user.user_id,
      email,
      expiresIn: timing.expiresIn,
      resendCooldown: timing.resendCooldown,
    });
  } catch (error) {
    console.error("Forgot password request OTP failed:", error);
    return res.status(500).json({ message: "Could not send verification code." });
  }
});

router.post("/auth/forgot-password/reset", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const otp = String(req.body.otp || "").trim();
    const newPassword = req.body.new_password ?? req.body.newPassword ?? "";

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "Email, OTP, and new password are required." });
    }

    const user = await findUserAccountByIdOrEmail({ email });
    if (!user) {
      return res.status(404).json({ message: "Account does not exist." });
    }

    const otpResult = await verifyPasswordResetOtp({ email, otp });
    if (!otpResult.ok) {
      return res.status(otpResult.status || 400).json({ message: otpResult.message });
    }

    const updateResult = await updateUserPasswordHash(user.user_id, newPassword);
    if (!updateResult.ok) {
      return res.status(500).json({ message: "Could not reset password." });
    }

    await consumePasswordResetOtp(otpResult.record.otp_id);

    return res.json({ message: "Password reset successfully." });
  } catch (error) {
    console.error("Forgot password reset failed:", error);
    return res.status(500).json({ message: "Could not reset password." });
  }
});

export default router;
