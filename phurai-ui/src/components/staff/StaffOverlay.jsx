/* Modal + drawer overlays for the staff portal.
   Both lock body scroll, close on Escape and backdrop click. */
import { useEffect } from "react";
import Icon from "@/components/staff/StaffIcons.jsx";

function useOverlayBehaviour(open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
}

export function StaffModal({ open, title, onClose, children, footer, size = "md" }) {
  useOverlayBehaviour(open, onClose);
  if (!open) return null;
  return (
    <div className="sfx-overlay" onMouseDown={onClose}>
      <div
        className={`sfx-modal sfx-modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="sfx-modal__head">
          <h3 className="sfx-modal__title">{title}</h3>
          <button type="button" className="sfx-iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="sfx-modal__body">{children}</div>
        {footer ? <footer className="sfx-modal__foot">{footer}</footer> : null}
      </div>
    </div>
  );
}

export function StaffDrawer({ open, title, onClose, children, footer }) {
  useOverlayBehaviour(open, onClose);
  if (!open) return null;
  return (
    <div className="sfx-overlay sfx-overlay--right" onMouseDown={onClose}>
      <aside
        className="sfx-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="sfx-drawer__head">
          <h3 className="sfx-drawer__title">{title}</h3>
          <button type="button" className="sfx-iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="sfx-drawer__body">{children}</div>
        {footer ? <footer className="sfx-drawer__foot">{footer}</footer> : null}
      </aside>
    </div>
  );
}
