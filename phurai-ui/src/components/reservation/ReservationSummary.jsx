import { DINING_PURPOSES } from "@/data/floorPlanConfig";

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

function ReservationSummary({
  form,
  selectedTables,
  error,
  submitting,
  canSubmit,
  onSubmit,
}) {
  const purpose = DINING_PURPOSES.find((p) => p.id === form.diningPurpose);
  const totalCapacity = selectedTables.reduce((sum, t) => sum + Number(t.capacity), 0);
  const tableLabels =
    selectedTables.length > 0
      ? selectedTables.map((t) => t.display_label).join(", ")
      : "Not selected";

  return (
    <div className="rzv-card">
      <h3 className="rzv-card__title">Reservation summary</h3>
      <p className="rzv-card__hint">Review your details before confirming.</p>

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
        <span className="rzv-summary__label">Table(s)</span>
        <span className="rzv-summary__value">{tableLabels}</span>
      </div>
      {selectedTables.length > 0 ? (
        <div className="rzv-summary__row">
          <span className="rzv-summary__label">Total capacity</span>
          <span className="rzv-summary__value">{totalCapacity} seats</span>
        </div>
      ) : null}

      {error ? <div className="rzv-error" style={{ marginTop: 16 }}>{error}</div> : null}

      <button
        type="button"
        className="rzv-submit"
        onClick={onSubmit}
        disabled={!canSubmit || submitting}
      >
        {submitting ? "Confirming…" : "Confirm Reservation"}
      </button>
    </div>
  );
}

export default ReservationSummary;
