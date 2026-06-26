import pool from "../db.js";

function jsonOk(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

function jsonError(res, message, status = 500) {
  return res.status(status).json({ success: false, message });
}

function mapNotificationRow(row) {
  return {
    notification_id: row.notification_id,
    user_id: row.user_id,
    notification_type: row.notification_type,
    title: row.title,
    message_body: row.message_body,
    is_read: Boolean(row.is_read),
    sent_at: row.sent_at,
  };
}

/**
 * GET /api/notifications
 * Notification history for the signed-in user.
 */
export async function listNotifications(req, res) {
  const userId = req.userId;
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);

  try {
    const [rows] = await pool.query(
      `SELECT TOP (${limit})
         notification_id,
         user_id,
         notification_type,
         title,
         message_body,
         is_read,
         sent_at
       FROM dbo.Notifications
       WHERE user_id = ?
       ORDER BY sent_at DESC, notification_id DESC;`,
      [userId]
    );

    const [countRows] = await pool.query(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread
       FROM dbo.Notifications
       WHERE user_id = ?;`,
      [userId]
    );

    const counts = countRows[0] || { total: 0, unread: 0 };

    return jsonOk(res, {
      items: rows.map(mapNotificationRow),
      total: Number(counts.total) || 0,
      unread: Number(counts.unread) || 0,
    });
  } catch (error) {
    console.error("GET /api/notifications failed:", error);
    return jsonError(res, "Could not load notifications.");
  }
}

/**
 * PATCH /api/notifications/:id/read
 */
export async function markNotificationRead(req, res) {
  const userId = req.userId;
  const notificationId = Number(req.params.id);

  if (!Number.isFinite(notificationId) || notificationId <= 0) {
    return jsonError(res, "Invalid notification id.", 400);
  }

  try {
    const [rows] = await pool.query(
      `UPDATE dbo.Notifications
       SET is_read = 1
       OUTPUT
         INSERTED.notification_id,
         INSERTED.user_id,
         INSERTED.notification_type,
         INSERTED.title,
         INSERTED.message_body,
         INSERTED.is_read,
         INSERTED.sent_at
       WHERE notification_id = ?
         AND user_id = ?;`,
      [notificationId, userId]
    );

    if (!rows[0]) {
      return jsonError(res, "Notification not found.", 404);
    }

    return jsonOk(res, mapNotificationRow(rows[0]));
  } catch (error) {
    console.error("PATCH /api/notifications/:id/read failed:", error);
    return jsonError(res, "Could not update notification.");
  }
}

/**
 * PATCH /api/notifications/read-all
 */
export async function markAllNotificationsRead(req, res) {
  const userId = req.userId;

  try {
    const [result] = await pool.query(
      `UPDATE dbo.Notifications
       SET is_read = 1
       WHERE user_id = ?
         AND is_read = 0;`,
      [userId]
    );

    return jsonOk(res, {
      updated: Number(result?.affectedRows ?? result?.rowsAffected?.[0] ?? 0),
    });
  } catch (error) {
    console.error("PATCH /api/notifications/read-all failed:", error);
    return jsonError(res, "Could not mark all notifications as read.");
  }
}

/**
 * DELETE /api/notifications/:id
 */
export async function deleteNotification(req, res) {
  const userId = req.userId;
  const notificationId = Number(req.params.id);

  if (!Number.isFinite(notificationId) || notificationId <= 0) {
    return jsonError(res, "Invalid notification id.", 400);
  }

  try {
    const [result] = await pool.query(
      `DELETE FROM dbo.Notifications WHERE notification_id = ? AND user_id = ?`,
      [notificationId, userId]
    );

    if (result.rowsAffected[0] === 0) {
      return jsonError(res, "Notification not found.", 404);
    }

    return jsonOk(res, null);
  } catch (error) {
    console.error("DELETE /api/notifications/:id failed:", error);
    return jsonError(res, "Could not delete notification.");
  }
}
