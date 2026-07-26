/**
 * StaffPaymentPanel — Apple Cinematic right-hand payment panel
 *
 * Pure visual/motion component. All state, props, API calls, and
 * data flow come from the parent (StaffPaymentTab.jsx).
 * This file is a visual pass ONLY — nothing outside this component
 * shifts by even 1px.
 *
 * Design language: Apple HIG — restraint, material depth, spring motion.
 * Accent: #9f8655 (Phūrai warm brass/gold) — one accent, everything else neutral.
 */

import "../styles/staff-payment-panel.css";

function formatMoney(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

/* ── SF-Symbol-style thin line icons (no external lib) ── */
function IconCash() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="6" width="20" height="12" rx="2"/>
      <circle cx="12" cy="12" r="3"/>
      <path d="M6 12h.01M18 12h.01"/>
    </svg>
  );
}
function IconQR() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <path d="M14 14h3v3M17 17h3M14 20h3"/>
    </svg>
  );
}
function IconCard() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <line x1="2" y1="10" x2="22" y2="10"/>
      <line x1="6" y1="15" x2="10" y2="15"/>
    </svg>
  );
}
function IconVNPAY() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
    </svg>
  );
}
function IconLock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2"/>
      <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.5 7L5.5 10L11.5 4"/>
    </svg>
  );
}

const METHOD_ICONS = {
  1: IconCash,
  2: IconQR,
  3: IconCard,
  4: IconVNPAY,
};

const PAYMENT_METHODS = [
  { id: 1, key: "cash",   label: "Cash",          sub: "Cash at table" },
  { id: 2, key: "qr",    label: "QR Pay",        sub: "VietQR / Momo" },
  { id: 4, key: "vnpay", label: "VNPAY",          sub: "Sandbox" },
];

/**
 * @param {object}   props
 * @param {object}   props.bill              — bill data from parent
 * @param {number}   props.paymentMethodId   — selected method id
 * @param {Function} props.setPaymentMethodId
 * @param {string}   props.amountPaid        — string amount
 * @param {Function} props.setAmountPaid
 * @param {number}   props.changeDue         — computed change
 * @param {string}   props.promoCode
 * @param {Function} props.setPromoCode
 * @param {string|null} props.busyKey
 * @param {boolean}  props.shouldShake
 * @param {boolean}  props.manager
 * @param {object[]} props.timeline
 * @param {Function} props.onApplyPromo
 * @param {Function} props.onCheckout
 * @param {Function} props.onConfirmCash
 * @param {Function} props.onVoidBill
 * @param {Function} props.onPrint
 * @param {Function} props.onSplitItem
 * @param {Function} props.onSplitAmount
 * @param {any}      props.qrChildren        — slot for CheckoutPayment (QR method)
 */
export function StaffPaymentPanel({
  bill,
  paymentMethodId,
  setPaymentMethodId,
  amountPaid,
  setAmountPaid,
  changeDue,
  promoCode,
  setPromoCode,
  busyKey,
  shouldShake,
  manager,
  timeline,
  paymentConfirmed,      // { orderId, amount, confirmedAt } | null
  customerEmail,
  setCustomerEmail,
  emailStatus,
  verifiedUser,
  onApplyPromo,
  onCheckout,
  onConfirmCash,
  onVoidBill,
  onPrint,
  onSplitItem,
  onSplitAmount,
  qrChildren,
}) {
  if (!bill) return null;

  const hasCashPending =
    bill?.order_status === "Pending Payment" || bill?.order_status === "Billed";
  const isPaid = bill?.order_status === "Paid" || !!paymentConfirmed;
  const hasItems = (bill.items || []).length > 0;
  const confirmingCash = busyKey === "confirm_cash";

  const confirmedTimeStr = paymentConfirmed?.confirmedAt
    ? new Date(paymentConfirmed.confirmedAt).toLocaleTimeString("vi-VN", {
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      })
    : null;

  return (
    <section className="spp" aria-label="Payment control panel">

      {/* ── PAYMENT CONFIRMED REAL-TIME BANNER ── */}
      {(isPaid || paymentConfirmed) && (
        <div
          className="spp__status-banner"
          style={{
            background: "rgba(220, 252, 231, 0.7)",
            borderColor: "rgba(52, 199, 89, 0.35)",
          }}
          role="status"
          aria-live="assertive"
        >
          <div className="spp__status-inner">
            <div
              className="spp__status-icon"
              style={{ background: "rgba(52,199,89,0.18)", animation: "none" }}
              aria-hidden
            >
              ✅
            </div>
            <div className="spp__status-text-wrap">
              <p className="spp__status-title" style={{ color: "#15803d" }}>
                Payment Confirmed
              </p>
              <p className="spp__status-desc" style={{ color: "#166534" }}>
                {paymentConfirmed
                  ? `${formatMoney(paymentConfirmed.amount)} received via QR / Online Transfer`
                  : `Order #${bill.order_id} has been marked as Paid`}
                {confirmedTimeStr && (
                  <span style={{ display: "block", marginTop: 2, fontFamily: "monospace", fontSize: "11px" }}>
                    ⏱ {confirmedTimeStr}
                  </span>
                )}
              </p>
            </div>
          </div>
          {onPrint && (
            <button
              type="button"
              className="spp__confirm-btn"
              style={{ background: "#15803d" }}
              onClick={onPrint}
            >
              🖨 Print Receipt / Export PDF
            </button>
          )}
        </div>
      )}

      {/* ── PROMO VOUCHER & MEMBER DISCOUNT ── */}
      <div>
        <p className="spp__section-label">Promo Voucher / Member Discount (Optional)</p>
        <div className="spp__promo-row">
          <input
            type="text"
            className="spp__promo-input"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            placeholder="Enter promo code (e.g. WEEKEND10, NEWMEM50)…"
            disabled={busyKey === "promo"}
            aria-label="Promo code or Member Voucher"
          />
          <button
            type="button"
            className="spp__promo-apply-btn"
            onClick={onApplyPromo}
            disabled={!promoCode.trim() || busyKey === "promo"}
          >
            {busyKey === "promo" ? "Applying…" : "Apply Code"}
          </button>
        </div>

        {bill.applied_promo && (
          <div className="spp__promo-applied" style={{ marginTop: 8 }}>
            <IconCheck />
            <span>
              Applied: <strong>{bill.applied_promo.promo_code}</strong> — {bill.applied_promo.promotion_name}
              {bill.discount_amount > 0 && ` (-${formatMoney(bill.discount_amount)})`}
            </span>
          </div>
        )}
      </div>

      {/* ── CUSTOMER LOYALTY EMAIL & E-RECEIPT ── */}
      <div>
        <p className="spp__section-label">Customer Loyalty Email (Optional)</p>
        <div className="spp__promo-row">
          <input
            type="email"
            className="spp__promo-input"
            value={customerEmail || ""}
            onChange={(e) => setCustomerEmail?.(e.target.value)}
            placeholder="customer@example.com (Ask customer if earning points)…"
            aria-label="Customer email for loyalty"
          />
        </div>

        {customerEmail?.trim() && (
          emailStatus === "checking" ? (
            <p className="spp__promo-lock" style={{ marginTop: 6, color: "#8e8e93" }}>
              ⏳ Checking customer email in system...
            </p>
          ) : emailStatus === "verified" ? (
            <div
              className="spp__promo-applied"
              style={{
                marginTop: 8,
                background: "rgba(52, 199, 89, 0.12)",
                borderColor: "rgba(52, 199, 89, 0.3)",
                color: "#166534",
              }}
            >
              <span>✅</span>
              <span>
                Verified Member: <strong>{verifiedUser?.full_name || verifiedUser?.email}</strong> (Loyalty: {verifiedUser?.loyalty_points || 0} pts) — Will receive email & points!
              </span>
            </div>
          ) : (
            <div
              className="spp__promo-applied"
              style={{
                marginTop: 8,
                background: "rgba(255, 59, 48, 0.1)",
                borderColor: "rgba(255, 59, 48, 0.25)",
                color: "#991b1b",
              }}
            >
              <span>❌</span>
              <span>
                Email not found in system. System will skip email receipt.
              </span>
            </div>
          )
        )}
      </div>

      {/* ── PAYMENT METHOD GRID ── */}
      <div>
        <p className="spp__section-label">Payment Method</p>
        <div
          className="spp__method-grid"
          role="radiogroup"
          aria-label="Payment method"
        >
          {PAYMENT_METHODS.map((method) => {
            const Icon = METHOD_ICONS[method.id];
            const active = paymentMethodId === method.id;
            return (
              <button
                key={method.id}
                type="button"
                role="radio"
                aria-checked={active}
                className={`spp__method-tile${active ? " is-active" : ""}`}
                onClick={() => {
                  setPaymentMethodId(method.id);
                  if (method.key !== "cash") {
                    setAmountPaid(String(bill.total_amount ?? ""));
                  }
                }}
              >
                <div className="spp__method-icon">
                  <Icon />
                </div>
                <span className="spp__method-label">{method.label}</span>
                <span className="spp__method-sub">{method.sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── AMOUNT / QR SLOT ── */}
      {paymentMethodId === 2 ? (
        /* QR: render the CheckoutPayment from parent as a slot */
        <div>{qrChildren}</div>
      ) : (
        <div className="spp__amount-wrap">
          <p className="spp__section-label" style={{ marginBottom: 0 }}>
            {paymentMethodId === 1 ? "Cash Received (VND)" : "Amount Paid (VND)"}
          </p>
          <input
            id="staff-amount-paid"
            type="number"
            className="spp__amount-input"
            min={0}
            step={1000}
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            aria-label="Amount paid"
          />

          {paymentMethodId === 1 && (
            <div className="spp__amount-presets">
              {[
                { label: "Exact", value: String(bill.total_amount) },
                { label: "200k", value: "200000" },
                { label: "500k", value: "500000" },
                { label: "1M", value: "1000000" },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  className="spp__preset-chip"
                  onClick={() => setAmountPaid(chip.value)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          {paymentMethodId === 1 && changeDue > 0 && (
            <div className="spp__change-due" role="status">
              <span className="spp__change-label">Change due</span>
              <span className="spp__change-amount">{formatMoney(changeDue)}</span>
            </div>
          )}
        </div>
      )}

      {/* ── PRIMARY & SECONDARY ACTIONS ── */}
      <div className="spp__actions">
        {paymentMethodId !== 4 && (
          <button
            type="button"
            className="spp__cta-primary"
            disabled={isPaid || !bill.order_id || !hasItems || busyKey === "checkout"}
            onClick={onCheckout}
            aria-busy={busyKey === "checkout"}
            style={{
              opacity: isPaid ? 0.4 : 1,
              filter: isPaid ? "grayscale(0.8)" : "none",
              cursor: isPaid ? "not-allowed" : "pointer",
            }}
          >
            {isPaid
              ? "✓ Payment Completed & Session Closed"
              : busyKey === "checkout"
              ? "Processing Checkout…"
              : "Complete Payment & Close Session"}
          </button>
        )}

        {manager && (
          <button
            type="button"
            className="spp__void-btn"
            disabled={!bill.order_id || busyKey === "void"}
            onClick={onVoidBill}
          >
            {busyKey === "void" ? "Voiding bill…" : "Refund / Void Bill"}
          </button>
        )}

        <div className="spp__secondary-row">
          <button
            type="button"
            className="spp__cta-secondary"
            disabled={isPaid || !bill.order_id || !hasItems}
            onClick={onSplitItem}
            style={{
              opacity: isPaid ? 0.4 : 1,
              cursor: isPaid ? "not-allowed" : "pointer",
            }}
          >
            Split by Item
          </button>
          <button
            type="button"
            className="spp__cta-secondary"
            disabled={isPaid || !bill.order_id}
            onClick={onSplitAmount}
            style={{
              opacity: isPaid ? 0.4 : 1,
              cursor: isPaid ? "not-allowed" : "pointer",
            }}
          >
            Split by Amount
          </button>
        </div>
      </div>

      {/* ── ORDER AUDIT TIMELINE ── */}
      {timeline.length > 0 && (
        <div>
          <p className="spp__section-label">Order Timeline</p>
          <div className="spp__timeline">
            {timeline.map((log) => {
              let details = {};
              try { details = JSON.parse(log.new_value_json || "{}"); } catch (_) {}
              const dateStr = new Date(log.created_at).toLocaleString("vi-VN", {
                day: "2-digit", month: "2-digit",
                hour: "2-digit", minute: "2-digit",
              });
              return (
                <div key={log.audit_log_id} className="spp__timeline-item">
                  <div className="spp__timeline-row">
                    <span className="spp__timeline-action">{log.action_name}</span>
                    <span className="spp__timeline-date">{dateStr}</span>
                  </div>
                  <div className="spp__timeline-meta">
                    <span>👤 {log.full_name || log.email || details.staffName || "System"}</span>
                    {details.amountPaid && (
                      <span className="spp__timeline-amount">
                        {formatMoney(details.amountPaid)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

export default StaffPaymentPanel;
