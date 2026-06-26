import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import TableBoard from "./choose-table/TableBoard.jsx";

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
  selectedTableId,
  onSelectTable,
  tables,
  tablesLoading,
  membershipTier,
  onNavigateLogin,
  onNavigateRegister,
}) {
  const [showTableBoard, setShowTableBoard] = useState(false);

  useEffect(() => {
    if (showTableBoard) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [showTableBoard]);

  const areaHints = EVENT_AREA_HINTS[form.diningPurpose] || [];
  const isKitchenView = form.selectedArea === KITCHEN_VIEW_AREA_NAME;
  const counterCapacity = KITCHEN_VIEW_COUNTER_CAPACITY;

  const selectedTableData = tables?.find((t) => t.table_id === selectedTableId);

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
            Start time
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
        ) : (
          <div style={{ marginTop: "1rem" }}>
            {!selectedTableId ? (
              <>
                {!showTableBoard && (
                  <button
                    type="button"
                    className="rzv-btn rzv-btn--ghost"
                    onClick={() => {
                      setShowTableBoard(true);
                      document.body.style.overflow = 'hidden';
                    }}
                  >
                    Choose and view table
                  </button>
                )}
                {showTableBoard && createPortal(
                  <div className="rzv-fullscreen-overlay" onClick={() => {
                    setShowTableBoard(false);
                    document.body.style.overflow = '';
                  }}>
                    <div className="rzv-fullscreen-content" onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                        <h3 style={{ margin: 0, color: "var(--text-color)" }}>Choose your table</h3>
                        <button
                          type="button"
                          className="rzv-btn rzv-btn--ghost"
                          onClick={() => {
                            setShowTableBoard(false);
                            document.body.style.overflow = '';
                          }}
                        >
                          ✕ Close
                        </button>
                      </div>
                      <TableBoard
                        tables={tables}
                        selectedTableId={selectedTableId}
                        onSelectTable={(tableId) => {
                          onSelectTable(tableId);
                          setShowTableBoard(false);
                          document.body.style.overflow = '';
                        }}
                        loading={tablesLoading}
                        guestCount={form.guestCount}
                        membershipTier={membershipTier}
                        isAuthenticated={isAuthenticated}
                        onNavigateLogin={onNavigateLogin}
                        onNavigateRegister={onNavigateRegister}
                      />
                    </div>
                  </div>,
                  document.body
                )}
              </>
            ) : (
              <div style={{ padding: "1rem", background: "var(--bg-card-alt)", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p className="rzv-selected-table" style={{ margin: 0, fontWeight: 500 }}>
                  Your selected table: {selectedTableData?.display_label || selectedTableData?.table_number || "Selected"}
                </p>
                <button
                  type="button"
                  className="rzv-btn rzv-btn--ghost"
                  style={{ padding: "0.5rem", fontSize: "0.85rem" }}
                  onClick={() => {
                    onSelectTable(null);
                    setShowTableBoard(true);
                    document.body.style.overflow = 'hidden';
                  }}
                >
                  Edit Table
                </button>
              </div>
            )}
          </div>
        )}
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
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label className="rzv-field__label" htmlFor="rzv-duration">
                Duration (Grace Period)
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
            </div>
            <div style={{ flex: 1 }}>
              <label className="rzv-field__label" htmlFor="rzv-endtime">
                End time
              </label>
              <select
                id="rzv-endtime"
                className="rzv-select"
                value={form.endTime}
                onChange={(e) => setField("endTime", e.target.value)}
                disabled={!form.time}
              >
                {!form.time && <option value="">Select start time first</option>}
                {form.time && timeSlots.map((slot) => {
                  const [startH, startM] = form.time.split(':').map(Number);
                  const [endH, endM] = slot.value.split(':').map(Number);
                  const startMins = startH * 60 + startM;
                  let endMins = endH * 60 + endM;
                  // Allow times that are strictly after the start time
                  if (endMins <= startMins) endMins += 24 * 60; // Assume next day
                  // Filter out times that are more than 4 hours away (or show all?)
                  if (endMins - startMins > 0 && endMins - startMins <= 4 * 60) {
                    return (
                      <option key={slot.value} value={slot.value}>
                        {slot.label}
                      </option>
                    );
                  }
                  return null;
                })}
              </select>
            </div>
          </div>
          <p className="rzv-card__hint" style={{ marginTop: "0.5rem", fontSize: "0.85rem", opacity: 0.8 }}>
            How long we hold the table if you are late, and when you plan to leave.
          </p>
        </div>
      </div>

      {/* Dining purpose */}
      <div className="rzv-field">
        <label className="rzv-field__label" htmlFor="rzv-dining-purpose">Dining purpose</label>
        <select
          id="rzv-dining-purpose"
          className="rzv-select"
          value={form.diningPurpose || ""}
          onChange={(e) => setField("diningPurpose", e.target.value)}
        >
          <option value="">Select occasion</option>
          {DINING_PURPOSES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
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
        <span className="rzv-autofill"></span>
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
