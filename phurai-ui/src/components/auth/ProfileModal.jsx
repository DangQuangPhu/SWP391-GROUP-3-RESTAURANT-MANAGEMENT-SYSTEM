import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getDisplayName, getInitials, isValidEmail } from "./authHelpers";
import "../../styles/profileModal.css";

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
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
        />
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

function ProfileModal({ isOpen, onClose, user, onSave }) {
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    newPassword: "",
    confirm: "",
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen && user) {
      setDraft({ ...user });
      setErrors({});
      setAlert(null);
      setShowChangePassword(false);
      setPasswordForm({ current: "", newPassword: "", confirm: "" });
      setPasswordErrors({});
    }
  }, [isOpen, user]);

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

  if (!isOpen || !user || !draft) {
    return null;
  }

  const update = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = () => {
    const next = {};
    if (!draft.firstName?.trim()) next.firstName = "First name is required.";
    if (!draft.lastName?.trim()) next.lastName = "Last name is required.";
    if (!draft.username?.trim()) next.username = "Username is required.";
    if (!draft.phone?.trim()) next.phone = "Phone number is required.";
    if (draft.email?.trim() && !isValidEmail(draft.email)) {
      next.email = "Enter a valid email address.";
    }
    return next;
  };

  const handleSave = () => {
    const validation = validate();
    if (Object.keys(validation).length) {
      setErrors(validation);
      return;
    }
    const saved = {
      ...draft,
      fullName: `${draft.firstName} ${draft.lastName}`.trim(),
      nickname: draft.username,
    };
    onSave?.(saved);
    setAlert({ type: "success", message: "Profile saved successfully." });
  };

  const handleCancel = () => {
    setDraft({ ...user });
    setErrors({});
    setAlert(null);
    setShowChangePassword(false);
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update("avatarUrl", reader.result);
    reader.readAsDataURL(file);
  };

  const handlePasswordSave = () => {
    const next = {};
    if (!passwordForm.current) next.current = "Current password is required.";
    if (!passwordForm.newPassword) next.newPassword = "New password is required.";
    if (passwordForm.newPassword.length < 8) {
      next.newPassword = "New password must be at least 8 characters.";
    }
    if (passwordForm.confirm !== passwordForm.newPassword) {
      next.confirm = "Passwords do not match.";
    }
    setPasswordErrors(next);
    if (Object.keys(next).length) return;

    setAlert({ type: "success", message: "Password updated (demo only)." });
    setShowChangePassword(false);
    setPasswordForm({ current: "", newPassword: "", confirm: "" });
  };

  const initials = getInitials(draft);
  const displayName = getDisplayName(draft);

  return createPortal(
    <div className="profile-edit" role="presentation">
      <div className="profile-edit__overlay" onClick={onClose} aria-hidden="true" />
      <div
        className="profile-edit__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Edit profile"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="profile-edit__close" onClick={onClose} aria-label="Close">
          &times;
        </button>

        <div className="profile-edit__banner" />
        <div className="profile-edit__head">
          <div className="profile-edit__avatar-wrap">
            {draft.avatarUrl ? (
              <img src={draft.avatarUrl} alt="" className="profile-edit__avatar-img" />
            ) : (
              <span className="profile-edit__avatar">{initials}</span>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="profile-edit__file" onChange={handleAvatarChange} />
            <button type="button" className="profile-edit__avatar-btn" onClick={() => fileInputRef.current?.click()}>
              Change photo
            </button>
          </div>
          <div>
            <h2>{displayName}</h2>
            <p>@{draft.username}</p>
          </div>
        </div>

        {alert ? (
          <div className={`profile-edit__alert profile-edit__alert--${alert.type}`}>{alert.message}</div>
        ) : null}

        <div className="profile-edit__body">
          <div className="profile-edit__grid profile-edit__grid--2">
            <label className="profile-edit__field">
              <span>First Name</span>
              <input
                type="text"
                value={draft.firstName ?? ""}
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
              className={errors.username ? "profile-edit__input--error" : ""}
              onChange={(e) => update("username", e.target.value)}
            />
            {errors.username ? <em>{errors.username}</em> : null}
          </label>

          <label className="profile-edit__field">
            <span>Email</span>
            <input
              type="email"
              value={draft.email ?? ""}
              className={errors.email ? "profile-edit__input--error" : ""}
              onChange={(e) => update("email", e.target.value)}
            />
            <p className="profile-edit__hint">Changing email will require verification.</p>
            {errors.email ? <em>{errors.email}</em> : null}
          </label>

          <label className="profile-edit__field">
            <span>Phone Number</span>
            <input
              type="tel"
              value={draft.phone ?? ""}
              className={errors.phone ? "profile-edit__input--error" : ""}
              onChange={(e) => update("phone", e.target.value)}
            />
            {errors.phone ? <em>{errors.phone}</em> : null}
          </label>

          <div className="profile-edit__password-section">
            {!showChangePassword ? (
              <button
                type="button"
                className="profile-edit__link-btn"
                onClick={() => setShowChangePassword(true)}
              >
                Change Password
              </button>
            ) : (
              <div className="profile-edit__change-password">
                <h3>Change Password</h3>
                <PasswordField
                  id="pw-current"
                  label="Current Password"
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, current: e.target.value }))}
                  error={passwordErrors.current}
                />
                <PasswordField
                  id="pw-new"
                  label="New Password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                  error={passwordErrors.newPassword}
                />
                <PasswordField
                  id="pw-confirm"
                  label="Confirm New Password"
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, confirm: e.target.value }))}
                  error={passwordErrors.confirm}
                />
                <div className="profile-edit__pw-actions">
                  <button type="button" className="profile-edit__btn profile-edit__btn--gold" onClick={handlePasswordSave}>
                    Update Password
                  </button>
                  <button
                    type="button"
                    className="profile-edit__btn profile-edit__btn--outline"
                    onClick={() => setShowChangePassword(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="profile-edit__footer">
          <button type="button" className="profile-edit__btn profile-edit__btn--gold" onClick={handleSave}>
            SAVE CHANGES
          </button>
          <button type="button" className="profile-edit__btn profile-edit__btn--outline" onClick={handleCancel}>
            CANCEL
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ProfileModal;
