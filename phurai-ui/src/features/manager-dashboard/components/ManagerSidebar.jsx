import { useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import Icon from "./ManagerIcons.jsx";
import { NAV_GROUPS } from "../config/managerNav.js";
import { navItemToPath, resolveActiveNavItem } from "../config/managerRoutes.js";

function SidebarNavItem({ item, collapsed, onCloseMobile }) {
  const location = useLocation();
  const isItemActive =
    resolveActiveNavItem(location.pathname, location.search)?.id === item.id;

  return (
    <NavLink
      to={navItemToPath(item)}
      className={({ isActive }) => `sfx-nav__item${isActive ? " is-active" : ""}`}
      isActive={() => isItemActive}
      onClick={onCloseMobile}
      title={collapsed ? item.label : undefined}
    >
      <span className="sfx-nav__icon">
        <Icon name={item.icon} size={18} />
      </span>
      <span className="sfx-nav__text">{item.label}</span>
      {isItemActive ? <span className="sfx-nav__pill" /> : null}
    </NavLink>
  );
}

function ManagerSidebar({
  collapsed,
  role,
  mobileOpen,
  onCloseMobile,
  onSignOut,
}) {
  const groups = useMemo(() => {
    const isManager = role === "manager";
    return NAV_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((it) => isManager || !it.managerOnly),
    })).filter((g) => g.items.length > 0);
  }, [role]);

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
        <div className="sfx-brand sfx-brand--manager">
          <span className="sfx-brand__mark">P</span>
          <span className="sfx-brand__text">
            <strong>Phūrai</strong>
            <small>MANAGER PORTAL</small>
          </span>
        </div>

        <nav className="sfx-nav">
          {groups.map((g) => (
            <div className="sfx-nav__group" key={g.group}>
              <p className="sfx-nav__label">{g.group}</p>
              {g.items.map((item) => (
                <SidebarNavItem
                  key={item.id}
                  item={item}
                  collapsed={collapsed}
                  onCloseMobile={onCloseMobile}
                />
              ))}
            </div>
          ))}
        </nav>

        <button type="button" className="sfx-nav__item sfx-nav__logout" onClick={onSignOut}>
          <span className="sfx-nav__icon">
            <Icon name="logout" size={18} />
          </span>
          <span className="sfx-nav__text">Logout</span>
        </button>
      </aside>
    </>
  );
}

export default ManagerSidebar;
