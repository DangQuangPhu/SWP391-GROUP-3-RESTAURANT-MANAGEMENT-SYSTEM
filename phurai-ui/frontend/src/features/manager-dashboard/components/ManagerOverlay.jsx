/* Modal + drawer overlays for the manager portal.
   Both lock body scroll, close on Escape and backdrop click. */
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Icon from "./ManagerIcons.jsx";

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

export function ManagerModal({ open = true, title, onClose, children, footer, size = "md" }) {
  useOverlayBehaviour(open, onClose);
  
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="sfx-overlay"
          onMouseDown={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className={`sfx-modal sfx-modal--${size}`}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onMouseDown={(e) => e.stopPropagation()}
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <header className="sfx-modal__head">
              <h3 className="sfx-modal__title">{title}</h3>
              <button type="button" className="sfx-iconbtn" onClick={onClose} aria-label="Close">
                <Icon name="close" size={18} />
              </button>
            </header>
            <div className="sfx-modal__body">{children}</div>
            {footer ? <footer className="sfx-modal__foot">{footer}</footer> : null}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ManagerDrawer({ open = true, title, onClose, children, footer }) {
  useOverlayBehaviour(open, onClose);
  
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="sfx-overlay sfx-overlay--right"
          onMouseDown={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.aside
            className="sfx-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onMouseDown={(e) => e.stopPropagation()}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
          >
            <header className="sfx-drawer__head">
              <h3 className="sfx-drawer__title">{title}</h3>
              <button type="button" className="sfx-iconbtn" onClick={onClose} aria-label="Close">
                <Icon name="close" size={18} />
              </button>
            </header>
            <div className="sfx-drawer__body">{children}</div>
            {footer ? <footer className="sfx-drawer__foot">{footer}</footer> : null}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
