import React, { useState, useEffect, useRef } from "react";
import { Calendar, ChevronLeft, ChevronRight, AlertCircle, X } from "lucide-react";
import "../styles/custom-datepicker.css";

/**
 * Checks if a given year is a leap year.
 * Rule: Year divisible by 4, except if divisible by 100 unless also divisible by 400.
 */
export function isLeapYear(year) {
  const y = Number(year);
  if (isNaN(y) || y <= 0) return false;
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/**
 * Returns total days in a specified month (1-indexed: 1..12).
 */
export function getDaysInMonth(month, year) {
  const m = Number(month);
  const y = Number(year);
  if ([1, 3, 5, 7, 8, 10, 12].includes(m)) return 31;
  if ([4, 6, 9, 11].includes(m)) return 30;
  if (m === 2) {
    return isLeapYear(y) ? 29 : 28;
  }
  return 0;
}

/**
 * Validates DD/MM/YYYY string date.
 * Returns { valid: boolean, message?: string, ymd?: string }
 */
export function validateDateInput(dateStr) {
  if (!dateStr || dateStr.trim() === "") {
    return { valid: true, ymd: "" };
  }

  const parts = dateStr.split("/");
  if (parts.length !== 3) {
    return { valid: false, message: "Định dạng ngày phải là DD/MM/YYYY" };
  }

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    return { valid: false, message: "Ngày, tháng, năm phải là số hợp lệ" };
  }

  if (year < 1900 || year > 2100) {
    return { valid: false, message: "Năm phải từ 1900 đến 2100" };
  }

  if (month < 1 || month > 12) {
    return { valid: false, message: `Tháng ${month} không hợp lệ (1 - 12)` };
  }

  const maxDays = getDaysInMonth(month, year);
  if (day < 1 || day > maxDays) {
    if (month === 2) {
      const leapText = isLeapYear(year) ? "năm nhuận" : "năm không nhuận";
      return {
        valid: false,
        message: `Tháng 2 năm ${year} (${leapText}) chỉ có ${maxDays} ngày!`,
      };
    }
    return {
      valid: false,
      message: `Tháng ${month} chỉ có tối đa ${maxDays} ngày!`,
    };
  }

  const ymd = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { valid: true, ymd };
}

export default function CustomDatePicker({ value, onChange }) {
  // Local display text in DD/MM/YYYY format
  const [inputText, setInputText] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Popup calendar view state (month: 0..11, year)
  const [viewDate, setViewDate] = useState(() => new Date());

  const containerRef = useRef(null);
  const errorTimerRef = useRef(null);

  // Sync value from prop (value is expected in YYYY-MM-DD or empty)
  useEffect(() => {
    if (value) {
      const [y, m, d] = value.split("-");
      if (y && m && d) {
        setInputText(`${d}/${m}/${y}`);
        setViewDate(new Date(Number(y), Number(m) - 1, Number(d)));
        return;
      }
    }
    setInputText("");
  }, [value]);

  // Auto-hide error toast after 5 seconds
  const showError = (msg) => {
    setErrorMessage(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => {
      setErrorMessage("");
    }, 5000);
  };

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard key restrictions: Only allow numbers, Backspace, Delete, Tab, Arrows, Enter
  const handleKeyDown = (e) => {
    const allowedKeys = [
      "Backspace", "Delete", "Tab", "Escape", "Enter",
      "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
    ];
    if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) {
      return;
    }
    // Block any non-digit character (e.g. letters, symbols)
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      showError("Chỉ được nhập chữ số (0-9)!");
    }
  };

  // Handle Input text changes with auto slash formatting (DD/MM/YYYY)
  const handleInputChange = (e) => {
    let raw = e.target.value.replace(/[^0-9]/g, "");
    if (raw.length > 8) raw = raw.slice(0, 8);

    let formatted = "";
    if (raw.length > 0) {
      formatted += raw.slice(0, 2);
      if (raw.length >= 3) {
        formatted += "/" + raw.slice(2, 4);
      }
      if (raw.length >= 5) {
        formatted += "/" + raw.slice(4, 8);
      }
    }

    setInputText(formatted);

    // If completely typed 10 characters (DD/MM/YYYY), validate immediately
    if (formatted.length === 10) {
      const result = validateDateInput(formatted);
      if (result.valid) {
        setErrorMessage("");
        onChange?.(result.ymd);
        const [d, m, y] = formatted.split("/").map(Number);
        setViewDate(new Date(y, m - 1, d));
      } else {
        showError(result.message);
      }
    } else if (formatted === "") {
      setErrorMessage("");
      onChange?.("");
    }
  };

  // Validate on blur if partial date entered
  const handleBlur = () => {
    if (inputText && inputText.length > 0 && inputText.length < 10) {
      showError("Vui lòng nhập đủ ngày/tháng/năm (DD/MM/YYYY)");
    }
  };

  // Select day from popup calendar
  const handleSelectDay = (day) => {
    const month = viewDate.getMonth() + 1;
    const year = viewDate.getFullYear();
    const formatted = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
    const ymd = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    setInputText(formatted);
    setErrorMessage("");
    onChange?.(ymd);
    setIsOpen(false);
  };

  // Navigate calendar month
  const changeMonth = (delta) => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  // Calendar rendering helpers
  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth(); // 0..11
  const daysCount = getDaysInMonth(currentMonth + 1, currentYear);
  const firstDayIndex = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7; // Monday-based index

  const monthNames = [
    "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
    "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
  ];

  const today = new Date();
  const selectedYMD = value;

  return (
    <div className="cdp-wrapper" ref={containerRef}>
      <div className={`cdp-input-container ${errorMessage ? "cdp-input-container--error" : ""}`}>
        <input
          type="text"
          className="cdp-input"
          placeholder="DD/MM/YYYY"
          value={inputText}
          onKeyDown={handleKeyDown}
          onChange={handleInputChange}
          onBlur={handleBlur}
          maxLength={10}
        />
        <button
          type="button"
          className="cdp-icon-btn"
          onClick={() => setIsOpen((prev) => !prev)}
          title="Mở lịch chọn ngày"
        >
          <Calendar size={17} />
        </button>
      </div>

      {/* Red Error Toast Notification (Auto-disappears after 5s) */}
      {errorMessage && (
        <div className="cdp-error-toast" role="alert">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
          <button
            type="button"
            className="cdp-error-toast__close"
            onClick={() => setErrorMessage("")}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Interactive Dropdown Popup Calendar */}
      {isOpen && (
        <div className="cdp-popup">
          <div className="cdp-popup-header">
            <button type="button" className="cdp-nav-btn" onClick={() => changeMonth(-1)}>
              <ChevronLeft size={16} />
            </button>
            <span className="cdp-month-title">
              {monthNames[currentMonth]} {currentYear}
            </span>
            <button type="button" className="cdp-nav-btn" onClick={() => changeMonth(1)}>
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="cdp-weekdays">
            {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
              <span key={day} className="cdp-weekday">
                {day}
              </span>
            ))}
          </div>

          <div className="cdp-days-grid">
            {/* Empty padding slots before first day of month */}
            {Array.from({ length: firstDayIndex }).map((_, idx) => (
              <span key={`empty-${idx}`} className="cdp-day-btn cdp-day-btn--empty" />
            ))}

            {/* Day buttons */}
            {Array.from({ length: daysCount }).map((_, idx) => {
              const dayNum = idx + 1;
              const ymd = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
              const isSelected = selectedYMD === ymd;
              const isToday =
                today.getFullYear() === currentYear &&
                today.getMonth() === currentMonth &&
                today.getDate() === dayNum;

              let classes = "cdp-day-btn";
              if (isToday) classes += " cdp-day-btn--today";
              if (isSelected) classes += " cdp-day-btn--selected";

              return (
                <button
                  key={dayNum}
                  type="button"
                  className={classes}
                  onClick={() => handleSelectDay(dayNum)}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          <div className="cdp-popup-footer">
            <button
              type="button"
              className="cdp-action-btn"
              onClick={() => {
                const now = new Date();
                setViewDate(now);
                handleSelectDay(now.getDate());
              }}
            >
              Hôm nay
            </button>
            <button
              type="button"
              className="cdp-action-btn"
              onClick={() => {
                setInputText("");
                setErrorMessage("");
                onChange?.("");
                setIsOpen(false);
              }}
            >
              Xóa bộ lọc
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
