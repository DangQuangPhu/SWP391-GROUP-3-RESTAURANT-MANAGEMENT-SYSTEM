import { DINING_PURPOSES, PROMOTIONS } from "../data/floorPlanConfig.js";
import { useState } from "react";
import PreorderDashboardModal from "./PreorderDashboardModal.jsx";
import { formatVND } from "@/utils/formatCurrency.js";
function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(timeStr) {
  if (!timeStr) return "—";
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function getAreaFromTable(tableLabel) {
  if (!tableLabel) return "—";
  const prefix = String(tableLabel).trim().charAt(0).toUpperCase();
  switch (prefix) {
    case 'W': return "Window";
    case 'B': return "Bar";
    case 'K': return "Kitchen View";
    case 'V': return "VIP Lounge";
    case 'P': return "Private Room";
    case 'T': return "Main Dining";
    case 'O': return "Outdoor";
    case 'S': return "Standard";
    default: return "Standard";
  }
}

/**
 * Final review of the booking before the guest confirms.
 */
function ReservationSummary({
  form,
  setField,
  selectedTables,
  isKitchenView = false,
  error,
  submitting,
  canSubmit,
  onSubmit,
  onEditDetails,
  preorderItems,
  setPreorderItems,
  preorderTotal,
  setPreorderTotal,
  promoCode,
  setPromoCode,
  promoDiscount,
  setPromoDiscount,
}) {
  const [showPreorder, setShowPreorder] = useState(false);
  const [showPromo, setShowPromo] = useState(false);
  const [promoInput, setPromoInput] = useState(promoCode || "");

  const handleApplyPromo = () => {
    if (!promoInput) return;
    const promo = PROMOTIONS.find(p => p.id === promoInput);
    if (promo) {
      setPromoCode(promo.id);
      setPromoDiscount({ discount_type: 'percent', discount_value: 10, description: promo.label });
    }
  };

  const handleRemovePromo = () => {
    setPromoCode("");
    setPromoInput("");
    setPromoDiscount(null);
    setPromoError("");
  };

  const totalCapacity = selectedTables.reduce((sum, t) => sum + Number(t.capacity), 0);
  const tableLabels = selectedTables.length > 0
    ? selectedTables.map((t) => t.display_label || t.table_number).join(", ")
    : "Not selected";

  const areaLabels = selectedTables.length > 0
    ? Array.from(new Set(selectedTables.map((t) => getAreaFromTable(t.display_label || t.table_number)))).join(", ")
    : "—";

  let holdExpiresAt = "—";
  if (form.date && form.time) {
    const [y, m, d] = form.date.split("-").map(Number);
    const [hh, mm] = form.time.split(":").map(Number);
    const expireDate = new Date(y, m - 1, d, hh, mm + form.holdDurationMinutes);
    holdExpiresAt = formatTime(`${expireDate.getHours()}:${expireDate.getMinutes()}`);
  }

  const showVatWarning =
    form.holdDurationMinutes === 45 || form.holdDurationMinutes === 60;

  return (
    <div className="rd-card">
        <h2 className="rd-card-title">Reservation summary</h2>
        <p className="rd-card-subtitle">Review your details before confirming.</p>

      <div className="rzv-summary__grid">
        <div className="rzv-summary__row" style={{ borderBottom: "1px solid #f0f0f0", padding: "12px 0" }}>
          <span className="rzv-summary__label">Date</span>
          <span className="rzv-summary__value" style={{ fontWeight: 500 }}>{formatDate(form.date)}</span>
        </div>
        <div className="rzv-summary__row" style={{ borderBottom: "1px solid #f0f0f0", padding: "12px 0" }}>
          <span className="rzv-summary__label">Time</span>
          <span className="rzv-summary__value" style={{ fontWeight: 500 }}>{formatTime(form.time)}</span>
        </div>
        <div className="rzv-summary__row" style={{ borderBottom: "1px solid #f0f0f0", padding: "12px 0" }}>
          <span className="rzv-summary__label">Guests</span>
          <span className="rzv-summary__value" style={{ fontWeight: 500 }}>{form.guestCount}</span>
        </div>
        <div className="rzv-summary__row" style={{ borderBottom: "1px solid #f0f0f0", padding: "12px 0" }}>
          <span className="rzv-summary__label">Dining Purpose</span>
          <span className="rzv-summary__value" style={{ fontWeight: 500 }}>{form.diningPurpose || "—"}</span>
        </div>
        <div className="rzv-summary__row" style={{ borderBottom: "1px solid #f0f0f0", padding: "12px 0" }}>
          <span className="rzv-summary__label">Duration</span>
          <span className="rzv-summary__value" style={{ fontWeight: 500 }}>{form.holdDurationMinutes} minutes</span>
        </div>
        <div className="rzv-summary__row" style={{ borderBottom: "1px solid #f0f0f0", padding: "12px 0" }}>
          <span className="rzv-summary__label">Hold expires at</span>
          <span className="rzv-summary__value" style={{ fontWeight: 500 }}>{holdExpiresAt}</span>
        </div>
        <div className="rzv-summary__row" style={{ borderBottom: "1px solid #f0f0f0", padding: "12px 0" }}>
          <span className="rzv-summary__label">Area</span>
          <span className="rzv-summary__value" style={{ fontWeight: 500 }}>{areaLabels}</span>
        </div>
        <div className="rzv-summary__row" style={{ borderBottom: "1px solid #f0f0f0", padding: "12px 0" }}>
          <span className="rzv-summary__label">Table</span>
          <span className="rzv-summary__value" style={{ fontWeight: 500 }}>
            {tableLabels}
            {selectedTables.length > 0 ? ` · ${totalCapacity} seats` : ""}
          </span>
        </div>

        {preorderTotal > 0 && (
          <div className="rzv-summary__row" style={{ color: "var(--rzv-gold)" }}>
            <span className="rzv-summary__label">Pre-order Total</span>
            <span className="rzv-summary__value">{formatVND(preorderTotal)}</span>
          </div>
        )}

        {promoDiscount && (
          <div className="rzv-summary__row" style={{ color: "var(--rzv-green)" }}>
            <span className="rzv-summary__label">Voucher Applied</span>
            <span className="rzv-summary__value">
              {promoDiscount.discount_type === "percentage"
                ? `-${promoDiscount.discount_value}%`
                : `-${formatVND(promoDiscount.discount_value)}`}
            </span>
          </div>
        )}

        <div className="rd-field" style={{ gridColumn: "1 / -1", marginTop: "1.5rem" }}>
          <label htmlFor="rzv-notes">SPECIAL REQUESTS / NOTES</label>
          <textarea
            id="rzv-notes"
            placeholder="Any allergies, special occasions, or other requests?"
            rows={3}
            value={form.notes || ""}
            onChange={(e) => setField("notes", e.target.value)}
            style={{ width: "100%", padding: "1rem", borderRadius: "0.75rem", border: "1px solid #e5e5e5", background: "#f9f9f9", fontSize: "1rem", color: "#333" }}
          />
        </div>
      </div>

      <div className="rzv-summary__addons" style={{ marginTop: "2rem", borderTop: "1px solid #eee", paddingTop: "1.5rem" }}>
        {/* Pre-order Modal Button */}
        <div style={{ marginBottom: "1rem" }}>
          <button
            type="button"
            style={{ width: "100%", padding: "14px", background: "#111", color: "#fff", border: "none", borderRadius: "0.75rem", cursor: "pointer", fontSize: "14px", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", transition: "background 0.2s" }}
            onClick={() => setShowPreorder(true)}
            onMouseOver={(e) => e.target.style.background = "#333"}
            onMouseOut={(e) => e.target.style.background = "#111"}
          >
            {Object.keys(preorderItems || {}).length > 0 ? "Edit Pre-order" : "ADD PRE-ORDER (OPTIONAL)"}
          </button>
          
          {/* Display selected preorder items */}
          {Object.keys(preorderItems || {}).length > 0 && (
            <div style={{ marginTop: "12px", background: "#f9f9f9", padding: "12px 16px", borderRadius: "8px", border: "1px solid #eee" }}>
              <h4 style={{ margin: "0 0 8px 0", fontSize: "0.9rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px" }}>Selected Items</h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {Object.values(preorderItems).map((item) => (
                  <li key={item.dish_id} style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "0.95rem" }}>
                    <span>{item.name} <strong style={{ color: "var(--rzv-gold)" }}>x{item.quantity}</strong></span>
                    <span style={{ color: "#666" }}>{formatVND(item.price * item.quantity)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <PreorderDashboardModal
            isOpen={showPreorder}
            onClose={() => setShowPreorder(false)}
            preorderItems={preorderItems}
            onSave={(newItems) => {
              setPreorderItems(newItems);
              const total = Object.values(newItems).reduce((sum, i) => sum + (i.price * i.quantity), 0);
              setPreorderTotal(total);
            }}
          />
        </div>

        {/* Promo Collapsible */}
        <div style={{ marginBottom: "1rem", border: "1px solid #e5e5e5", borderRadius: "0.75rem", overflow: "hidden" }}>
          <button
            type="button"
            style={{ width: "100%", display: "flex", justifyContent: "space-between", padding: "1rem", background: "#f9f9f9", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", color: "#333" }}
            onClick={() => setShowPromo(!showPromo)}
          >
            <span>APPLY VOUCHER / PROMOTION</span>
            <span>{showPromo ? "▲" : "▼"}</span>
          </button>
          {showPromo && (
            <div style={{ borderTop: "1px solid #e5e5e5", padding: "1rem", background: "#fff" }}>
              {promoDiscount ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ color: "var(--rzv-green)", fontSize: "14px" }}>{promoCode} Applied!</strong>
                    <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#777" }}>{promoDiscount.description}</p>
                  </div>
                  <button type="button" className="rd-btn-outline" style={{ margin: 0, padding: "8px 16px" }} onClick={handleRemovePromo}>
                    Remove
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <select
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    style={{ flex: 1, padding: "0.75rem 1rem", borderRadius: "0.5rem", border: "1px solid #e5e5e5", background: "#f9f9f9", fontSize: "14px" }}
                  >
                    <option value="">Select a promotion...</option>
                    {PROMOTIONS.map(p => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="rd-btn-primary"
                    style={{ margin: 0, padding: "0.75rem 1.5rem", width: "auto" }}
                    onClick={handleApplyPromo}
                    disabled={!promoInput}
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {error ? <div className="rzv-error" style={{ marginTop: 16 }}>{error}</div> : null}

      {showVatWarning ? (
        <div className="rzv-alert rzv-alert--surcharge" role="status" style={{ marginTop: 16 }}>
          Note: Reservations for 45 minutes or 1 hour are subject to an additional premium
          VAT/surcharge fee.
        </div>
      ) : null}

      <div style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}>
        <button
          type="button"
          className="rd-btn-outline"
          onClick={onEditDetails}
          style={{ flex: 1, margin: 0, padding: "14px", fontSize: "13px", fontWeight: 600 }}
        >
          EDIT DETAILS
        </button>
        <button
          type="button"
          className="rd-btn-primary"
          onClick={onSubmit}
          disabled={!canSubmit || submitting}
          style={{ flex: 2, margin: 0 }}
        >
          {submitting ? "PROCESSING..." : "CONFIRM RESERVATION"}
        </button>
      </div>
    </div>
  );
}

export default ReservationSummary;
