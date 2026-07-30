import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { fetchActiveQrSession, validateQrSession } from "../services/qrSessionApi.js";
import {
  clearStoredTableSession,
  loadStoredTableSession,
  persistTableSession,
} from "../utils/sessionStorage.js";
import { useSocket } from "@/core/socket/SocketContext.jsx";

const TableSessionContext = createContext(null);

function normalizeSession(session) {
  if (!session) return null;
  const sId = Number(session.session_id ?? session.qr_session_id ?? session.id);
  const tId = Number(session.table_id ?? session.tableId);
  if (!Number.isFinite(sId) || sId <= 0 || !Number.isFinite(tId) || tId <= 0) return null;

  return {
    table_id: tId,
    session_id: sId,
    qr_session_id: sId,
    table_number: session.table_number ?? null,
    area_name: session.area_name ?? null,
    token: session.token ?? null,
    session_status: session.session_status ?? "Active",
    table_status: session.table_status ?? "Occupied",
  };
}


export function TableSessionProvider({
  children,
  userId = null,
  isCustomer = false,
}) {
  const [session, setSession] = useState(() => {
    const stored = loadStoredTableSession();
    return stored;
  });
  const [hasActiveSession, setHasActiveSession] = useState(() => {
    const stored = loadStoredTableSession();
    return Boolean(stored?.table_id && stored?.session_id);
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const applySession = useCallback((nextSession, activeFlag = null) => {
    const normalized = normalizeSession(nextSession);
    setSession(normalized);
    setHasActiveSession(
      activeFlag === null ? Boolean(normalized) : Boolean(activeFlag)
    );
    if (normalized) {
      persistTableSession(normalized);
    } else {
      clearStoredTableSession();
    }
    return normalized;
  }, []);

  const clearSession = useCallback(() => {
    setSession(null);
    setHasActiveSession(false);
    setError(null);
    clearStoredTableSession();
  }, []);

  const refreshActiveSession = useCallback(async () => {
    if (!userId || !isCustomer) {
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchActiveQrSession(userId);
      const normalized = applySession(
        result?.session ?? null,
        result?.hasActiveSession ?? Boolean(result?.session)
      );
      return normalized;
    } catch (err) {
      setError(err.message || "Could not load your table session.");
      if (err.status === 404) {
        applySession(null, false);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId, isCustomer, applySession]);

  const bindFromQuery = useCallback(
    async ({ tableId, sessionId }) => {
      const parsedTableId = Number(tableId);
      const parsedSessionId = Number(sessionId);

      if (!Number.isFinite(parsedTableId) || !Number.isFinite(parsedSessionId)) {
        setError("Invalid table session link.");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await validateQrSession(parsedTableId, parsedSessionId);
        return applySession(result?.session ?? null);
      } catch (err) {
        setError(err.message || "This table session is not available.");
        clearSession();
        return null;
      } finally {
        setLoading(false);
      }
    },
    [applySession, clearSession]
  );

  useEffect(() => {
    if (!userId || !isCustomer) return;
    
    // Defer execution to avoid synchronous setState in effect
    const timer = setTimeout(() => {
      refreshActiveSession();
    }, 0);
    return () => clearTimeout(timer);
  }, [userId, isCustomer, refreshActiveSession]);

  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !session?.table_id) return;

    const handleTableStatus = (data) => {
      const targetTableId = Number(data.tableId || data.table_id);
      if (targetTableId === Number(session.table_id)) {
        const newStatus = data.status || data.table_status;
        if (newStatus) {
          setSession((prev) => (prev ? { ...prev, table_status: newStatus } : null));
        }
      }
    };

    socket.on("table:status_changed", handleTableStatus);
    return () => {
      socket.off("table:status_changed", handleTableStatus);
    };
  }, [socket, session?.table_id]);

  useEffect(() => {
    if (!socket || !session?.session_id) return;

    const handleSessionCleared = (data = {}) => {
      const clearedSessionId = Number(data.session_id ?? data.qr_session_id);
      if (clearedSessionId === Number(session.session_id)) {
        // Clear the table-order session only. Keep the user's login session.
        clearSession();
      }
    };

    socket.on("TABLE_SESSION_CLEARED", handleSessionCleared);
    return () => socket.off("TABLE_SESSION_CLEARED", handleSessionCleared);
  }, [socket, session?.session_id, clearSession]);

  const value = useMemo(
    () => ({
      session,
      hasActiveSession,
      loading,
      error,
      refreshActiveSession,
      bindFromQuery,
      clearSession,
      setSession: applySession,
    }),
    [
      session,
      hasActiveSession,
      loading,
      error,
      refreshActiveSession,
      bindFromQuery,
      clearSession,
      applySession,
    ]
  );

  return (
    <TableSessionContext.Provider value={value}>
      {children}
    </TableSessionContext.Provider>
  );
}

export function useTableSession() {
  const ctx = useContext(TableSessionContext);
  if (!ctx) {
    return {
      session: null,
      table: null,
      loading: false,
      hasActiveSession: false,
      cartItemCount: 0,
      setSession: () => {},
      clearSession: () => {},
      fetchActiveSession: async () => null,
      updateCartItemCount: () => {},
    };
  }
  return ctx;
}
