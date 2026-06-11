import { useEffect, useState } from "react";
import { PROMOTIONS } from "@/data/floorPlanConfig";

/**
 * Promotion overlay.
 *  - Members: pick from the available member promotions.
 *  - Guests: an elegant prompt to sign up (no harsh blocking).
 * Promotions are presentation-only and are not sent to the backend.
 */
function PromotionModal({ open, isAuthenticated, current, onClose, onApply, onSignUp }) {
  const [selected, setSelected] = useState(current?.id || null);

  useEffect(() => {
    if (open) setSelected(current?.id || null);
  }, [open, current]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleApply = () => {
    const promo = PROMOTIONS.find((p) => p.id === selected) || null;
    onApply?.(promo);
    onClose?.();
  };

  return (
    <div className="rzv-modal" role="dialog" aria-modal="true" aria-label="Promotion">
      <div className="rzv-modal__scrim" onClick={onClose} />
      <div className="rzv-modal__panel rzv-modal__panel--promo">
        {isAuthenticated ? (
          <>
            <header className="rzv-modal__head">
              <div>
                <span className="rzv-modal__kicker">Member perk</span>
                <h3 className="rzv-modal__title rzv-serif">Apply a promotion</h3>
              </div>
              <button type="button" className="rzv-modal__close" onClick={onClose} aria-label="Close">
                ✕
              </button>
            </header>

            <div className="rzv-modal__body">
              <ul className="rzv-promo__list">
                {PROMOTIONS.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={`rzv-promo__opt ${selected === p.id ? "rzv-promo__opt--active" : ""}`}
                      onClick={() => setSelected((cur) => (cur === p.id ? null : p.id))}
                    >
                      <span className="rzv-promo__radio" aria-hidden>
                        {selected === p.id ? "●" : "○"}
                      </span>
                      <span className="rzv-promo__opt-text">
                        <span className="rzv-promo__opt-label">{p.label}</span>
                        <span className="rzv-promo__opt-desc">{p.desc}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <footer className="rzv-modal__foot rzv-modal__foot--end">
              <button type="button" className="rzv-btn rzv-btn--ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="rzv-btn rzv-btn--solid" onClick={handleApply}>
                {selected ? "Apply promotion" : "Continue without"}
              </button>
            </footer>
          </>
        ) : (
          <div className="rzv-promo__guest">
            <div className="rzv-promo__guest-seal" aria-hidden>✦</div>
            <h3 className="rzv-modal__title rzv-serif">Need sign up an account to use Promotion</h3>
            <p className="rzv-promo__guest-msg">
              Promotions are a perk reserved for Phūrai members. Create a free account to unlock
              dining credit, welcome drinks and more — your reservation details will be kept.
            </p>
            <div className="rzv-promo__guest-actions">
              <button type="button" className="rzv-btn rzv-btn--ghost" onClick={onClose}>
                Maybe later
              </button>
              <button type="button" className="rzv-btn rzv-btn--solid" onClick={onSignUp}>
                Sign up
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PromotionModal;
