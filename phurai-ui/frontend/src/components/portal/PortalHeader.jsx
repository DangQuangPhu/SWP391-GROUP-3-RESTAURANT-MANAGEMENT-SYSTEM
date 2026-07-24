/**
 * PortalHeader — Shared header component for Manager, Staff, and Admin portals.
 * Parameterized: all hardcoded strings moved to props.
 *
 * Merged from: ManagerHeader.jsx + StaffHeader.jsx
 * Includes: Avatar dropdown menu for editing profile & changing password.
 */
import { useEffect, useRef, useState } from "react";
import NotificationBell from "@/components/notifications/NotificationBell.jsx";
import ProfileModal from "@/features/auth/components/ProfileModal.jsx";
import UserAvatar from "@/features/auth/components/UserAvatar.jsx";
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
  onSignOut,
  onSaveProfile,
}) {
  const [currentUserState, setCurrentUserState] = useState(user);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [modalInitialView, setModalInitialView] = useState("edit");
  const dropdownRef = useRef(null);

  useEffect(() => {
    setCurrentUserState(user);
  }, [user]);

  // Click outside & Escape key to close dropdown
  useEffect(() => {
    if (!dropdownOpen) return undefined;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [dropdownOpen]);

  const activeUser = currentUserState || user || {};
  const name =
    activeUser?.fullName ||
    activeUser?.full_name ||
    activeUser?.name ||
    activeUser?.username ||
    "Phūrai";

  const handleOpenEditProfile = () => {
    setDropdownOpen(false);
    setModalInitialView("edit");
    setShowProfileModal(true);
  };

  const handleOpenChangePassword = () => {
    setDropdownOpen(false);
    setModalInitialView("password");
    setShowProfileModal(true);
  };

  const handleProfileSave = (updatedUser) => {
    const nextUser = { ...activeUser, ...updatedUser };
    setCurrentUserState(nextUser);
    if (onSaveProfile) {
      onSaveProfile(nextUser);
    }
  };

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

        <NotificationBell user={activeUser} listenForStaffEvents />

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

        <div className="sfx-header__user-wrapper" ref={dropdownRef}>
          <button
            type="button"
            className="sfx-header__user-btn"
            onClick={() => setDropdownOpen((prev) => !prev)}
            aria-label="User account menu"
            aria-expanded={dropdownOpen}
          >
            <UserAvatar user={activeUser} size="sm" />
            <span className="sfx-header__usermeta">
              <strong>{name}</strong>
              <span className={`sfx-role sfx-role--${role}`}>
                {ROLE_LABEL[role] || role?.toUpperCase() || "User"}
              </span>
            </span>
            <PortalIcon
              name="chevronDown"
              size={14}
              className={`sfx-header__user-chevron ${dropdownOpen ? "is-open" : ""}`}
            />
          </button>

          {dropdownOpen && (
            <div className="sfx-portal-user-dropdown">
              <div className="sfx-portal-user-dropdown__header">
                <UserAvatar user={activeUser} size="md" />
                <div className="sfx-portal-user-dropdown__identity">
                  <p className="sfx-portal-user-dropdown__name">{name}</p>
                  <p className="sfx-portal-user-dropdown__role">
                    {ROLE_LABEL[role] || role?.toUpperCase() || "User"}
                  </p>
                  {activeUser.email ? (
                    <p className="sfx-portal-user-dropdown__email">{activeUser.email}</p>
                  ) : null}
                </div>
              </div>

              <ul className="sfx-portal-user-dropdown__menu">
                <li>
                  <button
                    type="button"
                    className="sfx-portal-user-dropdown__item"
                    onClick={handleOpenEditProfile}
                  >
                    <PortalIcon name="user" size={16} />
                    <span>Chỉnh sửa hồ sơ</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="sfx-portal-user-dropdown__item"
                    onClick={handleOpenChangePassword}
                  >
                    <PortalIcon name="key" size={16} />
                    <span>Đổi mật khẩu</span>
                  </button>
                </li>
                <div className="sfx-portal-user-dropdown__divider" />
                <li>
                  <button
                    type="button"
                    className="sfx-portal-user-dropdown__item sfx-portal-user-dropdown__item--danger"
                    onClick={() => {
                      setDropdownOpen(false);
                      onSignOut?.();
                    }}
                  >
                    <PortalIcon name="logout" size={16} />
                    <span>Đăng xuất</span>
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        user={activeUser}
        onSave={handleProfileSave}
        initialView={modalInitialView}
      />
    </header>
  );
}

export default PortalHeader;
