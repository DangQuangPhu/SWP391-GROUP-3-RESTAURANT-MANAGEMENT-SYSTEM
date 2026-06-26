import { query } from '../config/db.js';

export const TYPE = {
  BOOKING_CONFIRMED: 'Booking Confirmed',
  BOOKING_REJECTED:  'Booking Rejected',
  BOOKING_REMINDER:  'Booking Reminder',
  ORDER_READY:       'Order Ready',
  PAYMENT_RECEIPT:   'Payment Receipt',
  PROMOTION:         'Promotion',
  SYSTEM:            'System',
};

export async function saveNotification(txFn, { userId, type, title, body }) {
  if (!Object.values(TYPE).includes(type)) {
    throw new Error(
      `Invalid notification type "${type}". ` +
      `Valid types: ${Object.values(TYPE).join(' | ')}`
    );
  }
  if (!userId || typeof userId !== 'number') {
    throw new Error(`saveNotification: userId must be a number, got: ${userId}`);
  }

  const safeTitle = String(title  || '').slice(0, 200);
  const safeBody  = String(body   || '').slice(0, 2000);

  await txFn(
    `INSERT INTO dbo.Notifications
       (user_id, notification_type, title, message_body, is_read, sent_at)
     VALUES
       (@UserId, @Type, @Title, @Body, 0, SYSDATETIME())`,
    { UserId: userId, Type: type, Title: safeTitle, Body: safeBody }
  );
}

export async function saveNotificationMany(txFn, userIds, options) {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    console.warn('[Notification] saveNotificationMany called with empty userIds array.');
    return;
  }
  for (const userId of userIds) {
    await saveNotification(txFn, { userId, ...options });
  }
}
