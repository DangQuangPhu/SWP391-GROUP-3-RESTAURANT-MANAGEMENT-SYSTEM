import { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createReservationVnpayUrl } from "../services/reservationApi.js";
import '../styles/ReservationPayment.css';

const DEPOSIT_AMOUNT = 200000;

export default function PaymentProcessPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState('idle'); 
  const [errorMsg, setErrorMsg] = useState('');
  
  const reservationId = location.state?.reservationId;

  const handlePay = useCallback(async () => {
    if (!reservationId) {
      setErrorMsg('Missing reservation info. Please restart your reservation.');
      setStatus('error');
      return;
    }
    setStatus('redirecting');
    setErrorMsg('');
    try {
      const res = await createReservationVnpayUrl(reservationId, DEPOSIT_AMOUNT);
      if (res.paymentUrl) {
        sessionStorage.setItem('pending_reservation_id', String(reservationId));
        window.location.href = res.paymentUrl;
      } else {
        throw new Error("Failed to generate payment URL.");
      }
    } catch (err) {
      console.error('create_vnpay_url failed', err);
      setStatus('error');
      setErrorMsg('Không thể kết nối tới VNPAY, vui lòng thử lại.');
    }
  }, [reservationId]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 1rem', background: '#f9f9f9', minHeight: '60vh' }}>
      <div className="rp-card">
        <p className="rp-eyebrow">Secure your table</p>
        <h2 className="rp-title">Pay deposit via VNPAY</h2>

        <div className="rp-amount-block">
          <span className="rp-amount">{DEPOSIT_AMOUNT.toLocaleString('vi-VN')} đ</span>
          <span className="rp-amount-label">Deposit to hold your table</span>
        </div>

        {status === 'error' && <p className="rp-error-text">{errorMsg}</p>}

        <button className="rp-btn rp-btn-primary" onClick={handlePay} disabled={status === 'redirecting'}>
          {status === 'redirecting' ? 'Redirecting to VNPAY…' : 'Pay deposit via VNPAY'}
        </button>
        <button className="rp-btn" onClick={() => navigate("/reservations")} disabled={status === 'redirecting'}>
          Cancel
        </button>
      </div>
    </div>
  );
}
