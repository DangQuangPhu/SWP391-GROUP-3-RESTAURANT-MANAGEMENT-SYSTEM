import { useState } from "react";
import {
  isEmailValue,
  isValidEmail,
  isValidVietnamPhone,
  isPasswordStrong,
  isAtLeast13YearsOld,
  isDateOfBirthNotInFuture,
  parseDateOfBirth,
  validateUsername,
  validateFullName,
  splitFullName,
  normalizePhone,
  blurActiveElement,
} from "../utils/authHelpers.js";
import { loginAccount, registerAccount, resendVerificationCode } from "../services/authApi.js";
import { buildInitialTiming } from "../utils/otpTiming.js";
import { signInWithGoogle, registerWithGoogle } from "./googleAuth";
import GoogleAccountChooserModal from "./GoogleAccountChooserModal";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";
import "@/styles/auth.css";

const EMPTY_SIGNUP = {
  fullName: "",
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
  const normalizeMode = (value) => (value === "signup" || value === "register" ? "register" : "login");
  const [authMode, setAuthMode] = useState(() => normalizeMode(initialMode));
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
    fullName:
      apiFieldErrors.firstName ||
      apiFieldErrors.lastName ||
      (shouldShow("fullName") ? validateFullName(signup.fullName) : ""),
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
          : !isDateOfBirthNotInFuture(signup.dateOfBirth)
          ? "Date of birth cannot be in the future."
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
    blurActiveElement();

    const mode = normalizeMode(nextMode);
    setAuthMode(mode);
    setAlert(null);
    setSubmitted(false);
    setTouched({});
    setUnverifiedUser(null);
    setApiFieldErrors({});
    onClearSuccess?.();
    if (mode === "register") setSignup(EMPTY_SIGNUP);
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
      if (
        result.type === "register" ||
        result.type === "otp" ||
        result.requiresOtp
      ) {
        onProceedToOtp?.({
          userId: result.userId,
          email: result.email,
          verificationMode: "email",
          initialTiming: buildInitialTiming(result),
        });
      } else {
        onAuthSuccess?.(result.user, { remember: login.rememberMe, showWelcome: true });
      }
    } catch (error) {
      if (error.code === "EMAIL_NOT_VERIFIED" && error.data) {
        onProceedToOtp?.({
          userId: error.data.userId,
          email: error.data.email,
          verificationMode: "email",
        });
        return;
      }
      setAlert({
        type: "error",
        message: error?.message || "Google login failed. Please try again.",
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
        initialTiming: buildInitialTiming(data),
      });
    } catch (error) {
      setAlert({
        type: "error",
        message: error?.message || "Google login failed. Please try again.",
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleMockGoogleSelect = (acc) => {
    blurActiveElement();
    setShowGoogleChooser(false);
    onProceedToOtp?.({
      userId: "mock-google-user",
      email: acc.email,
      verificationMode: "google-auth",
    });
  };

  const handleResendVerification = async () => {
    const target = unverifiedUser;
    if (!target?.email) return;
    try {
      const data = await resendVerificationCode({
        email: target.email,
        purpose: "EMAIL_VERIFY",
      });
      onProceedToOtp?.({
        userId: target.userId,
        email: target.email,
        verificationMode: "email",
        initialTiming: buildInitialTiming(data),
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
      fullName: validateFullName(signup.fullName),
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
        : !isDateOfBirthNotInFuture(signup.dateOfBirth)
        ? "Date of birth cannot be in the future."
        : !isAtLeast13YearsOld(signup.dateOfBirth)
        ? "You must be at least 13 years old."
        : "",
      password: !signup.password
        ? "Password is required."
        : !isPasswordStrong(signup.password)
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

    const { firstName, lastName } = splitFullName(signup.fullName);
    const payload = {
      firstName,
      lastName,
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
        initialTiming: buildInitialTiming(data),
      });
    } catch (error) {
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

  const handleSignupChange = (field, value) => {
    setSignup((prev) => ({ ...prev, [field]: value }));
  };

  const isRegister = authMode === "register";

  return (
    <div className={`auth-slider ${isRegister ? "is-register" : "is-login"}`}>
      {successMessage ? (
        <div className="auth-alert auth-alert--success auth-slider__alert" role="status">
          {successMessage}
        </div>
      ) : null}

      {alert ? (
        <div className={`auth-alert auth-alert--${alert.type} auth-slider__alert`} role="alert">
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

      <div className="auth-slider__forms">
        <LoginForm
          login={login}
          onLoginChange={(patch) => setLogin((prev) => ({ ...prev, ...patch }))}
          onTouch={touch}
          loginIdentifierError={loginIdentifierError}
          loginPasswordError={loginPasswordError}
          onSubmit={handleLoginSubmit}
          onForgotPassword={onForgotPassword}
          onGoogleLogin={handleGoogleLogin}
          googleLoading={googleLoading}
          loginLoading={loginLoading}
        />

        <RegisterForm
          signup={signup}
          onSignupChange={handleSignupChange}
          onTouch={touch}
          signupErrors={signupErrors}
          onSubmit={handleSignupSubmit}
          onGoogleRegister={handleGoogleRegister}
          googleLoading={googleLoading}
          signupLoading={signupLoading}
        />
      </div>

      <div className="auth-slider__overlay-wrap">
        <div className="auth-slider__overlay">
          <div className="auth-slider__overlay-panel auth-slider__overlay-panel--left">
            <h2 className="auth-slider__overlay-title">Welcome Back</h2>
            <p className="auth-slider__overlay-text">
              Sign in to reserve your table and enjoy the Phūrai experience.
            </p>
            <button
              type="button"
              className="auth-slider__ghost-btn"
              onClick={() => switchMode("login")}
            >
              Sign In
            </button>
          </div>
          <div className="auth-slider__overlay-panel auth-slider__overlay-panel--right">
            <h2 className="auth-slider__overlay-title">Hello, Valued Customers!</h2>
            <p className="auth-slider__overlay-text">
              Sign Up for an account to unlock reservations, offers, and member perks.
            </p>
            <button
              type="button"
              className="auth-slider__ghost-btn"
              onClick={() => switchMode("register")}
            >
              Sign Up
            </button>
          </div>
        </div>
      </div>

      <div className="auth-slider__mobile-switch">
        {isRegister ? (
          <p>
            Already have an account?{" "}
            <button type="button" className="auth-form__link" onClick={() => switchMode("login")}>
              Sign in
            </button>
          </p>
        ) : (
          <p>
            Don&apos;t have an account?{" "}
            <button type="button" className="auth-form__link" onClick={() => switchMode("register")}>
              Sign Up
            </button>
          </p>
        )}
      </div>

      <GoogleAccountChooserModal
        isOpen={showGoogleChooser}
        onClose={() => {
          blurActiveElement();
          setShowGoogleChooser(false);
        }}
        onSelect={handleMockGoogleSelect}
      />
    </div>
  );
}

export default AuthCard;
