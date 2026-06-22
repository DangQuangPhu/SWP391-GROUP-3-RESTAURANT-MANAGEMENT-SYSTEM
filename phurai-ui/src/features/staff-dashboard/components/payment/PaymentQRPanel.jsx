import React, { createContext, useContext, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, CheckCircle2 } from 'lucide-react';
import './PaymentQRPanel.css';
import { usePaymentPolling } from '../../hooks/usePaymentPolling';

const PaymentContext = createContext(null);

export function PaymentQRPanel({ orderId, amount, transferContent, onSuccess }) {
  const { phase, secondsLeft, resetPayment } = usePaymentPolling(orderId, onSuccess);

  const value = { phase, secondsLeft, amount, transferContent, resetPayment };

  return (
    <PaymentContext.Provider value={value}>
      <div className="payment-qr-container">
        <AnimatePresence mode="wait">
          {phase === 'success' ? (
            <PaymentQRPanel.SuccessScreen key="success" />
          ) : (
            <motion.div
              key="panel"
              className="payment-qr-layout"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <PaymentQRPanel.LeftColumn />
              <PaymentQRPanel.RightColumn />

              {phase === 'expired' && <PaymentQRPanel.ExpiredOverlay />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PaymentContext.Provider>
  );
}

// -----------------------------------------------------------------------------
// COMPOUND COMPONENTS
// -----------------------------------------------------------------------------

PaymentQRPanel.LeftColumn = function LeftColumn() {
  const { amount, transferContent, phase } = useContext(PaymentContext);
  const qrUrl = `https://qr.sepay.vn/img?bank=TPBank&acc=00003942326&template=&showinfo=true&holder=DANG%20QUANG%20PHU&store=PHURAI%20RESTAURANT&amount=${amount}&des=${encodeURIComponent(transferContent)}`;
  const isExpired = phase === 'expired';

  return (
    <div className="payment-left-col">
      <div className={`qr-wrapper ${isExpired ? 'qr-blurred' : ''}`}>
        <img src={qrUrl} alt="SePay QR Code" className="qr-img" />
      </div>
      <p className="qr-caption">Scan with any banking app to pay</p>
    </div>
  );
};

PaymentQRPanel.RightColumn = function RightColumn() {
  const { secondsLeft, amount, transferContent } = useContext(PaymentContext);
  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const seconds = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="payment-right-col">
      <div className="timer-wrapper">
        <span className="timer-label">Code expires in:</span>
        <span className="timer-value">{minutes}:{seconds}</span>
      </div>

      <div className="bank-card">
        <h3 className="bank-owner">DANG QUANG PHU</h3>

        <div className="bank-info-row">
          <div className="bank-info-text">
            <span className="bank-info-label">Card Number</span>
            <span className="bank-info-value">4665 84010307 9736</span>
          </div>
          {/* No copy button here as per requirements */}
          <div className="copy-spacer"></div>
        </div>

        <CopyableRow label="Account Number" value="00003942326" />
        <CopyableRow
          label="Amount"
          displayValue={`${amount.toLocaleString('vi-VN')} ₫`}
          copyValue={String(amount)}
        />
        <CopyableRow label="Transfer Content" value={transferContent} />
      </div>
    </div>
  );
};

PaymentQRPanel.SuccessScreen = function SuccessScreen() {
  return (
    <motion.div
      className="payment-success-screen"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <CheckCircle2 size={80} className="success-icon" />
      <h2 className="success-heading">Payment Successful</h2>
      <p className="success-text">The payment has been verified. The table will be updated.</p>
    </motion.div>
  );
};

PaymentQRPanel.ExpiredOverlay = function ExpiredOverlay() {
  const { resetPayment } = useContext(PaymentContext);

  return (
    <div className="payment-expired-overlay">
      <div className="expired-content">
        <h2 className="expired-heading">Payment Expired</h2>
        <p className="expired-text">This QR code is no longer valid.</p>
        <button className="btn-generate" onClick={resetPayment}>
          Generate New Code
        </button>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// HELPER COMPONENTS
// -----------------------------------------------------------------------------

function CopyableRow({ label, value, displayValue, copyValue }) {
  const [copied, setCopied] = useState(false);
  const textToCopy = copyValue || value;
  const textToDisplay = displayValue || value;

  const handleCopy = () => {
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bank-info-row">
      <div className="bank-info-text">
        <span className="bank-info-label">{label}</span>
        <span className="bank-info-value">{textToDisplay}</span>
      </div>
      <button className="btn-copy" onClick={handleCopy} title="Copy to clipboard">
        {copied ? <CheckCircle2 size={20} className="icon-copied" /> : <Copy size={20} className="icon-copy" />}
      </button>

      <AnimatePresence>
        {copied && (
          <motion.div
            className="toast-copied"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            Copied!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
