export const TABLE_SESSION_STORAGE_KEY = "phurai_table_session";

export function loadStoredTableSession() {
  try {
    const raw = localStorage.getItem(TABLE_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.table_id || !parsed?.session_id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function persistTableSession(session) {
  try {
    if (!session?.table_id || !session?.session_id) {
      localStorage.removeItem(TABLE_SESSION_STORAGE_KEY);
      return;
    }
    localStorage.setItem(TABLE_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* ignore quota errors */
  }
}

export function clearStoredTableSession() {
  try {
    localStorage.removeItem(TABLE_SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
