import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost, apiPatch, apiGet } from "@/core/api/httpClient";
import { useSocket } from "@/core/socket/SocketContext.jsx";
import { motion, AnimatePresence } from "framer-motion";

function formatVND(amount) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
}

function CopyableField({ label, copyValue, children }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(copyValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-3">
      <span className="text-gray-500 dark:text-gray-400 text-sm">{label}</span>
      <div className="flex items-center gap-2">
        {children}
        <button
          onClick={handleCopy}
          className="text-gray-400 hover:text-blue-500 transition-colors relative"
          title="Copy"
        >
          {copied ? (
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
          {copied && (
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded shadow whitespace-nowrap z-10">
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
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (reservation?.createdAt) {
      const elapsed = Math.floor((Date.now() - reservation.createdAt) / 1000);
      const remaining = 15 * 60 - elapsed;
      return remaining > 0 ? remaining : 0;
    }
    return 15 * 60;
  });
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [promoErrorMessage, setPromoErrorMessage] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validPromoName, setValidPromoName] = useState("");
  const navigate = useNavigate();
  const Maps = navigate;
  const { socket } = useSocket();
  const phaseRef = useRef(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Timer logic
  useEffect(() => {
    if (phase !== "pending") return;
    if (secondsLeft <= 0) {
      setPhase("expired");
      localStorage.removeItem("phurai_pending_reservation");
      return;
    }
    const timerId = setInterval(() => setSecondsLeft(prev => prev - 1), 1000);
    return () => clearInterval(timerId);
  }, [phase, secondsLeft, reservation?.reservation_id]);

  // Guard: prevent duplicate payment detection calls
  const paymentDetectedRef = useRef(false);

  // Helper: triggered whenever we detect payment was received
  // Uses setTimeout(0) to defer parent state updates past the current React render cycle,
  // preventing the "Cannot update a component while rendering" React error.
  const handlePaymentDetected = useRef(null);
  handlePaymentDetected.current = () => {
    if (paymentDetectedRef.current) return; // already handled
    paymentDetectedRef.current = true;

    // Show "Processing Payment" spinning loader first
    setPhase('processing');

    setTimeout(() => {
      // Then show green tick checkmark
      setPhase('success');

      setTimeout(() => {
        // Then clear localStorage and notify parent
        localStorage.removeItem('phurai_pending_reservation');
        localStorage.removeItem('phurai_applied_promo');
        localStorage.removeItem('phurai_applied_promo_discount');

        if (onSuccess) onSuccess();
      }, 2000); // Show tick for 2s
    }, 1500); // Show spinner for 1.5s
  };

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

  // Handle "I have paid" button — calls verify-deposit endpoint which triggers
  // the same webhook logic (DB update → socket emit → polling detects status change)
  const handleIHavePaid = async () => {
    setPhase('processing');
    try {
      const res = await apiPost(`/payments/verify-deposit/${reservation.reservation_id}`, {});
      // If already paid or just confirmed, advance immediately
      if (res?.success) {
        // The verify-deposit endpoint already updated DB + emitted socket.
        // The polling will pick it up within 3s. But if already_paid, trigger now.
        if (res.already_paid) {
          handlePaymentDetected.current();
        }
        // Otherwise wait for polling to detect the status change (≤3s)
        return;
      }
    } catch (err) {
      console.warn('[Payment] verify-deposit error:', err?.message);
    }
    // If request failed, wait 8s then show alert
    setTimeout(() => {
      if (phaseRef.current === 'processing') {
        setPhase('pending');
        alert('Payment not yet confirmed. Please wait a moment — it can take up to 30 seconds to verify.');
      }
    }, 8000);
  };

  const handleCancel = () => {
    localStorage.removeItem("phurai_pending_reservation");
    if (phase === "pending") {
      apiPatch(`/reservations/${reservation.reservation_id}/cancel`, { cancel_reason: 'Payment Failed' }).catch(console.error);
    }
    onCancel();
  };

  const [baseAmount] = useState(() => {
    if (amount !== undefined && amount !== null && !isNaN(amount)) return Number(amount);
    return 6000;
  });

  const displayAmount = Math.max(0, baseAmount - appliedDiscount);

  const handleApplyPromo = async () => {
    if (!promoCodeInput.trim()) return;
    setIsValidating(true);
    setPromoErrorMessage("");
    try {
      const res = await apiPatch(`/reservations/${reservation.reservation_id}/apply-promo`, { promo_code: promoCodeInput.trim() });
      if (res.data?.success) {
        setAppliedDiscount(res.data.discount_amount);
        setValidPromoName(res.data.promotion_name);
        setPromoErrorMessage("");
      } else {
        setPromoErrorMessage(res.data?.message || "Invalid promo code");
        setAppliedDiscount(0);
        setValidPromoName("");
      }
    } catch (err) {
      setPromoErrorMessage(err.response?.data?.message || "Failed to apply promo code");
      setAppliedDiscount(0);
      setValidPromoName("");
    } finally {
      setIsValidating(false);
    }
  };

  const generatedOrderCode = orderCode || `PHURAIRESTAURANT${reservation?.reservation_id || Math.floor(1000 + Math.random() * 9000)}`;
  const finalQrUrl = qrUrl;

  // When payment is detected, onSuccess() advances the parent to the Confirmed step.
  // No need for a separate overlay here — the parent handles the transition.

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 max-w-md mx-auto w-full">
      <AnimatePresence mode="wait">
        {phase === "pending" && (
          <motion.div
            key="pending"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full text-center"
          >
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Scan VietQR to pay</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Transfer the exact amount. Payment is detected automatically.
            </p>

            {/* Auto-detection live status */}
            <div className="flex items-center justify-center gap-2 mb-4 px-4 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full w-fit mx-auto">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
              <span className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">
                Monitoring for payment automatically...
              </span>
            </div>

            <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 inline-block mb-4 relative max-w-[320px] w-full overflow-hidden">
              <img src={finalQrUrl} alt="SePay QR Code" className="w-full aspect-square object-cover object-top block rounded-lg" />
            </div>

            <div className="w-full text-center mb-4">
              <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium border border-blue-200 dark:border-blue-800/50">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {timeStr}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-left space-y-4 mb-5">
              <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-3">
                <span className="text-gray-500 dark:text-gray-400 text-sm">Bank Name</span>
                <span className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="text-[10px] bg-purple-600 text-white px-1.5 py-0.5 rounded uppercase font-bold">TPBank</span>
                  TPBank
                </span>
              </div>
              <CopyableField label="Account Name" copyValue="DANG QUANG PHU">
                <span className="font-semibold text-gray-900 dark:text-white uppercase">DANG QUANG PHU</span>
              </CopyableField>
              <CopyableField label="Account Number" copyValue="00003942326">
                <span className="font-semibold text-gray-900 dark:text-white font-mono flex items-center gap-2">
                  00003942326
                </span>
              </CopyableField>
              <CopyableField label="Description" copyValue={generatedOrderCode}>
                <span className="font-semibold text-blue-600 dark:text-blue-400 font-mono">{generatedOrderCode}</span>
              </CopyableField>
              <div className="flex justify-between items-center pb-2">
                <span className="text-gray-500 dark:text-gray-400 text-sm">Deposit Amount</span>
                <span className="font-semibold text-gray-900 dark:text-white text-md">{formatVND(baseAmount)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-900 dark:text-white font-medium text-base">Total Target</span>
                <span className="font-bold text-blue-600 dark:text-blue-400 text-xl">{formatVND(displayAmount)}</span>
              </div>
            </div>

            {/* Fallback check button — subtle secondary style */}
            <div className="flex gap-3">
              <button
                onClick={handleIHavePaid}
                className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium py-3 px-4 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Check the transaction
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 bg-white hover:bg-gray-50 dark:bg-[#1a1a1a] dark:hover:bg-gray-900 text-red-500 font-medium py-3 px-4 rounded-xl border border-gray-200 dark:border-gray-800 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel order
              </button>
            </div>

            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
              Payment will be confirmed automatically once received. No action needed.
            </p>
          </motion.div>
        )}

        {phase === "processing" && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="w-full flex flex-col items-center justify-center py-12"
          >
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-6"></div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Processing Payment</h3>
            <p className="text-gray-500 dark:text-gray-400">Please wait while we verify your transaction...</p>
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
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-500/20">
              <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Payment Successful!</h3>
            <p className="text-gray-500 dark:text-gray-400">Your table reservation is confirmed. Redirecting...</p>
          </motion.div>
        )}

        {phase === "expired" && (
          <motion.div
            key="expired"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full flex flex-col items-center justify-center py-12 text-center"
          >
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">Payment Failed</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-8">
              Expired. The system has automatically released your table.
            </p>
            <button
              onClick={handleCancel}
              className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-medium py-3 px-8 rounded-xl transition-colors"
            >
              Return Home
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
