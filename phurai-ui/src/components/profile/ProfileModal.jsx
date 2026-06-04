import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getDisplayName, getInitials, isValidEmail } from "../auth/authHelpers";
import "../../styles/profile.css";

const GENDERS = ["Female", "Male", "Non-binary", "Prefer not to say"];
const COUNTRIES = ["Japan", "United States", "United Kingdom", "Vietnam", "Singapore"];
const LANGUAGES = ["English", "Japanese", "Vietnamese"];
const TIMEZONES = ["Asia/Tokyo (GMT+9)", "America/Los_Angeles (GMT-8)", "Europe/London (GMT+0)"];

function ProfileModal({ isOpen, onClose, user, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(user);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen && user) {
      setDraft({ ...user });
      setIsEditing(false);
      setErrors({});
      setAlert(null);
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
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

  const updateField = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = () => {
    const next = {};
    if (!draft.fullName?.trim()) {
      next.fullName = "Full name is required.";
    } else if (draft.fullName.trim().length < 2) {
      next.fullName = "Full name must be at least 2 characters.";
    }
    if (draft.email?.trim() && !isValidEmail(draft.email)) {
      next.email = "Enter a valid email address.";
    }
    if (!draft.phone?.trim()) {
      next.phone = "Phone number is required.";
    }
    return next;
  };

  const handleEdit = () => {
    setIsEditing(true);
    setAlert(null);
  };

  const handleCancel = () => {
    setDraft({ ...user });
    setIsEditing(false);
    setErrors({});
    setAlert(null);
  };

  const handleSave = () => {
    const validation = validate();
    if (Object.keys(validation).length) {
      setErrors(validation);
      return;
    }
    onSave?.({ ...draft });
    setIsEditing(false);
    setAlert({ type: "success", message: "Profile updated successfully." });
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateField("avatarUrl", reader.result);
    };
    reader.readAsDataURL(file);
  };

  const initials = getInitials(draft);
  const displayName = getDisplayName(draft);
  const disabled = !isEditing;

  return createPortal(
    <div className="profile-modal" role="presentation">
      <div className="profile-modal__overlay" onClick={onClose} aria-hidden="true" />
      <div
        className="profile-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-label="My Profile"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="profile-modal__close" onClick={onClose} aria-label="Close profile">
          &times;
        </button>

        <div className="profile-modal__banner" />
        <div className="profile-modal__header">
          <div className="profile-modal__avatar-wrap">
            {draft.avatarUrl ? (
              <img src={draft.avatarUrl} alt="" className="profile-modal__avatar-img" />
            ) : (
              <span className="profile-modal__avatar">{initials}</span>
            )}
            {isEditing ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="profile-modal__file"
                  onChange={handleAvatarChange}
                />
                <button
                  type="button"
                  className="profile-modal__avatar-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Change photo
                </button>
              </>
            ) : null}
          </div>
          <div className="profile-modal__identity">
            <h2>{displayName}</h2>
            <p>{draft.email || "No email added"}</p>
          </div>
          <div className="profile-modal__actions">
            {!isEditing ? (
              <button type="button" className="profile-modal__btn profile-modal__btn--outline" onClick={handleEdit}>
                Edit
              </button>
            ) : (
              <>
                <button type="button" className="profile-modal__btn profile-modal__btn--gold" onClick={handleSave}>
                  Save
                </button>
                <button type="button" className="profile-modal__btn profile-modal__btn--outline" onClick={handleCancel}>
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        {alert ? (
          <div className={`profile-modal__alert profile-modal__alert--${alert.type}`}>{alert.message}</div>
        ) : null}

        <div className="profile-modal__body">
          <section className="profile-modal__section">
            <h3>Personal Information</h3>
            <div className="profile-modal__grid">
              <label className="profile-field">
                <span>Full name</span>
                <input
                  type="text"
                  value={draft.fullName}
                  disabled={disabled}
                  className={errors.fullName ? "profile-field__input--error" : ""}
                  onChange={(e) => updateField("fullName", e.target.value)}
                />
                {errors.fullName ? <em>{errors.fullName}</em> : null}
              </label>
              <label className="profile-field">
                <span>Nickname</span>
                <input
                  type="text"
                  value={draft.nickname}
                  disabled={disabled}
                  onChange={(e) => updateField("nickname", e.target.value)}
                />
              </label>
              <label className="profile-field">
                <span>Gender</span>
                <select
                  value={draft.gender}
                  disabled={disabled}
                  onChange={(e) => updateField("gender", e.target.value)}
                >
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </label>
              <label className="profile-field">
                <span>Country</span>
                <select
                  value={draft.country}
                  disabled={disabled}
                  onChange={(e) => updateField("country", e.target.value)}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="profile-field">
                <span>Language</span>
                <select
                  value={draft.language}
                  disabled={disabled}
                  onChange={(e) => updateField("language", e.target.value)}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </label>
              <label className="profile-field">
                <span>Time zone</span>
                <select
                  value={draft.timezone}
                  disabled={disabled}
                  onChange={(e) => updateField("timezone", e.target.value)}
                >
                  {TIMEZONES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="profile-field">
                <span>Phone number</span>
                <input
                  type="tel"
                  value={draft.phone}
                  disabled={disabled}
                  className={errors.phone ? "profile-field__input--error" : ""}
                  onChange={(e) => updateField("phone", e.target.value)}
                />
                {errors.phone ? <em>{errors.phone}</em> : null}
              </label>
              <label className="profile-field">
                <span>Birthday</span>
                <input
                  type="date"
                  value={draft.birthday}
                  disabled={disabled}
                  onChange={(e) => updateField("birthday", e.target.value)}
                />
              </label>
              <label className="profile-field profile-field--full">
                <span>Address</span>
                <input
                  type="text"
                  value={draft.address}
                  disabled={disabled}
                  onChange={(e) => updateField("address", e.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="profile-modal__section">
            <h3>Email</h3>
            <label className="profile-field profile-field--full">
              <span>Primary email</span>
              <input
                type="email"
                value={draft.email}
                disabled={disabled}
                className={errors.email ? "profile-field__input--error" : ""}
                onChange={(e) => updateField("email", e.target.value)}
              />
              {errors.email ? <em>{errors.email}</em> : null}
            </label>
            <button type="button" className="profile-modal__link-btn" disabled={disabled}>
              + Add email address
            </button>
          </section>

          <section className="profile-modal__section">
            <h3>Preferences</h3>
            <div className="profile-modal__grid">
              <label className="profile-field">
                <span>Favorite cuisine</span>
                <input
                  type="text"
                  value={draft.favoriteCuisine}
                  disabled={disabled}
                  onChange={(e) => updateField("favoriteCuisine", e.target.value)}
                />
              </label>
              <label className="profile-field">
                <span>Seating preference</span>
                <input
                  type="text"
                  value={draft.seatingPreference}
                  disabled={disabled}
                  onChange={(e) => updateField("seatingPreference", e.target.value)}
                />
              </label>
              <label className="profile-field profile-field--full">
                <span>Notification preference</span>
                <input
                  type="text"
                  value={draft.notificationPreference}
                  disabled={disabled}
                  onChange={(e) => updateField("notificationPreference", e.target.value)}
                />
              </label>
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ProfileModal;
