import {
  AREA_PREFERENCES,
  DINING_PURPOSES,
  DURATION_OPTIONS,
  GUEST_OPTIONS,
  EVENT_AREA_HINTS,
} from "@/data/floorPlanConfig";

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
  const selectedPurpose = DINING_PURPOSES.find((p) => p.id === form.diningPurpose);
  const isEvent = Boolean(selectedPurpose?.event);
  const areaHints = EVENT_AREA_HINTS[form.diningPurpose] || [];
  const maxGuests = settings?.max_guests || 12;
  const guestChoices = GUEST_OPTIONS.filter((g) => g <= maxGuests);

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

      {/* Guests + duration */}
      <div className="rzv-row">
        <div className="rzv-field">
          <label className="rzv-field__label">Guests</label>
          <div className="rzv-chips">
            {guestChoices.map((g) => (
              <button
                key={g}
                type="button"
                className={`rzv-chip ${Number(form.guestCount) === g ? "rzv-chip--active" : ""}`}
                onClick={() => setField("guestCount", g)}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
        <div className="rzv-field">
          <label className="rzv-field__label" htmlFor="rzv-duration">
            Duration
          </label>
          <select
            id="rzv-duration"
            className="rzv-select"
            value={form.durationMinutes}
            onChange={(e) => setField("durationMinutes", Number(e.target.value))}
          >
            {DURATION_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
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

      {/* Area preference */}
      <div className="rzv-field">
        <label className="rzv-field__label">Area preference</label>
        <div className="rzv-chips">
          {AREA_PREFERENCES.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`rzv-chip ${form.areaPref === a.id ? "rzv-chip--active" : ""}`}
              onClick={() => setField("areaPref", a.id)}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Event extras */}
      {isEvent ? (
        <>
          <div className="rzv-field">
            <label className="rzv-field__label" htmlFor="rzv-event-title">
              Event title (optional)
            </label>
            <input
              id="rzv-event-title"
              type="text"
              className="rzv-input"
              placeholder="e.g. Sophie's 30th Birthday"
              value={form.eventTitle}
              onChange={(e) => setField("eventTitle", e.target.value)}
            />
          </div>
          <div className="rzv-row">
            <div className="rzv-field">
              <label className="rzv-field__label" htmlFor="rzv-cake">
                Cake / dessert request
              </label>
              <input
                id="rzv-cake"
                type="text"
                className="rzv-input"
                placeholder="e.g. Chocolate cake for 8"
                value={form.cakeRequest}
                onChange={(e) => setField("cakeRequest", e.target.value)}
              />
            </div>
            <div className="rzv-field">
              <label className="rzv-field__label" htmlFor="rzv-decor">
                Decoration request
              </label>
              <input
                id="rzv-decor"
                type="text"
                className="rzv-input"
                placeholder="e.g. Minimal red / gold setup"
                value={form.decoration}
                onChange={(e) => setField("decoration", e.target.value)}
              />
            </div>
          </div>
          <div className="rzv-field">
            <label className="rzv-field__label" htmlFor="rzv-equip">
              Microphone / projector need
            </label>
            <input
              id="rzv-equip"
              type="text"
              className="rzv-input"
              placeholder="e.g. Microphone + projector for a short speech"
              value={form.equipment}
              onChange={(e) => setField("equipment", e.target.value)}
            />
          </div>
        </>
      ) : null}

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

      <div className="rzv-field">
        <label className="rzv-field__label" htmlFor="rzv-special">
          Special request
        </label>
        <textarea
          id="rzv-special"
          className="rzv-textarea"
          maxLength={600}
          placeholder="Allergies, child seat, quiet table, window seat, wine pairing, arrival note…"
          value={form.specialRequest}
          onChange={(e) => setField("specialRequest", e.target.value)}
        />
      </div>
    </div>
  );
}

export default ReservationFormPanel;
