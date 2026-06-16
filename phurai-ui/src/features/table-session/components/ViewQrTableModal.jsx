import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTableSession } from "../context/TableSessionContext.jsx";
import {
  buildMenuSessionPath,
  buildMenuSessionUrl,
  buildQrImageUrl,
} from "../utils/menuSessionUrl.js";
import "../styles/table-session.css";

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ViewQrTableModal({ isOpen, onClose }) {
  const { session, loading, error, refreshActiveSession, hasActiveSession } =
    useTableSession();

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      refreshActiveSession();
    }
  }, [isOpen, refreshActiveSession]);

  const menuPath = useMemo(() => {
    if (!session) return null;
    return buildMenuSessionPath(session.table_id, session.session_id);
  }, [session]);

  const menuUrl = useMemo(() => {
    if (!session) return null;
    return buildMenuSessionUrl(session.table_id, session.session_id);
  }, [session]);

  const qrImageUrl = useMemo(() => {
    if (!menuUrl) return null;
    return buildQrImageUrl(menuUrl, 260);
  }, [menuUrl]);

  if (!isOpen) return null;

  return (
    <div
      className="qr-table-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-table-modal-title"
    >
      <button
        type="button"
        className="qr-table-modal__backdrop"
        aria-label="Close QR table modal"
        onClick={onClose}
      />

      <div className="qr-table-modal__panel">
        <header className="qr-table-modal__header">
          <div>
            <p className="qr-table-modal__eyebrow">Dine-in Session</p>
            <h2 id="qr-table-modal-title" className="qr-table-modal__title">
              Your Table QR
            </h2>
          </div>
          <button
            type="button"
            className="qr-table-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </header>

        {loading ? (
          <div className="qr-table-modal__state">
            <span className="qr-table-modal__spinner" aria-hidden="true" />
            <p>Loading your table session…</p>
          </div>
        ) : null}

        {!loading && error ? (
          <div className="qr-table-modal__state qr-table-modal__state--error">
            <p>{error}</p>
          </div>
        ) : null}

        {!loading && !error && !hasActiveSession ? (
          <div className="qr-table-modal__state">
            <p className="qr-table-modal__state-title">No active table session</p>
            <p className="qr-table-modal__state-copy">
              Ask your server to seat you and open a QR session. Once linked to your
              account, your table code will appear here.
            </p>
          </div>
        ) : null}

        {!loading && !error && hasActiveSession && session ? (
          <div className="qr-table-modal__body">
            <div className="qr-table-modal__meta">
              <span className="qr-table-modal__table-label">Table</span>
              <strong className="qr-table-modal__table-number">
                {session.table_number || `T-${session.table_id}`}
              </strong>
              {session.area_name ? (
                <span className="qr-table-modal__area">{session.area_name}</span>
              ) : null}
              <span className="qr-table-modal__session-id">
                Session #{session.session_id}
              </span>
            </div>

            <div className="qr-table-modal__qr-wrap">
              {qrImageUrl ? (
                <img
                  src={qrImageUrl}
                  alt={`QR code for table ${session.table_number || session.table_id}`}
                  className="qr-table-modal__qr-image"
                  width={260}
                  height={260}
                />
              ) : null}
            </div>

            <p className="qr-table-modal__hint">
              Scan or share this code so everyone at your table orders into the same
              bill.
            </p>

            {menuPath ? (
              <Link to={menuPath} className="qr-table-modal__menu-link" onClick={onClose}>
                Open menu for this table
              </Link>
            ) : null}

            {menuUrl ? (
              <p className="qr-table-modal__payload" title={menuUrl}>
                {menuUrl}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default ViewQrTableModal;
