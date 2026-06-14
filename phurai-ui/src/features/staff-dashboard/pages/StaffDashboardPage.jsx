import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import "../styles/staff-dashboard.css";

import NotFound from "@/pages/NotFound.jsx";
import { StaffPortalContext } from "../context/StaffPortalContext.jsx";
import StaffPortalLayout from "./StaffPortalLayout.jsx";
import StaffRoleGuard from "./StaffRoleGuard.jsx";

import ReservationQueueSection from "../components/sections/ReservationQueueSection.jsx";
import TableMapSection from "../components/sections/TableMapSection.jsx";
import ActiveOrdersSection from "../components/sections/ActiveOrdersSection.jsx";
import KitchenDisplaySection from "../components/sections/KitchenDisplaySection.jsx";

import {
  getDefaultStaffPath,
  isStaffPortalUser,
  resolveStaffRole,
  STAFF_ROLE,
} from "../config/staffRoutes.js";
import {
  fetchKitchenQueue,
  fetchReservationQueue,
  fetchStaffOrders,
  fetchStaffTables,
} from "../services/staffApi.js";
import { useStaffPortal } from "../context/StaffPortalContext.jsx";

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

function ReservationsRoute() {
  const { loading, queue, setQueue, dataSources, toast } = useStaffPortal();
  if (loading) return <LoadingState label="Loading reservation queue…" />;
  return (
    <ReservationQueueSection
      queue={queue}
      setQueue={setQueue}
      dataSource={dataSources.reservations}
      toast={toast}
    />
  );
}

function TablesRoute() {
  const { loading, tables, setTables, dataSources, toast } = useStaffPortal();
  if (loading) return <LoadingState label="Loading table map…" />;
  return (
    <TableMapSection
      tables={tables}
      setTables={setTables}
      dataSource={dataSources.tables}
      toast={toast}
    />
  );
}

function OrdersRoute() {
  const { loading, orders, setOrders, dataSources, toast } = useStaffPortal();
  if (loading) return <LoadingState label="Loading active orders…" />;
  return (
    <ActiveOrdersSection
      orders={orders}
      setOrders={setOrders}
      dataSource={dataSources.orders}
      toast={toast}
    />
  );
}

function KitchenRoute() {
  const { loading, kitchenTickets, setKitchenTickets, dataSources, toast } = useStaffPortal();
  if (loading) return <LoadingState label="Loading cooking queue…" />;
  return (
    <KitchenDisplaySection
      tickets={kitchenTickets}
      setTickets={setKitchenTickets}
      dataSource={dataSources.kitchen}
      toast={toast}
    />
  );
}

function StaffDashboardPage({
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
  const [queue, setQueue] = useState([]);
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [kitchenTickets, setKitchenTickets] = useState([]);
  const [dataSources, setDataSources] = useState({
    reservations: "mock",
    tables: "mock",
    orders: "mock",
    kitchen: "mock",
  });

  const [toasts, setToasts] = useState([]);
  const toastSeq = useRef(0);

  const toast = useCallback((message, tone = "info") => {
    const id = ++toastSeq.current;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const loadReservations = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetchReservationQueue();
      setQueue(res.data);
      setDataSources((prev) => ({ ...prev, reservations: res.source }));
    } catch {
      toast("Could not load reservation queue", "error");
    } finally {
      if (isRefresh) setRefreshing(false);
    }
  }, [toast]);

  const loadTables = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetchStaffTables();
      setTables(res.data);
      setDataSources((prev) => ({ ...prev, tables: res.source }));
    } catch {
      toast("Could not load table map", "error");
    } finally {
      if (isRefresh) setRefreshing(false);
    }
  }, [toast]);

  const loadOrders = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetchStaffOrders();
      setOrders(res.data);
      setDataSources((prev) => ({ ...prev, orders: res.source }));
    } catch {
      toast("Could not load active orders", "error");
    } finally {
      if (isRefresh) setRefreshing(false);
    }
  }, [toast]);

  const loadKitchen = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetchKitchenQueue();
      setKitchenTickets(res.data);
      setDataSources((prev) => ({ ...prev, kitchen: res.source }));
    } catch {
      toast("Could not load cooking queue", "error");
    } finally {
      if (isRefresh) setRefreshing(false);
    }
  }, [toast]);

  const refreshCurrentSection = useCallback(
    (segment) => {
      if (segment === "reservations") return loadReservations(true);
      if (segment === "tables") return loadTables(true);
      if (segment === "orders") return loadOrders(true);
      if (segment === "kitchen") return loadKitchen(true);
      return undefined;
    },
    [loadKitchen, loadOrders, loadReservations, loadTables]
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
        const loaders =
          staffRole === STAFF_ROLE.KITCHEN
            ? [loadKitchen(false)]
            : [loadReservations(false), loadTables(false), loadOrders(false)];

        await Promise.all(loaders);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [hasAccess, staffRole, loadKitchen, loadOrders, loadReservations, loadTables]);

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
      queue,
      setQueue,
      tables,
      setTables,
      orders,
      setOrders,
      kitchenTickets,
      setKitchenTickets,
      dataSources,
      refreshCurrentSection,
    }),
    [
      staffRole,
      currentUser,
      search,
      toast,
      toasts,
      loading,
      refreshing,
      queue,
      tables,
      orders,
      kitchenTickets,
      dataSources,
      refreshCurrentSection,
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
            path="reservations"
            element={
              <StaffRoleGuard segment="reservations">
                <ReservationsRoute />
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
            path="orders"
            element={
              <StaffRoleGuard segment="orders">
                <OrdersRoute />
              </StaffRoleGuard>
            }
          />
          <Route
            path="kitchen"
            element={
              <StaffRoleGuard segment="kitchen">
                <KitchenRoute />
              </StaffRoleGuard>
            }
          />
          <Route path="*" element={<StaffUnknownRedirect />} />
        </Route>
      </Routes>
    </StaffPortalContext.Provider>
  );
}

export default StaffDashboardPage;
