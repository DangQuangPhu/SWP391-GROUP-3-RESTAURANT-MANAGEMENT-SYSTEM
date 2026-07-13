import { useCallback, useEffect, useMemo, useState } from "react";
import {
  SectionHead,
  Button,
  EmptyState,
  NotConnectedNote,
} from "./StaffUI.jsx";
import {
  applyStaffVoucher,
  checkoutStaffPayment,
  fetchStaffBill,
  voidStaffBill,
  createVnpayUrl,
  checkOrderStatus,
} from "../services/staffApi.js";
import { DEMO_NOTICE } from "@/shared/constants.js";
import { SplitBillModal } from "./SplitBillModal.jsx";
import CheckoutPayment from "./CheckoutPayment.jsx";
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
  const [voucherCode, setVoucherCode] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState(1);
  const [amountPaid, setAmountPaid] = useState("");
  const [busyKey, setBusyKey] = useState(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState(null);
  const [isSplitItemModalOpen, setIsSplitItemModalOpen] = useState(false);

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
        return;
      }
      setBillLoading(true);
      try {
        const res = await fetchStaffBill(tableId);
        setBill(res.data);
        setAmountPaid(String(res.data?.total_amount ?? ""));
        setCheckoutSuccess(null);
      } catch (error) {
        setBill(null);
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

  const changeDue = useMemo(() => {
    const paid = Number(amountPaid);
    const total = Number(bill?.total_amount) || 0;
    if (!Number.isFinite(paid) || paid < total) return 0;
    return paid - total;
  }, [amountPaid, bill?.total_amount]);

  const handleApplyVoucher = async () => {
    if (!manager || !selectedTableId || !voucherCode.trim()) return;
    setBusyKey("voucher");
    try {
      const res = await applyStaffVoucher(
        Number(selectedTableId),
        userId,
        voucherCode.trim()
      );
      if (res?.data) {
        setBill(res.data);
        setAmountPaid(String(res.data.total_amount ?? ""));
        toast(`Voucher applied: ${res.data.applied_voucher?.voucher_code || ""}`, "success");
      }
    } catch (error) {
      toast(error.message || "Could not apply voucher", "error");
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
        voucher_id: bill.applied_voucher?.voucher_id ?? null,
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
      setVoucherCode("");
      onRefresh?.();
    } catch (error) {
      toast(error.message || "Payment failed", "error");
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
          <aside className="staff-payment-sidebar staff-card staff-card--compact staff-card--flush" style={{ display: "flex", gap: "8px", alignItems: "center", padding: "12px 16px" }}>
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
                    {table.table_number} · {table.area_name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ alignSelf: "flex-end" }}>
              <Button
                variant="ghost"
                size="sm"
                icon="refresh"
                onClick={onRefresh}
                disabled={refreshing}
              />
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
                  <h3>Apply voucher</h3>
                  <p className="staff-payment-panel__hint">
                    Manual discounts are available to managers only.
                  </p>

                  <div className="staff-voucher-field">
                    <input
                      type="text"
                      value={voucherCode}
                      onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                      placeholder="WEEKEND10, NEWMEM50…"
                      disabled={!manager || busyKey === "voucher"}
                    />
                    <Button
                      variant="ghost"
                      onClick={handleApplyVoucher}
                      disabled={!manager || !voucherCode.trim() || busyKey === "voucher"}
                    >
                      Apply
                    </Button>
                  </div>

                  {!manager ? (
                    <span className="staff-voucher-lock">
                      <LockIcon />
                      Only managers can apply vouchers
                    </span>
                  ) : null}

                  {bill.applied_voucher ? (
                    <p className="staff-voucher-applied">
                      Applied: {bill.applied_voucher.voucher_code} (
                      {bill.applied_voucher.promotion_name})
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
