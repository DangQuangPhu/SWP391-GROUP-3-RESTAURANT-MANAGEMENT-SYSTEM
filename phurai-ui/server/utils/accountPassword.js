import pool from "../db.js";
import { hashPassword, verifyStoredPassword } from "./password.js";

export async function findUserAccountByIdOrEmail({ userId = null, email = null } = {}) {
  if (userId != null && userId !== "") {
    const [rows] = await pool.query(
      `SELECT user_id, email, password_hash, is_active, email_verified
       FROM dbo.UserAccounts
       WHERE user_id = ?`,
      [userId]
    );
    return rows[0] || null;
  }

  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const [rows] = await pool.query(
    `SELECT user_id, email, password_hash, is_active, email_verified
     FROM dbo.UserAccounts
     WHERE LOWER(email) = LOWER(?)`,
    [normalizedEmail]
  );
  return rows[0] || null;
}

export async function updateUserPasswordHash(userId, newPassword) {
  const passwordHash = hashPassword(newPassword);
  const [, result] = await pool.query(
    `UPDATE dbo.UserAccounts
     SET password_hash = ?, updated_at = SYSDATETIME()
     WHERE user_id = ?`,
    [passwordHash, userId]
  );
  const affected = result?.rowsAffected?.[0] ?? 0;
  return { ok: affected === 1, passwordHash };
}

export async function verifyUserOldPassword(user, oldPassword) {
  return verifyStoredPassword(oldPassword, user?.password_hash);
}
