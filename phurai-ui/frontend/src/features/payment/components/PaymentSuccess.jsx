import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, MessageSquare, ArrowRight, ArrowLeft, Receipt, Award } from 'lucide-react';
import toast from 'react-hot-toast';
import "@/features/reservations/styles/ReservationSuccessPanel.css"; // Reuse buttons and pulse dot styles

export default function PaymentSuccess({ orderId, amount, historyData, onComplete }) {
  const [step, setStep] = useState('processing'); // 'processing' -> 'invoice' -> 'rating-food' -> 'rating-service' -> 'rating-ambiance' -> 'comment' -> 'finished'
  const [processingStep, setProcessingStep] = useState(0);
  const [foodRating, setFoodRating] = useState(0);
  const [serviceRating, setServiceRating] = useState(0);
  const [ambianceRating, setAmbianceRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Auto transition from processing to success/invoice screen, then auto transition to rating
  useEffect(() => {
    if (step === 'processing') {
      const t1 = setTimeout(() => {
        setProcessingStep(1);
      }, 1200);
      
      const t2 = setTimeout(() => {
        setProcessingStep(2);
      }, 2400);
      
      const t3 = setTimeout(() => {
        setProcessingStep(3);
        setStep('invoice');
      }, 3500);
      
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
    if (step === 'invoice') {
      toast.success("Cảm ơn bạn! Bàn sẽ được dọn dẹp sau ít phút.", { id: "payment-success-msg" });
      const timer = setTimeout(() => {
        setStep('rating-food');
      }, 3500); // 3.5 seconds to read receipt
      return () => clearTimeout(timer);
    }
  }, [step]);

  const handleStarClick = (rating, setter, nextStep) => {
    setter(rating);
    setTimeout(() => {
      setStep(nextStep);
    }, 250);
  };

  const handleSubmitReview = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/reviews/${orderId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          foodRating,
          serviceRating,
          ambianceRating,
          notes: comment
        })
      });
      const data = await res.json();
      if (data.success) {
        setStep('finished');
      } else {
        toast.error(data.message || 'Failed to submit review');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error. Failed to save review.');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper formatting currency
  const formatVND = (val) => new Intl.NumberFormat("vi-VN").format(val || 0) + ' VND';

  // Derive invoice data from historyData
  const preorders = historyData?.preorders?.filter(item => item.item_status !== 'Cancelled') || [];
  const sessionOrders = historyData?.sessionOrders?.filter(item => item.item_status !== 'Cancelled') || [];
  
  const preorderTotal = preorders.reduce((sum, item) => sum + item.line_total, 0);
  const sessionTotal = sessionOrders.reduce((sum, item) => sum + item.line_total, 0);
  const subtotal = preorderTotal + sessionTotal;

  const preorderDeposit = historyData?.summary?.prepaidDeposit || 0;
  const discountAmount = historyData?.summary?.discountAmount || 0;
  const netPaid = amount || (subtotal - preorderDeposit - discountAmount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#fdfcfa]/90 dark:bg-gray-900/95 overflow-y-auto px-4 py-8">
      {/* Embedded CSS for animated checkmark and layouts */}
      <style>{`
        .checkout-success-wrapper {
          max-width: 580px;
          width: 100%;
          background: #ffffff;
          border: 1px solid #e8e3d9;
          border-radius: 28px;
          box-shadow: 0 20px 50px rgba(44, 29, 10, 0.08);
          padding: 40px 32px;
          text-align: center;
        }
        .chk-check {
          width: 80px;
          height: 80px;
          margin: 0 auto 20px;
        }
        .chk-check svg {
          width: 100%;
          height: 100%;
        }
        .chk-check-ring {
          fill: none;
          stroke: #10b981;
          stroke-width: 3;
          opacity: 0.3;
          stroke-dasharray: 226;
          stroke-dashoffset: 226;
          animation: chkRingAnim 0.8s ease forwards;
        }
        .chk-check-mark {
          fill: none;
          stroke: #10b981;
          stroke-width: 5;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 70;
          stroke-dashoffset: 70;
          animation: chkMarkAnim 0.5s 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
        }
        @keyframes chkRingAnim {
          to { stroke-dashoffset: 0; }
        }
        @keyframes chkMarkAnim {
          to { stroke-dashoffset: 0; }
        }
        .invoice-card {
          background: #faf9f6;
          border: 1px solid #efebe4;
          border-radius: 18px;
          padding: 20px;
          margin: 20px 0;
          text-align: left;
        }
        .invoice-item-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.9rem;
          color: #4a3f35;
          padding: 8px 0;
          border-bottom: 1px dashed #efebe4;
        }
        .invoice-item-row:last-child {
          border-bottom: none;
        }
        .cashflow-breakdown {
          margin-top: 15px;
          border-top: 2px solid #e8e3d9;
          padding-top: 12px;
        }
        .cashflow-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.95rem;
          padding: 6px 0;
        }
        .cashflow-row.total {
          font-size: 1.15rem;
          font-weight: 700;
          color: #10b981;
          border-top: 1px dashed #e8e3d9;
          padding-top: 10px;
          margin-top: 6px;
        }
        @media (prefers-reduced-motion: reduce) {
          .chk-check-ring {
            stroke-dashoffset: 0;
            animation: none !important;
          }
          .chk-check-mark {
            stroke-dashoffset: 0;
            animation: none !important;
          }
          .invoice-card, .payment-state-screen, .checkout-success-wrapper {
            transition: none !important;
            animation: none !important;
          }
        }
      `}</style>

      <div className="checkout-success-wrapper max-h-[90vh] overflow-y-auto">
        <AnimatePresence mode="wait">
          
          {/* STEP: PROCESSING */}
          {step === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center py-8 text-center"
            >
              <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-8 shadow-sm"></div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Verifying Payment</h3>
              
              <div className="w-full max-w-sm bg-gray-50 border border-gray-100 rounded-2xl p-5 text-left space-y-4 shadow-inner">
                {/* Step 1: Check Content */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 font-medium">1. Checking transfer content</span>
                  {processingStep === 0 ? (
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <span className="text-green-500 font-bold flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Matched
                    </span>
                  )}
                </div>

                {/* Step 2: Check Amount */}
                <div className="flex items-center justify-between text-sm border-t border-gray-150 pt-3">
                  <span className={`${processingStep < 1 ? 'text-gray-450' : 'text-gray-650'} font-medium`}>
                    2. Verifying order total amount
                  </span>
                  {processingStep === 0 ? (
                    <span className="text-gray-300 font-mono text-xs">Waiting...</span>
                  ) : processingStep === 1 ? (
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <span className="text-green-500 font-bold flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Matched
                    </span>
                  )}
                </div>

                {/* Step 3: Finalize DB */}
                <div className="flex items-center justify-between text-sm border-t border-gray-150 pt-3">
                  <span className={`${processingStep < 2 ? 'text-gray-450' : 'text-gray-650'} font-medium`}>
                    3. Finalizing order status
                  </span>
                  {processingStep < 2 ? (
                    <span className="text-gray-300 font-mono text-xs">Waiting...</span>
                  ) : processingStep === 2 ? (
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <span className="text-green-500 font-bold flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Done
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP: INVOICE / SUCCESS OVERVIEW */}
          {step === 'invoice' && (
            <motion.div
              key="invoice"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="w-full flex flex-col"
            >
              {/* Checkmark Animation */}
              <div className="chk-check">
                <svg viewBox="0 0 80 80">
                  <circle className="chk-check-ring" cx="40" cy="40" r="36" />
                  <path className="chk-check-mark" d="M24 41.5 L35 52 L57 29" />
                </svg>
              </div>

              <h2 className="text-2xl font-bold text-gray-850 mb-1">Payment Successful!</h2>
              <p className="text-sm text-gray-500 mb-4">Your order reference: <span className="font-mono font-semibold">#ORD{orderId}</span></p>

              {/* Invoice Table copied from Reservation style */}
              <div className="invoice-card">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-1.5 border-b pb-2">
                  <Receipt size={18} className="text-[#b89467]" /> Billing Summary
                </h3>

                {/* Preorder Items */}
                {preorders.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">Preordered Items</h4>
                    {preorders.map((item, idx) => (
                      <div className="invoice-item-row" key={`pre-${idx}`}>
                        <span>{item.dish_name} <span className="text-gray-400">x{item.quantity}</span></span>
                        <span>{formatVND(item.line_total)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Session/Dining Items */}
                {sessionOrders.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Dining Items</h4>
                    {sessionOrders.map((item, idx) => (
                      <div className="invoice-item-row" key={`sess-${idx}`}>
                        <span>{item.dish_name} <span className="text-gray-400">x{item.quantity}</span></span>
                        <span>{formatVND(item.line_total)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Cashflow cash lines */}
                <div className="cashflow-breakdown">
                  <div className="cashflow-row text-gray-600">
                    <span>Order Subtotal:</span>
                    <span>{formatVND(subtotal)}</span>
                  </div>

                  {preorderDeposit > 0 && (
                    <div className="cashflow-row text-gray-600">
                      <span>Remain Deposit (70%):</span>
                      <span className="text-red-500">-{formatVND(preorderDeposit)}</span>
                    </div>
                  )}

                  {discountAmount > 0 && (
                    <div className="cashflow-row text-gray-600">
                      <span>Voucher Discount:</span>
                      <span className="text-red-500">-{formatVND(discountAmount)}</span>
                    </div>
                  )}

                  <div className="cashflow-row total">
                    <span>Net Paid Amount:</span>
                    <span>{formatVND(netPaid)}</span>
                  </div>
                </div>
              </div>

              {/* CTA to start the rating steps */}
              <button
                onClick={() => setStep('rating-food')}
                className="w-full bg-[#b89467] hover:bg-[#a38056] text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 shadow-md shadow-amber-500/10 flex items-center justify-center gap-2 mt-4"
              >
                Continue to Rating & Feedback
                <ArrowRight size={18} />
              </button>
            </motion.div>
          )}

          {/* RATING STEPS */}
          {/* STEP 1: FOOD */}
          {step === 'rating-food' && (
            <motion.div
              key="rating-food"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="flex flex-col items-center w-full"
            >
              <span className="text-5xl mb-4">🍔</span>
              <span className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">Step 1 of 3</span>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Rate the Food</h3>
              <p className="text-sm text-gray-500 max-w-xs">How was the taste and presentation of your meal?</p>
              
              <div className="flex justify-center gap-3 my-8">
                {[1, 2, 3, 4, 5].map((star) => (
                  <motion.button
                    key={star}
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleStarClick(star, setFoodRating, 'rating-service')}
                    className="focus:outline-none"
                  >
                    <Star
                      size={44}
                      className={`transition-colors duration-150 ${star <= foodRating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                    />
                  </motion.button>
                ))}
              </div>

              <div className="flex w-full justify-between items-center mt-6">
                <button onClick={() => setStep('invoice')} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors">
                  <ArrowLeft size={16} /> Back
                </button>
                <button 
                  onClick={() => setStep('rating-service')}
                  disabled={foodRating === 0}
                  className="flex items-center gap-1 text-sm font-semibold text-amber-600 disabled:opacity-40"
                >
                  Next <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 2: SERVICE */}
          {step === 'rating-service' && (
            <motion.div
              key="rating-service"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="flex flex-col items-center w-full"
            >
              <span className="text-5xl mb-4">💁</span>
              <span className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">Step 2 of 3</span>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Rate the Service</h3>
              <p className="text-sm text-gray-500 max-w-xs">Was our staff attentive, friendly, and quick?</p>
              
              <div className="flex justify-center gap-3 my-8">
                {[1, 2, 3, 4, 5].map((star) => (
                  <motion.button
                    key={star}
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleStarClick(star, setServiceRating, 'rating-ambiance')}
                    className="focus:outline-none"
                  >
                    <Star
                      size={44}
                      className={`transition-colors duration-150 ${star <= serviceRating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                    />
                  </motion.button>
                ))}
              </div>

              <div className="flex w-full justify-between items-center mt-6">
                <button onClick={() => setStep('rating-food')} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors">
                  <ArrowLeft size={16} /> Back
                </button>
                <button 
                  onClick={() => setStep('rating-ambiance')}
                  disabled={serviceRating === 0}
                  className="flex items-center gap-1 text-sm font-semibold text-amber-600 disabled:opacity-40"
                >
                  Next <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: AMBIANCE */}
          {step === 'rating-ambiance' && (
            <motion.div
              key="rating-ambiance"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="flex flex-col items-center w-full"
            >
              <span className="text-5xl mb-4">✨</span>
              <span className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">Step 3 of 3</span>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Rate the Ambiance</h3>
              <p className="text-sm text-gray-500 max-w-xs">How did you like the atmosphere and cleanliness?</p>
              
              <div className="flex justify-center gap-3 my-8">
                {[1, 2, 3, 4, 5].map((star) => (
                  <motion.button
                    key={star}
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleStarClick(star, setAmbianceRating, 'comment')}
                    className="focus:outline-none"
                  >
                    <Star
                      size={44}
                      className={`transition-colors duration-150 ${star <= ambianceRating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                    />
                  </motion.button>
                ))}
              </div>

              <div className="flex w-full justify-between items-center mt-6">
                <button onClick={() => setStep('rating-service')} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors">
                  <ArrowLeft size={16} /> Back
                </button>
                <button 
                  onClick={() => setStep('comment')}
                  disabled={ambianceRating === 0}
                  className="flex items-center gap-1 text-sm font-semibold text-amber-600 disabled:opacity-40"
                >
                  Next <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP: COMMENTS */}
          {step === 'comment' && (
            <motion.div
              key="comment"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center w-full"
            >
              <MessageSquare className="w-12 h-12 text-[#b89467] mb-3" />
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Additional Comments</h3>
              <p className="text-xs text-gray-500 mb-4">Let us know how we can make your next visit even better.</p>
              
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your thoughts here... (optional)"
                rows={4}
                className="w-full p-4 bg-gray-50 border border-[#e8e3d9] rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#b89467] focus:border-transparent text-gray-800 placeholder-gray-400 resize-none mb-4"
              />

              <button
                onClick={handleSubmitReview}
                disabled={submitting}
                className="w-full bg-[#b89467] hover:bg-[#a38056] text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Feedback'}
              </button>

              <div className="flex w-full justify-between items-center mt-4">
                <button onClick={() => setStep('rating-ambiance')} className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1">
                  <ArrowLeft size={14} /> Back
                </button>
                <button 
                  onClick={handleSubmitReview}
                  disabled={submitting}
                  className="text-xs font-semibold text-[#b89467] hover:text-[#a38056] transition-colors"
                >
                  Skip & Submit
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP: FINISHED (THANK YOU CARD WITH GREEN CHECKMARK ANIMATION) */}
          {step === 'finished' && (
            <motion.div
              key="finished"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center py-6 w-full"
            >
              {/* Green Check Animation */}
              <div className="chk-check">
                <svg viewBox="0 0 80 80">
                  <circle className="chk-check-ring" cx="40" cy="40" r="36" />
                  <path className="chk-check-mark" d="M24 41.5 L35 52 L57 29" />
                </svg>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
              
              <div className="my-4 p-5 bg-amber-50/50 rounded-2xl border border-amber-100 flex flex-col items-center w-full">
                <div className="flex items-center gap-2 text-amber-700 font-bold text-lg mb-1">
                  <Award className="text-amber-500" />
                  <span>+200 Loyalty Points Awarded!</span>
                </div>
                <p className="text-xs text-amber-600/90 text-center">Bonus points successfully added to your profile.</p>
              </div>

              <div className="text-gray-600 text-sm leading-relaxed mb-8 max-w-sm text-center">
                <p className="mb-3 font-semibold">Dear Guest,</p>
                <p className="italic">
                  "Thank you for trusting and using our service at Phūrai! We appreciate your feedback and look forward to welcoming you back soon."
                </p>
              </div>

              <button
                onClick={onComplete}
                className="w-full bg-[#111] hover:bg-[#222] text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 shadow-md shadow-gray-900/10"
              >
                Return to Homepage
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
