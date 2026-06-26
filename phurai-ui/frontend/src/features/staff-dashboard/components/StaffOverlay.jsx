import { useEffect } from "react";
import Icon from "./StaffIcons.jsx";

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
