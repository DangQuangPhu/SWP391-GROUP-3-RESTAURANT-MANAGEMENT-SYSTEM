import pool from "../db.js";

const CUSTOMER_ROLE = "Customer";

/**
 * Ensures the caller is an active Customer (after resolveUserId + requireUserId).
 * In development mode, falls back gracefully to test customer account if unauthenticated or testing across roles.
 */
export async function requireCustomer(req, res, next) {
  try {
    let userId = req.userId || req.user?.user_id || req.user?.id;
    if (!userId && process.env.NODE_ENV !== "production") {
      const [[devCust]] = await pool.query("SELECT TOP 1 user_id FROM dbo.UserAccounts WHERE email = 'quagphu159@gmail.com' OR role_id = (SELECT role_id FROM dbo.Roles WHERE role_name = 'Customer') ORDER BY CASE WHEN email = 'quagphu159@gmail.com' THEN 0 ELSE 1 END");
      userId = devCust?.user_id || 1;
      req.userId = userId;
    }

    if (!userId) {
      return res.status(403).json({
        success: false,
        message: "Customer access required.",
      });
    }

    const [rows] = await pool.query(
      `SELECT r.role_name
       FROM dbo.UserAccounts AS ua
       INNER JOIN dbo.Roles AS r ON ua.role_id = r.role_id
       WHERE ua.user_id = ?
         AND ua.is_active = 1;`,
      [userId]
    );

    const roleName = rows[0]?.role_name;
    if (!roleName) {
      if (process.env.NODE_ENV !== "production") {
        req.userId = userId;
        req.customerRole = CUSTOMER_ROLE;
        return next();
      }
      return res.status(403).json({
        success: false,
        message: "Customer access required.",
      });
    }

    if (roleName !== CUSTOMER_ROLE && process.env.NODE_ENV === "production") {
      return res.status(403).json({
        success: false,
        message: "Customer access required.",
      });
    }

    req.customerRole = roleName;
    return next();
  } catch (error) {
    console.error("requireCustomer failed:", error);
    if (process.env.NODE_ENV !== "production") {
      req.customerRole = CUSTOMER_ROLE;
      return next();
    }
    return res.status(500).json({
      success: false,
      message: "Could not verify customer access.",
    });
  }
}
