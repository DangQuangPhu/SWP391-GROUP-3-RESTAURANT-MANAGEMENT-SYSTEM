export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api";

const AUTH_STORAGE_KEY = "phurai_auth_user";

export function saveAuthUser(user, remember = false) {
  const storage = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;
  other.removeItem(AUTH_STORAGE_KEY);
  storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

export function loadAuthUser() {
  const raw =
    localStorage.getItem(AUTH_STORAGE_KEY) || sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearAuthUser() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

function createApiError(message, { status, code, data } = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.data = data;
  return error;
}

function sanitizeResponseMessage(text, status) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;

  const looksLikeHtml =
    trimmed.startsWith("<!DOCTYPE") ||
    trimmed.startsWith("<html") ||
    trimmed.includes("<body") ||
    /Cannot (GET|POST|PUT|DELETE|PATCH) /i.test(trimmed);

  if (looksLikeHtml) {
    if (status === 404) return "Request failed. API endpoint not found.";
    return "Request failed.";
  }

  if (trimmed.length > 240) return "Request failed.";
  return trimmed;
}

async function parseResponseBody(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }

  const text = await response.text().catch(() => "");
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    const message = sanitizeResponseMessage(text, response.status);
    return message ? { message } : {};
  }
}

async function request(path, options = {}) {
  const { headers: customHeaders, body, ...rest } = options;
  const headers = { ...(customHeaders || {}) };

  if (body && !(body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers,
      body,
    });
  } catch {
    throw createApiError("Cannot connect to server.", {
      status: 0,
      code: "NETWORK_ERROR",
      data: { message: "Cannot connect to server." },
    });
  }

  const data = await parseResponseBody(response);

  if (!response.ok) {
    const rawMessage = data.message || null;
    const message =
      sanitizeResponseMessage(rawMessage, response.status) ||
      (typeof data.errors === "object"
        ? Object.values(data.errors).find(Boolean)
        : null) ||
      `Request failed (${response.status}).`;

    throw createApiError(message, {
      status: response.status,
      code: data.code,
      data,
    });
  }

  return data;
}

export function registerAccount(payload) {
  return request("/register", {
    method: "POST",
    body: JSON.stringify({
      firstName: payload.firstName,
      lastName: payload.lastName,
      username: payload.username,
      email: payload.email,
      phoneNumber: payload.phoneNumber,
      dateOfBirth: payload.dateOfBirth,
      password: payload.password,
      confirmPassword: payload.confirmPassword,
    }),
  });
}

export function loginAccount(payload) {
  return request("/login", {
    method: "POST",
    body: JSON.stringify({
      identifier: payload.identifier,
      password: payload.password,
    }),
  });
}

export function verifyOtp(payload) {
  return request("/verify-otp", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function verifyEmailCode({ userId, code }) {
  return verifyOtp({ userId, otp: code });
}

export function resendVerificationCode(userId) {
  return request("/resend-verification-code", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export function googleRegister(credential) {
  return request("/google-register", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });
}

export function googleRegisterWithAccessToken(accessToken) {
  return request("/google-register", {
    method: "POST",
    body: JSON.stringify({ accessToken }),
  });
}

export function googleLogin(payload) {
  return request("/google", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function forgotPasswordRequest(payload) {
  const body =
    typeof payload === "string"
      ? { identifier: payload }
      : payload?.userId
      ? { userId: payload.userId }
      : { identifier: payload?.identifier || payload?.email };

  return request("/forgot-password/request", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function forgotPasswordVerifyOtp(payload) {
  return request("/forgot-password/verify-otp", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function forgotPasswordResendOtp(userId) {
  return request("/forgot-password/resend-otp", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export function forgotPasswordReset(payload) {
  return request("/forgot-password/reset", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getProfile(userId) {
  return request(`/profile/${encodeURIComponent(userId)}`);
}

export function updateProfile(userId, payload) {
  const { firstName, lastName, username, phone, phoneNumber, dateOfBirth } = payload;
  return request(`/profile/${encodeURIComponent(userId)}`, {
    method: "PUT",
    body: JSON.stringify({
      firstName,
      lastName,
      username,
      phone: phone ?? phoneNumber,
      dateOfBirth,
    }),
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

export function verifyOldPassword(userId, oldPassword) {
  return request("/profile/change-password/verify-old", {
    method: "POST",
    body: JSON.stringify({ userId, oldPassword }),
  });
}

export function resetProfilePassword(payload) {
  return request("/profile/change-password/reset", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export const changePasswordReset = resetProfilePassword;
