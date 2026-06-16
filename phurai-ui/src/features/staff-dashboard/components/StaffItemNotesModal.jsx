import { useEffect, useState } from "react";
import { Button } from "./StaffUI.jsx";
import "../styles/staff-order-tab.css";

function StaffItemNotesModal({ open, item, onClose, onSubmit, busy }) {
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open && item) {
      setNotes(item.notes || "");
    }
  }, [open, item]);

  if (!open || !item) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(notes.trim() || null);
  };

  return (
    <div className="staff-order-modal" role="dialog" aria-modal="true">
      <button
        type="button"
        className="staff-order-modal__backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="staff-order-modal__panel staff-order-modal__panel--narrow">
        <header className="staff-order-modal__head">
          <div>
            <h3>Special instructions</h3>
            <p>
              {item.dish_name} · Qty {item.quantity}
            </p>
          </div>
          <button type="button" className="staff-order-modal__close" onClick={onClose}>
            ×
          </button>
        </header>

        <form className="staff-order-modal__body" onSubmit={handleSubmit}>
          <label className="staff-order-field">
            <span>Guest request</span>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Less spicy, no onion, extra lime…"
            />
          </label>

          <footer className="staff-order-modal__foot">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save notes"}
            </Button>
          </footer>
        </form>
      </div>
    </div>
  );
}

export default StaffItemNotesModal;
