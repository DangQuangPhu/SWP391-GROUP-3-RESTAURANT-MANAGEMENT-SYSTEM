import { useEffect, useRef, useState } from "react";
import {
  verifyOtp,
  resendVerificationCode,
  forgotPasswordVerifyOtp,
  forgotPasswordResendOtp,
} from "./api";

const COOLDOWN_SECONDS = 30;
const SUCCESS_DELAY_MS = 900;

function OtpVerification({
  user,
  context = "verify-account",
  onVerified,
  onBack,
}) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [shake, setShake] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [cooldown, setCooldown] = useState(COOLDOWN_SECONDS);
  const inputRefs = useRef([]);
  const successTimerRef = useRef(null);

  const isReset = context === "reset-password";
  const title = isReset ? "Verify Reset Code" : "Verify Your Account";
  const email = user?.email || "your email";

  useEffect(() => {
    inputRefs.current[0]?.focus();
    setCooldown(COOLDOWN_SECONDS);
    setSuccess(false);
    setShake(false);
    setDigits(["", "", "", "", "", ""]);
    setError("");
    setSubmitted(false);
  }, [user?.userId, context]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

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

  const updateDigit = (index, value) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError("");
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
      setActiveIndex(index + 1);
    }
  };

  const handleFocus = (index) => setActiveIndex(index);

  const handleKeyDown = (index, event) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      setActiveIndex(index - 1);
    }
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = ["", "", "", "", "", ""];
    pasted.split("").forEach((char, index) => {
      next[index] = char;
    });
    setDigits(next);
    setError("");
    const focusIndex = Math.min(pasted.length, 5);
    inputRefs.current[focusIndex]?.focus();
    setActiveIndex(focusIndex);
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    setSubmitted(true);
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
        // TODO: Replace mock OTP with backend verify-otp when Google mock flow is wired to API.
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
          userId: user.userId,
          otp: code,
        });
        completeVerification({
          resetToken: data.resetToken,
          userId: data.userId ?? user.userId,
        });
      } else {
        const data = await verifyOtp({ userId: user.userId, otp: code });
        completeVerification(data.user);
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

  const handleResend = async () => {
    if (cooldown > 0 || !user?.userId) return;
    setError("");
    try {
      if (user?.userId === "mock-google-user") {
        await new Promise((resolve) => setTimeout(resolve, 400));
      } else if (isReset) {
        await forgotPasswordResendOtp(user.userId);
      } else {
        await resendVerificationCode(user.userId);
      }
      setDigits(["", "", "", "", "", ""]);
      setSubmitted(false);
      setCooldown(COOLDOWN_SECONDS);
      inputRefs.current[0]?.focus();
      setActiveIndex(0);
    } catch (err) {
      if (err.status === 429 && err.data?.retryAfterSeconds) {
        setCooldown(err.data.retryAfterSeconds);
      }
      setError(err.message || "Could not resend code.");
      triggerShake();
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
          <div
            className={`auth-otp__inputs${shake ? " auth-otp__inputs--shake" : ""}`}
            onPaste={handlePaste}
          >
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                className={`auth-otp__input${
                  error && submitted ? " auth-otp__input--error" : ""
                }${activeIndex === index ? " auth-otp__input--active" : ""}`}
                value={digit}
                onChange={(event) => updateDigit(index, event.target.value)}
                onFocus={() => handleFocus(index)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                aria-label={`Digit ${index + 1}`}
                disabled={loading}
              />
            ))}
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? "VERIFYING..." : "VERIFY OTP"}
          </button>

          <button
            type="button"
            className="auth-form__link auth-otp__resend"
            onClick={handleResend}
            disabled={cooldown > 0 || loading}
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend OTP"}
          </button>

          <button type="button" className="auth-form__link auth-otp__back" onClick={onBack}>
            Back
          </button>
        </form>
      )}
    </div>
  );
}

export default OtpVerification;
