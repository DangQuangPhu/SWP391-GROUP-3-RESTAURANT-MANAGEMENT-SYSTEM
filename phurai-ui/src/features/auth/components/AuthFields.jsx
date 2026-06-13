import { useState } from "react";
import { getPasswordStrength } from "../utils/authHelpers.js";

export function GoogleIcon() {
  return (
    <svg className="auth-socials__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

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

export function PasswordInput({ id, label, value, onChange, onBlur, error, autoComplete, className = "" }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={`auth-field ${className}`.trim()}>
      <label className="auth-field__label" htmlFor={id}>{label}</label>
      <div className={`auth-password${error ? " auth-password--error" : ""}`}>
        <input
          id={id}
          type={visible ? "text" : "password"}
          className="auth-field__input"
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="auth-password__toggle"
          onClick={() => setVisible((prev) => !prev)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          <EyeIcon visible={visible} />
        </button>
      </div>
      {error ? <p className="auth-field__error">{error}</p> : null}
    </div>
  );
}

export function TextField({ id, label, value, onChange, onBlur, error, type = "text", autoComplete, className = "" }) {
  return (
    <div className={`auth-field ${className}`.trim()}>
      <label className="auth-field__label" htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        className={`auth-field__input${error ? " auth-field__input--error" : ""}`}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        autoComplete={autoComplete}
      />
      {error ? <p className="auth-field__error">{error}</p> : null}
    </div>
  );
}

export function StrengthMeter({ password }) {
  const strength = getPasswordStrength(password);
  return (
    <div className="auth-strength auth-form__full" aria-live="polite">
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

export function GoogleButton({ label, onClick, disabled = false }) {
  return (
    <button
      type="button"
      className="auth-socials__btn auth-socials__btn--google"
      onClick={onClick}
      disabled={disabled}
    >
      <GoogleIcon />
      <span>{label}</span>
    </button>
  );
}
