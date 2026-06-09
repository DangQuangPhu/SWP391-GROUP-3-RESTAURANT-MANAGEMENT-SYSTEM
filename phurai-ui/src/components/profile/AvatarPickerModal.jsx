import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  uploadProfileAvatar,
  updateSystemAvatar,
  updateGoogleAvatar,
} from "@/api";
import { SYSTEM_AVATARS, getAvatarSrc, normalizeStoredAvatarUrl } from "@/utils/avatarUtils";
import { validateAvatarFile } from "@/utils/authHelpers";
import SystemAvatarOption from "@/components/auth/SystemAvatarOption";
import UserAvatar from "@/components/auth/UserAvatar";
import "@/styles/AvatarPickerModal.css";

function AvatarPickerModal({ isOpen, onClose, user, onSave }) {
  const [alert, setAlert] = useState(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState("");
  const fileInputRef = useRef(null);
  const panelRef = useRef(null);

  const userId = user?.userId ?? user?.id;

  useEffect(() => {
    if (!isOpen) {
      setAlert(null);
      setPreview("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        onClose?.();
      }
    };

    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        onClose?.();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  const applyUpdate = (data) => {
    const base = data.user || { ...user, avatarUrl: data.avatarUrl };
    const nextUser = {
      ...base,
      avatarUrl: normalizeStoredAvatarUrl(data.avatarUrl || base.avatarUrl),
      id: base.id ?? base.userId,
      userId: base.userId ?? base.id,
    };
    onSave?.(nextUser);
    if (preview?.startsWith("blob:")) {
      URL.revokeObjectURL(preview);
    }
    setPreview("");
    onClose?.();
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;

    const fileError = validateAvatarFile(file);
    if (fileError) {
      setAlert({ type: "error", message: fileError });
      return;
    }

    setPreview(URL.createObjectURL(file));
    setAlert(null);

    try {
      setSaving(true);
      const data = await uploadProfileAvatar(userId, file);
      applyUpdate(data);
    } catch (error) {
      setPreview("");
      setAlert({ type: "error", message: error.message || "Avatar update failed." });
    } finally {
      setSaving(false);
      event.target.value = "";
    }
  };

  const handleSystemSelect = async (avatarPath) => {
    if (!userId) return;
    setPreview(avatarPath);
    setAlert(null);

    try {
      setSaving(true);
      const data = await updateSystemAvatar(userId, avatarPath);
      applyUpdate(data);
    } catch (error) {
      setPreview("");
      setAlert({ type: "error", message: error.message || "Avatar update failed." });
    } finally {
      setSaving(false);
    }
  };

  const handleGoogleAvatar = async () => {
    if (!userId || !user?.googleAvatarUrl) return;
    setPreview(user.googleAvatarUrl);
    setAlert(null);

    try {
      setSaving(true);
      const data = await updateGoogleAvatar(userId);
      applyUpdate(data);
    } catch (error) {
      setPreview("");
      setAlert({ type: "error", message: error.message || "Avatar update failed." });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !user) return null;

  const previewUser = preview ? { ...user, avatarUrl: preview } : user;

  return createPortal(
    <div className="avatar-picker" role="presentation">
      <button
        type="button"
        className="avatar-picker__backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="avatar-picker__panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Choose a new avatar"
      >
        <button
          type="button"
          className="avatar-picker__close"
          onClick={onClose}
          aria-label="Close"
        >
          &times;
        </button>

        <h2 className="avatar-picker__title">Choose a new avatar</h2>

        <div className="avatar-picker__preview">
          <UserAvatar user={previewUser} size="lg" />
        </div>

        <div className="avatar-picker__options">
          {user.googleAvatarUrl ? (
            <button
              type="button"
              className="avatar-picker__option"
              onClick={handleGoogleAvatar}
              disabled={saving}
            >
              Use your Google avatar
            </button>
          ) : null}
          <button
            type="button"
            className="avatar-picker__option"
            onClick={() => fileInputRef.current?.click()}
            disabled={saving}
          >
            Upload from device
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="avatar-picker__file"
            onChange={handleFileSelect}
          />
        </div>

        <p className="avatar-picker__sub">Or choose a random avatar</p>
        <div className="avatar-picker__grid">
          {SYSTEM_AVATARS.map((path) => (
            <SystemAvatarOption
              key={path}
              path={path}
              isActive={getAvatarSrc(user) === path}
              disabled={saving}
              onSelect={handleSystemSelect}
            />
          ))}
        </div>

        {alert ? (
          <p className={`avatar-picker__alert avatar-picker__alert--${alert.type}`}>
            {alert.message}
          </p>
        ) : null}

        <button type="button" className="avatar-picker__cancel" onClick={onClose} disabled={saving}>
          Cancel
        </button>
      </div>
    </div>,
    document.body
  );
}

export default AvatarPickerModal;
