import { createPortal } from "react-dom";
import { getDisplayName } from "./authHelpers";

function AuthSuccessOverlay({ isVisible, user, fading = false }) {
  if (!isVisible) {
    return null;
  }

  const name = getDisplayName(user);

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
          Welcome <span className="auth-welcome__name">{name}</span> to Phūrai
        </p>
      </div>
    </div>,
    document.body
  );
}

export default AuthSuccessOverlay;
