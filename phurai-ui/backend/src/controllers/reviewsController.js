import sql from 'mssql';
import { getRawPool } from '../db.js';
import { getIO } from '../socket.js';

/**
 * POST /api/public/reviews/:orderId
 * Finalized for Phase 4: Handle NULL customer IDs for public QR order reviews
 */
export const submitOrderReviewPublic = async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId, 10);
    const { rating, foodRating, serviceRating, ambianceRating, notes } = req.body;
    
    const fRating = parseInt(foodRating || rating, 10);
    const sRating = parseInt(serviceRating || rating, 10);
    const aRating = parseInt(ambianceRating || rating, 10);

    if (isNaN(orderId) || orderId <= 0 || 
        isNaN(fRating) || fRating < 1 || fRating > 5 ||
        isNaN(sRating) || sRating < 1 || sRating > 5 ||
        isNaN(aRating) || aRating < 1 || aRating > 5) {
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
      .input('fRating', sql.TinyInt, fRating)
      .input('sRating', sql.TinyInt, sRating)
      .input('aRating', sql.TinyInt, aRating)
      .input('notes', sql.NVarChar(1000), notes || '')
      .query(`
        INSERT INTO dbo.CustomerReviews (
          customer_id, order_id, food_rating, service_rating, ambiance_rating, comment, is_visible, created_at
        ) VALUES (
          @customerId, @orderId, @fRating, @sRating, @aRating, @notes, 1, SYSDATETIME()
        )
      `);

    try {
      const io = getIO();
      if (io) {
        io.emit('review:created', {
          order_id: orderId,
          food_rating: fRating,
          service_rating: sRating,
          ambiance_rating: aRating,
          overall_rating: Math.round((fRating + sRating + aRating) / 3),
          comment: notes || '',
          created_at: new Date()
        });
      }
    } catch (socketErr) {
      console.error("[Socket] Failed to emit review:created:", socketErr.message);
    }

    return res.json({ success: true, message: "Review submitted successfully" });

  } catch (error) {
    console.error("Error submitting public order review:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};
