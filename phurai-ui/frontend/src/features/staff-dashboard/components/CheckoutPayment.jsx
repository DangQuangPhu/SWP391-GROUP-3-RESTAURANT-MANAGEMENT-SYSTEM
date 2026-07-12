import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, CheckCircle2 } from 'lucide-react';
import '../styles/CheckoutPayment.css';

const TOTAL_SECONDS = 15 * 60;
const PaymentContext = createContext(null);

export default function CheckoutPayment({ orderId, amount, onPollStatus, onSuccess }) {
  const [phase, setPhase] = useState('pending'); // 'pending' | 'success' | 'expired'
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_SECONDS);
  const transferContent = `PHURAI ${orderId}`; // Dynamic transfer content

  // Timer logic
  useEffect(() => {
    if (phase !== 'pending') return;
    if (secondsLeft <= 0) {
      setPhase('expired');
      return;
    }
    const id = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [phase, secondsLeft]);

  // Polling logic
  useEffect(() => {
    if (phase !== 'pending') return;
    const pollId = setInterval(async () => {
      try {
        const { status, paymentStatus, order_status } = await onPollStatus(orderId);
        // Depending on what your API returns, usually order_status === 'Paid'
        if (status === 'Paid' || paymentStatus === 'Paid' || order_status === 'Paid') {
          clearInterval(pollId);
          setPhase('success');
          if (onSuccess) onSuccess();
        }
      } catch (err) {
        console.error('poll status failed', err);
      }
    }, 3000);
    return () => clearInterval(pollId);
  }, [phase, orderId, onPollStatus, onSuccess]);

  const value = {
    state: { phase, secondsLeft, amount, transferContent, orderId },
    actions: { setPhase, setSecondsLeft }
  };

  return (
    <PaymentContext.Provider value={value}>
      <Payment.Frame>
        <AnimatePresence mode="wait">
          {phase === 'success' ? (
            <Payment.SuccessScreen key="success" />
          ) : phase === 'expired' ? (
            <Payment.ExpiredScreen key="expired" />
          ) : (
            <motion.div
              key="payment"
              className="payment-two-column"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <Payment.LeftColumn />
              <Payment.RightColumn />
            </motion.div>
          )}
        </AnimatePresence>
      </Payment.Frame>
    </PaymentContext.Provider>
  );
}

const Payment = {
  Frame: function PaymentFrame({ children }) {
    return <div className="checkout-card">{children}</div>;
  },

  LeftColumn: function PaymentLeftColumn() {
    const { state } = useContext(PaymentContext);
    const amountStr = state.amount;
    const qrUrl = `https://qr.sepay.vn/img?bank=TPBank&acc=00003942326&template=&showinfo=true&holder=DANG%20QUANG%20PHU&store=PHURAI%20RESTAURANT&amount=${amountStr}&des=${encodeURIComponent(state.transferContent)}`;

    return (
      <div className="payment-col payment-left">
        <div className="qr-container">
          <img src={qrUrl} alt="QR Code for Payment" className="qr-image" />
        </div>
        <p className="qr-hint">Scan with any banking app to pay</p>
      </div>
    );
  },

  RightColumn: function PaymentRightColumn() {
    const { state } = useContext(PaymentContext);
    const minutes = String(Math.floor(state.secondsLeft / 60)).padStart(2, '0');
    const seconds = String(state.secondsLeft % 60).padStart(2, '0');

    return (
      <div className="payment-col payment-right">
        <div className="timer-box">
          <span className="timer-label">Code expires in:</span>
          <span className="timer-text">{minutes}:{seconds}</span>
        </div>

        <div className="bank-info-card">
          <p className="owner-name">DANG QUANG PHU</p>

          <div className="info-row">
            <div className="info-text">
              <span className="info-label">Card Number</span>
              <span className="info-val">4665 84010307 9736</span>
            </div>
            {/* No copy button for card number by default as per UI instructions only 3 copy buttons */}
          </div>

          <CopyableRow label="Account Number" value="00003942326" />
          <CopyableRow label="Amount" value={state.amount.toLocaleString('vi-VN') + ' ₫'} copyValue={String(state.amount)} />
          <CopyableRow label="Transfer Content" value={state.transferContent} />
        </div>
      </div>
    );
  },

  SuccessScreen: function PaymentSuccessScreen() {
    return (
      <motion.div
        className="payment-state-screen success-screen"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <CheckCircle2 size={80} color="#10B981" className="success-icon" />
        <h2 className="success-title">Payment Successful</h2>
        <p className="success-subtitle">The payment has been verified. The table will be cleaned.</p>
      </motion.div>
    );
  },

  ExpiredScreen: function PaymentExpiredScreen() {
    const { actions } = useContext(PaymentContext);

    return (
      <motion.div
        className="payment-state-screen expired-screen"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <h2 className="expired-title">Payment Expired</h2>
        <p className="expired-subtitle">This QR code is no longer valid.</p>
        <button
          className="checkout-btn checkout-btn-primary"
          onClick={() => {
            actions.setSecondsLeft(TOTAL_SECONDS);
            actions.setPhase('pending');
          }}
        >
          Generate New Code
        </button>
      </motion.div>
    );
  }
};

function CopyableRow({ label, value, copyValue }) {
  const [copied, setCopied] = useState(false);
  const textToCopy = copyValue || value;

  const handleCopy = () => {
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="info-row">
      <div className="info-text">
        <span className="info-label">{label}</span>
        <span className="info-val">{value}</span>
      </div>
      <button className="copy-btn" onClick={handleCopy} title="Copy to clipboard" aria-label="Copy">
        {copied ? <CheckCircle2 size={18} color="#10B981" /> : <Copy size={18} color="#6B7280" />}
      </button>
    </div>
  );
}
