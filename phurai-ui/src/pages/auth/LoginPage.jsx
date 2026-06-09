import { useEffect, useState } from "react";
import { homeImages } from "@/data/homeAssets";
import AuthCard from "@/components/auth/AuthCard";
import OtpVerification from "@/components/auth/OtpVerification";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import "@/styles/loginPage.css";

const VIEWS = {
  AUTH: "auth",
  OTP: "otp",
  FORGOT: "forgot",
  RESET: "reset",
};

function LoginPage({
  isAuthenticated,
  onAuthSuccess,
  onNavigateHome,
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
    if (isAuthenticated) {
      onNavigateHome?.();
    }
  }, [isAuthenticated, onNavigateHome]);

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

  let content;
  if (view === VIEWS.OTP) {
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

  return (
    <main className="login-page">
      <div
        className="login-page__bg"
        style={{ backgroundImage: `url(${homeImages.hero})` }}
        aria-hidden="true"
      />
      <div className="login-page__overlay" aria-hidden="true" />

      <div className={`login-page__inner${view === VIEWS.AUTH ? " login-page__inner--auth" : ""}`}>
        <button type="button" className="login-page__back" onClick={onNavigateHome}>
          ← Back to Home
        </button>

        {isAuthenticated ? (
          <div className="login-page__card login-page__card--glass">
            <p className="auth-card__brand">Phūrai</p>
            <p className="auth-card__subtitle">You are already signed in.</p>
            <button type="button" className="auth-submit" onClick={onNavigateHome}>
              Go to Home
            </button>
          </div>
        ) : (
          <div className={`login-page__card login-page__card--glass${view === VIEWS.AUTH ? " login-page__card--auth" : ""}`}>{content}</div>
        )}
      </div>
    </main>
  );
}

export default LoginPage;
