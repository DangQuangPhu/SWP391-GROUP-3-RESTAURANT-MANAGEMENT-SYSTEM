import sql from 'mssql';
import { getRawPool } from '../db.js';

/**
 * POST /api/public/reviews/:orderId
 * Finalized for Phase 4: Handle NULL customer IDs for public QR order reviews
 */
export const submitOrderReviewPublic = async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId, 10);
    const { rating, notes } = req.body;
    
    if (isNaN(orderId) || orderId <= 0 || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Invalid input" });
    }

    const pool = await getRawPool();
    
    // Check if order exists and get customer_id
    const orderResult = await pool.request()
      .input('orderId', sql.Int, orderId)
      .query(`SELECT customer_id FROM dbo.Orders WHERE order_id = @orderId`);
      
    if (orderResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    
    // customer_id can be null for public QR sessions
    const customerId = orderResult.recordset[0].customer_id;

    // Phase 4: UQ_CustomerReviews_order is now the constraint, so check for existing review
    const existingReview = await pool.request()
      .input('orderId', sql.Int, orderId)
      .query(`SELECT review_id FROM dbo.CustomerReviews WHERE order_id = @orderId`);
      
    if (existingReview.recordset.length > 0) {
      return res.status(400).json({ success: false, message: "Review already submitted for this order" });
    }

    await pool.request()
      .input('customerId', sql.Int, customerId || null)
      .input('orderId', sql.Int, orderId)
      .input('rating', sql.TinyInt, rating)
      .input('notes', sql.NVarChar(1000), notes || '')
      .query(`
        INSERT INTO dbo.CustomerReviews (
          customer_id, order_id, food_rating, service_rating, ambiance_rating, comment, is_visible, created_at
        ) VALUES (
          @customerId, @orderId, @rating, @rating, @rating, @notes, 1, SYSDATETIME()
        )
      `);

    return res.json({ success: true, message: "Review submitted successfully" });

  } catch (error) {
    console.error("Error submitting public order review:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};
