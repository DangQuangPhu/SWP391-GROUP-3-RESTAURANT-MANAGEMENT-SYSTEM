import { formatVND } from "@/utils/formatCurrency";

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
 * Shows date, time, table(s), promotion (or None) and pre-ordered dishes
 * (or None) plus the two closing actions.
 */
function ReservationSuccessPanel({
  reservation,
  promotion,
  preorderItems = [],
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
            #{reservation.reservation_id}
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
        <div className="rzv-summary__row">
          <span className="rzv-summary__label">Promotion</span>
          <span className="rzv-summary__value">{promotion ? promotion.label : "None"}</span>
        </div>
        <div className="rzv-summary__row rzv-summary__row--top">
          <span className="rzv-summary__label">Pre-ordered dishes</span>
          <span className="rzv-summary__value">
            {preorderItems.length === 0 ? (
              "None"
            ) : (
              <span className="rzv-success__dishes">
                {preorderItems.map((i) => (
                  <span key={i.dish_id} className="rzv-success__dish">
                    {i.quantity}× {i.dish_name}
                    <span className="rzv-success__dish-price">
                      {formatVND(i.quantity * Number(i.price || 0))}
                    </span>
                  </span>
                ))}
              </span>
            )}
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
