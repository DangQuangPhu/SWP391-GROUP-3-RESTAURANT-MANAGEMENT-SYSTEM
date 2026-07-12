/**
 * AdminLayout — Shell layout for the Admin Console.
 * Uses shared sfx-* design system (same tokens as Manager/Staff portals).
 * sfx-shell--admin modifier ensures Admin-specific overrides don't clash with --manager/--staff.
 *
 * Design token source: manager-dashboard.css (imported via admin-console.css)
 */
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Outlet } from "react-router-dom";
import PortalHeader from "@/components/portal/PortalHeader.jsx";
import PortalSidebar from "@/components/portal/PortalSidebar.jsx";
import PortalIcon from "@/components/portal/PortalIcon.jsx";
import { ADMIN_NAV_GROUPS } from "../config/adminNav.js";
import "../../manager-dashboard/styles/manager-dashboard.css";
import "../styles/AdminLayout.css";


/**
 * resolveActive: Returns true if the given nav item's path matches current pathname.
 * Uses exact match for items with `end: true`, prefix match otherwise.
 */
function resolveAdminActive(pathname, item) {
  if (item.end) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(item.to + "/");
}

export default function AdminLayout({ currentUser, onSignOut }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const closeMobile = () => setMobileOpen(false);

  const handleSignOut = onSignOut || (() => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    navigate("/auth/login");
  });

  /** Refresh Data: dispatches phurai_admin_refresh event. Each admin page listens for this. */
  const handleRefresh = useCallback(() => {
    if (refreshing) return;
    setRefreshing(true);
    window.dispatchEvent(new Event("phurai_admin_refresh"));
    setTimeout(() => setRefreshing(false), 2000);
  }, [refreshing]);

  const refreshBtn = (
    <button
      type="button"
      className="sfx-btn sfx-btn--ghost sfx-btn--md"
      onClick={handleRefresh}
      disabled={refreshing}
      aria-label="Refresh admin data"
    >
      <PortalIcon name="refresh" size={16} />
      <span>{refreshing ? "Refreshing…" : "Refresh Data"}</span>
    </button>
  );

  return (
    <div className={`sfx-shell sfx-shell--admin ${expanded ? "sfx-shell--expanded" : "sfx-shell--collapsed"}`}>
      <PortalSidebar
        portalLabel="ADMIN CONSOLE"
        navGroups={ADMIN_NAV_GROUPS}
        collapsed={!expanded}
        mobileOpen={mobileOpen}
        onCloseMobile={closeMobile}
        onSignOut={handleSignOut}
        resolveActive={resolveAdminActive}
      />

      <div className="sfx-main">
        <PortalHeader
          title="Admin Console"
          subtitle="System-wide overview"
          role="admin"
          user={currentUser}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search accounts, roles, audit logs…"
          onToggleSidebar={() => setExpanded((e) => !e)}
          onMobileMenu={() => setMobileOpen(true)}
          extraAction={refreshBtn}
        />

        <main className="sfx-canvas">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
