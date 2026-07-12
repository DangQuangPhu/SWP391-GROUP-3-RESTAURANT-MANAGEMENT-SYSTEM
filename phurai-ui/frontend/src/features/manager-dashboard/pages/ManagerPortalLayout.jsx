import { useCallback, useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";

import ManagerLayout from "../components/ManagerLayout.jsx";
import { VIEW_SUBTITLE } from "../config/managerNav.js";
import {
  buildManagerPath,
  getViewFromPath,
  isEphemeralPendingAction,
  pendingActionFromSearch,
  resolveActiveNavItem,
} from "../config/managerRoutes.js";
import { useManagerPortal } from "../context/ManagerPortalContext.jsx";

function ManagerPortalLayout({ onSignOut }) {
  const { role, user, search, setSearch, toasts } = useManagerPortal();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Refresh state for Refresh Data button
  const [refreshing, setRefreshing] = useState(false);

  const view = getViewFromPath(location.pathname);
  const pendingAction = pendingActionFromSearch(location.search);

  const activeItem = useMemo(
    () => resolveActiveNavItem(location.pathname, location.search),
    [location.pathname, location.search]
  );

  const title = activeItem?.label || "Dashboard";
  const subtitle = VIEW_SUBTITLE[view] || "Restaurant operations";

  const portalNavigate = useCallback(
    (nextView, action = null) => {
      navigate(buildManagerPath(nextView, action));
    },
    [navigate]
  );

  /** Refresh Data button handler — dispatches phurai_manager_refresh event */
  const handleRefresh = useCallback(() => {
    if (refreshing) return;
    setRefreshing(true);
    // Trigger all data reload via existing event listener in ManagerPortalPage
    window.dispatchEvent(new Event("phurai_manager_refresh"));
    // Auto-clear after 2s (data fetch is async, we just show spinner briefly)
    setTimeout(() => setRefreshing(false), 2000);
  }, [refreshing]);

  useEffect(() => {
    if (!pendingAction || !isEphemeralPendingAction(pendingAction)) return undefined;
    const timer = setTimeout(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (pendingAction === "add") next.delete("action");
          return next;
        },
        { replace: true }
      );
    }, 120);
    return () => clearTimeout(timer);
  }, [pendingAction, setSearchParams]);

  return (
    <ManagerLayout
      role={role}
      user={user}
      title={title}
      subtitle={subtitle}
      search={search}
      onSearch={setSearch}
      onRefresh={handleRefresh}
      refreshing={refreshing}
      onSignOut={onSignOut}
      toasts={toasts}
    >
      <Outlet context={{ portalNavigate, pendingAction }} />
    </ManagerLayout>
  );
}

export default ManagerPortalLayout;
