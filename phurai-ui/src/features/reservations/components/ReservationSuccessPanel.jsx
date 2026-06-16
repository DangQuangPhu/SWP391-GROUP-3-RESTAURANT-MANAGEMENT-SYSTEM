function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * Premium reservation-success panel with an animated green check.
 */
function ReservationSuccessPanel({
  reservation,
  onReturnHome,
  onViewReservation,
}) {
  if (!reservation) return null;

  const tables = reservation.tables || [];
  const start = reservation.reservation_start_at;

  return (
    <div className="rzv-success">
      <div className="rzv-success__check" aria-hidden>
        <svg viewBox="0 0 80 80">
          <circle className="rzv-success__check-ring" cx="40" cy="40" r="36" />
          <path className="rzv-success__check-mark" d="M24 41.5 L35 52 L57 29" />
        </svg>
      </div>

      <h1 className="rzv-success__title rzv-serif">Table reservation successful</h1>
      <p className="rzv-success__msg">
        Thank you for choosing Phūrai. Your reservation has been successfully received and we
        look forward to welcoming you.
      </p>

      <div className="rzv-success__card">
        <div className="rzv-summary__row">
          <span className="rzv-summary__label">Reservation</span>
          <span className="rzv-summary__value">
            #{String(reservation.reservation_id).padStart(6, '0')}
            {reservation.reservation_status ? (
              <span className="rzv-status-pill" style={{ marginLeft: 8 }}>
                {reservation.reservation_status}
              </span>
            ) : null}
          </span>
        </div>
        <div className="rzv-summary__row">
          <span className="rzv-summary__label">Date</span>
          <span className="rzv-summary__value">{formatDate(start)}</span>
        </div>
        <div className="rzv-summary__row">
          <span className="rzv-summary__label">Time</span>
          <span className="rzv-summary__value">{formatTime(start)}</span>
        </div>
        <div className="rzv-summary__row">
          <span className="rzv-summary__label">Table(s)</span>
          <span className="rzv-summary__value">
            {tables.length > 0
              ? tables.map((t) => `${t.display_label} (${t.capacity})`).join(", ")
              : "—"}
          </span>
        </div>
      </div>

      <div className="rzv-success__actions">
        <button type="button" className="rzv-btn rzv-btn--ghost" onClick={onReturnHome}>
          Return Home
        </button>
        <button type="button" className="rzv-btn rzv-btn--solid" onClick={onViewReservation}>
          View Reservation
        </button>
      </div>
    </div>
  );
}

export default ReservationSuccessPanel;
