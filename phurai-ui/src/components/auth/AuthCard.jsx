import { useState } from "react";
import {
  getPasswordStrength,
  isEmailValue,
  isValidEmail,
  isValidVietnamPhone,
  isPasswordStrong,
  isAtLeast13YearsOld,
  parseDateOfBirth,
  validateName,
  validateUsername,
  normalizePhone,
} from "./authHelpers";
import { loginAccount, registerAccount, resendVerificationCode } from "./api";
import { signInWithGoogle, registerWithGoogle } from "./googleAuth";
import GoogleAccountChooserModal from "./GoogleAccountChooserModal";
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
      <path fill="currentColor" d="M2 4.27 3.28 3 21 20.72 19.73 22l-3.12-3.12A11.8 11.8 0 0 1 12 19c-7 0-10-7-10-7a17.7 17.7 0 0 1 4.34-5.14L2 4.27z" />
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
  dateOfBirth: "",
  password: "",
  confirmPassword: "",
  agreeTerms: false,
};

function AuthCard({
  onProceedToOtp,
  onAuthSuccess,
  onForgotPassword,
  initialMode = "login",
  successMessage = "",
  onClearSuccess,
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
  const [apiFieldErrors, setApiFieldErrors] = useState({});
  const [unverifiedUser, setUnverifiedUser] = useState(null);
  const [showGoogleChooser, setShowGoogleChooser] = useState(false);

  const touch = (field) => setTouched((prev) => ({ ...prev, [field]: true }));
  const shouldShow = (field) => submitted || touched[field];

  const validateLoginIdentifier = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return "Email or username is required.";
    if (isEmailValue(trimmed) && !isValidEmail(trimmed)) {
      return "Enter a valid email address.";
    }
    return "";
  };

  const validateLoginPassword = (value) => {
    if (!value) return "Password is required.";
    return "";
  };

  const getSignupErrors = () => ({
    firstName:
      apiFieldErrors.firstName ||
      (shouldShow("firstName") ? validateName(signup.firstName, "First name") : ""),
    lastName:
      apiFieldErrors.lastName ||
      (shouldShow("lastName") ? validateName(signup.lastName, "Last name") : ""),
    username:
      apiFieldErrors.username ||
      (shouldShow("username") ? validateUsername(signup.username) : ""),
    email:
      apiFieldErrors.email ||
      (shouldShow("email")
        ? !signup.email.trim()
          ? "Email is required."
          : !isValidEmail(signup.email)
          ? "Enter a valid email address."
          : ""
        : ""),
    phone:
      apiFieldErrors.phoneNumber ||
      apiFieldErrors.phone ||
      (shouldShow("phone")
        ? !signup.phone.trim()
          ? "Phone number is required."
          : !/^\d+$/.test(normalizePhone(signup.phone))
          ? "Phone must contain digits only."
          : !isValidVietnamPhone(signup.phone)
          ? "Phone number must be 10–11 digits."
          : ""
        : ""),
    dateOfBirth:
      apiFieldErrors.dateOfBirth ||
      (shouldShow("dateOfBirth")
        ? !signup.dateOfBirth
          ? "Date of birth is required."
          : !parseDateOfBirth(signup.dateOfBirth)
          ? "Enter a valid date of birth."
          : !isAtLeast13YearsOld(signup.dateOfBirth)
          ? "You must be at least 13 years old."
          : ""
        : ""),
    password:
      apiFieldErrors.password ||
      (shouldShow("password")
        ? !signup.password
          ? "Password is required."
          : !isPasswordStrong(signup.password)
          ? "Password must meet security requirements."
          : ""
        : ""),
    confirmPassword:
      apiFieldErrors.confirmPassword ||
      (shouldShow("confirmPassword")
        ? !signup.confirmPassword
          ? "Confirm password is required."
          : signup.confirmPassword !== signup.password
          ? "Passwords do not match."
          : ""
        : ""),
    terms:
      shouldShow("terms") && !signup.agreeTerms
        ? "You must accept the Terms of Service and Privacy Policy."
        : "",
  });

  const loginIdentifierError = shouldShow("loginIdentifier")
    ? validateLoginIdentifier(login.identifier)
    : "";
  const loginPasswordError = shouldShow("loginPassword")
    ? validateLoginPassword(login.password)
    : "";
  const signupErrors = getSignupErrors();

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setAlert(null);
    setSubmitted(false);
    setTouched({});
    setUnverifiedUser(null);
    setApiFieldErrors({});
    onClearSuccess?.();
    if (nextMode === "signup") setSignup(EMPTY_SIGNUP);
  };

  const handleGoogleLogin = async () => {
    setAlert(null);
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || clientId === "your_google_client_id_here") {
      setShowGoogleChooser(true);
      return;
    }

    try {
      setGoogleLoading(true);
      const result = await signInWithGoogle();
      if (result.type === "register" || result.requiresOtp) {
         onProceedToOtp?.({
           userId: result.userId,
           email: result.email,
           verificationMode: "email",
         });
      } else {
         onAuthSuccess?.(result.user, { remember: login.rememberMe, showWelcome: true });
      }
    } catch (error) {
      console.log("Backend error", error.data);
      if (error.code === "EMAIL_NOT_VERIFIED" && error.data) {
        onProceedToOtp?.({
           userId: error.data.userId,
           email: error.data.email,
           verificationMode: "email"
        });
        return;
      }
      setAlert({
        type: "error",
        message: error?.message || "Google Sign-In failed.",
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setAlert(null);
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || clientId === "your_google_client_id_here") {
      setShowGoogleChooser(true);
      return;
    }

    try {
      setGoogleLoading(true);
      const data = await registerWithGoogle();
      onProceedToOtp?.({
        userId: data.userId,
        email: data.email,
        verificationMode: "email",
      });
    } catch (error) {
      setAlert({
        type: "error",
        message: error?.message || "Google registration failed.",
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleMockGoogleSelect = (acc) => {
    setShowGoogleChooser(false);
    onProceedToOtp?.({
      userId: "mock-google-user",
      email: acc.email,
      verificationMode: "google-auth",
    });
  };

  const handleResendVerification = async () => {
    const target = unverifiedUser;
    if (!target?.userId) return;
    try {
      await resendVerificationCode(target.userId);
      onProceedToOtp?.({
        userId: target.userId,
        email: target.email,
        verificationMode: "email",
      });
    } catch (err) {
      setAlert({ type: "error", message: err.message || "Resend failed." });
    }
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setAlert(null);
    setUnverifiedUser(null);
    const identifierError = validateLoginIdentifier(login.identifier);
    const passwordError = validateLoginPassword(login.password);
    if (identifierError || passwordError) return;

    try {
      setLoginLoading(true);
      const data = await loginAccount({
        identifier: login.identifier.trim(),
        password: login.password,
      });
      onAuthSuccess?.(data.user, { remember: login.rememberMe, showWelcome: true });
    } catch (error) {
      console.log("Backend error", error.data);

      if (error.code === "EMAIL_NOT_VERIFIED") {
        setUnverifiedUser({
          userId: error.data?.userId,
          email: error.data?.email,
        });
        setAlert({
          type: "error",
          message: "Please verify your email before logging in.",
        });
        return;
      }

      setUnverifiedUser(null);
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
    setApiFieldErrors({});

    const errors = {
      firstName: validateName(signup.firstName, "First name"),
      lastName: validateName(signup.lastName, "Last name"),
      username: validateUsername(signup.username),
      email: !signup.email.trim()
        ? "Email is required."
        : !isValidEmail(signup.email)
        ? "Enter a valid email address."
        : "",
      phone: !signup.phone.trim()
        ? "Phone number is required."
        : !/^\d+$/.test(normalizePhone(signup.phone))
        ? "Phone must contain digits only."
        : !isValidVietnamPhone(signup.phone)
        ? "Phone number must be 10–11 digits."
        : "",
      dateOfBirth: !signup.dateOfBirth
        ? "Date of birth is required."
        : !parseDateOfBirth(signup.dateOfBirth)
        ? "Enter a valid date of birth."
        : !isAtLeast13YearsOld(signup.dateOfBirth)
        ? "You must be at least 13 years old."
        : "",
      password: !isPasswordStrong(signup.password)
        ? "Password must meet security requirements."
        : "",
      confirmPassword: !signup.confirmPassword
        ? "Confirm password is required."
        : signup.confirmPassword !== signup.password
        ? "Passwords do not match."
        : "",
      terms: !signup.agreeTerms
        ? "You must accept the Terms of Service and Privacy Policy."
        : "",
    };

    if (Object.values(errors).some(Boolean)) return;

    const payload = {
      firstName: signup.firstName.trim(),
      lastName: signup.lastName.trim(),
      username: signup.username.trim().toLowerCase(),
      email: signup.email.trim().toLowerCase(),
      phoneNumber: normalizePhone(signup.phone),
      dateOfBirth: signup.dateOfBirth,
      password: signup.password,
      confirmPassword: signup.confirmPassword,
    };

    try {
      setSignupLoading(true);
      const data = await registerAccount(payload);

      onProceedToOtp?.({
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        userId: data.userId,
        verificationMode: "email",
      });
    } catch (error) {
      console.log("Backend error", error.data);

      if (error.data?.errors && typeof error.data.errors === "object") {
        const mapped = { ...error.data.errors };
        if (mapped.phoneNumber) mapped.phone = mapped.phoneNumber;
        setApiFieldErrors(mapped);
      } else if (error.data?.field) {
        const field = error.data.field === "phoneNumber" ? "phone" : error.data.field;
        setApiFieldErrors({ [field]: error.data.message || error.message });
      }

      setAlert({
        type: "error",
        message: error?.message || "Registration failed.",
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

      {successMessage ? (
        <div className="auth-alert auth-alert--success" role="status">
          {successMessage}
        </div>
      ) : null}

      {alert ? (
        <div className={`auth-alert auth-alert--${alert.type}`} role="alert">
          {alert.message}
          {unverifiedUser ? (
            <button
              type="button"
              className="auth-form__link auth-alert__action"
              onClick={handleResendVerification}
            >
              Resend verification code
            </button>
          ) : null}
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
            <button type="button" className="auth-form__link" onClick={onForgotPassword}>
              Forgot password?
            </button>
          </div>

          <button type="submit" className="auth-submit" disabled={loginLoading}>
            {loginLoading ? "SIGNING IN..." : "SIGN IN"}
          </button>
          <GoogleButton
            label={googleLoading ? "Connecting to Google..." : "Continue with Google"}
            onClick={handleGoogleLogin}
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

          <TextField
            id="signup-dob"
            label="Date of Birth"
            type="date"
            value={signup.dateOfBirth}
            onChange={updateSignup("dateOfBirth")}
            onBlur={() => touch("dateOfBirth")}
            error={signupErrors.dateOfBirth}
            className="auth-form__full"
          />

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
              I agree to the Terms of Service and Privacy Policy.
            </span>
          </label>
          {signupErrors.terms ? (
            <p className="auth-field__error auth-field__error--terms auth-form__full">
              {signupErrors.terms}
            </p>
          ) : null}

          <button type="submit" className="auth-submit auth-form__full" disabled={signupLoading}>
            {signupLoading ? "CREATING ACCOUNT..." : "CREATE ACCOUNT"}
          </button>
          <GoogleButton
            label={googleLoading ? "Connecting to Google..." : "Continue with Google"}
            onClick={handleGoogleRegister}
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

      <GoogleAccountChooserModal
        isOpen={showGoogleChooser}
        onClose={() => setShowGoogleChooser(false)}
        onSelect={handleMockGoogleSelect}
      />
    </div>
  );
}

export default AuthCard;
