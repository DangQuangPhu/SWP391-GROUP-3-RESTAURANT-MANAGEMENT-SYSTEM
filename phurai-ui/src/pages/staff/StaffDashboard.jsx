import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@/styles/staff-dashboard.css";

import StaffLayout from "@/components/staff/StaffLayout.jsx";
import Icon from "@/components/staff/StaffIcons.jsx";
import { NAV_GROUPS, VIEW_SUBTITLE } from "@/data/staffNav.js";

import OverviewSection from "@/components/staff/sections/OverviewSection.jsx";
import TodaySection from "@/components/staff/sections/TodaySection.jsx";
import ReservationsSection from "@/components/staff/sections/ReservationsSection.jsx";
import TablesSection from "@/components/staff/sections/TablesSection.jsx";
import DishesSection from "@/components/staff/sections/DishesSection.jsx";
import OrdersSection from "@/components/staff/sections/OrdersSection.jsx";
import StaffSection from "@/components/staff/sections/StaffSection.jsx";
import PromotionsSection from "@/components/staff/sections/PromotionsSection.jsx";
import ReportsSection from "@/components/staff/sections/ReportsSection.jsx";
import SettingsSection from "@/components/staff/sections/SettingsSection.jsx";

import {
  fetchKpis,
  fetchRevenueSeries,
  fetchReservations,
  fetchTables,
  fetchDishes,
  fetchBestSellers,
  fetchOrders,
  fetchStaff,
  fetchPromotions,
  fetchReservationStats,
  fetchTableUtilization,
} from "@/services/staffApi.js";

/* Map backend role names → portal access level. */
function resolveRole(roleName) {
  const r = String(roleName || "").toLowerCase();
  if (r === "manager" || r === "admin") return "manager";
  if (r === "restaurant staff" || r === "kitchen staff" || r === "staff") return "staff";
  return null; // customer / unknown → no access
}

const FLAT_NAV = NAV_GROUPS.flatMap((g) => g.items);

function StaffDashboard({ isAuthenticated, currentUser, onSignOut, onNavigateHome, onOpenAuth }) {
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
    staff: [],
    promotions: [],
    stats: {},
    utilization: [],
  });
  const [dishSource, setDishSource] = useState("mock");

  const [toasts, setToasts] = useState([]);
  const toastSeq = useRef(0);

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
      fetchStaff(),
      fetchPromotions(),
      fetchReservationStats(),
      fetchTableUtilization(),
    ])
      .then((res) => {
        if (!alive) return;
        const [kpis, revenue, reservations, tables, dishes, bestSellers, orders, staff, promotions, stats, utilization] = res;
        setData({
          kpis: kpis.data,
          revenue: revenue.data,
          reservations: reservations.data,
          tables: tables.data,
          dishes: dishes.data,
          bestSellers: bestSellers.data,
          orders: orders.data,
          staff: staff.data,
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
      <div className="sfx-gate">
        <div className="sfx-gate__card">
          <span className="sfx-gate__mark">P</span>
          <h1>Phūrai Staff Portal</h1>
          {!isAuthenticated ? (
            <>
              <p>Please sign in with a staff or manager account to continue.</p>
              <div className="sfx-gate__acts">
                <button className="sfx-btn sfx-btn--gold sfx-btn--md" onClick={onOpenAuth}>
                  <Icon name="logout" size={16} />
                  <span>Sign in</span>
                </button>
                <button className="sfx-btn sfx-btn--ghost sfx-btn--md" onClick={onNavigateHome}>
                  <span>Back to website</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <p>
                Your account ({currentUser?.roleName || "Customer"}) does not have access to the staff
                dashboard. Contact a manager if you believe this is a mistake.
              </p>
              <div className="sfx-gate__acts">
                <button className="sfx-btn sfx-btn--gold sfx-btn--md" onClick={onNavigateHome}>
                  <span>Back to website</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
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
            kpis={data.kpis}
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
      case "staff":
        return (
          <StaffSection
            staff={data.staff}
            setStaff={setList("staff")}
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
            kpis={data.kpis}
            revenue={data.revenue}
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
            kpis={data.kpis}
            revenue={data.revenue}
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
    <StaffLayout
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
    </StaffLayout>
  );
}

export default StaffDashboard;
