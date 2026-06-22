import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useOutletContext } from "react-router-dom";
import "../styles/manager-dashboard.css";

import NotFound from "@/pages/NotFound.jsx";
import { KPI_CARDS } from "@/shared/constants.js";
import { ManagerPortalContext, useManagerPortal } from "../context/ManagerPortalContext.jsx";
import ManagerPortalLayout from "./ManagerPortalLayout.jsx";
import { loadAuthUser } from "@/core/api/httpClient.js";

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
  const { loading, data, setList, toast, refreshReservations } = useSectionContext();
  if (loading) return <LoadingState />;
  return (
    <ReservationsSection
      reservations={data.reservations}
      setReservations={setList("reservations")}
      tables={data.tables}
      setTables={setList("tables")}
      toast={toast}
      onRefresh={refreshReservations}
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
  currentUser: propCurrentUser,
  onSignOut,
  onNavigate,
}) {
  const { socket } = useSocket();
  const currentUser = propCurrentUser || loadAuthUser();
  const role = resolveRole(currentUser?.roleName || currentUser?.role_name);
  const hasAccess = (isAuthenticated || !!currentUser) && Boolean(role);

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

  const refreshReservations = useCallback(async () => {
    if (!hasAccess) return;
    try {
      const res = await fetchAllReservations(currentUser?.user_id);
      setData(prev => ({ ...prev, reservations: Array.isArray(res?.data) ? res.data : [] }));
    } catch (err) {
      console.error("Failed to refresh reservations:", err);
    }
  }, [hasAccess, currentUser?.user_id]);

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

    const handleNewReservation = (payload) => {
      // ── Normalise raw socket payload → canonical ReservationRow shape ──────
      // The DB stores everything in special_request as a tagged string, e.g.:
      //   "[Dining Purpose: Birthday] [Hold: 30m]"
      // We parse the occasion out and keep the rest as notes.
      const rawSpecial = payload.special_request || "";
      const occasionMatch = rawSpecial.match(/\[Dining Purpose:\s*([^\]]+)\]/i);
      const occasion = occasionMatch ? occasionMatch[1].trim() : (payload.occasion || "—");

      // Derive reservation_date and start_time from reservation_start_at if not
      // already present (real-time payloads include them; history rows may not).
      const rawIso = payload.reservation_start_at || "";
      const reservation_date = payload.reservation_date || rawIso.slice(0, 10) || null;
      const start_time = payload.start_time || rawIso.slice(11, 16) || "—";

      const normalizedReservation = {
        ...payload,
        reservation_date,
        start_time,
        occasion,
        // Keep raw notes separate from the occasion so the detail drawer can
        // still display the full special_request text.
        notes: rawSpecial,
        // Ensure both aliases for guest count are present.
        guest_count: payload.guest_count ?? payload.party_size,
        party_size: payload.party_size ?? payload.guest_count,
        // Canonical phone and email fields.
        customer_phone: payload.customer_phone || payload.phone || null,
        email: payload.customer_email || payload.email || null,
        // Guarantee both status fields are present and correctly cased so the
        // table row badge and the detail drawer footer buttons always render.
        // ReservationsSection checks: (r.status || r.reservation_status || "").toLowerCase()
        reservation_status: payload.reservation_status || "Pending",
        status: payload.status || payload.reservation_status || "pending",
      };

      toast(
        `🔔 New Reservation: ${normalizedReservation.customer_name} booked for ${normalizedReservation.party_size} guests at ${normalizedReservation.start_time} on ${normalizedReservation.reservation_date}`,
        "info"
      );
      setList("reservations")((prev) => [normalizedReservation, ...prev]);
    };

    const handleCheckedIn = (data) => {
      toast(`Reservation #${data.reservation_id} checked in by staff`, "success");
      window.dispatchEvent(new Event("phurai_manager_refresh"));
    };

    const handleRejected = (data) => {
      toast(`Reservation #${data.reservation_id} marked as ${data.new_status} by staff`, "info");
      window.dispatchEvent(new Event("phurai_manager_refresh"));
    };

    const handleStatusChanged = (data) => {
      const newStatus = data.new_status || data.status;
      toast(`Reservation #${data.reservation_id} status changed to ${newStatus}`, "info");
      setData(prev => {
        const reservations = prev.reservations.map(r => {
          if (r?.reservation_id === data.reservation_id) {
            return { ...r, status: newStatus, reservation_status: newStatus };
          }
          return r;
        });
        return { ...prev, reservations };
      });
    };

    const handlePaymentSuccess = (payload) => {
      // payload may be { reservationId, flashCompletePaid } or { reservation_id, flashCompletePaid }
      const resId = payload.reservation_id || payload.reservationId;
      if (payload.flashCompletePaid) {
        setData(prev => {
          const reservations = prev.reservations.map(r => {
            if (r?.reservation_id === resId) {
              const originalStatus = r.reservation_status || r.status || 'Await Check-in';
              // Mutate temporarily to Complete Paid
              r = { ...r, status: 'Complete Paid', reservation_status: 'Complete Paid', _isFlashing: true };
              
              setTimeout(() => {
                setData(currentData => {
                  const currReservations = currentData.reservations.map(cr => {
                    if (cr?.reservation_id === resId && cr._isFlashing) {
                      return { ...cr, status: originalStatus, reservation_status: originalStatus, _isFlashing: false };
                    }
                    return cr;
                  });
                  return { ...currentData, reservations: currReservations };
                });
              }, 10000);
            }
            return r;
          });
          return { ...prev, reservations };
        });
        toast(`Payment verified for booking #${resId}`, "success");
      } else {
        // Fallback for older code if it passes status
        setData(prev => {
          const reservations = prev.reservations.map(r => {
            if (r?.reservation_id === resId) {
              return { ...r, status: payload.status, reservation_status: payload.status };
            }
            return r;
          });
          return { ...prev, reservations };
        });
        toast(`Payment for Reservation #${resId} succeeded.`, "success");
      }
    };

    socket.on("reservation:new", handleNewReservation);
    socket.on("reservation:checked_in", handleCheckedIn);
    socket.on("reservation:rejected", handleRejected);
    socket.on("reservation:status_changed", handleStatusChanged);
    socket.on("reservation:status_updated", handleStatusChanged);
    socket.on("RESERVATION_STATUS_CHANGED", handleStatusChanged);
    socket.on("RESERVATION_PAYMENT_SUCCESS", handlePaymentSuccess);

    const handleTableMerged = (data) => {
      toast(`[Table Update] ${data.child_table_number} was merged into ${data.parent_table_number} by ${data.staff_name}`, "info");
      window.dispatchEvent(new Event("phurai_manager_refresh"));
    };
    const handleTableSync = (data) => {
      window.dispatchEvent(new Event("phurai_manager_refresh"));
    };

    socket.on("table:merged", handleTableMerged);
    socket.on("table:sync", handleTableSync);

    return () => {
      socket.off("reservation:new", handleNewReservation);
      socket.off("reservation:checked_in", handleCheckedIn);
      socket.off("reservation:rejected", handleRejected);
      socket.off("reservation:status_changed", handleStatusChanged);
      socket.off("reservation:status_updated", handleStatusChanged);
      socket.off("RESERVATION_STATUS_CHANGED", handleStatusChanged);
      socket.off("RESERVATION_PAYMENT_SUCCESS", handlePaymentSuccess);
      socket.off("table:merged", handleTableMerged);
      socket.off("table:sync", handleTableSync);
    };
  }, [hasAccess, toast, socket]);

  // Listen to refresh events
  useEffect(() => {
    const handleRefresh = () => {
      // Reload reservations and tables
      fetchAllReservations(currentUser?.user_id).then(res => {
        setList("reservations")(res.data);
      });
      fetchTables().then(res => {
        setList("tables")(asArray(res.data));
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
