import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  verifyCustomerEmailApi,
} from "../services/staffApi.js";
import { DEMO_NOTICE } from "@/shared/constants.js";
import { SplitBillModal } from "./SplitBillModal.jsx";
import CheckoutPayment from "./CheckoutPayment.jsx";
import { apiPost, profileRequestHeaders } from "@/core/api/httpClient.js";
import { useSocket } from "@/core/socket/SocketContext.jsx";
import { StaffPaymentPanel } from "./StaffPaymentPanel.jsx";
import { useBillPDF } from "../hooks/useBillPDF.js";
import "../styles/staff-payment-tab.css";

const PAYMENT_METHODS = [
  { id: 1, key: "cash", label: "Cash", sub: "Cash at table" },
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

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  );
}

function StaffPaymentTab({
  tables: propsTables,
  setTables,
  orderTables,
  setOrderTables,
  dataSource,
  user,
  toast,
  refreshing,
  onRefresh,
}) {
  const navigate = useNavigate();
  const tables = propsTables || orderTables || [];
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
  // Real-time SePay payment confirmation state
  const [paymentConfirmed, setPaymentConfirmed] = useState(null); // { orderId, amount, confirmedAt }
  // Customer Email / Member Loyalty state
  const [customerEmail, setCustomerEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState(null); // null | 'checking' | 'verified' | 'not_found'
  const [verifiedUser, setVerifiedUser] = useState(null);
  const [lastPaidBill, setLastPaidBill] = useState(null);

  const { socket } = useSocket();
  const [shouldShake, setShouldShake] = useState(false);
  const { printBill } = useBillPDF();

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
      setPaymentConfirmed(null);  // clear previous confirmation when switching tables
      setCustomerEmail("");
      setEmailStatus(null);
      setVerifiedUser(null);
      loadBill(Number(selectedTableId));
    }
  }, [selectedTableId, loadBill]);

  /* ── Debounced Customer Email Lookup for Loyalty ── */
  useEffect(() => {
    const cleanEmail = customerEmail.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setEmailStatus(null);
      setVerifiedUser(null);
      return;
    }

    setEmailStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const res = await verifyCustomerEmailApi(cleanEmail);
        if (res?.exists) {
          setEmailStatus("verified");
          setVerifiedUser(res.user);
        } else {
          setEmailStatus("not_found");
          setVerifiedUser(null);
        }
      } catch {
        setEmailStatus("not_found");
        setVerifiedUser(null);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [customerEmail]);

  /* ── Socket Listeners ── */
  useEffect(() => {
    if (!socket) return;

    const handleCashRequested = (data) => {
      const tableId = Number(data.tableId);
      if (tableId) {
        setPendingCashTableIds((prev) => new Set(prev).add(tableId));
        toast(`Table ${data.tableNumber || tableId} requested Cash Payment!`, "info");
      }
    };

    socket.on("table:cash_payment_requested", handleCashRequested);
    return () => {
      socket.off("table:cash_payment_requested", handleCashRequested);
    };
  }, [socket, toast]);

  /* ── PAYMENT_STATUS_CHANGED — SePay confirms QR payment ── */
  useEffect(() => {
    if (!socket) return;

    const handlePaymentConfirmed = (payload = {}) => {
      const confirmedOrderId = payload.orderId || payload.order_id;
      const currentOrderId = bill?.order_id;
      // Only react if this event is for the currently visible bill
      if (confirmedOrderId && currentOrderId && String(confirmedOrderId) === String(currentOrderId)) {
        const confirmedAt = new Date().toISOString();
        setPaymentConfirmed({
          orderId: confirmedOrderId,
          amount: payload.amount_paid || payload.amount || bill?.total_amount || 0,
          confirmedAt,
        });
        // Auto-refresh bill after 1.5s so order_status updates to "Paid"
        setTimeout(() => loadBill(Number(selectedTableId)), 1500);
      }
    };

    socket.on("PAYMENT_STATUS_CHANGED", handlePaymentConfirmed);
    socket.on("QR_SESSION_PAYMENT_COMPLETED", handlePaymentConfirmed);
    return () => {
      socket.off("PAYMENT_STATUS_CHANGED", handlePaymentConfirmed);
      socket.off("QR_SESSION_PAYMENT_COMPLETED", handlePaymentConfirmed);
    };
  }, [socket, bill?.order_id, selectedTableId, loadBill]);

  const changeDue = useMemo(() => {
    const paid = Number(amountPaid) || 0;
    const total = Number(bill?.total_amount) || 0;
    return Math.max(0, paid - total);
  }, [amountPaid, bill?.total_amount]);

  const handleApplyPromoCode = async () => {
    if (!selectedTableId || !promoCode.trim()) return;
    setBusyKey("promo");
    try {
      const res = await applyStaffPromoCode(
        Number(selectedTableId),
        userId,
        promoCode.trim()
      );
      setBill(res.data);
      setAmountPaid(String(res.data?.total_amount ?? ""));
      if (res.data?.applied_promo) {
        toast(`Promo code applied: ${res.data.applied_promo.promo_code}`, "success");
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
        customer_email: emailStatus === "verified" ? customerEmail.trim() : null,
      });
      const payload = res?.data;
      setCheckoutSuccess(payload);
      setLastPaidBill({
        ...bill,
        ...(payload || {}),
        customer_email: customerEmail,
        contact_name: verifiedUser?.full_name || bill?.contact_name,
      });
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

    const originalTables = [...tables];
    const originalBill = bill;
    const originalSelectedTableId = selectedTableId;
    const originalPendingCashTableIds = new Set(pendingCashTableIds);

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
        setTables(originalTables);
        setPendingCashTableIds(originalPendingCashTableIds);
        setBill(originalBill);
        setSelectedTableId(originalSelectedTableId);
        toast(res.message || "Confirmation failed", "error");
        setShouldShake(true);
        setTimeout(() => setShouldShake(false), 500);
      }
    } catch (error) {
      setTables(originalTables);
      setPendingCashTableIds(originalPendingCashTableIds);
      setBill(originalBill);
      setSelectedTableId(originalSelectedTableId);
      toast(error.message || "Network error", "error");
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
    if (!bill) {
      toast("No bill selected to print.", "error");
      return;
    }
    printBill(bill, {
      customerName: verifiedUser?.full_name || bill?.contact_name || bill?.customer_name,
      customerEmail: verifiedUser?.email || customerEmail,
      paymentMethodId,
    });
  };

  const nowLabel = new Date().toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`staff-payment-wrap${refreshing || billLoading ? " is-loading" : ""}`}>
      {checkoutSuccess || lastPaidBill ? (
        <div
          className="staff-card staff-payment-success-card"
          style={{
            marginBottom: "16px",
            background: "rgba(52, 199, 89, 0.12)",
            border: "1px solid rgba(52, 199, 89, 0.3)",
            borderRadius: "12px",
            padding: "14px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div className="staff-payment-success" role="status" style={{ color: "#15803d", fontWeight: "bold", fontSize: "14px" }}>
            🎉 Paid & Session Closed — Table {lastPaidBill?.table_number || checkoutSuccess?.table_number || ""} ({formatMoney(lastPaidBill?.total_amount || checkoutSuccess?.total_amount || 0)})
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              type="button"
              className="staff-btn"
              style={{
                padding: "8px 16px",
                background: "#15803d",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontWeight: "bold",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
              onClick={() =>
                printBill(lastPaidBill || bill, {
                  customerName: verifiedUser?.full_name || lastPaidBill?.contact_name,
                  customerEmail: lastPaidBill?.customer_email || customerEmail,
                })
              }
            >
              🖨 Print Closed Bill / Export PDF
            </button>

            <button
              type="button"
              className="staff-btn"
              style={{
                padding: "8px 16px",
                background: "#0284c7",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontWeight: "bold",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
              onClick={() => {
                setCheckoutSuccess(null);
                setLastPaidBill(null);
                const remainingTables = occupiedTables.filter(
                  (t) => String(t.table_id) !== String(lastPaidBill?.table_id || checkoutSuccess?.table_id)
                );
                if (remainingTables.length > 0) {
                  setSelectedTableId(String(remainingTables[0].table_id));
                } else {
                  navigate("/staff/tables");
                }
              }}
            >
              ← {occupiedTables.length > 1 ? "Check Remaining Tables" : "Back to Floor Plan"}
            </button>
          </div>
        </div>
      ) : null}

      {!occupiedTables.length ? (
        <div className="staff-card" style={{ textAlign: "center", padding: "32px 16px" }}>
          <EmptyState
            icon="table"
            title="No occupied tables needing payment"
            hint="Check in a table and serve items before collecting payment."
          />
          <div style={{ display: "flex", justifyContent: "center", marginTop: "20px" }}>
            <button
              type="button"
              className="staff-btn"
              style={{
                padding: "10px 22px",
                background: "#0f172a",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontWeight: "bold",
                fontSize: "14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
              onClick={() => navigate("/staff/tables")}
            >
              ← Return to Table Map (Sơ đồ bàn)
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Top Integrated Control Header */}
          <div className="staff-payment-top-bar">
            <div className="staff-payment-top-bar__left">
              <span className="staff-payment-top-bar__label">Select Occupied Table:</span>
              <div className="staff-payment-top-bar__select-wrap">
                <select
                  id="staff-payment-table-select"
                  className="staff-payment-top-bar__select"
                  value={selectedTableId}
                  onChange={(e) => setSelectedTableId(e.target.value)}
                >
                  {occupiedTables.map((table) => (
                    <option key={table.table_id} value={table.table_id}>
                      Table {table.table_number} · {table.area_name} ({table.capacity} Seats) {pendingCashTableIds.has(table.table_id) ? '⚠️ [Cash Pending]' : ''}
                    </option>
                  ))}
                </select>
                <span className="staff-payment-top-bar__select-icon">
                  <ChevronDownIcon />
                </span>
              </div>

              {pendingCashTableIds.size > 0 && (
                <div style={{ display: "flex", gap: "8px" }}>
                  {Array.from(pendingCashTableIds).map((tId) => {
                    const table = occupiedTables.find((t) => t.table_id === tId);
                    if (!table) return null;
                    return (
                      <button
                        key={tId}
                        className="staff-btn staff-btn--glow-green"
                        onClick={() => setSelectedTableId(String(tId))}
                        style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "10px" }}
                      >
                        💵 Table {table.table_number} Cash Action
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="staff-payment-top-bar__right">
              <span className="staff-payment-badge">
                ● {occupiedTables.length} Occupied Tables Active
              </span>
              <Button
                variant="ghost"
                size="sm"
                icon="refresh"
                onClick={onRefresh}
                disabled={refreshing}
              />
            </div>
          </div>

          {/* Main 2-Column Payment Cockpit Grid */}
          <div className="staff-payment-main">
            {!bill ? (
              <EmptyState
                icon="receipt"
                title="Loading bill…"
                hint="Select an occupied table to view the check."
              />
            ) : (
              <div className="staff-payment-grid">
                {/* Left Column: Phūrai Gold Receipt Card */}
                <section className="staff-receipt" aria-label="Bill preview">
                  <header className="staff-receipt__head">
                    <h2 className="staff-receipt__brand">Phūrai</h2>
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
                      <span>Service Charge ({bill.service_charge_percent || 5}%)</span>
                      <span>{formatMoney(bill.service_charge)}</span>
                    </div>
                    {bill.discount_amount > 0 ? (
                      <div className="staff-receipt__line staff-receipt__line--discount">
                        <span>Discount Voucher</span>
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
                          <span>Deposit Deducted</span>
                          <span>-{formatMoney(bill.reservation_deposit_amount)}</span>
                        </div>
                      </>
                    ) : null}
                    <div className="staff-receipt__line staff-receipt__line--grand">
                      <span>Total Amount</span>
                      <span>{formatMoney(bill.total_amount)}</span>
                    </div>
                  </div>

                  <div className="staff-receipt__actions">
                    <Button variant="ghost" icon="receipt" onClick={handlePrint}>
                      View & Print Thermal Receipt
                    </Button>
                  </div>
                </section>

                {/* Right Column: Apple Cinematic Payment Panel — visual-only component */}
                <StaffPaymentPanel
                  bill={bill}
                  paymentMethodId={paymentMethodId}
                  setPaymentMethodId={setPaymentMethodId}
                  amountPaid={amountPaid}
                  setAmountPaid={setAmountPaid}
                  changeDue={changeDue}
                  promoCode={promoCode}
                  setPromoCode={setPromoCode}
                  busyKey={busyKey}
                  shouldShake={shouldShake}
                  manager={manager}
                  timeline={timeline}
                  paymentConfirmed={paymentConfirmed}
                  customerEmail={customerEmail}
                  setCustomerEmail={setCustomerEmail}
                  emailStatus={emailStatus}
                  verifiedUser={verifiedUser}
                  onApplyPromo={handleApplyPromoCode}
                  onCheckout={handleCheckout}
                  onConfirmCash={handleConfirmCashPayment}
                  onVoidBill={handleVoidBill}
                  onPrint={handlePrint}
                  onSplitItem={() => setIsSplitItemModalOpen(true)}
                  onSplitAmount={() => toast("Split by Amount UI will be implemented next.", "info")}
                  qrChildren={
                    <CheckoutPayment
                      orderId={bill.order_id}
                      amount={bill.total_amount}
                      onPollStatus={(orderId) => checkOrderStatus(orderId).then(res => res.data)}
                      onSuccess={() => {
                        toast("Online payment confirmed!", "success");
                        setPaymentConfirmed(true);
                        loadBill(Number(selectedTableId));
                        onRefresh?.();
                      }}
                    />
                  }
                />
              </div>
            )}
          </div>
        </>
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
