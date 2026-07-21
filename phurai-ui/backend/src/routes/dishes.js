import express from "express";
import pool from "../db.js";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { authMiddleware } from "../middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, "../uploads/dishes");

// Ensure directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage config to name the file dish-[id].jpg
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const dishId = req.params.id;
    cb(null, `dish-${dishId}.jpg`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  }
});

const router = express.Router();

const requireManagerOrAdmin = (req, res, next) => {
  const role = req.user?.role_id;
  if (role === 3 || role === 4 || role === 5) {
    next();
  } else {
    return res.status(403).json({ success: false, message: 'Forbidden: Requires Manager or Admin role' });
  }
};

// GET /api/dishes/preorder
router.get("/preorder", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
          d.dish_id,
          d.dish_name,
          d.description,
          d.price,
          d.spicy_level,
          d.prep_time_min,
          c.category_name,
          d.is_available
      FROM dbo.Dishes d
      JOIN dbo.MenuCategories c
          ON d.category_id = c.category_id
      WHERE d.allow_preorder = 1
      ORDER BY
          ISNULL(d.preorder_sort, 9999),
          c.display_order,
          d.dish_name;
    `);

    return res.json({
      success: true,
      data: rows.map(r => ({
        ...r,
        image_url: `/api/dishes/${r.dish_id}/image`,
        is_available: r.is_available === true || r.is_available === 1
      })),
    });
  } catch (error) {
    console.error("GET /api/dishes/preorder failed:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load preorder dishes.",
      error: error.message,
    });
  }
});

// GET /api/dishes/:id/image -> Serves the dish image or fallback
router.get("/:id/image", (req, res) => {
  const dishId = req.params.id;
  const imagePath = path.join(UPLOADS_DIR, `dish-${dishId}.jpg`);

  if (fs.existsSync(imagePath)) {
    return res.sendFile(imagePath);
  }

  // Fallback to static menu hero image
  const fallbackPath = path.join(__dirname, "../../frontend/src/assets/images/menu/menu-hero.jpg");
  if (fs.existsSync(fallbackPath)) {
    return res.sendFile(fallbackPath);
  }
  
  return res.status(404).json({ success: false, message: "Image not found" });
});

// POST /api/dishes/:id/image -> Upload/Update dish image
router.post("/:id/image", authMiddleware, requireManagerOrAdmin, (req, res) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file provided" });
    }
    
    // Trigger socket update for live menu changes
    const io = req.app.get('io');
    if (io) {
      io.emit('menu:updated');
    }

    return res.json({
      success: true,
      message: "Image uploaded successfully",
      image_url: `/api/dishes/${req.params.id}/image`
    });
  });
});

export default router;