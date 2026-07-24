import express from "express";
import jwt from "jsonwebtoken";
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
    ua.last_login_at,
    r.role_name,
    cp.customer_id,
    cp.username,
    cp.date_of_birth,
    cp.gender,
    cp.country,
    cp.[language],
    cp.bio,
    cp.loyalty_points,
    cp.preferences
  FROM dbo.UserAccounts ua
  LEFT JOIN dbo.Roles r ON ua.role_id = r.role_id
  LEFT JOIN dbo.CustomerProfiles cp ON ua.user_id = cp.user_id
`;

async function sendOtpForUser({ email, purpose, userId = null }) {
  const otp = generateOtpCode();
  // Save OTP to DB first — this must succeed regardless of email status
  const timing = await saveOtpToken({ email, purpose, otp, userId });
  const normalizedPurpose = normalizeOtpPurpose(purpose);

  if (isDevOtpSampleEmail(email)) {
    logDevOtp(email, normalizedPurpose, otp);
  } else {
    // Protocol #1: Email is non-critical — wrap in isolated try/catch.
    // If SMTP fails, the OTP is still valid in the DB (dev: visible in console).
    try {
      await sendOtpEmail({ to: email, otp, purpose });
      logOtpSent(email);
    } catch (emailErr) {
      console.error(
        `[sendOtpForUser] SMTP failed for ${email} (non-fatal, OTP still valid):`,
        String(emailErr?.message || emailErr)
      );
      // In dev mode, log the OTP so it's not lost
      if (process.env.NODE_ENV !== "production") {
        console.log(`[DEV] OTP for ${email} (SMTP bypassed) → ${otp}`);
      }
    }
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

    // First-login / forced reset check
    // Uses force_password_reset column (explicit) as primary signal.
    // Falls back to last_login_at IS NULL as secondary for rows created before migration.
    if (user.force_password_reset === 1 || user.force_password_reset === true
        || user.last_login_at == null) {

      const restrictedToken = jwt.sign(
        {
          user_id: user.user_id,
          email: user.email,
          firstLogin: true
        },
        process.env.JWT_SECRET,
        { expiresIn: "15m" }
      );
      
      return res.json({
        requirePasswordReset: true,
        message: "Please change your default password.",
        token: restrictedToken,
        user: buildLoginUserResponse(user)
      });
    }

    await pool.query(
      `UPDATE dbo.UserAccounts
       SET last_login_at = SYSDATETIME(), updated_at = SYSDATETIME()
       WHERE user_id = ?`,
      [user.user_id]
    );

    const token = jwt.sign(
      {
        user_id: user.user_id,
        role_id: user.role_id,
        role_name: user.role_name,
        full_name: user.full_name,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      message: "Login successful.",
      token,
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
        message: "Email is already registered by another account.",
        errors: { email: "Email is already registered by another account." },
      });
    }

    if (normalized.phoneNumber) {
      const cleanPhone = normalized.phoneNumber.replace(/[\s\-()]/g, '');
      const [existingPhone] = await pool.query(
        `SELECT user_id FROM dbo.UserAccounts WHERE REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', '') = ?`,
        [cleanPhone]
      );
      if (existingPhone[0]) {
        return res.status(409).json({
          message: "Phone number is already registered by another account.",
          errors: { phoneNumber: "Phone number is already registered by another account." },
        });
      }
    }

    if (normalized.username) {
      const [existingUsername] = await pool.query(
        `SELECT cp.customer_id
         FROM dbo.CustomerProfiles cp
         WHERE LOWER(cp.username) = LOWER(?)`,
        [normalized.username]
      );
      if (existingUsername[0]) {
        return res.status(409).json({
          message: "Username is already taken by another account.",
          errors: { username: "Username is already taken by another account." },
        });
      }
    }


    const roleId = await getCustomerRoleId();
    const fullName = `${normalized.firstName} ${normalized.lastName}`.trim();
    const passwordHash = hashPassword(normalized.password);

    const [insertResult] = await pool.query(
      `DECLARE @OutputTbl TABLE (user_id INT);
       INSERT INTO dbo.UserAccounts
        (role_id, full_name, email, phone, password_hash, avatar_url, is_active, email_verified, created_at, updated_at)
       OUTPUT INSERTED.user_id INTO @OutputTbl
       VALUES (?, ?, ?, ?, ?, NULL, 1, 0, SYSDATETIME(), SYSDATETIME());
       SELECT user_id FROM @OutputTbl;`,
      [roleId, fullName, normalized.email, normalized.phoneNumber, passwordHash]
    );

    const userId = insertResult[0]?.user_id;

    await pool.query(
      `INSERT INTO dbo.CustomerProfiles
        (user_id, username, date_of_birth, gender, country, [language], bio,
         loyalty_points, preferences, created_at, updated_at)
       VALUES (?, ?, ?, NULL, NULL, NULL, NULL, 0, ?, SYSDATETIME(), SYSDATETIME())`,
      [
        userId,
        normalized.username,
        normalized.dateOfBirth,
        serializePreferences([]),
      ]
    );

    const timing = await sendOtpForUser({
      email: normalized.email,
      purpose: "EMAIL_VERIFY",
      userId,
    });

    // Grant Welcome Promotion to new users (non-fatal if it fails)
    await grantWelcomePromotion(userId);

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

router.get("/auth/debug-db", async (req, res) => {
  try {
    const email = "quagphu159@gmail.com";
    const [userRows] = await pool.query(
      `SELECT user_id, role_id, full_name, email, phone, avatar_url, email_verified, created_at, updated_at 
       FROM dbo.UserAccounts WHERE email = ?`,
      [email]
    );
    const [profileRows] = await pool.query(
      `SELECT * FROM dbo.CustomerProfiles WHERE user_id = (SELECT user_id FROM dbo.UserAccounts WHERE email = ?)`,
      [email]
    );
    return res.json({
      success: true,
      user: userRows[0] || null,
      profile: profileRows[0] || null
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

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

/**
 * Grants a "Welcome" promotion to a newly registered customer.
 * Finds the first active promotion with points_required = 0 and promotion_name LIKE 'Welcome%'.
 * Inserts into CustomerPromotions and creates a Promotion notification.
 * Non-fatal: errors are logged but not rethrown.
 */
async function grantWelcomePromotion(userId) {
  try {
    // Find active welcome promotion
    const [promoRows] = await pool.query(`
      SELECT TOP 1 promotion_id, promotion_name, validity_duration_hours
      FROM dbo.Promotions
      WHERE is_active = 1
        AND (points_required = 0 OR points_required IS NULL)
        AND promotion_name LIKE N'Welcome%'
        AND start_at <= SYSDATETIME()
        AND end_at > SYSDATETIME()
      ORDER BY promotion_id ASC
    `);

    const promo = promoRows[0];
    if (!promo) return; // No welcome promotion configured yet

    // Generate unique promo code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let promoCode = 'WELCOME-';
    for (let i = 0; i < 6; i++) promoCode += chars[Math.floor(Math.random() * chars.length)];

    const hoursValid = promo.validity_duration_hours || 720; // 30 days default
    const expiresAt = new Date(Date.now() + hoursValid * 60 * 60 * 1000);

    await pool.query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.CustomerPromotions WHERE customer_id = ? AND promotion_id = ?)
      BEGIN
        INSERT INTO dbo.CustomerPromotions
          (customer_id, promotion_id, points_spent, promo_code, status, redeemed_at, expires_at)
        VALUES (?, ?, 0, ?, N'active', SYSDATETIME(), ?)
      END
    `, [userId, promo.promotion_id, userId, promo.promotion_id, promoCode, expiresAt]);

    // Send a notification (type must be 'Promotion' per DB CHECK constraint)
    await pool.query(`
      INSERT INTO dbo.Notifications (user_id, notification_type, title, message_body, is_read, sent_at)
      VALUES (?, N'Promotion', N'🎉 Welcome Gift Received!',
        N'You have received a welcome promotion code (${promoCode}). Use it on your first order or reservation!',
        0, SYSDATETIME())
    `, [userId]);

    // Real-time socket notification push
    try {
      const { getIO } = await import("../socket.js");
      const io = getIO();
      if (io) {
        io.to(`user_${userId}`).emit("STAFF_ACTION_UPDATE", {
          title: "🎉 Welcome Gift Received!",
          message: `You have received a welcome promo code (${promoCode}). Use it on your first order or reservation!`,
          type: "Promotion"
        });
      }
    } catch (socketErr) {
      console.warn('[Auth] Socket emit failed for welcome promo:', socketErr.message);
    }

  } catch (err) {
    // Non-fatal — log and continue
    console.warn('[Auth] grantWelcomePromotion failed (non-fatal):', err.message);
  }
}

async function upsertGoogleUser(googleProfile, { requireOtp = false } = {}) {
  const existing = await fetchProfileByEmail(googleProfile.email);
  const emailVerified = googleProfile.emailVerified && !requireOtp ? 1 : 0;

  if (existing) {
    // NULLIF converts empty string to NULL so COALESCE keeps the existing DB value
    await pool.query(
      `UPDATE dbo.UserAccounts
       SET full_name = COALESCE(NULLIF(?, ''), full_name),
           avatar_url = COALESCE(NULLIF(?, ''), avatar_url),
           phone = COALESCE(NULLIF(?, ''), phone),
           email_verified = CASE WHEN ? = 1 THEN 1 ELSE email_verified END,
           updated_at = SYSDATETIME()
       WHERE user_id = ?`,
      [googleProfile.fullName, googleProfile.picture, googleProfile.phoneNumber, emailVerified, existing.user_id]
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
    `DECLARE @OutputTbl TABLE (user_id INT);
      INSERT INTO dbo.UserAccounts
       (role_id, full_name, email, phone, password_hash, avatar_url, is_active, email_verified, created_at, updated_at)
      OUTPUT INSERTED.user_id INTO @OutputTbl
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, SYSDATETIME(), SYSDATETIME());
      SELECT user_id FROM @OutputTbl;`,
    [
      roleId,
      googleProfile.fullName || getEmailPrefix(googleProfile.email),
      googleProfile.email,
      googleProfile.phoneNumber || null,
      hashPassword(generateSecureToken()),
      googleProfile.picture,
      emailVerified,
    ]
  );

  const userId = insertResult[0]?.user_id;

  await pool.query(
    `INSERT INTO dbo.CustomerProfiles
      (user_id, username, loyalty_points, preferences, created_at, updated_at)
     VALUES (?, ?, 0, ?, SYSDATETIME(), SYSDATETIME())`,
    [userId, getEmailPrefix(googleProfile.email), serializePreferences([])]
  );

  // Grant Welcome Promotion to new users (non-fatal if it fails)
  await grantWelcomePromotion(userId);

  return fetchProfileByEmail(googleProfile.email);
}

router.post("/auth/google", async (req, res) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID) {
      console.warn("WARNING: GOOGLE_CLIENT_ID is not defined in environment variables");
    }

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
       SET full_name = COALESCE(NULLIF(?, ''), full_name),
           avatar_url = COALESCE(NULLIF(?, ''), avatar_url),
           phone = COALESCE(NULLIF(?, ''), phone),
           last_login_at = SYSDATETIME(),
           updated_at = SYSDATETIME()
       WHERE user_id = ?`,
      [googleProfile.fullName, googleProfile.picture, googleProfile.phoneNumber, row.user_id]
    );

    const profile = await getProfileForUser(row.user_id, { ensureProfile: true });
    const token = jwt.sign(
      {
        user_id: profile.user_id,
        role_id: profile.role_id,
        role_name: profile.role_name,
        full_name: profile.full_name,
        email: profile.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    return res.json({ message: "Login successful.", token, user: profile });
  } catch (error) {
    console.error("Google Auth Crash:", error);
    return res.status(500).json({ success: false, message: error.message });
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
      const profile = await getProfileForUser(row.user_id, { ensureProfile: true });
      const token = jwt.sign(
        {
          user_id: profile.user_id,
          role_id: profile.role_id,
          role_name: profile.role_name,
          full_name: profile.full_name,
          email: profile.email,
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );
      return res.json({
        message: "Account already verified.",
        token,
        userId: row.user_id,
        email: row.email,
        user: buildLoginUserResponse(profile),
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

async function handleForgotPasswordOtpRequest(req, res) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const purpose = req.body.purpose || "forgot_password";
    const userId = req.body.userId ?? null;

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const user = await findUserAccountByIdOrEmail({ email });
    if (!user) {
      return res.status(404).json({ message: "Account does not exist." });
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
    console.error("Forgot password request OTP failed:", error);
    return res.status(500).json({ message: "Could not send verification code." });
  }
}

router.post("/auth/forgot-password/request-otp", handleForgotPasswordOtpRequest);

router.post("/auth/forgot-password/resend-otp", handleForgotPasswordOtpRequest);

router.post("/auth/forgot-password/verify-otp", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const otp = String(req.body.otp || "").trim();
    const purpose = req.body.purpose || "forgot_password";

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    const normalizedPurpose = normalizeOtpPurpose(purpose);
    const result =
      normalizedPurpose === "CHANGE_PASSWORD"
        ? await verifyOtpRecord({ email, purpose, otp })
        : await verifyPasswordResetOtp({ email, otp });

    if (!result.ok) {
      return res.status(result.status || 400).json({ message: result.message });
    }

    return res.json({
      success: true,
      message: "Verification successful.",
      email,
    });
  } catch (error) {
    console.error("Forgot password verify OTP failed:", error);
    return res.status(500).json({ message: "Verification failed." });
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

router.post("/first-login-reset", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: "No token provided." });
    
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!decoded.firstLogin) {
      return res.status(403).json({ message: "Invalid token for password reset." });
    }
    
    const { newPassword } = req.body;
    if (!newPassword || !isPasswordStrong(newPassword)) {
      return res.status(400).json({ message: "Password must meet security requirements." });
    }
    
    const updateResult = await updateUserPasswordHash(decoded.user_id, newPassword);
    if (!updateResult.ok) {
       return res.status(500).json({ message: "Failed to update password." });
    }
    
    // Clear force_password_reset flag + stamp last_login_at
    await pool.query(
      "UPDATE dbo.UserAccounts SET last_login_at = SYSDATETIME(), force_password_reset = 0, updated_at = SYSDATETIME() WHERE user_id = ?",
      [decoded.user_id]
    );

    
    // Fetch user and issue normal token
    const [users] = await pool.query(`${PROFILE_SELECT} WHERE ua.user_id = ?`, [decoded.user_id]);
    const user = users[0];
    
    const newToken = jwt.sign(
      {
        user_id: user.user_id,
        role_id: user.role_id,
        role_name: user.role_name,
        full_name: user.full_name,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    
    return res.json({
      message: "Password reset successful. Login complete.",
      token: newToken,
      user: buildLoginUserResponse(user)
    });
  } catch(error) {
    console.error("First login reset failed:", error);
    return res.status(401).json({ message: "Invalid or expired token." });
  }
});

export default router;
