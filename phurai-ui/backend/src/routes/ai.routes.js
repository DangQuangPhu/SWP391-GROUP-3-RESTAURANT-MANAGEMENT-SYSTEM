import express from 'express';
import pool from '../db.js';
import { analyzeDishImageWithGemini, analyzeDishTextWithGemini } from '../services/aiService.js';

const router = express.Router();

router.post('/visual-search', async (req, res) => {
  try {
    const { imageBase64, imageUrl, textPrompt, mimeType = 'image/jpeg', clientMenuList } = req.body;

    let finalBase64 = imageBase64;
    let finalMimeType = mimeType;

    if (!finalBase64 && imageUrl) {
      try {
        const imgRes = await fetch(imageUrl);
        if (!imgRes.ok) {
          return res.status(400).json({ success: false, message: 'Could not download image from the provided URL.' });
        }
        const arrayBuffer = await imgRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        finalBase64 = buffer.toString('base64');
        const contentType = imgRes.headers.get('content-type');
        if (contentType && contentType.startsWith('image/')) {
          finalMimeType = contentType.split(';')[0];
        }
      } catch (fetchErr) {
        console.error('Failed to download image URL on backend:', fetchErr.message);
        return res.status(400).json({ success: false, message: 'Failed to download image from URL. Please check if the URL is publicly accessible.' });
      }
    }

    if (!finalBase64 && !textPrompt) {
      return res.status(400).json({ success: false, message: 'Image data (imageBase64/imageUrl) or textPrompt is required.' });
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

    let aiResult;
    if (textPrompt) {
      aiResult = await analyzeDishTextWithGemini({
        textPrompt,
        menuList
      });
    } else {
      aiResult = await analyzeDishImageWithGemini({
        imageBase64: finalBase64,
        mimeType: finalMimeType,
        menuList
      });
    }

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
