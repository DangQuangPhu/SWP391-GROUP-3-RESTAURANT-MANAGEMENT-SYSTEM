import React, { useState, useEffect } from "react";

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // 24-hour format
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/**
 * Compact 2-column receipt ticket for Reservation Request Submitted.
 * Layout: Header (ID + status) + Grid (left: customer, right: booking details).
 * Rule: max-width 680px, font-size text-sm, no vertical stacking.
 */
function ReservationSuccessPanel({ reservation, onReturnHome, onViewReservation }) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (countdown <= 0) {
      onReturnHome();
      return;
    }
    const timer = setTimeout(() => {
      setCountdown(prev => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, onReturnHome]);

  if (!reservation) return null;

  const tables = reservation.tables || [];
  const start  = reservation.reservation_start_at;
  const end    = reservation.reservation_end_at;

  return (
    <div className="rzv-success" style={{ maxWidth: "680px", margin: "0 auto", width: "100%" }}>
      {/* Animated check icon */}
      <div className="rzv-success__check" aria-hidden>
        <svg viewBox="0 0 80 80">
          <circle className="rzv-success__check-ring" cx="40" cy="40" r="36" />
          <path className="rzv-success__check-mark" d="M24 41.5 L35 52 L57 29" />
        </svg>
      </div>

      <h1 className="rzv-success__title rzv-serif" style={{ fontSize: "1.4rem" }}>
        Reservation Confirmed!
      </h1>
      <p className="rzv-success__msg" style={{ fontSize: "0.875rem", marginBottom: "16px" }}>
        Thank you for choosing Phūrai. Your table is reserved — a confirmation email will be sent to you shortly.
      </p>

      {/* Elegant auto-redirect countdown badge */}
      <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#f8fafc", padding: "6px 14px", borderRadius: "999px", border: "1px solid #e2e8f0", marginBottom: "20px" }}>
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



      <style>{`
        .rzv-success-btn-container {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 16px;
          margin-top: 2.5rem;
          width: 100%;
          flex-wrap: wrap;
        }
        .rzv-btn-premium {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 14px 32px;
          font-size: 0.95rem;
          font-weight: 600;
          letter-spacing: 0.5px;
          border-radius: 999px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          min-width: 220px;
          text-transform: uppercase;
        }
        .rzv-btn-premium-outline {
          background: transparent;
          border: 2px solid #111;
          color: #111;
        }
        .rzv-btn-premium-outline:hover {
          background: #111;
          color: #fff;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        .rzv-btn-premium-solid {
          background: var(--rzv-gold, #b89467);
          border: 2px solid var(--rzv-gold, #b89467);
          color: #fff;
          box-shadow: 0 4px 14px rgba(184, 148, 103, 0.3);
        }
        .rzv-btn-premium-solid:hover {
          background: #a38056;
          border-color: #a38056;
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(184, 148, 103, 0.4);
        }
        .pulse-dot {
          animation: pulse-ring 1.5s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite;
        }
        @keyframes pulse-ring {
          0% {
            transform: scale(0.8);
            box-shadow: 0 0 0 0 rgba(184, 148, 103, 0.7);
          }
          70% {
            transform: scale(1.1);
            box-shadow: 0 0 0 6px rgba(184, 148, 103, 0);
          }
          100% {
            transform: scale(0.8);
            box-shadow: 0 0 0 0 rgba(184, 148, 103, 0);
          }
        }
        @media (max-width: 640px) {
          .rzv-success-btn-container {
            flex-direction: column;
            gap: 12px;
          }
          .rzv-btn-premium {
            width: 100%;
          }
        }
      `}</style>

      <div className="rzv-success-btn-container">
        <button type="button" className="rzv-btn-premium rzv-btn-premium-outline" onClick={onReturnHome}>
          Back to Home
        </button>
        <button type="button" className="rzv-btn-premium rzv-btn-premium-solid" onClick={onViewReservation}>
          Check your reservation
        </button>
      </div>
    </div>
  );
}

/* ── Tiny label/value row helper ── */
function Row({ label, value, mono, accent }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "baseline" }}>
      <span style={{ color: "var(--sfx-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>{label}:</span>
      <span
        className={mono ? "sfx-mono" : ""}
        style={{
          fontWeight: 500,
          textAlign: "right",
          color: accent ? "var(--sfx-gold)" : "inherit",
          wordBreak: "break-word",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default ReservationSuccessPanel;
