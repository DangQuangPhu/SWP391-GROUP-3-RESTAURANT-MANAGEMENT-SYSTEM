import { createPortal } from "react-dom";
import { getDisplayName } from "../utils/authHelpers.js";

function AuthSuccessOverlay({ isVisible, user, fading = false }) {
  if (!isVisible) {
    return null;
  }
  const displayName = getDisplayName(user);
  
  // Decide whether to show "Welcome" or "Welcome Back," based on lastLoginAt.
  const isFirstLogin = !user?.lastLoginAt;
  const greetingPrefix = isFirstLogin ? "Welcome" : "Welcome Back,";

  // Check if it is a staff/manager/admin account (Roles 2, 3, 4)
  const isStaffAccount = user?.roleId === 2 || user?.roleId === 3 || user?.roleId === 4;
  let rolePrefix = "";
  if (isStaffAccount && user?.roleName) {
    rolePrefix = user.roleName === "Restaurant Staff" ? "Staff " : `${user.roleName} `;
  }

  return createPortal(
    <div
      className={`auth-welcome${fading ? " auth-welcome--fade-out" : ""}`}
      role="dialog"
      aria-live="polite"
      aria-label="Welcome"
    >
      <div className="auth-welcome__backdrop" aria-hidden="true" />
      <div className="auth-welcome__content">
        <div className="auth-welcome__check" aria-hidden="true">
          <svg viewBox="0 0 52 52">
            <circle className="auth-welcome__check-circle" cx="26" cy="26" r="25" fill="none" />
            <path className="auth-welcome__check-mark" fill="none" d="M14 27l7 7 16-16" />
          </svg>
        </div>
        <p className="auth-welcome__line">
          {greetingPrefix} <span className="auth-welcome__name">{rolePrefix}{displayName}</span> to <span className="auth-welcome__logo">Phūrai</span>
        </p>
      </div>
    </div>,
    document.body
  );
}

export default AuthSuccessOverlay;
