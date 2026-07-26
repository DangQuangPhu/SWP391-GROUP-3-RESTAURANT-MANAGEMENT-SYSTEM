import { useState, useEffect, useContext, createContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import '../styles/CheckoutPayment.css';

const TOTAL_SECONDS = 15 * 60; // 15 minutes limit
const PaymentContext = createContext(null);

function getOrInitTimerStart(orderId) {
  if (!orderId) return Date.now();
  const key = `phurai_qr_timer_${orderId}`;
  try {
    const existing = localStorage.getItem(key);
    if (existing) {
      const parsed = parseInt(existing, 10);
      if (!isNaN(parsed)) return parsed;
    }
    const now = Date.now();
    localStorage.setItem(key, String(now));
    return now;
  } catch {
    return Date.now();
  }
}

export default function CheckoutPayment({ orderId, amount, onPollStatus, onSuccess }) {
  const [phase, setPhase] = useState('pending'); // 'pending' | 'verifying' | 'success' | 'expired'
  const [verifyStep, setVerifyStep] = useState(1); // 1: receiving, 2: validating, 3: completed
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const startTime = getOrInitTimerStart(orderId);
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    return Math.max(0, TOTAL_SECONDS - elapsed);
  });

  const transferContent = `PHURAI ${orderId || ''}`;

  // Real-time countdown timer (persists across tab switches)
  useEffect(() => {
    if (phase === 'success' || phase === 'expired') return;

    const interval = setInterval(() => {
      const startTime = getOrInitTimerStart(orderId);
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, TOTAL_SECONDS - elapsed);
      setSecondsLeft(remaining);

      if (remaining <= 0) {
        setPhase('expired');
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [orderId, phase]);

  // Polling & Real-time SePay Payment Status Check
  useEffect(() => {
    if (phase === 'success' || phase === 'expired') return;

    const pollId = setInterval(async () => {
      try {
        if (!orderId || !onPollStatus) return;
        const res = await onPollStatus(orderId);
        const statusVal =
          res?.data?.status ||
          res?.data?.order_status ||
          res?.order_status ||
          res?.status ||
          res?.paymentStatus;

        const isPaid =
          String(statusVal || '').trim().toLowerCase() === 'paid' ||
          String(statusVal || '').trim().toLowerCase() === 'completed';

        if (isPaid) {
          clearInterval(pollId);
          // Run 3-step spinning verification animation before final success
          setPhase('verifying');
          setVerifyStep(1);

          setTimeout(() => setVerifyStep(2), 700);
          setTimeout(() => {
            setVerifyStep(3);
            setPhase('success');
            if (onSuccess) onSuccess();
          }, 1500);
        }
      } catch (err) {
        console.error('[CheckoutPayment] Polling status failed:', err);
      }
    }, 3000);

    return () => clearInterval(pollId);
  }, [phase, orderId, onPollStatus, onSuccess]);

  const value = {
    state: { phase, secondsLeft, amount, transferContent, orderId, verifyStep },
    actions: { setPhase, setSecondsLeft }
  };

  return (
    <PaymentContext.Provider value={value}>
      <Payment.Frame>
        <AnimatePresence mode="wait">
          {phase === 'success' ? (
            <Payment.SuccessScreen key="success" />
          ) : phase === 'verifying' ? (
            <Payment.VerifyingScreen key="verifying" />
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
    const amountNum = Number(state.amount) || 0;
    const qrUrl = `https://qr.sepay.vn/img?bank=TPBank&acc=00003942326&template=compact&showinfo=true&holder=DANG%20QUANG%20PHU&store=PHURAI%20RESTAURANT&amount=${amountNum}&des=${encodeURIComponent(state.transferContent)}`;

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
    const amountFormatted = (Number(state.amount) || 0).toLocaleString('vi-VN') + ' ₫';

    return (
      <div className="payment-col payment-right">
        <div className="timer-box">
          <span className="timer-label">Code expires in:</span>
          <span className="timer-text" style={{ color: state.secondsLeft < 180 ? '#ef4444' : '#dc2626' }}>
            {minutes}:{seconds}
          </span>
        </div>

        <div className="bank-info-card">
          <p className="owner-name">DANG QUANG PHU</p>

          <div className="info-row">
            <div className="info-text">
              <span className="info-label">CARD NUMBER</span>
              <span className="info-val">4665 84010307 9736</span>
            </div>
          </div>

          <CopyableRow label="ACCOUNT NUMBER" value="00003942326" />
          <CopyableRow label="AMOUNT" value={amountFormatted} copyValue={String(state.amount)} />
          <CopyableRow label="TRANSFER CONTENT" value={state.transferContent} />
        </div>
      </div>
    );
  },

  VerifyingScreen: function PaymentVerifyingScreen() {
    const { state } = useContext(PaymentContext);
    const step = state.verifyStep;

    return (
      <motion.div
        className="payment-state-screen verifying-screen"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        style={{ padding: '40px 24px', textAlign: 'center' }}
      >
        <Loader2 size={56} className="animate-spin text-amber-600 mb-4" style={{ margin: '0 auto 16px', color: '#9f8655' }} />
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1a1a1a', marginBottom: '12px' }}>
          Verifying Online Payment…
        </h3>

        <div style={{ maxWidth: '320px', margin: '0 auto', textAlign: 'left', fontSize: '13px', lineHeight: '1.8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: step >= 1 ? '#15803d' : '#888' }}>
            {step >= 1 ? <CheckCircle2 size={16} /> : <Loader2 size={16} className="animate-spin" />}
            <span>Step 1: Received SePay transfer signal</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: step >= 2 ? '#15803d' : '#888' }}>
            {step >= 2 ? <CheckCircle2 size={16} /> : <Loader2 size={16} className="animate-spin" />}
            <span>Step 2: Validated transfer content & amount</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: step >= 3 ? '#15803d' : '#888' }}>
            {step >= 3 ? <CheckCircle2 size={16} /> : <ShieldCheck size={16} />}
            <span>Step 3: Closing session & issuing receipt</span>
          </div>
        </div>
      </motion.div>
    );
  },

  SuccessScreen: function PaymentSuccessScreen() {
    return (
      <motion.div
        className="payment-state-screen success-screen"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        style={{ padding: '36px 20px', textAlign: 'center' }}
      >
        <CheckCircle2 size={72} color="#10B981" className="success-icon" style={{ margin: '0 auto 12px' }} />
        <h2 className="success-title" style={{ color: '#047857', fontSize: '20px', fontWeight: 'bold' }}>
          Payment Verified!
        </h2>
        <p className="success-subtitle" style={{ color: '#065f46', fontSize: '13px', marginTop: '6px' }}>
          Session closed. Table moved to Cleaning. Ready to print receipt!
        </p>
      </motion.div>
    );
  },

  ExpiredScreen: function PaymentExpiredScreen() {
    const { actions, state } = useContext(PaymentContext);

    return (
      <motion.div
        className="payment-state-screen expired-screen"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ padding: '36px 20px', textAlign: 'center' }}
      >
        <h2 className="expired-title" style={{ color: '#dc2626', fontSize: '18px', fontWeight: 'bold' }}>
          Payment Code Expired
        </h2>
        <p className="expired-subtitle" style={{ color: '#666', fontSize: '13px', margin: '8px 0 16px' }}>
          The 15-minute transfer window for {state.transferContent} has expired.
        </p>
        <button
          className="checkout-btn checkout-btn-primary"
          style={{
            padding: '10px 20px',
            background: '#9f8655',
            color: '#fff',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
          onClick={() => {
            if (state.orderId) {
              localStorage.setItem(`phurai_qr_timer_${state.orderId}`, String(Date.now()));
            }
            actions.setSecondsLeft(TOTAL_SECONDS);
            actions.setPhase('pending');
          }}
        >
          🔄 Generate New QR Code
        </button>
      </motion.div>
    );
  }
};

function CopyableRow({ label, value, copyValue }) {
  const [copied, setCopied] = useState(false);
  const textToCopy = copyValue || value;

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* copy best-effort */
    }
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
