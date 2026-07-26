// Trigger HMR
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { DateRangePicker } from "react-date-range";
import { format } from "date-fns";
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
  const today = useMemo(() => new Date(), []);
  const [animDirection, setAnimDirection] = useState(null);

  // Initial shownDate: 1 month prior so left month = previous month, right month = current month
  const [shownDate, setShownDate] = useState(() => {
    const refDate = new Date(draftRange?.startDate || today);
    const prev = new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1);
    return prev;
  });

  // Calculate left and right month dates for header display
  const leftMonth = shownDate;
  const rightMonth = useMemo(
    () => new Date(shownDate.getFullYear(), shownDate.getMonth() + 1, 1),
    [shownDate]
  );

  // Header Title format: e.g. "Jun – Jul 2026" or "Dec 2025 – Jan 2026"
  const monthRangeTitle = useMemo(() => {
    if (leftMonth.getFullYear() === rightMonth.getFullYear()) {
      return `${format(leftMonth, "MMM")} – ${format(rightMonth, "MMM yyyy")}`;
    }
    return `${format(leftMonth, "MMM yyyy")} – ${format(rightMonth, "MMM yyyy")}`;
  }, [leftMonth, rightMonth]);

  const openingDate = useMemo(() => {
    if (minDate) return new Date(minDate);
    return new Date(2024, 0, 1);
  }, [minDate]);

  // Notice banner for dates before opening or in the future
  const periodNotice = useMemo(() => {
    const windowEnd = new Date(shownDate.getFullYear(), shownDate.getMonth() + 2, 0, 23, 59, 59);
    if (windowEnd < openingDate) {
      return {
        type: "past",
        title: "Before Restaurant Opening",
        subtitle: "Restaurant established in Jan 2024. No past operational records.",
      };
    }
    const windowStart = new Date(shownDate.getFullYear(), shownDate.getMonth(), 1);
    const endOfCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
    if (windowStart > endOfCurrentMonth) {
      return {
        type: "future",
        title: "Upcoming Booking Period",
        subtitle: "Viewing future dates for advance reservations & orders.",
      };
    }
    return null;
  }, [shownDate, openingDate, today]);

  // Stepper handlers (step 2 months at a time)
  const handlePrev2Months = () => {
    setAnimDirection("prev");
    setShownDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 2, 1));
    setTimeout(() => setAnimDirection(null), 380);
  };

  const handleNext2Months = () => {
    setAnimDirection("next");
    setShownDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 2, 1));
    setTimeout(() => setAnimDirection(null), 380);
  };

  const handlePresetClick = (preset) => {
    if (preset.range && preset.range.startDate) {
      const d = new Date(preset.range.startDate);
      setShownDate(new Date(d.getFullYear(), d.getMonth() - 1, 1));
    }
    onPresetSelect?.(preset);
  };

  // Dynamic ranges passed to react-date-range so it syncs its month view with shownDate
  const activeRanges = useMemo(() => {
    if (!draftRange?.startDate) {
      return [{ startDate: null, endDate: null, key: "selection" }];
    }
    const start = new Date(draftRange.startDate);
    const windowStart = new Date(shownDate.getFullYear(), shownDate.getMonth(), 1);
    const windowEnd = new Date(shownDate.getFullYear(), shownDate.getMonth() + 2, 0, 23, 59, 59);

    if (start >= windowStart && start <= windowEnd) {
      return [draftRange];
    }
    return [{ startDate: null, endDate: null, key: "selection" }];
  }, [draftRange, shownDate]);

  let presets = getDateRangePresets(today);
  if (minDate) {
    const minD = new Date(minDate);
    minD.setHours(0, 0, 0, 0);
    presets = presets.map((preset) => {
      if (preset.range && preset.range.startDate) {
        const start = new Date(preset.range.startDate);
        if (start < minD) {
          const clampedStart = minD < preset.range.endDate ? minD : preset.range.endDate;
          return {
            ...preset,
            range: {
              ...preset.range,
              startDate: clampedStart,
            },
          };
        }
      } else if (preset.range && preset.range.startDate === null) {
        return {
          ...preset,
          range: {
            ...preset.range,
            startDate: minD,
          },
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
        style={inline ? { boxShadow: "0 10px 40px rgba(0,0,0,0.15)", borderRadius: 16, overflow: "hidden", border: "1px solid #e5e7eb" } : {}}
      >
        <div className="sfx-dp-body">
          <aside className="sfx-dp-presets">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`sfx-dp-preset ${activePresetId === preset.id ? "is-active" : ""}`}
                onClick={() => handlePresetClick(preset)}
              >
                {preset.label}
              </button>
            ))}
          </aside>

          <div className="sfx-dp-cal-container">
            {/* Custom Apple 2-Month Stepper Header */}
            <div className="sfx-dp-apple-header">
              <button
                type="button"
                className="sfx-dp-apple-nav-btn"
                onClick={handlePrev2Months}
                aria-label="Previous 2 months"
                title="Previous 2 months"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>

              <span className="sfx-dp-apple-title">{monthRangeTitle}</span>

              <button
                type="button"
                className="sfx-dp-apple-nav-btn"
                onClick={handleNext2Months}
                aria-label="Next 2 months"
                title="Next 2 months"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>

            {/* Apple Style Notice Banner for Past / Future Dates */}
            {periodNotice && (
              <div className={`sfx-dp-apple-notice sfx-dp-apple-notice--${periodNotice.type}`}>
                <span className="sfx-dp-apple-notice__icon">
                  {periodNotice.type === "past" ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  )}
                </span>
                <div className="sfx-dp-apple-notice__content">
                  <span className="sfx-dp-apple-notice__title">{periodNotice.title}</span>
                  <span className="sfx-dp-apple-notice__sub">{periodNotice.subtitle}</span>
                </div>
              </div>
            )}

            <div className={`sfx-dp-cal ${animDirection ? `anim-${animDirection}` : ""}`}>
              <DateRangePicker
                key={shownDate.getTime()}
                onChange={(item) => onDraftChange?.(item.selection)}
                moveRangeOnFirstSelection={false}
                months={months}
                shownDate={shownDate}
                onShownDateChange={(d) => setShownDate(d)}
                preventSnapToSelection={true}
                ranges={activeRanges}
                direction="horizontal"
                maxDate={allowFuture ? undefined : today}
                minDate={minDate || undefined}
                rangeColors={["#9f8655"]}
                showDateDisplay={false}
              />
            </div>
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
