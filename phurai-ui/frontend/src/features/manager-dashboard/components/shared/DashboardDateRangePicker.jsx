// Trigger HMR
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { DateRangePicker } from "react-date-range";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import {
  formatDateRangeLabel,
  getDateRangePresets,
} from "@/shared/constants.js";

function DashboardDateRangePicker({
  draftRange,
  activePresetId,
  onDraftChange,
  onPresetSelect,
  onApply,
  onCancel,
  inline = false,
  allowFuture = false,
}) {
  // Always use real today for max date
  const today = new Date();

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onCancel?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const presets = getDateRangePresets(today);

  const handleApply = () => {
    // Allow null range for "All Dates" / "All time" presets
    onApply?.({
      startDate: draftRange?.startDate || null,
      endDate: draftRange?.endDate || null,
    });
  };

  const content = (
    <div className={inline ? "sfx-dp-inline-root" : "sfx-dp-root"}>
      {!inline && <div className="sfx-dp-backdrop" onClick={onCancel} />}
      <div
        className="sfx-dp-popover"
        role="dialog"
        aria-label="Date range picker"
        onClick={(event) => event.stopPropagation()}
        style={inline ? { boxShadow: "0 10px 40px rgba(0,0,0,0.15)", borderRadius: 12, overflow: "hidden", border: "1px solid #e5e7eb" } : {}}
      >
        <div className="sfx-dp-body">
          <aside className="sfx-dp-presets">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`sfx-dp-preset ${activePresetId === preset.id ? "is-active" : ""}`}
                onClick={() => onPresetSelect?.(preset)}
              >
                {preset.label}
              </button>
            ))}
          </aside>

          <div className="sfx-dp-cal">
            <DateRangePicker
              onChange={(item) => onDraftChange?.(item.selection)}
              moveRangeOnFirstSelection={false}
              months={2}
              ranges={[
                draftRange?.startDate
                  ? draftRange
                  : { startDate: today, endDate: today, key: "selection" },
              ]}
              direction="horizontal"
              maxDate={allowFuture ? undefined : today}
              rangeColors={["#9f8655"]}
              showDateDisplay={false}
            />
          </div>
        </div>

        <footer className="sfx-dp-foot sfx-dp-foot--range">
          <span className="sfx-dp-range-label">{formatDateRangeLabel(draftRange)}</span>
          <div className="sfx-dp-foot-actions">
            <button type="button" className="sfx-btn sfx-btn--ghost sfx-btn--md" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="sfx-btn sfx-btn--gold sfx-btn--md" onClick={handleApply}>
              Apply
            </button>
          </div>
        </footer>
      </div>
    </div>
  );

  return inline ? content : createPortal(content, document.body);
}

export default DashboardDateRangePicker;
