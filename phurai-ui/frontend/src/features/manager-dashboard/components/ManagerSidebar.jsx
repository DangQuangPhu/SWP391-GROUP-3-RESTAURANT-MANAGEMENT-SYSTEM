/**
 * ManagerSidebar — thin wrapper around shared PortalSidebar.
 * Preserves original API so ManagerLayout needs no changes.
 */
import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import PortalSidebar from "@/components/portal/PortalSidebar.jsx";
import { NAV_GROUPS } from "../config/managerNav.js";
import { navItemToPath, resolveActiveNavItem } from "../config/managerRoutes.js";

function ManagerSidebar({ collapsed, role, mobileOpen, onCloseMobile, onSignOut }) {
  const location = useLocation();

  const groups = useMemo(() => {
    const isManager = role === "manager";
    return NAV_GROUPS.map((g) => ({
      ...g,
      items: g.items
        .filter((it) => isManager || !it.managerOnly)
        .map((it) => ({ ...it, to: navItemToPath(it) })),
    })).filter((g) => g.items.length > 0);
  }, [role]);

  const resolveActive = (pathname, item) => {
    const active = resolveActiveNavItem(pathname, location.search);
    return active?.id === item.id;
  };

  return (
    <PortalSidebar
      portalLabel="MANAGER PORTAL"
      navGroups={groups}
      collapsed={collapsed}
      mobileOpen={mobileOpen}
      onCloseMobile={onCloseMobile}
      onSignOut={onSignOut}
      resolveActive={resolveActive}
    />
  );
}

export default ManagerSidebar;
