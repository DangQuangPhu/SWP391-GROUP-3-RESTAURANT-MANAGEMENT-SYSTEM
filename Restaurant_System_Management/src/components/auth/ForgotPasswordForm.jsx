import { useState } from "react";
import { isEmailValue, isValidEmail, isValidVietnamPhone, normalizePhone } from "./authHelpers";
import { forgotPasswordRequest } from "./api";

function ForgotPasswordForm({ onOtpSent, onBack }) {
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validate = () => {
    const trimmed = identifier.trim();
    if (!trimmed) return "Email or phone number is required.";
    if (isEmailValue(trimmed)) {
      if (!isValidEmail(trimmed)) return "Enter a valid email address.";
      return "";
    }
    if (!/^\d+$/.test(normalizePhone(trimmed))) {
      return "Phone number must contain digits only.";
    }
    if (!isValidVietnamPhone(trimmed)) {
      return "Phone number must be 10–11 digits.";
    }
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
      const data = await forgotPasswordRequest(identifier.trim());
      onOtpSent?.({
        userId: data.userId,
        email: data.email,
        verificationMode: "reset-password",
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
        Enter your email or phone number to receive a reset code.
      </p>

      {(error || fieldError) ? (
        <div className="auth-alert auth-alert--error" role="alert">
          {error || fieldError}
        </div>
      ) : null}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="auth-field">
          <label className="auth-field__label" htmlFor="forgot-identifier">
            Email or Phone Number
          </label>
          <input
            id="forgot-identifier"
            type="text"
            className={`auth-field__input${fieldError ? " auth-field__input--error" : ""}`}
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              setError("");
            }}
            autoComplete="username"
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
