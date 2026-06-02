import { useEffect, useRef } from "react";
import { getDisplayName } from "../auth/authHelpers";
import UserAvatar from "../auth/UserAvatar";

function ProfileDropdown({
  isOpen,
  onClose,
  currentUser,
  onMyProfile,
  onEditProfile,
  onChangePassword,
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
      if (event.key === "Escape") onClose?.();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const displayName = getDisplayName(currentUser);

  return (
    <div className="profile-dropdown" ref={menuRef}>
      <div className="profile-dropdown__header">
        <UserAvatar
          user={currentUser}
          size="sm"
          imgClassName="profile-dropdown__avatar-img"
        />
        <div>
          <p className="profile-dropdown__name">{displayName}</p>
          <p className="profile-dropdown__username">@{currentUser?.username}</p>
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
          <button type="button" onClick={onEditProfile}>
            Edit Profile
          </button>
        </li>
        <li>
          <button type="button" onClick={onChangePassword}>
            Change Password
          </button>
        </li>
        <li>
          <button type="button" className="profile-dropdown__signout" onClick={onSignOut}>
            Logout
          </button>
        </li>
      </ul>
    </div>
  );
}

export default ProfileDropdown;
