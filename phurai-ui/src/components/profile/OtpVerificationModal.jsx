import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import OtpCodeInput from "@/components/auth/OtpCodeInput";
import { formatOtpExpiry } from "@/utils/otpTiming";
import "@/styles/OtpCodeInput.css";
import "@/styles/profile.css";
import "@/styles/auth.css";

const EMPTY_DIGITS = ["", "", "", "", "", ""];

function mapOtpVerifyError(err) {
  const message = String(err?.message || "").trim();
  const lower = message.toLowerCase();

  if (lower.includes("expired")) {
    return "OTP expired. Please request a new code.";
  }
  if (lower.includes("invalid") || lower.includes("incorrect")) {
    return "Invalid OTP code. Please try again.";
  }
  if (message === "Validation failed." || lower.includes("validation failed")) {
    return "Invalid OTP code. Please try again.";
  }
  if (lower.includes("date of birth") || lower.includes("first name is required")) {
    return "Could not verify OTP. Please try again.";
  }
  if (lower.includes("no active otp")) {
    return "No active code found. Please request a new one.";
  }

  return message || "Could not verify OTP. Please try again.";
}

function OtpVerificationModal({
  isOpen,
  onClose,
  title = "Verify Your Account",
  subtitle,
  onVerify,
  onResend,
  resendSeconds = 0,
  otpExpiresIn = 0,
  isResending = false,
}) {
  const [digits, setDigits] = useState(EMPTY_DIGITS);
  const [phase, setPhase] = useState("input");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setDigits(EMPTY_DIGITS);
    setPhase("input");
    setError("");
    setShake(false);
    setVerifying(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isOtpExpired = otpExpiresIn <= 0;
  const canResend = resendSeconds === 0 && !isResending;

  const triggerShake = () => {
    setShake(true);
    window.setTimeout(() => setShake(false), 520);
  };

  const handleVerify = async (event) => {
    event.preventDefault();

    if (isOtpExpired) {
      setError("This code has expired. Please request a new code.");
      triggerShake();
      return;
    }

    const code = digits.join("");
    if (code.length < 6) {
      setError("Please enter all 6 digits.");
      triggerShake();
      return;
    }

    try {
      setVerifying(true);
      setPhase("verifying");
      setError("");
      await onVerify?.(code);
      setPhase("success");
      window.setTimeout(() => {
        onClose?.({ success: true });
      }, 2000);
    } catch (err) {
      const friendlyError = mapOtpVerifyError(err);
      setPhase("error");
      setError(friendlyError);
      triggerShake();
      window.setTimeout(() => {
        setPhase("input");
        setDigits(EMPTY_DIGITS);
        setError("");
      }, 2000);
    } finally {
      setVerifying(false);
    }
  };

  const modal = (
    <div
      className="profile-otp-modal profile-otp-modal-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-otp-title"
    >
      <button
        type="button"
        className="profile-otp-modal__backdrop profile-otp-backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="profile-otp-modal__card profile-otp-card">
        <h2 id="profile-otp-title" className="profile-otp-modal__title">
          {title}
        </h2>
        {subtitle ? <p className="profile-otp-modal__subtitle">{subtitle}</p> : null}

        {phase === "success" ? (
          <div className="auth-otp__success profile-otp-modal__result" role="status" aria-live="polite">
            <div className="auth-otp__success-icon" aria-hidden="true">
              <svg viewBox="0 0 52 52">
                <circle className="auth-otp__success-circle" cx="26" cy="26" r="25" fill="none" />
                <path className="auth-otp__success-mark" fill="none" d="M14 27l7 7 16-16" />
              </svg>
            </div>
            <p>Verified successfully.</p>
          </div>
        ) : null}

        {phase === "error" ? (
          <div className="profile-otp-modal__result profile-otp-modal__result--error" role="alert">
            <div className="profile-otp-modal__error-icon" aria-hidden="true">
              <svg viewBox="0 0 52 52">
                <circle className="profile-otp-modal__error-circle" cx="26" cy="26" r="25" fill="none" />
                <path className="profile-otp-modal__error-mark" fill="none" d="M16 16l20 20M36 16L16 36" />
              </svg>
            </div>
            <p>{error || "Invalid OTP code. Please try again."}</p>
          </div>
        ) : null}

        {phase === "verifying" ? (
          <div className="profile-otp-modal__result profile-otp-modal__result--verifying" role="status" aria-live="polite">
            <p>Verifying…</p>
          </div>
        ) : null}

        {phase === "input" ? (
          <form className="profile-otp-modal__form" onSubmit={handleVerify} noValidate>
            <OtpCodeInput
              idPrefix="profile-otp-modal"
              value={digits}
              onChange={(next) => {
                setDigits(next);
                setError("");
              }}
              disabled={verifying || isOtpExpired}
              error={Boolean(error)}
              shake={shake}
            />

            {otpExpiresIn > 0 ? (
              <p className="otp-expiry" aria-live="polite">
                {`This code expires in ${formatOtpExpiry(otpExpiresIn)}`}
              </p>
            ) : (
              <p className="profile-otp-modal__error-text" role="alert">
                This code has expired. Please request a new code.
              </p>
            )}

            {error ? (
              <p className="profile-otp-modal__error-text" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="profile-dashboard__btn profile-dashboard__btn--primary profile-otp-modal__submit"
              disabled={verifying || isOtpExpired}
            >
              {verifying ? "Verifying…" : "Verify OTP"}
            </button>

            {resendSeconds > 0 ? (
              <p className="otp-countdown" aria-live="polite">
                {`You can request a new code in ${resendSeconds}s`}
              </p>
            ) : (
              <button
                type="button"
                className="otp-resend-button"
                onClick={onResend}
                disabled={!canResend || verifying}
              >
                {isResending ? "Sending…" : "Resend Code"}
              </button>
            )}

            <button type="button" className="profile-otp-modal__cancel" onClick={onClose}>
              Cancel
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export default OtpVerificationModal;
