import express from 'express';
import pool from '../db.js';
import { analyzeDishImageWithGemini } from '../services/aiService.js';

const router = express.Router();

router.post('/visual-search', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', clientMenuList } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ success: false, message: 'Image data (imageBase64) is required.' });
    }

    let menuList = clientMenuList;
    if (!Array.isArray(menuList) || menuList.length === 0) {
      try {
        const [rows] = await pool.query(`
          SELECT 
            d.dish_id as id,
            d.dish_name as name,
            c.category_name as category,
            d.price,
            d.description
          FROM dbo.Dishes d
          JOIN dbo.MenuCategories c ON d.category_id = c.category_id
          WHERE d.is_available = 1 AND c.is_active = 1
        `);
        menuList = rows;
      } catch (dbErr) {
        console.warn('Could not query DB for menu list in visual search:', dbErr.message);
        menuList = [];
      }
    }

    const aiResult = await analyzeDishImageWithGemini({
      imageBase64,
      mimeType,
      menuList
    });

    res.json({
      success: true,
      data: aiResult
    });
  } catch (error) {
    console.error('Visual Search Route Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to analyze image.'
    });
  }
});

export default router;
