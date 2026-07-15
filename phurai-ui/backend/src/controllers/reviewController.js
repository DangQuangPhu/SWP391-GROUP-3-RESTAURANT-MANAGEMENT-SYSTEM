import pool from "../db.js";

export async function submitReview(req, res) {
  try {
    const { orderId } = req.params;
    const { food_rating, service_rating, ambiance_rating, comment, customer_id, reservation_id } = req.body;

    // Validate inputs
    if (!orderId || isNaN(orderId)) {
      return res.status(400).json({ success: false, message: "Invalid order ID" });
    }

    if (!food_rating || !service_rating || !ambiance_rating) {
      return res.status(400).json({ success: false, message: "Please provide ratings for Food, Service, and Ambiance." });
    }

    // Insert into DB
    const [result] = await pool.query(
      `INSERT INTO dbo.CustomerReviews 
       (customer_id, reservation_id, order_id, food_rating, service_rating, ambiance_rating, comment, is_visible)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        customer_id || null, 
        reservation_id || null, 
        orderId, 
        food_rating, 
        service_rating, 
        ambiance_rating, 
        comment || null
      ]
    );

    res.json({ success: true, message: "Review submitted successfully" });
  } catch (error) {
    console.error("POST /api/reviews/submit error:", error);
    res.status(500).json({ success: false, message: "Failed to submit review" });
  }
}

export async function getManagerReviews(req, res) {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = "WHERE cr.is_visible = 1";
    let params = [];
    if (startDate && endDate) {
      dateFilter += " AND cr.created_at >= ? AND cr.created_at <= ?";
      params = [startDate, endDate + ' 23:59:59'];
    }

    // Fetch individual reviews
    const [reviews] = await pool.query(
      `SELECT 
         cr.review_id,
         cr.food_rating,
         cr.service_rating,
         cr.ambiance_rating,
         cr.overall_rating,
         cr.comment,
         cr.created_at,
         cr.order_id,
         COALESCE(ua.full_name, r.contact_name, N'Guest') AS customer_name
       FROM dbo.CustomerReviews cr
       LEFT JOIN dbo.UserAccounts ua ON cr.customer_id = ua.user_id
       LEFT JOIN dbo.Reservations r ON cr.reservation_id = r.reservation_id
       ${dateFilter}
       ORDER BY cr.created_at DESC`,
      params
    );

    // Fetch aggregate metrics
    const [metrics] = await pool.query(
      `SELECT 
         COUNT(*) as total_reviews,
         AVG(CONVERT(FLOAT, food_rating)) as avg_food,
         AVG(CONVERT(FLOAT, service_rating)) as avg_service,
         AVG(CONVERT(FLOAT, ambiance_rating)) as avg_ambiance,
         AVG(CONVERT(FLOAT, overall_rating)) as avg_overall
       FROM dbo.CustomerReviews cr
       ${dateFilter}`,
      params
    );

    res.json({
      success: true,
      data: reviews,
      metrics: metrics[0] || { total_reviews: 0, avg_food: 0, avg_service: 0, avg_ambiance: 0, avg_overall: 0 }
    });
  } catch (error) {
    console.error("GET /api/reviews/manager error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch reviews" });
  }
}
