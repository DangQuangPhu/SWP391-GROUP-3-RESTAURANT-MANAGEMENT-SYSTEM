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

export function createApiError(message, { status, code, data } = {}) {
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

export async function request(path, options = {}) {
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

export function authHeaders(extra = {}) {
  const headers = { ...extra };
  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export function profileRequestHeaders(userId, extra = {}) {
  const headers = authHeaders(extra);
  if (userId) {
    headers["X-User-Id"] = String(userId);
  }
  return headers;
}
