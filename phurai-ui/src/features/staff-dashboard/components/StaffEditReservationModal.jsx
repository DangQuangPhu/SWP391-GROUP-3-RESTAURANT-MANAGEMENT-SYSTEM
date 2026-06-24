import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { editStaffReservation } from '../services/staffApi';

export default function StaffEditReservationModal({ reservation, userId, onClose, onSuccess, allReservations }) {
  const [form, setForm] = useState({
    date: reservation.reservation_date || '',
    startTime: reservation.start_time || '',
    endTime: reservation.end_time || '', // We need to extract this or calculate it
    guests: reservation.guest_count || 1,
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
      setError('Vui lòng điền đầy đủ thông tin.');
      return;
    }

    if (form.date < getTodayString()) {
      setError('Không thể đặt bàn vào ngày trong quá khứ.');
      return;
    }

    const startMins = parseInt(form.startTime.split(':')[0]) * 60 + parseInt(form.startTime.split(':')[1]);
    const endMins = parseInt(form.endTime.split(':')[0]) * 60 + parseInt(form.endTime.split(':')[1]);

    if (startMins < 600) {
      setError('Nhà hàng mở cửa từ 10:00 sáng.');
      return;
    }
    if (endMins > 1440 || (endMins === 0 && form.endTime !== '00:00')) {
      setError('Thời gian kết thúc không được vượt quá giờ đóng cửa (00:00).');
      return;
    }
    if (startMins >= endMins && endMins !== 0) { // 0 can be midnight
      setError('Giờ kết thúc phải sau giờ bắt đầu.');
      return;
    }

    if (checkOverlap()) {
      setError('Khung giờ này đã bị trùng với một lịch đặt khác');
      return;
    }

    setLoading(true);
    try {
      await editStaffReservation(reservation.reservation_id, userId, {
        date: form.date,
        start_time: form.startTime,
        end_time: form.endTime,
        guest_count: parseInt(form.guests, 10)
      });
      onSuccess();
    } catch (err) {
      setError(err.message || 'Lỗi hệ thống khi cập nhật.');
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
            <h2 className="staff-table-modal__title">Admin Override: Chỉnh sửa lịch</h2>
            <p className="staff-table-modal__eyebrow">#{String(reservation.reservation_id).padStart(6, '0')} - {reservation.customer_name}</p>
          </div>
          <button type="button" className="staff-table-modal__close" onClick={onClose}>✕</button>
        </header>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Ngày đặt</label>
            <input 
              type="date" 
              value={form.date} 
              min={getTodayString()}
              onChange={e => handleUpdate('date', e.target.value)}
              style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Giờ đến</label>
              <input 
                type="time" 
                min="10:00"
                max="23:30"
                value={form.startTime} 
                onChange={e => handleUpdate('startTime', e.target.value)}
                style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Giờ kết thúc</label>
              <input 
                type="time" 
                max="23:59"
                value={form.endTime} 
                onChange={e => handleUpdate('endTime', e.target.value)}
                style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Số lượng khách</label>
            <input 
              type="number" 
              min="1"
              value={form.guests} 
              onChange={e => handleUpdate('guests', e.target.value)}
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
              {loading ? 'Đang cập nhật...' : 'Xác nhận (Override)'}
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
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
