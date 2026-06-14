import { NAV_GROUPS } from "../config/staffNav.js";
import Icon from "./StaffIcons.jsx";

function StaffSidebar({ activeId, onSelect, collapsed, mobileOpen, onCloseMobile, onSignOut }) {
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
        <div className="sfx-brand sfx-brand--staff">
          <span className="sfx-brand__mark">P</span>
          <span className="sfx-brand__text">
            <strong>Phūrai</strong>
            <small>Staff Portal</small>
          </span>
        </div>

        <nav className="sfx-nav">
          {NAV_GROUPS.map((g) => (
            <div className="sfx-nav__group" key={g.group}>
              <p className="sfx-nav__label">{g.group}</p>
              {g.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`sfx-nav__item ${activeId === item.id ? "is-active" : ""}`}
                  onClick={() => onSelect(item)}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="sfx-nav__icon">
                    <Icon name={item.icon} size={18} />
                  </span>
                  <span className="sfx-nav__text">{item.label}</span>
                  {activeId === item.id ? <span className="sfx-nav__pill" /> : null}
                </button>
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

export default StaffSidebar;
