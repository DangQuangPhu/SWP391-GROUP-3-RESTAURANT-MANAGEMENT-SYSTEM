import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { blurActiveElement } from "../utils/authHelpers.js";
import "@/features/auth/styles/authModal.css";

const MOCK_ACCOUNTS = [
  {
    email: "user1@gmail.com",
    name: "User One",
    avatar: "U",
  },
  {
    email: "user2@gmail.com",
    name: "User Two",
    avatar: "U",
  },
];

function GoogleAccountChooserModal({ isOpen, onClose, onSelect }) {
  const handleClose = useCallback(() => {
    blurActiveElement();
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="auth-modal" role="presentation">
      <div
        className="auth-modal__overlay"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        className="auth-modal__dialog auth-modal__dialog--google"
        role="dialog"
        aria-modal="true"
        aria-label="Choose an account"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="auth-modal__close"
          onClick={handleClose}
          aria-label="Close"
        >
          <span aria-hidden="true">&times;</span>
        </button>

        <div className="google-chooser__header">
          <h2 className="auth-card__title google-chooser__title">
            Sign in with Google
          </h2>
          <p className="auth-card__subtitle google-chooser__subtitle">
            Choose an account to continue to Phūrai
          </p>
        </div>

        <div className="google-chooser__list">
          {MOCK_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              type="button"
              onClick={() => {
                blurActiveElement();
                onSelect(acc);
              }}
              className="google-chooser__btn"
            >
              <div className="google-chooser__avatar">
                {acc.avatar}
              </div>
              <div className="google-chooser__info">
                <div className="google-chooser__name">
                  {acc.name}
                </div>
                <div className="google-chooser__email">
                  {acc.email}
                </div>
              </div>
            </button>
          ))}

          <button
            type="button"
            className="google-chooser__btn-add"
          >
            <div className="google-chooser__add-icon-wrapper">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4d463d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <div className="google-chooser__add-text">
              Add another account
            </div>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default GoogleAccountChooserModal;
