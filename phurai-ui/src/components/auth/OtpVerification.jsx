import { useEffect, useRef, useState } from "react";
import {
  verifyOtp,
  resendVerificationCode,
  forgotPasswordVerifyOtp,
  forgotPasswordResendOtp,
} from "./api";

const COOLDOWN_SECONDS = 30;

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
  const [cooldown, setCooldown] = useState(COOLDOWN_SECONDS);
  const inputRefs = useRef([]);

  const isReset = context === "reset-password";
  const title = isReset ? "Verify Reset Code" : "Verify Your Account";
  const email = user?.email || "your email";

  useEffect(() => {
    inputRefs.current[0]?.focus();
    setCooldown(COOLDOWN_SECONDS);
  }, [user?.userId, context]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const updateDigit = (index, value) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError("");
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, event) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
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
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    const code = digits.join("");

    if (!code) {
      setError("Please enter the 6-digit verification code.");
      return;
    }
    if (code.length < 6) {
      setError("Please enter all 6 digits.");
      return;
    }

    try {
      setLoading(true);
      if (user?.userId === "mock-google-user") {
        await new Promise((resolve) => setTimeout(resolve, 800)); // fake delay
        if (cooldown === 0) {
          setError("This code has expired. Please request a new code.");
        } else if (code === "123456") {
          onVerified?.({
             ...user,
             verified: true,
             firstName: "Demo",
             lastName: "User",
             username: user.email.split("@")[0],
             googleAvatarUrl: "https://lh3.googleusercontent.com/a/ACg8ocKw59f3P0J3E6rF8L0QeH4J8z8E9jB0aO9uY2Y3w8s=s96-c",
             avatarUrl: "https://lh3.googleusercontent.com/a/ACg8ocKw59f3P0J3E6rF8L0QeH4J8z8E9jB0aO9uY2Y3w8s=s96-c",
             avatarSource: "google"
          });
        } else {
          setError("Incorrect OTP");
        }
      } else if (isReset) {
        const data = await forgotPasswordVerifyOtp({
          userId: user.userId,
          otp: code,
        });
        onVerified?.({
          resetToken: data.resetToken,
          userId: data.userId ?? user.userId,
        });
      } else {
        const data = await verifyOtp({ userId: user.userId, otp: code });
        onVerified?.(data.user);
      }
    } catch (verificationError) {
      setError(
        verificationError?.message || "Incorrect verification code. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || !user?.userId) return;
    setError("");
    try {
      if (user?.userId === "mock-google-user") {
        await new Promise((resolve) => setTimeout(resolve, 500)); // fake delay
      } else if (isReset) {
        await forgotPasswordResendOtp(user.userId);
      } else {
        await resendVerificationCode(user.userId);
      }
      setDigits(["", "", "", "", "", ""]);
      setSubmitted(false);
      setCooldown(COOLDOWN_SECONDS);
      inputRefs.current[0]?.focus();
    } catch (err) {
      if (err.status === 429 && err.data?.retryAfterSeconds) {
        setCooldown(err.data.retryAfterSeconds);
      }
      setError(err.message || "Could not resend code.");
    }
  };

  return (
    <div className="auth-otp">
      <p className="auth-card__brand">Phūrai</p>
      <h2 className="auth-card__title">{title}</h2>
      <p className="auth-card__subtitle">
        Enter the 6-digit code sent to <strong>{email}</strong>
      </p>

      {error ? (
        <div className="auth-alert auth-alert--error" role="alert">
          {error}
        </div>
      ) : null}

      <form className="auth-otp__form" onSubmit={handleVerify} noValidate>
        <div className="auth-otp__inputs" onPaste={handlePaste}>
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              className={`auth-otp__input${error && submitted ? " auth-otp__input--error" : ""}`}
              value={digit}
              onChange={(event) => updateDigit(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              aria-label={`Digit ${index + 1}`}
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
          disabled={cooldown > 0}
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend OTP"}
        </button>

        <button type="button" className="auth-form__link auth-otp__back" onClick={onBack}>
          Back
        </button>
      </form>
    </div>
  );
}

export default OtpVerification;
