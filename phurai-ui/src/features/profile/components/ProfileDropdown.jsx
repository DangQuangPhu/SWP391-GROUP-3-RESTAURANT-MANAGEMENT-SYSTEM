import { useEffect, useRef, useState } from "react";
import { getDisplayName, UserAvatar } from "@/features/auth";
import AccountSwitchOverlay from "./AccountSwitchOverlay";
import StatusModal from "./StatusModal";
import "@/styles/profile.css";
import "@/styles/AccountDropdown.css";

function SwitchAccountIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M4 7h12M4 7l3-3M4 7l3 3M16 13H4M16 13l-3-3M16 13l-3 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M7 8.5h.01M13 8.5h.01M7.5 13c1 1 4 1 5 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
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

function SettingsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 2.5v2M10 15.5v2M4.5 10h-2M17.5 10h-2M6.05 6.05l-1.41-1.41M15.36 15.36l-1.41-1.41M6.05 13.95l-1.41 1.41M15.36 4.64l-1.41 1.41"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PasswordIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="4" y="9" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 9V7a3 3 0 116 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
  onSettings,
  onChangePassword,
  onSignOut,
  onSaveStatus,
  onClearStatus,
  onOpenAuth,
}) {
  const menuRef = useRef(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showSwitchOverlay, setShowSwitchOverlay] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setShowStatusModal(false);
      setShowSwitchOverlay(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleClickOutside = (event) => {
      if (showStatusModal || showSwitchOverlay) return;
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        onClose?.();
      }
    };

    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      if (showStatusModal) {
        setShowStatusModal(false);
        return;
      }
      if (showSwitchOverlay) {
        setShowSwitchOverlay(false);
        return;
      }
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
  }, [isOpen, onClose, showStatusModal, showSwitchOverlay]);

  if (!isOpen) return null;

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

  const statusLabel = status?.text
    ? `${status.emoji ? `${status.emoji} ` : ""}${status.text}`
    : null;

  const closeAnd = (fn) => () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    onClose?.();
    fn?.();
  };

  return (
    <>
      <div className="profile-dropdown account-dropdown" ref={menuRef}>
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
          <button
            type="button"
            className="account-dropdown__switch-btn"
            aria-label="Switch account"
            onClick={() => setShowSwitchOverlay(true)}
          >
            <SwitchAccountIcon />
          </button>
        </div>

        <ul className="profile-dropdown__menu account-dropdown__menu">
          <li>
            <button
              type="button"
              className="account-dropdown__item"
              onClick={() => setShowStatusModal(true)}
            >
              <span className="account-dropdown__item-icon">
                <StatusIcon />
              </span>
              {statusLabel || "Set status"}
            </button>
          </li>
          <li>
            <button type="button" className="account-dropdown__item" onClick={closeAnd(onMyProfile)}>
              <span className="account-dropdown__item-icon">
                <ProfileIcon />
              </span>
              My Profile
            </button>
          </li>
          <li>
            <button
              type="button"
              className="account-dropdown__item"
              onClick={closeAnd(onMyReservations)}
            >
              <span className="account-dropdown__item-icon">
                <ReservationsIcon />
              </span>
              My Reservations
            </button>
          </li>
          <li>
            <button type="button" className="account-dropdown__item" onClick={closeAnd(onSettings)}>
              <span className="account-dropdown__item-icon">
                <SettingsIcon />
              </span>
              Settings
            </button>
          </li>
          <li>
            <button
              type="button"
              className="account-dropdown__item"
              onClick={closeAnd(onChangePassword)}
            >
              <span className="account-dropdown__item-icon">
                <PasswordIcon />
              </span>
              Change Password
            </button>
          </li>
          <li>
            <button
              type="button"
              className="profile-dropdown__signout account-dropdown__item"
              onClick={closeAnd(onSignOut)}
            >
              Logout
            </button>
          </li>
        </ul>
      </div>

      <StatusModal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        status={status}
        onSave={onSaveStatus}
        onClear={onClearStatus}
      />

      <AccountSwitchOverlay
        isOpen={showSwitchOverlay}
        onClose={onClose}
        onBack={() => setShowSwitchOverlay(false)}
        currentUser={avatarUser}
        onSignOut={onSignOut}
        onAddAccount={onOpenAuth}
      />
    </>
  );
}

export default ProfileDropdown;
