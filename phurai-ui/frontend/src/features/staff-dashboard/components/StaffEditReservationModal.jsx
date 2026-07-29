import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { editStaffReservation } from '../services/staffApi';

export default function StaffEditReservationModal({ reservation, userId, onClose, onSuccess, allReservations }) {
  const [form, setForm] = useState({
    date: reservation.reservation_date || '',
    startTime: reservation.start_time || '',
    endTime: reservation.end_time || '', 
    guests: reservation.guest_count || 1,
    contact_name: reservation.customer_name || '',
    contact_phone: reservation.customer_phone || reservation.phone || '',
    contact_email: reservation.customer_email || reservation.email || '',
    table_id: reservation.table_id || '',
    special_request: reservation.special_request || reservation.notes || '',
    occasion: reservation.occasion || 'Casual Dinner',
    reservation_status: reservation.reservation_status || 'Confirmed'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Initial end time calculation if not present
  if (!form.endTime && reservation.reservation_end_at) {
    const endObj = new Date(reservation.reservation_end_at);
    form.endTime = `${String(endObj.getHours()).padStart(2, '0')}:${String(endObj.getMinutes()).padStart(2, '0')}`;
  }

  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleUpdate = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const checkOverlap = () => {
    // If table_id is null, there is no table assigned, so no overlap check for the table
    if (!reservation.table_id) return false;

    // We only care about reservations on the same table that are active
    const activeStatuses = ['await check-in', 'confirmed', 'reserved', 'check-in', 'occupied'];
    const sameTableRes = allReservations.filter(r =>
      r.table_id === reservation.table_id &&
      r.reservation_id !== reservation.reservation_id &&
      activeStatuses.includes((r.status || r.reservation_status || '').toLowerCase()) &&
      r.reservation_date === form.date
    );

    // Convert string times to minutes for easy comparison
    const newStartMins = parseInt(form.startTime.split(':')[0]) * 60 + parseInt(form.startTime.split(':')[1]);
    const newEndMins = parseInt(form.endTime.split(':')[0]) * 60 + parseInt(form.endTime.split(':')[1]);

    for (const r of sameTableRes) {
      if (!r.start_time) continue;
      const rStartMins = parseInt(r.start_time.split(':')[0]) * 60 + parseInt(r.start_time.split(':')[1]);

      let rEndMins = rStartMins + 60; // Default 1 hour if we don't have end time
      if (r.reservation_end_at) {
        const endObj = new Date(r.reservation_end_at);
        rEndMins = endObj.getHours() * 60 + endObj.getMinutes();
      }

      // Check overlap: (StartA < EndB) and (EndA > StartB)
      if (newStartMins < rEndMins && newEndMins > rStartMins) {
        return true;
      }
    }
    return false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.date || !form.startTime || !form.endTime || !form.guests) {
      setError('Please fill in all information.');
      return;
    }

    if (form.date < getTodayString()) {
      setError('Cannot book a reservation in the past.');
      return;
    }

    const startMins = parseInt(form.startTime.split(':')[0]) * 60 + parseInt(form.startTime.split(':')[1]);
    const endMins = parseInt(form.endTime.split(':')[0]) * 60 + parseInt(form.endTime.split(':')[1]);

    if (startMins < 600) {
      setError('Restaurant opens from 10:00 AM.');
      return;
    }
    if (endMins > 1440 || (endMins === 0 && form.endTime !== '00:00')) {
      setError('End time cannot exceed closing time (00:00).');
      return;
    }
    if (startMins >= endMins && endMins !== 0) { // 0 can be midnight
      setError('End time must be after start time.');
      return;
    }

    if (checkOverlap()) {
      setError('This slot overlaps with another reservation');
      return;
    }

    const payload = {
      contact_name: form.contact_name,
      contact_phone: form.contact_phone,
      contact_email: form.contact_email,
      guest_count: parseInt(form.guests, 10),
      special_request: form.special_request || null,
      occasion: form.occasion || null,
      reservation_status: form.reservation_status,
      reservation_start_at: `${form.date}T${form.startTime}:00`,
      reservation_end_at: `${form.date}T${form.endTime}:00`,
      table_id: form.table_id ? parseInt(form.table_id, 10) : null
    };

    try {
      setLoading(true);
      await fetch(`/api/staff/reservations/${reservation.reservation_id || reservation.id}/full-edit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(r => r.json()).then(data => {
        if (!data.success) throw new Error(data.message);
      });
      onSuccess();
    } catch (err) {
      setError(err.message || 'System error during update.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="staff-table-modal fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center" style={{ zIndex: 9999 }}>
      <button type="button" className="staff-table-modal__backdrop fixed inset-0 w-screen h-screen bg-black/50" onClick={onClose} />
      <div className="staff-table-modal__panel relative z-[101]" style={{ padding: '24px', maxWidth: '400px' }}>
        <header className="staff-table-modal__head" style={{ marginBottom: '20px' }}>
          <div>
            <h2 className="staff-table-modal__title">Edit Reservation</h2>
            <p className="staff-table-modal__eyebrow">#{String(reservation.reservation_id).padStart(6, '0')} - {reservation.customer_name}</p>
          </div>
          <button type="button" className="staff-table-modal__close" onClick={onClose}>✕</button>
        </header>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Customer Name</label>
              <input
                type="text"
                value={form.contact_name}
                onChange={e => handleUpdate('contact_name', e.target.value)}
                style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Phone Number</label>
              <input
                type="text"
                value={form.contact_phone}
                onChange={e => handleUpdate('contact_phone', e.target.value)}
                style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Email</label>
              <input
                type="email"
                value={form.contact_email}
                onChange={e => handleUpdate('contact_email', e.target.value)}
                style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Date</label>
              <input
                type="date"
                value={form.date}
                min={getTodayString()}
                onChange={e => handleUpdate('date', e.target.value)}
                style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Start Time</label>
              <input
                type="time"
                min="10:00"
                max="23:30"
                value={form.startTime}
                onChange={e => handleUpdate('startTime', e.target.value)}
                style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Guests</label>
              <input
                type="number"
                min="1"
                value={form.guests}
                onChange={e => handleUpdate('guests', e.target.value)}
                style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Table No.</label>
              <input
                type="number"
                value={form.table_id}
                onChange={e => handleUpdate('table_id', e.target.value)}
                placeholder="Empty"
                style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Status</label>
              <select
                value={form.reservation_status}
                onChange={e => handleUpdate('reservation_status', e.target.value)}
                style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              >
                <option value="Confirmed">Confirmed</option>
                <option value="Check-in">Check-in</option>
                <option value="Occupied">Occupied</option>
                <option value="Cancelled">Cancelled</option>
                <option value="No Show">No Show</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Special Request</label>
            <textarea
              value={form.special_request}
              onChange={e => handleUpdate('special_request', e.target.value)}
              rows="2"
              style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>

          {error && <p style={{ color: '#ef4444', fontSize: '13px', margin: 0, fontWeight: 'bold' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button
              type="submit"
              disabled={loading || !!error}
              style={{
                flex: 1, padding: '10px', backgroundColor: '#3b82f6', color: '#fff',
                border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: loading || !!error ? 'not-allowed' : 'pointer',
                opacity: loading || !!error ? 0.5 : 1
              }}
            >
              {loading ? 'Updating...' : 'Confirm (Override)'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                flex: 1, padding: '10px', backgroundColor: '#e5e7eb', color: '#374151',
                border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
