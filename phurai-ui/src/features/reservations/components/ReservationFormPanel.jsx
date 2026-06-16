import {
  AREA_PREFERENCES,
  BOOKING_AREAS,
  DINING_PURPOSES,
  HOLD_DURATION_OPTIONS,
  EVENT_AREA_HINTS,
  KITCHEN_VIEW_AREA_NAME,
  KITCHEN_VIEW_COUNTER_CAPACITY,
} from "../data/floorPlanConfig.js";

/**
 * Controlled reservation form. State lives in ReservationPage; this renders fields
 * and reports changes via setField.
 */
function ReservationFormPanel({
  form,
  setField,
  settings,
  timeSlots,
  isAuthenticated,
  todayStr,
}) {
  const areaHints = EVENT_AREA_HINTS[form.diningPurpose] || [];
  const isKitchenView = form.selectedArea === KITCHEN_VIEW_AREA_NAME;
  const counterCapacity = KITCHEN_VIEW_COUNTER_CAPACITY;

  return (
    <div className="rzv-card">
      <h3 className="rzv-card__title">Reservation details</h3>
      <p className="rzv-card__hint">
        Select when you would like to dine and the atmosphere you prefer.
      </p>

      {/* Date + time */}
      <div className="rzv-row">
        <div className="rzv-field">
          <label className="rzv-field__label" htmlFor="rzv-date">
            Date
          </label>
          <input
            id="rzv-date"
            type="date"
            className="rzv-input"
            min={todayStr}
            value={form.date}
            onChange={(e) => setField("date", e.target.value)}
          />
        </div>
        <div className="rzv-field">
          <label className="rzv-field__label" htmlFor="rzv-time">
            Time
          </label>
          <select
            id="rzv-time"
            className="rzv-select"
            value={form.time}
            onChange={(e) => setField("time", e.target.value)}
          >
            <option value="">Select time</option>
            {timeSlots.map((slot) => (
              <option key={slot.value} value={slot.value}>
                {slot.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Dining area — table vs Kitchen View counter */}
      <div className="rzv-field">
        <label className="rzv-field__label" htmlFor="rzv-area">
          Dining area
        </label>
        <select
          id="rzv-area"
          className="rzv-select"
          value={form.selectedArea || ""}
          onChange={(e) => {
            const next = BOOKING_AREAS.find((a) => a.area_name === e.target.value) || BOOKING_AREAS[0];
            setField("selectedArea", next.area_name || "");
            setField("preferredAreaId", next.area_id);
          }}
        >
          {BOOKING_AREAS.map((area) => (
            <option key={area.label} value={area.area_name || ""}>
              {area.label}
            </option>
          ))}
        </select>
        {isKitchenView ? (
          <p className="rzv-card__hint" style={{ marginTop: "0.5rem" }}>
            Counter seating near the open kitchen — reserve by number of seats, not a specific table.
          </p>
        ) : null}
      </div>

      {/* Guests + duration */}
      <div className="rzv-row">
        <div className="rzv-field">
          <label className="rzv-field__label">
            {isKitchenView ? "NUMBER OF SEATS" : "GUESTS"}
          </label>
          <div className="rzv-stepper" style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.5rem" }}>
            <button
              type="button"
              className="rzv-btn rzv-btn--ghost"
              style={{ width: "40px", height: "40px", padding: 0, borderRadius: "50%" }}
              disabled={Number(form.guestCount) <= 1}
              onClick={() => setField("guestCount", Math.max(1, Number(form.guestCount) - 1))}
            >
              -
            </button>
            <input
              type="number"
              className="rzv-input"
              style={{ width: "80px", textAlign: "center", margin: 0 }}
              min={1}
              max={isKitchenView ? counterCapacity : 15}
              value={form.guestCount}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  const capped = isKitchenView
                    ? Math.min(counterCapacity, Math.max(1, val))
                    : val;
                  setField("guestCount", capped);
                }
              }}
            />
            <button
              type="button"
              className="rzv-btn rzv-btn--ghost"
              style={{ width: "40px", height: "40px", padding: 0, borderRadius: "50%" }}
              disabled={
                isKitchenView
                  ? Number(form.guestCount) >= counterCapacity
                  : Number(form.guestCount) >= 10
              }
              onClick={() =>
                setField(
                  "guestCount",
                  isKitchenView
                    ? Math.min(counterCapacity, Number(form.guestCount) + 1)
                    : Math.min(10, Number(form.guestCount) + 1)
                )
              }
            >
              +
            </button>
          </div>
          {isKitchenView ? (
            <p className="rzv-card__hint" style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
              Kitchen counter has up to {counterCapacity} seats for this time slot.
            </p>
          ) : null}
          {!isKitchenView && Number(form.guestCount) > 10 && (
            <div className="rzv-hintbar" style={{ marginTop: "0.75rem", color: "var(--rzv-gold)" }}>
              For parties larger than 10 guests, please contact our staff for table arrangement.
            </div>
          )}
        </div>
        <div className="rzv-field">
          <label className="rzv-field__label" htmlFor="rzv-duration">
            Duration
          </label>
          <select
            id="rzv-duration"
            className="rzv-select"
            value={form.holdDurationMinutes}
            onChange={(e) => setField("holdDurationMinutes", Number(e.target.value))}
          >
            {HOLD_DURATION_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <p className="rzv-card__hint" style={{ marginTop: "0.5rem", fontSize: "0.85rem", opacity: 0.8 }}>
            How long you would like the table reserved for your dining session.
          </p>
        </div>
      </div>

      {/* Dining purpose */}
      <div className="rzv-field">
        <label className="rzv-field__label">Dining purpose</label>
        <div className="rzv-chips">
          {DINING_PURPOSES.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`rzv-chip ${form.diningPurpose === p.id ? "rzv-chip--active" : ""}`}
              onClick={() => setField("diningPurpose", p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        {areaHints.length > 0 ? (
          <div className="rzv-hintbar">
            Suggested areas for this occasion: {areaHints.join(" · ")}
          </div>
        ) : null}
      </div>

      <h3 className="rzv-card__title" style={{ marginTop: 26 }}>
        Your information
      </h3>
      {isAuthenticated ? (
        <span className="rzv-autofill">✓ Auto-filled from your profile</span>
      ) : (
        <p className="rzv-card__hint">
          Enter your contact details so we can confirm your reservation.
        </p>
      )}

      <div className="rzv-field">
        <label className="rzv-field__label" htmlFor="rzv-name">
          Full name
        </label>
        <input
          id="rzv-name"
          type="text"
          className="rzv-input"
          placeholder="Your name"
          value={form.fullName}
          onChange={(e) => setField("fullName", e.target.value)}
        />
      </div>
      <div className="rzv-row">
        <div className="rzv-field">
          <label className="rzv-field__label" htmlFor="rzv-email">
            Email
          </label>
          <input
            id="rzv-email"
            type="email"
            className="rzv-input"
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) => setField("email", e.target.value)}
          />
        </div>
        <div className="rzv-field">
          <label className="rzv-field__label" htmlFor="rzv-phone">
            Phone
          </label>
          <input
            id="rzv-phone"
            type="tel"
            className="rzv-input"
            placeholder="+66 ..."
            value={form.phone}
            onChange={(e) => setField("phone", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

export default ReservationFormPanel;
