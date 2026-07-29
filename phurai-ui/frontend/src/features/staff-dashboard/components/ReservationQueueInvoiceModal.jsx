import React from "react";
import { createPortal } from "react-dom";
import "../styles/reservation-queue.css";

export default function ReservationQueueInvoiceModal({ item, showPhone = true, onClose }) {
  if (!item) return null;

  const statusSlug = (item.reservation_status || "").toLowerCase().replace(/[^a-z]/g, "");
  const isPreference = Boolean(item.is_preference || String(item.table_assignment_status || "").toLowerCase() === "preferred");

  return createPortal(
    <div className="rq-modal-backdrop apple-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="rq-modal-card apple-modal-card" onClick={(e) => e.stopPropagation()}>
        <header className="rq-modal-header">
          <div className="rq-modal-subhead">Official Voucher</div>
          <div className="rq-modal-title">
            <span>Reservation Invoice</span>
            <span className="rq-modal-res-badge">#{item.reservation_id}</span>
          </div>
          <button className="rq-modal-close-btn" onClick={onClose} type="button" aria-label="Close">
            ✕
          </button>
        </header>

        <div className="rq-modal-body">
          <div className="rq-modal-grid">
            <div className="rq-field-group">
              <span className="rq-field-label">Customer Name</span>
              <span className="rq-field-value">{item.contact_name || "Guest"}</span>
            </div>

            {showPhone && (
              <div className="rq-field-group">
                <span className="rq-field-label">Phone Number</span>
                <span className="rq-field-value">{item.contact_phone || "—"}</span>
              </div>
            )}

            <div className="rq-field-group">
              <span className="rq-field-label">Party Size</span>
              <span className="rq-field-value rq-field-value--highlight">
                👥 {item.guest_count} Guest{item.guest_count > 1 ? "s" : ""}
              </span>
            </div>

            <div className="rq-field-group">
              <span className="rq-field-label">Booking Status</span>
              <div>
                <span className={`rq-status-pill rq-status-pill--${statusSlug}`}>
                  {item.reservation_status}
                </span>
                {isPreference ? <span className="rq-preference-chip" style={{ marginLeft: 6 }}>Preferred (to be confirmed)</span> : null}
              </div>
            </div>

            <div className="rq-field-group">
              <span className="rq-field-label">Reserved Time</span>
              <span className="rq-field-value">
                ⏰ {item.start_time || "—"} {item.end_time ? `– ${item.end_time}` : ""}
              </span>
            </div>

            <div className="rq-field-group">
              <span className="rq-field-label">Estimated Dining</span>
              <span className="rq-field-value">{item.duration_minutes || 60} mins (ERT)</span>
            </div>

            <div className="rq-field-group">
              <span className="rq-field-label">Table Area</span>
              <span className="rq-field-value">{item.area_name || "Standard Area"}</span>
            </div>

            <div className="rq-field-group">
              <span className="rq-field-label">{isPreference ? "Preferred Table" : "Assigned Table"}</span>
              <div>
                <span className="rq-table-chip">
                  🍽️ Table {item.table_number || "—"}
                </span>
              </div>
            </div>

            {item.dining_purpose && (
              <div className="rq-field-group" style={{ gridColumn: "span 2" }}>
                <span className="rq-field-label">Dining Purpose</span>
                <span className="rq-field-value">{item.dining_purpose}</span>
              </div>
            )}
          </div>

          {item.special_request && (
            <div className="rq-notes-box">
              <span className="rq-field-label" style={{ color: "#b45309", marginBottom: "4px", display: "block" }}>
                Special Request / Note
              </span>
              <span>{item.special_request}</span>
            </div>
          )}

          {item.upgrade_payment && (
            <div className="rq-notes-box" style={{ background: "#fef3c7", border: "1px solid #fde68a", marginTop: "10px" }}>
              <span className="rq-field-label" style={{ color: "#92400e", marginBottom: "4px", display: "block", fontWeight: 700 }}>
                ⚡ VIP Area Upgrade Payment Status
              </span>
              <div style={{ fontSize: "12px", fontWeight: 700, color: item.upgrade_payment.payment_status === "PAID" ? "#166534" : "#dc2626" }}>
                Status: {item.upgrade_payment.payment_status === "PAID" ? "✓ PAID VIA SEPAY" : "⚠ UNPAID"} · Additional Deposit: +{Number(item.upgrade_payment.upgrade_amount || 0).toLocaleString("vi-VN")} VND
              </div>
            </div>
          )}
        </div>

        <footer className="rq-modal-footer">
          <button
            type="button"
            className="sfx-btn sfx-btn--soft"
            style={{
              padding: "6px 16px",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
              border: "1px solid #cbd5e1",
              background: "#f8fafc"
            }}
            onClick={onClose}
          >
            Close Invoice
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
