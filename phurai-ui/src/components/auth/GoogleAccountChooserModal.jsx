import { useEffect } from "react";
import { createPortal } from "react-dom";
import { blurActiveElement } from "@/utils/authHelpers";
import "@/styles/authModal.css";

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
  const handleClose = () => {
    blurActiveElement();
    onClose?.();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="auth-modal" role="presentation">
      <div
        className="auth-modal__overlay"
        onClick={handleClose}
        style={{ background: "rgba(0, 0, 0, 0.6)" }}
        aria-hidden="true"
      />
      <div
        className="auth-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Choose an account"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "400px", padding: "1.5rem" }}
      >
        <button
          type="button"
          className="auth-modal__close"
          onClick={handleClose}
          aria-label="Close"
        >
          <span aria-hidden="true">&times;</span>
        </button>

        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <h2 className="auth-card__title" style={{ fontSize: "1.25rem", marginBottom: "0.25rem" }}>
            Sign in with Google
          </h2>
          <p className="auth-card__subtitle" style={{ margin: 0 }}>
            Choose an account to continue to Phūrai
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {MOCK_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              type="button"
              onClick={() => {
                blurActiveElement();
                onSelect(acc);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #e3e2e0",
                borderRadius: "8px",
                background: "#fff",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.2s, box-shadow 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#faf9f6";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#fff";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div
                style={{
                  width: "2.5rem",
                  height: "2.5rem",
                  borderRadius: "50%",
                  background: "#4285F4",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                  fontSize: "1.2rem"
                }}
              >
                {acc.avatar}
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div style={{ fontWeight: 600, color: "#342716", textOverflow: "ellipsis", overflow: "hidden" }}>
                  {acc.name}
                </div>
                <div style={{ fontSize: "0.875rem", color: "#4d463d", textOverflow: "ellipsis", overflow: "hidden" }}>
                  {acc.email}
                </div>
              </div>
            </button>
          ))}

          <button
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              width: "100%",
              padding: "0.75rem",
              border: "1px solid transparent",
              borderRadius: "8px",
              background: "transparent",
              cursor: "pointer",
              textAlign: "left",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#faf9f6"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <div
              style={{
                width: "2.5rem",
                height: "2.5rem",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4d463d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <div style={{ fontWeight: 600, color: "#342716" }}>
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
