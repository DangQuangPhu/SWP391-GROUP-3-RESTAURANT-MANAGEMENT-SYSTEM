import { useEffect } from "react";
import { createPortal } from "react-dom";
import AuthCard from "./AuthCard";
import OtpVerification from "./OtpVerification";
import "../../styles/authModal.css";

function AuthModal({
  isOpen,
  showOtp,
  onClose,
  onProceedToOtp,
  onGoogleAuthenticated,
  onOtpVerified,
  onOtpBack,
  pendingAuthUser,
}) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="auth-modal" role="presentation">
      <div className="auth-modal__overlay" onClick={onClose} aria-hidden="true" />
      <div
        className={`auth-modal__dialog${!showOtp ? " auth-modal__dialog--wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={showOtp ? "OTP verification" : "Authentication"}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="auth-modal__close"
          onClick={onClose}
          aria-label="Close authentication modal"
        >
          <span aria-hidden="true">&times;</span>
        </button>
        {showOtp ? (
          <OtpVerification
            user={pendingAuthUser}
            onVerified={onOtpVerified}
            onBack={onOtpBack}
          />
        ) : (
          <AuthCard
            onProceedToOtp={onProceedToOtp}
            onGoogleAuthenticated={onGoogleAuthenticated}
          />
        )}
      </div>
    </div>,
    document.body
  );
}

export default AuthModal;
