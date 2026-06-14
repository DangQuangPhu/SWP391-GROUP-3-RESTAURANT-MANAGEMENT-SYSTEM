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
  onQuickAction,
  onSignOut,
  toasts,
  children,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className={`sfx-shell ${collapsed ? "sfx-shell--collapsed" : ""}`}>
      <ManagerSidebar
        collapsed={collapsed}
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
          onToggleSidebar={() => setCollapsed((c) => !c)}
          onMobileMenu={() => setMobileOpen(true)}
          onQuickAction={onQuickAction}
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
