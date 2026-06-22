import '../styles/ReservationPayment.css';

export default function PaymentFailed({ onRetry, onEditDetails }) {
  const params = new URLSearchParams(window.location.search);
  const isVerifying = params.get('reason') === 'verifying';

  return (
    <div className="rp-card rp-card-center">
      <i className="rp-failed-icon" aria-hidden="true">✕</i>
      <h2 className="rp-title rp-title-center">Payment failed</h2>
      <p className="rp-subtitle rp-subtitle-center">
        {isVerifying
          ? 'We could not verify your payment in time. Please try again.'
          : 'Your table has not been reserved. No deposit was charged.'}
      </p>

      <button className="rp-btn rp-btn-primary" onClick={onRetry}>Try payment again</button>
      <button className="rp-btn" onClick={onEditDetails}>Edit reservation details</button>
    </div>
  );
}
