import { useEffect, useMemo, useRef, useState } from "react";
import UserAvatar from "../../components/auth/UserAvatar";
import AvatarPickerModal from "../../components/account/AvatarPickerModal";
import AccountBackHome from "../../components/account/AccountBackHome";
import { getDisplayName, isPasswordStrong } from "../../components/auth/authHelpers";
import OtpCodeInput from "../../components/auth/OtpCodeInput";
import {
  changePassword,
  forgotPasswordRequestOtp,
  forgotPasswordVerifyOtp,
  forgotPasswordResendOtp,
  forgotPasswordReset,
  loadAuthUser,
} from "../../components/auth/api";
import {
  OTP_EXPIRES_IN_SECONDS,
  OTP_RESEND_COOLDOWN_SECONDS,
  applyOtpSentTiming,
  formatOtpExpiry,
  resolveRetryAfterSeconds,
} from "../../components/auth/otpTiming";
import "../../components/auth/OtpCodeInput.css";
import "./Profile.css";
import "./accountShared.css";

const OTP_RESEND_SECONDS = OTP_RESEND_COOLDOWN_SECONDS;

const GENDERS = ["", "Female", "Male", "Non-binary", "Prefer not to say"];
const COUNTRIES = ["", "Vietnam", "United States", "United Kingdom", "Singapore", "Other"];
const LANGUAGES = ["", "English", "Vietnamese", "French", "Other"];

const FORM_FIELDS = [
  { key: "fullName", label: "Full Name", placeholder: "Your First Name", type: "text" },
  { key: "username", label: "Username", placeholder: "Your Username", type: "text" },
  { key: "gender", label: "Gender", placeholder: "Select gender", type: "select", options: GENDERS },
  { key: "country", label: "Country", placeholder: "Select country", type: "select", options: COUNTRIES },
  { key: "language", label: "Language", placeholder: "Select language", type: "select", options: LANGUAGES },
  {
    key: "dateOfBirth",
    label: "Date of birth",
    placeholder: "Select your date of birth",
    type: "date",
  },
];

const COVER_THEMES = [
  {
    id: "blue-cream",
    label: "Blue Cream",
    gradient: "linear-gradient(90deg, #cfe6ff 0%, #f8f0d7 100%)",
  },
  {
    id: "warm-gold",
    label: "Warm Gold",
    gradient: "linear-gradient(90deg, #f3dfb2 0%, #fff5d8 100%)",
  },
  {
    id: "rose-beige",
    label: "Rose Beige",
    gradient: "linear-gradient(90deg, #f6d6d6 0%, #f7eadb 100%)",
  },
  {
    id: "matcha-green",
    label: "Matcha Green",
    gradient: "linear-gradient(90deg, #dcefd8 0%, #f5efd7 100%)",
  },
  {
    id: "lavender",
    label: "Lavender",
    gradient: "linear-gradient(90deg, #ded8ff 0%, #f8edf5 100%)",
  },
];

const getEmailPrefix = (email = "") => {
  return email.includes("@") ? email.split("@")[0] : email;
};

const resolveDisplayName = (profile = {}, user = {}) => {
  return (
    profile?.fullName ||
    user?.fullName ||
    user?.name ||
    user?.displayName ||
    user?.username ||
    getEmailPrefix(user?.email) ||
    "User"
  );
};

const resolveUsername = (profile = {}, user = {}) => {
  return (
    profile?.username ||
    user?.username ||
    user?.handle ||
    getEmailPrefix(user?.email) ||
    "user"
  );
};

const ProfileIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const AppearanceIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 3v2M12 19v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M3 12h2M19 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const AccessibilityIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="4" r="2" fill="currentColor" />
    <path
      d="M5 8h14M12 8v5M8 22l4-9 4 9M8.5 13h7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PasswordIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M7 10V7a5 5 0 0 1 10 0v3M6 10h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SessionsIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 3v3M12 18v3M3 12h3M18 12h3M5.64 5.64l2.12 2.12M16.24 16.24l2.12 2.12M18.36 5.64l-2.12 2.12M7.76 16.24l-2.12 2.12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const DASHBOARD_ITEMS = [
  { key: "profile", label: "Profile", icon: ProfileIcon },
  { key: "appearance", label: "Appearance", icon: AppearanceIcon },
  { key: "accessibility", label: "Accessibility", icon: AccessibilityIcon },
  { key: "password", label: "Password", icon: PasswordIcon },
  { key: "sessions", label: "Sessions", icon: SessionsIcon },
];

const SIDEBAR_ITEMS = DASHBOARD_ITEMS;

const getWelcomeName = (profile = {}, user = {}) => resolveDisplayName(profile, user);

function formatWelcomeDate(date = new Date()) {
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatDateOfBirthDisplay(value) {
  if (!value) return "Not set";
  const parts = String(value).split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    if (year && month && day) {
      return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
    }
  }
  return value;
}

function getProfilePasswordStrength(password) {
  if (!password) {
    return { level: "none", bars: 0, label: "" };
  }
  if (password.length < 8) {
    return { level: "weak", bars: 1, label: "Weak" };
  }
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  if (password.length >= 8 && hasLower && hasUpper && hasNumber && hasSpecial) {
    return { level: "strong", bars: 3, label: "Strong" };
  }
  if (password.length >= 8 && hasLetter && hasNumber) {
    return { level: "medium", bars: 2, label: "Medium" };
  }
  return { level: "weak", bars: 1, label: "Weak" };
}

function getCoverGradient(themeId) {
  return COVER_THEMES.find((theme) => theme.id === themeId)?.gradient || COVER_THEMES[0].gradient;
}

function buildDraft(profile) {
  return {
    fullName: profile?.fullName || getDisplayName(profile) || "",
    username: resolveUsername(profile, profile),
    email: profile?.email || "",
    gender: profile?.gender || "",
    country: profile?.country || "",
    language: profile?.language || "",
    dateOfBirth: profile?.dateOfBirth || profile?.dob || "",
    phone: profile?.phone || profile?.phoneNumber || "",
    address: profile?.address || "",
    bio: profile?.bio || "",
    firstName: profile?.firstName || "",
    lastName: profile?.lastName || "",
    coverTheme: profile?.coverTheme || "blue-cream",
    reduceMotion: Boolean(profile?.reduceMotion),
    largerText: Boolean(profile?.largerText),
    highContrast: Boolean(profile?.highContrast),
  };
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 3a3.5 3.5 0 00-3.5 3.5V9L5 12h10l-1.5-3V6.5A3.5 3.5 0 0010 3z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8.5 14a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 7l7 4.5L17 7" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function ProfileAvatar({ user }) {
  return (
    <div className="profile-dashboard__profile-avatar-wrap">
      <UserAvatar
        user={user}
        size="lg"
        className="profile-dashboard__avatar-inner"
        imgClassName="profile-dashboard__profile-avatar"
      />
    </div>
  );
}

function ProfileField({ field, value, isEditing, onChange }) {
  const isDateField = field.key === "dateOfBirth";
  const displayValue = isDateField
    ? formatDateOfBirthDisplay(value)
    : value || "—";

  return (
    <div className="profile-dashboard__field">
      <label htmlFor={`profile-${field.key}`}>{field.label}</label>
      {isEditing ? (
        field.type === "select" ? (
          <select id={`profile-${field.key}`} value={value} onChange={onChange}>
            {field.options.map((opt) => (
              <option key={opt || "empty"} value={opt}>
                {opt || field.placeholder}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={`profile-${field.key}`}
            type={field.type}
            value={value}
            placeholder={field.placeholder}
            onChange={onChange}
          />
        )
      ) : (
        <div className="profile-dashboard__field-value">{displayValue}</div>
      )}
    </div>
  );
}

function AppearancePanel({ coverTheme, onSelectTheme }) {
  return (
    <div className="profile-dashboard__panel">
      <h3>Profile cover color</h3>
      <p className="profile-dashboard__panel-desc">Choose a color theme for your profile cover.</p>
      <div className="profile-dashboard__theme-grid">
        {COVER_THEMES.map((theme) => (
          <button
            key={theme.id}
            type="button"
            className={`profile-dashboard__theme-option${
              coverTheme === theme.id ? " is-active" : ""
            }`}
            onClick={() => onSelectTheme(theme.id)}
          >
            <span className="profile-dashboard__theme-swatch" style={{ background: theme.gradient }} />
            <span>{theme.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AccessibilityPanel({ prefs, onChange }) {
  return (
    <div className="profile-dashboard__panel">
      <h3>Accessibility preferences</h3>
      <label className="profile-dashboard__toggle">
        <input
          type="checkbox"
          checked={prefs.reduceMotion}
          onChange={(event) => onChange("reduceMotion", event.target.checked)}
        />
        <span>Reduce motion</span>
      </label>
      <label className="profile-dashboard__toggle">
        <input
          type="checkbox"
          checked={prefs.largerText}
          onChange={(event) => onChange("largerText", event.target.checked)}
        />
        <span>Larger text</span>
      </label>
      <label className="profile-dashboard__toggle">
        <input
          type="checkbox"
          checked={prefs.highContrast}
          onChange={(event) => onChange("highContrast", event.target.checked)}
        />
        <span>High contrast</span>
      </label>
    </div>
  );
}

function ProfilePasswordStrength({ password }) {
  const strength = getProfilePasswordStrength(password);
  if (!password) return null;

  return (
    <div className="profile-dashboard__password-strength" aria-live="polite">
      <div className="profile-dashboard__strength-bars" aria-hidden="true">
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className={`profile-dashboard__strength-bar${
              bar <= strength.bars ? ` is-${strength.level}` : ""
            }`}
          />
        ))}
      </div>
      <span className={`profile-dashboard__strength-label is-${strength.level}`}>
        {strength.label}
      </span>
    </div>
  );
}

function PasswordPanel({ profile, onPasswordReset }) {
  const [mode, setMode] = useState("change");
  const [forgotStep, setForgotStep] = useState("send");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changeErrors, setChangeErrors] = useState({});
  const [changeSaving, setChangeSaving] = useState(false);

  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [otpShake, setOtpShake] = useState(false);
  const [otpSaving, setOtpSaving] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(OTP_RESEND_SECONDS);
  const [otpExpiresIn, setOtpExpiresIn] = useState(OTP_EXPIRES_IN_SECONDS);
  const [isResending, setIsResending] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [forgotSaving, setForgotSaving] = useState(false);
  const [sendOtpSaving, setSendOtpSaving] = useState(false);

  const userId = profile?.userId ?? profile?.id;
  const email = profile?.email || "";

  const forgotStrength = getProfilePasswordStrength(forgotNewPassword);
  const canResetForgotPassword =
    Boolean(forgotNewPassword) &&
    forgotStrength.level !== "weak" &&
    forgotStrength.bars >= 2 &&
    forgotNewPassword === forgotConfirmPassword;

  const canResend = resendSeconds === 0 && !isResending;
  const isOtpExpired = otpExpiresIn <= 0;

  const resetForgotFlow = () => {
    setMode("change");
    setForgotStep("send");
    setOtpDigits(["", "", "", "", "", ""]);
    setOtpError("");
    setOtpShake(false);
    setResetToken("");
    setForgotNewPassword("");
    setForgotConfirmPassword("");
    setForgotError("");
    setForgotSuccess("");
    setResendSeconds(OTP_RESEND_SECONDS);
    setOtpExpiresIn(OTP_EXPIRES_IN_SECONDS);
    setIsResending(false);
  };

  useEffect(() => {
    if (otpExpiresIn <= 0 || forgotStep !== "otp") return undefined;

    const timer = setTimeout(() => {
      setOtpExpiresIn((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => clearTimeout(timer);
  }, [otpExpiresIn, forgotStep]);

  useEffect(() => {
    if (resendSeconds <= 0 || forgotStep !== "otp") return undefined;

    const timer = setTimeout(() => {
      setResendSeconds((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => clearTimeout(timer);
  }, [resendSeconds, forgotStep]);

  const handleChangeSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {};

    if (!currentPassword) {
      nextErrors.current = "Current password is required.";
    }
    if (!newPassword) {
      nextErrors.newPassword = "New password is required.";
    } else if (!isPasswordStrong(newPassword)) {
      nextErrors.newPassword =
        "Password must be at least 8 characters with uppercase, lowercase, number, and special character.";
    }
    if (newPassword !== confirmPassword) {
      nextErrors.confirm = "Passwords do not match.";
    }

    if (Object.keys(nextErrors).length) {
      setChangeErrors(nextErrors);
      return;
    }

    if (!userId) {
      setChangeErrors({ form: "Unable to update password for this account." });
      return;
    }

    const sessionUser = loadAuthUser();
    if (!sessionUser?.userId && !sessionUser?.id) {
      setChangeErrors({ form: "Please log in again to change your password." });
      return;
    }

    try {
      setChangeSaving(true);
      setChangeErrors({});
      await changePassword({
        userId,
        currentPassword,
        newPassword,
        confirmPassword,
      });
      onPasswordReset?.({
        message: "Password changed successfully. Please log in again.",
      });
    } catch (error) {
      if (error.status === 401) {
        setChangeErrors({ form: "Please log in again to change your password." });
        return;
      }
      setChangeErrors({
        form: error?.message || "Password update failed.",
      });
    } finally {
      setChangeSaving(false);
    }
  };

  const handleSendOtp = async (event) => {
    event.preventDefault();
    setForgotError("");
    setForgotSuccess("");

    if (!userId || !email) {
      setForgotError("Unable to send verification code for this account.");
      return;
    }

    try {
      setSendOtpSaving(true);
      const data = await forgotPasswordRequestOtp({
        email,
        purpose: "forgot_password",
      });
      setForgotStep("otp");
      applyOtpSentTiming(data, { setOtpExpiresIn, setResendSeconds });
      setForgotSuccess("We sent a 6-digit verification code to your email.");
    } catch (error) {
      if (error.status === 429) {
        setForgotStep("otp");
        setResendSeconds(resolveRetryAfterSeconds(error.data || {}));
        setForgotError(error.message || "Please wait before requesting another code.");
        return;
      }
      setForgotError(error?.message || "Could not send verification code.");
    } finally {
      setSendOtpSaving(false);
    }
  };

  const triggerOtpShake = () => {
    setOtpShake(true);
    window.setTimeout(() => setOtpShake(false), 520);
  };

  const handleResendOtp = async () => {
    if (!canResend || !email) return;

    try {
      setIsResending(true);
      setOtpError("");
      const data = await forgotPasswordResendOtp({
        email,
        purpose: "forgot_password",
        userId,
      });
      setOtpDigits(["", "", "", "", "", ""]);
      applyOtpSentTiming(data, { setOtpExpiresIn, setResendSeconds });
      setForgotSuccess("A new verification code has been sent to your email.");
    } catch (error) {
      if (error.status === 429) {
        setResendSeconds(resolveRetryAfterSeconds(error.data || {}));
      }
      setOtpError(error?.message || "Could not resend verification code.");
      triggerOtpShake();
    } finally {
      setIsResending(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();

    if (isOtpExpired) {
      setOtpError("This code has expired. Please request a new code.");
      triggerOtpShake();
      return;
    }

    const code = otpDigits.join("");
    if (code.length < 6) {
      setOtpError("Please enter all 6 digits.");
      triggerOtpShake();
      return;
    }

    try {
      setOtpSaving(true);
      setOtpError("");
      const data = await forgotPasswordVerifyOtp({
        email,
        otp: code,
        purpose: "forgot_password",
        userId,
      });
      setResetToken(data.resetToken);
      setForgotStep("reset");
    } catch (error) {
      setOtpError(error?.message || "Invalid verification code.");
      triggerOtpShake();
    } finally {
      setOtpSaving(false);
    }
  };

  const handleForgotReset = async (event) => {
    event.preventDefault();
    setForgotError("");

    if (!canResetForgotPassword) {
      if (forgotNewPassword !== forgotConfirmPassword) {
        setForgotError("Passwords do not match.");
      }
      return;
    }

    try {
      setForgotSaving(true);
      await forgotPasswordReset({
        email,
        resetToken,
        newPassword: forgotNewPassword,
        confirmPassword: forgotConfirmPassword,
        userId,
      });
      onPasswordReset?.({
        message: "Password changed successfully. Please log in again.",
      });
    } catch (error) {
      setForgotError(error?.message || "Password reset failed.");
    } finally {
      setForgotSaving(false);
    }
  };

  if (mode === "forgot") {
    return (
      <div className="profile-dashboard__panel profile-dashboard__forgot-password">
        <div className="profile-dashboard__forgot-head">
          <h3>Reset password</h3>
          <button
            type="button"
            className="profile-dashboard__forgot-back"
            onClick={resetForgotFlow}
          >
            Back to change password
          </button>
        </div>

        {forgotStep === "send" ? (
          <form
            className="profile-dashboard__password-form profile-dashboard__forgot-step"
            onSubmit={handleSendOtp}
          >
            <label>
              Email
              <input type="email" value={email} readOnly aria-readonly="true" />
            </label>
            <button
              type="submit"
              className="profile-dashboard__btn profile-dashboard__btn--primary"
              disabled={sendOtpSaving}
            >
              {sendOtpSaving ? "Sending…" : "Send OTP"}
            </button>
            {forgotError ? (
              <p className="profile-dashboard__password-error" role="alert">
                {forgotError}
              </p>
            ) : null}
          </form>
        ) : null}

        {forgotStep === "otp" ? (
          <form
            className="profile-dashboard__password-form profile-dashboard__forgot-step"
            onSubmit={handleVerifyOtp}
          >
            <h4 className="profile-dashboard__forgot-step-title">Verify Your Account</h4>
            {forgotSuccess ? (
              <p className="profile-dashboard__panel-note">{forgotSuccess}</p>
            ) : (
              <p className="profile-dashboard__panel-note">
                Enter the 6-digit code sent to your email
              </p>
            )}
            <OtpCodeInput
              idPrefix="profile-reset-otp"
              value={otpDigits}
              onChange={(next) => {
                setOtpDigits(next);
                setOtpError("");
              }}
              disabled={otpSaving || isOtpExpired}
              error={Boolean(otpError)}
              shake={otpShake}
            />
            {otpExpiresIn > 0 ? (
              <p className="otp-expiry" aria-live="polite">
                {`This code expires in ${formatOtpExpiry(otpExpiresIn)}`}
              </p>
            ) : (
              <p className="profile-dashboard__password-error" role="alert">
                This code has expired. Please request a new code.
              </p>
            )}
            {otpError ? (
              <p className="profile-dashboard__password-error" role="alert">
                {otpError}
              </p>
            ) : null}
            <button
              type="submit"
              className="profile-dashboard__btn profile-dashboard__btn--primary"
              disabled={otpSaving || isOtpExpired}
            >
              {otpSaving ? "Verifying…" : "Verify OTP"}
            </button>
            {resendSeconds > 0 ? (
              <p className="otp-countdown" aria-live="polite">
                {`You can request a new code in ${resendSeconds}s`}
              </p>
            ) : (
              <button
                type="button"
                className="otp-resend-button profile-dashboard__forgot-link"
                onClick={handleResendOtp}
                disabled={isResending || otpSaving}
              >
                {isResending ? "Sending..." : "Resend Code"}
              </button>
            )}
          </form>
        ) : null}

        {forgotStep === "reset" ? (
          <form
            className="profile-dashboard__password-form profile-dashboard__forgot-step"
            onSubmit={handleForgotReset}
          >
            <label>
              Enter new password
              <input
                type="password"
                value={forgotNewPassword}
                onChange={(event) => setForgotNewPassword(event.target.value)}
                autoComplete="new-password"
              />
            </label>
            <ProfilePasswordStrength password={forgotNewPassword} />
            <label>
              Confirm new password
              <input
                type="password"
                value={forgotConfirmPassword}
                onChange={(event) => setForgotConfirmPassword(event.target.value)}
                autoComplete="new-password"
              />
            </label>
            {forgotConfirmPassword && forgotNewPassword !== forgotConfirmPassword ? (
              <p className="profile-dashboard__password-error" role="alert">
                Passwords do not match.
              </p>
            ) : null}
            <button
              type="submit"
              className="profile-dashboard__btn profile-dashboard__btn--primary"
              disabled={!canResetForgotPassword || forgotSaving}
            >
              {forgotSaving ? "Resetting…" : "Reset password"}
            </button>
            {forgotError ? (
              <p className="profile-dashboard__password-error" role="alert">
                {forgotError}
              </p>
            ) : null}
          </form>
        ) : null}
      </div>
    );
  }

  return (
    <div className="profile-dashboard__panel">
      <h3>Change password</h3>
      <form className="profile-dashboard__password-form" onSubmit={handleChangeSubmit}>
        <label>
          Current password
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
          />
          {changeErrors.current ? (
            <span className="profile-dashboard__password-error">{changeErrors.current}</span>
          ) : null}
        </label>
        <label>
          New password
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
          />
          {changeErrors.newPassword ? (
            <span className="profile-dashboard__password-error">{changeErrors.newPassword}</span>
          ) : null}
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
          />
          {changeErrors.confirm ? (
            <span className="profile-dashboard__password-error">{changeErrors.confirm}</span>
          ) : null}
        </label>
        <button
          type="submit"
          className="profile-dashboard__btn profile-dashboard__btn--primary"
          disabled={changeSaving}
        >
          {changeSaving ? "Updating…" : "Update password"}
        </button>
        {changeErrors.form ? (
          <p className="profile-dashboard__password-error" role="alert">
            {changeErrors.form}
          </p>
        ) : null}
      </form>
      <button
        type="button"
        className="profile-dashboard__forgot-link"
        onClick={() => {
          setMode("forgot");
          setForgotStep("send");
          setForgotError("");
          setForgotSuccess("");
        }}
      >
        Forgot password?
      </button>
    </div>
  );
}

function SessionsPanel() {
  return (
    <div className="profile-dashboard__panel">
      <h3>Active sessions</h3>
      <div className="profile-dashboard__session-card">
        <p className="profile-dashboard__session-title">Current session</p>
        <p className="profile-dashboard__session-meta">This device · Active now</p>
      </div>
      <button type="button" className="profile-dashboard__btn profile-dashboard__btn--ghost" disabled>
        Sign out other sessions
      </button>
    </div>
  );
}

function ProfilePage({
  profile,
  onSaveProfile,
  onSavePreferences,
  onApplyAvatar,
  initialEditMode = false,
  isAuthenticated,
  onNavigateLogin,
  onNavigateHome,
  onPasswordReset,
}) {
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activePanel, setActivePanel] = useState("profile");

  const welcomeDate = useMemo(() => formatWelcomeDate(), []);

  const user = profile ?? {};
  const displayName = useMemo(
    () => resolveDisplayName(profile ?? {}, user),
    [profile]
  );
  const username = useMemo(
    () => resolveUsername(profile ?? {}, user),
    [profile]
  );
  const welcomeName = displayName;

  useEffect(() => {
    setIsEditing(initialEditMode);
  }, [initialEditMode]);

  useEffect(() => {
    if (!profile) return;
    setDraft(buildDraft(profile));
  }, [profile]);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(""), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  if (!isAuthenticated) {
    return (
      <main className="profile-page profile-page--empty">
        <AccountBackHome onNavigateHome={onNavigateHome} className="profile-page__back-home" />
        <div className="profile-page__empty-panel">
          <h1>My Profile</h1>
          <p>Sign in to view and edit your profile.</p>
          <button type="button" className="profile-dashboard__btn profile-dashboard__btn--primary" onClick={onNavigateLogin}>
            Sign in
          </button>
        </div>
      </main>
    );
  }

  if (!profile || !draft) {
    return (
      <main className="profile-page profile-page--empty">
        <AccountBackHome onNavigateHome={onNavigateHome} className="profile-page__back-home" />
        <div className="profile-page__empty-panel">
          <p>Loading profile…</p>
        </div>
      </main>
    );
  }

  const email = profile?.email || draft.email || username || "";

  const coverGradient = getCoverGradient(draft.coverTheme || profile.coverTheme || "blue-cream");

  const handleChange = (field) => (event) => {
    setDraft((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleCancel = () => {
    setDraft(buildDraft(profile));
    setIsEditing(false);
    setSuccessMessage("");
    setErrorMessage("");
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setErrorMessage("");
      await onSaveProfile?.(draft);
      setIsEditing(false);
      setSuccessMessage("Profile saved successfully.");
    } catch {
      setErrorMessage("Could not save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSelectTheme = (themeId) => {
    setDraft((prev) => ({ ...prev, coverTheme: themeId }));
    onSavePreferences?.({ coverTheme: themeId });
  };

  const handleAccessibilityChange = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    onSavePreferences?.({ [key]: value });
  };

  const renderPanelContent = () => {
    if (activePanel === "appearance") {
      return (
        <AppearancePanel coverTheme={draft.coverTheme} onSelectTheme={handleSelectTheme} />
      );
    }
    if (activePanel === "accessibility") {
      return (
        <AccessibilityPanel
          prefs={{
            reduceMotion: draft.reduceMotion,
            largerText: draft.largerText,
            highContrast: draft.highContrast,
          }}
          onChange={handleAccessibilityChange}
        />
      );
    }
    if (activePanel === "password") {
      return <PasswordPanel profile={profile} onPasswordReset={onPasswordReset} />;
    }
    if (activePanel === "sessions") {
      return <SessionsPanel />;
    }

    return (
      <>
        <div className="profile-dashboard__form-grid">
          {FORM_FIELDS.map((field) => (
            <ProfileField
              key={field.key}
              field={field}
              value={draft[field.key]}
              isEditing={isEditing}
              onChange={handleChange(field.key)}
            />
          ))}

          <div className="profile-dashboard__field profile-dashboard__field--bio">
            <label htmlFor="profile-bio">Bio</label>
            {isEditing ? (
              <textarea
                id="profile-bio"
                className="profile-dashboard__bio-textarea"
                rows={4}
                value={draft.bio}
                placeholder="Tell us a little bit about yourself"
                onChange={handleChange("bio")}
              />
            ) : (
              <div className="profile-dashboard__field-value profile-dashboard__field-value--bio">
                {draft.bio || "Tell us a little bit about yourself"}
              </div>
            )}
          </div>
        </div>

        <section className="profile-dashboard__emails">
          <h3>My email address</h3>
          <div className="profile-dashboard__email-row">
            <span className="profile-dashboard__email-icon">
              <MailIcon />
            </span>
            <p className="profile-dashboard__email-text">{email || "—"}</p>
          </div>
          <button type="button" className="profile-dashboard__add-email" disabled={!isEditing}>
            +Add Email Address
          </button>
        </section>
      </>
    );
  };

  return (
    <main className="profile-page">
      <AccountBackHome onNavigateHome={onNavigateHome} className="profile-page__back-home" />

      <div className="profile-dashboard">
        <aside className="profile-dashboard__sidebar" aria-label="Profile navigation">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                className={`profile-dashboard__nav-item${
                  activePanel === item.key ? " is-active" : ""
                }`}
                onClick={() => setActivePanel(item.key)}
              >
                <span className="profile-dashboard__nav-icon">
                  <Icon />
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </aside>

        <div className="profile-dashboard__main">
          <header className="profile-dashboard__top">
            <div className="profile-dashboard__welcome">
              <h1>Welcome, {welcomeName}</h1>
              <p>{welcomeDate}</p>
            </div>

            <div className="profile-dashboard__top-actions">
              <label className="profile-dashboard__search">
                <SearchIcon />
                <input
                  type="search"
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  aria-label="Search profile"
                />
              </label>
              <button type="button" className="profile-dashboard__icon-btn" aria-label="Notifications">
                <BellIcon />
              </button>
            </div>
          </header>

          {successMessage ? (
            <p className="profile-dashboard__message profile-dashboard__message--success">
              {successMessage}
            </p>
          ) : null}
          {errorMessage ? (
            <p className="profile-dashboard__message profile-dashboard__message--error">{errorMessage}</p>
          ) : null}

          <div className="profile-dashboard__content">
            <article className="profile-dashboard__card">
            <div
              className="profile-dashboard__cover"
              style={{ background: coverGradient }}
              aria-hidden="true"
            />

            <div
              className="profile-dashboard__profile-header"
              style={{ background: `linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.85) 100%)` }}
            >
              <div className="profile-dashboard__avatar-block">
                <button
                  type="button"
                  className="profile-dashboard__avatar-btn"
                  onClick={() => isEditing && setShowAvatarPicker(true)}
                  disabled={!isEditing}
                  aria-label={isEditing ? "Edit avatar" : "Profile avatar"}
                >
                  <ProfileAvatar user={profile} />
                </button>
                {isEditing ? (
                  <button
                    type="button"
                    className="profile-dashboard__avatar-edit"
                    onClick={() => setShowAvatarPicker(true)}
                  >
                    Edit avatar
                  </button>
                ) : null}
              </div>

              <div className="profile-dashboard__identity">
                <h2>{welcomeName}</h2>
                <p>{email}</p>
              </div>

              {activePanel === "profile" ? (
                <div className="profile-dashboard__header-actions">
                  {!isEditing ? (
                    <button
                      type="button"
                      className="profile-dashboard__btn profile-dashboard__btn--primary"
                      onClick={() => setIsEditing(true)}
                    >
                      Edit
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="profile-dashboard__btn profile-dashboard__btn--ghost"
                        onClick={handleCancel}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="profile-dashboard__btn profile-dashboard__btn--primary"
                        onClick={handleSave}
                        disabled={saving}
                      >
                        {saving ? "Saving…" : "Save changes"}
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </div>

            <div className="profile-dashboard__card-body">
              {renderPanelContent()}
            </div>
          </article>
          </div>
        </div>
      </div>

      <AvatarPickerModal
        isOpen={showAvatarPicker}
        onClose={() => setShowAvatarPicker(false)}
        user={profile}
        onSave={onApplyAvatar}
      />
    </main>
  );
}

export default ProfilePage;
