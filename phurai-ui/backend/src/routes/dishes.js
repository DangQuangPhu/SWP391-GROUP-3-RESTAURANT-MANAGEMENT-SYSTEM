import express from "express";
import pool from "../db.js";

const router = express.Router();

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
          img.image_url
      FROM dbo.Dishes d
      JOIN dbo.MenuCategories c
          ON d.category_id = c.category_id
      LEFT JOIN dbo.DishImages img
          ON d.dish_id = img.dish_id
         AND img.is_primary = 1
      WHERE d.is_available = 1
        AND d.allow_preorder = 1
      ORDER BY
          ISNULL(d.preorder_sort, 9999),
          c.display_order,
          d.dish_name;
    `);

    return res.json({
      success: true,
      data: rows,
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

export default router;