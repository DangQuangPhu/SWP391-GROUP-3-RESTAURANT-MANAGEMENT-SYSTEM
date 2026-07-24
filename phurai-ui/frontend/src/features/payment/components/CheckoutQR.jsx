import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '@/core/socket/SocketContext.jsx';
import PaymentSuccess from './PaymentSuccess';
import PaymentFailed from './PaymentFailed';
import usePaymentPolling from '../hooks/usePaymentPolling';
import toast from 'react-hot-toast';
import checkoutBg from '@/assets/images/checkout/4.jpeg';
import '../../reservations/styles/ReservationDetails.css';

function formatVND(val) {
  return new Intl.NumberFormat("vi-VN").format(val || 0) + " VND";
}

function CopyableField({ label, copyValue, children }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(copyValue);
    setCopied(true);
    toast.success(`Copied ${label || 'text'}!`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
      {label ? <span className="text-white/50 text-xs font-semibold uppercase tracking-wider">{label}</span> : <div />}
      <div className="flex items-center gap-2">
        {children}
        <button 
          onClick={handleCopy} 
          className="text-white/40 hover:text-[#ffd064] transition-colors p-1"
          title={`Copy ${label || 'text'}`}
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
        </button>
      </div>
    </div>
  );
}

export default function CheckoutQR({ 
  orderId, amount, historyData, originalAmount, 
  voucherCode, setVoucherCode, appliedVoucher, applying, voucherError, onApplyVoucher,
  onComplete, onRetry 
}) {
  const { socket } = useSocket();
  const STORAGE_KEY = `checkout_timer_start_${orderId || 'default'}`;

  const [timeLeft, setTimeLeft] = useState(() => {
    const storedStart = localStorage.getItem(STORAGE_KEY);
    let startTime = storedStart ? parseInt(storedStart, 10) : null;
    if (!startTime || isNaN(startTime)) {
      startTime = Date.now();
      localStorage.setItem(STORAGE_KEY, startTime.toString());
    }
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = 15 * 60 - elapsed;
    return remaining > 0 ? remaining : 0;
  });

  const { status } = usePaymentPolling(orderId);
  const [phase, setPhase] = useState('pending'); // 'pending' | 'processing' | 'success' | 'expired'
  const [customAlert, setCustomAlert] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const phaseRef = useRef(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Bank hardcoded info
  const BANK_ID = 'tpbank';
  const ACCOUNT_NO = '00003942326';
  const ACCOUNT_NAME = 'DANG QUANG PHU';
  const ADD_INFO = `DH${orderId || 1000}`; 

  // Watch polling status changes & real-time WebSocket events
  useEffect(() => {
    if (status === 'Paid' || status === 'Completed') {
      setPhase('success');
      localStorage.removeItem(STORAGE_KEY);
      const timer = setTimeout(() => {
        if (onComplete) onComplete();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [status, onComplete, STORAGE_KEY]);

  useEffect(() => {
    if (!socket) return;
    const handlePaymentComplete = (payload) => {
      if (Number(payload?.orderId || payload?.order_id) === Number(orderId) && (payload?.status === 'Paid' || payload?.status === 'Completed')) {
        setPhase('success');
        localStorage.removeItem(STORAGE_KEY);
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 1500);
      }
    };

    socket.on('PAYMENT_STATUS_CHANGED', handlePaymentComplete);
    socket.on('QR_SESSION_PAYMENT_COMPLETED', handlePaymentComplete);

    return () => {
      socket.off('PAYMENT_STATUS_CHANGED', handlePaymentComplete);
      socket.off('QR_SESSION_PAYMENT_COMPLETED', handlePaymentComplete);
    };
  }, [socket, orderId, onComplete, STORAGE_KEY]);


  // Real-time countdown based on exact timestamp
  useEffect(() => {
    const timer = setInterval(() => {
      const storedStart = localStorage.getItem(STORAGE_KEY);
      let startTime = storedStart ? parseInt(storedStart, 10) : Date.now();
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = 15 * 60 - elapsed;

      if (remaining <= 0) {
        setTimeLeft(0);
        if (status !== 'Paid' && status !== 'Completed' && phaseRef.current !== 'success') {
          setPhase('expired');
          localStorage.removeItem(STORAGE_KEY);
          
          // Emit socket alert to Staff Dashboard system
          if (socket) {
            socket.emit('UNPAID_PAYMENT_TIMEOUT', {
              orderId,
              amount,
              tableNumber: historyData?.session?.table_number || historyData?.summary?.tableNumber || 'Unknown'
            });
          }
        }
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [STORAGE_KEY, orderId, amount, historyData, status, socket]);


  // Backend verification handler for "Check transaction"
  const handleIHavePaid = async () => {
    setPhase('processing');
    try {
      if (status === 'Paid' || status === 'Completed') {
        setPhase('success');
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 1500);
        return;
      }
    } catch (err) {
      console.warn('[CheckoutQR] verify error:', err);
    }

    // Wait 4 seconds simulating live bank reconciliation
    setTimeout(() => {
      if (phaseRef.current === 'processing') {
        if (status === 'Paid' || status === 'Completed') {
          setPhase('success');
          setTimeout(() => {
            if (onComplete) onComplete();
          }, 1500);
        } else {
          setPhase('pending');
          setCustomAlert('Payment not yet confirmed. Please wait a moment — bank processing can take up to 30 seconds.');
        }
      }
    }, 4000);
  };

  const handleCancelClick = () => {
    setShowCancelConfirm(true);
  };

  if (phase === 'expired') {
    return <PaymentFailed onRetry={onRetry} />;
  }

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Derive item lists from historyData
  const preorders = historyData?.preorders?.filter(item => item.item_status !== 'Cancelled') || [];
  const sessionOrders = historyData?.sessionOrders?.filter(item => item.item_status !== 'Cancelled') || [];
  
  const preorderTotal = preorders.reduce((sum, item) => sum + (Number(item.unit_price || 0) * Number(item.quantity || 1)), 0);
  const sessionTotal = sessionOrders.reduce((sum, item) => sum + (Number(item.unit_price || 0) * Number(item.quantity || 1)), 0);
  const subtotal = preorderTotal + sessionTotal;
  const preorderDeposit = historyData?.summary?.prepaidDeposit || 0;

  const qrUrl = `https://qr.sepay.vn/img?bank=${BANK_ID}&acc=${ACCOUNT_NO}&amount=${amount}&des=${encodeURIComponent(ADD_INFO)}&template=&showinfo=true&holder=${encodeURIComponent(ACCOUNT_NAME)}&store=PHURAI%20RESTAURANT`;

  return (
    <div className="rd-page rd-page--checkout flex items-center justify-center p-4 relative font-sans text-white overflow-hidden min-h-screen">
      {/* Outer Floating Back / Home Buttons */}
      <div className="absolute top-5 left-5 z-30 flex items-center gap-2">
        <button 
          onClick={() => onRetry ? onRetry() : (window.history.length > 1 ? window.history.back() : window.location.href = '/menu')} 
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg backdrop-blur-md"
          title="Go Back"
          aria-label="Go Back"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <button 
          onClick={() => window.location.href = '/'} 
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg backdrop-blur-md"
          title="Go to Home"
          aria-label="Go to Home"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </button>
      </div>

      {/* Reservation-style Liquid Glass Card (.rd-card .rd-card--checkout) */}
      <div className="rd-card rd-card--checkout flex flex-col items-center justify-center p-6 max-w-4xl mx-auto w-full z-10" style={{ opacity: 1, position: 'relative', overflow: 'hidden' }}>

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
              <div className="flex items-center justify-center gap-2 mb-5 px-3.5 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full w-fit mx-auto">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-[10px] font-semibold text-green-400 uppercase tracking-wide">
                  Monitoring for payment automatically...
                </span>
              </div>

              {/* 50/50 layout: QR left | Info right */}
              <div className="flex flex-col md:flex-row gap-6 items-center w-full">
                
                {/* LEFT: Clean Full QR Code & Timer */}
                <div className="w-full md:w-1/2 flex flex-col items-center justify-center">
                  <div className="bg-white p-3 rounded-[20px] shadow-2xl border border-white/10 w-[72%] max-w-[270px] mx-auto overflow-hidden mb-4 flex items-center justify-center">
                    <img src={qrUrl} alt="SePay QR Code" className="w-full aspect-square object-cover object-top block rounded-lg scale-105" />
                  </div>

                  {/* Clean Timer Pill */}
                  <div className="flex justify-center w-full">
                    <div className="inline-flex items-center justify-center px-6 py-2 rounded-full bg-white/10 text-white font-bold border border-white/15 shadow-sm text-base tracking-wider">
                      {formatTime(timeLeft)}
                    </div>
                  </div>
                </div>

                {/* RIGHT: Payment Info & Breakdown */}
                <div className="w-full md:w-1/2 flex flex-col">
                  {/* Main Bank Details Glass Box */}
                  <div className="bg-white/5 rounded-[20px] p-4 text-left space-y-3 mb-4 border border-white/10">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                      <span className="text-white/50 text-xs font-semibold uppercase tracking-wider">Bank Name</span>
                      <span className="font-semibold text-white flex items-center gap-2 text-sm">
                        <span className="text-[9px] bg-purple-600 text-white px-1.5 py-0.5 rounded uppercase font-bold">TPBank</span>
                        TPBank
                      </span>
                    </div>

                    <CopyableField label="Account Name" copyValue={ACCOUNT_NAME}>
                      <span className="font-semibold text-white uppercase text-sm">{ACCOUNT_NAME}</span>
                    </CopyableField>

                    <CopyableField label="Account Number" copyValue={ACCOUNT_NO}>
                      <span className="font-semibold text-white font-mono flex items-center gap-2 text-sm">
                        {ACCOUNT_NO}
                      </span>
                    </CopyableField>

                    <CopyableField label="Description" copyValue={ADD_INFO}>
                      <span className="font-semibold text-[#ffd064] font-mono text-sm">{ADD_INFO}</span>
                    </CopyableField>

                    {/* INVOICE DETAILS & DISH BREAKDOWN */}
                    <div className="pt-2 pb-2 border-t border-b border-white/5 text-left space-y-2">
                      <span className="text-white/60 text-[10px] font-bold uppercase tracking-wider block">INVOICE DETAILS</span>

                      
                      {/* Pre-ordered items (if any) */}
                      {preorders.length > 0 && (
                        <div className="bg-emerald-500/10 rounded-xl p-2.5 border border-emerald-500/20">
                          <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider mb-1 block">PRE-ORDERED DISHES</span>
                          <ul className="space-y-1">
                            {preorders.map((item, idx) => (
                              <li key={idx} className="flex justify-between items-center text-xs text-white/80">
                                <span>{item.dish_name} <span className="text-white/40">x{item.quantity}</span></span>
                                <span className="font-semibold text-white">{formatVND(item.line_total || (item.unit_price * item.quantity))}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* QR Self Orders (Dining) */}
                      {sessionOrders.length > 0 && (
                        <div className="bg-amber-500/10 rounded-xl p-2.5 border border-amber-500/20">
                          <span className="text-[#ffd064] text-[10px] font-bold uppercase tracking-wider mb-1 block">QR SELF ORDERS (DINING)</span>
                          <ul className="space-y-1">
                            {sessionOrders.map((item, idx) => (
                              <li key={idx} className="flex justify-between items-center text-xs text-white/80">
                                <span>{item.dish_name} <span className="text-white/40">x{item.quantity}</span></span>
                                <span className="font-semibold text-white">{formatVND(item.line_total || (item.unit_price * item.quantity))}</span>
                              </li>
                            ))}
                          </ul>
                          <div className="h-px bg-white/10 my-1.5" />
                          <div className="flex justify-between items-center text-xs font-bold text-[#ffd064]">
                            <span>Unpaid Dining Due:</span>
                            <span>{formatVND(sessionTotal)}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Cashflow Breakdown */}
                    <div className="space-y-1.5 py-1.5 border-b border-white/5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-white/50 font-medium">Subtotal:</span>
                        <span className="font-medium text-white">{formatVND(subtotal)}</span>
                      </div>
                      {preorderDeposit > 0 && (
                        <div className="flex justify-between items-center text-emerald-400">
                          <span>Preorder Deposit (30% Paid):</span>
                          <span>-{formatVND(preorderDeposit)}</span>
                        </div>
                      )}
                      {appliedVoucher && (
                        <div className="flex justify-between items-center text-red-400">
                          <span>Voucher Applied:</span>
                          <span>-{formatVND(appliedVoucher.discount_amount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-1 border-t border-white/5 font-semibold text-white">
                        <span>Net Remaining Payment:</span>
                        <span className="font-bold text-[#ffd064] text-sm">{formatVND(amount)}</span>
                      </div>
                    </div>

                    {/* Promo Code Input */}
                    <div className="pt-2">
                      {!appliedVoucher ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Promo code..."
                            value={voucherCode}
                            onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                            className="flex-1 bg-white/10 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#ffd064] font-mono"
                          />
                          <button
                            onClick={onApplyVoucher}
                            disabled={applying || !voucherCode}
                            className="bg-[#ffd064] text-black font-bold text-xs px-3.5 py-1.5 rounded-xl hover:bg-[#ffe082] transition-colors disabled:opacity-50"
                          >
                            {applying ? '...' : 'Apply'}
                          </button>
                        </div>
                      ) : (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-2 flex items-center justify-between text-xs text-emerald-400">
                          <span>Voucher <strong>{appliedVoucher.code}</strong> (-{formatVND(appliedVoucher.discount_amount)})</span>
                          <span className="text-[10px] font-bold uppercase">Applied ✓</span>
                        </div>
                      )}
                      {voucherError && <p className="text-[11px] text-red-400 mt-1">{voucherError}</p>}
                    </div>

                    {/* To Pay Now */}
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-white font-bold text-sm">To Pay Now</span>
                      <span className="font-bold text-[#ffd064] text-xl">{formatVND(amount)}</span>
                    </div>
                  </div>

                  {/* Reservation-style Action buttons */}
                  <div className="flex gap-3 mb-2.5">
                    <button 
                      onClick={handleIHavePaid} 
                      className="pay-btn-check flex-1 flex items-center justify-center gap-2"
                    >
                      <svg style={{ width: 16, height: 16, flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9l2 2 4-4" />
                      </svg>

                      Check transaction
                    </button>

                    <button 
                      onClick={handleCancelClick} 
                      className="pay-btn-cancel flex-1 flex items-center justify-center gap-2"
                    >
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
              className="w-full flex flex-col items-center justify-center py-16 text-center"
            >
              <div className="w-16 h-16 border-4 border-white/10 border-t-[#ffd064] rounded-full animate-spin mb-8 shadow-sm"></div>
              <h3 className="rzv-serif text-2xl font-bold text-white mb-2">Verifying Payment</h3>
              <p className="text-white/60 text-sm">Please wait while we verify your transaction status...</p>
            </motion.div>
          )}

          {phase === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full flex flex-col items-center justify-center py-16 text-center"
            >
              <div className="w-20 h-20 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-500/20">
                <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="rzv-serif text-2xl font-bold text-white mb-2">Payment Successful!</h3>
              <p className="text-white/60">Your payment has been received. Redirecting...</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Custom glass alert modal */}
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
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '24px',
                padding: '24px',
                maxWidth: '380px',
                width: '100%',
                textAlign: 'center',
                color: '#fff',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-full bg-[#ffd064]/10 border border-[#ffd064]/20 flex items-center justify-center mx-auto mb-3 text-[#ffd064]">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Notice</h4>
              <p className="text-xs text-white/70 mb-5 leading-relaxed">{customAlert}</p>
              <button
                onClick={() => setCustomAlert(null)}
                className="w-full py-2.5 rounded-xl bg-[#ffd064] text-black font-bold text-sm hover:brightness-110 transition-all"
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Glass Cancel Confirmation Modal */}
      <AnimatePresence>
        {showCancelConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 flex items-center justify-center z-50 p-5"
            style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', background: 'rgba(10, 8, 6, 0.70)', borderRadius: '28px' }}
            onClick={() => setShowCancelConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.88, y: 24, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.88, y: 24, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 320 }}
              style={{
                background: 'linear-gradient(145deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)',
                backdropFilter: 'blur(40px)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '24px',
                padding: '24px',
                maxWidth: '380px',
                width: '100%',
                textAlign: 'center',
                color: '#fff',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-3 text-red-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Cancel Payment?</h4>
              <p className="text-xs text-white/70 mb-5 leading-relaxed">Are you sure you want to cancel? Any unpaid dining items will remain pending on your session.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 text-white font-semibold text-sm hover:bg-white/20 transition-all border border-white/10"
                >
                  Keep Waiting
                </button>
                <button
                  onClick={() => {
                    setShowCancelConfirm(false);
                    if (onRetry) onRetry();
                    else if (window.history.length > 1) window.history.back();
                    else window.location.href = '/menu';
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-500 transition-all shadow-lg shadow-red-600/30"
                >
                  Yes, Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
