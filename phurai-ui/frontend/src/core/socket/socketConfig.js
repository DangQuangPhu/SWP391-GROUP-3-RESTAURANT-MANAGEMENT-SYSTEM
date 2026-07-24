const DEFAULT_SOCKET_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export const SOCKET_URL = String(
  import.meta.env.VITE_SOCKET_URL || DEFAULT_SOCKET_URL
).replace(/\/+$/, "");
