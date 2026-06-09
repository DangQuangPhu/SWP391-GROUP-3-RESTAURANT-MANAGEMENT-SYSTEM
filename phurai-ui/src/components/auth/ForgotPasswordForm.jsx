import { useState } from "react";
import { isValidEmail } from "@/utils/authHelpers";
import { forgotPasswordRequestOtp } from "@/api/authApi";
import { buildInitialTiming } from "@/utils/otpTiming";

function ForgotPasswordForm({ onOtpSent, onBack }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validate = () => {
    const trimmed = email.trim();
    if (!trimmed) return "Email is required.";
    if (!isValidEmail(trimmed)) return "Enter a valid email address.";
    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      setError("");
      setNotice("");
      const normalizedEmail = email.trim().toLowerCase();
      const data = await forgotPasswordRequestOtp({ email: normalizedEmail });
      setNotice(data.message || "Verification code sent.");
      onOtpSent?.({
        userId: data.userId,
        email: data.email || normalizedEmail,
        verificationMode: "reset-password",
        initialTiming: buildInitialTiming(data),
      });
    } catch (err) {
      setError(err.message || "Request failed.");
    } finally {
      setLoading(false);
    }
  };

  const fieldError = submitted ? validate() : "";

  return (
    <div className="auth-card">
      <p className="auth-card__brand">Phūrai</p>
      <h2 className="auth-card__title">Forgot Password</h2>
      <p className="auth-card__subtitle">
        Enter your email to receive a reset code.
      </p>

      {notice ? (
        <div className="auth-alert auth-alert--success" role="status">
          {notice}
        </div>
      ) : null}

      {(error || fieldError) ? (
        <div className="auth-alert auth-alert--error" role="alert">
          {error || fieldError}
        </div>
      ) : null}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="auth-field">
          <label className="auth-field__label" htmlFor="forgot-email">
            Email
          </label>
          <input
            id="forgot-email"
            type="email"
            className={`auth-field__input${fieldError ? " auth-field__input--error" : ""}`}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
            autoComplete="email"
          />
          {fieldError ? <p className="auth-field__error">{fieldError}</p> : null}
        </div>

        <button type="submit" className="auth-submit" disabled={loading}>
          {loading ? "SENDING..." : "SEND OTP"}
        </button>

        <button type="button" className="auth-form__link" onClick={onBack}>
          Back to Login
        </button>
      </form>
    </div>
  );
}

export default ForgotPasswordForm;
