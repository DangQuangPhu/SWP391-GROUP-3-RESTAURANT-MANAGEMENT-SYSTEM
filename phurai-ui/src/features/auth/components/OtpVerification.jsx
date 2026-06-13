import { useEffect, useRef, useState } from "react";
import OtpCodeInput from "./OtpCodeInput";
import {
  verifyOtp,
  requestOtp,
  resendOtp,
  forgotPasswordVerifyOtp,
  forgotPasswordResendOtp,
} from "../services/authApi.js";
import {
  OTP_EXPIRES_IN_SECONDS,
  OTP_RESEND_COOLDOWN_SECONDS,
  applyOtpSentTiming,
  formatOtpExpiry,
  resolveRetryAfterSeconds,
} from "../utils/otpTiming.js";
import "@/styles/OtpCodeInput.css";

const SUCCESS_DELAY_MS = 900;

function OtpVerification({
  user,
  context = "verify-account",
  onVerified,
  onBack,
  initialTiming = null,
}) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [shake, setShake] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(OTP_RESEND_COOLDOWN_SECONDS);
  const [otpExpiresIn, setOtpExpiresIn] = useState(OTP_EXPIRES_IN_SECONDS);
  const [isResending, setIsResending] = useState(false);
  const successTimerRef = useRef(null);
  const hasRequestedOtpRef = useRef(false);

  const isReset = context === "reset-password";
  const title = isReset ? "Verify Reset Code" : "Verify Your Account";
  const email = user?.email || "your email";
  const canResend = resendSeconds === 0 && !isResending;
  const isOtpExpired = otpExpiresIn <= 0;

  useEffect(() => {
    hasRequestedOtpRef.current = false;
    setResendSeconds(OTP_RESEND_COOLDOWN_SECONDS);
    setOtpExpiresIn(OTP_EXPIRES_IN_SECONDS);
    setSuccess(false);
    setShake(false);
    setDigits(["", "", "", "", "", ""]);
    setError("");
    setNotice("");
    setSubmitted(false);
    setIsResending(false);

    if (initialTiming) {
      applyOtpSentTiming(initialTiming, { setOtpExpiresIn, setResendSeconds });
    }
  }, [user?.userId, user?.email, context, initialTiming]);

  useEffect(() => {
    if (isReset || initialTiming) return undefined;
    if (user?.userId === "mock-google-user") return undefined;

    const normalizedEmail = String(user?.email || "").trim().toLowerCase();
    if (!normalizedEmail || normalizedEmail === "your email") return undefined;
    if (hasRequestedOtpRef.current) return undefined;

    hasRequestedOtpRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        const data = await requestOtp({
          email: normalizedEmail,
          purpose: "EMAIL_VERIFY",
        });
        if (cancelled) return;
        applyOtpSentTiming(data, { setOtpExpiresIn, setResendSeconds });
      } catch (err) {
        if (cancelled) return;
        setError(err.message || "Could not send verification code.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.email, user?.userId, context, initialTiming, isReset]);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;

    const timer = setTimeout(() => {
      setResendSeconds((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => clearTimeout(timer);
  }, [resendSeconds]);

  useEffect(() => {
    if (otpExpiresIn <= 0) return undefined;

    const timer = setTimeout(() => {
      setOtpExpiresIn((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => clearTimeout(timer);
  }, [otpExpiresIn]);

  useEffect(() => () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  }, []);

  const triggerShake = () => {
    setShake(true);
    window.setTimeout(() => setShake(false), 520);
  };

  const completeVerification = (payload) => {
    setSuccess(true);
    successTimerRef.current = window.setTimeout(() => {
      onVerified?.(payload);
    }, SUCCESS_DELAY_MS);
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setNotice("");

    if (isOtpExpired) {
      setError("This code has expired. Please request a new code.");
      triggerShake();
      return;
    }

    const code = digits.join("");

    if (!code) {
      setError("Please enter the 6-digit verification code.");
      triggerShake();
      return;
    }
    if (code.length < 6) {
      setError("Please enter all 6 digits.");
      triggerShake();
      return;
    }

    try {
      setLoading(true);
      if (user?.userId === "mock-google-user") {
        await new Promise((resolve) => setTimeout(resolve, 600));
        if (code === "123456") {
          completeVerification({
            ...user,
            verified: true,
            firstName: "Demo",
            lastName: "User",
            username: user.email.split("@")[0],
            avatarSource: "google",
          });
        } else {
          setError("Incorrect verification code. Please try again.");
          triggerShake();
        }
      } else if (isReset) {
        const data = await forgotPasswordVerifyOtp({
          email,
          otp: code,
          purpose: "forgot_password",
          userId: user?.userId,
        });
        completeVerification({
          resetToken: data.resetToken,
          userId: data.userId ?? user.userId,
          email: data.email ?? email,
        });
      } else {
        if (!email || email === "your email") {
          setError("Email is required to verify your account.");
          triggerShake();
          return;
        }

        const data = await verifyOtp({
          email: String(email || "").trim().toLowerCase(),
          otp: code,
          purpose: "EMAIL_VERIFY",
        });
        completeVerification(data.user || user);
      }
    } catch (verificationError) {
      setError(
        verificationError?.message || "Incorrect verification code. Please try again."
      );
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;

    try {
      setIsResending(true);
      setError("");
      setNotice("");

      if (user?.userId === "mock-google-user") {
        await new Promise((resolve) => setTimeout(resolve, 400));
        applyOtpSentTiming(
          { expiresIn: OTP_EXPIRES_IN_SECONDS, resendCooldown: OTP_RESEND_COOLDOWN_SECONDS },
          { setOtpExpiresIn, setResendSeconds }
        );
      } else if (isReset) {
        if (!email || email === "your email") return;
        const data = await forgotPasswordResendOtp({
          email,
          purpose: "forgot_password",
          userId: user?.userId,
        });
        applyOtpSentTiming(data, { setOtpExpiresIn, setResendSeconds });
      } else {
        if (!email || email === "your email") return;
        const data = await resendOtp({
          email: String(email || "").trim().toLowerCase(),
          purpose: "EMAIL_VERIFY",
        });

        if (data.success === false) {
          throw new Error(data.message || "Could not resend OTP.");
        }

        applyOtpSentTiming(data, { setOtpExpiresIn, setResendSeconds });
      }

      setDigits(["", "", "", "", "", ""]);
      setSubmitted(false);
      setNotice("A new verification code has been sent to your email.");
    } catch (err) {
      const retryAfter = resolveRetryAfterSeconds(err.data || {});
      if (err.status === 429) {
        setResendSeconds(retryAfter);
      }
      setError(err.message || "Could not resend OTP.");
      triggerShake();
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className={`auth-otp${success ? " auth-otp--success" : ""}`}>
      <p className="auth-card__brand">Phūrai</p>
      <h2 className="auth-card__title">{title}</h2>
      <p className="auth-card__subtitle">
        Enter the 6-digit code sent to <strong>{email}</strong>
      </p>

      {error ? (
        <p className="auth-field__error auth-otp__error" role="alert">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p className="auth-card__subtitle" role="status">
          {notice}
        </p>
      ) : null}

      {success ? (
        <div className="auth-otp__success" role="status" aria-live="polite">
          <div className="auth-otp__success-icon" aria-hidden="true">
            <svg viewBox="0 0 52 52">
              <circle className="auth-otp__success-circle" cx="26" cy="26" r="25" fill="none" />
              <path className="auth-otp__success-mark" fill="none" d="M14 27l7 7 16-16" />
            </svg>
          </div>
          <p>Verified successfully</p>
        </div>
      ) : (
        <form className="auth-otp__form" onSubmit={handleVerify} noValidate>
          <OtpCodeInput
            idPrefix="auth-otp"
            value={digits}
            onChange={(next) => {
              setDigits(next);
              setError("");
              setNotice("");
            }}
            disabled={loading || isOtpExpired}
            error={Boolean(error && submitted)}
            shake={shake}
          />

          {otpExpiresIn > 0 ? (
            <p className="otp-expiry" aria-live="polite">
              {`This code expires in ${formatOtpExpiry(otpExpiresIn)}`}
            </p>
          ) : (
            <p className="auth-field__error auth-otp__error" role="alert">
              This code has expired. Please request a new code.
            </p>
          )}

          <button
            type="submit"
            className="auth-submit"
            disabled={loading || isOtpExpired}
          >
            {loading ? "VERIFYING..." : "VERIFY OTP"}
          </button>

          {resendSeconds > 0 ? (
            <p className="otp-countdown" aria-live="polite">
              {`You can request a new code in ${resendSeconds}s`}
            </p>
          ) : (
            <button
              type="button"
              className="otp-resend-button auth-form__link auth-otp__resend"
              onClick={handleResendOtp}
              disabled={isResending || loading}
            >
              {isResending ? "Sending..." : "Resend Code"}
            </button>
          )}

          <button type="button" className="auth-form__link auth-otp__back" onClick={onBack}>
            Back
          </button>
        </form>
      )}
    </div>
  );
}

export default OtpVerification;
