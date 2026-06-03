import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getProfile,
  updateProfile,
  uploadProfileAvatar,
  updateSystemAvatar,
  updateGoogleAvatar,
  verifyOldPassword,
  resetProfilePassword,
  forgotPasswordRequest,
} from "./api";
import { SYSTEM_AVATARS, getAvatarSrc, normalizeStoredAvatarUrl } from "./avatarUtils";
import UserAvatar from "./UserAvatar";
import SystemAvatarOption from "./SystemAvatarOption";
import OtpVerification from "./OtpVerification";
import ResetPasswordForm from "./ResetPasswordForm";
import "../../styles/auth.css";
import {
  getDisplayName,
  getPasswordStrength,
  isPasswordStrong,
  validateName,
  validateUsername,
  isValidVietnamPhone,
  normalizePhone,
  isAtLeast13YearsOld,
  parseDateOfBirth,
  validateAvatarFile,
} from "./authHelpers";
import "../../styles/profileModal.css";

const PROFILE_MODES = {
  VIEW: "view",
  EDIT_PROFILE: "editProfile",
  CHANGE_AVATAR: "changeAvatar",
  CHANGE_PASSWORD: "changePassword",
  FORGOT_PASSWORD_OTP: "forgotPasswordOtp",
  RESET_PASSWORD: "resetPassword",
};

function mapInitialViewToMode(initialView) {
  if (initialView === "password") return PROFILE_MODES.CHANGE_PASSWORD;
  if (initialView === "edit") return PROFILE_MODES.EDIT_PROFILE;
  return PROFILE_MODES.VIEW;
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

function PasswordField({ id, label, value, onChange, error }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="profile-edit__field">
      <span>{label}</span>
      <div className={`profile-edit__password${error ? " profile-edit__password--error" : ""}`}>
        <input id={id} type={visible ? "text" : "password"} value={value} onChange={onChange} />
        <button
          type="button"
          className="profile-edit__toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          <EyeIcon visible={visible} />
        </button>
      </div>
      {error ? <em>{error}</em> : null}
    </label>
  );
}

function ProfileModal({
  isOpen,
  onClose,
  user,
  onSave,
  initialView = "view",
  onPasswordReset,
}) {
  const [draft, setDraft] = useState(null);
  const [profileMode, setProfileMode] = useState(PROFILE_MODES.VIEW);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);
  const [saving, setSaving] = useState(false);
  const [passwordStep, setPasswordStep] = useState("choose");
  const [forgotOtpUser, setForgotOtpUser] = useState(null);
  const [resetSession, setResetSession] = useState(null);
  const [oldPassword, setOldPassword] = useState("");
  const [oldPasswordToken, setOldPasswordToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState({});
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarSaving, setAvatarSaving] = useState(false);
  const fileInputRef = useRef(null);
  const wasOpenRef = useRef(false);

  const resetSubState = () => {
    setPasswordStep("choose");
    setForgotOtpUser(null);
    setResetSession(null);
    setOldPassword("");
    setOldPasswordToken("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordErrors({});
    setAvatarPreview("");
    setErrors({});
    setAlert(null);
  };

  const goToView = () => {
    console.log("Switching to view");
    setProfileMode(PROFILE_MODES.VIEW);
    resetSubState();
  };

  const applyAvatarUpdate = (data) => {
    const base = data.user || { ...draft, avatarUrl: data.avatarUrl };
    const nextUser = {
      ...base,
      avatarUrl: normalizeStoredAvatarUrl(data.avatarUrl || base.avatarUrl),
      id: base.id ?? base.userId,
      userId: base.userId ?? base.id,
    };
    setDraft(nextUser);
    if (avatarPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarPreview("");
    onSave?.(nextUser);
    console.log("Avatar saved — returning to view");
    setProfileMode(PROFILE_MODES.VIEW);
  };

  // Reset mode only when modal closes
  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      setProfileMode(PROFILE_MODES.VIEW);
      resetSubState();
      setDraft(null);
    }
  }, [isOpen]);

  // Initialize draft only when modal first opens — NOT when `user` updates from onSave
  useEffect(() => {
    if (!isOpen || !user) return;

    const justOpened = !wasOpenRef.current;
    wasOpenRef.current = true;

    if (!justOpened) {
      setDraft((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          avatarUrl: normalizeStoredAvatarUrl(user.avatarUrl ?? prev.avatarUrl),
        };
      });
      return;
    }

    const base = {
      ...user,
      id: user.id ?? user.userId,
      userId: user.userId ?? user.id,
    };
    setDraft(base);
    const mode = mapInitialViewToMode(initialView);
    setProfileMode(mode);
    console.log("Profile mode:", mode);
    resetSubState();

    const uid = base.userId ?? base.id;
    if (!uid) return;

    getProfile(uid)
      .then((data) => {
        if (!data?.user) return;
        const merged = {
          ...data.user,
          avatarUrl: normalizeStoredAvatarUrl(data.user.avatarUrl),
          id: data.user.id ?? data.user.userId,
          userId: data.user.userId ?? data.user.id,
        };
        setDraft(merged);
        onSave?.(merged);
      })
      .catch(() => {});
  }, [isOpen, user, initialView, onSave]);

  useEffect(() => {
    console.log("Profile mode:", profileMode);
  }, [profileMode]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleEscape = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !user || !draft) return null;

  const userId = draft.id ?? draft.userId;
  const isEditProfile = profileMode === PROFILE_MODES.EDIT_PROFILE;
  const isChangeAvatar = profileMode === PROFILE_MODES.CHANGE_AVATAR;
  const isChangePassword =
    profileMode === PROFILE_MODES.CHANGE_PASSWORD ||
    profileMode === PROFILE_MODES.FORGOT_PASSWORD_OTP ||
    profileMode === PROFILE_MODES.RESET_PASSWORD;
  const isForgotOtp = profileMode === PROFILE_MODES.FORGOT_PASSWORD_OTP;
  const isResetPassword = profileMode === PROFILE_MODES.RESET_PASSWORD;

  const update = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validateProfile = () => {
    const next = {};
    const fn = validateName(draft.firstName, "First name");
    if (fn) next.firstName = fn;
    const ln = validateName(draft.lastName, "Last name");
    if (ln) next.lastName = ln;
    const un = validateUsername(draft.username);
    if (un) next.username = un;
    const phone = normalizePhone(draft.phone);
    if (!phone) next.phone = "Phone number is required.";
    else if (!isValidVietnamPhone(draft.phone)) {
      next.phone = "Phone number must be 10–11 digits.";
    }
    if (!draft.dateOfBirth) next.dateOfBirth = "Date of birth is required.";
    else if (!parseDateOfBirth(draft.dateOfBirth)) {
      next.dateOfBirth = "Enter a valid date of birth.";
    } else if (!isAtLeast13YearsOld(draft.dateOfBirth)) {
      next.dateOfBirth = "You must be at least 13 years old.";
    }
    return next;
  };

  const handleSave = async () => {
    const validation = validateProfile();
    if (Object.keys(validation).length) {
      setErrors(validation);
      return;
    }

    try {
      setSaving(true);
      setAlert(null);
      const payload = {
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        username: draft.username.trim().toLowerCase(),
        phone: normalizePhone(draft.phone),
        dateOfBirth: draft.dateOfBirth,
      };

      const data = await updateProfile(userId, payload);
      const merged = {
        ...draft,
        ...data.user,
        avatarUrl: normalizeStoredAvatarUrl(data.user?.avatarUrl ?? draft.avatarUrl),
      };
      setDraft(merged);
      onSave?.(merged);
      setAlert({ type: "success", message: "Profile saved successfully." });
      goToView();
    } catch (error) {
      const field = error.data?.field;
      if (field === "username") setErrors({ username: error.message });
      else if (field === "phoneNumber") setErrors({ phone: error.message });
      setAlert({ type: "error", message: error?.message || "Profile update failed." });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileError = validateAvatarFile(file);
    if (fileError) {
      setAlert({ type: "error", message: fileError });
      return;
    }

    setAvatarPreview(URL.createObjectURL(file));
    setAlert(null);

    try {
      setAvatarSaving(true);
      const data = await uploadProfileAvatar(userId, file);
      applyAvatarUpdate(data);
      setAlert({ type: "success", message: data.message || "Avatar updated successfully." });
    } catch (error) {
      setAvatarPreview("");
      setAlert({ type: "error", message: error.message || "Avatar update failed." });
    } finally {
      setAvatarSaving(false);
      event.target.value = "";
    }
  };

  const handleSystemAvatarSelect = async (avatarPath) => {
    setAvatarPreview(avatarPath);
    setAlert(null);

    try {
      setAvatarSaving(true);
      const data = await updateSystemAvatar(userId, avatarPath);
      applyAvatarUpdate(data);
      setAlert({ type: "success", message: data.message || "Avatar updated successfully." });
    } catch (error) {
      setAvatarPreview("");
      setAlert({ type: "error", message: error.message || "Avatar update failed." });
    } finally {
      setAvatarSaving(false);
    }
  };

  const handleForgotOldPassword = async () => {
    const email = draft?.email?.trim();
    if (!email) {
      setAlert({ type: "error", message: "Email is required to reset your password." });
      return;
    }

    try {
      setSaving(true);
      setAlert(null);
      const data = await forgotPasswordRequest({ userId, identifier: email });
      setForgotOtpUser({
        userId: data.userId || userId,
        email: data.email || email,
        verificationMode: "reset-password",
      });
      console.log("Switching to forgotPasswordOtp");
      setProfileMode(PROFILE_MODES.FORGOT_PASSWORD_OTP);
      setAlert({
        type: "success",
        message: data.message || "Password reset code sent to your email.",
      });
    } catch (error) {
      setAlert({ type: "error", message: error.message || "Could not send reset code." });
    } finally {
      setSaving(false);
    }
  };

  const handleForgotOtpVerified = ({ resetToken, userId: verifiedUserId }) => {
    setResetSession({
      userId: verifiedUserId || userId,
      resetToken,
    });
    console.log("Switching to resetPassword");
    setProfileMode(PROFILE_MODES.RESET_PASSWORD);
    setAlert({ type: "success", message: "OTP verified. You can now reset your password." });
  };

  const handleForgotResetSuccess = () => {
    onPasswordReset?.({
      message: "Password reset successfully. Please sign in with your new password.",
    });
  };

  const handleVerifyOldPassword = async () => {
    if (!oldPassword) {
      setPasswordErrors({ old: "Old password is required." });
      return;
    }
    try {
      setSaving(true);
      const data = await verifyOldPassword(userId, oldPassword);
      setOldPasswordToken(data.oldPasswordVerifiedToken);
      setPasswordStep("old-new");
      setPasswordErrors({});
      setAlert({ type: "success", message: data.message || "Old password verified." });
    } catch (error) {
      setPasswordErrors({ old: error.message || "Old password is incorrect." });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    const next = {};
    if (!isPasswordStrong(newPassword)) {
      next.newPassword =
        "Password must be at least 8 characters with uppercase, lowercase, number, and special character.";
    }
    if (newPassword !== confirmPassword) {
      next.confirm = "Passwords do not match.";
    }
    if (Object.keys(next).length) {
      setPasswordErrors(next);
      return;
    }

    try {
      setSaving(true);
      await resetProfilePassword({
        userId,
        oldPasswordVerifiedToken: oldPasswordToken,
        newPassword,
        confirmPassword,
      });
      onPasswordReset?.({
        message: "Password changed successfully. Please sign in again.",
      });
    } catch (error) {
      setAlert({ type: "error", message: error.message || "Password change failed." });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setDraft({
      ...user,
      id: user.id ?? user.userId,
      userId: user.userId ?? user.id,
    });
    goToView();
  };

  const handleCancelAvatar = () => {
    if (avatarPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarPreview("");
    goToView();
  };

  const strength = getPasswordStrength(newPassword);
  const displayName = getDisplayName(draft);
  const previewUser = avatarPreview ? { ...draft, avatarUrl: avatarPreview } : draft;
  const showProfileFields = !isChangePassword && !isChangeAvatar;
  const fieldsReadOnly = !isEditProfile;

  return createPortal(
    <div className="profile-edit" role="presentation">
      <div className="profile-edit__overlay" onClick={onClose} aria-hidden="true" />
      <div
        className="profile-edit__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Profile"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="profile-edit__close" onClick={onClose} aria-label="Close">
          &times;
        </button>

        <div className="profile-edit__banner" />
        <div className="profile-edit__head">
          <div className="profile-edit__avatar-wrap">
            <UserAvatar user={previewUser} size="lg" imgClassName="profile-edit__avatar-img" />
            {profileMode === PROFILE_MODES.VIEW ? (
              <button
                type="button"
                className="profile-edit__avatar-btn"
                onClick={() => {
                  console.log("Switching to changeAvatar");
                  setProfileMode(PROFILE_MODES.CHANGE_AVATAR);
                  setAlert(null);
                }}
              >
                Change Avatar
              </button>
            ) : null}
          </div>
          <div>
            <h2>{displayName}</h2>
            <p>@{draft.username}</p>
          </div>
        </div>

        {isChangeAvatar ? (
          <div className="profile-edit__avatar-picker">
            <p className="profile-edit__avatar-picker-title">Choose a new avatar</p>
            <div className="profile-edit__avatar-options">
              {draft.googleAvatarUrl ? (
                <button
                  type="button"
                  className="profile-edit__avatar-option profile-edit__avatar-option--google"
                  style={{ background: "#faf8f4", color: "black", border: "none", marginBottom: "0.5rem" }}
                  onClick={async () => {
                    setAvatarPreview(draft.googleAvatarUrl);
                    setAlert(null);
                    try {
                      setAvatarSaving(true);
                      const data = await updateGoogleAvatar(userId);
                      applyAvatarUpdate(data);
                      setAlert({ type: "success", message: data.message || "Avatar updated successfully." });
                    } catch (error) {
                      setAvatarPreview("");
                      setAlert({ type: "error", message: error.message || "Avatar update failed." });
                    } finally {
                      setAvatarSaving(false);
                    }
                  }}
                  disabled={avatarSaving}
                >
                  Use your Google avatar
                </button>
              ) : null}
              <button
                type="button"
                className="profile-edit__avatar-option profile-edit__avatar-option--upload"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarSaving}
              >
                Upload from device
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="profile-edit__file"
                onChange={handleAvatarFileSelect}
              />
            </div>
            <p className="profile-edit__avatar-picker-sub">Or choose a random avatar</p>
            <div className="profile-edit__avatar-grid">
              {SYSTEM_AVATARS.map((path) => (
                <SystemAvatarOption
                  key={path}
                  path={path}
                  isActive={getAvatarSrc(draft) === path}
                  disabled={avatarSaving}
                  onSelect={handleSystemAvatarSelect}
                />
              ))}
            </div>
            <button type="button" className="profile-edit__link-btn" onClick={handleCancelAvatar}>
              Cancel
            </button>
          </div>
        ) : null}

        {alert ? (
          <div className={`profile-edit__alert profile-edit__alert--${alert.type}`}>
            {alert.message}
          </div>
        ) : null}

        {isChangePassword && !isForgotOtp && !isResetPassword ? (
          <div className="profile-edit__body">
            <h3>Change Password</h3>

            {passwordStep === "choose" ? (
              <div className="profile-edit__password-choose">
                <p className="profile-edit__password-hint">
                  Choose how you want to change your password.
                </p>
                <button
                  type="button"
                  className="profile-edit__btn profile-edit__btn--gold"
                  onClick={() => {
                    setPasswordStep("old");
                    setAlert(null);
                  }}
                >
                  I remember my old password
                </button>
                <button
                  type="button"
                  className="profile-edit__btn profile-edit__btn--outline"
                  onClick={handleForgotOldPassword}
                  disabled={saving}
                >
                  {saving ? "SENDING CODE..." : "Forgot old password?"}
                </button>
              </div>
            ) : null}

            {passwordStep === "old" ? (
              <>
                <PasswordField
                  id="pw-old"
                  label="Old Password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  error={passwordErrors.old}
                />
                <button
                  type="button"
                  className="profile-edit__btn profile-edit__btn--gold"
                  onClick={handleVerifyOldPassword}
                  disabled={saving}
                >
                  {saving ? "VERIFYING..." : "Verify Old Password"}
                </button>
                <button
                  type="button"
                  className="profile-edit__link-btn"
                  onClick={handleForgotOldPassword}
                  disabled={saving}
                >
                  Forgot old password?
                </button>
                <button
                  type="button"
                  className="profile-edit__link-btn"
                  onClick={() => setPasswordStep("choose")}
                >
                  Back
                </button>
              </>
            ) : null}

            {passwordStep === "old-new" ? (
              <>
                <PasswordField
                  id="pw-new"
                  label="Enter New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  error={passwordErrors.newPassword}
                />
                <div className="auth-strength">
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
                <PasswordField
                  id="pw-confirm"
                  label="Confirm New Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  error={passwordErrors.confirm}
                />
                <button
                  type="button"
                  className="profile-edit__btn profile-edit__btn--gold"
                  onClick={handleChangePassword}
                  disabled={saving}
                >
                  {saving ? "SAVING..." : "Save New Password"}
                </button>
              </>
            ) : null}

            <button type="button" className="profile-edit__btn profile-edit__btn--outline" onClick={goToView}>
              Back to Profile
            </button>
          </div>
        ) : null}

        {isForgotOtp && forgotOtpUser ? (
          <div className="profile-edit__body profile-edit__otp-wrap">
            <OtpVerification
              user={forgotOtpUser}
              context="reset-password"
              onVerified={handleForgotOtpVerified}
              onBack={() => {
                setProfileMode(PROFILE_MODES.CHANGE_PASSWORD);
                setPasswordStep("choose");
                setForgotOtpUser(null);
              }}
            />
          </div>
        ) : null}

        {isResetPassword && resetSession ? (
          <div className="profile-edit__body profile-edit__reset-wrap">
            <h3>Create New Password</h3>
            <ResetPasswordForm
              userId={resetSession.userId}
              resetToken={resetSession.resetToken}
              onSuccess={handleForgotResetSuccess}
            />
          </div>
        ) : null}

        {showProfileFields ? (
          <div className="profile-edit__body">
            <div className="profile-edit__grid profile-edit__grid--2">
              <label className="profile-edit__field">
                <span>First Name</span>
                <input
                  type="text"
                  value={draft.firstName ?? ""}
                  readOnly={fieldsReadOnly}
                  className={errors.firstName ? "profile-edit__input--error" : ""}
                  onChange={(e) => update("firstName", e.target.value)}
                />
                {errors.firstName ? <em>{errors.firstName}</em> : null}
              </label>
              <label className="profile-edit__field">
                <span>Last Name</span>
                <input
                  type="text"
                  value={draft.lastName ?? ""}
                  readOnly={fieldsReadOnly}
                  className={errors.lastName ? "profile-edit__input--error" : ""}
                  onChange={(e) => update("lastName", e.target.value)}
                />
                {errors.lastName ? <em>{errors.lastName}</em> : null}
              </label>
            </div>

            <label className="profile-edit__field">
              <span>Username</span>
              <input
                type="text"
                value={draft.username ?? ""}
                readOnly={fieldsReadOnly}
                className={errors.username ? "profile-edit__input--error" : ""}
                onChange={(e) => update("username", e.target.value)}
              />
              {errors.username ? <em>{errors.username}</em> : null}
            </label>

            <label className="profile-edit__field">
              <span>Email</span>
              <input type="email" value={draft.email ?? ""} readOnly />
            </label>

            <label className="profile-edit__field">
              <span>Phone Number</span>
              <input
                type="tel"
                value={draft.phone ?? ""}
                readOnly={fieldsReadOnly}
                className={errors.phone ? "profile-edit__input--error" : ""}
                onChange={(e) => update("phone", e.target.value)}
              />
              {errors.phone ? <em>{errors.phone}</em> : null}
            </label>

            <label className="profile-edit__field">
              <span>Date of Birth</span>
              <input
                type="date"
                value={draft.dateOfBirth ?? ""}
                readOnly={fieldsReadOnly}
                className={errors.dateOfBirth ? "profile-edit__input--error" : ""}
                onChange={(e) => update("dateOfBirth", e.target.value)}
              />
              {errors.dateOfBirth ? <em>{errors.dateOfBirth}</em> : null}
            </label>
          </div>
        ) : null}

        {profileMode === PROFILE_MODES.VIEW || isEditProfile ? (
          <div className="profile-edit__footer">
            {isEditProfile ? (
              <>
                <button
                  type="button"
                  className="profile-edit__btn profile-edit__btn--gold"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "SAVING..." : "SAVE CHANGES"}
                </button>
                <button
                  type="button"
                  className="profile-edit__btn profile-edit__btn--outline"
                  onClick={handleCancelEdit}
                >
                  CANCEL
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="profile-edit__btn profile-edit__btn--gold"
                  onClick={() => {
                    console.log("Switching to editProfile");
                    setProfileMode(PROFILE_MODES.EDIT_PROFILE);
                    setAlert(null);
                  }}
                >
                  EDIT PROFILE
                </button>
                <button
                  type="button"
                  className="profile-edit__btn profile-edit__btn--outline"
                  onClick={() => {
                    console.log("Switching to changePassword");
                    setPasswordStep("choose");
                    setProfileMode(PROFILE_MODES.CHANGE_PASSWORD);
                    setAlert(null);
                  }}
                >
                  CHANGE PASSWORD
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

export default ProfileModal;
