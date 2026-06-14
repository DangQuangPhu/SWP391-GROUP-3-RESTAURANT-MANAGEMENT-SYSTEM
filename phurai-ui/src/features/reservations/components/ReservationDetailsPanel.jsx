import ReservationFormPanel from "./ReservationFormPanel";

/**
 * Step 1 wrapper around the reservation form. Adds the guided footer actions:
 *  - Done  (appears only once required fields are valid)
 *  - Confirm + Cancel (shown after Done; locks the form for review)
 */
function ReservationDetailsPanel({
  form,
  setField,
  settings,
  timeSlots,
  isAuthenticated,
  todayStr,
  detailsValid,
  reviewing,
  missing = [],
  onDone,
  onConfirm,
  onCancel,
}) {
  return (
    <div className={`rzv-details ${reviewing ? "rzv-details--review" : ""}`}>
      <div className="rzv-details__form" aria-disabled={reviewing}>
        <ReservationFormPanel
          form={form}
          setField={setField}
          settings={settings}
          timeSlots={timeSlots}
          isAuthenticated={isAuthenticated}
          todayStr={todayStr}
        />
      </div>

      <div className="rzv-details__footer">
        {!reviewing ? (
          detailsValid ? (
            <div className="rzv-details__ready">
              <span className="rzv-details__ready-note">Looks good — your details are ready.</span>
              <button type="button" className="rzv-btn rzv-btn--solid rzv-details__done" onClick={onDone}>
                Done
              </button>
            </div>
          ) : (
            <p className="rzv-details__hint">
              {missing.length > 0
                ? `Please add: ${missing.join(", ")}.`
                : "Complete the required fields to continue."}
            </p>
          )
        ) : (
          <div className="rzv-details__review">
            <span className="rzv-details__review-note">
              {form.selectedArea === "Kitchen View"
                ? "Details locked for review. Confirm to reserve counter seats."
                : "Details locked for review. Confirm to choose your table."}
            </span>
            <div className="rzv-details__review-actions">
              <button type="button" className="rzv-btn rzv-btn--ghost" onClick={onCancel}>
                Cancel
              </button>
              <button type="button" className="rzv-btn rzv-btn--solid" onClick={onConfirm}>
                Confirm
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReservationDetailsPanel;
