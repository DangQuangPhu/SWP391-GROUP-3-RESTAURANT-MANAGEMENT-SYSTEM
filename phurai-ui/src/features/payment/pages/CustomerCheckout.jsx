import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Ticket } from 'lucide-react';
import CheckoutQR from '../components/CheckoutQR';
import usePaymentPolling from '../hooks/usePaymentPolling';
import { useTableSession } from '@/features/table-session';

export default function CustomerCheckout() {
  const { orderId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useTableSession();

  // Try to use location state first for instant loading
  const [amount, setAmount] = useState(location.state?.amount || null);
  const [originalAmount, setOriginalAmount] = useState(location.state?.amount || null);
  const [isLoading, setIsLoading] = useState(!location.state?.amount);
  
  // Voucher state
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [applying, setApplying] = useState(false);
  const [voucherError, setVoucherError] = useState('');
  
  const { status } = usePaymentPolling(orderId);

  // Fetch true amount from backend history API if not passed or just to verify
  useEffect(() => {
    async function fetchAmount() {
      if (!session?.token) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/public/qr-order/session/${session.token}/history`);
        const result = await res.json();
        if (result.success && result.data?.summary) {
          setAmount(result.data.summary.remainingToPay);
          setOriginalAmount(result.data.summary.remainingToPay);
        }
      } catch (err) {
        console.error("Failed to fetch session history for checkout amount", err);
      } finally {
        setIsLoading(false);
      }
    }
    
    if (amount === null || amount === 0) {
      fetchAmount();
    } else {
      setIsLoading(false);
    }
  }, [session, amount]);

  useEffect(() => {
    if (status === 'Paid') {
      alert("Payment Successful!");
      navigate(`/review/${orderId}`);
    }
  }, [status, orderId, navigate]);

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim() || !session?.token) return;
    setApplying(true);
    setVoucherError('');
    try {
      const res = await fetch(`/api/public/qr-order/session/${session.token}/apply-voucher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voucher_code: voucherCode.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setAmount(data.new_total);
        setAppliedVoucher({
          code: voucherCode.trim(),
          discount_amount: data.discount_amount
        });
      } else {
        setVoucherError(data.message || 'Invalid voucher');
      }
    } catch (err) {
      setVoucherError('Failed to apply voucher');
    } finally {
      setApplying(false);
    }
  };

  if (isLoading) {
      return (
          <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-500 font-medium">Fetching payment details...</p>
          </div>
      );
  }

  if (amount === null || amount === 0) {
      return (
          <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-center">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 text-3xl">⚠️</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid Payment Amount</h2>
              <p className="text-gray-500 mb-6 max-w-xs mx-auto">We could not verify the remaining amount for this order.</p>
              <button 
                  onClick={() => navigate(-1)}
                  className="px-6 py-2.5 bg-gray-900 text-white rounded-lg font-bold hover:bg-gray-800 transition-colors"
              >
                  Go Back
              </button>
          </div>
      );
  }

  return (
    <CheckoutQR
      orderId={orderId}
      amount={amount}
      originalAmount={originalAmount}
      voucherCode={voucherCode}
      setVoucherCode={setVoucherCode}
      appliedVoucher={appliedVoucher}
      applying={applying}
      voucherError={voucherError}
      onApplyVoucher={handleApplyVoucher}
      onComplete={() => {
        alert("Payment Successful!");
        navigate(`/review/${orderId}`);
      }}
      onRetry={() => {
        navigate(-1);
      }}
    />
  );
}
