/**
 * StaffSidebar — thin wrapper around shared PortalSidebar.
 * Preserves original API so StaffLayout needs no changes.
 */
import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import PortalSidebar from "@/components/portal/PortalSidebar.jsx";
import { getNavForRole, resolveActiveNavItem } from "../config/staffNav.js";
import { navItemToPath } from "../config/staffRoutes.js";

function StaffSidebar({ role, collapsed, mobileOpen, onCloseMobile, onSignOut }) {
  const location = useLocation();

  const groups = useMemo(() => {
    return getNavForRole(role).map((g) => ({
      ...g,
      items: g.items.map((it) => ({ ...it, to: navItemToPath(it) })),
    }));
  }, [role]);

  const resolveActive = (pathname, item) => {
    const active = resolveActiveNavItem(pathname);
    return active?.id === item.id;
  };

  const portalLabel = role === "kitchen_staff" ? "KITCHEN PORTAL" : "STAFF PORTAL";

  return (
    <PortalSidebar
      portalLabel={portalLabel}
      navGroups={groups}
      collapsed={collapsed}
      mobileOpen={mobileOpen}
      onCloseMobile={onCloseMobile}
      onSignOut={onSignOut}
      resolveActive={resolveActive}
    />
  );
}

export default StaffSidebar;
