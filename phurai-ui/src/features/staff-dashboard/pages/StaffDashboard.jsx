import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import "../styles/staff-dashboard.css";

import NotFound from "@/pages/NotFound.jsx";
import { StaffPortalContext } from "../context/StaffPortalContext.jsx";
import StaffPortalLayout from "./StaffPortalLayout.jsx";
import StaffRoleGuard from "./StaffRoleGuard.jsx";

import StaffTableTab from "../components/StaffTableTab.jsx";
import StaffOrderTab from "../components/StaffOrderTab.jsx";
import StaffPaymentTab from "../components/StaffPaymentTab.jsx";
import StaffKdsTab from "../components/StaffKdsTab.jsx";
import StaffReportTab from "../components/StaffReportTab.jsx";
import StaffReservationTab from "../components/StaffReservationTab.jsx";

import {
  getDefaultStaffPath,
  resolveStaffRole,
} from "../config/staffRoutes.js";
import { fetchActiveStaffOrders, fetchStaffTables } from "../services/staffApi.js";
import { asArray } from "@/utils/asArray.js";
import { useStaffPortal } from "../context/StaffPortalContext.jsx";
import {
  appToastError,
  appToastInfo,
  appToastSuccess,
} from "@/core/notifications/appToast.js";

function isManagerPortalUser(user) {
  if (!user) return false;
  const roleId = Number(user.roleId ?? user.role_id);
  if (roleId === 4 || roleId === 5) return true;
  const role = String(user.roleName ?? user.role_name ?? user.role ?? "")
    .trim()
    .toLowerCase();
  return role === "manager" || role === "admin";
}

function LoadingState({ label = "Loading staff data…" }) {
  return (
    <div className="sfx-loading">
      <span className="sfx-spinner" />
      <p>{label}</p>
    </div>
  );
}

function StaffIndexRedirect() {
  const { staffRole } = useStaffPortal();
  return <Navigate to={getDefaultStaffPath(staffRole)} replace />;
}

function StaffUnknownRedirect() {
  const { staffRole } = useStaffPortal();
  return <Navigate to={getDefaultStaffPath(staffRole)} replace />;
}

function OrdersRoute() {
  const {
    loading,
    orderTables,
    setOrderTables,
    dataSources,
    toast,
    user,
    refreshing,
    refreshCurrentSection,
  } = useStaffPortal();

  if (loading) return <LoadingState label="Loading active orders…" />;

  return (
    <StaffOrderTab
      orderTables={orderTables}
      setOrderTables={setOrderTables}
      dataSource={dataSources.orders}
      user={user}
      toast={toast}
      refreshing={refreshing}
      onRefresh={() => refreshCurrentSection("orders")}
    />
  );
}

function TablesRoute() {
  const {
    loading,
    tables,
    setTables,
    dataSources,
    toast,
    user,
    refreshing,
    refreshCurrentSection,
  } = useStaffPortal();

  if (loading) return <LoadingState label="Loading floor map…" />;

  return (
    <StaffTableTab
      tables={tables}
      setTables={setTables}
      dataSource={dataSources.tables}
      user={user}
      toast={toast}
      refreshing={refreshing}
      onRefresh={() => refreshCurrentSection("tables")}
    />
  );
}

function KdsRoute() {
  const { user, toast, refreshing, refreshCurrentSection } = useStaffPortal();

  return (
    <StaffKdsTab
      user={user}
      toast={toast}
      refreshing={refreshing}
      onRefresh={() => refreshCurrentSection("kds")}
    />
  );
}

function ReservationsRoute() {
  const { user, toast, reservationRefreshKey } = useStaffPortal();

  return (
    <StaffReservationTab
      user={user}
      toast={toast}
      refreshKey={reservationRefreshKey}
    />
  );
}

function ShiftsRoute() {
  const { toast, refreshing, refreshCurrentSection } = useStaffPortal();

  return (
    <StaffReportTab
      toast={toast}
      refreshing={refreshing}
      onRefresh={() => refreshCurrentSection("shifts")}
    />
  );
}

function PaymentsRoute() {
  const {
    loading,
    tables,
    setTables,
    dataSources,
    toast,
    user,
    refreshing,
    refreshCurrentSection,
  } = useStaffPortal();

  if (loading) return <LoadingState label="Loading payment data…" />;

  return (
    <StaffPaymentTab
      tables={tables}
      setTables={setTables}
      dataSource={dataSources.payments ?? dataSources.tables}
      user={user}
      toast={toast}
      refreshing={refreshing}
      onRefresh={() => refreshCurrentSection("payments")}
    />
  );
}

/**
 * Phase 2 staff operations shell — five tabs, table management live.
 */
function StaffDashboard({
  authReady = true,
  isAuthenticated,
  currentUser,
  onSignOut,
  onNavigate,
}) {
  const staffRole = resolveStaffRole(currentUser);
  const managerUser = isManagerPortalUser(currentUser);
  const hasAccess = isAuthenticated && Boolean(staffRole);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tables, setTables] = useState([]);
  const [orderTables, setOrderTables] = useState([]);
  const [dataSources, setDataSources] = useState({
    tables: "mock",
    orders: "mock",
    payments: "mock",
  });
  const [reservationRefreshKey, setReservationRefreshKey] = useState(0);

  const navigate = useNavigate();
  const [newBookingAlert, setNewBookingAlert] = useState(null);

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "customer_reservations" && e.newValue) {
        try {
          const oldVal = JSON.parse(e.oldValue || "[]");
          const newVal = JSON.parse(e.newValue || "[]");
          if (newVal.length > oldVal.length) {
            const latest = newVal[newVal.length - 1];
            setNewBookingAlert(latest.id);
            setTimeout(() => setNewBookingAlert(null), 6000); // Hide after 6s
          }
        } catch (err) {}
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const [toasts, setToasts] = useState([]);
  const toastSeq = useRef(0);

  const toast = useCallback((message, tone = "info") => {
    const id = ++toastSeq.current;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);

    if (tone === "success") appToastSuccess(message);
    else if (tone === "error") appToastError(message);
    else appToastInfo(message);
  }, []);

  const loadTables = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      try {
        const res = await fetchStaffTables();
        setTables(asArray(res.data));
        setDataSources((prev) => ({ ...prev, tables: res.source }));
      } catch {
        toast("Could not load table map", "error");
      } finally {
        if (isRefresh) setRefreshing(false);
      }
    },
    [toast]
  );

  const loadActiveOrders = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      try {
        const res = await fetchActiveStaffOrders();
        setOrderTables(asArray(res.data));
        setDataSources((prev) => ({ ...prev, orders: res.source }));
      } catch {
        toast("Could not load active orders", "error");
      } finally {
        if (isRefresh) setRefreshing(false);
      }
    },
    [toast]
  );

  const refreshCurrentSection = useCallback(
    (segment) => {
      if (segment === "tables") return loadTables(true);
      if (segment === "orders") return loadActiveOrders(true);
      if (segment === "payments") return loadTables(true);
      if (segment === "reservations") {
        setReservationRefreshKey((key) => key + 1);
        return undefined;
      }
      return undefined;
    },
    [loadTables, loadActiveOrders]
  );

  useEffect(() => {
    if (isAuthenticated && managerUser) {
      onNavigate?.("manager");
    }
  }, [isAuthenticated, managerUser, onNavigate]);

  useEffect(() => {
    if (!hasAccess) return undefined;

    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      try {
        await Promise.all([loadTables(false), loadActiveOrders(false)]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [hasAccess, staffRole, loadTables, loadActiveOrders]);

  const portalValue = useMemo(
    () => ({
      staffRole,
      user: currentUser,
      search,
      setSearch,
      toast,
      toasts,
      loading,
      refreshing,
      tables,
      setTables,
      orderTables,
      setOrderTables,
      dataSources,
      refreshCurrentSection,
      reservationRefreshKey,
      queue: [],
      setQueue: () => {},
      orders: [],
      setOrders: () => {},
      kitchenTickets: [],
      setKitchenTickets: () => {},
    }),
    [
      staffRole,
      currentUser,
      search,
      toast,
      toasts,
      loading,
      refreshing,
      tables,
      orderTables,
      dataSources,
      refreshCurrentSection,
      reservationRefreshKey,
    ]
  );

  if (!authReady || (isAuthenticated && managerUser)) {
    return (
      <div className="sfx-gate">
        <div className="sfx-loading">
          <span className="sfx-spinner" />
          <p>
            {!authReady
              ? "Loading staff portal…"
              : "Redirecting to Manager Portal…"}
          </p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <NotFound
        pathname={typeof window !== "undefined" ? window.location.pathname : "/staff"}
        currentUser={currentUser}
        isAuthenticated={isAuthenticated}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <StaffPortalContext.Provider value={portalValue}>
      <Routes>
        <Route element={<StaffPortalLayout onSignOut={onSignOut} />}>
          <Route index element={<StaffIndexRedirect />} />
          <Route
            path="orders"
            element={
              <StaffRoleGuard segment="orders">
                <OrdersRoute />
              </StaffRoleGuard>
            }
          />
          <Route
            path="tables"
            element={
              <StaffRoleGuard segment="tables">
                <TablesRoute />
              </StaffRoleGuard>
            }
          />
          <Route
            path="reservations"
            element={
              <StaffRoleGuard segment="reservations">
                <ReservationsRoute />
              </StaffRoleGuard>
            }
          />
          <Route
            path="kds"
            element={
              <StaffRoleGuard segment="kds">
                <KdsRoute />
              </StaffRoleGuard>
            }
          />
          <Route
            path="payments"
            element={
              <StaffRoleGuard segment="payments">
                <PaymentsRoute />
              </StaffRoleGuard>
            }
          />
          <Route
            path="shifts"
            element={
              <StaffRoleGuard segment="shifts">
                <ShiftsRoute />
              </StaffRoleGuard>
            }
          />
          <Route path="*" element={<StaffUnknownRedirect />} />
        </Route>
      </Routes>

      {newBookingAlert && (
        <div 
          onClick={() => {
            setNewBookingAlert(null);
            navigate(`/staff/reservations#${newBookingAlert.replace('#', 'res-')}`);
          }}
          style={{
            position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
            background: '#10b981', color: '#fff', padding: '16px 24px', borderRadius: '8px',
            cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            transition: 'all 0.3s ease', transform: 'translateY(0)'
          }}
        >
          <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '4px' }}>🔔 New Booking Received!</div>
          <div style={{ fontSize: '14px' }}>Booking ID: {newBookingAlert}</div>
          <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.9 }}>Click to view details →</div>
        </div>
      )}
    </StaffPortalContext.Provider>
  );
}

export default StaffDashboard;
