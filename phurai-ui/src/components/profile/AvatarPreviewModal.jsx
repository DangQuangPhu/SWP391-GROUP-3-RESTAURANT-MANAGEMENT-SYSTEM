import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getAvatarInitial,
  getAvatarSrc,
  resolveAvatarUrl,
} from "@/utils/avatarUtils";
import "@/styles/AvatarPreviewModal.css";

function AvatarPreviewModal({ isOpen, onClose, user }) {
  const panelRef = useRef(null);
  const [broken, setBroken] = useState(false);

  const rawSrc = getAvatarSrc(user);
  const src = resolveAvatarUrl(rawSrc);
  const initial = getAvatarInitial(user);
  const showImage = Boolean(src) && !broken;

  useEffect(() => {
    if (!isOpen) return undefined;
    setBroken(false);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
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

  if (!isOpen || !user) return null;

  return createPortal(
    <div
      className="avatar-preview profile-avatar-modal-root"
      role="dialog"
      aria-modal="true"
      aria-label="Avatar preview"
    >
      <button
        type="button"
        className="avatar-preview__backdrop profile-avatar-modal-backdrop"
        aria-label="Close preview"
        onClick={onClose}
      />
      <div className="avatar-preview__frame" ref={panelRef}>
        <button
          type="button"
          className="avatar-preview__close"
          onClick={onClose}
          aria-label="Close"
        >
          &times;
        </button>
        {showImage ? (
          <img
            src={src}
            alt="Your profile avatar"
            className="avatar-preview__image"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="avatar-preview__initial" aria-hidden="true">
            {initial}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default AvatarPreviewModal;
