import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./StatusModal.css";

const QUICK_STATUSES = [
  { emoji: "🌴", text: "On vacation" },
  { emoji: "🤒", text: "Out sick" },
  { emoji: "🏠", text: "Working from home" },
  { emoji: "🎯", text: "Focusing" },
];

const EXPIRATION_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "30m", label: "30 minutes" },
  { value: "1h", label: "1 hour" },
  { value: "4h", label: "4 hours" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
];

const VISIBILITY_OPTIONS = [
  { value: "everyone", label: "Everyone" },
  { value: "only-me", label: "Only me" },
];

function StatusModal({ isOpen, onClose, status, onSave, onClear }) {
  const [emoji, setEmoji] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [expiration, setExpiration] = useState("never");
  const [visibleTo, setVisibleTo] = useState("everyone");
  const panelRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setEmoji(status?.emoji || "");
    setText(status?.text || "");
    setBusy(Boolean(status?.busy));
    setExpiration(status?.expiration || "never");
    setVisibleTo(status?.visibleTo || "everyone");
  }, [isOpen, status]);

  useEffect(() => {
    if (!isOpen) return undefined;

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
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const remaining = 80 - text.length;

  const handleSubmit = () => {
    onSave?.({
      emoji: emoji.trim(),
      text: text.trim(),
      busy,
      expiration,
      visibleTo,
      updatedAt: new Date().toISOString(),
    });
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    onClose?.();
  };

  const handleClear = () => {
    onClear?.();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    onClose?.();
  };

  return createPortal(
    <div className="status-modal" role="presentation">
      <div className="status-modal__backdrop" />
      <div
        className="status-modal__panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Edit status"
      >
        <h2 className="status-modal__title">Edit status</h2>

        <div className="status-modal__input-row">
          <button
            type="button"
            className="status-modal__emoji-btn"
            aria-label="Status emoji"
            onClick={() => {
              const next = window.prompt("Enter an emoji", emoji || "😊");
              if (next !== null) setEmoji(next.slice(0, 4));
            }}
          >
            {emoji || "😊"}
          </button>
          <input
            type="text"
            className="status-modal__text"
            placeholder="What's happening?"
            maxLength={80}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <p className="status-modal__counter">{remaining} characters remaining</p>

        <div className="status-modal__quick">
          {QUICK_STATUSES.map((item) => (
            <button
              key={item.text}
              type="button"
              className="status-modal__quick-btn"
              onClick={() => {
                setEmoji(item.emoji);
                setText(item.text);
              }}
            >
              {item.emoji} {item.text}
            </button>
          ))}
        </div>

        <label className="status-modal__checkbox">
          <input type="checkbox" checked={busy} onChange={(e) => setBusy(e.target.checked)} />
          <span>Busy</span>
        </label>

        <label className="status-modal__field">
          <span>Clear status</span>
          <select value={expiration} onChange={(e) => setExpiration(e.target.value)}>
            {EXPIRATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="status-modal__field">
          <span>Visible to</span>
          <select value={visibleTo} onChange={(e) => setVisibleTo(e.target.value)}>
            {VISIBILITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <div className="status-modal__actions">
          <button type="button" className="status-modal__btn status-modal__btn--ghost" onClick={handleClear}>
            Clear status
          </button>
          <button type="button" className="status-modal__btn status-modal__btn--gold" onClick={handleSubmit}>
            Set status
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default StatusModal;
