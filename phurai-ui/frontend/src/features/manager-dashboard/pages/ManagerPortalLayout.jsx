import { useCallback, useEffect, useMemo } from "react";
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
      onQuickAction={() => portalNavigate("reservations")}
      onSignOut={onSignOut}
      toasts={toasts}
    >
      <Outlet context={{ portalNavigate, pendingAction }} />
    </ManagerLayout>
  );
}

export default ManagerPortalLayout;
