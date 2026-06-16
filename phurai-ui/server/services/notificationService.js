import pool from "../db.js";
import { getIO } from "../socket.js";

const STAFF_ROLE_IDS = [2, 3, 4, 5];

const ALLOWED_TYPES = new Set([
  "Booking Confirmed",
  "Booking Rejected",
  "Booking Reminder",
  "Order Ready",
  "Payment Receipt",
  "Promotion",
  "System",
]);

async function getStaffAndManagerUserIds() {
  const placeholders = STAFF_ROLE_IDS.map(() => "?").join(", ");
  const [rows] = await pool.query(
    `SELECT user_id
     FROM dbo.UserAccounts
     WHERE role_id IN (${placeholders})
       AND is_active = 1;`,
    STAFF_ROLE_IDS
  );
  return rows.map((row) => row.user_id);
}

export async function insertNotification(userId, notificationType, title, messageBody) {
  const type = ALLOWED_TYPES.has(notificationType) ? notificationType : "System";
  const [rows] = await pool.query(
    `INSERT INTO dbo.Notifications
       (user_id, notification_type, title, message_body, is_read, sent_at)
     OUTPUT
       INSERTED.notification_id,
       INSERTED.user_id,
       INSERTED.notification_type,
       INSERTED.title,
       INSERTED.message_body,
       INSERTED.is_read,
       INSERTED.sent_at
     VALUES
       (?, ?, ?, ?, 0, SYSDATETIME());`,
    [userId, type, title, messageBody]
  );
  return rows[0] ?? null;
}

function mapNotificationRow(row) {
  if (!row) return null;
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
 * Broadcast a customer-initiated action to all staff/manager users.
 */
export async function notifyStaffNewCustomerAction({
  actionType = "reservation",
  title,
  message,
  payload = {},
}) {
  const io = getIO();
  const staffUserIds = await getStaffAndManagerUserIds();
  const body = message || title || "New customer activity";

  const inserts = await Promise.all(
    staffUserIds.map((userId) =>
      insertNotification(userId, "System", title || "New activity", body)
    )
  );

  const eventPayload = {
    actionType,
    title: title || "New activity",
    message: body,
    sent_at: new Date().toISOString(),
    ...payload,
  };

  io?.to("staff_room").emit("NEW_CUSTOMER_ACTION", eventPayload);

  return {
    recipients: staffUserIds.length,
    notifications: inserts.filter(Boolean).map(mapNotificationRow),
    payload: eventPayload,
  };
}

/**
 * Notify a specific customer about a staff action (check-in, order served, etc.).
 */
export async function notifyCustomerStaffAction({
  customerId,
  sessionId = null,
  notificationType = "System",
  title,
  message,
  payload = {},
}) {
  const parsedCustomerId = Number(customerId);
  if (!Number.isFinite(parsedCustomerId) || parsedCustomerId <= 0) {
    return null;
  }

  const body = message || title || "Update from the restaurant";
  const saved = await insertNotification(
    parsedCustomerId,
    notificationType,
    title || "Restaurant update",
    body
  );

  const eventPayload = {
    title: title || "Restaurant update",
    message: body,
    sent_at: new Date().toISOString(),
    ...payload,
  };

  const io = getIO();
  io?.to(`customer_${parsedCustomerId}`).emit("STAFF_ACTION_UPDATE", eventPayload);

  const parsedSessionId = Number(sessionId);
  if (Number.isFinite(parsedSessionId) && parsedSessionId > 0) {
    io?.to(`session_${parsedSessionId}`).emit("STAFF_ACTION_UPDATE", eventPayload);
  }

  return {
    notification: mapNotificationRow(saved),
    payload: eventPayload,
  };
}
