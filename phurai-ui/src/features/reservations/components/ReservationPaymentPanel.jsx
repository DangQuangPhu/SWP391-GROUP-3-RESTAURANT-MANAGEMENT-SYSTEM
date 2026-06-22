import React, { useEffect, useState, useRef } from "react";
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
  const [secondsLeft, setSecondsLeft] = useState(15 * 60); // 15 mins
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
      return;
    }
    const timerId = setInterval(() => setSecondsLeft(prev => prev - 1), 1000);
    return () => clearInterval(timerId);
  }, [phase, secondsLeft, reservation?.reservation_id]);

  // Socket listener
  useEffect(() => {
    if (!socket || !reservation?.reservation_id || phaseRef.current !== "pending") return;

    const handlePaymentSuccess = (payload) => {
      if (payload.reservationId === reservation.reservation_id && (payload.status === 'Reserved' || payload.status === 'Await Check-in' || payload.status === 'Complete Paid')) {
        setPhase("processing");
        setTimeout(() => {
          setPhase("success");
          setTimeout(() => onSuccess(), 3000);
        }, 1500); // 1.5s processing animation
      }
    };

    socket.on("RESERVATION_PAYMENT_SUCCESS", handlePaymentSuccess);
    return () => {
      socket.off("RESERVATION_PAYMENT_SUCCESS", handlePaymentSuccess);
    };
  }, [socket, reservation?.reservation_id, onSuccess]);

  // Polling fallback
  useEffect(() => {
    if (phaseRef.current !== "pending" || !reservation?.reservation_id) return;

    const intervalId = setInterval(async () => {
      try {
        const res = await apiGet(`/payments/reservations/${reservation.reservation_id}/status`);
        if (res?.data?.status && res.data.status !== 'Pending Payment' && res.data.status !== 'Pending') {
          setPhase("processing");
          setTimeout(() => {
            if (phaseRef.current !== "success") {
              setPhase("success");
              setTimeout(() => onSuccess(), 3000);
            }
          }, 1500);
          clearInterval(intervalId);
        }
      } catch (err) {
        // Silently ignore polling errors
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [reservation?.reservation_id, onSuccess]);

  // Handle "I have paid" button (Customer UX)
  const handleIHavePaid = () => {
    setPhase("processing");
    // We just wait for the socket/polling. If it takes too long, we revert back.
    setTimeout(() => {
      if (phaseRef.current !== "success") {
        setPhase("pending");
        alert("We haven't received your payment yet. Please ensure the transaction was completed.");
      }
    }, 5000);
  };

  const handleCancel = () => {
    if (phase === "pending") {
      apiPatch(`/reservations/${reservation.reservation_id}/cancel`, { cancel_reason: 'Payment Failed' }).catch(console.error);
    }
    onCancel();
  };

  const [displayAmount] = useState(() => {
    if (amount && !isNaN(amount)) return Number(amount);
    const randomAmounts = [5000, 10000, 15000, 20000];
    return randomAmounts[Math.floor(Math.random() * randomAmounts.length)];
  });

  const generatedOrderCode = orderCode || `PHURAIRESTAURANT${reservation?.reservation_id || Math.floor(1000 + Math.random() * 9000)}`;
  const finalQrUrl = qrUrl || `https://qr.sepay.vn/img?bank=TPBank&acc=00003942326&template=&showinfo=true&holder=DANG%20QUANG%20PHU&store=PHURAI%20RESTAURANT&amount=${displayAmount}&des=${encodeURIComponent(generatedOrderCode)}`;

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
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Scan VietQR to pay</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Transfer the exact amount and description for automatic reconciliation.
            </p>

            <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 inline-block mb-4 relative max-w-[320px] w-full overflow-hidden">
              <img src={finalQrUrl} alt="SePay QR Code" className="w-full aspect-square object-cover object-top block rounded-lg" />
            </div>

            <div className="w-full text-center mb-6">
              <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium border border-blue-200 dark:border-blue-800/50">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {timeStr}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-left space-y-4 mb-8">
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
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400 text-sm">Amount</span>
                <span className="font-bold text-gray-900 dark:text-white text-lg">{formatVND(displayAmount)}</span>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleIHavePaid}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-colors"
              >
                I have paid
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 bg-white hover:bg-gray-50 dark:bg-[#1a1a1a] dark:hover:bg-gray-900 text-red-500 font-medium py-3 px-4 rounded-xl border border-gray-200 dark:border-gray-800 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel order
              </button>
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full flex flex-col items-center justify-center py-2"
          >
            <div className="w-full bg-gradient-to-b from-gray-900 to-gray-800 dark:from-gray-800 dark:to-gray-900 rounded-2xl overflow-hidden shadow-2xl relative text-white">
              {/* Top section */}
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/30">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold uppercase tracking-wider mb-1">Payment Successful!</h3>
                <p className="text-green-400 text-sm font-medium">Thank you for your reservation. Redirecting to home...</p>
              </div>

              {/* Dashed divider */}
              <div className="relative h-4 flex items-center w-full">
                <div className="absolute -left-2 w-4 h-4 bg-white dark:bg-[#1a1a1a] rounded-full z-10"></div>
                <div className="w-full border-t-2 border-dashed border-gray-600 relative z-0"></div>
                <div className="absolute -right-2 w-4 h-4 bg-white dark:bg-[#1a1a1a] rounded-full z-10"></div>
              </div>

              {/* Details section */}
              <div className="p-6 bg-gray-50 dark:bg-gray-800/80 text-gray-900 dark:text-white">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 dark:text-gray-400 text-sm">Order Code</span>
                    <span className="font-bold font-mono">{generatedOrderCode}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 dark:text-gray-400 text-sm">Total Paid</span>
                    <span className="font-bold text-lg text-green-600 dark:text-green-400">{formatVND(displayAmount)}</span>
                  </div>

                  {reservation?.preorder_json && (
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-gray-500 dark:text-gray-400 text-sm block mb-2">Pre-ordered Items</span>
                      <ul className="space-y-2">
                        {JSON.parse(reservation.preorder_json).map((item, idx) => (
                          <li key={idx} className="flex justify-between text-sm">
                            <span>{item.quantity}x {item.name || `Dish #${item.dish_id}`}</span>
                            <span className="text-gray-600 dark:text-gray-300 font-medium">
                              {item.unit_price ? formatVND(item.unit_price * item.quantity) : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-center">
                    <img src={finalQrUrl} alt="QR code thumbnail" className="w-16 h-16 opacity-50 grayscale mix-blend-multiply dark:mix-blend-screen" />
                  </div>
                </div>
              </div>

              {/* Bottom accent */}
              <div className="h-2 w-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 mt-6 animate-pulse">
              Finalizing your reservation...
            </p>
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
