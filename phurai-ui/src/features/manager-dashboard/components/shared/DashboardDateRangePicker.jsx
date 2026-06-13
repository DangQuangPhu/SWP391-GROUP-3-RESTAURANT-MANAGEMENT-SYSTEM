import { useEffect } from "react";
import { DateRangePicker } from "react-date-range";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import {
  DASHBOARD_TODAY,
  formatDateRangeLabel,
  getDateRangePresets,
} from "../../data/managerDashboardMockData.js";

function DashboardDateRangePicker({
  draftRange,
  activePresetId,
  onDraftChange,
  onPresetSelect,
  onApply,
  onCancel,
}) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onCancel?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const presets = getDateRangePresets(DASHBOARD_TODAY);

  const handleApply = () => {
    if (!draftRange?.startDate || !draftRange?.endDate) return;
    onApply?.({
      startDate: draftRange.startDate,
      endDate: draftRange.endDate,
    });
  };

  return (
    <div
      className="sfx-dp-popover"
      role="dialog"
      aria-label="Date range picker"
      onClick={(event) => event.stopPropagation()}
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
            ranges={[draftRange]}
            direction="horizontal"
            maxDate={DASHBOARD_TODAY}
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
  );
}

export default DashboardDateRangePicker;
