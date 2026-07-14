import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, CheckCircle, X } from 'lucide-react';

export default function CustomerReviewModal({ isOpen, onClose, orderId, customerId, reservationId, onSubmitted }) {
  const [ratings, setRatings] = useState({
    food: 0,
    service: 0,
    ambiance: 0
  });
  const [hoverRatings, setHoverRatings] = useState({
    food: 0,
    service: 0,
    ambiance: 0
  });
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleRating = (category, value) => {
    setRatings(prev => ({ ...prev, [category]: value }));
  };

  const handleHover = (category, value) => {
    setHoverRatings(prev => ({ ...prev, [category]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ratings.food || !ratings.service || !ratings.ambiance) {
      setError('Please provide ratings for all categories (Food, Service, Ambiance).');
      return;
    }
    
    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/reviews/submit/${orderId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          food_rating: ratings.food,
          service_rating: ratings.service,
          ambiance_rating: ratings.ambiance,
          comment,
          customer_id: customerId,
          reservation_id: reservationId
        })
      });
      const data = await res.json();
      
      if (data.success) {
        setSubmitted(true);
      } else {
        setError(data.message || 'Failed to submit review. Please try again.');
      }
    } catch (err) {
      setError('Network error while submitting review.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStars = (category) => {
    return (
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => handleRating(category, star)}
            onMouseEnter={() => handleHover(category, star)}
            onMouseLeave={() => handleHover(category, 0)}
            className="focus:outline-none transition-transform hover:scale-110"
          >
            <Star 
              size={32}
              className={`transition-colors duration-200 ${(hoverRatings[category] || ratings[category]) >= star ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`} 
            />
          </button>
        ))}
      </div>
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 max-w-md w-full relative"
        >
          {submitted ? (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={40} className="text-emerald-500" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Thank You!</h2>
              <p className="text-gray-500 text-lg mb-8">Your feedback helps us improve and serve you better.</p>
              <button 
                onClick={() => {
                  onClose();
                  if (onSubmitted) onSubmitted();
                }}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 px-6 rounded-xl transition-colors shadow-lg shadow-emerald-500/30"
              >
                Close & Return
              </button>
            </div>
          ) : (
            <>
              {!isSubmitting && (
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              )}
              
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-1">How was your experience?</h2>
                <p className="text-gray-500 text-sm">Please rate your meal with us</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-2">
                    <span className="font-semibold text-gray-700">Food Quality</span>
                    {renderStars('food')}
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <span className="font-semibold text-gray-700">Service</span>
                    {renderStars('service')}
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <span className="font-semibold text-gray-700">Ambiance</span>
                    {renderStars('ambiance')}
                  </div>
                </div>

                <div className="pt-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Additional Comments (Optional)</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Tell us what you loved or what we can improve..."
                    rows="3"
                    className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none transition-all"
                  ></textarea>
                </div>

                {error && (
                  <div className="text-red-500 text-sm text-center font-medium bg-red-50 p-3 rounded-xl border border-red-100">
                    {error}
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-70 disabled:hover:bg-amber-500 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg shadow-amber-500/30 flex justify-center items-center gap-2"
                >
                  {isSubmitting ? (
                    <span className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                  ) : (
                    'Submit Review'
                  )}
                </button>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
