import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import AuthCard from "./AuthCard";
import OtpVerification from "./OtpVerification";
import ForgotPasswordForm from "./ForgotPasswordForm";
import ResetPasswordForm from "./ResetPasswordForm";
import { blurActiveElement } from "../utils/authHelpers.js";
import "@/styles/auth.css";
import "@/styles/authModal.css";

const VIEWS = {
  AUTH: "auth",
  OTP: "otp",
  FORGOT: "forgot",
  RESET: "reset",
};

function AuthModal({
  isOpen,
  onClose,
  isAuthenticated,
  onAuthSuccess,
  initialMode = "login",
  successMessage: externalSuccessMessage = "",
  onClearSuccess,
}) {
  const [view, setView] = useState(VIEWS.AUTH);
  const [pendingUser, setPendingUser] = useState(null);
  const [resetSession, setResetSession] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (externalSuccessMessage) {
      setSuccessMessage(externalSuccessMessage);
    }
  }, [externalSuccessMessage]);

  useEffect(() => {
    if (!isOpen) {
      setView(VIEWS.AUTH);
      setPendingUser(null);
      setResetSession(null);
      return;
    }
    setView(VIEWS.AUTH);
  }, [isOpen, initialMode]);

  useEffect(() => {
    if (!isOpen) return undefined;

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

  const handleProceedToOtp = (user) => {
    setPendingUser(user);
    setView(VIEWS.OTP);
  };

  const handleOtpVerified = (result) => {
    if (pendingUser?.verificationMode === "reset-password") {
      setResetSession({
        userId: pendingUser.userId,
        resetToken: result.resetToken,
        email: result.email ?? pendingUser.email,
      });
      setView(VIEWS.RESET);
      return;
    }
    onAuthSuccess?.(result, { showWelcome: true });
  };

  const handleForgotOtp = (user) => {
    setPendingUser(user);
    setView(VIEWS.RESET);
  };

  const handleResetSuccess = () => {
    setSuccessMessage("Password reset successfully. Please sign in.");
    setView(VIEWS.AUTH);
    setPendingUser(null);
    setResetSession(null);
  };

  const isWideView = view === VIEWS.AUTH;

  let content;
  if (isAuthenticated) {
    content = (
      <div className="auth-modal__signed-in">
        <p className="auth-card__brand">Phūrai</p>
        <p className="auth-card__subtitle">You are already signed in.</p>
        <button type="button" className="auth-submit" onClick={onClose}>
          Continue Browsing
        </button>
      </div>
    );
  } else if (view === VIEWS.OTP) {
    content = (
      <OtpVerification
        user={pendingUser}
        context={
          pendingUser?.verificationMode === "reset-password"
            ? "reset-password"
            : "verify-account"
        }
        initialTiming={pendingUser?.initialTiming}
        onVerified={handleOtpVerified}
        onBack={() => {
          if (pendingUser?.verificationMode === "reset-password") {
            setView(VIEWS.FORGOT);
          } else {
            setView(VIEWS.AUTH);
          }
        }}
      />
    );
  } else if (view === VIEWS.FORGOT) {
    content = (
      <ForgotPasswordForm
        onOtpSent={handleForgotOtp}
        onBack={() => setView(VIEWS.AUTH)}
      />
    );
  } else if (view === VIEWS.RESET && pendingUser?.email) {
    content = (
      <ResetPasswordForm
        email={pendingUser.email}
        onSuccess={handleResetSuccess}
        onBack={() => setView(VIEWS.FORGOT)}
      />
    );
  } else if (view === VIEWS.RESET && resetSession) {
    content = (
      <ResetPasswordForm
        email={resetSession.email}
        onSuccess={handleResetSuccess}
        onBack={() => setView(VIEWS.FORGOT)}
      />
    );
  } else {
    content = (
      <AuthCard
        initialMode={initialMode}
        successMessage={successMessage}
        onClearSuccess={() => {
          setSuccessMessage("");
          onClearSuccess?.();
        }}
        onProceedToOtp={handleProceedToOtp}
        onAuthSuccess={onAuthSuccess}
        onForgotPassword={() => setView(VIEWS.FORGOT)}
      />
    );
  }

  return createPortal(
    <div className="auth-modal auth-modal--open" role="presentation">
      <div className="auth-modal__overlay" onClick={onClose} aria-hidden="true" />
      <div
        className={`auth-modal__dialog${isWideView ? " auth-modal__dialog--wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={
          view === VIEWS.OTP
            ? "OTP verification"
            : view === VIEWS.FORGOT
            ? "Forgot password"
            : view === VIEWS.RESET
            ? "Reset password"
            : "Sign in or create account"
        }
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
        {content}
      </div>
    </div>,
    document.body
  );
}

export default AuthModal;
