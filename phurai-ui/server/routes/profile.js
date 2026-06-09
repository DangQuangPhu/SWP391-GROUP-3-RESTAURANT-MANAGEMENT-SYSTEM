import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import pool from "../db.js";
import { resolveUserId, requireUserId } from "../middleware/authMiddleware.js";
import {
  getProfileForUser,
  updateUserProfile,
  parsePreferences,
  serializePreferences,
} from "../utils/profileService.js";
import {
  isPhoneOnlyProfileUpdate,
  validatePhoneUpdatePayload,
  validateProfilePayload,
} from "../utils/validation.js";

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "../uploads/avatars");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || ".jpg").toLowerCase() || ".jpg";
      cb(null, `avatar-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  },
});

function mapValidatedToDb(normalized, body) {
  const fullName = String(body.fullName || "").trim();
  const composedName =
    fullName ||
    [normalized.firstName, normalized.lastName].filter(Boolean).join(" ").trim();

  return {
    full_name: composedName,
    phone: normalized.phoneNumber || "",
    username: normalized.username,
    date_of_birth: normalized.dateOfBirth || null,
    gender: normalized.gender,
    country: normalized.country,
    language: normalized.language,
    bio: normalized.bio,
    preferences:
      body.preferences !== undefined ? parsePreferences(body.preferences) : undefined,
  };
}

async function handleGetProfile(req, res) {
  try {
    const userId = req.userId || Number(req.params.userId);
    if (!userId) {
      return res.status(401).json({ success: false, message: "User id is required." });
    }

    const profile = await getProfileForUser(userId, { ensureProfile: true });
    if (!profile) {
      return res.status(404).json({ success: false, message: "Profile not found." });
    }

    return res.json({ success: true, user: profile });
  } catch (error) {
    console.error("Get profile failed:", error);
    return res.status(500).json({ success: false, message: "Could not load profile." });
  }
}

async function handleUpdateProfile(req, res, { partial = false } = {}) {
  try {
    const userId = req.userId || Number(req.params.userId);
    if (!userId) {
      return res.status(401).json({ success: false, message: "User id is required." });
    }

    if (isPhoneOnlyProfileUpdate(req.body)) {
      const { errors, normalized } = validatePhoneUpdatePayload(req.body);
      if (Object.keys(errors).length) {
        return res.status(400).json({ success: false, message: "Validation failed.", errors });
      }
      const updated = await updateUserProfile(userId, {
        phone: normalized.phoneNumber,
      });
      return res.json({ success: true, user: updated });
    }

    const { errors, normalized } = validateProfilePayload(req.body, { partial });
    if (Object.keys(errors).length) {
      return res.status(400).json({ success: false, message: "Validation failed.", errors });
    }

    const dbPayload = mapValidatedToDb(normalized, req.body);
    if (req.body.avatarUrl !== undefined) {
      dbPayload.avatar_url = req.body.avatarUrl;
    }

    const updated = await updateUserProfile(userId, dbPayload);
    if (!updated) {
      return res.status(404).json({ success: false, message: "Profile not found." });
    }

    return res.json({ success: true, user: updated });
  } catch (error) {
    console.error("Update profile failed:", error);
    return res.status(500).json({ success: false, message: "Could not update profile." });
  }
}

router.get("/me", resolveUserId, requireUserId, handleGetProfile);
router.put("/me", resolveUserId, requireUserId, (req, res) => handleUpdateProfile(req, res));
router.get("/:userId", resolveUserId, handleGetProfile);
router.put("/:userId", resolveUserId, (req, res) => handleUpdateProfile(req, res));
router.patch("/:userId", resolveUserId, (req, res) =>
  handleUpdateProfile(req, res, { partial: true })
);

router.post("/:userId/avatar/upload", resolveUserId, upload.single("avatar"), async (req, res) => {
  try {
    const userId = req.userId || Number(req.params.userId);
    if (!userId || !req.file) {
      return res.status(400).json({ success: false, message: "Avatar file is required." });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const updated = await updateUserProfile(userId, { avatar_url: avatarUrl });

    return res.json({
      success: true,
      avatarUrl,
      user: updated,
    });
  } catch (error) {
    console.error("Avatar upload failed:", error);
    return res.status(500).json({ success: false, message: "Avatar upload failed." });
  }
});

router.put("/:userId/avatar/system", resolveUserId, async (req, res) => {
  try {
    const userId = req.userId || Number(req.params.userId);
    const avatarUrl = String(req.body?.avatarUrl || "").trim();
    if (!userId || !avatarUrl) {
      return res.status(400).json({ success: false, message: "Avatar url is required." });
    }

    const updated = await updateUserProfile(userId, { avatar_url: avatarUrl });
    return res.json({ success: true, avatarUrl, user: updated });
  } catch (error) {
    console.error("System avatar update failed:", error);
    return res.status(500).json({ success: false, message: "Avatar update failed." });
  }
});

router.put("/:userId/avatar/google", resolveUserId, async (req, res) => {
  try {
    const userId = req.userId || Number(req.params.userId);
    if (!userId) {
      return res.status(400).json({ success: false, message: "User id is required." });
    }

    const [rows] = await pool.query(
      `SELECT avatar_url FROM dbo.UserAccounts WHERE user_id = ?`,
      [userId]
    );
    const current = rows[0]?.avatar_url;
    if (!current) {
      return res.status(400).json({
        success: false,
        message: "No Google avatar is stored for this account.",
      });
    }

    return res.json({
      success: true,
      avatarUrl: current,
      user: await getProfileForUser(userId, { ensureProfile: true }),
    });
  } catch (error) {
    console.error("Google avatar update failed:", error);
    return res.status(500).json({ success: false, message: "Avatar update failed." });
  }
});

export default router;
