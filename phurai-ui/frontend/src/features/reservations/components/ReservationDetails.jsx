import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom'; // HMR trigger
import { useNavigate } from 'react-router-dom';
import TableBoard from './choose-table/TableBoard.jsx';
import BookingAlerts from './choose-time/BookingAlerts.jsx';
import { validateTableCapacity } from '../utils/validateTableCapacity';
import '../styles/ReservationDetails.css';

const STEPS = ['Details', 'Summary', 'Payment', 'Confirmed'];

const addMinutesToTime = (timeStr, minsToAdd) => {
  if (!timeStr) return '';
  const [hh, mm] = timeStr.split(':').map(Number);
  const totalMins = hh * 60 + mm + Number(minsToAdd);
  const endHH = Math.floor(totalMins / 60);
  const endMM = totalMins % 60;
  return `${String(endHH % 24).padStart(2, '0')}:${String(endMM).padStart(2, '0')}`;
};

const getMins = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

const getMinutesBetweenTimes = (startStr, endStr) => {
  if (!startStr || !endStr) return 0;
  const [sHH, sMM] = startStr.split(':').map(Number);
  const [eHH, eMM] = endStr.split(':').map(Number);
  let startMins = sHH * 60 + sMM;
  let endMins = eHH * 60 + eMM;
  if (endMins < startMins) {
    endMins += 24 * 60; // Next day
  }
  return endMins - startMins;
};

// ─── Custom select dropdown (Apple style) ──────────────────────
function CustomSelect({ value, onChange, options, className }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const resolvedOptions = useMemo(() => {
    return options.map(opt => typeof opt === 'string' ? { value: opt, label: opt } : opt);
  }, [options]);

  const activeOption = useMemo(() => {
    return resolvedOptions.find(o => String(o.value) === String(value)) || resolvedOptions[0];
  }, [resolvedOptions, value]);

  return (
    <div className={`rd-custom-select-container ${isOpen ? 'rd-custom-select-container--open' : ''} ${className || ''}`} ref={containerRef}>
      <button
        type="button"
        className={`rd-custom-select-trigger ${isOpen ? 'rd-custom-select-trigger--open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{activeOption?.label || value}</span>
        <span className={`rd-custom-select-arrow ${isOpen ? 'rd-custom-select-arrow--open' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="rd-custom-select-dropdown">
          {resolvedOptions.map((opt) => {
            const isSelected = String(value) === String(opt.value);
            return (
              <div
                key={opt.value}
                className={`rd-custom-select-option ${isSelected ? 'rd-custom-select-option--selected' : ''}`}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                <span className="rd-custom-select-tick">{isSelected ? '✓' : ''}</span>
                <span className="rd-custom-select-label-text">{opt.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

// ─── Custom Date Picker (Apple style) ─────────────────────────────────────────
function CustomDatePicker({ value, onChange, minDate, maxDate, className }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const initialDate = useMemo(() => {
    if (value) {
      const [y, m, d] = value.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  }, [value]);

  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth());

  const getFormattedValue = useCallback((dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d}/${m}/${y}`;
    }
    return dateStr;
  }, []);

  const [inputValue, setInputValue] = useState(getFormattedValue(value));

  useEffect(() => {
    setInputValue(getFormattedValue(value));
  }, [value, getFormattedValue]);

  useEffect(() => {
    if (value) {
      const [y, m] = value.split('-').map(Number);
      setCurrentYear(y);
      setCurrentMonth(m - 1);
    }
  }, [value]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayIndex = getFirstDayOfMonth(currentYear, currentMonth);
  const prevMonthDays = getDaysInMonth(currentYear, currentMonth - 1);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const selectDay = (day) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(dateStr);
    setIsOpen(false);
  };

  const setToday = () => {
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    onChange(todayStr);
    setIsOpen(false);
  };

  const clearDate = () => {
    onChange('');
    setIsOpen(false);
  };

  const handleInputChange = (e) => {
    let val = e.target.value;
    // Allow only numbers and /
    val = val.replace(/[^0-9/]/g, '');

    const parts = val.split('/');
    let dayStr = parts[0] || '';
    let monthStr = parts[1] || '';
    let yearStr = parts[2] || '';

    // Validate day: 1 to 31
    if (dayStr.length > 0) {
      const dNum = parseInt(dayStr, 10);
      if (dNum > 31) dayStr = '31';
    }

    // Validate month: 1 to 12
    if (monthStr.length > 0) {
      const mNum = parseInt(monthStr, 10);
      if (mNum > 12) monthStr = '12';
    }

    // Validate year: limit to 4 digits
    if (yearStr.length > 4) {
      yearStr = yearStr.substring(0, 4);
    }

    dayStr = dayStr.substring(0, 2);
    monthStr = monthStr.substring(0, 2);

    let finalVal = dayStr;
    if (val.includes('/')) {
      finalVal += '/' + monthStr;
      if (parts.length > 2 || monthStr.length === 2) {
        finalVal += '/' + yearStr;
      }
    } else if (dayStr.length === 2 && e.nativeEvent && e.nativeEvent.inputType !== 'deleteContentBackward') {
      finalVal += '/' + monthStr;
    }

    setInputValue(finalVal);

    // If full date is typed (DD/MM/YYYY), parse and notify parent
    if (finalVal.length === 10) {
      const [d, m, y] = finalVal.split('/').map(Number);
      const currentYearVal = new Date().getFullYear();
      const parsedYear = y || currentYearVal;
      if (!isNaN(d) && d >= 1 && d <= 31 && !isNaN(m) && m >= 1 && m <= 12 && !isNaN(parsedYear)) {
        const dateStr = `${parsedYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        onChange(dateStr);
      }
    }
  };

  const handleInputBlur = () => {
    let val = inputValue;
    if (!val) {
      onChange('');
      return;
    }

    const parts = val.split('/');
    let dayStr = parts[0] || '';
    let monthStr = parts[1] || '';
    let yearStr = parts[2] || '';

    const currentYearVal = new Date().getFullYear();

    // If year is empty or not 4 digits, default to current year
    if (!yearStr || yearStr.length < 4) {
      yearStr = String(currentYearVal);
    }

    const d = parseInt(dayStr, 10);
    const m = parseInt(monthStr, 10);
    const y = parseInt(yearStr, 10);

    if (!isNaN(d) && d >= 1 && d <= 31 && !isNaN(m) && m >= 1 && m <= 12) {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      onChange(dateStr);
      setInputValue(`${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`);
    } else {
      if (value) {
        const [valY, valM, valD] = value.split('-');
        setInputValue(`${valD}/${valM}/${valY}`);
      } else {
        setInputValue('');
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInputBlur();
      setIsOpen(false);
    }
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysOfWeek = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <div className={`rd-custom-select-container ${isOpen ? 'rd-custom-select-container--open' : ''} ${className || ''}`} ref={containerRef}>
      <div
        className={`rd-custom-select-trigger ${isOpen ? 'rd-custom-select-trigger--open' : ''}`}
        onClick={(e) => {
          const inputEl = e.currentTarget.querySelector('input');
          if (inputEl) inputEl.focus();
        }}
        style={{ cursor: 'text' }}
      >
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="DD/MM/YYYY"
          className="rd-datepicker-input"
        />
        <span
          className={`rd-custom-select-arrow ${isOpen ? 'rd-custom-select-arrow--open' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          style={{ cursor: 'pointer' }}
        />
      </div>

      {isOpen && (
        <div className="rd-custom-select-dropdown rd-datepicker-dropdown">
          <div className="rd-datepicker-header">
            <button type="button" className="rd-datepicker-nav-btn" onClick={handlePrevMonth}>&lt;</button>
            <span className="rd-datepicker-title">{monthNames[currentMonth]} {currentYear}</span>
            <button type="button" className="rd-datepicker-nav-btn" onClick={handleNextMonth}>&gt;</button>
          </div>

          <div className="rd-datepicker-weekdays">
            {daysOfWeek.map(d => (
              <div key={d} className="rd-datepicker-weekday">{d}</div>
            ))}
          </div>

          <div className="rd-datepicker-days">
            {Array.from({ length: firstDayIndex }).map((_, idx) => {
              const dayNum = prevMonthDays - firstDayIndex + idx + 1;
              return (
                <div key={`prev-${idx}`} className="rd-datepicker-day rd-datepicker-day--outside">
                  {dayNum}
                </div>
              );
            })}

            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const isDisabled = dateStr < minDate || dateStr > maxDate;
              const isSelected = value === dateStr;

              return (
                <button
                  key={`day-${dayNum}`}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => selectDay(dayNum)}
                  className={`rd-datepicker-day ${isSelected ? 'rd-datepicker-day--selected' : ''} ${isDisabled ? 'rd-datepicker-day--disabled' : ''}`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          <div className="rd-datepicker-footer">
            <button type="button" className="rd-btn-outline rd-datepicker-footer-btn" onClick={setToday}>Today</button>
            <button type="button" className="rd-btn-outline rd-datepicker-footer-btn" onClick={clearDate}>Clear</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Custom Time Picker (Apple iOS 26 Wheel style) ────────────────────────────
function CustomTimePicker({ value, onChange, availableTimes, className }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const initialTime = useMemo(() => {
    if (value && value.includes(':')) {
      const [h, m] = value.split(':').map(Number);
      return { hour: h, minute: m };
    }
    return { hour: 10, minute: 0 };
  }, [value]);

  const [selectedHour, setSelectedHour] = useState(initialTime.hour);
  const [selectedMinute, setSelectedMinute] = useState(initialTime.minute);
  const [inputValue, setInputValue] = useState(value || '');

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  useEffect(() => {
    if (value && value.includes(':')) {
      const [h, m] = value.split(':').map(Number);
      setSelectedHour(h);
      setSelectedMinute(m);
    }
  }, [value]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const hours = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
  const minutes = [0, 15, 30, 45];

  const currentSelectionStr = useMemo(() => {
    return `${String(selectedHour).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`;
  }, [selectedHour, selectedMinute]);

  const isSelectionAvailable = useMemo(() => {
    return availableTimes.includes(currentSelectionStr);
  }, [availableTimes, currentSelectionStr]);

  const handleDone = () => {
    if (isSelectionAvailable) {
      onChange(currentSelectionStr);
      setIsOpen(false);
    }
  };

  const handleInputChange = (e) => {
    let val = e.target.value;

    // Filter characters: only numbers and colon
    val = val.replace(/[^0-9:]/g, '');

    // Parse parts to validate
    const parts = val.split(':');
    let hoursStr = parts[0] || '';
    let minsStr = parts[1] || '';

    // Validate hour part: cannot exceed 23 (24h format limit)
    if (hoursStr.length > 0) {
      const hNum = parseInt(hoursStr, 10);
      if (hNum > 23) {
        hoursStr = '23';
      }
    }

    // Validate minute part: cannot exceed 59
    if (minsStr.length > 0) {
      const mNum = parseInt(minsStr, 10);
      if (mNum > 59) {
        minsStr = '59';
      }
    }

    // Truncate to maximum lengths
    hoursStr = hoursStr.substring(0, 2);
    minsStr = minsStr.substring(0, 2);

    // Reconstruct value
    let finalVal = hoursStr;
    if (val.includes(':')) {
      finalVal += ':' + minsStr;
    } else if (hoursStr.length === 2 && e.nativeEvent && e.nativeEvent.inputType !== 'deleteContentBackward') {
      // Auto-insert colon only when typing forwards and hours is 2 digits
      finalVal += ':' + minsStr;
    }

    setInputValue(finalVal);

    // Auto-update wheel state if we have a full valid time (length 5)
    if (finalVal.length === 5) {
      const [h, m] = finalVal.split(':').map(Number);
      if (!isNaN(h) && h >= 0 && h <= 23 && !isNaN(m) && m >= 0 && m <= 59) {
        setSelectedHour(h);
        setSelectedMinute(m);
      }
    }
  };

  const handleInputBlur = () => {
    if (inputValue.length === 5) {
      const [h, m] = inputValue.split(':').map(Number);
      if (!isNaN(h) && h >= 0 && h <= 23 && !isNaN(m) && m >= 0 && m <= 59) {
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        onChange(timeStr);
      }
    } else {
      setInputValue(value || '');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputValue.length === 5) {
        const [h, m] = inputValue.split(':').map(Number);
        if (!isNaN(h) && h >= 0 && h <= 23 && !isNaN(m) && m >= 0 && m <= 59) {
          const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          onChange(timeStr);
          setIsOpen(false);
        }
      }
    }
  };

  return (
    <div className={`rd-custom-select-container ${isOpen ? 'rd-custom-select-container--open' : ''} ${className || ''}`} ref={containerRef}>
      <div
        className={`rd-custom-select-trigger ${isOpen ? 'rd-custom-select-trigger--open' : ''}`}
        onClick={(e) => {
          const inputEl = e.currentTarget.querySelector('input');
          if (inputEl) inputEl.focus();
        }}
        style={{ cursor: 'text' }}
      >
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="HH:MM"
          className="rd-timepicker-input"
        />
        <span
          className={`rd-custom-select-arrow ${isOpen ? 'rd-custom-select-arrow--open' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          style={{ cursor: 'pointer' }}
        />
      </div>

      {isOpen && (
        <div className="rd-custom-select-dropdown rd-timepicker-dropdown">
          <div className="rd-timepicker-columns">
            <div className="rd-timepicker-column">
              <div className="rd-timepicker-col-label">Hour</div>
              <div className="rd-timepicker-col-list">
                {hours.map(h => {
                  const label = String(h).padStart(2, '0');
                  const isHourSelected = selectedHour === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => {
                        setSelectedHour(h);
                        const newTimeStr = `${String(h).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`;
                        setInputValue(newTimeStr);
                      }}
                      className={`rd-timepicker-item ${isHourSelected ? 'rd-timepicker-item--selected' : ''}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rd-timepicker-column">
              <div className="rd-timepicker-col-label">Minute</div>
              <div className="rd-timepicker-col-list">
                {minutes.map(m => {
                  const label = String(m).padStart(2, '0');
                  const isMinSelected = selectedMinute === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setSelectedMinute(m);
                        const newTimeStr = `${String(selectedHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                        setInputValue(newTimeStr);
                      }}
                      className={`rd-timepicker-item ${isMinSelected ? 'rd-timepicker-item--selected' : ''}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rd-timepicker-footer">
            {!isSelectionAvailable && (
              <span className="rd-timepicker-warning">
                Time slot is unavailable
              </span>
            )}
            <button
              type="button"
              disabled={!isSelectionAvailable}
              onClick={handleDone}
              className="rd-btn-primary rd-timepicker-done-btn"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReservationDetails({
  onContinue,
  onGoHome,
  initialForm,
  tables,
  selectedTableId,
  onSelectTable,
  tablesLoading,
  isAuthenticated,
  onUpdateForm,
  tableHoldMin = 15,
  error
}) {
  const navigate = useNavigate();
  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getMaxDateString = () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };



  const getInitialDuration = () => {
    if (!initialForm?.duration) return 30;
    const parsed = typeof initialForm.duration === 'string'
      ? parseInt(initialForm.duration, 10)
      : Number(initialForm.duration);
    if (parsed === 90 || parsed === 120) return 30; // map legacy/unsupported values
    return [15, 30, 45, 60].includes(parsed) ? parsed : 30;
  };

  const initialDuration = getInitialDuration();
  const isStaleEndTime = initialForm?.duration && Number(initialForm.duration) !== initialDuration;

  const [form, setForm] = useState({
    date: initialForm?.date || getTodayString(),
    startTime: initialForm?.startTime || '',
    selectedTable: initialForm?.selectedTable || null,
    guests: initialForm?.guests !== undefined && initialForm?.guests !== null ? initialForm.guests : '',
    duration: initialDuration,
    endTime: initialForm?.endTime || '',
    diningPurpose: initialForm?.diningPurpose || 'Casual Dinner',
    diningPurposeNote: initialForm?.diningPurposeNote || '',
    fullName: initialForm?.fullName || '',
    email: initialForm?.email || '',
    phone: initialForm?.phone || '',
  });

  const [isCustomEndTime, setIsCustomEndTime] = useState(false);
  const [showTableBoard, setShowTableBoard] = useState(false);
  const [errors, setErrors] = useState({});
  const [isTransitioning, setIsTransitioning] = useState(false);

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

  // Automatically clear selected table if guest count changes and becomes invalid for table capacity
  useEffect(() => {
    if (selectedTableId && tables && form.guests !== '') {
      const selectedTable = tables.find(t => t.table_id === selectedTableId);
      if (selectedTable) {
        const isValid = validateTableCapacity(form.guests, selectedTable.capacity);
        if (!isValid) {
          onSelectTable(null);
        }
      }
    }
  }, [form.guests, selectedTableId, tables, onSelectTable]);

  const todayStr = getTodayString();
  const isToday = form.date === todayStr;

  const [tableBookings, setTableBookings] = useState([]);

  useEffect(() => {
    if (!selectedTableId || !form.date) {
      setTableBookings([]);
      return;
    }
    
    let active = true;
    fetch(`/api/reservations/table-bookings?tableId=${selectedTableId}&date=${form.date}`)
      .then(res => res.json())
      .then(data => {
        if (active && data.success) {
          setTableBookings(data.bookings || []);
        }
      })
      .catch(err => console.error("Failed to fetch table bookings:", err));

    return () => {
      active = false;
    };
  }, [selectedTableId, form.date]);

  useEffect(() => {
    if (error) {
      setIsTransitioning(false);
      isTransitioningRef.current = false;
    }
  }, [error]);

  const isTimeConflicting = useCallback((timeStr) => {
    if (!timeStr || tableBookings.length === 0) return false;
    const tMins = getMins(timeStr);
    
    return tableBookings.some(booking => {
      const startObj = new Date(booking.start);
      const endObj = new Date(booking.end);
      
      const startMins = startObj.getHours() * 60 + startObj.getMinutes();
      const endMins = endObj.getHours() * 60 + endObj.getMinutes();
      
      const blockedStart = startMins - 60;
      const blockedEnd = endMins + 60;
      
      return tMins > blockedStart && tMins < blockedEnd;
    });
  }, [tableBookings]);

  const generateTimeOptions = (startHour, endHour, stepMins = 15) => {
    const options = [];
    for (let h = startHour; h <= endHour; h++) {
      for (let m = 0; m < 60; m += stepMins) {
        if (h === endHour && m > 0) continue;
        options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    return options;
  };

  const getDiningDuration = (guestCount) => {
    const count = Number(guestCount) || 1;
    if (count <= 2) return 60;
    if (count <= 4) return 90;
    if (count <= 6) return 105;
    return 120;
  };

  useEffect(() => {
    if (form.startTime && form.guests) {
      const [h, m] = form.startTime.split(':').map(Number);
      const diningDuration = getDiningDuration(form.guests);
      let endMins = h * 60 + m + diningDuration;
      const endH = Math.floor(endMins / 60) % 24;
      const endM = endMins % 60;
      const computedEndTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
      
      setForm(prev => {
        if (prev.endTime !== computedEndTime) {
          if (onUpdateForm) onUpdateForm('endTime', computedEndTime);
          return { ...prev, endTime: computedEndTime };
        }
        return prev;
      });
    }
  }, [form.startTime, form.guests, onUpdateForm]);

  const handleStartTimeChange = (newStartTime) => {
    setForm(prev => ({ ...prev, startTime: newStartTime }));
    if (onUpdateForm) {
      onUpdateForm('startTime', newStartTime);
    }
  };

  const startHoursOptions = useMemo(() => {
    const all = generateTimeOptions(10, 22, 15);
    return all.filter(time => !isTimeConflicting(time));
  }, [tableBookings, isTimeConflicting]);

  const handleDurationChange = (newDurationStr) => {
    const newDuration = Number(newDurationStr);
    setForm(prev => ({ ...prev, duration: newDuration }));
    if (onUpdateForm) {
      onUpdateForm('duration', newDuration);
    }
  };

  const isCase3Invalid = (() => {
    return false;
  })();

  const isTimeInvalid = (() => {
    if (form.guests > 10) return false;
    if (form.startTime) {
      const [sh, sm] = form.startTime.split(':').map(Number);
      if ((sh * 60 + sm) < 600) return true;
    }
    if (form.endTime) {
      const [eh, em] = form.endTime.split(':').map(Number);
      let endMin = (eh === 0 && em === 0) ? 1440 : (eh * 60 + em);
      if (eh === 0 && em > 0) endMin = 1440 + em;
      if (endMin > 1440) return true;
    }
    return false;
  })();

  const isDateInvalid = (() => {
    if (!form.date) return false;
    return form.date < getTodayString() || form.date > getMaxDateString();
  })();

  const fieldRefs = useRef({});
  const isTransitioningRef = useRef(false);

  const registerRef = useCallback((name) => (el) => {
    fieldRefs.current[name] = el;
  }, []);

  const scrollFieldIntoView = useCallback((name) => {
    const el = fieldRefs.current[name];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const updateField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    if (onUpdateForm) onUpdateForm(name, value);
  };



  const adjustGuests = (delta) => {
    // Compute new value first (read from current form ref, not inside setForm updater)
    const current = Number(form.guests) || 0;
    const newVal = Math.max(1, current + delta);
    // Update local state and notify parent separately — never call parent setState
    // inside a setForm updater (that runs during render phase and causes React errors)
    setForm(prev => ({ ...prev, guests: newVal }));
    if (onUpdateForm) onUpdateForm('guests', newVal);
  };

  const handleConfirmSummary = async (e) => {
    if (e) e.preventDefault();
    if (isTransitioningRef.current) {
      console.log("Already transitioning. Ignoring click.");
      return;
    }
    const newErrors = {};

    // Validate Guests
    if (form.guests === '' || form.guests === null || form.guests === undefined) {
      newErrors.guests = "Please select the number of guests.";
    } else {
      const gNum = Number(form.guests);
      if (gNum < 1) {
        newErrors.guests = "Invalid guest count (minimum 1 guest).";
      } else if (gNum > 10) {
        newErrors.guests = "Guest count exceeds limit (maximum 10 guests).";
      }
    }

    // Validate Date
    if (!form.date) {
      newErrors.date = "Please select a valid date.";
    } else if (form.date < getTodayString()) {
      newErrors.date = "Cannot book a table in the past.";
    } else if (form.date > getMaxDateString()) {
      newErrors.date = "Reservations can only be made up to 1 year in advance.";
    }

    // Validate Start Time
    if (!form.startTime) {
      newErrors.startTime = "Please select a start time.";
    } else {
      const [sh, sm] = form.startTime.split(':').map(Number);
      if ((sh * 60 + sm) < 600) {
        newErrors.startTime = "The restaurant opens at 10:00 AM. Please choose a valid time.";
      } else if (isTimeConflicting(form.startTime)) {
        newErrors.startTime = "This time slot is already booked, please select another time.";
      }
    }

    // Validate End Time / Duration
    if (!form.duration) {
      newErrors.duration = "Please select a hold duration.";
    }

    if (form.startTime && form.endTime) {
      if (isTimeConflicting(form.startTime) || isTimeConflicting(form.endTime)) {
        newErrors.startTime = "This time slot conflicts with an existing booking on the selected table. Please choose another time.";
      }
    }

    // Validate Table Selection (only if guests is 1-10)
    if (form.guests !== '' && Number(form.guests) >= 1 && Number(form.guests) <= 10) {
      if (!selectedTableId) {
        newErrors.selectedTable = "Please select a table on the floor plan.";
      }
    }

    // Validate Personal Info
    if (!form.fullName || !form.fullName.trim()) {
      newErrors.fullName = "Please enter your full name.";
    }

    if (!form.phone || !form.phone.trim()) {
      newErrors.phone = "Please enter your phone number.";
    } else if (!/^[+]?[\d\s().-]{7,15}$/.test(form.phone.trim())) {
      newErrors.phone = "Invalid phone number (must be 7 to 15 digits).";
    }

    if (!form.email || !form.email.trim()) {
      newErrors.email = "Please enter your email address.";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email.trim())) {
        newErrors.email = "Invalid email address.";
      }
    }

    if (isCase3Invalid) {
      newErrors.startTime = "Booking start time plus hold duration exceeds midnight.";
    }

    console.log("handleConfirmSummary invoked. newErrors:", newErrors, "isCase3Invalid:", isCase3Invalid, "selectedTableId:", selectedTableId);
    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0 && !isCase3Invalid && !error) {
      console.log("Validation passed. Calling onContinue with form payload...");
      isTransitioningRef.current = true;
      setIsTransitioning(true);
      const payload = {
        ...form,
        selectedTable: selectedTableId
      };
      // Fire-and-forget — transitionToSummary is synchronous (uses setTimeout internally),
      // so we do NOT await it. The component will unmount during the 350ms animation;
      // never reset isTransitioning so the button stays disabled until then.
      try {
        if (onContinue) {
          onContinue(payload);
        }
      } catch (err) {
        console.error("Transition failed:", err);
        isTransitioningRef.current = false;
        setIsTransitioning(false);
      }
    } else {
      console.log("Validation failed. Errors found:", Object.keys(newErrors));
      // Scroll to the first error
      const firstErrorField = Object.keys(newErrors)[0];
      scrollFieldIntoView(firstErrorField);
    }
  };

  return (
    <div className="rd-card">
      <h2 className="rd-card-title">Reservation details</h2>
      <p className="rd-card-subtitle">Select when you would like to dine and the atmosphere you prefer.</p>

      <div className="rd-row-2">
        <div className="rd-field" ref={registerRef('date')}>
          <label>DATE</label>
          <CustomDatePicker
            value={form.date}
            onChange={(val) => updateField('date', val)}
            minDate={getTodayString()}
            maxDate={getMaxDateString()}
            className={errors.date ? 'rd-select--error' : ''}
          />
          {errors.date && <p className="rd-error-message">{errors.date}</p>}
        </div>
      </div>

      <div className="rd-row-2">
        <div className="rd-field" ref={registerRef('startTime')} style={{ marginTop: '1rem' }}>
          <label>START TIME</label>
          {form.guests > 10 ? (
            <input type="text" readOnly value="Not available for large groups" className="rd-disabled-input" />
          ) : (
            <>
              <CustomTimePicker
                value={form.startTime}
                onChange={handleStartTimeChange}
                availableTimes={startHoursOptions}
                className={errors.startTime ? 'rd-select--error' : ''}
              />
              {errors.startTime && <p className="rd-error-message">{errors.startTime}</p>}
            </>
          )}
        </div>
      </div>

      <div className="rd-row-3" ref={registerRef('guests')} style={{ marginTop: '1rem' }}>
        <div className="rd-field">
          <label>GUESTS</label>
          <div className={`rd-guest-stepper ${errors.guests ? 'rd-guest-stepper--error' : ''}`}>
            <button type="button" onClick={() => adjustGuests(-1)} aria-label="Decrease guests">-</button>
            <input type="text" value={form.guests} readOnly />
            <button type="button" onClick={() => adjustGuests(1)} aria-label="Increase guests">+</button>
          </div>
          {errors.guests && <p className="rd-error-message">{errors.guests}</p>}
        </div>
      </div>

      {form.guests !== '' && form.guests > 10 ? (
        <div style={{ padding: "1rem", background: "#fff3cd", color: "#856404", border: "1px solid #ffeeba", borderRadius: "8px", marginBottom: "1.5rem" }}>
          <strong>Note: </strong>For groups of more than 10 people, please contact our Hotline or switch to the Private Events page so we can prepare the best space for you.
        </div>
      ) : (
        <>
          <div style={{ marginTop: "1rem", marginBottom: "1rem" }} ref={registerRef('selectedTable')}>
            {!selectedTableId ? (
              <>
                <button
                  type="button"
                  className={`rd-btn-outline ${(!form.guests || form.guests < 1 || form.guests > 10) ? 'opacity-50 cursor-not-allowed' : ''} ${errors.selectedTable ? 'rd-btn-outline--error' : ''}`}
                  onClick={() => form.guests && form.guests >= 1 && form.guests <= 10 && setShowTableBoard(true)}
                  disabled={!form.guests || form.guests < 1 || form.guests > 10}
                >
                  CHOOSE AND VIEW TABLE
                </button>
                {errors.selectedTable && <p className="rd-error-message">{errors.selectedTable}</p>}
                {(!form.guests || form.guests < 1 || form.guests > 10) && (
                  <p className="text-amber-600 text-sm mt-1">
                    Please select the number of guests before choosing a table.
                  </p>
                )}
                {showTableBoard && createPortal(
                  <div className="rzv-fullscreen-overlay" onClick={() => setShowTableBoard(false)}>
                    <div className="rzv-fullscreen-content" onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                        <h3 style={{ margin: 0, color: "var(--text-color)" }}>Choose your table</h3>
                        <button
                          type="button"
                          className="rzv-btn rzv-btn--ghost"
                          onClick={() => setShowTableBoard(false)}
                        >
                          ✕ Close
                        </button>
                      </div>
                      <TableBoard
                        tables={tables || []}
                        selectedTableId={selectedTableId}
                        onSelectTable={(tableId) => {
                          onSelectTable(tableId);
                          setShowTableBoard(false);
                        }}
                        loading={tablesLoading}
                        guestCount={form.guests}
                        isAuthenticated={isAuthenticated}
                        onNavigateLogin={() => navigate('/login')}
                        onNavigateRegister={() => navigate('/register')}
                      />
                    </div>
                  </div>,
                  document.body
                )}
              </>
            ) : (
              <div style={{ padding: "1rem", border: "1px solid #ddd", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p className="rd-selected-table" style={{ margin: 0, fontWeight: 500, fontSize: "0.9rem" }}>
                  Selected table: {tables?.find((t) => t.table_id === selectedTableId)?.display_label || selectedTableId}
                </p>
                <button
                  type="button"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    textDecoration: 'underline',
                    cursor: (form.guests && form.guests >= 1 && form.guests <= 10) ? 'pointer' : 'not-allowed',
                    fontSize: '0.85rem',
                    opacity: (form.guests && form.guests >= 1 && form.guests <= 10) ? 1 : 0.5
                  }}
                  onClick={() => form.guests && form.guests >= 1 && form.guests <= 10 && setShowTableBoard(true)}
                  disabled={!form.guests || form.guests < 1 || form.guests > 10}
                >
                  Edit Table
                </button>
                {showTableBoard && createPortal(
                  <div className="rzv-fullscreen-overlay" onClick={() => setShowTableBoard(false)}>
                    <div className="rzv-fullscreen-content" onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                        <h3 style={{ margin: 0, color: "var(--text-color)" }}>Choose your table</h3>
                        <button
                          type="button"
                          className="rzv-btn rzv-btn--ghost"
                          onClick={() => setShowTableBoard(false)}
                        >
                          ✕ Close
                        </button>
                      </div>
                      <TableBoard
                        tables={tables || []}
                        selectedTableId={selectedTableId}
                        onSelectTable={(tableId) => {
                          onSelectTable(tableId);
                          setShowTableBoard(false);
                        }}
                        loading={tablesLoading}
                        guestCount={form.guests}
                        isAuthenticated={isAuthenticated}
                        onNavigateLogin={() => navigate('/login')}
                        onNavigateRegister={() => navigate('/register')}
                      />
                    </div>
                  </div>,
                  document.body
                )}
              </div>
            )}
          </div>
        </>
      )}

      {form.guests !== '' && form.guests <= 10 && (
        <div className="rd-field" ref={registerRef('duration')} style={{ marginTop: '1rem' }}>
          <label>DURATION</label>
          <CustomSelect
            value={form.duration}
            onChange={handleDurationChange}
            options={[
              { value: 15, label: "15 Mins" },
              { value: 30, label: "30 Mins" },
              { value: 45, label: "45 Mins" },
              { value: 60, label: "60 Mins" }
            ]}
            className={errors.duration ? 'rd-select--error' : ''}
          />
          {errors.duration && <p className="rd-error-message">{errors.duration}</p>}
          <BookingAlerts duration={form.duration} />
        </div>
      )}

      <div className="rd-field" ref={registerRef('diningPurpose')}>
        <label>DINING PURPOSE</label>
        <CustomSelect
          value={form.diningPurpose}
          onChange={(val) => updateField('diningPurpose', val)}
          options={[
            'Casual Dinner',
            'Casual Date',
            'Date Night',
            'Birthday',
            'Anniversary',
            'Business Meeting',
            'Family Gathering',
            'Special Occasion',
            'Other'
          ]}
        />
        {form.diningPurpose === 'Other' && (
          <input
            type="text"
            style={{ marginTop: '10px' }}
            placeholder="Please specify..."
            value={form.diningPurposeNote}
            onChange={(e) => updateField('diningPurposeNote', e.target.value)}
          />
        )}
      </div>

      <h3 className="rd-section-title">Your information</h3>

      <div className="rd-field" ref={registerRef('fullName')}>
        <label>FULL NAME</label>
        <input
          type="text"
          placeholder="Your Full Name"
          value={form.fullName}
          onChange={(e) => updateField('fullName', e.target.value)}
          className={errors.fullName ? 'rd-input--error' : ''}
        />
        {errors.fullName && <p className="rd-error-message">{errors.fullName}</p>}
      </div>

      <div className="rd-row-2">
        <div className="rd-field" ref={registerRef('email')}>
          <label>EMAIL</label>
          <input
            type="email"
            placeholder="Your Email"
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
            className={errors.email ? 'rd-input--error' : ''}
          />
          {errors.email && <p className="rd-error-message">{errors.email}</p>}
        </div>
        <div className="rd-field" ref={registerRef('phone')}>
          <label>PHONE</label>
          <input
            type="tel"
            placeholder="Your Phone Number"
            value={form.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            className={errors.phone ? 'rd-input--error' : ''}
          />
          {errors.phone && <p className="rd-error-message">{errors.phone}</p>}
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: "16px", padding: "12px", borderRadius: "8px", background: "#fef2f2", border: "1px solid #fee2e2", color: "#b91c1c", fontSize: "14px", fontWeight: "500", textAlign: "center" }}>
          {error}
        </div>
      )}

      <button
        type="button"
        className="rd-btn-primary"
        onClick={handleConfirmSummary}
        disabled={isTransitioning}
        aria-busy={isTransitioning}
      >
        {isTransitioning ? "Loading…" : "Continue to summary"}
      </button>
    </div>
  );
}
