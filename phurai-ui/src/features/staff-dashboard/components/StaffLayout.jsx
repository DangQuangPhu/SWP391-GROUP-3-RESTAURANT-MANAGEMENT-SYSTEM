import { useState } from "react";
import StaffSidebar from "./StaffSidebar.jsx";
import StaffHeader from "./StaffHeader.jsx";
import Icon from "./StaffIcons.jsx";

function StaffLayout({
  role,
  user,
  title,
  subtitle,
  search,
  onSearch,
  onRefresh,
  refreshing,
  refreshLabel = "Refresh",
  onSignOut,
  toasts,
  children,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className={`sfx-shell sfx-shell--staff ${collapsed ? "sfx-shell--collapsed" : ""}`}>
      <StaffSidebar
        role={role}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onSignOut={onSignOut}
      />

      <div className="sfx-main">
        <StaffHeader
          title={title}
          subtitle={subtitle}
          role={role}
          user={user}
          search={search}
          onSearch={onSearch}
          onToggleSidebar={() => setCollapsed((c) => !c)}
          onMobileMenu={() => setMobileOpen(true)}
          onRefresh={onRefresh}
          refreshing={refreshing}
          refreshLabel={refreshLabel}
        />
        <main className="sfx-canvas">{children}</main>
      </div>

      <div className="sfx-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`sfx-toast sfx-toast--${t.tone}`}>
            <Icon name={t.tone === "error" ? "close" : "check"} size={15} />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default StaffLayout;
