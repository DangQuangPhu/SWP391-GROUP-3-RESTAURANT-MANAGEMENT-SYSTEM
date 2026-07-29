import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDisplayName, UserAvatar } from "@/features/auth";

import "@/features/profile/styles/profile.css";
import "@/features/profile/styles/AccountDropdown.css";

function PortalIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function getPortalInfo(user) {
  if (!user) return null;
  const roleId = Number(user.roleId ?? user.role_id);
  const roleName = String(user.roleName ?? user.role_name ?? user.role ?? "").trim().toLowerCase();

  if (roleId === 4 || roleId === 5 || roleName === "admin") {
    return { path: "/admin", label: "Admin Portal", roleLabel: "Administrator" };
  }
  if (roleId === 3 || roleName === "manager" || roleName === "restaurant manager") {
    return { path: "/manager/dashboard", label: "Manager Portal", roleLabel: "Restaurant Manager" };
  }
  if (roleId === 2 || roleName === "restaurant staff" || roleName.includes("staff") || roleName.includes("kitchen")) {
    return { path: "/staff", label: "Staff Dashboard", roleLabel: "Restaurant Staff" };
  }
  return null;
}


function ProfileIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M4 17c0-3.314 2.686-6 6-6s6 2.686 6 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ReservationsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="4.5" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M3 8h14M7 3v3M13 3v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function QrTableIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="10" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="10" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 11h2v2h-2zM14 14h3v3h-3zM11 14h2v2h-2zM14 11h3v2h-3z" fill="currentColor" />
    </svg>
  );
}

function FavoritesIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M5 4.5C5 3.67 5.67 3 6.5 3h7C14.33 3 15 3.67 15 4.5v12.25l-4.5-2.5L6 16.75V4.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProfileDropdown({
  isOpen,
  onClose,
  currentUser,
  status,
  onMyProfile,
  onMyReservations,
  onMyFavorites,
  onViewQrTable,
  onSignOut,
  onOpenAuth,
}) {
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setIsAnimatingOut(false);
    } else if (isRendered) {
      setIsAnimatingOut(true);
      const timer = setTimeout(() => {
        setIsRendered(false);
        setIsAnimatingOut(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isRendered]);


  useEffect(() => {
    if (!isOpen) return undefined;

    const handleClickOutside = (event) => {
      if (event.target.closest('.phurai-navbar__avatar-btn')) return;
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        onClose?.();
      }
    };

    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      onClose?.();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isRendered) return null;

  const user = currentUser || {};
  const displayName =
    user?.fullName ||
    user?.name ||
    getDisplayName(user) ||
    user?.username ||
    "User";
  const username = user?.username || user?.handle || "guest";
  const email = user?.email || "";
  const avatarUser = {
    ...user,
    avatarUrl: user?.avatarUrl || user?.photoURL || user?.picture || "",
  };

  const portalInfo = getPortalInfo(user);

  const closeAnd = (fn) => () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    onClose?.();
    fn?.();
  };

  return (
      <div
        className={`profile-dropdown account-dropdown ${isAnimatingOut ? "is-closing" : "is-opening"
          }`}
        ref={menuRef}
      >
        <div className="profile-dropdown__header account-dropdown__header">
          <UserAvatar
            user={avatarUser}
            size="sm"
            imgClassName="profile-dropdown__avatar-img"
          />
          <div className="account-dropdown__identity">
            <p className="profile-dropdown__name">{displayName}</p>
            <p className="profile-dropdown__username">@{username}</p>
            {email ? <p className="profile-dropdown__email">{email}</p> : null}
          </div>
        </div>

        <ul className="profile-dropdown__menu account-dropdown__menu">
          {portalInfo ? (
            <li style={{ "--anim-delay": "1" }}>
              <button
                type="button"
                className="account-dropdown__item"
                style={{
                  background: "rgba(184, 163, 121, 0.18)",
                  color: "#ffd064",
                  fontWeight: "600",
                  borderRadius: "8px",
                  marginBottom: "6px",
                  border: "1px solid rgba(255, 208, 100, 0.3)"
                }}
                onClick={closeAnd(() => navigate(portalInfo.path))}
              >
                <span className="account-dropdown__item-icon" style={{ color: "#ffd064" }}>
                  <PortalIcon />
                </span>
                <span className="account-dropdown__item-text" style={{ color: "#ffd064", fontWeight: 600 }}>
                  {portalInfo.label}
                </span>
              </button>
            </li>
          ) : null}
          <li style={{ "--anim-delay": "1" }}>
            <button type="button" className="account-dropdown__item" onClick={closeAnd(onMyProfile)}>
              <span className="account-dropdown__item-icon">
                <ProfileIcon />
              </span>
              <span className="account-dropdown__item-text">My Profile</span>
            </button>
          </li>
          <li style={{ "--anim-delay": "2" }}>
            <button
              type="button"
              className="account-dropdown__item"
              onClick={closeAnd(onMyReservations)}
            >
              <span className="account-dropdown__item-icon">
                <ReservationsIcon />
              </span>
              <span className="account-dropdown__item-text">My Reservations</span>
            </button>
          </li>
          <li style={{ "--anim-delay": "3" }}>
            <button
              type="button"
              className="account-dropdown__item"
              onClick={closeAnd(onMyFavorites)}
            >
              <span className="account-dropdown__item-icon">
                <FavoritesIcon />
              </span>
              <span className="account-dropdown__item-text">My Favorites</span>
            </button>
          </li>
          {onViewQrTable ? (
            <li style={{ "--anim-delay": "4" }}>
              <button
                type="button"
                className="account-dropdown__item"
                onClick={closeAnd(onViewQrTable)}
              >
                <span className="account-dropdown__item-icon">
                  <QrTableIcon />
                </span>
                <span className="account-dropdown__item-text">View QR Table</span>
              </button>
            </li>
          ) : null}
          <li style={{ "--anim-delay": onViewQrTable ? "5" : "4" }}>
            <button
              type="button"
              className="profile-dropdown__signout account-dropdown__item"
              onClick={closeAnd(onSignOut)}
            >
              <span className="account-dropdown__item-text">Sign out</span>
            </button>
          </li>
        </ul>
      </div>





      );
}

      export default ProfileDropdown;
