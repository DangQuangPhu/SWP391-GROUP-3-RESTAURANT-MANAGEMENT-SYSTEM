import { useState, useRef, useCallback, useEffect } from 'react';
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

export default function ReservationDetails({
  onContinue,
  onGoHome,
  initialForm,
  tables,
  selectedTableId,
  onSelectTable,
  tablesLoading,
  membershipTier,
  isAuthenticated,
  onUpdateForm,
  tableHoldMin = 15
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
    endTime: (!isStaleEndTime && initialForm?.endTime) || (initialForm?.startTime ? addMinutesToTime(initialForm.startTime, 90 + initialDuration) : ''),
    diningPurpose: initialForm?.diningPurpose || 'Casual Dinner',
    diningPurposeNote: initialForm?.diningPurposeNote || '',
    fullName: initialForm?.fullName || '',
    email: initialForm?.email || '',
    phone: initialForm?.phone || '',
  });

  const [isCustomEndTime, setIsCustomEndTime] = useState(false);
  const [showTableBoard, setShowTableBoard] = useState(false);
  const [errors, setErrors] = useState({});

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

  const getEndTimeOptions = (startStr) => {
    if (!startStr) return [];
    const options = [];
    const [sH, sM] = startStr.split(':').map(Number);
    let currentMins = sH * 60 + sM + 90 + Number(form.duration); // Minimum 90m dining + hold duration
    const maxMins = 23 * 60 + 45; // limit options up to 23:45
    while (currentMins <= maxMins) {
      const h = Math.floor(currentMins / 60);
      const m = currentMins % 60;
      options.push(`${String(h % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      currentMins += 15;
    }
    return options;
  };

  const handleStartTimeChange = (newStartTime) => {
    const newEndTime = addMinutesToTime(newStartTime, 90 + Number(form.duration));
    setForm(prev => ({ ...prev, startTime: newStartTime, endTime: newEndTime }));
    if (onUpdateForm) {
      onUpdateForm('startTime', newStartTime);
      onUpdateForm('endTime', newEndTime);
    }
  };

  const handleEndTimeChange = (newEndTime) => {
    setForm(prev => ({ ...prev, endTime: newEndTime }));
    if (onUpdateForm) {
      onUpdateForm('endTime', newEndTime);
    }
  };

  const handleDurationChange = (newDurationStr) => {
    const newDuration = Number(newDurationStr);
    const newEndTime = addMinutesToTime(form.startTime, 90 + newDuration);
    setForm(prev => ({ ...prev, duration: newDuration, endTime: newEndTime }));
    if (onUpdateForm) {
      onUpdateForm('duration', newDuration);
      onUpdateForm('endTime', newEndTime);
    }
  };

  const isCase3Invalid = (() => {
    if (!form.startTime) return false;
    const [hh, mm] = form.startTime.split(':').map(Number);
    if ((hh * 60 + mm + 90 + Number(form.duration)) > 1440) return true; // Breaches 00:00 midnight
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

  const handleFocusScroll = (name) => () => scrollFieldIntoView(name);

  const adjustGuests = (delta) => {
    // Compute new value first (read from current form ref, not inside setForm updater)
    const current = Number(form.guests) || 0;
    const newVal = Math.max(1, current + delta);
    // Update local state and notify parent separately — never call parent setState
    // inside a setForm updater (that runs during render phase and causes React errors)
    setForm(prev => ({ ...prev, guests: newVal }));
    if (onUpdateForm) onUpdateForm('guests', newVal);
    scrollFieldIntoView('guests');
  };

  const handleConfirmSummary = (e) => {
    e.preventDefault();
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
      }
    }

    // Validate End Time / Duration
    if (!form.duration) {
      newErrors.duration = "Please select a hold duration.";
    }

    if (form.endTime) {
      const [eh, em] = form.endTime.split(':').map(Number);
      let endMin = (eh === 0 && em === 0) ? 1440 : (eh * 60 + em);
      if (eh === 0 && em > 0) endMin = 1440 + em;
      if (endMin > 1440) {
        newErrors.endTime = "End time cannot exceed closing time (00:00).";
      }
    }

    if (form.startTime && form.endTime && form.duration) {
      const [sh, sm] = form.startTime.split(':').map(Number);
      const [eh, em] = form.endTime.split(':').map(Number);
      const startMins = sh * 60 + sm;
      let endMins = (eh === 0 && em === 0) ? 1440 : (eh * 60 + em);
      if (eh === 0 && em > 0) endMins = 1440 + em;

      const minEndMins = startMins + 90 + Number(form.duration);
      if (endMins < minEndMins) {
        newErrors.endTime = `Minimum end time is ${addMinutesToTime(form.startTime, 90 + Number(form.duration))}.`;
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

    if (form.email && form.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email.trim())) {
        newErrors.email = "Invalid email address.";
      }
    }

    if (isCase3Invalid) {
      newErrors.startTime = "Booking start time plus hold duration exceeds midnight.";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0 && !isCase3Invalid) {
      const payload = {
        ...form,
        selectedTable: selectedTableId
      };

      if (onContinue) onContinue(payload);
    } else {
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
          <input
            type="date"
            min={getTodayString()}
            max={getMaxDateString()}
            value={form.date}
            onChange={(e) => updateField('date', e.target.value)}
            onFocus={handleFocusScroll('date')}
            className={errors.date ? 'border-red-500 border-2' : ''}
          />
          {errors.date && <p className="text-red-500 text-sm mt-1">{errors.date}</p>}
        </div>
      </div>

      <div className="rd-row-2">
        <div className="rd-field" ref={registerRef('startTime')} style={{ marginTop: '1.5rem' }}>
          <label>START TIME</label>
          {form.guests > 10 ? (
            <input type="text" readOnly value="Not available for large groups" className="rd-disabled-input" />
          ) : (
            <>
              <input
                type="time"
                min="10:00"
                max="22:00"
                value={form.startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                onFocus={handleFocusScroll('startTime')}
                className={`w-full px-4 py-2 mt-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 ${errors.startTime ? 'border-red-500 border-2' : 'border-gray-300'}`}
              />
              {errors.startTime && <p className="text-red-500 text-sm mt-1">{errors.startTime}</p>}
            </>
          )}
        </div>
        <div className="rd-field" ref={registerRef('endTime')} style={{ marginTop: '1.5rem' }}>
          <label>END TIME</label>
          {form.guests > 10 ? (
            <input type="text" readOnly value="Not available" className="rd-disabled-input" />
          ) : (
            <>
              <input
                type="time"
                min={form.startTime ? addMinutesToTime(form.startTime, 90 + Number(form.duration)) : '10:00'}
                max="23:45"
                value={form.endTime}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                onFocus={handleFocusScroll('endTime')}
                disabled={!form.startTime}
                className={`w-full px-4 py-2 mt-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 ${errors.endTime ? 'border-red-500 border-2' : 'border-gray-300'} ${!form.startTime ? 'bg-gray-100 cursor-not-allowed' : ''}`}
              />
              {errors.endTime && <p className="text-red-500 text-sm mt-1">{errors.endTime}</p>}
            </>
          )}
        </div>
      </div>

      <div className="rd-row-3" ref={registerRef('guests')} style={{ marginTop: '1.5rem' }}>
        <div className="rd-field">
          <label>GUESTS</label>
          <div className={`rd-guest-stepper ${errors.guests ? 'border-red-500 border-2' : ''}`}>
            <button type="button" onClick={() => adjustGuests(-1)} aria-label="Decrease guests">-</button>
            <input type="text" value={form.guests} readOnly />
            <button type="button" onClick={() => adjustGuests(1)} aria-label="Increase guests">+</button>
          </div>
          {errors.guests && <p className="text-red-500 text-sm mt-1">{errors.guests}</p>}
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
                  className={`rd-btn-outline ${(!form.guests || form.guests < 1 || form.guests > 10) ? 'opacity-50 cursor-not-allowed' : ''} ${errors.selectedTable ? 'border-red-500 border-2 text-red-500' : ''}`}
                  onClick={() => form.guests && form.guests >= 1 && form.guests <= 10 && setShowTableBoard(true)}
                  disabled={!form.guests || form.guests < 1 || form.guests > 10}
                >
                  CHOOSE AND VIEW TABLE
                </button>
                {errors.selectedTable && <p className="text-red-500 text-sm mt-1">{errors.selectedTable}</p>}
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
                        membershipTier={membershipTier}
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
                        membershipTier={membershipTier}
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
        <div className="rd-field" ref={registerRef('duration')} style={{ marginTop: '1.5rem' }}>
          <label>DURATION</label>
          <select
            value={form.duration}
            onChange={(e) => handleDurationChange(e.target.value)}
            onFocus={handleFocusScroll('duration')}
            className={`w-full px-4 py-2 mt-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 ${errors.duration ? 'border-red-500 border-2' : 'border-gray-300'}`}
          >
            <option value="15">15 Mins</option>
            <option value="30">30 Mins</option>
            <option value="45">45 Mins</option>
            <option value="60">60 Mins</option>
          </select>
          {errors.duration && <p className="text-red-500 text-sm mt-1">{errors.duration}</p>}
          <BookingAlerts duration={form.duration} />
        </div>
      )}

      <div className="rd-field" ref={registerRef('diningPurpose')}>
        <label>DINING PURPOSE</label>
        <select
          value={form.diningPurpose}
          onChange={(e) => updateField('diningPurpose', e.target.value)}
          onFocus={handleFocusScroll('diningPurpose')}
        >
          <option>Casual Dinner</option>
          <option>Casual Date</option>
          <option>Date Night</option>
          <option>Birthday</option>
          <option>Anniversary</option>
          <option>Business Meeting</option>
          <option>Family Gathering</option>
          <option>Special Occasion</option>
          <option>Other</option>
        </select>
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
          onFocus={handleFocusScroll('fullName')}
          className={errors.fullName ? 'border-red-500 border-2' : ''}
        />
        {errors.fullName && <p className="text-red-500 text-sm mt-1">{errors.fullName}</p>}
      </div>

      <div className="rd-row-2">
        <div className="rd-field" ref={registerRef('email')}>
          <label>EMAIL</label>
          <input
            type="email"
            placeholder="Your Email"
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
            onFocus={handleFocusScroll('email')}
            className={errors.email ? 'border-red-500 border-2' : ''}
          />
          {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
        </div>
        <div className="rd-field" ref={registerRef('phone')}>
          <label>PHONE</label>
          <input
            type="tel"
            placeholder="Your Phone Number"
            value={form.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            onFocus={handleFocusScroll('phone')}
            className={errors.phone ? 'border-red-500 border-2' : ''}
          />
          {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
        </div>
      </div>

      <button
        type="button"
        className="rd-btn-primary"
        onClick={handleConfirmSummary}
      >
        Continue to summary
      </button>
    </div>
  );
}
