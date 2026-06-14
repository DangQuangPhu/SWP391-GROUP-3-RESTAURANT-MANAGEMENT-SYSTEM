import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../styles/staff-dashboard.css";

import StaffLayout from "../components/StaffLayout.jsx";
import ReservationQueueSection from "../components/sections/ReservationQueueSection.jsx";
import { NAV_GROUPS, VIEW_SUBTITLE } from "../config/staffNav.js";
import { fetchReservationQueue } from "../services/staffApi.js";
import NotFound from "@/pages/NotFound.jsx";

const FLAT_NAV = NAV_GROUPS.flatMap((g) => g.items);

function resolveStaffRole(user) {
  if (!user) return null;
  const roleId = Number(user.roleId ?? user.role_id);
  if (roleId === 2) return "restaurant_staff";
  if (roleId === 3) return "kitchen_staff";
  const role = String(user.roleName ?? user.role_name ?? user.role ?? "")
    .trim()
    .toLowerCase();
  if (role === "restaurant staff") return "restaurant_staff";
  if (role === "kitchen staff") return "kitchen_staff";
  return null;
}

export function isStaffPortalUser(user) {
  return Boolean(resolveStaffRole(user));
}

function isManagerPortalUser(user) {
  if (!user) return false;
  const roleId = Number(user.roleId ?? user.role_id);
  if (roleId === 4 || roleId === 5) return true;
  const role = String(user.roleName ?? user.role_name ?? user.role ?? "")
    .trim()
    .toLowerCase();
  return role === "manager" || role === "admin";
}

function StaffDashboardPage({
  isAuthenticated,
  currentUser,
  onSignOut,
  onNavigate,
}) {
  const staffRole = resolveStaffRole(currentUser);
  const managerUser = isManagerPortalUser(currentUser);
  const hasAccess = isAuthenticated && Boolean(staffRole);

  const [activeId, setActiveId] = useState("reservation-queue");
  const [view, setView] = useState("reservation-queue");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataSource, setDataSource] = useState("mock");
  const [queue, setQueue] = useState([]);

  const [toasts, setToasts] = useState([]);
  const toastSeq = useRef(0);

  const toast = useCallback((message, tone = "info") => {
    const id = ++toastSeq.current;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const loadQueue = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetchReservationQueue();
      setQueue(res.data);
      setDataSource(res.source);
    } catch {
      toast("Could not load reservation queue", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isAuthenticated && managerUser) {
      onNavigate?.("manager");
    }
  }, [isAuthenticated, managerUser, onNavigate]);

  useEffect(() => {
    if (!hasAccess) return undefined;
    loadQueue(false);
    return undefined;
  }, [hasAccess, loadQueue]);

  const onSelect = useCallback((item) => {
    setActiveId(item.id);
    setView(item.view);
  }, []);

  const title = useMemo(() => {
    const item = FLAT_NAV.find((it) => it.id === activeId);
    return item?.label || "Staff Portal";
  }, [activeId]);

  const subtitle = VIEW_SUBTITLE[view] || "Daily front-of-house operations";

  if (managerUser) {
    return (
      <div className="sfx-gate">
        <div className="sfx-loading">
          <span className="sfx-spinner" />
          <p>Redirecting to Manager Portal…</p>
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

  const renderSection = () => {
    if (loading) {
      return (
        <div className="sfx-loading">
          <span className="sfx-spinner" />
          <p>Loading reservation queue…</p>
        </div>
      );
    }
    if (view === "reservation-queue") {
      return (
        <ReservationQueueSection
          queue={queue}
          setQueue={setQueue}
          dataSource={dataSource}
          toast={toast}
        />
      );
    }
    return null;
  };

  return (
    <StaffLayout
      role={staffRole}
      user={currentUser}
      activeId={activeId}
      onSelect={onSelect}
      title={title}
      subtitle={subtitle}
      search={search}
      onSearch={setSearch}
      onRefresh={() => loadQueue(true)}
      refreshing={refreshing}
      onSignOut={onSignOut}
      toasts={toasts}
    >
      {renderSection()}
    </StaffLayout>
  );
}

export default StaffDashboardPage;
