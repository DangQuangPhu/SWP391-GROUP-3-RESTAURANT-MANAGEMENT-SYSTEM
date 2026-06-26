import React, { useState, useEffect } from "react";
import { Star, CheckCircle } from "lucide-react";
import { submitReview } from "../services/reservationApi.js";
import "@/styles/reservations/ReservationSuccessPanel.css";

const QUICK_NOTES = [
  "The service is nice",
  "Delicious food",
  "Great atmosphere",
  "Fast checkout",
  "Very clean"
];

function ReservationSuccessPanel({ reservation, onReturnHome, onViewReservation }) {
  const [countdown, setCountdown] = useState(5);
  const [hasRated, setHasRated] = useState(false);
  
  // Rating states
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showThankYouAnim, setShowThankYouAnim] = useState(false);

  useEffect(() => {
    // Only start countdown AFTER user has rated or skipped
    if (!hasRated) return;

    if (countdown <= 0) {
      onReturnHome();
      return;
    }
    const timer = setTimeout(() => {
      setCountdown(prev => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, hasRated, onReturnHome]);

  const handleQuickNote = (note) => {
    if (notes.includes(note)) return;
    setNotes(prev => prev ? `${prev}, ${note}` : note);
  };

  const handleRatingSubmit = async () => {
    if (rating === 0) return;
    setIsSubmitting(true);
    try {
      // If there is no user logged in, userId is undefined, that's fine.
      await submitReview(reservation.reservation_id, { rating, notes });
      
      setShowThankYouAnim(true);
      setTimeout(() => {
        setHasRated(true); // This starts the 5s countdown
      }, 1500); // Wait 1.5s to show the thank you animation before showing countdown
    } catch (error) {
      console.error("Failed to submit review:", error);
      // Even if it fails, we let them proceed
      setHasRated(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    setHasRated(true);
  };

  if (!reservation) return null;

  return (
    <div className="rzv-success" style={{ maxWidth: "680px", margin: "0 auto", width: "100%", textAlign: "center" }}>
      {/* Animated check icon */}
      <div className="rzv-success__check" aria-hidden style={{ margin: "0 auto" }}>
        <svg viewBox="0 0 80 80">
          <circle className="rzv-success__check-ring" cx="40" cy="40" r="36" />
          <path className="rzv-success__check-mark" d="M24 41.5 L35 52 L57 29" />
        </svg>
      </div>

      <h1 className="rzv-success__title rzv-serif" style={{ fontSize: "1.4rem", marginTop: "1rem" }}>
        Reservation Confirmed!
      </h1>
      <p className="rzv-success__msg" style={{ fontSize: "0.875rem", marginBottom: "16px", color: "#64748b" }}>
        Thank you for choosing Phūrai. Your table is reserved — a confirmation email will be sent to you shortly.
      </p>

      {/* RATING SECTION */}
      {!hasRated && !showThankYouAnim && (
        <div className="rating-card" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "24px", marginTop: "32px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "16px", color: "#1e293b" }}>How was your booking experience?</h3>
          
          <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "20px" }}>
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                type="button"
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(star)}
                style={{ background: "none", border: "none", cursor: "pointer", transition: "transform 0.2s" }}
                className="hover:scale-110"
              >
                <Star
                  size={36}
                  fill={(hoverRating || rating) >= star ? "#eab308" : "transparent"}
                  color={(hoverRating || rating) >= star ? "#eab308" : "#cbd5e1"}
                />
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center", marginBottom: "16px" }}>
            {QUICK_NOTES.map(note => (
              <button
                key={note}
                type="button"
                onClick={() => handleQuickNote(note)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "999px",
                  fontSize: "0.8rem",
                  background: notes.includes(note) ? "#fef3c7" : "#f1f5f9",
                  color: notes.includes(note) ? "#b45309" : "#475569",
                  border: `1px solid ${notes.includes(note) ? "#fde68a" : "#e2e8f0"}`,
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                {note}
              </button>
            ))}
          </div>

          <textarea
            placeholder="Tell us more about your experience... (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ width: "100%", height: "80px", padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.875rem", resize: "none", marginBottom: "16px" }}
          />

          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button 
              type="button" 
              onClick={handleSkip}
              style={{ padding: "10px 24px", borderRadius: "8px", fontSize: "0.9rem", fontWeight: "500", color: "#64748b", background: "transparent", border: "1px solid #e2e8f0", cursor: "pointer" }}
            >
              Skip
            </button>
            <button 
              type="button" 
              disabled={rating === 0 || isSubmitting}
              onClick={handleRatingSubmit}
              style={{ padding: "10px 24px", borderRadius: "8px", fontSize: "0.9rem", fontWeight: "600", color: "#fff", background: rating > 0 ? "var(--rzv-gold, #b89467)" : "#cbd5e1", border: "none", cursor: rating > 0 ? "pointer" : "not-allowed", transition: "all 0.2s" }}
            >
              {isSubmitting ? "Submitting..." : "Submit Feedback"}
            </button>
          </div>
        </div>
      )}

      {/* THANK YOU ANIMATION */}
      {showThankYouAnim && !hasRated && (
        <div style={{ marginTop: "32px", padding: "32px", animation: "fade-in-up 0.5s ease-out forwards" }}>
          <CheckCircle size={64} color="#10b981" style={{ margin: "0 auto", marginBottom: "16px", animation: "scale-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards" }} />
          <h3 style={{ fontSize: "1.25rem", fontWeight: "600", color: "#0f172a" }}>Thank you for your feedback!</h3>
        </div>
      )}

      {/* Elegant auto-redirect countdown badge (ONLY shows after rating or skipping) */}
      {hasRated && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#f8fafc", padding: "6px 14px", borderRadius: "999px", border: "1px solid #e2e8f0", marginBottom: "20px", marginTop: "24px" }}>
          <span className="pulse-dot" style={{ 
            width: "8px", 
            height: "8px", 
            borderRadius: "50%", 
            background: "var(--rzv-gold, #b89467)", 
            display: "inline-block"
          }} />
          <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "#64748b" }}>
            Redirecting to home page in <strong style={{ color: "#111" }}>{countdown}s</strong>
          </span>
        </div>
      )}


      {hasRated && (
        <div className="rzv-success-btn-container">
          <button type="button" className="rzv-btn-premium rzv-btn-premium-outline" onClick={onReturnHome}>
            Back to Home
          </button>
          <button type="button" className="rzv-btn-premium rzv-btn-premium-solid" onClick={onViewReservation}>
            Check your reservation
          </button>
        </div>
      )}
    </div>
  );
}

export default ReservationSuccessPanel;
