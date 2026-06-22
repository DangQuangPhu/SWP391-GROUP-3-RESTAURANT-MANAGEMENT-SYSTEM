import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import TableBoard from './choose-table/TableBoard.jsx';
import '../styles/ReservationDetails.css';

const STEPS = ['Details', 'Summary', 'Payment', 'Confirmed'];

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
  onUpdateForm
}) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    date: initialForm?.date || '',
    startTime: initialForm?.startTime || '',
    diningArea: initialForm?.diningArea || 'Standard dining (choose a table)',
    selectedTable: initialForm?.selectedTable || null,
    guests: initialForm?.guests || 2,
    duration: initialForm?.duration || '30 minutes',
    endTime: initialForm?.endTime || '',
    diningPurpose: initialForm?.diningPurpose || 'Casual Dinner',
    diningPurposeNote: initialForm?.diningPurposeNote || '',
    fullName: initialForm?.fullName || '',
    email: initialForm?.email || '',
    phone: initialForm?.phone || '',
  });

  const [isCustomEndTime, setIsCustomEndTime] = useState(false);
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

  const endTimeOptions = useMemo(() => {
    if (!form.startTime) return [];
    const options = [];
    const [hh, mm] = form.startTime.split(':').map(Number);
    const startMins = hh * 60 + mm;
    // Min end time is start time + 45 mins
    const minEndMins = startMins + 45;
    
    // Max end time is 23:30 (1410 mins)
    for (let m = minEndMins; m <= 23 * 60 + 30; m += 15) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      const val = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      options.push({ value: val, label: val });
    }
    return options;
  }, [form.startTime]);

  useEffect(() => {
    if (form.endTime && endTimeOptions.length > 0) {
      const isValid = endTimeOptions.some(opt => opt.value === form.endTime);
      if (!isValid) {
        updateField('endTime', '');
      }
    }
  }, [endTimeOptions, form.endTime]);

  // Handle today validation
  const todayStr = new Date().toISOString().split('T')[0];
  const isToday = form.date === todayStr;
  const now = new Date();
  const currentHH = now.getHours();
  const currentMM = now.getMinutes();

  const timeOptions = [
    { value: '18:00', label: '18:00' },
    { value: '18:30', label: '18:30' },
    { value: '19:00', label: '19:00' },
    { value: '19:30', label: '19:30' },
    { value: '20:00', label: '20:00' },
    { value: '20:30', label: '20:30' },
    { value: '21:00', label: '21:00' },
    { value: '21:30', label: '21:30' }
  ].filter(opt => {
    if (!isToday) return true;
    const [hh, mm] = opt.value.split(':').map(Number);
    return hh > currentHH || (hh === currentHH && mm > currentMM);
  });

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
    setForm(prev => {
      const newVal = Math.max(1, prev.guests + delta);
      if (onUpdateForm) onUpdateForm('guests', newVal);
      return { ...prev, guests: newVal };
    });
    scrollFieldIntoView('guests');
  };

  const missingFields = [];
  if (!form.date) missingFields.push('date');
  if (form.guests <= 10 && !form.startTime) missingFields.push('time');
  if (form.guests <= 10 && !form.endTime) missingFields.push('end time');
  if (form.guests < 1) missingFields.push('guests');
  if (form.guests > 10) missingFields.push('guest limit exceeded');
  if (!form.fullName.trim()) missingFields.push('full name');
  if (!form.email.trim()) missingFields.push('email');
  if (!form.phone.trim()) missingFields.push('phone');

  return (
    <div className="rd-card">
      <h2 className="rd-card-title">Reservation details</h2>
      <p className="rd-card-subtitle">Select when you would like to dine and the atmosphere you prefer.</p>

      <div className="rd-row-2">
        <div className="rd-field" ref={registerRef('date')}>
          <label>DATE</label>
          <input
            type="date"
            min={todayStr}
            value={form.date}
            onChange={(e) => updateField('date', e.target.value)}
            onFocus={handleFocusScroll('date')}
          />
        </div>
        <div className="rd-field" ref={registerRef('startTime')}>
          <label>START TIME</label>
          {form.guests > 10 ? (
            <input type="text" readOnly value="Not available for large groups" className="rd-disabled-input" />
          ) : (
            <select
              value={form.startTime}
              onChange={(e) => updateField('startTime', e.target.value)}
              onFocus={handleFocusScroll('startTime')}
            >
              <option value="">Select time</option>
              {timeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {form.guests <= 10 ? (
        <>
          <div className="rd-field" ref={registerRef('diningArea')}>
            <label>DINING AREA</label>
            <select
              value={form.diningArea}
              onChange={(e) => updateField('diningArea', e.target.value)}
              onFocus={handleFocusScroll('diningArea')}
            >
              <option>Standard dining (choose a table)</option>
              <option>Kitchen View (counter seats)</option>
            </select>
          </div>

          <div style={{ marginTop: "1rem", marginBottom: "1rem" }} ref={registerRef('chooseTable')}>
            {!selectedTableId ? (
              <>
                <button
                  className="rd-btn-outline"
                  onClick={() => setShowTableBoard(true)}
                >
                  CHOOSE AND VIEW TABLE
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
              </>
            ) : (
              <div style={{ padding: "1rem", border: "1px solid #ddd", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p className="rd-selected-table" style={{ margin: 0, fontWeight: 500, fontSize: "0.9rem" }}>
                  Selected table: {tables?.find((t) => t.table_id === selectedTableId)?.display_label || selectedTableId}
                </p>
                <button
                  type="button"
                  style={{ background: 'transparent', border: 'none', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.85rem' }}
                  onClick={() => setShowTableBoard(true)}
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
      ) : (
        <div style={{ padding: "1rem", background: "#fff3cd", color: "#856404", border: "1px solid #ffeeba", borderRadius: "8px", marginBottom: "1.5rem" }}>
          <strong>Lưu ý: </strong>Với nhóm khách trên 10 người, vui lòng liên hệ Hotline hoặc chuyển sang trang Private Events để nhà hàng chuẩn bị không gian tốt nhất.
        </div>
      )}

      <div className="rd-row-3" ref={registerRef('guests')}>
        <div className="rd-field">
          <label>GUESTS</label>
          <div className="rd-guest-stepper">
            <button onClick={() => adjustGuests(-1)} aria-label="Decrease guests">-</button>
            <input type="text" value={form.guests} readOnly />
            <button onClick={() => adjustGuests(1)} aria-label="Increase guests">+</button>
          </div>
        </div>
        <div className="rd-field">
          <label>DURATION (GRACE PERIOD)</label>
          <select
            value={form.duration}
            onChange={(e) => updateField('duration', e.target.value)}
            onFocus={handleFocusScroll('duration')}
          >
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">1 hour</option>
       
          </select>
        </div>
        <div className="rd-field">
          <label>END TIME</label>
          <select
            value={form.endTime}
            onChange={(e) => updateField('endTime', e.target.value)}
            onFocus={handleFocusScroll('endTime')}
            disabled={!form.startTime}
          >
            <option value="">{form.startTime ? 'Select end time' : 'Select start time first'}</option>
            {endTimeOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="rd-helper-text">
        How long we hold the table if you are late, and when you plan to leave.
      </p>

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
          placeholder="Dang Quang Phu"
          value={form.fullName}
          onChange={(e) => updateField('fullName', e.target.value)}
          onFocus={handleFocusScroll('fullName')}
        />
      </div>

      <div className="rd-row-2">
        <div className="rd-field" ref={registerRef('email')}>
          <label>EMAIL</label>
          <input
            type="email"
            placeholder="quagphu159@gmail.com"
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
            onFocus={handleFocusScroll('email')}
          />
        </div>
        <div className="rd-field" ref={registerRef('phone')}>
          <label>PHONE</label>
          <input
            type="tel"
            placeholder="0964183966"
            value={form.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            onFocus={handleFocusScroll('phone')}
          />
        </div>
      </div>

      {missingFields.length > 0 && (
        <p className="rd-missing-text">Please add: {missingFields.join(', ')}.</p>
      )}

      <button
        type="button"
        className="rd-btn-primary"
        disabled={missingFields.length > 0}
        onClick={(e) => {
          e.preventDefault();
          if (onContinue) onContinue(form);
        }}
      >
        Continue to summary
      </button>
    </div>
  );
}
