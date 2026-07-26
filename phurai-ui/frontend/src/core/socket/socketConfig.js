const envSocketUrl = import.meta.env.VITE_SOCKET_URL;
const envApiUrl = import.meta.env.VITE_API_BASE_URL;

// If VITE_SOCKET_URL is set, use it. Otherwise if VITE_API_BASE_URL is a full http URL, use it.
// Default to relative "" so Vite dev proxy (or Nginx in production) proxies /socket.io with ws: true to backend (port 5001).
const rawUrl = envSocketUrl || (envApiUrl && envApiUrl.startsWith("http") ? envApiUrl : "");

export const SOCKET_URL = String(rawUrl).replace(/\/+$/, "");
