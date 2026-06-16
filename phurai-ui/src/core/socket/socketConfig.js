const DEFAULT_SOCKET_URL = "http://localhost:5001";

export const SOCKET_URL = String(
  import.meta.env.VITE_SOCKET_URL || DEFAULT_SOCKET_URL
).replace(/\/+$/, "");
