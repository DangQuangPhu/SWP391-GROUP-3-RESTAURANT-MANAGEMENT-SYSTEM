import { useEffect, useRef } from "react";
import { getInitials } from "../auth/authHelpers";

function ProfileDropdown({
  isOpen,
  onClose,
  currentUser,
  onMyProfile,
  onSignOut,
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose?.();
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const initials = getInitials(currentUser);

  return (
    <div className="profile-dropdown" ref={menuRef}>
      <div className="profile-dropdown__header">
        <span className="profile-dropdown__avatar">{initials}</span>
        <div>
          <p className="profile-dropdown__name">{currentUser?.fullName}</p>
          <p className="profile-dropdown__email">{currentUser?.email}</p>
        </div>
      </div>
      <ul className="profile-dropdown__menu">
        <li>
          <button type="button" onClick={onMyProfile}>
            My Profile
          </button>
        </li>
        <li>
          <button type="button">Reservations</button>
        </li>
        <li>
          <button type="button">Favorites</button>
        </li>
        <li>
          <button type="button">Account Settings</button>
        </li>
        <li>
          <button type="button" className="profile-dropdown__signout" onClick={onSignOut}>
            Sign Out
          </button>
        </li>
      </ul>
    </div>
  );
}

export default ProfileDropdown;
