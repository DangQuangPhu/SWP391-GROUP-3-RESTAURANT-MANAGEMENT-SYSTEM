import { useEffect, useState } from "react";
import {
  changePassword,
  forgotPasswordRequestOtp,
  forgotPasswordVerifyOtp,
  forgotPasswordResendOtp,
  forgotPasswordReset,
  loadAuthUser,
} from "../auth/api";
import { isPasswordStrong, normalizePhone, isValidVietnamPhone } from "../auth/authHelpers";
import {
  OTP_EXPIRES_IN_SECONDS,
  OTP_RESEND_COOLDOWN_SECONDS,
  applyOtpSentTiming,
  resolveRetryAfterSeconds,
} from "../auth/otpTiming";
import OtpVerificationModal from "./OtpVerificationModal";

const OTP_RESEND_SECONDS = OTP_RESEND_COOLDOWN_SECONDS;
const PHONE_OTP_PURPOSE = "phone_update";

function mapPhoneSaveError(error) {
  const apiErrors = error?.data?.errors;
  if (apiErrors && typeof apiErrors === "object") {
    const nonPhoneFields = [
      "dateOfBirth",
      "firstName",
      "lastName",
      "username",
      "gender",
      "bio",
      "address",
      "email",
    ];
    if (Object.keys(apiErrors).some((key) => nonPhoneFields.includes(key))) {
      return new Error("Could not save phone number. Please try again.");
    }
    const phoneError = apiErrors.phoneNumber || apiErrors.phone;
    if (phoneError) {
      return new Error(phoneError);
    }
  }

  const message = String(error?.message || "").trim();
  if (
    message === "Validation failed." ||
    message.toLowerCase().includes("date of birth") ||
    message.toLowerCase().includes("first name")
  ) {
    return new Error("Could not save phone number. Please try again.");
  }

  return new Error(message || "Could not save phone number.");
}

function formatPhoneDisplay(phone) {
  const digits = normalizePhone(phone);
  if (!digits) return "";
  if (digits.startsWith("84") && digits.length >= 11) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return String(phone).trim();
}

function ProfilePasswordStrength({ password }) {
  if (!password) return null;
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const lengthOk = password.length >= 8;
  let level = "weak";
  let bars = 1;
  if (lengthOk && hasLower && hasNumber) {
    level = isPasswordStrong(password) ? "strong" : "medium";
    bars = isPasswordStrong(password) ? 3 : 2;
  }

  return (
    <div className="profile-dashboard__password-strength" aria-live="polite">
      <div className="profile-dashboard__strength-bars" aria-hidden="true">
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className={`profile-dashboard__strength-bar${
              bar <= bars ? ` is-${level}` : ""
            }`}
          />
        ))}
      </div>
      <span className={`profile-dashboard__strength-label is-${level}`}>
        {level === "strong" ? "Strong" : level === "medium" ? "Medium" : "Weak"}
      </span>
    </div>
  );
}

function isProfilePasswordValid(password) {
  return (
    Boolean(password) &&
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

function SignInMethodRow({ label, value, emptyLabel, actionLabel, onManage, isManaging, children }) {
  return (
    <div className="profile-auth__method">
      <div className="profile-auth__method-row">
        <div className="profile-auth__method-info">
          <span className="profile-auth__method-label">{label}</span>
          <span className="profile-auth__method-value">{value || emptyLabel}</span>
        </div>
        <button type="button" className="profile-auth__manage-btn" onClick={onManage}>
          {isManaging ? "Hide" : actionLabel}
        </button>
      </div>
      <div className={`profile-auth__manage-panel collapsible-panel${isManaging ? " is-open" : ""}`}>
        <div className="collapsible-panel__inner">{children}</div>
      </div>
    </div>
  );
}

function PasswordAuthenticationPanel({ profile, onPasswordReset, onPhoneUpdate }) {
  /** @type {"hidden" | "change" | "reset-after-otp"} */
  const [passwordMode, setPasswordMode] = useState("hidden");
  const [manageEmail, setManageEmail] = useState(false);
  const [managePhone, setManagePhone] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changeErrors, setChangeErrors] = useState({});
  const [changeSaving, setChangeSaving] = useState(false);

  const [phoneDraft, setPhoneDraft] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);

  const [emailNotice, setEmailNotice] = useState("");

  const [otpOpen, setOtpOpen] = useState(false);
  const [otpPurpose, setOtpPurpose] = useState(null);
  const [otpExpiresIn, setOtpExpiresIn] = useState(OTP_EXPIRES_IN_SECONDS);
  const [resendSeconds, setResendSeconds] = useState(OTP_RESEND_SECONDS);
  const [isResending, setIsResending] = useState(false);
  const [sendOtpSaving, setSendOtpSaving] = useState(false);

  const [resetToken, setResetToken] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [forgotFieldErrors, setForgotFieldErrors] = useState({});
  const [forgotFormError, setForgotFormError] = useState("");
  const [forgotSaving, setForgotSaving] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState("");

  const userId = profile?.userId ?? profile?.id;
  const email = profile?.email || "";
  const phone = profile?.phone || profile?.phoneNumber || "";

  useEffect(() => {
    setPhoneDraft(phone);
  }, [phone]);

  useEffect(() => {
    if (otpExpiresIn <= 0 || !otpOpen) return undefined;
    const timer = setTimeout(() => setOtpExpiresIn((prev) => Math.max(prev - 1, 0)), 1000);
    return () => clearTimeout(timer);
  }, [otpExpiresIn, otpOpen]);

  useEffect(() => {
    if (resendSeconds <= 0 || !otpOpen) return undefined;
    const timer = setTimeout(() => setResendSeconds((prev) => Math.max(prev - 1, 0)), 1000);
    return () => clearTimeout(timer);
  }, [resendSeconds, otpOpen]);

  const startOtpFlow = async (purpose) => {
    if (!email?.trim()) {
      const message = "Unable to start verification. No email on file.";
      if (purpose === "phone") {
        setPhoneError(message);
      } else {
        setChangeErrors({ form: message });
      }
      return;
    }

    if (purpose === "phone" && !userId) {
      setPhoneError("Unable to verify phone. Please log in again.");
      return;
    }

    setOtpPurpose(purpose);
    setSendOtpSaving(true);
    try {
      const data = await forgotPasswordRequestOtp({
        email,
        purpose: purpose === "phone" ? PHONE_OTP_PURPOSE : "forgot_password",
      });
      applyOtpSentTiming(data, { setOtpExpiresIn, setResendSeconds });
      setOtpOpen(true);
    } catch (error) {
      if (error.status === 429) {
        applyOtpSentTiming(error.data || {}, { setOtpExpiresIn, setResendSeconds });
        setOtpOpen(true);
        return;
      }
      if (purpose === "phone") {
        setPhoneError(error?.message || "Could not send verification code.");
      } else {
        setChangeErrors({ form: error?.message || "Could not send verification code." });
      }
    } finally {
      setSendOtpSaving(false);
    }
  };

  const handleOtpClose = (result) => {
    setOtpOpen(false);
    if (result?.success && otpPurpose === "forgot") {
      setPasswordMode("reset-after-otp");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setChangeErrors({});
      setForgotFieldErrors({});
      setForgotFormError("");
    }
  };

  const handleOtpResend = async () => {
    if (resendSeconds > 0 || isResending) return;
    try {
      setIsResending(true);
      const data = await forgotPasswordResendOtp({
        email,
        purpose: otpPurpose === "phone" ? PHONE_OTP_PURPOSE : "forgot_password",
        userId,
      });
      applyOtpSentTiming(data, { setOtpExpiresIn, setResendSeconds });
    } catch (error) {
      if (error.status === 429) {
        setResendSeconds(resolveRetryAfterSeconds(error.data || {}));
      }
      throw error;
    } finally {
      setIsResending(false);
    }
  };

  const handleOtpVerify = async (code) => {
    const normalizedCode = String(code || "").trim();

    if (otpPurpose === "phone") {
      const pendingPhone = normalizePhone(phoneDraft);
      if (!pendingPhone) {
        throw new Error("Phone number is required.");
      }
      if (normalizedCode.length !== 6) {
        throw new Error("Invalid OTP code. Please try again.");
      }

      await forgotPasswordVerifyOtp({
        email,
        otp: normalizedCode,
        purpose: PHONE_OTP_PURPOSE,
        phone: pendingPhone,
      });

      try {
        await onPhoneUpdate?.(pendingPhone);
        setManagePhone(false);
      } catch (error) {
        throw mapPhoneSaveError(error);
      }
      return;
    }

    const data = await forgotPasswordVerifyOtp({
      email,
      otp: normalizedCode,
      purpose: "forgot_password",
    });

    if (otpPurpose === "forgot") {
      setResetToken(data.resetToken || "");
      return;
    }

    if (otpPurpose === "email") {
      // TODO: Wire POST /profile/:userId/email when backend endpoint is available.
      setEmailNotice("Email change is not available yet. Your current email remains verified.");
      setManageEmail(false);
    }
  };

  const handleChangeSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {};

    if (!currentPassword) {
      nextErrors.current = "Old password is required.";
    }
    if (!newPassword) {
      nextErrors.newPassword = "New password is required.";
    } else if (!isProfilePasswordValid(newPassword)) {
      nextErrors.newPassword =
        "Password must be at least 8 characters with a lowercase letter and a number.";
    } else if (!isPasswordStrong(newPassword)) {
      nextErrors.newPassword =
        "Include uppercase, lowercase, number, and special character for a stronger password.";
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
        setChangeErrors({ form: "Old password is incorrect." });
        return;
      }
      setChangeErrors({
        form: error?.message || "Password update failed.",
      });
    } finally {
      setChangeSaving(false);
    }
  };

  const handlePhoneSave = async () => {
    setPhoneError("");
    const trimmed = phoneDraft.trim();
    if (trimmed && !isValidVietnamPhone(trimmed)) {
      setPhoneError("Enter a valid phone number (10–11 digits).");
      return;
    }
    setPhoneSaving(true);
    try {
      await startOtpFlow("phone");
    } finally {
      setPhoneSaving(false);
    }
  };

  const handleForgotPassword = async () => {
    setChangeErrors({});
    setForgotFormError("");
    setForgotFieldErrors({});
    setResetSuccessMessage("");
    await startOtpFlow("forgot");
  };

  const togglePasswordPanel = () => {
    if (passwordMode === "hidden") {
      setPasswordMode("change");
      setResetSuccessMessage("");
      return;
    }

    setPasswordMode("hidden");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setChangeErrors({});
    setForgotNewPassword("");
    setForgotConfirmPassword("");
    setForgotFieldErrors({});
    setForgotFormError("");
    setResetToken("");
    setResetSuccessMessage("");
  };

  const handleForgotReset = async (event) => {
    event.preventDefault();
    setForgotFormError("");
    const nextErrors = {};

    if (!forgotNewPassword) {
      nextErrors.newPassword = "New password is required.";
    } else if (!isProfilePasswordValid(forgotNewPassword)) {
      nextErrors.newPassword =
        "Password must be at least 8 characters with a lowercase letter and a number.";
    }

    if (!forgotConfirmPassword) {
      nextErrors.confirm = "Confirm password is required.";
    } else if (forgotNewPassword !== forgotConfirmPassword) {
      nextErrors.confirm = "Passwords do not match.";
    }

    if (Object.keys(nextErrors).length) {
      setForgotFieldErrors(nextErrors);
      return;
    }

    if (!resetToken) {
      setForgotFormError("Session expired. Please request a new verification code.");
      return;
    }

    try {
      setForgotSaving(true);
      setForgotFieldErrors({});
      await forgotPasswordReset({
        email,
        resetToken,
        newPassword: forgotNewPassword,
        confirmPassword: forgotConfirmPassword,
        userId,
      });
      setResetSuccessMessage("Password changed successfully. Please log in again.");
      setPasswordMode("hidden");
      setForgotNewPassword("");
      setForgotConfirmPassword("");
      setResetToken("");
      onPasswordReset?.({
        message: "Password changed successfully. Please log in again.",
      });
    } catch (error) {
      setForgotFormError(error?.message || "Password reset failed.");
    } finally {
      setForgotSaving(false);
    }
  };

  const otpSubtitle =
    otpPurpose === "phone"
      ? `Enter the 6-digit code sent to ${email} to confirm your phone update.`
      : otpPurpose === "email"
        ? `Enter the 6-digit code sent to ${email} to manage your email.`
        : `Enter the 6-digit code sent to ${email}`;

  return (
    <div className="profile-dashboard__panel profile-auth">
      <h3 className="profile-gradient-title">Password &amp; Authentication</h3>
      <p className="profile-dashboard__panel-desc">Sign in methods</p>

      <SignInMethodRow
        label="Email"
        value={email}
        emptyLabel="No email on file"
        actionLabel="Manage"
        isManaging={manageEmail}
        onManage={() => {
          setManageEmail((prev) => !prev);
          setEmailNotice("");
        }}
      >
        <p className="profile-dashboard__panel-note">
          Your verified email is used for sign-in and security codes.
        </p>
        <label className="profile-auth__field">
          Current email
          <input type="email" value={email} readOnly aria-readonly="true" />
        </label>
        <label className="profile-auth__field">
          New email
          <input type="email" placeholder="new@example.com" disabled />
        </label>
        <p className="profile-dashboard__panel-note">
          Email changes require OTP verification. Backend endpoint pending — contact support if you
          need to update your email.
        </p>
        {emailNotice ? (
          <p className="profile-dashboard__message profile-dashboard__message--success">{emailNotice}</p>
        ) : null}
        <button
          type="button"
          className="profile-dashboard__btn profile-dashboard__btn--primary"
          disabled
          title="Email update API not yet available"
        >
          Save email
        </button>
      </SignInMethodRow>

      <SignInMethodRow
        label="Phone number"
        value={formatPhoneDisplay(phone)}
        emptyLabel="No phone number added"
        actionLabel="Manage"
        isManaging={managePhone}
        onManage={() => {
          setManagePhone((prev) => !prev);
          setPhoneDraft(phone);
          setPhoneError("");
        }}
      >
        <label className="profile-auth__field">
          Phone number
          <input
            type="tel"
            value={phoneDraft}
            placeholder="+84 964 813 966"
            onChange={(event) => {
              setPhoneDraft(event.target.value);
              setPhoneError("");
            }}
          />
          {phoneError ? (
            <span className="profile-dashboard__password-error">{phoneError}</span>
          ) : null}
        </label>
        <button
          type="button"
          className="profile-dashboard__btn profile-dashboard__btn--primary"
          onClick={handlePhoneSave}
          disabled={phoneSaving || sendOtpSaving}
        >
          {phoneSaving || sendOtpSaving ? "Sending code…" : "Save phone number"}
        </button>
      </SignInMethodRow>

      <SignInMethodRow
        label="Password"
        value="Password configured"
        emptyLabel="No password set"
        actionLabel={passwordMode === "hidden" ? "Change password" : "Hide"}
        isManaging={passwordMode !== "hidden"}
        onManage={togglePasswordPanel}
      >
        {resetSuccessMessage ? (
          <p className="profile-dashboard__message profile-dashboard__message--success" role="status">
            {resetSuccessMessage}
          </p>
        ) : null}

        {passwordMode === "change" ? (
          <>
            <form className="profile-dashboard__password-form" onSubmit={handleChangeSubmit}>
              <label>
                Old password
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
              <ProfilePasswordStrength password={newPassword} />
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
              onClick={handleForgotPassword}
              disabled={sendOtpSaving}
            >
              {sendOtpSaving && otpPurpose === "forgot" ? "Sending code…" : "I forgot my password"}
            </button>
          </>
        ) : null}

        {passwordMode === "reset-after-otp" ? (
          <div className="profile-auth__forgot-reset">
            <h4>Set a new password</h4>
            <p className="profile-dashboard__panel-note">
              Your identity was verified. Choose a new password below.
            </p>
            <form className="profile-dashboard__password-form" onSubmit={handleForgotReset}>
              <label>
                New password
                <input
                  type="password"
                  value={forgotNewPassword}
                  onChange={(event) => {
                    setForgotNewPassword(event.target.value);
                    setForgotFieldErrors((prev) => ({ ...prev, newPassword: "" }));
                    setForgotFormError("");
                  }}
                  autoComplete="new-password"
                />
                {forgotFieldErrors.newPassword ? (
                  <span className="profile-dashboard__password-error">{forgotFieldErrors.newPassword}</span>
                ) : null}
              </label>
              <ProfilePasswordStrength password={forgotNewPassword} />
              <label>
                Confirm new password
                <input
                  type="password"
                  value={forgotConfirmPassword}
                  onChange={(event) => {
                    setForgotConfirmPassword(event.target.value);
                    setForgotFieldErrors((prev) => ({ ...prev, confirm: "" }));
                    setForgotFormError("");
                  }}
                  autoComplete="new-password"
                />
                {forgotFieldErrors.confirm ? (
                  <span className="profile-dashboard__password-error">{forgotFieldErrors.confirm}</span>
                ) : null}
              </label>
              {forgotFormError ? (
                <p className="profile-dashboard__password-error" role="alert">
                  {forgotFormError}
                </p>
              ) : null}
              <button
                type="submit"
                className="profile-dashboard__btn profile-dashboard__btn--primary"
                disabled={forgotSaving}
              >
                {forgotSaving ? "Resetting…" : "Reset password"}
              </button>
            </form>
          </div>
        ) : null}
      </SignInMethodRow>

      <OtpVerificationModal
        isOpen={otpOpen}
        onClose={handleOtpClose}
        title="Verify Your Account"
        subtitle={otpSubtitle}
        onVerify={handleOtpVerify}
        onResend={handleOtpResend}
        resendSeconds={resendSeconds}
        otpExpiresIn={otpExpiresIn}
        isResending={isResending}
      />
    </div>
  );
}

export default PasswordAuthenticationPanel;
