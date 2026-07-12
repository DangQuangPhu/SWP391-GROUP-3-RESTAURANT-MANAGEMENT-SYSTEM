/**
 * StaffHeader — thin wrapper around shared PortalHeader.
 * Preserves original props API so StaffLayout needs no changes.
 */
import PortalHeader from "@/components/portal/PortalHeader.jsx";
import PortalIcon from "@/components/portal/PortalIcon.jsx";

function StaffHeader({
  title,
  subtitle,
  role,
  user,
  search,
  onSearch,
  onToggleSidebar,
  onMobileMenu,
  onRefresh,
  refreshing,
  refreshLabel = "Refresh",
}) {
  const refreshBtn = (
    <button
      type="button"
      className="sfx-btn sfx-btn--ghost sfx-btn--md"
      onClick={onRefresh}
      disabled={refreshing}
    >
      <PortalIcon name="refresh" size={16} />
      <span>{refreshing ? "Refreshing…" : refreshLabel}</span>
    </button>
  );

  return (
    <PortalHeader
      title={title}
      subtitle={subtitle}
      role={role}
      user={user}
      search={search}
      onSearch={onSearch}
      searchPlaceholder="Search guest name or phone…"
      onToggleSidebar={onToggleSidebar}
      onMobileMenu={onMobileMenu}
      extraAction={onRefresh ? refreshBtn : undefined}
    />
  );
}

export default StaffHeader;
