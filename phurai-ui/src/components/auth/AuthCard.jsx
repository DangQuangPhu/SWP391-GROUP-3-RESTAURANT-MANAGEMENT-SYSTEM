import { useState } from "react";
import {
  getPasswordStrength,
  isEmailValue,
  isValidEmail,
  isValidPhoneInput,
} from "./authHelpers";
import { loginAccount, registerAccount } from "./api";
import { signInWithGoogle } from "./googleAuth";
import "../../styles/auth.css";

function GoogleIcon() {
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
      <path fill="currentColor" d="M2 4.27 3.28 3 21 20.72 19.73 22l-3.12-3.12A11.8 11.8 0 0 1 12 19c-7 0-10-7-10-7a17.7 17.7 0 0 1 4.34-5.14L2 4.27zm7.1 7.1 2.03 2.03A2.5 2.5 0 0 0 12 9.5c-1.38 0-2.5 1.12-2.5 2.5 0 .37.08.72.22 1.03l1.38 1.38zM12 5c1.62 0 3.06.44 4.24 1.2l1.45-1.45A11.9 11.9 0 0 0 12 3C5 3 2 10 2 10a18.5 18.5 0 0 0 4.82 6.22l1.58-1.58A5 5 0 0 1 7 12c0-2.76 2.24-5 5-5z" />
    </svg>
  );
}

function PasswordInput({ id, label, value, onChange, onBlur, error, autoComplete, className = "" }) {
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

function TextField({ id, label, value, onChange, onBlur, error, type = "text", autoComplete, className = "" }) {
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

function StrengthMeter({ password }) {
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

function GoogleButton({ label, onClick, disabled = false }) {
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

const EMPTY_SIGNUP = {
  firstName: "",
  lastName: "",
  username: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  agreeTerms: false,
};

function AuthCard({
  onProceedToOtp,
  onGoogleAuthenticated,
  initialMode = "login",
}) {
  const [mode, setMode] = useState(initialMode);
  const [alert, setAlert] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState({});
  const [login, setLogin] = useState({ identifier: "", password: "", rememberMe: false });
  const [signup, setSignup] = useState(EMPTY_SIGNUP);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const touch = (field) => setTouched((prev) => ({ ...prev, [field]: true }));
  const shouldShow = (field) => submitted || touched[field];

  const validateLoginIdentifier = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return "Email or username is required.";
    if (isEmailValue(trimmed)) {
      if (!isValidEmail(trimmed)) return "Enter a valid email address.";
      return "";
    }
    if (trimmed.length < 2) return "Enter a valid username.";
    return "";
  };

  const validateLoginPassword = (value) => {
    if (!value) return "Password is required.";
    if (value.length < 8) return "Password must be at least 8 characters.";
    return "";
  };

  const validateRequired = (value, label) => {
    if (!value?.trim()) return `${label} is required.`;
    return "";
  };

  const validateUsername = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return "Username is required.";
    if (!/^[a-zA-Z0-9._-]{2,}$/.test(trimmed)) {
      return "Username must be at least 2 characters (letters, numbers, . _ -).";
    }
    return "";
  };

  const validateSignupPassword = (value) => {
    if (!value) return "Password is required.";
    if (value.length < 8) return "Password must be at least 8 characters.";
    if (getPasswordStrength(value).level === "low") {
      return "Password is too weak.";
    }
    return "";
  };

  const loginIdentifierError = shouldShow("loginIdentifier") ? validateLoginIdentifier(login.identifier) : "";
  const loginPasswordError = shouldShow("loginPassword") ? validateLoginPassword(login.password) : "";

  const signupErrors = {
    firstName: shouldShow("firstName") ? validateRequired(signup.firstName, "First name") : "",
    lastName: shouldShow("lastName") ? validateRequired(signup.lastName, "Last name") : "",
    username: shouldShow("username") ? validateUsername(signup.username) : "",
    email: shouldShow("email")
      ? !signup.email.trim()
        ? "Email is required."
        : !isValidEmail(signup.email)
        ? "Enter a valid email address."
        : ""
      : "",
    phone: shouldShow("phone")
      ? !signup.phone.trim()
        ? "Phone number is required."
        : !isValidPhoneInput(signup.phone)
        ? "Enter a valid phone number."
        : ""
      : "",
    password: shouldShow("password") ? validateSignupPassword(signup.password) : "",
    confirmPassword: shouldShow("confirmPassword")
      ? !signup.confirmPassword
        ? "Confirm password is required."
        : signup.confirmPassword !== signup.password
        ? "Passwords do not match."
        : ""
      : "",
    terms:
      shouldShow("terms") && !signup.agreeTerms
        ? "You must accept the Terms of Service and Privacy Policy."
        : "",
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setAlert(null);
    setSubmitted(false);
    setTouched({});
    if (nextMode === "signup") {
      setSignup(EMPTY_SIGNUP);
    }
  };

  const handleGoogle = async () => {
    setAlert(null);

    try {
      setGoogleLoading(true);
      const googleUser = await signInWithGoogle();
      onGoogleAuthenticated?.(googleUser);
    } catch (error) {
      setAlert({
        type: "error",
        message:
          error?.message || "Google Sign-In failed. Please try again later.",
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setAlert(null);
    const identifierError = validateLoginIdentifier(login.identifier);
    const passwordError = validateLoginPassword(login.password);
    if (identifierError || passwordError) return;

    try {
      setLoginLoading(true);
      const data = await loginAccount({
        identifier: login.identifier.trim(),
        password: login.password,
      });

      onGoogleAuthenticated?.(data.user);
    } catch (error) {
      setAlert({
        type: "error",
        message: error?.message || "Login failed. Please try again.",
      });
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignupSubmit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setAlert(null);

    const errors = {
      firstName: validateRequired(signup.firstName, "First name"),
      lastName: validateRequired(signup.lastName, "Last name"),
      username: validateUsername(signup.username),
      email: !signup.email.trim()
        ? "Email is required."
        : !isValidEmail(signup.email)
        ? "Enter a valid email address."
        : "",
      phone: !signup.phone.trim()
        ? "Phone number is required."
        : !isValidPhoneInput(signup.phone)
        ? "Enter a valid phone number."
        : "",
      password: validateSignupPassword(signup.password),
      confirmPassword: !signup.confirmPassword
        ? "Confirm password is required."
        : signup.confirmPassword !== signup.password
        ? "Passwords do not match."
        : "",
      terms: !signup.agreeTerms ? "You must accept the Terms of Service and Privacy Policy." : "",
    };

    if (Object.values(errors).some(Boolean)) return;

    try {
      setSignupLoading(true);
      const data = await registerAccount({
        username: signup.username.trim(),
        email: signup.email.trim().toLowerCase(),
        password: signup.password,
        fullName: `${signup.firstName.trim()} ${signup.lastName.trim()}`.trim(),
        phone: signup.phone.trim(),
      });

      setAlert({
        type: "success",
        message:
          data.message ||
          "Registration successful. Please check your email to verify your account.",
      });
      setSignup(EMPTY_SIGNUP);
      setSubmitted(false);
      setTouched({});
      onProceedToOtp?.({
        firstName: signup.firstName.trim(),
        lastName: signup.lastName.trim(),
        fullName: `${signup.firstName.trim()} ${signup.lastName.trim()}`.trim(),
        username: signup.username.trim(),
        email: signup.email.trim().toLowerCase(),
        phone: signup.phone.trim(),
        userId: data.userId,
        verificationMode: "email",
      });
    } catch (error) {
      setAlert({
        type: "error",
        message: error?.message || "Registration failed. Please try again.",
      });
    } finally {
      setSignupLoading(false);
    }
  };

  const updateSignup = (field) => (event) => {
    const { value, type, checked } = event.target;
    setSignup((prev) => ({
      ...prev,
      [field]: type === "checkbox" ? checked : value,
    }));
  };

  return (
    <div className={`auth-card${mode === "signup" ? " auth-card--signup" : ""}`}>
      <p className="auth-card__brand">Phūrai</p>
      <div className="auth-card__tabs" role="tablist" aria-label="Authentication mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          className={`auth-card__tab${mode === "login" ? " auth-card__tab--active" : ""}`}
          onClick={() => switchMode("login")}
        >
          Login
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          className={`auth-card__tab${mode === "signup" ? " auth-card__tab--active" : ""}`}
          onClick={() => switchMode("signup")}
        >
          Create Account
        </button>
      </div>

      {alert ? (
        <div className={`auth-alert auth-alert--${alert.type}`} role="alert">
          {alert.message}
        </div>
      ) : null}

      {mode === "login" ? (
        <form className="auth-form" onSubmit={handleLoginSubmit} noValidate>
          <h2 className="auth-card__title">Welcome Back</h2>
          <p className="auth-card__subtitle">Sign in to continue your Phūrai experience.</p>

          <TextField
            id="login-identifier"
            label="Email or Username"
            value={login.identifier}
            onChange={(e) => setLogin((p) => ({ ...p, identifier: e.target.value }))}
            onBlur={() => touch("loginIdentifier")}
            error={loginIdentifierError}
            autoComplete="username"
          />

          <PasswordInput
            id="login-password"
            label="Password"
            value={login.password}
            onChange={(e) => setLogin((p) => ({ ...p, password: e.target.value }))}
            onBlur={() => touch("loginPassword")}
            error={loginPasswordError}
            autoComplete="current-password"
          />

          <div className="auth-form__row">
            <label className="auth-checkbox">
              <input
                type="checkbox"
                checked={login.rememberMe}
                onChange={(e) => setLogin((p) => ({ ...p, rememberMe: e.target.checked }))}
              />
              <span>Remember me</span>
            </label>
            <button type="button" className="auth-form__link">Forgot password?</button>
          </div>

          <button type="submit" className="auth-submit" disabled={loginLoading}>
            {loginLoading ? "SIGNING IN..." : "SIGN IN"}
          </button>
          <GoogleButton
            label={googleLoading ? "Connecting to Google..." : "Sign in with Google"}
            onClick={handleGoogle}
            disabled={googleLoading}
          />

          <p className="auth-card__switch">
            Don&apos;t have an account?{" "}
            <button type="button" className="auth-form__link" onClick={() => switchMode("signup")}>
              Create account
            </button>
          </p>
        </form>
      ) : (
        <form className="auth-form auth-form--signup" onSubmit={handleSignupSubmit} noValidate>
          <h2 className="auth-card__title">Create a new account</h2>
          <p className="auth-card__subtitle">
            Join Phūrai for reservations, offers, and personalized dining.
          </p>

          <div className="auth-form__grid auth-form__grid--2">
            <TextField
              id="signup-firstname"
              label="First Name"
              value={signup.firstName}
              onChange={updateSignup("firstName")}
              onBlur={() => touch("firstName")}
              error={signupErrors.firstName}
              autoComplete="given-name"
            />
            <TextField
              id="signup-lastname"
              label="Last Name"
              value={signup.lastName}
              onChange={updateSignup("lastName")}
              onBlur={() => touch("lastName")}
              error={signupErrors.lastName}
              autoComplete="family-name"
            />
          </div>

          <TextField
            id="signup-username"
            label="Username"
            value={signup.username}
            onChange={updateSignup("username")}
            onBlur={() => touch("username")}
            error={signupErrors.username}
            autoComplete="username"
            className="auth-form__full"
          />

          <div className="auth-form__grid auth-form__grid--2">
            <TextField
              id="signup-email"
              label="Email"
              type="email"
              value={signup.email}
              onChange={updateSignup("email")}
              onBlur={() => touch("email")}
              error={signupErrors.email}
              autoComplete="email"
            />
            <TextField
              id="signup-phone"
              label="Phone Number"
              type="tel"
              value={signup.phone}
              onChange={updateSignup("phone")}
              onBlur={() => touch("phone")}
              error={signupErrors.phone}
              autoComplete="tel"
            />
          </div>

          <div className="auth-form__grid auth-form__grid--2">
            <div className="auth-form__password-col">
              <PasswordInput
                id="signup-password"
                label="Password"
                value={signup.password}
                onChange={updateSignup("password")}
                onBlur={() => touch("password")}
                error={signupErrors.password}
                autoComplete="new-password"
              />
              <StrengthMeter password={signup.password} />
            </div>
            <PasswordInput
              id="signup-confirm"
              label="Confirm Password"
              value={signup.confirmPassword}
              onChange={updateSignup("confirmPassword")}
              onBlur={() => touch("confirmPassword")}
              error={signupErrors.confirmPassword}
              autoComplete="new-password"
            />
          </div>

          <label className="auth-checkbox auth-checkbox--terms auth-form__full">
            <input
              type="checkbox"
              checked={signup.agreeTerms}
              onChange={updateSignup("agreeTerms")}
              onBlur={() => touch("terms")}
            />
            <span>
              I agree to the{" "}
              <button type="button" className="auth-form__link auth-form__link--inline">
                Terms of Service
              </button>{" "}
              and{" "}
              <button type="button" className="auth-form__link auth-form__link--inline">
                Privacy Policy
              </button>
            </span>
          </label>
          {signupErrors.terms ? (
            <p className="auth-field__error auth-field__error--terms auth-form__full">{signupErrors.terms}</p>
          ) : null}

          <button
            type="submit"
            className="auth-submit auth-form__full"
            disabled={signupLoading}
          >
            {signupLoading ? "CREATING ACCOUNT..." : "CREATE ACCOUNT"}
          </button>
          <GoogleButton
            label={googleLoading ? "Connecting to Google..." : "Continue with Google"}
            onClick={handleGoogle}
            disabled={googleLoading}
          />

          <p className="auth-card__switch">
            Already have an account?{" "}
            <button type="button" className="auth-form__link" onClick={() => switchMode("login")}>
              Sign in
            </button>
          </p>
        </form>
      )}
    </div>
  );
}

export default AuthCard;
