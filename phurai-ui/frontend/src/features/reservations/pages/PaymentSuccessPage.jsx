import { useLocation, useNavigate } from 'react-router-dom';
import '../styles/ReservationPayment.css';

export default function PaymentSuccessPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const reservationId = location.state?.reservationId;

  if (!reservationId) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 1rem', background: '#f9f9f9', minHeight: '60vh' }}>
        <div className="rp-card">
          <h2 className="rp-title rp-title-center">Reservation confirmed</h2>
          <p className="rp-subtitle rp-subtitle-center">A receipt has been sent to your email.</p>
          <button className="rp-btn rp-btn-primary" onClick={() => navigate("/")}>Go to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 1rem', background: '#f9f9f9', minHeight: '60vh' }}>
      <div className="rp-card">
        <div className="rp-success-icon">
          <svg width="56" height="56" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="24" fill="none" stroke="#3B6D11" strokeWidth="2.5" />
            <path d="M17 29 L24 36 L39 19" fill="none" stroke="#3B6D11" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="rp-title rp-title-center">Reservation confirmed</h2>
        <p className="rp-subtitle rp-subtitle-center">A receipt has been sent to your email</p>

        <div className="rp-receipt">
          <table>
            <tbody>
              <tr><td className="rp-receipt-label">Reservation</td><td className="rp-receipt-value">#{reservationId}</td></tr>
              <tr><td className="rp-receipt-label">Deposit paid</td><td className="rp-receipt-value">200,000 VND via VNPAY</td></tr>
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: '24px' }}>
          <button className="rp-btn rp-btn-primary" onClick={() => navigate("/my-reservations")}>View My Reservations</button>
          <button className="rp-btn" onClick={() => navigate("/")}>Go to Home</button>
        </div>
      </div>
    </div>
  );
}
