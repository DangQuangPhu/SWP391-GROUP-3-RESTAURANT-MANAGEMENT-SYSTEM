import { useState } from "react";
import { getPasswordStrength, isPasswordStrong } from "./authHelpers";
import { forgotPasswordReset } from "./api";

function EyeIcon({ visible }) {
  if (visible) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M2 4.27 3.28 3 21 20.72 19.73 22l-3.12-3.12A11.8 11.8 0 0 1 12 19c-7 0-10-7-10-7a17.7 17.7 0 0 1 4.34-5.14L2 4.27z" />
    </svg>
  );
}

function PasswordField({ id, label, value, onChange, error }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="auth-field">
      <label className="auth-field__label" htmlFor={id}>{label}</label>
      <div className={`auth-password${error ? " auth-password--error" : ""}`}>
        <input
          id={id}
          type={visible ? "text" : "password"}
          className="auth-field__input"
          value={value}
          onChange={onChange}
          autoComplete="new-password"
        />
        <button
          type="button"
          className="auth-password__toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          <EyeIcon visible={visible} />
        </button>
      </div>
      {error ? <p className="auth-field__error">{error}</p> : null}
    </div>
  );
}

function StrengthMeter({ password }) {
  const strength = getPasswordStrength(password);
  return (
    <div className="auth-strength" aria-live="polite">
      <div className="auth-strength__bars">
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className={`auth-strength__bar${
              strength.bars >= bar ? ` auth-strength__bar--${strength.level}` : ""
            }`}
          />
        ))}
      </div>
      <p className="auth-strength__label">{strength.label}</p>
    </div>
  );
}

function ResetPasswordForm({ userId, email, resetToken, onSuccess }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validate = () => {
    const next = {};
    if (!password) next.password = "New password is required.";
    else if (!isPasswordStrong(password)) {
      next.password =
        "Password must be at least 8 characters with uppercase, lowercase, number, and special character.";
    }
    if (!confirm) next.confirm = "Confirm password is required.";
    else if (confirm !== password) next.confirm = "Passwords do not match.";
    return next;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    const validation = validate();
    setErrors(validation);
    if (Object.keys(validation).length) return;

    try {
      setLoading(true);
      setAlert("");
      await forgotPasswordReset({
        userId,
        email,
        resetToken,
        newPassword: password,
        confirmPassword: confirm,
      });
      onSuccess?.();
    } catch (err) {
      setAlert(err.message || "Reset failed.");
    } finally {
      setLoading(false);
    }
  };

  const showErrors = submitted ? validate() : {};

  return (
    <div className="auth-card">
      <p className="auth-card__brand">Phūrai</p>
      <h2 className="auth-card__title">Create New Password</h2>
      <p className="auth-card__subtitle">Choose a strong password for your account.</p>

      {alert ? (
        <div className="auth-alert auth-alert--error" role="alert">
          {alert}
        </div>
      ) : null}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <PasswordField
          id="new-password"
          label="Enter New Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={showErrors.password || errors.password}
        />
        <StrengthMeter password={password} />
        <PasswordField
          id="confirm-password"
          label="Confirm New Password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={showErrors.confirm || errors.confirm}
        />
        <button type="submit" className="auth-submit" disabled={loading}>
          {loading ? "SAVING..." : "RESET PASSWORD"}
        </button>
      </form>
    </div>
  );
}

export default ResetPasswordForm;
