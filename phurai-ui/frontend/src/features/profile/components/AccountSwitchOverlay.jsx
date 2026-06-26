import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { UserAvatar, getDisplayName } from "@/features/auth";
import { AddAccountIcon, ChevronBackIcon, SignOutIcon, SwitchAccountIcon } from "./accountIcons";
import "@/styles/AccountSwitchOverlay.css";

function AccountSwitchOverlay({
  isOpen,
  onClose,
  onBack,
  currentUser,
  onSignOut,
  onAddAccount,
  onSwitchAccount,
}) {
  const panelRef = useRef(null);
  const [placeholder, setPlaceholder] = useState(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        onBack?.();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onBack]);

  if (!isOpen) return null;

  const displayName = getDisplayName(currentUser);

  const showUnavailable = (message) => {
    setPlaceholder(message);
  };

  return createPortal(
    <>
      <div className="account-switch" role="presentation">
        <div
          className="account-switch__panel"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Switch account"
        >
          <button type="button" className="account-switch__back" onClick={onBack} aria-label="Back">
            <ChevronBackIcon />
          </button>

          <div className="account-switch__current">
            <UserAvatar user={currentUser} size="md" />
            <div>
              <p className="account-switch__name">{displayName}</p>
              <p className="account-switch__username">@{currentUser?.username}</p>
            </div>
          </div>

          <h3 className="account-switch__title">Switch account</h3>

          <button type="button" className="account-switch__row account-switch__row--active">
            <UserAvatar user={currentUser} size="sm" />
            <span>{displayName}</span>
            <span className="account-switch__check" aria-hidden="true">
              ✓
            </span>
          </button>

          <button
            type="button"
            className="account-switch__row"
            onClick={() => {
              if (onAddAccount) onAddAccount();
              else showUnavailable("Add account is not available yet.");
            }}
          >
            <span className="account-switch__icon">
              <AddAccountIcon />
            </span>
            <span>Add account</span>
          </button>

          <button
            type="button"
            className="account-switch__row"
            onClick={() => {
              if (onSwitchAccount) onSwitchAccount();
              else showUnavailable("Switch account is not available yet.");
            }}
          >
            <span className="account-switch__icon">
              <SwitchAccountIcon />
            </span>
            <span>Switch account</span>
          </button>

          <button
            type="button"
            className="account-switch__row account-switch__row--danger"
            onClick={() => {
              onClose?.();
              onSignOut?.();
            }}
          >
            <span className="account-switch__icon">
              <SignOutIcon />
            </span>
            <span>Sign out</span>
          </button>
        </div>
      </div>

      {placeholder ? (
        <div className="account-switch__placeholder" role="presentation">
          <div className="account-switch__placeholder-panel" role="alertdialog" aria-modal="true">
            <p>{placeholder}</p>
            <button type="button" onClick={() => setPlaceholder(null)}>
              OK
            </button>
          </div>
        </div>
      ) : null}
    </>,
    document.body
  );
}

export default AccountSwitchOverlay;
