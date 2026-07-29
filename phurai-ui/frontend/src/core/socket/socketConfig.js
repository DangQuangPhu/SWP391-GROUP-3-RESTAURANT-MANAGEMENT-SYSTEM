const envSocketUrl = import.meta.env.VITE_SOCKET_URL;
const envApiUrl = import.meta.env.VITE_API_BASE_URL;

// If VITE_SOCKET_URL is set, use it. Otherwise if VITE_API_BASE_URL is a full http URL, use it.
// In dev, connect directly to the backend socket server so Vite HMR/static serving
// is isolated from realtime traffic and cannot surface proxy 502s on /socket.io.
const devSocketUrl = import.meta.env.DEV ? "http://127.0.0.1:5001" : "";
const rawUrl = envSocketUrl || (envApiUrl && envApiUrl.startsWith("http") ? envApiUrl : devSocketUrl);

export const SOCKET_URL = String(rawUrl).replace(/\/+$/, "");
