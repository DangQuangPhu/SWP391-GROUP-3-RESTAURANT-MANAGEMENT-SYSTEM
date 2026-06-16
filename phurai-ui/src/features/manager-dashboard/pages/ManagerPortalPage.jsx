import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useOutletContext } from "react-router-dom";
import "../styles/manager-dashboard.css";

import NotFound from "@/pages/NotFound.jsx";
import { KPI_CARDS } from "../data/managerDashboardMockData.js";
import { ManagerPortalContext, useManagerPortal } from "../context/ManagerPortalContext.jsx";
import ManagerPortalLayout from "./ManagerPortalLayout.jsx";

import OverviewSection from "../components/sections/OverviewSection.jsx";
import TodaySection from "../components/sections/TodaySection.jsx";
import ReservationsSection from "../components/sections/ReservationsSection.jsx";
import TablesSection from "../components/sections/TablesSection.jsx";
import DishesSection from "../components/sections/DishesSection.jsx";
import OrdersSection from "../components/sections/OrdersSection.jsx";
import StaffSection from "../components/sections/StaffSection.jsx";
import PromotionsSection from "../components/sections/PromotionsSection.jsx";
import ReportsSection from "../components/sections/ReportsSection.jsx";

import {
  fetchKpis,
  fetchRevenueSeries,
  fetchAllReservations,
  fetchTables,
  fetchDishes,
  fetchBestSellers,
  fetchOrders,
  fetchManager,
  fetchPromotions,
  fetchReservationStats,
  fetchTableUtilization,
} from "../services/managerApi.js";
import { asArray } from "@/utils/asArray.js";
import {
  appToastError,
  appToastInfo,
  appToastSuccess,
} from "@/core/notifications/appToast.js";
import { useSocket } from "@/core/socket/SocketContext.jsx";

function resolveRole(roleName) {
  const r = String(roleName || "").toLowerCase();
  if (r === "manager" || r === "admin") return "manager";
  if (r === "restaurant manager" || r === "kitchen manager") return "manager";
  return null;
}

function LoadingState() {
  return (
    <div className="sfx-loading">
      <span className="sfx-spinner" />
      <p>Loading operations data…</p>
    </div>
  );
}

function useSectionContext() {
  const { portalNavigate, pendingAction } = useOutletContext();
  const ctx = useManagerPortal();
  return { ...ctx, portalNavigate, pendingAction };
}

function DashboardRoute() {
  const { loading, baseKpis, data, role, portalNavigate } = useSectionContext();
  if (loading) return <LoadingState />;
  return (
    <OverviewSection
      kpis={baseKpis}
      reservations={data.reservations}
      role={role}
      onNavigate={portalNavigate}
    />
  );
}

function TodayRoute() {
  const { loading, baseKpis, data, portalNavigate } = useSectionContext();
  if (loading) return <LoadingState />;
  return (
    <TodaySection
      kpis={baseKpis}
      reservations={data.reservations}
      tables={data.tables}
      orders={data.orders}
      onNavigate={portalNavigate}
    />
  );
}

function ReservationsRoute() {
  const { loading, data, setList, toast } = useSectionContext();
  if (loading) return <LoadingState />;
  return (
    <ReservationsSection
      reservations={data.reservations}
      setReservations={setList("reservations")}
      tables={data.tables}
      setTables={setList("tables")}
      toast={toast}
    />
  );
}

function TablesRoute() {
  const { loading, data, setList, pendingAction, role, toast } = useSectionContext();
  if (loading) return <LoadingState />;
  return (
    <TablesSection
      tables={data.tables}
      setTables={setList("tables")}
      pendingAction={pendingAction}
      role={role}
      toast={toast}
    />
  );
}

function MenuRoute() {
  const { loading, data, setList, pendingAction, role, toast, dishSource } = useSectionContext();
  if (loading) return <LoadingState />;
  return (
    <DishesSection
      dishes={data.dishes}
      setDishes={setList("dishes")}
      bestSellers={data.bestSellers}
      pendingAction={pendingAction}
      role={role}
      toast={toast}
      dishSource={dishSource}
    />
  );
}

function OrdersRoute() {
  const { loading, data, setList, toast } = useSectionContext();
  if (loading) return <LoadingState />;
  return (
    <OrdersSection
      orders={data.orders}
      setOrders={setList("orders")}
      toast={toast}
    />
  );
}

function StaffRoute() {
  const { loading, data, setList, pendingAction, toast } = useSectionContext();
  if (loading) return <LoadingState />;
  return (
    <StaffSection
      staff={data.manager}
      setStaff={setList("manager")}
      pendingAction={pendingAction}
      toast={toast}
    />
  );
}

function PromotionsRoute() {
  const { loading, data, setList, pendingAction, toast } = useSectionContext();
  if (loading) return <LoadingState />;
  return (
    <PromotionsSection
      promotions={data.promotions}
      setPromotions={setList("promotions")}
      pendingAction={pendingAction}
      toast={toast}
    />
  );
}

function ReportsRoute() {
  const { loading, baseKpis, data, toast } = useSectionContext();
  if (loading) return <LoadingState />;
  return (
    <ReportsSection
      kpis={baseKpis}
      reservations={data.reservations}
      bestSellers={data.bestSellers}
      stats={data.stats}
      utilization={data.utilization}
      toast={toast}
    />
  );
}

function ManagerPortalPage({
  isAuthenticated,
  currentUser,
  onSignOut,
  onNavigate,
}) {
  const { socket } = useSocket();
  const role = resolveRole(currentUser?.roleName);
  const hasAccess = isAuthenticated && Boolean(role);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    kpis: [],
    revenue: {},
    reservations: [],
    tables: [],
    dishes: [],
    bestSellers: [],
    orders: [],
    manager: [],
    promotions: [],
    stats: {},
    utilization: [],
  });
  const [dishSource, setDishSource] = useState("mock");
  const [toasts, setToasts] = useState([]);
  const toastSeq = useRef(0);

  const baseKpis = useMemo(
    () => (Array.isArray(data.kpis) && data.kpis.length ? data.kpis : KPI_CARDS),
    [data.kpis]
  );

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

  const setList = useCallback(
    (key) => (updater) =>
      setData((prev) => {
        const current = prev[key];
        const next =
          typeof updater === "function"
            ? updater(Array.isArray(current) ? current : [])
            : updater;
        return {
          ...prev,
          [key]: Array.isArray(next) ? next : current,
        };
      }),
    []
  );

  useEffect(() => {
    if (!hasAccess) return undefined;
    let alive = true;
    setLoading(true);
    Promise.all([
      fetchKpis(),
      fetchRevenueSeries(),
      fetchAllReservations(currentUser?.user_id),
      fetchTables(),
      fetchDishes(),
      fetchBestSellers(),
      fetchOrders(),
      fetchManager(),
      fetchPromotions(),
      fetchReservationStats(),
      fetchTableUtilization(),
    ])
      .then((res) => {
        if (!alive) return;
        const [
          kpis,
          revenue,
          reservations,
          tables,
          dishes,
          bestSellers,
          orders,
          manager,
          promotions,
          stats,
          utilization,
        ] = res;

        // 1. We are using the real API now, so no need to intercept with Global Local Storage Engine
        let localReservations = asArray(reservations.data);

        setData({
          kpis: kpis.data,
          revenue: revenue.data,
          reservations: localReservations,
          tables: asArray(tables.data),
          dishes: asArray(dishes.data),
          bestSellers: asArray(bestSellers.data),
          orders: asArray(orders.data),
          manager: asArray(manager.data),
          promotions: asArray(promotions.data),
          stats: stats.data ?? {},
          utilization: asArray(utilization.data),
        });
        setDishSource(dishes.source);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [hasAccess, toast]);

  /* 2. Real-time Socket Notification */
  useEffect(() => {
    if (!hasAccess || !socket) return;
    
    const handleNewReservation = (data) => {
      toast(`New booking request from ${data.customer_name}`, "info");
      window.dispatchEvent(new Event("phurai_manager_refresh"));
    };

    const handleCheckedIn = (data) => {
      toast(`Reservation #${data.reservation_id} checked in by staff`, "success");
      window.dispatchEvent(new Event("phurai_manager_refresh"));
    };

    const handleRejected = (data) => {
      toast(`Reservation #${data.reservation_id} marked as ${data.new_status} by staff`, "info");
      window.dispatchEvent(new Event("phurai_manager_refresh"));
    };
    
    socket.on("reservation:new", handleNewReservation);
    socket.on("reservation:checked_in", handleCheckedIn);
    socket.on("reservation:rejected", handleRejected);

    return () => {
      socket.off("reservation:new", handleNewReservation);
      socket.off("reservation:checked_in", handleCheckedIn);
      socket.off("reservation:rejected", handleRejected);
    };
  }, [hasAccess, toast, socket]);

  // Listen to refresh events
  useEffect(() => {
    const handleRefresh = () => {
      // Reload reservations
      fetchAllReservations(currentUser?.user_id).then(res => {
         setList("reservations")(res.data);
      });
    };
    window.addEventListener("phurai_manager_refresh", handleRefresh);
    window.addEventListener("phurai_reservations_updated", handleRefresh); // Catch same-tab edits
    return () => {
      window.removeEventListener("phurai_manager_refresh", handleRefresh);
      window.removeEventListener("phurai_reservations_updated", handleRefresh);
    };
  }, [setList, currentUser]);

  if (!hasAccess) {
    return (
      <NotFound
        pathname={typeof window !== "undefined" ? window.location.pathname : "/manager"}
        currentUser={currentUser}
        isAuthenticated={isAuthenticated}
        onNavigate={onNavigate}
      />
    );
  }

  const contextValue = {
    role,
    user: currentUser,
    currentUser,
    search,
    setSearch,
    toasts,
    toast,
    loading,
    data,
    setList,
    baseKpis,
    dishSource,
    onSignOut,
  };

  return (
    <ManagerPortalContext.Provider value={contextValue}>
      <Routes>
        <Route element={<ManagerPortalLayout onSignOut={onSignOut} />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardRoute />} />
          <Route path="today" element={<TodayRoute />} />
          <Route path="reservations" element={<ReservationsRoute />} />
          <Route path="tables" element={<TablesRoute />} />
          <Route path="menu" element={<MenuRoute />} />
          <Route path="orders" element={<OrdersRoute />} />
          <Route path="staff" element={<StaffRoute />} />
          <Route path="promotions" element={<PromotionsRoute />} />
          <Route path="reports" element={<ReportsRoute />} />
          <Route path="settings" element={<Navigate to="dashboard" replace />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>
      </Routes>
    </ManagerPortalContext.Provider>
  );
}

export default ManagerPortalPage;
