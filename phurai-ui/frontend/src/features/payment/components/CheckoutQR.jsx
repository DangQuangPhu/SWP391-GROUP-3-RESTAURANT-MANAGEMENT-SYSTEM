import { useState, useEffect } from 'react';
import { Copy, Clock, CreditCard, Banknote, User, Loader2 } from 'lucide-react';
import PaymentSuccess from './PaymentSuccess';
import PaymentFailed from './PaymentFailed';
import usePaymentPolling from '../hooks/usePaymentPolling';
import toast from 'react-hot-toast';

export default function CheckoutQR({ 
  orderId, amount, historyData, originalAmount, 
  voucherCode, setVoucherCode, appliedVoucher, applying, voucherError, onApplyVoucher,
  onComplete, onRetry 
}) {
  const [step, setStep] = useState('select'); // 'select' | 'sepay' | 'cash'
  const [selectedMethod, setSelectedMethod] = useState('sepay'); 
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const { status } = usePaymentPolling(orderId);
  const [showFailed, setShowFailed] = useState(false);
  const [cashLoading, setCashLoading] = useState(false);

  // Bank hardcoded info
  const BANK_ID = 'tpbank';
  const ACCOUNT_NO = '00003942326';
  const ACCOUNT_NAME = 'DANG QUANG PHU';
  const ADD_INFO = `DH${orderId || 1000}`; 

  useEffect(() => {
    if (step === 'sepay' || step === 'cash') {
      if (timeLeft <= 0) {
        if (status !== 'Paid' && status !== 'Completed') {
          setTimeout(() => {
            setShowFailed(true);
          }, 0);
        }
        return;
      }
      const timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeLeft, status, step]);

  if (status === 'Paid' || status === 'Completed') {
    return (
      <PaymentSuccess 
        orderId={orderId} 
        amount={amount} 
        originalAmount={originalAmount} 
        historyData={historyData} 
        onComplete={onComplete} 
      />
    );
  }

  if (showFailed) {
    return <PaymentFailed onRetry={onRetry} />;
  }

  const formatVND = (val) => new Intl.NumberFormat("vi-VN").format(val || 0) + ' VND';

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleConfirmMethod = async () => {
    if (selectedMethod === 'applepay' || selectedMethod === 'creditcard') {
      toast.error('This method is currently being updated. Please choose another.', { duration: 4000 });
      return;
    }
    
    if (selectedMethod === 'sepay') {
      setStep('sepay');
    } else if (selectedMethod === 'cash') {
      setCashLoading(true);
      try {
        const res = await fetch('/api/payments/cash-on-delivery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId })
        });
        const data = await res.json();
        if (data.success) {
          setStep('cash');
        } else {
          toast.error(data.message || 'Failed to request cash payment');
        }
      } catch (err) {
        console.error(err);
        toast.error('Network error');
      } finally {
        setCashLoading(false);
      }
    }
  };

  // Derive counts from historyData
  const preorders = historyData?.preorders?.filter(item => item.item_status !== 'Cancelled') || [];
  const sessionOrders = historyData?.sessionOrders?.filter(item => item.item_status !== 'Cancelled') || [];
  
  const preorderTotal = preorders.reduce((sum, item) => sum + item.line_total, 0);
  const sessionTotal = sessionOrders.reduce((sum, item) => sum + item.line_total, 0);
  const subtotal = preorderTotal + sessionTotal;
  const preorderDeposit = historyData?.summary?.prepaidDeposit || 0;
  const preorderRemaining = Math.max(0, preorderTotal - preorderDeposit);

  const renderBillingBreakdown = () => {
    return (
      <div className="bg-white rounded-2xl p-5 mb-6 shadow-sm border border-gray-100 text-left w-full">
        <h3 className="text-xs font-bold text-gray-800 mb-3 flex items-center gap-2 uppercase tracking-wider border-b pb-2">
          <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">🧾</span>
          INVOICE DETAILS
        </h3>
        
        <div className="flex flex-col gap-3 mb-4">
          {/* Preorders */}
          {preorders.length > 0 && (
            <div className="bg-emerald-50/40 rounded-xl p-3 border border-emerald-100/50">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-2">PRE-ORDERED ITEMS</p>
              {preorders.map((item, idx) => (
                <div key={idx} className="flex justify-between text-xs text-gray-600 mb-1 last:mb-0">
                  <span>{item.dish_name} <span className="text-gray-400">x{item.quantity}</span></span>
                  <span>{formatVND(item.line_total)}</span>
                </div>
              ))}
              {preorderDeposit > 0 && (
                <>
                  <div className="h-px bg-emerald-100/50 w-full my-2"></div>
                  <div className="flex justify-between text-[11px] font-semibold text-emerald-700">
                    <span>Preorder Deposit (30% Paid):</span>
                    <span>-{formatVND(preorderDeposit)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-gray-800 mt-0.5">
                    <span>Remaining Preorder Due (70%):</span>
                    <span>{formatVND(preorderRemaining)}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* QR Self/Dining Orders */}
          {sessionOrders.length > 0 && (
            <div className="bg-amber-50/40 rounded-xl p-3 border border-amber-100/50">
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-2">QR SELF ORDERS (DINING)</p>
              {sessionOrders.map((item, idx) => (
                <div key={idx} className="flex justify-between text-xs text-gray-600 mb-1 last:mb-0">
                  <span>{item.dish_name} <span className="text-gray-400">x{item.quantity}</span></span>
                  <span>{formatVND(item.line_total)}</span>
                </div>
              ))}
              <div className="h-px bg-amber-100/50 w-full my-2"></div>
              <div className="flex justify-between text-xs font-bold text-gray-850">
                <span>Unpaid Dining Due:</span>
                <span>{formatVND(sessionTotal)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Detailed cashflow lines */}
        <div className="pt-3 border-t border-gray-100 text-xs space-y-2">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal:</span>
            <span>{formatVND(subtotal)}</span>
          </div>
          {preorderDeposit > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Remain Deposit (70%):</span>
              <span>-{formatVND(preorderDeposit)}</span>
            </div>
          )}
          {appliedVoucher && (
            <div className="flex justify-between text-red-500">
              <span>Voucher Applied:</span>
              <span>-{formatVND(appliedVoucher.discount_amount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 font-bold text-sm text-gray-900">
            <span>Net Remaining Payment:</span>
            <span>{formatVND(amount)}</span>
          </div>
        </div>
      </div>
    );
  };

  const qrUrl = `https://qr.sepay.vn/img?bank=${BANK_ID}&acc=${ACCOUNT_NO}&template=&showinfo=true&holder=${encodeURIComponent(ACCOUNT_NAME)}&store=PHURAI%20RESTAURANT&amount=${amount}&des=${encodeURIComponent(ADD_INFO)}`;

  if (step === 'select') {
    return (
      <div className="min-h-screen bg-[#f7f8fa] flex flex-col items-center py-10 px-4">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Payment method</h2>
            <p className="text-gray-500 text-sm mt-1">Choose how you'd like to pay</p>
          </div>

          {/* Payment Methods */}
          <div className="space-y-3">
            {/* Apple Pay */}
            <div 
              onClick={() => setSelectedMethod('applepay')}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center bg-white ${selectedMethod === 'applepay' ? 'border-gray-900 shadow-md' : 'border-transparent hover:border-gray-200'}`}
            >
              <div className="w-12 h-8 flex items-center justify-center mr-4">
                <svg viewBox="0 0 384 512" className="h-6" fill="currentColor">
                  <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900">Apple Pay</p>
                <p className="text-xs text-gray-500">Fast & secure checkout</p>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedMethod === 'applepay' ? 'border-gray-900 bg-gray-900' : 'border-gray-300'}`}>
                {selectedMethod === 'applepay' && <div className="w-2.5 h-2.5 bg-gray-900 rounded-full"></div>}
              </div>
            </div>

            {/* Credit Card */}
            <div 
              onClick={() => setSelectedMethod('creditcard')}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center bg-white ${selectedMethod === 'creditcard' ? 'border-gray-900 shadow-md' : 'border-transparent hover:border-gray-200'}`}
            >
              <div className="w-12 h-8 bg-[#1434CB] rounded px-1 flex items-center justify-center mr-4">
                <svg viewBox="0 0 384 512" className="h-4 text-white" fill="currentColor">
                  <path d="M141.1 176l22.4-142.3h-47.5L93.7 176h47.4zm233.1-133.5c-11.7-5.5-30-11-53.7-11-55.7 0-94.8 29.5-95.2 71.8-.4 31.2 27.8 48.6 49 59.1 21.6 10.7 28.9 17.5 28.9 27.1-.1 14.8-17.8 21.6-34.3 21.6-22.9 0-35.1-3.5-50-10.4l-7.1-3.3-6.6 41c12.4 5.7 35.4 10.6 59.3 10.8 58.7 0 97.4-28.9 97.8-73.6 .4-24.5-16.7-43.1-47.4-57.8-19.5-10-31.2-16.6-31.1-26.7 .1-9.1 10.1-18.7 32.2-18.7 18 0 30.1 3.8 40.5 8.4l4.9 2.3 6.3-39.6zm-247.3 133.5h-45.7l-29-119.5c-4-15.6-16.3-20.9-30-22.8H0v8.6c11.9 2.5 25.3 6.7 33.6 11.2 5 2.7 6.4 5.3 8 11.9L73.2 176h49.6l75.3-142.3h-51.2l-40.4 99.8zm118.8 0h44.9l43-142.3h-44.9l-22.3 88.3-20.7-88.3z"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900">Credit / Debit card</p>
                <p className="text-xs text-gray-500">**** **** **** 4242</p>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedMethod === 'creditcard' ? 'border-gray-900 bg-gray-900' : 'border-gray-300'}`}>
                {selectedMethod === 'creditcard' && <div className="w-2.5 h-2.5 bg-gray-900 rounded-full"></div>}
              </div>
            </div>

            {/* TPBank / SePay */}
            <div 
              onClick={() => setSelectedMethod('sepay')}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center bg-white ${selectedMethod === 'sepay' ? 'border-gray-900 shadow-md' : 'border-transparent hover:border-gray-200'}`}
            >
              <div className="w-12 h-8 mr-4 flex items-center justify-center bg-purple-100 rounded text-purple-600">
                <CreditCard size={20} />
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900">TPBank via SePay</p>
                <p className="text-xs text-gray-500">Scan QR to pay</p>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedMethod === 'sepay' ? 'border-gray-900 bg-gray-900' : 'border-gray-300'}`}>
                {selectedMethod === 'sepay' && <div className="w-2.5 h-2.5 bg-white rounded-full"></div>}
              </div>
            </div>

            {/* Cash on Delivery */}
            <div 
              onClick={() => setSelectedMethod('cash')}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center bg-white ${selectedMethod === 'cash' ? 'border-gray-900 shadow-md' : 'border-transparent hover:border-gray-200'}`}
            >
              <div className="w-12 h-8 flex items-center justify-center mr-4 text-emerald-600 bg-emerald-50 rounded">
                <Banknote size={24} />
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900">Cash on delivery</p>
                <p className="text-xs text-gray-500">Staff will collect at table</p>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedMethod === 'cash' ? 'border-gray-900 bg-gray-900' : 'border-gray-300'}`}>
                {selectedMethod === 'cash' && <div className="w-2.5 h-2.5 bg-white rounded-full"></div>}
              </div>
            </div>
          </div>

          <button
            onClick={handleConfirmMethod}
            disabled={cashLoading}
            className="w-full bg-gray-900 hover:bg-black text-white font-bold py-4 px-4 rounded-xl transition-colors shadow-lg shadow-gray-900/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-8"
          >
            {cashLoading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Processing...
              </>
            ) : (
              "Confirm Payment Method"
            )}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'cash') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mb-6 relative">
            <div className="absolute inset-0 rounded-full border-4 border-amber-200 border-t-amber-500 animate-spin"></div>
            <Banknote className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Waiting for payment...</h2>
          <p className="text-gray-500 mb-6 leading-relaxed">
            Phūrai's staff is on the way to your table to assist with cash collection.
          </p>
          {renderBillingBreakdown()}
          <button onClick={() => setStep('select')} className="text-gray-500 font-medium hover:text-gray-900 mt-4">
            Go back to choose another method
          </button>
        </div>
      </div>
    );
  }

  // SePay QR Step
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl max-w-4xl w-full overflow-hidden max-h-[95vh] flex flex-col md:flex-row relative">
        
        {/* Back Button */}
        <button onClick={() => setStep('select')} className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-gray-600 hover:text-gray-900 z-10 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Left Column - QR Code */}
        <div className="md:w-1/2 p-8 pt-16 flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white border-r border-gray-100 overflow-y-auto">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Scan to Pay</h2>
          <p className="text-gray-500 mb-8 text-center text-sm">
            Use your banking app to scan this QR code
          </p>
          
          <div className="bg-white p-4 rounded-2xl shadow-lg border border-gray-100 mb-6">
            <img 
              src={qrUrl} 
              alt="VietQR Checkout" 
              className="w-64 h-64 object-contain"
            />
          </div>

          <div className="flex items-center gap-2 text-blue-600 font-medium">
            <Clock className="w-5 h-5 animate-pulse" />
            <span className="text-xl">{formatTime(timeLeft)}</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">waiting for payment</p>
        </div>

        {/* Right Column - Transfer Details */}
        <div className="md:w-1/2 p-8 pt-16 flex flex-col justify-start overflow-y-auto max-h-[95vh]">
          <h3 className="text-xl font-bold text-gray-800 mb-6 border-b border-gray-100 pb-4">
            Transfer Details
          </h3>
          {renderBillingBreakdown()}

          <div className="space-y-6">
            {/* Bank Name */}
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <Banknote className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Bank</p>
                  <p className="font-semibold text-gray-900">TPBank</p>
                </div>
              </div>
              <button onClick={() => handleCopy('TPBank')} className="text-gray-400 hover:text-blue-500 transition-colors p-2 opacity-0 group-hover:opacity-100">
                <Copy className="w-5 h-5" />
              </button>
            </div>

            {/* Account Number */}
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Account Number</p>
                  <p className="font-semibold text-gray-900 text-lg tracking-wider">{ACCOUNT_NO}</p>
                </div>
              </div>
              <button onClick={() => handleCopy(ACCOUNT_NO)} className="text-gray-400 hover:text-blue-500 transition-colors p-2 opacity-0 group-hover:opacity-100">
                <Copy className="w-5 h-5" />
              </button>
            </div>

            {/* Account Name */}
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <User className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Account Name</p>
                  <p className="font-semibold text-gray-900 uppercase">{ACCOUNT_NAME}</p>
                </div>
              </div>
              <button onClick={() => handleCopy(ACCOUNT_NAME)} className="text-gray-400 hover:text-blue-500 transition-colors p-2 opacity-0 group-hover:opacity-100">
                <Copy className="w-5 h-5" />
              </button>
            </div>

            {/* Promo / Voucher Section */}
            <div className="pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-500 mb-2">Promo Code</p>
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
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all font-mono text-gray-900 placeholder-gray-400"
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
                <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">
                        Code {appliedVoucher.code} applied
                      </p>
                      <p className="text-xs text-emerald-600">
                        Discount {`${Math.round(appliedVoucher.discount_amount).toLocaleString('vi-VN')} VND`}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Amount */}
            <div className="flex items-center justify-between group pt-4 border-t border-gray-100">
              <div>
                <p className="text-sm text-gray-500 mb-1">Payment Amount</p>
                {appliedVoucher && (
                  <p className="text-sm text-gray-400 line-through mb-0.5">
                    {`${Math.round(originalAmount || 0).toLocaleString('vi-VN')} VND`}
                  </p>
                )}
                <p className="text-3xl font-bold text-blue-600">
                  {`${Math.round(amount || 0).toLocaleString('vi-VN')} VND`}
                </p>
              </div>
              <button onClick={() => handleCopy(amount?.toString())} className="text-gray-400 hover:text-blue-500 transition-colors p-2 opacity-0 group-hover:opacity-100">
                <Copy className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="bg-blue-50 p-4 rounded-xl flex items-center justify-between group">
              <div>
                <p className="text-sm text-blue-600 mb-1 font-medium">Transfer Content (Required)</p>
                <p className="font-mono text-lg font-bold text-gray-900 tracking-widest">{ADD_INFO}</p>
              </div>
              <button onClick={() => handleCopy(ADD_INFO)} className="text-blue-500 hover:text-blue-700 transition-colors p-2 bg-white rounded-lg shadow-sm">
                <Copy className="w-5 h-5" />
              </button>
            </div>
            
          </div>
        </div>
        
      </div>
    </div>
  );
}
