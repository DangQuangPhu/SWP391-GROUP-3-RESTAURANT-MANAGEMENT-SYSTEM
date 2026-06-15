import pool from "../db.js";

const CUSTOMER_ROLE = "Customer";

/**
 * Ensures the caller is an active Customer (after resolveUserId + requireUserId).
 */
export async function requireCustomer(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT r.role_name
       FROM dbo.UserAccounts AS ua
       INNER JOIN dbo.Roles AS r ON ua.role_id = r.role_id
       WHERE ua.user_id = ?
         AND ua.is_active = 1;`,
      [req.userId]
    );

    const roleName = rows[0]?.role_name;
    if (roleName !== CUSTOMER_ROLE) {
      return res.status(403).json({
        success: false,
        message: "Customer access required.",
      });
    }

    req.customerRole = roleName;
    return next();
  } catch (error) {
    console.error("requireCustomer failed:", error);
    return res.status(500).json({
      success: false,
      message: "Could not verify customer access.",
    });
  }
}
