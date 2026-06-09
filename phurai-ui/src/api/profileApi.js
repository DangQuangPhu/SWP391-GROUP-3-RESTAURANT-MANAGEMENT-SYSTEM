import {
  createApiError,
  profileRequestHeaders,
  request,
} from "./httpClient.js";
import { mapApiUserToFrontend } from "@/utils/userMapper.js";

export async function getProfile(userId) {
  const data = await request(`/profile/${encodeURIComponent(userId)}`, {
    headers: profileRequestHeaders(userId),
  });
  if (data?.user) {
    return { ...data, user: mapApiUserToFrontend(data.user) };
  }
  return data;
}

export async function getProfileMe(userId) {
  const data = await request(`/profile/me?userId=${encodeURIComponent(userId)}`, {
    headers: profileRequestHeaders(userId),
  });
  if (data?.user) {
    return { ...data, user: mapApiUserToFrontend(data.user) };
  }
  return data;
}

export async function updateProfile(userId, payload) {
  const {
    firstName,
    lastName,
    fullName,
    username,
    phone,
    phoneNumber,
    dateOfBirth,
    gender,
    bio,
    address,
    country,
    language,
    preferences,
    avatarUrl,
  } = payload;

  const data = await request("/profile/me", {
    method: "PUT",
    headers: profileRequestHeaders(userId),
    body: JSON.stringify({
      userId,
      firstName,
      lastName,
      fullName,
      username,
      phone: phone ?? phoneNumber,
      phoneNumber: phone ?? phoneNumber,
      dateOfBirth,
      gender,
      bio,
      address,
      country,
      language,
      preferences,
      avatarUrl,
    }),
  });

  if (data?.user) {
    return { ...data, user: mapApiUserToFrontend(data.user) };
  }
  return data;
}

export function patchProfile(userId, payload) {
  return request(`/profile/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function updateProfilePhone(userId, phoneNumber) {
  const normalized = String(phoneNumber || "").replace(/\D/g, "");
  return patchProfile(userId, {
    phone: normalized,
    phoneNumber: normalized,
  });
}

export async function uploadProfileAvatar(userId, file) {
  const formData = new FormData();
  formData.append("avatar", file);

  try {
    return await request(`/profile/${encodeURIComponent(userId)}/avatar/upload`, {
      method: "POST",
      body: formData,
    });
  } catch (error) {
    if (error.message && !error.message.includes("Request failed")) {
      throw error;
    }
    throw createApiError(error.message || "Avatar update failed.", {
      status: error.status,
      data: error.data,
    });
  }
}

export const uploadAvatar = uploadProfileAvatar;

export async function updateSystemAvatar(userId, avatarUrl) {
  try {
    return await request(`/profile/${encodeURIComponent(userId)}/avatar/system`, {
      method: "PUT",
      body: JSON.stringify({ avatarUrl }),
    });
  } catch (error) {
    throw createApiError(error.message || "Avatar update failed.", {
      status: error.status,
      data: error.data,
    });
  }
}

export const setSystemAvatar = updateSystemAvatar;

export async function updateGoogleAvatar(userId) {
  try {
    return await request(`/profile/${encodeURIComponent(userId)}/avatar/google`, {
      method: "PUT",
    });
  } catch (error) {
    throw createApiError(error.message || "Avatar update failed.", {
      status: error.status,
      data: error.data,
    });
  }
}
