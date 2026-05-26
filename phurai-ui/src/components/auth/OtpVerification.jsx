import { useEffect, useRef, useState } from "react";
import { DEMO_OTP } from "./authHelpers";

function OtpVerification({ onVerified, onBack }) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const updateDigit = (index, value) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError("");

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
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
    const focusIndex = Math.min(pasted.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleVerify = (event) => {
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

    if (code !== DEMO_OTP) {
      setError("Incorrect verification code. Please try again.");
      return;
    }

    onVerified?.();
  };

  const handleResend = () => {
    setDigits(["", "", "", "", "", ""]);
    setError("");
    setSubmitted(false);
    inputRefs.current[0]?.focus();
  };

  return (
    <div className="auth-otp">
      <p className="auth-card__brand">Phūrai</p>
      <h2 className="auth-card__title">Verify Your Account</h2>
      <p className="auth-card__subtitle">
        Enter the 6-digit verification code sent to your email or phone.
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

        <button type="submit" className="auth-submit">
          VERIFY
        </button>

        <button type="button" className="auth-form__link auth-otp__resend" onClick={handleResend}>
          Resend Code
        </button>

        <button type="button" className="auth-form__link auth-otp__back" onClick={onBack}>
          Back to Login
        </button>
      </form>
    </div>
  );
}

export default OtpVerification;
