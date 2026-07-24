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
  minDate = null,
  months = 2,
}) {
  // Always use real today for max date
  const today = new Date();

  // Initial shown date: 1 month back so left month = previous month, right month = current month
  const [shownDate, setShownDate] = useState(() => {
    const refDate = new Date(draftRange?.startDate || today);
    const prev = new Date(refDate);
    prev.setMonth(prev.getMonth() - 1);
    return prev;
  });
  
  let presets = getDateRangePresets(today);
  if (minDate) {
    const minD = new Date(minDate);
    minD.setHours(0, 0, 0, 0);
    presets = presets.map(preset => {
      if (preset.range && preset.range.startDate) {
        const start = new Date(preset.range.startDate);
        if (start < minD) {
          const clampedStart = minD < preset.range.endDate ? minD : preset.range.endDate;
          return {
            ...preset,
            range: {
              ...preset.range,
              startDate: clampedStart
            }
          };
        }
      } else if (preset.range && preset.range.startDate === null) {
        // "All Dates" / "All Time" preset -> clamp to minDate
        return {
          ...preset,
          range: {
            ...preset.range,
            startDate: minD
          }
        };
      }
      return preset;
    });
  }

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onCancel?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);



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
              months={months}
              shownDate={shownDate}
              onShownDateChange={(d) => setShownDate(d)}
              ranges={[
                draftRange?.startDate
                  ? draftRange
                  : { startDate: today, endDate: today, key: "selection" },
              ]}
              direction="horizontal"
              maxDate={allowFuture ? undefined : today}
              minDate={minDate || undefined}
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
