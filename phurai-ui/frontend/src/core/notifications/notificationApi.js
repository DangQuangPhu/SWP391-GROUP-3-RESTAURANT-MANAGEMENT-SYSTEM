import { request, profileRequestHeaders } from "@/core/api/httpClient.js";

export async function fetchNotifications(userId, { limit = 60 } = {}) {
  const res = await request(`/notifications?limit=${limit}`, {
    method: "GET",
    headers: profileRequestHeaders(userId),
  });

  if (!res?.success) {
    throw new Error(res?.message || "Could not load notifications.");
  }

  return res.data ?? { items: [], total: 0, unread: 0 };
}

export async function markNotificationRead(userId, notificationId) {
  const res = await request(`/notifications/${notificationId}/read`, {
    method: "PATCH",
    headers: profileRequestHeaders(userId),
  });

  if (!res?.success) {
    throw new Error(res?.message || "Could not update notification.");
  }

  return res.data;
}

export async function markAllNotificationsRead(userId) {
  const res = await request("/notifications/read-all", {
    method: "PATCH",
    headers: profileRequestHeaders(userId),
  });

  if (!res?.success) {
    throw new Error(res?.message || "Could not mark notifications as read.");
  }

  return res.data;
}
