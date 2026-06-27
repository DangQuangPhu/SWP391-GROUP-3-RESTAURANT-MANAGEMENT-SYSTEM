import React, { useState, useEffect } from 'react';
import { Copy, Clock, CreditCard, Banknote, User } from 'lucide-react';
import PaymentSuccess from './PaymentSuccess';
import PaymentFailed from './PaymentFailed';
import usePaymentPolling from '../hooks/usePaymentPolling';

export default function CheckoutQR({ 
  orderId, amount, originalAmount, 
  voucherCode, setVoucherCode, appliedVoucher, applying, voucherError, onApplyVoucher,
  onComplete, onRetry 
}) {
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutes in seconds
  const { status, isLoading } = usePaymentPolling(orderId);
  const [showFailed, setShowFailed] = useState(false);

  // Bank hardcoded info
  const BANK_ID = 'tpbank';
  const ACCOUNT_NO = '00003942326';
  const ACCOUNT_NAME = 'DANG QUANG PHU';
  const ADD_INFO = `DH${orderId || 1000}`; // Order prefix matching backend parser

  useEffect(() => {
    if (timeLeft <= 0) {
      if (status !== 'Paid') setShowFailed(true);
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, status]);

  if (status === 'Paid') {
    return <PaymentSuccess onComplete={onComplete} />;
  }

  if (showFailed) {
    return <PaymentFailed onRetry={onRetry} />;
  }

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    // Optional: show a small toast notification here
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const qrUrl = `https://qr.sepay.vn/img?bank=${BANK_ID}&acc=${ACCOUNT_NO}&template=&showinfo=true&holder=${encodeURIComponent(ACCOUNT_NAME)}&store=PHURAI%20RESTAURANT&amount=${amount}&des=${encodeURIComponent(ADD_INFO)}`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl max-w-4xl w-full overflow-hidden flex flex-col md:flex-row">
        
        {/* Left Column - QR Code */}
        <div className="md:w-1/2 p-8 flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-800 dark:to-gray-900 border-r border-gray-100 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Scan to Pay</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 text-center text-sm">
            Use your banking app to scan this QR code
          </p>
          
          <div className="bg-white p-4 rounded-2xl shadow-lg border border-gray-100 mb-6">
            <img 
              src={qrUrl} 
              alt="VietQR Checkout" 
              className="w-64 h-64 object-contain"
            />
          </div>

          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium">
            <Clock className="w-5 h-5 animate-pulse" />
            <span className="text-xl">{formatTime(timeLeft)}</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">waiting for payment</p>
        </div>

        {/* Right Column - Transfer Details */}
        <div className="md:w-1/2 p-8 flex flex-col justify-center">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
            Transfer Details
          </h3>

          <div className="space-y-6">
            {/* Bank Name */}
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Banknote className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Bank</p>
                  <p className="font-semibold text-gray-900 dark:text-white">TPBank</p>
                </div>
              </div>
              <button onClick={() => handleCopy('TPBank')} className="text-gray-400 hover:text-blue-500 transition-colors p-2 opacity-0 group-hover:opacity-100">
                <Copy className="w-5 h-5" />
              </button>
            </div>

            {/* Account Number */}
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Account Number</p>
                  <p className="font-semibold text-gray-900 dark:text-white text-lg tracking-wider">{ACCOUNT_NO}</p>
                </div>
              </div>
              <button onClick={() => handleCopy(ACCOUNT_NO)} className="text-gray-400 hover:text-blue-500 transition-colors p-2 opacity-0 group-hover:opacity-100">
                <Copy className="w-5 h-5" />
              </button>
            </div>

            {/* Account Name */}
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <User className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Account Name</p>
                  <p className="font-semibold text-gray-900 dark:text-white uppercase">{ACCOUNT_NAME}</p>
                </div>
              </div>
              <button onClick={() => handleCopy(ACCOUNT_NAME)} className="text-gray-400 hover:text-blue-500 transition-colors p-2 opacity-0 group-hover:opacity-100">
                <Copy className="w-5 h-5" />
              </button>
            </div>

            {/* Promo / Voucher Section */}
            <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Promo Code</p>
              {!appliedVoucher ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        placeholder="Enter promo code..."
                        value={voucherCode}
                        onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all font-mono text-gray-900 dark:text-white placeholder-gray-400"
                        disabled={applying}
                      />
                    </div>
                    <button
                      onClick={onApplyVoucher}
                      disabled={applying || !voucherCode.trim()}
                      className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {applying ? "..." : "Apply"}
                    </button>
                  </div>
                  {voucherError && <p className="text-sm text-red-500 mt-1">{voucherError}</p>}
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-800 flex items-center justify-center">
                      <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                        Code {appliedVoucher.code} applied
                      </p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        Discount {`${Math.round(appliedVoucher.discount_amount).toLocaleString('vi-VN')} VND`}
                      </p>
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Amount */}
            <div className="flex items-center justify-between group pt-4 border-t border-gray-100 dark:border-gray-700">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Payment Amount</p>
                {appliedVoucher && (
                  <p className="text-sm text-gray-400 line-through mb-0.5">
                    {`${Math.round(originalAmount || 0).toLocaleString('vi-VN')} VND`}
                  </p>
                )}
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {`${Math.round(amount || 0).toLocaleString('vi-VN')} VND`}
                </p>
              </div>
              <button onClick={() => handleCopy(amount?.toString())} className="text-gray-400 hover:text-blue-500 transition-colors p-2 opacity-0 group-hover:opacity-100">
                <Copy className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl flex items-center justify-between group">
              <div>
                <p className="text-sm text-blue-600 dark:text-blue-300 mb-1 font-medium">Transfer Content (Required)</p>
                <p className="font-mono text-lg font-bold text-gray-900 dark:text-white tracking-widest">{ADD_INFO}</p>
              </div>
              <button onClick={() => handleCopy(ADD_INFO)} className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition-colors p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                <Copy className="w-5 h-5" />
              </button>
            </div>
            
          </div>
        </div>
        
      </div>
    </div>
  );
}
