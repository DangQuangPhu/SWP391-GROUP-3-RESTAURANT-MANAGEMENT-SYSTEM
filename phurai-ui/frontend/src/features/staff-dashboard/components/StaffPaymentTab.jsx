import { useCallback, useEffect, useMemo, useState } from "react";
import {
  SectionHead,
  Button,
  EmptyState,
  NotConnectedNote,
} from "./StaffUI.jsx";
import {
  applyStaffPromoCode,
  checkoutStaffPayment,
  fetchStaffBill,
  voidStaffBill,
  createVnpayUrl,
  checkOrderStatus,
  fetchOrderTimeline,
} from "../services/staffApi.js";
import { DEMO_NOTICE } from "@/shared/constants.js";
import { SplitBillModal } from "./SplitBillModal.jsx";
import CheckoutPayment from "./CheckoutPayment.jsx";
import { apiPost, profileRequestHeaders } from "@/core/api/httpClient.js";
import { useSocket } from "@/core/socket/SocketContext.jsx";
import "../styles/staff-payment-tab.css";

const PAYMENT_METHODS = [
  { id: 1, key: "cash", label: "Cash", sub: "Cash" },
  { id: 2, key: "qr", label: "QR Pay", sub: "VietQR / Momo" },
  { id: 3, key: "card", label: "Bank Transfer", sub: "Bank Card" },
  { id: 4, key: "vnpay", label: "VNPAY", sub: "Sandbox" },
];

function formatMoney(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function isManagerUser(user) {
  const r = Number(user?.roleId ?? user?.role_id);
  return r === 3 || r === 4;
}

function isOccupiedTable(table) {
  const raw = table?.table_status ?? table?.status ?? "";
  const text = String(raw).trim();
  if (text === "Occupied") return true;
  return text.toLowerCase().replace(/\s+/g, "_") === "occupied";
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StaffPaymentTab({
  tables,
  setTables,
  dataSource,
  user,
  toast,
  refreshing,
  onRefresh,
}) {
  const [selectedTableId, setSelectedTableId] = useState("");
  const [bill, setBill] = useState(null);
  const [billLoading, setBillLoading] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState(1);
  const [amountPaid, setAmountPaid] = useState("");
  const [busyKey, setBusyKey] = useState(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState(null);
  const [isSplitItemModalOpen, setIsSplitItemModalOpen] = useState(false);
  const [timeline, setTimeline] = useState([]);
  const [pendingCashTableIds, setPendingCashTableIds] = useState(new Set());
  const { socket } = useSocket();
  const [shouldShake, setShouldShake] = useState(false);

  const userId = user?.userId ?? user?.user_id ?? user?.id;
  const manager = isManagerUser(user);

  const occupiedTables = useMemo(
    () => (Array.isArray(tables) ? tables.filter(isOccupiedTable) : []),
    [tables]
  );

  const loadBill = useCallback(
    async (tableId) => {
      if (!tableId) {
        setBill(null);
        setTimeline([]);
        return;
      }
      setBillLoading(true);
      try {
        const res = await fetchStaffBill(tableId);
        setBill(res.data);
        setAmountPaid(String(res.data?.total_amount ?? ""));
        setCheckoutSuccess(null);
        if (res.data?.order_id) {
          const tlRes = await fetchOrderTimeline(res.data.order_id);
          setTimeline(tlRes.data || []);
        } else {
          setTimeline([]);
        }
      } catch (error) {
        setBill(null);
        setTimeline([]);
        toast(error.message || "Could not load bill", "error");
      } finally {
        setBillLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    if (!occupiedTables.length) {
      setSelectedTableId("");
      setBill(null);
      return;
    }
    if (!occupiedTables.some((t) => String(t.table_id) === String(selectedTableId))) {
      const nextId = occupiedTables[0].table_id;
      setSelectedTableId(String(nextId));
    }
  }, [occupiedTables, selectedTableId]);

  useEffect(() => {
    if (selectedTableId) {
      loadBill(Number(selectedTableId));
    }
  }, [selectedTableId, loadBill]);

  useEffect(() => {
    if (!socket) return;
    const handleCashPending = (payload) => {
      setPendingCashTableIds(prev => {
        const next = new Set(prev);
        next.add(payload.tableId);
        return next;
      });
      // Optionally auto-select if nothing is selected
      setSelectedTableId((current) => current || String(payload.tableId));
    };
    socket.on('payment:cash_pending', handleCashPending);
    return () => socket.off('payment:cash_pending', handleCashPending);
  }, [socket]);

  const changeDue = useMemo(() => {
    const paid = Number(amountPaid);
    const total = Number(bill?.total_amount) || 0;
    if (!Number.isFinite(paid) || paid < total) return 0;
    return paid - total;
  }, [amountPaid, bill?.total_amount]);

  const handleApplyPromoCode = async () => {
    if (!manager || !selectedTableId || !promoCode.trim()) return;
    setBusyKey("voucher");
    try {
      const res = await applyStaffPromoCode(
        Number(selectedTableId),
        userId,
        promoCode.trim()
      );
      if (res?.data) {
        setBill(res.data);
        setAmountPaid(String(res.data.total_amount ?? ""));
        toast(`Promo code applied: ${res.data.applied_promo?.promo_code || ""}`, "success");
      }
    } catch (error) {
      toast(error.message || "Could not apply promo code", "error");
    } finally {
      setBusyKey(null);
    }
  };

  const handleCheckout = async () => {
    if (!selectedTableId || !bill?.order_id) return;
    setBusyKey("checkout");
    try {
      const res = await checkoutStaffPayment(Number(selectedTableId), userId, {
        payment_method_id: paymentMethodId,
        amount_paid: Number(amountPaid),
        promo_code_id: bill.applied_promo?.promo_code_id ?? null,
      });
      const payload = res?.data;
      setCheckoutSuccess(payload);
      toast("Payment successful — table moved to Cleaning", "success");
      setTables((prev) =>
        prev.map((table) =>
          table.table_id === Number(selectedTableId)
            ? { ...table, table_status: "Cleaning", status: "cleaning" }
            : table
        )
      );
      setBill(null);
      setSelectedTableId("");
      setPromoCode("");
      onRefresh?.();
    } catch (error) {
      toast(error.message || "Payment failed", "error");
    } finally {
      setBusyKey(null);
    }
  };

  const handleConfirmCashPayment = async () => {
    if (!selectedTableId || !bill?.order_id) return;

    // Save current states for potential rollback
    const originalTables = [...tables];
    const originalBill = bill;
    const originalSelectedTableId = selectedTableId;
    const originalPendingCashTableIds = new Set(pendingCashTableIds);

    // Optimistically update tables and pending cash states immediately
    setTables((prev) =>
      prev.map((table) =>
        table.table_id === Number(selectedTableId)
          ? { ...table, table_status: "Cleaning", status: "cleaning" }
          : table
      )
    );
    setPendingCashTableIds((prev) => {
      const next = new Set(prev);
      next.delete(Number(selectedTableId));
      return next;
    });
    setBill(null);
    setSelectedTableId("");
    setPromoCode("");

    setBusyKey("confirm_cash");
    try {
      const res = await apiPost('/payments/staff-confirm-cash', {
        orderId: originalBill.order_id,
        tableId: Number(originalSelectedTableId)
      }, { headers: profileRequestHeaders(userId) });

      if (res.success) {
        setCheckoutSuccess({
          table_number: originalBill.table_number,
          total_amount: originalBill.total_amount,
          change_given: 0
        });
        toast("Cash Payment Confirmed — table moved to Cleaning", "success");
        onRefresh?.();
      } else {
        // Rollback states
        setTables(originalTables);
        setPendingCashTableIds(originalPendingCashTableIds);
        setBill(originalBill);
        setSelectedTableId(originalSelectedTableId);
        toast(res.message || "Confirmation failed", "error");

        // Trigger shake effect
        setShouldShake(true);
        setTimeout(() => setShouldShake(false), 500);
      }
    } catch (error) {
      // Rollback states on network/server error
      setTables(originalTables);
      setPendingCashTableIds(originalPendingCashTableIds);
      setBill(originalBill);
      setSelectedTableId(originalSelectedTableId);
      toast(error.message || "Network error", "error");

      // Trigger shake effect
      setShouldShake(true);
      setTimeout(() => setShouldShake(false), 500);
    } finally {
      setBusyKey(null);
    }
  };

  const handleVoidBill = async () => {
    if (!manager || !selectedTableId) return;
    const confirmed = window.confirm(
      "Void this table bill? Manager authorization required."
    );
    if (!confirmed) return;

    setBusyKey("void");
    try {
      await voidStaffBill(Number(selectedTableId), userId);
      toast("Bill voided and table session closed", "info");
      setTables((prev) =>
        prev.map((table) =>
          table.table_id === Number(selectedTableId)
            ? { ...table, table_status: "Cleaning", status: "cleaning" }
            : table
        )
      );
      setBill(null);
      setSelectedTableId("");
      onRefresh?.();
    } catch (error) {
      toast(error.message || "Could not void bill", "error");
    } finally {
      setBusyKey(null);
    }
  };

  const handlePrint = () => {
    toast("Thermal receipt printing will be connected in production.", "info");
  };

  const nowLabel = new Date().toLocaleString("en-US");

  return (
    <div className={`staff-payment-wrap${refreshing || billLoading ? " is-loading" : ""}`}>
      {checkoutSuccess ? (
        <div className="staff-card staff-payment-success-card" style={{ marginBottom: "16px" }}>
          <div className="staff-payment-success" role="status">
            Paid table {checkoutSuccess.table_number} —{" "}
            {formatMoney(checkoutSuccess.total_amount)}
            {checkoutSuccess.change_given > 0
              ? ` · Change ${formatMoney(checkoutSuccess.change_given)}`
              : ""}
          </div>
        </div>
      ) : null}

      {!occupiedTables.length ? (
        <div className="staff-card">
          <EmptyState
            icon="table"
            title="No occupied tables"
            hint="Check in a table and serve items before collecting payment."
          />
        </div>
      ) : (
        <div className="staff-payment-layout">
          <aside className="staff-payment-sidebar staff-card staff-card--compact staff-card--flush" style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "16px" }}>
            
            {pendingCashTableIds.size > 0 && (
              <div className="staff-pending-cash-alerts" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <p style={{ margin: 0, fontWeight: "bold", color: "#065f46", fontSize: "0.875rem" }}>
                  Action Required
                </p>
                {Array.from(pendingCashTableIds).map(tId => {
                  const table = occupiedTables.find(t => t.table_id === tId);
                  if (!table) return null;
                  return (
                    <button 
                      key={tId}
                      className="staff-btn staff-btn--glow-green w-full"
                      onClick={() => setSelectedTableId(String(tId))}
                      style={{ padding: "8px 12px", fontSize: "0.875rem", animation: "pulse 2s infinite" }}
                    >
                      💵 Table {table.table_number}
                    </button>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <label htmlFor="staff-payment-table-select" style={{ display: "block", marginBottom: "4px" }}>Select table</label>
                <select
                  id="staff-payment-table-select"
                  value={selectedTableId}
                  onChange={(e) => setSelectedTableId(e.target.value)}
                  style={{ width: "100%" }}
                >
                  {occupiedTables.map((table) => (
                    <option key={table.table_id} value={table.table_id}>
                      {table.table_number} · {table.area_name} {pendingCashTableIds.has(table.table_id) ? '(Cash Pending)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  icon="refresh"
                  onClick={onRefresh}
                  disabled={refreshing}
                />
              </div>
            </div>
          </aside>

          <div className="staff-payment-main">
            {!bill ? (
              <EmptyState
                icon="receipt"
                title="Loading bill…"
                hint="Select an occupied table to view the check."
              />
            ) : (
              <div className="staff-payment-grid">
                <section className="staff-receipt" aria-label="Bill preview">
                  <header className="staff-receipt__head">
                    <p className="staff-receipt__brand">Phūrai</p>
                    <p className="staff-receipt__sub">Premium Japanese-Peruvian Dining</p>
                  </header>

                  <div className="staff-receipt__meta">
                    <span>
                      Table {bill.table_number} · {bill.area_name}
                    </span>
                    <span>{nowLabel}</span>
                  </div>

                  <div className="staff-receipt__items">
                    {(bill.items || []).length === 0 ? (
                      <div className="staff-receipt__row">
                        <span className="staff-receipt__name staff-receipt__note">
                          No Served/Ready items to bill yet.
                        </span>
                      </div>
                    ) : (
                      bill.items.map((item) => (
                        <div key={item.order_item_id} className="staff-receipt__row">
                          <span className="staff-receipt__name">{item.dish_name}</span>
                          <span className="staff-receipt__qty">×{item.quantity}</span>
                          <span className="staff-receipt__price">
                            {formatMoney(item.line_total)}
                          </span>
                          {item.notes ? (
                            <span className="staff-receipt__note">{item.notes}</span>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="staff-receipt__totals">
                    <div className="staff-receipt__line">
                      <span>Subtotal</span>
                      <span>{formatMoney(bill.subtotal)}</span>
                    </div>
                    <div className="staff-receipt__line">
                      <span>Service charge ({bill.service_charge_percent || 5}%)</span>
                      <span>{formatMoney(bill.service_charge)}</span>
                    </div>
                    {bill.discount_amount > 0 ? (
                      <div className="staff-receipt__line staff-receipt__line--discount">
                        <span>Discount</span>
                        <span>-{formatMoney(bill.discount_amount)}</span>
                      </div>
                    ) : null}
                    {bill.reservation_deposit_amount > 0 ? (
                      <>
                        <div className="staff-receipt__line">
                          <span>Reservation Subtotal</span>
                          <span>{formatMoney(bill.reservation_remaining_balance + bill.reservation_deposit_amount)}</span>
                        </div>
                        <div className="staff-receipt__line staff-receipt__line--discount">
                          <span>Deposit Paid</span>
                          <span>-{formatMoney(bill.reservation_deposit_amount)}</span>
                        </div>
                      </>
                    ) : null}
                    <div className="staff-receipt__line staff-receipt__line--total">
                      <span>Total</span>
                      <span>{formatMoney(bill.total_amount)}</span>
                    </div>
                  </div>

                  <div className="staff-receipt__actions">
                    <Button variant="ghost" icon="receipt" onClick={handlePrint}>
                      View & Print Bill
                    </Button>
                  </div>
                </section>

                <section className="staff-payment-panel">
                  {(bill?.order_status === 'Pending Payment' || bill?.order_status === 'Billed') && (
                    <div 
                      className={`staff-cash-pending-card ${shouldShake ? 'sfx-shake' : ''}`}
                      style={{ position: 'relative', overflow: 'hidden', transition: 'border-color 0.2s ease' }}
                    >
                      <style>{`
                        @keyframes sfx-shake-anim {
                          0%, 100% { transform: translateX(0); }
                          20%, 60% { transform: translateX(-6px); }
                          40%, 80% { transform: translateX(6px); }
                        }
                        .sfx-shake {
                          animation: sfx-shake-anim 0.3s ease-in-out;
                          border-color: #ff6b6b !important;
                          box-shadow: 0 0 10px rgba(255, 107, 107, 0.25) !important;
                        }
                        @keyframes sfx-shimmer-anim {
                          0% { background-position: -200% 0; }
                          100% { background-position: 200% 0; }
                        }
                        .sfx-shimmer {
                          animation: sfx-shimmer-anim 1.5s infinite linear;
                        }
                        @media (prefers-reduced-motion: reduce) {
                          .sfx-shake {
                            animation: none !important;
                            border-color: #ff6b6b !important;
                          }
                          .sfx-shimmer {
                            animation: none !important;
                            background: #e2e8f0 !important;
                          }
                        }
                      `}</style>
                      
                      {busyKey === 'confirm_cash' && (
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          backgroundColor: 'rgba(255, 255, 255, 0.85)',
                          backdropFilter: 'blur(1px)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 10,
                        }}>
                          <div 
                            className="sfx-shimmer" 
                            style={{
                              width: '80%',
                              height: '20px',
                              background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)',
                              backgroundSize: '200% 100%',
                              borderRadius: '4px',
                            }} 
                          />
                        </div>
                      )}
                      <div className="staff-cash-pending-content">
                        <div className="staff-cash-icon-wrapper">
                          <span className="staff-cash-icon">💵</span>
                        </div>
                        <div>
                          <p className="staff-cash-title">Cash Payment Requested</p>
                          <p className="staff-cash-desc">Customer is waiting for staff to collect {formatMoney(bill.total_amount)} at the table.</p>
                        </div>
                      </div>
                      <button 
                        className="staff-btn staff-btn--glow-green w-full"
                        onClick={handleConfirmCashPayment}
                        disabled={busyKey === 'confirm_cash'}
                        style={{ marginTop: '12px' }}
                      >
                        {busyKey === 'confirm_cash' ? 'Confirming...' : 'Confirm Cash Received'}
                      </button>
                    </div>
                  )}

                  <h3>Apply promo code</h3>
                  <p className="staff-payment-panel__hint">
                    Manual discounts are available to managers only.
                  </p>

                  <div className="staff-voucher-field">
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      placeholder="WEEKEND10, NEWMEM50…"
                      disabled={!manager || busyKey === "promo"}
                    />
                    <Button
                      variant="ghost"
                      onClick={handleApplyPromoCode}
                      disabled={!manager || !promoCode.trim() || busyKey === "promo"}
                    >
                      Apply
                    </Button>
                  </div>

                  {!manager && (
                    <span className="staff-voucher-lock">
                      <LockIcon />
                      Only managers can apply promo codes
                    </span>
                  )}

                  {bill.applied_promo ? (
                    <p className="staff-voucher-applied">
                      Applied: {bill.applied_promo.promo_code} (
                      {bill.applied_promo.promotion_name})
                    </p>
                  ) : null}

                  <h3>Payment method</h3>
                  <div className="staff-pay-methods" role="radiogroup" aria-label="Payment method">
                    {PAYMENT_METHODS.map((method) => (
                      <button
                        key={method.id}
                        type="button"
                        role="radio"
                        aria-checked={paymentMethodId === method.id}
                        className={`staff-pay-method${
                          paymentMethodId === method.id ? " is-active" : ""
                        }`}
                        onClick={() => {
                          setPaymentMethodId(method.id);
                          if (method.key !== "cash") {
                            setAmountPaid(String(bill.total_amount ?? ""));
                          }
                        }}
                      >
                        <span className="staff-pay-method__label">{method.label}</span>
                        <span className="staff-pay-method__sub">{method.sub}</span>
                      </button>
                    ))}
                  </div>

                  {paymentMethodId === 2 ? (
                    <CheckoutPayment
                      orderId={bill.order_id}
                      amount={bill.total_amount}
                      onPollStatus={(orderId) => checkOrderStatus(orderId).then(res => res.data)}
                      onSuccess={() => {
                        toast("Payment successful!", "success");
                        handleCheckout(); 
                      }}
                    />
                  ) : (
                    <div className="staff-pay-amount">
                      <label htmlFor="staff-amount-paid">
                        {paymentMethodId === 1 ? "Cash received" : "Amount paid"}
                      </label>
                      <input
                        id="staff-amount-paid"
                        type="number"
                        min={0}
                        step={1000}
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(e.target.value)}
                      />
                      {paymentMethodId === 1 && changeDue > 0 ? (
                        <p className="staff-pay-change">
                          Change due: {formatMoney(changeDue)}
                        </p>
                      ) : null}
                    </div>
                  )}

                  <div className="staff-payment-actions">
                    {paymentMethodId !== 4 && (
                      <Button
                        variant="primary"
                        icon="card"
                        disabled={
                          !bill.order_id ||
                          !(bill.items || []).length ||
                          busyKey === "checkout"
                        }
                        onClick={handleCheckout}
                      >
                        {busyKey === "checkout" ? "Processing…" : "Complete Payment"}
                      </Button>
                    )}

                    {manager ? (
                      <Button
                        variant="ghost"
                        disabled={!bill.order_id || busyKey === "void"}
                        onClick={handleVoidBill}
                      >
                        <span style={{ color: "#f0a0a0" }}>
                          {busyKey === "void" ? "Voiding bill…" : "Refund / Void Bill"}
                        </span>
                      </Button>
                    ) : null}
                  </div>

                  <div className="staff-payment-actions" style={{ marginTop: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                    <Button 
                      variant="ghost" 
                      onClick={() => setIsSplitItemModalOpen(true)}
                      disabled={!bill.order_id || (bill.items || []).length === 0}
                    >
                      Split by Item
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={() => toast("Split by Amount UI will be implemented next.", "info")}
                      disabled={!bill.order_id}
                    >
                      Split by Amount (Even)
                    </Button>
                  </div>
                </section>

                {timeline.length > 0 && (
                  <section className="staff-payment-panel" style={{ marginTop: '1rem' }}>
                    <h3>Order Timeline</h3>
                    <div className="staff-timeline">
                      {timeline.map((log) => {
                        let details = {};
                        try { details = JSON.parse(log.new_value_json || '{}'); } catch(e){}
                        const dateStr = new Date(log.created_at).toLocaleString('vi-VN', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        });
                        return (
                          <div key={log.audit_log_id} className="staff-timeline-item" style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px dashed var(--border-subtle)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <strong style={{ color: 'var(--text-main)', fontSize: '14px' }}>{log.action_name}</strong>
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{dateStr}</span>
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                {log.full_name || log.username || details.staffName || 'System'}
                              </span>
                              {details.amountPaid && (
                                <span style={{ marginLeft: '12px', color: 'var(--color-success)', fontWeight: '500' }}>
                                  {formatMoney(details.amountPaid)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <SplitBillModal 
        isOpen={isSplitItemModalOpen}
        onClose={() => setIsSplitItemModalOpen(false)}
        bill={bill}
        userId={userId}
        toast={toast}
        onSplitSuccess={() => loadBill(Number(selectedTableId))}
      />
    </div>
  );
}

export default StaffPaymentTab;
