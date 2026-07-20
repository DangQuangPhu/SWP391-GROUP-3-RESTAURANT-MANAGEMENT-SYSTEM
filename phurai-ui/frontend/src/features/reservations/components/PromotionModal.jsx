import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PROMOTIONS } from "../data/floorPlanConfig.js";

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

  const modalContent = (
    <div 
      className="rzv-modal" 
      role="dialog" 
      aria-modal="true" 
      aria-label="Promotion"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        background: 'rgba(10, 8, 6, 0.78)',
      }}
    >
      {/* Invisible scrim for click-to-close */}
      <div 
        className="rzv-modal__scrim" 
        onClick={onClose} 
        style={{
          position: 'absolute',
          inset: 0,
        }}
      />
      
      <div 
        className="rd-card" 
        style={{ 
          width: '540px', 
          maxWidth: '90vw', 
          margin: 'auto',
          padding: 0,
          borderRadius: '28px',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          background: 'rgba(26, 23, 20, 0.85)',
          backdropFilter: 'blur(28px) saturate(220%)',
          WebkitBackdropFilter: 'blur(28px) saturate(220%)',
          boxShadow: '0 24px 70px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          opacity: 1,
          animation: 'appleFadeSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          zIndex: 1
        }}
      >

        {isAuthenticated ? (
          <>
            <header className="rzv-modal__head" style={{ padding: '24px 24px 16px', background: 'transparent', borderBottom: '1px solid rgba(255, 255, 255, 0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="rzv-modal__kicker" style={{ color: 'var(--rd-brand, #ffd064)', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '1px', fontWeight: 'bold' }}>Member perk</span>
                <h3 className="rzv-serif" style={{ fontSize: '1.4rem', color: '#fff', margin: '4px 0 0', fontWeight: 600 }}>Apply a promotion</h3>
              </div>
              <button type="button" className="rzv-modal__close" onClick={onClose} style={{ color: '#fff', fontSize: '24px', border: 'none', background: 'none', cursor: 'pointer' }} aria-label="Close">
                ✕
              </button>
            </header>

            <div className="rzv-modal__body" style={{ padding: '24px', background: 'transparent' }}>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {PROMOTIONS.map((p) => {
                  const isSelected = selected === p.id;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setSelected((cur) => (cur === p.id ? null : p.id))}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          padding: '16px',
                          borderRadius: '16px',
                          border: `1px solid ${isSelected ? 'var(--rd-brand, #ffd064)' : 'rgba(255, 255, 255, 0.08)'}`,
                          background: isSelected ? 'rgba(255, 208, 100, 0.08)' : 'rgba(255, 255, 255, 0.04)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <span style={{ fontSize: '18px', color: isSelected ? 'var(--rd-brand, #ffd064)' : 'rgba(255, 255, 255, 0.3)', userSelect: 'none' }} aria-hidden>
                          {isSelected ? "●" : "○"}
                        </span>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <strong style={{ fontSize: '14px', color: '#fff', fontWeight: 600 }}>{p.label}</strong>
                          <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)' }}>{p.desc}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <footer className="rzv-modal__foot" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.12)', background: 'transparent' }}>
              <button type="button" className="rd-btn-outline" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, margin: 0 }}>
                Cancel
              </button>
              <button type="button" className="rd-btn-primary" onClick={handleApply} style={{ padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, margin: 0 }}>
                {selected ? "Apply promotion" : "Continue without"}
              </button>
            </footer>
          </>
        ) : (
          <div className="rzv-promo__guest" style={{ padding: '32px', textAlign: 'center', background: 'transparent' }}>
            <div style={{ fontSize: '48px', color: 'var(--rd-brand, #ffd064)', marginBottom: '16px', lineHeight: 1 }} aria-hidden>✦</div>
            <h3 className="rzv-serif" style={{ fontSize: '1.4rem', color: '#fff', marginBottom: '12px', fontWeight: 600 }}>Sign up to use Promotions</h3>
            <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.65)', lineHeight: '1.6', marginBottom: '24px' }}>
              Promotions are a perk reserved for Phūrai members. Create a free account to unlock
              dining credit, welcome drinks, and more — your reservation details will be kept.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button type="button" className="rd-btn-outline" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, margin: 0 }}>
                Maybe later
              </button>
              <button type="button" className="rd-btn-primary" onClick={onSignUp} style={{ padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, margin: 0 }}>
                Sign up
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default PromotionModal;
