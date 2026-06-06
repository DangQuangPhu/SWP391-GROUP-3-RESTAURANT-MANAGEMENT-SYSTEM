const DEFAULT_API_BASE_URL = "http://localhost:5001/api";

function normalizeApiBaseUrl(value) {
  const trimmed = String(value || DEFAULT_API_BASE_URL).trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/api/auth")) return trimmed;
  if (trimmed.endsWith("/api")) return trimmed;
  return `${trimmed}/api`;
}

export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

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

export function verifyOtp({ email, otp, purpose = "verify_account", userId }) {
  const body = {
    email: String(email || "").trim().toLowerCase(),
    otp,
    purpose,
  };

  if (userId) {
    body.userId = userId;
  }

  return request("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function verifyEmailCode({ email, userId, code }) {
  return verifyOtp({
    email,
    userId,
    otp: code,
    purpose: "verify_account",
  });
}

export function requestOtp({ email, purpose = "verify_account" }) {
  return request("/auth/request-otp", {
    method: "POST",
    body: JSON.stringify({
      email: String(email || "").trim().toLowerCase(),
      purpose,
    }),
  });
}

export function resendOtp({ email, purpose = "verify_account" }) {
  return request("/auth/resend-otp", {
    method: "POST",
    body: JSON.stringify({
      email: String(email || "").trim().toLowerCase(),
      purpose,
    }),
  });
}

export function resendVerificationCode({ email, purpose = "verify_account" } = {}) {
  return resendOtp({ email, purpose });
}

export function googleRegister(credential) {
  return request("/auth/google-register", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });
}

export function googleRegisterWithAccessToken(accessToken) {
  return request("/auth/google-register", {
    method: "POST",
    body: JSON.stringify({ accessToken }),
  });
}

export function googleLogin(payload) {
  return request("/auth/google", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function getAuthToken() {
  return (
    localStorage.getItem("phurai_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("phurai_token") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("authToken") ||
    ""
  );
}

function authHeaders(extra = {}) {
  const headers = { ...extra };
  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export function forgotPasswordRequestOtp({
  email,
  identifier,
  purpose = "forgot_password",
} = {}) {
  const body = { purpose };

  if (email) {
    body.email = String(email).trim().toLowerCase();
  }
  if (identifier) {
    body.identifier = String(identifier).trim();
  }

  return request("/auth/forgot-password/request-otp", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** @deprecated Use forgotPasswordRequestOtp */
export function forgotPasswordRequest(payload) {
  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (trimmed.includes("@")) {
      return forgotPasswordRequestOtp({ email: trimmed, purpose: "forgot_password" });
    }
    return forgotPasswordRequestOtp({ identifier: trimmed, purpose: "forgot_password" });
  }

  const identifier = payload?.identifier || payload?.email;
  if (identifier && String(identifier).includes("@")) {
    return forgotPasswordRequestOtp({
      email: String(identifier).trim().toLowerCase(),
      purpose: "forgot_password",
    });
  }

  return forgotPasswordRequestOtp({
    identifier,
    purpose: "forgot_password",
  });
}

export function forgotPasswordVerifyOtp({
  email,
  otp,
  purpose = "forgot_password",
  userId,
} = {}) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedOtp = String(otp || "").trim();

  if (!normalizedEmail || !normalizedOtp) {
    return Promise.reject(
      createApiError("Email and OTP are required.", {
        status: 400,
        data: { message: "Email and OTP are required." },
      })
    );
  }

  const body = {
    email: normalizedEmail,
    otp: normalizedOtp,
    purpose,
  };

  if (userId) {
    body.userId = userId;
  }

  return request("/auth/forgot-password/verify-otp", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function forgotPasswordResendOtp({ email, purpose = "forgot_password", userId } = {}) {
  const body = {
    email: String(email || "").trim().toLowerCase(),
    purpose,
  };

  if (userId) {
    body.userId = userId;
  }

  return request("/auth/forgot-password/resend-otp", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function forgotPasswordReset({
  email,
  resetToken,
  newPassword,
  confirmPassword,
  userId,
} = {}) {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail || !resetToken || !newPassword) {
    return Promise.reject(
      createApiError("Email, reset token, and new password are required.", {
        status: 400,
        data: { message: "Email, reset token, and new password are required." },
      })
    );
  }

  const body = {
    email: normalizedEmail,
    resetToken,
    newPassword,
  };

  if (confirmPassword) {
    body.confirmPassword = confirmPassword;
  }
  if (userId) {
    body.userId = userId;
  }

  return request("/auth/forgot-password/reset", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function changePassword({ userId, currentPassword, newPassword, confirmPassword }) {
  return request("/auth/change-password", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      userId,
      currentPassword,
      newPassword,
      confirmPassword,
    }),
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

export function verifyOldPassword(userId, oldPassword) {
  return request("/auth/profile/change-password/verify-old", {
    method: "POST",
    body: JSON.stringify({ userId, oldPassword }),
  });
}

export function resetProfilePassword(payload) {
  return request("/auth/profile/change-password/reset", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export const changePasswordReset = resetProfilePassword;
