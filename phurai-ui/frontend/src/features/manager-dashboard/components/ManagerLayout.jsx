import { useState } from "react";
import ManagerSidebar from "./ManagerSidebar.jsx";
import ManagerHeader from "./ManagerHeader.jsx";
import Icon from "./ManagerIcons.jsx";

function ManagerLayout({
  role,
  user,
  title,
  subtitle,
  search,
  onSearch,
  onRefresh,
  refreshing,
  onSignOut,
  onSaveProfile,
  toasts,
  children,
}) {
  // Default: sidebar collapsed (icon-only). User toggles to expand.
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className={`sfx-shell sfx-shell--manager ${expanded ? "sfx-shell--expanded" : "sfx-shell--collapsed"}`}>
      <ManagerSidebar
        collapsed={!expanded}
        role={role}
        mobileOpen={mobileOpen}
        onCloseMobile={closeMobile}
        onSignOut={onSignOut}
      />

      <div className="sfx-main">
        <ManagerHeader
          title={title}
          subtitle={subtitle}
          role={role}
          user={user}
          search={search}
          onSearch={onSearch}
          onToggleSidebar={() => setExpanded((e) => !e)}
          onMobileMenu={() => setMobileOpen(true)}
          onRefresh={onRefresh}
          refreshing={refreshing}
          onSignOut={onSignOut}
          onSaveProfile={onSaveProfile}
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

export default ManagerLayout;
