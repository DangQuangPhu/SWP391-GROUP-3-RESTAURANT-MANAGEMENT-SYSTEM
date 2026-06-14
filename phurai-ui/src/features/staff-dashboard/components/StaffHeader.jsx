import Icon from "./StaffIcons.jsx";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const ROLE_LABEL = {
  restaurant_staff: "Restaurant Staff",
  kitchen_staff: "Kitchen Staff",
};

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
  const name = user?.fullName || user?.username || "Phūrai Staff";
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
          <Icon name="menu" size={20} />
        </button>
        <button
          type="button"
          className="sfx-iconbtn sfx-header__collapse"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <Icon name="menu" size={18} />
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
          <Icon name="search" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search guest name or phone…"
          />
        </label>

        <button type="button" className="sfx-iconbtn sfx-header__bell" aria-label="Notifications">
          <Icon name="bell" size={18} />
          <span className="sfx-header__dot" />
        </button>

        <button
          type="button"
          className="sfx-btn sfx-btn--ghost sfx-btn--md"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <Icon name="refresh" size={16} />
          <span>{refreshing ? "Refreshing…" : refreshLabel}</span>
        </button>

        <div className="sfx-header__user">
          <span className="sfx-avatar" aria-hidden="true">
            {user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials}
          </span>
          <span className="sfx-header__usermeta">
            <strong>{name}</strong>
            <span className={`sfx-role sfx-role--${role}`}>{ROLE_LABEL[role] || "Staff"}</span>
          </span>
        </div>
      </div>
    </header>
  );
}

export default StaffHeader;
