import '../styles/ReservationPayment.css';

export default function PaymentSuccess({ reservation }) {
  if (!reservation) {
    return (
      <div className="rp-card">
        <h2 className="rp-title rp-title-center">Reservation confirmed</h2>
        <p className="rp-subtitle rp-subtitle-center">A receipt has been sent to your email.</p>
      </div>
    );
  }

  return (
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
            <tr><td className="rp-receipt-label">Reservation</td><td className="rp-receipt-value">#{reservation.reservation_id}</td></tr>
            <tr><td className="rp-receipt-label">Table</td><td className="rp-receipt-value">{reservation.table || 'Assigned by staff'}</td></tr>
            <tr><td className="rp-receipt-label">Date &amp; time</td><td className="rp-receipt-value">{reservation.date}, {reservation.time}</td></tr>
            <tr><td className="rp-receipt-label">Guests</td><td className="rp-receipt-value">{reservation.guests}</td></tr>
            <tr><td className="rp-receipt-label">Deposit paid</td><td className="rp-receipt-value">{(reservation.depositAmount || 200000).toLocaleString('vi-VN')} VND via VNPAY</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
