import { useEffect, useState, useRef } from "react";
import { apiPost, apiPatch, apiGet } from "@/core/api/httpClient";
import { useSocket } from "@/core/socket/SocketContext.jsx";
import { motion, AnimatePresence } from "framer-motion";

function formatVND(amount) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " VND";
}

function CopyableField({ label, copyValue, children }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(copyValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex justify-between items-center border-b border-white/5 pb-3">
      <span className="text-white/50 text-xs font-semibold uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-2">
        {children}
        <button
          onClick={handleCopy}
          className="text-white/40 hover:text-[#ffd064] transition-colors relative"
          title="Copy"
        >
          {copied ? (
            <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
          {copied && (
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/85 text-white text-[10px] px-2 py-1 rounded-xl shadow-xl whitespace-nowrap z-10">
              Copied!
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

export default function ReservationPaymentPanel({ reservation, amount, orderCode, qrUrl, onSuccess, onCancel }) {
  const [phase, setPhase] = useState("pending"); // pending | processing | success | expired
  const [processingStep, setProcessingStep] = useState(0);
  const [customAlert, setCustomAlert] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (reservation?.createdAt) {
      const elapsed = Math.floor((Date.now() - reservation.createdAt) / 1000);
      const remaining = 15 * 60 - elapsed;
      return remaining > 0 ? remaining : 0;
    }
    return 15 * 60;
  });
  const [appliedDiscount] = useState(0);
  const { socket } = useSocket();
  const phaseRef = useRef(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Timer logic
  useEffect(() => {
    if (phase !== "pending") return;
    if (secondsLeft <= 0) {
      setTimeout(() => {
        setPhase("expired");
      }, 0);
      localStorage.removeItem("phurai_pending_reservation");
      return;
    }
    const timerId = setInterval(() => setSecondsLeft(prev => prev - 1), 1000);
    return () => clearInterval(timerId);
  }, [phase, secondsLeft, reservation?.reservation_id]);

  // Guard: prevent duplicate payment detection calls
  const paymentDetectedRef = useRef(false);
  const timersRef = useRef([]);

  useEffect(() => {
    const currentTimers = timersRef.current;
    return () => {
      currentTimers.forEach(clearTimeout);
    };
  }, []);

  // Helper: triggered whenever we detect payment was received
  const handlePaymentDetected = useRef(null);
  useEffect(() => {
    handlePaymentDetected.current = () => {
      if (paymentDetectedRef.current) return; // already handled
      paymentDetectedRef.current = true;

      // Show "Processing Payment" spinning loader first
      setPhase('processing');
      setProcessingStep(0);

      // Step 1: Checking transfer content (takes 1.2s)
      const t1 = setTimeout(() => {
        setProcessingStep(1);
      }, 1200);
      timersRef.current.push(t1);

      // Step 2: Verifying deposit amount (takes 1.2s)
      const t2 = setTimeout(() => {
        setProcessingStep(2);
      }, 2400);
      timersRef.current.push(t2);

      // Step 3: Finalizing table reservation (takes 1.1s)
      const t3 = setTimeout(() => {
        setProcessingStep(3);
        setPhase('success');

        const t4 = setTimeout(() => {
          // Then clear localStorage and notify parent
          localStorage.removeItem('phurai_pending_reservation');
          localStorage.removeItem('phurai_applied_promo');
          localStorage.removeItem('phurai_applied_promo_discount');

          if (onSuccess) onSuccess();
        }, 2000); // Show tick for 2s
        timersRef.current.push(t4);
      }, 3500);
      timersRef.current.push(t3);
    };
  }, [onSuccess]);

  // Socket listener — real-time push from server when SePay webhook fires
  useEffect(() => {
    if (!socket || !reservation?.reservation_id) return;

    const handlePaymentSuccess = (payload) => {
      if (paymentDetectedRef.current) return;
      const targetId = payload.reservationId || payload.reservation_id || payload.id;
      // 'Confirmed' is the canonical paid/awaiting-check-in state in the new enum
      const paidStatuses = ['Confirmed', 'Completed', 'Check-in', 'Dining', 'Await Check-in', 'Reserved', 'Paid', 'Complete Paid'];
      if (Number(targetId) === Number(reservation.reservation_id) && paidStatuses.includes(payload.status)) {
        console.log('[Payment] Socket PAYMENT_SUCCESS: confirmed', payload.status);
        handlePaymentDetected.current();
      }
    };

    const handleStatusChanged = (payload) => {
      if (paymentDetectedRef.current) return;
      const targetId = payload.reservationId || payload.reservation_id || payload.id;
      const status = payload.status || payload.reservation_status;
      if (Number(targetId) === Number(reservation.reservation_id)) {
        if (status === 'Await Check-in' || status === 'Reserved' || status === 'Confirmed') {
          console.log('[Payment] Socket: status changed to paid-like status', status);
          handlePaymentDetected.current();
        } else if (status === 'PaymentFailed' || status === 'Cancelled' || status === 'Rejected') {
          setPhase('expired');
          localStorage.removeItem('phurai_pending_reservation');
        }
      }
    };

    socket.on('RESERVATION_PAYMENT_SUCCESS', handlePaymentSuccess);
    socket.on('RESERVATION_STATUS_CHANGED', handleStatusChanged);
    socket.on('reservation:status_changed', handleStatusChanged);

    return () => {
      socket.off('RESERVATION_PAYMENT_SUCCESS', handlePaymentSuccess);
      socket.off('RESERVATION_STATUS_CHANGED', handleStatusChanged);
      socket.off('reservation:status_changed', handleStatusChanged);
    };
  }, [socket, reservation?.reservation_id]);

  // Polling fallback — every 3s check the DB directly for status change
  useEffect(() => {
    if (!reservation?.reservation_id) return;

    const intervalId = setInterval(async () => {
      if (paymentDetectedRef.current) {
        clearInterval(intervalId);
        return;
      }
      if (phaseRef.current !== 'pending' && phaseRef.current !== 'processing') {
        clearInterval(intervalId);
        return;
      }
      try {
        const res = await apiGet(`/payments/reservations/${reservation.reservation_id}/status`);
        // apiGet returns the JSON body directly: { success: true, data: { status: '...' } }
        const status = res?.data?.status;
        console.log('[Payment] Poll status:', status);
        const paidStatuses = ['Confirmed', 'Completed', 'Check-in', 'Dining', 'Await Check-in', 'Reserved'];
        const cancelStatuses = ['Cancelled', 'Rejected', 'PaymentFailed'];
        if (paidStatuses.includes(status)) {
          clearInterval(intervalId);
          handlePaymentDetected.current();
        } else if (cancelStatuses.includes(status)) {
          clearInterval(intervalId);
          setPhase('expired');
          localStorage.removeItem('phurai_pending_reservation');
        }
      } catch (err) {
        console.warn('[Payment] Poll error (ignored):', err?.message);
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [reservation?.reservation_id]);

  const handleIHavePaid = async () => {
    setPhase('processing');
    try {
      const res = await apiPost(`/payments/verify-deposit/${reservation.reservation_id}`, {});
      if (res?.success) {
        handlePaymentDetected.current();
        return;
      }
    } catch (err) {
      console.warn('[Payment] verify-deposit error:', err?.message);
    }
    // If request failed, wait 8s then show alert
    setTimeout(() => {
      if (phaseRef.current === 'processing') {
        setPhase('pending');
        setCustomAlert('Payment not yet confirmed. Please wait a moment — it can take up to 30 seconds to verify.');
      }
    }, 8000);
  };

  const handleCancel = () => {
    setShowCancelConfirm(true);
  };

  const handleConfirmCancel = () => {
    // Clear ALL reservation-related localStorage
    [
      'phurai_pending_reservation',
      'phurai_reservation_form',
      'phurai_reservation_table',
      'phurai_reservation_preorder_items',
      'phurai_reservation_preorder_total',
      'phurai_applied_promo',
      'phurai_applied_promo_discount',
    ].forEach((key) => localStorage.removeItem(key));

    // Call API to cancel if still pending
    if (phase === 'pending') {
      const token = localStorage.getItem('phurai_token') || localStorage.getItem('token') || localStorage.getItem('authToken');
      if (token) {
        apiPatch(`/reservations/${reservation.reservation_id}/cancel`, { cancel_reason: 'Payment Cancelled by User' }).catch(console.error);
      }
    }
    onCancel();
  };

  const [baseAmount] = useState(() => {
    if (amount !== undefined && amount !== null && !isNaN(amount)) return Number(amount);
    return 6000;
  });

  const displayAmount = Math.max(0, baseAmount - appliedDiscount);

  const [generatedOrderCode] = useState(() => {
    return orderCode || `PHURAIRESTAURANT${reservation?.reservation_id || Math.floor(1000 + Math.random() * 9000)}`;
  });
  const finalQrUrl = qrUrl;

  // When payment is detected, onSuccess() advances the parent to the Confirmed step.
  // No need for a separate overlay here — the parent handles the transition.

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  return (
    <div className="rd-card flex flex-col items-center justify-center p-5 max-w-4xl mx-auto w-full" style={{ opacity: 1, position: 'relative', overflow: 'hidden' }}>
      <AnimatePresence mode="wait">
        {phase === "pending" && (
          <motion.div
            key="pending"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="w-full"
          >
            {/* Header */}
            <div className="text-center mb-4">
              <span className="text-[10px] font-bold text-[#ffd064] uppercase tracking-[1.5px] mb-1 block">PAYMENT DEPOSIT</span>
              <h2 className="rzv-serif text-2xl font-semibold text-white mb-1.5">Scan VietQR to pay</h2>
              <p className="text-xs text-white/60">
                Transfer the exact amount. Payment is detected automatically.
              </p>
            </div>

            {/* Live status badge */}
            <div className="flex items-center justify-center gap-2 mb-4 px-3.5 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full w-fit mx-auto">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-[10px] font-semibold text-green-400 uppercase tracking-wide">
                Monitoring for payment automatically...
              </span>
            </div>

            {/* 50/50 layout: QR left | Info right vertically centered */}
            <div className="flex flex-col md:flex-row gap-6 items-center w-full">
              {/* LEFT: QR code & Timer */}
              <div className="w-full md:w-1/2 flex flex-col items-center justify-center">
                <div className="bg-white p-3 rounded-[20px] shadow-2xl border border-white/10 w-[70%] mx-auto overflow-hidden mb-4 flex items-center justify-center">
                  <img src={finalQrUrl} alt="SePay QR Code" className="w-full aspect-square object-cover object-top block rounded-lg" />
                </div>

                {/* Timer moved under QR */}
                <div className="flex justify-center w-full">
                  <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-white/5 text-white font-semibold border border-white/10 shadow-sm text-sm">
                    <svg className="w-4.5 h-4.5 text-[#ffd064]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {timeStr}
                  </div>
                </div>
              </div>

              {/* RIGHT: Payment info */}
              <div className="w-full md:w-1/2 flex flex-col">
                {/* Bank details */}
                <div className="bg-white/5 rounded-[20px] p-4 text-left space-y-3 mb-4 border border-white/10">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-white/50 text-xs font-semibold uppercase tracking-wider">Bank Name</span>
                    <span className="font-semibold text-white flex items-center gap-2 text-sm">
                      <span className="text-[9px] bg-purple-600 text-white px-1.5 py-0.5 rounded uppercase font-bold">TPBank</span>
                      TPBank
                    </span>
                  </div>
                  <CopyableField label="Account Name" copyValue="DANG QUANG PHU">
                    <span className="font-semibold text-white uppercase text-sm">DANG QUANG PHU</span>
                  </CopyableField>
                  <CopyableField label="Account Number" copyValue="00003942326">
                    <span className="font-semibold text-white font-mono flex items-center gap-2 text-sm">
                      00003942326
                    </span>
                  </CopyableField>
                  <CopyableField label="Description" copyValue={generatedOrderCode}>
                    <span className="font-semibold text-[#ffd064] font-mono text-sm">{generatedOrderCode}</span>
                  </CopyableField>
                  {/* Pre-ordered Dishes List */}
                  <div className="pt-0.5 pb-2 border-b border-white/5 text-left">
                    <span className="text-white/50 text-[10px] font-bold uppercase tracking-wider mb-1.5 block">Pre-ordered Dishes</span>
                    {(reservation?.preorderItems || reservation?.preorder_items || []).length > 0 ? (
                      <ul className="space-y-1.5">
                        {(reservation.preorderItems || reservation.preorder_items).map((item, idx) => {
                          const price = Number(item.price || item.unit_price || 0);
                          const qty = Number(item.quantity || 1);
                          return (
                            <li key={idx} className="flex justify-between items-start text-xs">
                              <div className="text-white/80 flex flex-col">
                                <span className="font-medium">{item.name || item.dish_name || `Item #${item.dish_id}`}</span>
                                <span className="text-[10px] text-white/40">x{qty} · {formatVND(price)}</span>
                              </div>
                              <span className="text-white font-semibold">{formatVND(price * qty)}</span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-white/40 italic">No preordered items (Table booking only)</p>
                    )}
                  </div>

                  {/* Cashflow Breakdown */}
                  <div className="space-y-1.5 pt-2 pb-2 border-b border-white/5 text-xs">
                    {(() => {
                      const preorderList = reservation?.preorderItems || reservation?.preorder_items || [];
                      const subTotal = preorderList.reduce((sum, item) => sum + (Number(item.price || item.unit_price || 0) * Number(item.quantity || 1)), 0);
                      const totalBillVal = (reservation?.final_total || 0) + baseAmount;
                      const bookingFeeVal = Math.max(0, totalBillVal - subTotal);

                      return (
                        <>
                          {preorderList.length > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-white/50">Preorder Subtotal</span>
                              <span className="font-medium text-white">{formatVND(subTotal)}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center">
                            <span className="text-white/50">Table Booking Fee</span>
                            <span className="font-medium text-white">{formatVND(bookingFeeVal)}</span>
                          </div>
                          <div className="flex justify-between items-center pt-0.5 border-t border-white/5">
                            <span className="text-white font-semibold">Total Bill</span>
                            <span className="font-bold text-white">{formatVND(totalBillVal)}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Remaining Balance (Pay Later 70%) */}
                  <div className="flex justify-between items-center py-2 border-b border-white/5 text-xs">
                    <span className="text-white/50 font-medium">Remaining Balance (Pay Later 70%)</span>
                    <span className="font-semibold text-white text-base">
                      {formatVND(reservation?.final_total !== undefined ? reservation.final_total : (((reservation?.final_total || 0) + baseAmount) * 0.70))}
                    </span>
                  </div>

                  {/* To Pay Now (Deposit 30%) */}
                  <div className="flex justify-between items-center pt-3">
                    <span className="text-white font-bold text-sm">To Pay Now (Deposit 30%)</span>
                    <span className="font-bold text-[#ffd064] text-xl">{formatVND(displayAmount)}</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 mb-2.5">
                  <button onClick={handleIHavePaid} className="pay-btn-check">
                    <svg style={{ width: 16, height: 16, flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9l2 2 4-4" />
                    </svg>
                    Check transaction
                  </button>
                  <button onClick={handleCancel} className="pay-btn-cancel">
                    <svg style={{ width: 16, height: 16, flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancel Payment
                  </button>
                </div>

                <p className="text-[11px] text-white/40 text-center">
                  Payment will be confirmed automatically once received. No action needed.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {phase === "processing" && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="w-full flex flex-col items-center justify-center py-8 text-center"
          >
            <div className="w-16 h-16 border-4 border-white/10 border-t-[#ffd064] rounded-full animate-spin mb-8 shadow-sm"></div>
            <h3 className="text-2xl font-bold text-white mb-6">Verifying Payment</h3>
            
            <p className="text-white/50 text-sm mt-2">Please wait while we verify your payment...</p>

          </motion.div>
        )}

        {phase === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full flex flex-col items-center justify-center py-12 text-center"
          >
            <div className="w-20 h-20 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-500/20">
              <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Payment Successful!</h3>
            <p className="text-white/60">Your table reservation is confirmed. Redirecting...</p>
          </motion.div>
        )}

        {phase === "expired" && (
          <motion.div
            key="expired"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full flex flex-col items-center justify-center py-12 text-center"
          >
            <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-red-400 mb-2">Payment Failed</h3>
            <p className="text-white/60 mb-8">
              Expired. The system has automatically released your table.
            </p>
            <button
              onClick={handleCancel}
              className="rd-btn-outline py-3 px-8 text-white font-medium"
            >
              Return Home
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom alert modal — Liquid Glass */}
      <AnimatePresence>
        {customAlert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 flex items-center justify-center z-50 p-5"
            style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', background: 'rgba(10, 8, 6, 0.70)', borderRadius: '28px' }}
            onClick={() => setCustomAlert(null)}
          >
            <motion.div
              initial={{ scale: 0.88, y: 24, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.88, y: 24, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 320 }}
              style={{
                background: 'linear-gradient(145deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)',
                backdropFilter: 'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '28px',
                boxShadow: '0 32px 80px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(255,255,255,0.08) inset, 0 1px 0 rgba(255,255,255,0.18) inset',
                padding: '40px 36px 36px',
                maxWidth: '420px',
                width: '100%',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Glass shimmer highlight */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
                borderRadius: '28px 28px 0 0',
              }} />

              {/* Red warning icon with shake animation */}
              <motion.div
                initial={{ rotate: 0 }}
                animate={{ rotate: [0, -12, 12, -10, 10, -6, 6, 0] }}
                transition={{ duration: 0.65, delay: 0.25, ease: 'easeInOut' }}
                style={{
                  width: '64px', height: '64px', borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1.5px solid rgba(239, 68, 68, 0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px auto',
                  boxShadow: '0 0 24px rgba(239, 68, 68, 0.2)',
                }}
              >
                <svg style={{ width: '30px', height: '30px', color: '#ef4444' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </motion.div>

              {/* Title */}
              <h4 style={{
                fontSize: '1.05rem', fontWeight: 800,
                marginBottom: '10px',
                color: '#ffffff',
                fontFamily: 'Outfit, Inter, sans-serif',
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
              }}>
                Please Note
              </h4>

              {/* Body text */}
              <p style={{
                color: 'rgba(255,255,255,0.58)',
                fontSize: '0.92rem',
                lineHeight: 1.65,
                marginBottom: '28px',
                fontFamily: 'Inter, sans-serif',
              }}>
                {customAlert}
              </p>

              {/* Gold pill button */}
              <button
                onClick={() => setCustomAlert(null)}
                className="pay-btn-check"
                style={{ width: '100%', justifyContent: 'center', padding: '13px 28px', fontSize: '14px' }}
              >
                Understood
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel Confirmation Modal — Liquid Glass */}
      <AnimatePresence>
        {showCancelConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="absolute inset-0 flex items-center justify-center z-50 p-6"
            style={{
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              background: 'rgba(10, 8, 6, 0.75)',
              borderRadius: '28px',
            }}
          >
            <motion.div
              initial={{ scale: 0.86, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.86, y: 20, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 320 }}
              style={{
                background: 'linear-gradient(145deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)',
                backdropFilter: 'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '28px',
                boxShadow: '0 32px 80px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(255,255,255,0.08) inset, 0 1px 0 rgba(255,255,255,0.18) inset',
                padding: '40px 36px 36px',
                maxWidth: '380px',
                width: '100%',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Glass shimmer highlight */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
                borderRadius: '28px 28px 0 0',
              }} />

              {/* Red warning icon — shakes on mount */}
              <motion.div
                initial={{ rotate: 0 }}
                animate={{ rotate: [0, -14, 14, -10, 10, -5, 5, 0] }}
                transition={{ duration: 0.65, delay: 0.2, ease: 'easeInOut' }}
                style={{
                  width: '64px', height: '64px', borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1.5px solid rgba(239, 68, 68, 0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px auto',
                  boxShadow: '0 0 28px rgba(239, 68, 68, 0.2)',
                }}
              >
                <svg style={{ width: '30px', height: '30px', color: '#ef4444' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.div>

              {/* Title */}
              <h4 style={{
                fontSize: '1.1rem', fontWeight: 800,
                marginBottom: '10px',
                color: '#ffffff',
                fontFamily: 'Outfit, Inter, sans-serif',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>
                Cancel Order?
              </h4>

              {/* Body */}
              <p style={{
                color: 'rgba(255,255,255,0.55)',
                fontSize: '0.9rem',
                lineHeight: 1.65,
                marginBottom: '28px',
                fontFamily: 'Inter, sans-serif',
              }}>
                Your reservation will be cancelled and all saved details will be cleared. You'll need to start over if you change your mind.
              </p>

              {/* Action buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Keep Reservation - gold primary */}
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="pay-btn-check"
                  style={{ width: '100%', justifyContent: 'center', padding: '13px 28px', fontSize: '14px' }}
                >
                  Keep Payment
                </button>
                {/* Confirm Cancel - red */}
                <button
                  onClick={handleConfirmCancel}
                  className="pay-btn-cancel"
                  style={{ width: '100%', justifyContent: 'center', padding: '13px 28px', fontSize: '14px' }}
                >
                  Yes, Cancel Payment
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
