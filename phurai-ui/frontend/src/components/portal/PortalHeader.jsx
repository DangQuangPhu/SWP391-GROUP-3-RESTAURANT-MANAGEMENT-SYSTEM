/**
 * PortalHeader — Shared header component for Manager, Staff, and Admin portals.
 * Parameterized: all hardcoded strings moved to props.
 *
 * Merged from: ManagerHeader.jsx + StaffHeader.jsx
 * Usage: import PortalHeader from '@/components/portal/PortalHeader';
 *
 * Props:
 *   title          string   — page title (e.g. "Manager Portal")
 *   subtitle       string   — subtitle line
 *   role           string   — "manager" | "restaurant_staff" | "admin"
 *   user           object   — { fullName, avatarUrl }
 *   search         string   — search input value
 *   onSearch       fn       — search change handler
 *   searchPlaceholder string — placeholder text
 *   onToggleSidebar fn
 *   onMobileMenu   fn
 *   actionLabel    string?  — primary action button label (omit to hide)
 *   onAction       fn?      — primary action button click
 *   extraAction    node?    — any extra right-side element (e.g. Refresh button)
 */
import NotificationBell from "@/components/notifications/NotificationBell.jsx";
import PortalIcon from "./PortalIcon.jsx";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const ROLE_LABEL = {
  manager:          "Manager",
  restaurant_staff: "Staff",
  admin:            "Admin",
};

function PortalHeader({
  title,
  subtitle,
  role,
  user,
  search,
  onSearch,
  searchPlaceholder = "Search…",
  onToggleSidebar,
  onMobileMenu,
  actionLabel,
  onAction,
  extraAction,
}) {
  const name = user?.fullName || user?.username || "Phūrai";
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sfx-header">
      <div className="sfx-header__left">
        <button
          type="button"
          className="sfx-iconbtn sfx-header__burger"
          onClick={onMobileMenu}
          aria-label="Open menu"
        >
          <PortalIcon name="menu" size={20} />
        </button>
        <button
          type="button"
          className="sfx-iconbtn sfx-header__collapse"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <PortalIcon name="menu" size={18} />
        </button>
        <div className="sfx-header__titles">
          <h1 className="sfx-header__title">{title}</h1>
          <p className="sfx-header__sub">
            {greeting()}, {name.split(" ")[0]} · {subtitle}
          </p>
        </div>
      </div>

      <div className="sfx-header__right">
        <label className="sfx-search sfx-search--header">
          <PortalIcon name="search" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
          />
        </label>

        <NotificationBell user={user} listenForStaffEvents />

        {extraAction}

        {actionLabel && onAction && (
          <button
            type="button"
            className="sfx-btn sfx-btn--gold sfx-btn--md"
            onClick={onAction}
          >
            <PortalIcon name="plus" size={16} />
            <span>{actionLabel}</span>
          </button>
        )}

        <div className="sfx-header__user">
          <span className="sfx-avatar" aria-hidden="true">
            {user?.avatarUrl ? <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" /> : initials}
          </span>
          <span className="sfx-header__usermeta">
            <strong>{name}</strong>
            <span className={`sfx-role sfx-role--${role}`}>
              {ROLE_LABEL[role] || role?.toUpperCase() || "User"}
            </span>
          </span>
        </div>
      </div>
    </header>
  );
}

export default PortalHeader;
