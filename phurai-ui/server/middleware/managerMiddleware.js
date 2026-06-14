import pool from "../db.js";

const MANAGER_ROLES = new Set(["Manager", "Admin"]);

/**
 * Ensures the caller is an active Manager or Admin (after resolveUserId + requireUserId).
 */
export async function requireManager(req, res, next) {
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
    if (!roleName || !MANAGER_ROLES.has(roleName)) {
      return res.status(403).json({
        success: false,
        message: "Manager access required.",
      });
    }

    req.managerRole = roleName;
    return next();
  } catch (error) {
    console.error("requireManager failed:", error);
    return res.status(500).json({
      success: false,
      message: "Could not verify manager access.",
    });
  }
}
