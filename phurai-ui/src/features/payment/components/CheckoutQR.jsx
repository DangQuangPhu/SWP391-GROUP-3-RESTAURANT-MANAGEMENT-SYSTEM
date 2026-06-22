import React, { useState, useEffect } from 'react';
import { Copy, Clock, CreditCard, Banknote, User } from 'lucide-react';
import PaymentSuccess from './PaymentSuccess';
import PaymentFailed from './PaymentFailed';
import usePaymentPolling from '../hooks/usePaymentPolling';

export default function CheckoutQR({ orderId, amount, onComplete, onRetry }) {
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
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Quét mã thanh toán</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 text-center text-sm">
            Sử dụng ứng dụng ngân hàng để quét mã QR này
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
          <p className="text-xs text-gray-400 mt-1">thời gian chờ thanh toán</p>
        </div>

        {/* Right Column - Transfer Details */}
        <div className="md:w-1/2 p-8 flex flex-col justify-center">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
            Thông tin chuyển khoản
          </h3>

          <div className="space-y-6">
            {/* Bank Name */}
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Banknote className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Ngân hàng</p>
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
                  <p className="text-sm text-gray-500 dark:text-gray-400">Số tài khoản</p>
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
                  <p className="text-sm text-gray-500 dark:text-gray-400">Chủ tài khoản</p>
                  <p className="font-semibold text-gray-900 dark:text-white uppercase">{ACCOUNT_NAME}</p>
                </div>
              </div>
              <button onClick={() => handleCopy(ACCOUNT_NAME)} className="text-gray-400 hover:text-blue-500 transition-colors p-2 opacity-0 group-hover:opacity-100">
                <Copy className="w-5 h-5" />
              </button>
            </div>

            {/* Amount */}
            <div className="flex items-center justify-between group pt-4 border-t border-gray-100 dark:border-gray-700">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Số tiền thanh toán</p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0)}
                </p>
              </div>
              <button onClick={() => handleCopy(amount?.toString())} className="text-gray-400 hover:text-blue-500 transition-colors p-2 opacity-0 group-hover:opacity-100">
                <Copy className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl flex items-center justify-between group">
              <div>
                <p className="text-sm text-blue-600 dark:text-blue-300 mb-1 font-medium">Nội dung chuyển khoản (Bắt buộc)</p>
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
