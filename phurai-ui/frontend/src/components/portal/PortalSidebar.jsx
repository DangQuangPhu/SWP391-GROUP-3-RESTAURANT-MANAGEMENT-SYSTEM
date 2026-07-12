/**
 * PortalSidebar — Shared sidebar component for Manager, Staff, and Admin portals.
 * Fully parameterized: portalLabel, navGroups, icon resolver — all via props.
 *
 * Merged from: ManagerSidebar.jsx + StaffSidebar.jsx
 * Usage: import PortalSidebar from '@/components/portal/PortalSidebar';
 *
 * Props:
 *   portalLabel  string   — e.g. "MANAGER PORTAL" | "STAFF PORTAL" | "ADMIN CONSOLE"
 *   navGroups    array    — [{ group: string, items: [{ id, label, icon, to }] }]
 *   collapsed    bool
 *   mobileOpen   bool
 *   onCloseMobile fn
 *   onSignOut    fn
 *   resolveActive fn(pathname) => item|null  — determines active nav item
 *   itemToPath   fn(item) => string          — converts item to URL path
 */
import { NavLink, useLocation } from "react-router-dom";
import PortalIcon from "./PortalIcon.jsx";

function SidebarNavItem({ item, collapsed, onCloseMobile, isActive }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={`sfx-nav__item${isActive ? " is-active" : ""}`}
      onClick={onCloseMobile}
      title={item.label}
      aria-label={item.label}
    >
      <span className="sfx-nav__icon">
        <PortalIcon name={item.icon} size={18} />
      </span>
      <span className="sfx-nav__text">{item.label}</span>
      {isActive ? <span className="sfx-nav__pill" /> : null}
    </NavLink>
  );
}

function PortalSidebar({
  portalLabel = "PORTAL",
  navGroups = [],
  collapsed,
  mobileOpen,
  onCloseMobile,
  onSignOut,
  resolveActive,
}) {
  const location = useLocation();

  return (
    <>
      <div
        className={`sfx-scrim ${mobileOpen ? "is-open" : ""}`}
        onClick={onCloseMobile}
        aria-hidden="true"
      />
      <aside
        className={`sfx-sidebar ${collapsed ? "is-collapsed" : ""} ${
          mobileOpen ? "is-mobile-open" : ""
        }`}
      >
        <div className="sfx-brand sfx-brand--portal">
          <span className="sfx-brand__mark">
            <img
              src="/logo.png"
              alt="Phūrai"
              style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "inherit" }}
            />
          </span>
          <span className="sfx-brand__text">
            <strong>Phūrai</strong>
            <small>{portalLabel}</small>
          </span>
        </div>

        <nav className="sfx-nav">
          {navGroups.map((g) => (
            <div className="sfx-nav__group" key={g.group}>
              <p className="sfx-nav__label">{g.group}</p>
              {g.items.map((item) => {
                const isActive = resolveActive
                  ? resolveActive(location.pathname, item) === true
                  : false;
                return (
                  <SidebarNavItem
                    key={item.id || item.to}
                    item={item}
                    collapsed={collapsed}
                    onCloseMobile={onCloseMobile}
                    isActive={isActive}
                  />
                );
              })}
            </div>
          ))}
        </nav>

        <button
          type="button"
          className="sfx-nav__item sfx-nav__logout"
          onClick={onSignOut}
        >
          <span className="sfx-nav__icon">
            <PortalIcon name="logout" size={18} />
          </span>
          <span className="sfx-nav__text">Logout</span>
        </button>
      </aside>
    </>
  );
}

export default PortalSidebar;
