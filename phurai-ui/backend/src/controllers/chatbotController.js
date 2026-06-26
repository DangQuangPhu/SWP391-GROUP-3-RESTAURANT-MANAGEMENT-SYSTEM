import pool from "../db.js";

export const getChatbotQuery = async (req, res) => {
  try {
    const { action } = req.query;

    if (!action) {
      return res.status(400).json({ error: "Missing action parameter" });
    }

    switch (action) {
      case "daily_revenue": {
        const query = `
          SELECT ISNULL(SUM(amount_paid), 0) AS daily_revenue 
          FROM dbo.Payments 
          WHERE CAST(paid_at AS DATE) = CAST(SYSDATETIME() AS DATE) 
            AND payment_status = N'Completed';
        `;
        const [result] = await pool.query(query);
        return res.json({ action, data: result[0] });
      }

      case "top_dish": {
        const query = `
          SELECT TOP 1 d.dish_name, SUM(oi.quantity) AS total_sold 
          FROM dbo.OrderItems oi 
          INNER JOIN dbo.Dishes d ON oi.dish_id = d.dish_id 
          WHERE CAST(oi.created_at AS DATE) = CAST(SYSDATETIME() AS DATE) 
            AND oi.item_status != N'Cancelled' 
          GROUP BY d.dish_name 
          ORDER BY total_sold DESC;
        `;
        const [result] = await pool.query(query);
        return res.json({ action, data: result[0] || null });
      }

      case "table_status": {
        const query = `
          SELECT table_status, COUNT(table_id) AS table_count 
          FROM dbo.RestaurantTables 
          GROUP BY table_status;
        `;
        const [result] = await pool.query(query);
        return res.json({ action, data: result });
      }

      default:
        return res.status(400).json({ error: "Invalid action parameter" });
    }
  } catch (error) {
    console.error("Chatbot query error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};
