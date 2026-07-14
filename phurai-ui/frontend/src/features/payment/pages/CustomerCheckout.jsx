import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import CheckoutQR from '../components/CheckoutQR';
import CustomerReviewModal from '../../reviews/CustomerReviewModal';
import usePaymentPolling from '../hooks/usePaymentPolling';
import { useTableSession } from '@/features/table-session';
import { useAuth } from '@/features/auth/context/AuthContext';
import { getMyVouchers, applyVoucher } from '@/features/loyalty/services/loyaltyApi.js';

export default function CustomerCheckout() {
  const { orderId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useTableSession();
  const { currentUser } = useAuth();
  const userId = currentUser?.user_id || currentUser?.userId || currentUser?.id;

  // Try to use location state first for instant loading
  const [amount, setAmount] = useState(location.state?.amount || null);
  const [isLoading, setIsLoading] = useState(!location.state?.amount);

  const { status } = usePaymentPolling(orderId);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Voucher states
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [applying, setApplying] = useState(false);
  const [voucherError, setVoucherError] = useState('');
  const [originalAmount, setOriginalAmount] = useState(null);
  const [myActiveVouchers, setMyActiveVouchers] = useState([]);

  // Fetch active vouchers for the user
  useEffect(() => {
    async function fetchVouchers() {
      if (!userId) return;
      try {
        const res = await getMyVouchers(userId, 'active');
        if (res?.success) {
          setMyActiveVouchers(res.vouchers || []);
        }
      } catch (err) {
        console.error("Failed to fetch customer vouchers for checkout:", err);
      }
    }
    fetchVouchers();
  }, [userId]);

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
    if (status === 'Paid' && !showReviewModal) {
      setShowReviewModal(true);
    }
  }, [status, showReviewModal]);

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim() || !userId) return;
    setApplying(true);
    setVoucherError('');
    try {
      const match = myActiveVouchers.find(
        (v) => v.voucher_code.toUpperCase() === voucherCode.toUpperCase().trim()
      );
      if (!match) {
        setVoucherError('Voucher code not found in your wallet. Redeem it first!');
        setApplying(false);
        return;
      }

      const res = await applyVoucher(userId, {
        customerVoucherId: match.customer_voucher_id,
        orderId: Number(orderId)
      });

      if (res?.success) {
        setAppliedVoucher({
          code: match.voucher_code,
          discount_amount: res.discountAmount
        });
        setOriginalAmount(amount);
        setAmount(res.newTotalAmount);
      } else {
        setVoucherError(res?.message || 'Failed to apply voucher.');
      }
    } catch (err) {
      setVoucherError(err?.message || 'Error applying voucher.');
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
    <>
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
          setShowReviewModal(true);
        }}
        onRetry={() => {
          navigate(-1);
        }}
      />
      <CustomerReviewModal 
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        orderId={orderId}
        customerId={userId}
        reservationId={session?.reservation_id || null}
        onSubmitted={() => {
          navigate('/'); // Return home or to orders list after rating
        }}
      />
    </>
  );
}
