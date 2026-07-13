import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
  const [customAlert, setCustomAlert] = useState(null);
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
        setCustomAlert('Payment not yet confirmed. Please wait a moment — it can take up to 30 seconds to verify.');
      }
    }, 8000);
  };

  const handleCancel = () => {
    localStorage.removeItem("phurai_pending_reservation");
    if (phase === "pending") {
      const token = localStorage.getItem("phurai_token") || localStorage.getItem("token") || localStorage.getItem("authToken");
      if (token) {
        apiPatch(`/reservations/${reservation.reservation_id}/cancel`, { cancel_reason: 'Payment Failed' }).catch(console.error);
      }
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
    <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-[#171717]/85 dark:backdrop-blur-2xl rounded-2xl shadow-xl dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] border border-gray-200 dark:border-white/10 max-w-6xl mx-auto w-full">
      <AnimatePresence mode="wait">
        {phase === "pending" && (
          <motion.div
            key="pending"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full"
          >
            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Scan VietQR to pay</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Transfer the exact amount. Payment is detected automatically.
              </p>
            </div>

            {/* Live status badge */}
            <div className="flex items-center justify-center gap-2 mb-8 px-4 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full w-fit mx-auto">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
              <span className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">
                Monitoring for payment automatically...
              </span>
            </div>

            {/* 50/50 layout: QR left | Info right vertically centered */}
            <div className="flex flex-col md:flex-row gap-10 items-center w-full">
              {/* LEFT: QR code & Timer */}
              <div className="w-full md:w-1/2 flex flex-col items-center justify-center">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 w-[80%] mx-auto overflow-hidden mb-6">
                  <img src={finalQrUrl} alt="SePay QR Code" className="w-full aspect-square object-cover object-top block rounded-lg" />
                </div>

                {/* Timer moved under QR */}
                <div className="flex justify-center w-full">
                  <div className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold border border-blue-200 dark:border-blue-800/50 shadow-sm text-lg">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {timeStr}
                  </div>
                </div>
              </div>

              {/* RIGHT: Payment info */}
              <div className="w-full md:w-1/2 flex flex-col">
                {/* Bank details */}
                <div className="bg-gray-50 dark:bg-black/40 rounded-2xl p-5 text-left space-y-5 mb-6 border border-gray-100 dark:border-white/5">
                  <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-4">
                    <span className="text-gray-500 dark:text-gray-400 text-sm">Bank Name</span>
                    <span className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 text-base">
                      <span className="text-[10px] bg-purple-600 text-white px-1.5 py-0.5 rounded uppercase font-bold">TPBank</span>
                      TPBank
                    </span>
                  </div>
                  <CopyableField label="Account Name" copyValue="DANG QUANG PHU">
                    <span className="font-semibold text-gray-900 dark:text-white uppercase text-base">DANG QUANG PHU</span>
                  </CopyableField>
                  <CopyableField label="Account Number" copyValue="00003942326">
                    <span className="font-semibold text-gray-900 dark:text-white font-mono flex items-center gap-2 text-base">
                      00003942326
                    </span>
                  </CopyableField>
                  <CopyableField label="Description" copyValue={generatedOrderCode}>
                    <span className="font-semibold text-blue-600 dark:text-blue-400 font-mono text-base">{generatedOrderCode}</span>
                  </CopyableField>
                  <div className="flex justify-between items-center pb-2 pt-1 border-b border-gray-200 dark:border-white/10">
                    <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">Total Bill</span>
                    <span className="font-semibold text-gray-900 dark:text-white text-lg">
                      {formatVND((reservation?.final_total || 0) + baseAmount)}
                    </span>
                  </div>

                  {reservation?.final_total !== undefined && (
                    <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-white/10">
                      <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">Remaining Balance (Pay Later 70%)</span>
                      <span className="font-semibold text-gray-900 dark:text-white text-lg">{formatVND(reservation.final_total)}</span>
                    </div>
                  )}

                  {reservation?.preorderItems && reservation.preorderItems.length > 0 && (
                    <div className="pt-3 pb-1 border-b border-gray-200 dark:border-white/10">
                      <span className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2 block">Pre-ordered Items</span>
                      <ul className="space-y-2 mb-3">
                        {reservation.preorderItems.map((item, idx) => (
                          <li key={idx} className="flex justify-between items-center text-sm">
                            <span className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
                              <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                              {item.name || item.dish_name || `Item #${item.dish_id}`}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400 font-mono text-xs font-semibold bg-gray-200 dark:bg-white/10 px-1.5 py-0.5 rounded">x{item.quantity}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-4">
                    <span className="text-gray-900 dark:text-white font-semibold text-lg">To Pay Now (Deposit 30%)</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400 text-2xl">{formatVND(displayAmount)}</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-4 mb-4">
                  <button
                    onClick={handleIHavePaid}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-[#171717]/85 dark:backdrop-blur-2xl dark:hover:bg-white/10 text-gray-800 dark:text-white font-semibold py-3.5 px-4 rounded-xl border border-transparent dark:border-white/10 transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    Check transaction
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex-1 bg-white hover:bg-red-50 dark:bg-[#171717]/85 dark:backdrop-blur-2xl dark:hover:bg-red-900/20 text-red-500 font-semibold py-3.5 px-4 rounded-xl border border-gray-200 dark:border-white/10 hover:border-red-200 dark:hover:border-red-800 transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancel order
                  </button>
                </div>

                <p className="text-sm text-gray-400 dark:text-gray-500 text-center">
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

      {/* Custom alert modal */}
      <AnimatePresence>
        {customAlert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[9999] p-5"
            onClick={() => setCustomAlert(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 30, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="bg-[#171717]/90 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-2xl w-full max-w-[460px] p-[36px_32px] text-center text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                backgroundColor: "rgba(191, 154, 99, 0.08)",
                border: "2px solid #bf9a63",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px auto",
                color: "#bf9a63",
              }}>
                <svg style={{ width: "28px", height: "28px" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h4 style={{
                fontSize: "1.25rem",
                fontWeight: "bold",
                marginBottom: "12px",
                color: "#bf9a63",
                fontFamily: "Outfit, Inter, sans-serif",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}>
                Please Note
              </h4>
              <p className="text-gray-400 text-[0.95rem] leading-relaxed mb-7 font-['Inter',sans-serif]">
                {customAlert}
              </p>
              <button
                onClick={() => setCustomAlert(null)}
                style={{
                  backgroundColor: "#bf9a63",
                  color: "#0a0a0a",
                  fontWeight: 700,
                  padding: "12px 36px",
                  borderRadius: "12px",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                  boxShadow: "0 4px 14px rgba(191, 154, 99, 0.25)",
                  fontSize: "0.85rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  fontFamily: "Outfit, Inter, sans-serif"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#d4b383";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 18px rgba(191, 154, 99, 0.35)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#bf9a63";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 14px rgba(191, 154, 99, 0.25)";
                }}
              >
                Understood
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
