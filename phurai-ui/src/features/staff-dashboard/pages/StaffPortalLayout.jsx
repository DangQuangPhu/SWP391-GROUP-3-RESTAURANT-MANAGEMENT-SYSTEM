import { useCallback, useMemo } from "react";
import { Outlet, useLocation } from "react-router-dom";

import StaffLayout from "../components/StaffLayout.jsx";
import { VIEW_SUBTITLE } from "../config/staffNav.js";
import { getStaffSegment, resolveActiveNavItem } from "../config/staffRoutes.js";
import { useStaffPortal } from "../context/StaffPortalContext.jsx";

const REFRESH_LABELS = {
  reservations: "Refresh queue",
  tables: "Refresh tables",
  orders: "Refresh orders",
  kitchen: "Refresh kitchen",
};

function StaffPortalLayout({ onSignOut }) {
  const {
    staffRole,
    user,
    search,
    setSearch,
    toasts,
    refreshing,
    refreshCurrentSection,
  } = useStaffPortal();
  const location = useLocation();

  const segment = getStaffSegment(location.pathname);
  const activeItem = useMemo(
    () => resolveActiveNavItem(location.pathname),
    [location.pathname]
  );

  const title = activeItem?.label || "Staff Portal";
  const subtitle = VIEW_SUBTITLE[segment] || "Daily restaurant operations";

  const onRefresh = useCallback(() => {
    refreshCurrentSection(segment);
  }, [refreshCurrentSection, segment]);

  return (
    <StaffLayout
      role={staffRole}
      user={user}
      title={title}
      subtitle={subtitle}
      search={search}
      onSearch={setSearch}
      onRefresh={onRefresh}
      refreshing={refreshing}
      refreshLabel={REFRESH_LABELS[segment] || "Refresh"}
      onSignOut={onSignOut}
      toasts={toasts}
    >
      <Outlet />
    </StaffLayout>
  );
}

export default StaffPortalLayout;
