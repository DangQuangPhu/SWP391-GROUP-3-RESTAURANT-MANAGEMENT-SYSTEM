import { createPortal } from "react-dom";
import { getDisplayName } from "./authHelpers";

function WelcomeOverlay({ isVisible, user, fading = false }) {
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
        <p className="auth-welcome__line">Welcome, {name}</p>
        <p className="auth-welcome__line auth-welcome__line--brand">to Phūrai</p>
      </div>
    </div>,
    document.body
  );
}

export default WelcomeOverlay;
