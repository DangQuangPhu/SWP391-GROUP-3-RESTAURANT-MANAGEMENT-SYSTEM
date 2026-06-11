import { DINING_PURPOSES, AREA_PREFERENCES } from "@/data/floorPlanConfig";
import { formatVND } from "@/utils/formatCurrency";

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
 * Final review of the booking. Surfaces every detail plus the two soft add-ons
 * (Promotion + Order in advance) before the guest confirms.
 */
function ReservationSummary({
  form,
  selectedTables,
  promotion,
  preorderItems = [],
  error,
  submitting,
  canSubmit,
  onSubmit,
  onEditDetails,
  onOpenPreorder,
  onOpenPromotion,
  onClearPromotion,
}) {
  const purpose = DINING_PURPOSES.find((p) => p.id === form.diningPurpose);
  const area = AREA_PREFERENCES.find((a) => a.id === form.areaPref);
  const totalCapacity = selectedTables.reduce((sum, t) => sum + Number(t.capacity), 0);
  const tableLabels =
    selectedTables.length > 0
      ? selectedTables.map((t) => t.display_label).join(", ")
      : "Not selected";

  const preorderCount = preorderItems.reduce((sum, i) => sum + i.quantity, 0);
  const preorderTotal = preorderItems.reduce(
    (sum, i) => sum + i.quantity * Number(i.price || 0),
    0
  );

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
          <span className="rzv-summary__label">Area</span>
          <span className="rzv-summary__value">{area?.label || "Any area"}</span>
        </div>
        <div className="rzv-summary__row">
          <span className="rzv-summary__label">Table(s)</span>
          <span className="rzv-summary__value">
            {tableLabels}
            {selectedTables.length > 0 ? ` · ${totalCapacity} seats` : ""}
          </span>
        </div>
      </div>

      {/* Promotion */}
      <div className="rzv-summary__addon">
        <div className="rzv-summary__addon-info">
          <span className="rzv-summary__addon-title">
            <span className="rzv-summary__addon-icon" aria-hidden>✦</span> Promotion
          </span>
          <span className="rzv-summary__addon-sub">
            {promotion ? promotion.label : "Apply a member promotion"}
          </span>
        </div>
        {promotion ? (
          <button type="button" className="rzv-chiplink" onClick={onClearPromotion}>
            Remove
          </button>
        ) : (
          <button type="button" className="rzv-chiplink" onClick={onOpenPromotion}>
            Add
          </button>
        )}
      </div>

      {/* Order in advance */}
      <div className="rzv-summary__addon">
        <div className="rzv-summary__addon-info">
          <span className="rzv-summary__addon-title">
            <span className="rzv-summary__addon-icon" aria-hidden>☖</span> Order in advance
          </span>
          <span className="rzv-summary__addon-sub">
            {preorderCount > 0
              ? `${preorderCount} item${preorderCount === 1 ? "" : "s"} · ${formatVND(preorderTotal)}`
              : "Pre-select dishes for your table"}
          </span>
        </div>
        <button type="button" className="rzv-chiplink" onClick={onOpenPreorder}>
          {preorderCount > 0 ? "Edit" : "Add dishes"}
        </button>
      </div>

      {form.specialRequest?.trim() ? (
        <div className="rzv-summary__note">
          <span className="rzv-summary__label">Special request</span>
          <p className="rzv-summary__note-text">{form.specialRequest.trim()}</p>
        </div>
      ) : null}

      {error ? <div className="rzv-error" style={{ marginTop: 16 }}>{error}</div> : null}

      <div className="rzv-summary__actions">
        {onEditDetails ? (
          <button
            type="button"
            className="rzv-btn rzv-btn--ghost"
            onClick={onEditDetails}
            disabled={submitting}
          >
            Edit details
          </button>
        ) : null}
        <button
          type="button"
          className="rzv-submit"
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
