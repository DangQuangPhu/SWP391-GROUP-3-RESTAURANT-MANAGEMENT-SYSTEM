import { DINING_PURPOSES } from "../data/floorPlanConfig.js";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(timeStr) {
  if (!timeStr) return "—";
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/**
 * Final review of the booking before the guest confirms.
 */
function ReservationSummary({
  form,
  setField,
  selectedTables,
  isKitchenView = false,
  error,
  submitting,
  canSubmit,
  onSubmit,
  onEditDetails,
}) {
  const purpose = DINING_PURPOSES.find((p) => p.id === form.diningPurpose);
  const totalCapacity = selectedTables.reduce((sum, t) => sum + Number(t.capacity), 0);
  const tableLabels = selectedTables.length > 0
    ? selectedTables.map((t) => t.display_label).join(", ")
    : "Not selected";

  let holdExpiresAt = "—";
  if (form.date && form.time) {
    const [y, m, d] = form.date.split("-").map(Number);
    const [hh, mm] = form.time.split(":").map(Number);
    const expireDate = new Date(y, m - 1, d, hh, mm + form.holdDurationMinutes);
    holdExpiresAt = formatTime(`${expireDate.getHours()}:${expireDate.getMinutes()}`);
  }

  const showVatWarning =
    form.holdDurationMinutes === 45 || form.holdDurationMinutes === 60;

  return (
    <div className="rzv-card rzv-summary">
      <div className="rzv-summary__head">
        <h3 className="rzv-card__title">Reservation summary</h3>
        <p className="rzv-card__hint">Review your details before confirming.</p>
      </div>

      <div className="rzv-summary__grid">
        <div className="rzv-summary__row">
          <span className="rzv-summary__label">Date</span>
          <span className="rzv-summary__value">{formatDate(form.date)}</span>
        </div>
        <div className="rzv-summary__row">
          <span className="rzv-summary__label">Time</span>
          <span className="rzv-summary__value">{formatTime(form.time)}</span>
        </div>
        <div className="rzv-summary__row">
          <span className="rzv-summary__label">Guests</span>
          <span className="rzv-summary__value">{form.guestCount}</span>
        </div>
        <div className="rzv-summary__row">
          <span className="rzv-summary__label">Occasion</span>
          <span className="rzv-summary__value">{purpose?.label || "—"}</span>
        </div>
        <div className="rzv-summary__row">
          <span className="rzv-summary__label">Duration</span>
          <span className="rzv-summary__value">{form.holdDurationMinutes} minutes</span>
        </div>
        <div className="rzv-summary__row">
          <span className="rzv-summary__label">Hold expires at</span>
          <span className="rzv-summary__value">{holdExpiresAt}</span>
        </div>
        <div className="rzv-summary__row">
          <span className="rzv-summary__label">Table</span>
          <span className="rzv-summary__value">
            {tableLabels}
            {selectedTables.length > 0 ? ` · ${totalCapacity} seats` : ""}
          </span>
        </div>
        <div className="rzv-field" style={{ gridColumn: "1 / -1", marginTop: 8 }}>
          <label className="rzv-field__label" htmlFor="rzv-notes">
            Special Requests / Notes
          </label>
          <textarea
            id="rzv-notes"
            className="rzv-input"
            placeholder="Any allergies, special occasions, or other requests?"
            rows={3}
            value={form.notes || ""}
            onChange={(e) => setField("notes", e.target.value)}
          />
        </div>
      </div>

      {error ? <div className="rzv-error" style={{ marginTop: 16 }}>{error}</div> : null}

      {showVatWarning ? (
        <div className="rzv-alert rzv-alert--surcharge" role="status" style={{ marginTop: 16 }}>
          Note: Reservations for 45 minutes or 1 hour are subject to an additional premium
          VAT/surcharge fee.
        </div>
      ) : null}

      <div className="summary-actions-footer">
        {onEditDetails ? (
          <button
            type="button"
            className="btn-edit-details"
            onClick={onEditDetails}
            disabled={submitting}
          >
            Edit details
          </button>
        ) : null}
        <button
          type="button"
          className="btn-confirm-reservation"
          onClick={onSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? "Confirming…" : "Confirm Reservation"}
        </button>
      </div>
    </div>
  );
}

export default ReservationSummary;
