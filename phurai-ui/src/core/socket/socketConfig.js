const DEFAULT_SOCKET_URL = "";

export const SOCKET_URL = String(
  import.meta.env.VITE_SOCKET_URL || DEFAULT_SOCKET_URL
).replace(/\/+$/, "");
