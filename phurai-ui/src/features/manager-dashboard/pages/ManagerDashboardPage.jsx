import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../styles/manager-dashboard.css";

import ManagerLayout from "../components/ManagerLayout.jsx";
import { NAV_GROUPS, VIEW_SUBTITLE } from "../config/managerNav.js";
import NotFound from "@/pages/NotFound.jsx";
import { KPI_CARDS } from "../data/managerDashboardMockData.js";

import OverviewSection from "../components/sections/OverviewSection.jsx";
import TodaySection from "../components/sections/TodaySection.jsx";
import ReservationsSection from "../components/sections/ReservationsSection.jsx";
import TablesSection from "../components/sections/TablesSection.jsx";
import DishesSection from "../components/sections/DishesSection.jsx";
import OrdersSection from "../components/sections/OrdersSection.jsx";
import StaffSection from "../components/sections/StaffSection.jsx";
import PromotionsSection from "../components/sections/PromotionsSection.jsx";
import ReportsSection from "../components/sections/ReportsSection.jsx";
import SettingsSection from "../components/sections/SettingsSection.jsx";

import {
  fetchKpis,
  fetchRevenueSeries,
  fetchReservations,
  fetchTables,
  fetchDishes,
  fetchBestSellers,
  fetchOrders,
  fetchManager,
  fetchPromotions,
  fetchReservationStats,
  fetchTableUtilization,
} from "../services/managerApi.js";

/* Map backend role names → portal access level. */
function resolveRole(roleName) {
  const r = String(roleName || "").toLowerCase();
  if (r === "manager" || r === "admin") return "manager";
  if (r === "restaurant manager" || r === "kitchen manager" || r === "manager") return "manager";
  return null; // customer / unknown → no access
}

const FLAT_NAV = NAV_GROUPS.flatMap((g) => g.items);

function ManagerDashboard({ isAuthenticated, currentUser, onSignOut, onNavigateHome, onNavigate, onOpenAuth }) {
  const role = resolveRole(currentUser?.roleName);
  const hasAccess = isAuthenticated && Boolean(role);

  const [activeId, setActiveId] = useState("overview");
  const [view, setView] = useState("overview");
  const [pendingAction, setPendingAction] = useState(null);
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
  }, []);

  useEffect(() => {
    if (!hasAccess) return undefined;
    let alive = true;
    setLoading(true);
    Promise.all([
      fetchKpis(),
      fetchRevenueSeries(),
      fetchReservations(),
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
        const [kpis, revenue, reservations, tables, dishes, bestSellers, orders, manager, promotions, stats, utilization] = res;
        setData({
          kpis: kpis.data,
          revenue: revenue.data,
          reservations: reservations.data,
          tables: tables.data,
          dishes: dishes.data,
          bestSellers: bestSellers.data,
          orders: orders.data,
          manager: manager.data,
          promotions: promotions.data,
          stats: stats.data,
          utilization: utilization.data,
        });
        setDishSource(dishes.source);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setLoading(false);
        toast("Could not load dashboard data", "error");
      });
    return () => {
      alive = false;
    };
  }, [hasAccess, toast]);

  // Per-list setters that keep the rest of the data object intact.
  const setList = useCallback(
    (key) => (updater) =>
      setData((prev) => ({
        ...prev,
        [key]: typeof updater === "function" ? updater(prev[key]) : updater,
      })),
    []
  );

  const navigate = useCallback(
    (nextView, action = null) => {
      const navItem =
        FLAT_NAV.find((it) => it.view === nextView && it.action === action) ||
        FLAT_NAV.find((it) => it.view === nextView && !it.action) ||
        FLAT_NAV.find((it) => it.view === nextView);
      setView(nextView);
      if (navItem) setActiveId(navItem.id);
      setPendingAction(action);
    },
    []
  );

  const onSelect = useCallback((item) => {
    setActiveId(item.id);
    setView(item.view);
    setPendingAction(item.action || null);
  }, []);

  // Clear one-shot action after it has been consumed by the section.
  useEffect(() => {
    if (!pendingAction) return undefined;
    const t = setTimeout(() => setPendingAction(null), 120);
    return () => clearTimeout(t);
  }, [pendingAction, view]);

  const subtitle = VIEW_SUBTITLE[view] || "Restaurant operations";
  const title = useMemo(() => {
    const item = FLAT_NAV.find((it) => it.id === activeId);
    return item?.label || "Dashboard";
  }, [activeId]);

  /* ---- Access guard ---- */
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

  const renderSection = () => {
    if (loading) {
      return (
        <div className="sfx-loading">
          <span className="sfx-spinner" />
          <p>Loading operations data…</p>
        </div>
      );
    }
    switch (view) {
      case "today":
        return (
          <TodaySection
            kpis={baseKpis}
            reservations={data.reservations}
            tables={data.tables}
            orders={data.orders}
            onNavigate={navigate}
          />
        );
      case "reservations":
        return (
          <ReservationsSection
            reservations={data.reservations}
            setReservations={setList("reservations")}
            pendingAction={pendingAction}
            toast={toast}
          />
        );
      case "tables":
        return (
          <TablesSection
            tables={data.tables}
            setTables={setList("tables")}
            pendingAction={pendingAction}
            role={role}
            toast={toast}
          />
        );
      case "dishes":
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
      case "orders":
        return (
          <OrdersSection
            orders={data.orders}
            setOrders={setList("orders")}
            pendingAction={pendingAction}
            toast={toast}
          />
        );
      case "manager":
        return (
          <StaffSection
            staff={data.manager}
            setStaff={setList("manager")}
            pendingAction={pendingAction}
            toast={toast}
          />
        );
      case "promotions":
        return (
          <PromotionsSection
            promotions={data.promotions}
            setPromotions={setList("promotions")}
            pendingAction={pendingAction}
            toast={toast}
          />
        );
      case "reports":
        return (
          <ReportsSection
            kpis={baseKpis}
            reservations={data.reservations}
            bestSellers={data.bestSellers}
            stats={data.stats}
            utilization={data.utilization}
            pendingAction={pendingAction}
            toast={toast}
          />
        );
      case "settings":
        return (
          <SettingsSection user={currentUser} role={role} onSignOut={onSignOut} toast={toast} />
        );
      default:
        return (
          <OverviewSection
            kpis={baseKpis}
            reservations={data.reservations}
            tables={data.tables}
            orders={data.orders}
            bestSellers={data.bestSellers}
            role={role}
            onNavigate={navigate}
          />
        );
    }
  };

  return (
    <ManagerLayout
      role={role}
      user={currentUser}
      activeId={activeId}
      onSelect={onSelect}
      title={title}
      subtitle={subtitle}
      search={search}
      onSearch={setSearch}
      onQuickAction={() => navigate("reservations")}
      onSignOut={onSignOut}
      toasts={toasts}
    >
      {renderSection()}
    </ManagerLayout>
  );
}

export default ManagerDashboard;
