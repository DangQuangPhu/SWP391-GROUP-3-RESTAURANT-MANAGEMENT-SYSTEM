import { useState, useEffect } from "react";
import PreorderDashboardModal from "./PreorderDashboardModal.jsx";
import PromotionModal from "./PromotionModal.jsx";
import { formatVND } from "@/core/utils/formatCurrency.js";
import { apiPost } from "@/core/api/httpClient";
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
  currentUser,
}) {
  const [showPreorder, setShowPreorder] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoError, setPromoError] = useState("");

  // Clear promo code if preorderTotal becomes 0
  useEffect(() => {
    if (preorderTotal === 0 && promoCode) {
      setPromoCode("");
      setPromoDiscount(null);
    }
  }, [preorderTotal, promoCode, setPromoCode, setPromoDiscount]);

  // Automatically revalidate/update discount when preorder food total changes
  useEffect(() => {
    if (!promoCode || preorderTotal === 0) return;

    const reapplyVoucher = async () => {
      try {
        const res = await apiPost("/vouchers/apply", {
          voucher_code: promoCode,
          cart_total: preorderTotal
        });
        if (res?.success) {
          setPromoDiscount({
            discount_amount: res.discount_amount,
            promotion_name: res.promotion_name,
            description: `Discount applied to food preorder`
          });
          setPromoError("");
        }
      } catch (err) {
        // If no longer valid, clear it
        setPromoCode("");
        setPromoDiscount(null);
        setPromoError(err.response?.data?.message || err.message || "Promo code is no longer valid for this total.");
      }
    };

    reapplyVoucher();
  }, [preorderTotal, promoCode, setPromoCode, setPromoDiscount]);

  const applyVoucherByCode = async (code) => {
    if (!code || preorderTotal === 0) return;
    setPromoError("");
    try {
      const res = await apiPost("/vouchers/apply", {
        voucher_code: code,
        cart_total: preorderTotal
      });
      if (res?.success) {
        setPromoCode(code);
        setPromoDiscount({
          discount_amount: res.discount_amount,
          promotion_name: res.promotion_name,
          description: `Discount applied to food preorder`
        });
        setPromoError("");
      }
    } catch (err) {
      setPromoError(err.response?.data?.message || err.message || "Invalid promo code");
      setPromoDiscount(null);
    }
  };

  const handleRemovePromo = () => {
    setPromoCode("");
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

  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth <= 768 : false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="rd-card" style={{ maxWidth: "100%", padding: "2rem" }}>
      <div style={{ marginBottom: "2rem", borderBottom: "1px solid #f0f0f0", paddingBottom: "1rem" }}>
        <h2 className="rd-card-title" style={{ fontSize: "24px", fontWeight: 700, color: "#111" }}>Reservation summary</h2>
        <p className="rd-card-subtitle" style={{ fontSize: "14px", color: "#666", margin: "4px 0 0" }}>Review your details before confirming.</p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1px 1fr",
          gap: isMobile ? "1.5rem" : "3rem",
          alignItems: "stretch",
        }}
      >
        {/* LEFT COLUMN: Summary + Notes */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#111", marginBottom: "0.5rem" }}>Booking Details</h3>
            <div className="rzv-summary__grid" style={{ display: "flex", flexDirection: "column", gap: "0px" }}>
              <div className="rzv-summary__row" style={{ borderBottom: "1px solid #f0f0f0", padding: "7px 0" }}>
                <span className="rzv-summary__label">Date</span>
                <span className="rzv-summary__value" style={{ fontWeight: 500 }}>{formatDate(form.date)}</span>
              </div>
              <div className="rzv-summary__row" style={{ borderBottom: "1px solid #f0f0f0", padding: "7px 0" }}>
                <span className="rzv-summary__label">Time</span>
                <span className="rzv-summary__value" style={{ fontWeight: 500 }}>{formatTime(form.time)}</span>
              </div>
              <div className="rzv-summary__row" style={{ borderBottom: "1px solid #f0f0f0", padding: "7px 0" }}>
                <span className="rzv-summary__label">Guests</span>
                <span className="rzv-summary__value" style={{ fontWeight: 500 }}>{form.guestCount}</span>
              </div>
              <div className="rzv-summary__row" style={{ borderBottom: "1px solid #f0f0f0", padding: "7px 0" }}>
                <span className="rzv-summary__label">Dining Purpose</span>
                <span className="rzv-summary__value" style={{ fontWeight: 500 }}>{form.diningPurpose || "—"}</span>
              </div>
              <div className="rzv-summary__row" style={{ borderBottom: "1px solid #f0f0f0", padding: "7px 0" }}>
                <span className="rzv-summary__label">Hold Duration</span>
                <span className="rzv-summary__value" style={{ fontWeight: 500 }}>{form.holdDurationMinutes} minutes</span>
              </div>
              <div className="rzv-summary__row" style={{ borderBottom: "1px solid #f0f0f0", padding: "7px 0" }}>
                <span className="rzv-summary__label">Hold expires at</span>
                <span className="rzv-summary__value" style={{ fontWeight: 500 }}>{holdExpiresAt}</span>
              </div>
              <div className="rzv-summary__row" style={{ borderBottom: "1px solid #f0f0f0", padding: "7px 0" }}>
                <span className="rzv-summary__label">Area</span>
                <span className="rzv-summary__value" style={{ fontWeight: 500 }}>{areaLabels}</span>
              </div>
              <div className="rzv-summary__row" style={{ borderBottom: "1px solid #f0f0f0", padding: "7px 0" }}>
                <span className="rzv-summary__label">Table</span>
                <span className="rzv-summary__value" style={{ fontWeight: 500 }}>
                  {tableLabels}
                  {selectedTables.length > 0 ? ` · ${totalCapacity} seats` : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div className="rd-field" style={{ margin: 0 }}>
            <label htmlFor="rzv-notes" style={{ fontWeight: 600, fontSize: "0.9rem", color: "#666", marginBottom: "6px", display: "block" }}>SPECIAL REQUESTS / NOTES</label>
            <textarea
              id="rzv-notes"
              placeholder="Any allergies, special occasions, or other requests?"
              rows={3}
              value={form.notes || ""}
              onChange={(e) => setField("notes", e.target.value)}
              style={{ width: "100%", padding: "0.85rem", borderRadius: "0.75rem", border: "1px solid #e5e5e5", background: "#f9f9f9", fontSize: "0.95rem", color: "#333", resize: "none" }}
            />
          </div>
        </div>

        {/* DIVIDER LINE */}
        {!isMobile && <div style={{ width: "1px", backgroundColor: "#e2e8f0" }} />}

        {/* RIGHT COLUMN: Pre-order + Promo + Payment Details + Warnings + Action Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#111", marginBottom: "0.75rem" }}>Pre-orders & Promotions</h3>
            
            {/* Pre-order Section */}
            <div style={{ marginBottom: "0.75rem" }}>
              <button
                type="button"
                style={{ width: "100%", padding: "12px", background: "#111", color: "#fff", border: "none", borderRadius: "0.75rem", cursor: "pointer", fontSize: "13px", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", transition: "background 0.2s" }}
                onClick={() => setShowPreorder(true)}
                onMouseOver={(e) => e.target.style.background = "#333"}
                onMouseOut={(e) => e.target.style.background = "#111"}
              >
                {Object.keys(preorderItems || {}).length > 0 ? "Edit Pre-order" : "ADD PRE-ORDER (OPTIONAL)"}
              </button>
              
              {/* Display selected preorder items */}
              {Object.keys(preorderItems || {}).length > 0 && (
                <div style={{ marginTop: "10px", background: "#f9f9f9", padding: "10px 14px", borderRadius: "8px", border: "1px solid #eee" }}>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: "0.85rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px" }}>Selected Items</h4>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {Object.values(preorderItems).map((item) => (
                      <li key={item.dish_id} style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "0.9rem" }}>
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
                currentUser={currentUser}
              />
            </div>

            {/* Promo Section */}
            <div style={{ marginBottom: "0.5rem" }}>
              {preorderTotal === 0 ? (
                <div style={{ background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: "0.75rem", padding: "1rem", textAlign: "center", color: "#64748b", fontSize: "0.9rem" }}>
                  Pre-order food items to unlock voucher promotions.
                </div>
              ) : (
                <div style={{ border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden" }}>
                  <button
                    type="button"
                    onClick={() => setShowPromoModal(true)}
                    style={{ width: "100%", padding: "12px 14px", background: "#f8fafc", border: "none", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", fontSize: "0.9rem", fontWeight: 600, color: "#334155" }}
                  >
                    <span>{promoCode ? `Applied: ${promoCode}` : "APPLY VOUCHER / PROMO CODE"}</span>
                    <span>→</span>
                  </button>

                  {promoError && (
                    <div style={{ padding: "8px 14px", background: "#fef2f2", borderTop: "1px solid #fca5a5", color: "#b91c1c", fontSize: "0.8rem" }}>
                      {promoError}
                    </div>
                  )}

                  {promoCode && (
                    <div style={{ padding: "10px 14px", background: "#fff", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <strong style={{ color: "#16a34a", fontSize: "0.85rem" }}>{promoCode} Applied!</strong>
                        {promoDiscount && <div style={{ fontSize: "0.75rem", color: "#15803d" }}>{promoDiscount.promotion_name || promoDiscount.description}</div>}
                      </div>
                      <button
                        type="button"
                        onClick={handleRemovePromo}
                        style={{ border: "none", background: "none", color: "#dc2626", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Payment Section */}
          <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: "1rem" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#111", marginBottom: "0.75rem" }}>Payment Details</h3>
            
            <div className="rzv-summary__row" style={{ borderBottom: "1px solid #f0f0f0", padding: "6px 0" }}>
              <span className="rzv-summary__label" style={{ color: "#666" }}>Base Table Deposit</span>
              <span className="rzv-summary__value" style={{ fontWeight: 500 }}>{formatVND(20000)}</span>
            </div>

            {preorderTotal > 0 && (
              <div className="rzv-summary__row" style={{ borderBottom: "1px solid #f0f0f0", padding: "6px 0" }}>
                <span className="rzv-summary__label" style={{ color: "#666" }}>Pre-order Food Total</span>
                <span className="rzv-summary__value" style={{ fontWeight: 500 }}>{formatVND(preorderTotal)}</span>
              </div>
            )}

            {promoDiscount && (
              <div className="rzv-summary__row" style={{ borderBottom: "1px solid #f0f0f0", padding: "6px 0", color: "#16a34a" }}>
                <span className="rzv-summary__label" style={{ color: "#16a34a" }}>Voucher Discount ({promoCode})</span>
                <span className="rzv-summary__value" style={{ fontWeight: 600 }}>-{formatVND(promoDiscount.discount_amount)}</span>
              </div>
            )}

            {(() => {
              const discountAmt = promoDiscount ? Number(promoDiscount.discount_amount) : 0;
              const foodTotal = Math.max(0, preorderTotal - discountAmt);
              const baseTableFee = 20000;
              const netTotal = baseTableFee + foodTotal;
              const depositRequired = Math.round(netTotal * 0.3);
              const remainingBalance = netTotal - depositRequired;

              return (
                <>
                  <div className="rzv-summary__row" style={{ borderBottom: "1px solid #e5e5e5", padding: "8px 0", fontWeight: 600, fontSize: "1.05rem" }}>
                    <span className="rzv-summary__label" style={{ color: "#111" }}>Net Total</span>
                    <span className="rzv-summary__value" style={{ color: "#111" }}>{formatVND(netTotal)}</span>
                  </div>

                  <div style={{ marginTop: "0.75rem", background: "#f8fafc", padding: "1rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0" }}>
                    <div className="rzv-summary__row" style={{ padding: "2px 0", fontWeight: 700, color: "var(--rzv-gold)" }}>
                      <span className="rzv-summary__label" style={{ fontSize: "0.95rem" }}>
                        Required Deposit (30%)
                      </span>
                      <span className="rzv-summary__value" style={{ fontSize: "1.1rem" }}>{formatVND(depositRequired)}</span>
                    </div>
                    <div className="rzv-summary__row" style={{ padding: "2px 0", color: "#64748b", fontSize: "0.9rem" }}>
                      <span className="rzv-summary__label">
                        Remaining Balance (70%)
                      </span>
                      <span className="rzv-summary__value" style={{ fontWeight: 600 }}>{formatVND(remainingBalance)}</span>
                    </div>
                    <p style={{ margin: "6px 0 0 0", fontSize: "11px", color: "#64748b", fontStyle: "italic", lineHeight: "1.4" }}>
                      * The required deposit (30%) secures your table and pre-ordered items. The remaining balance (70%) is paid during checkout.
                    </p>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Error & Warnings */}
          {error ? <div className="rzv-error" style={{ margin: 0, padding: "10px", borderRadius: "8px", background: "#fef2f2", color: "#b91c1c", fontSize: "0.85rem" }}>{error}</div> : null}

          {showVatWarning ? (
            <div className="rzv-alert rzv-alert--surcharge" role="status" style={{ margin: 0 }}>
              Note: Reservations for 45 minutes to 2 hours are subject to an additional premium
              VAT/surcharge fee.
            </div>
          ) : null}

          {/* Action Buttons */}
          <div style={{ marginTop: "0.5rem", display: "flex", gap: "1rem" }}>
            <button
              type="button"
              className="rd-btn-outline"
              onClick={onEditDetails}
              style={{ flex: 1, margin: 0, padding: "12px", fontSize: "13px", fontWeight: 600, borderRadius: "0.75rem" }}
            >
              EDIT DETAILS
            </button>
            <button
              type="button"
              className="rd-btn-primary"
              onClick={onSubmit}
              disabled={!canSubmit || submitting}
              style={{ flex: 2, margin: 0, padding: "12px", borderRadius: "0.75rem" }}
            >
              {submitting ? "PROCESSING..." : "CONFIRM RESERVATION"}
            </button>
          </div>
        </div>
      </div>

      <PromotionModal 
        open={showPromoModal}
        isAuthenticated={true} // Allow guests to see promotions based on our earlier config
        current={{ id: promoCode }}
        onClose={() => setShowPromoModal(false)}
        onApply={(promo) => {
          if (promo) {
            applyVoucherByCode(promo.id === "member-10" ? "WEEKEND10" : "FIXED20K");
          }
        }}
      />
    </div>
  );
}

export default ReservationSummary;
