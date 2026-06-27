import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { getPaymentDetails } from "../services/profileApi";
import { format } from "date-fns";
import "@/styles/PaymentDetailsModal.css";

function PaymentDetailsModal({ isOpen, onClose, userId, paymentId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose?.();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    let active = true;
    const fetchDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await getPaymentDetails(userId, paymentId);
        if (active) {
          setData(res);
        }
      } catch (err) {
        if (active) {
          setError("Could not load payment details.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    if (isOpen && paymentId && userId) {
      fetchDetails();
    } else {
      setData(null);
    }
    
    return () => { active = false; };
  }, [isOpen, paymentId, userId]);

  if (!isOpen) return null;

  const formatVND = (amount) => {
    return `${Math.round(amount).toLocaleString('vi-VN')} VND`;
  };

  const renderContent = () => {
    if (loading) {
      return <div className="payment-modal__loading">Loading details...</div>;
    }
    if (error) {
      return <div className="payment-modal__error">{error}</div>;
    }
    if (!data || !data.payment) return null;

    const { payment, items } = data;
    const isRefund = payment.payment_status === "Refunded";
    
    return (
      <div className="payment-modal__details">
        <div className="payment-modal__header-info">
          <h3 className="payment-modal__amount" style={{ color: isRefund ? "var(--phurai-success, #34c759)" : "inherit" }}>
            {isRefund ? "+" : "-"}{formatVND(payment.amount_paid)}
          </h3>
          <p className="payment-modal__status">{payment.payment_status}</p>
          <p className="payment-modal__date">
            {payment.paid_at ? format(new Date(payment.paid_at), "MMM d, yyyy h:mm a") : ""}
          </p>
        </div>

        <div className="payment-modal__section">
          <h4 className="payment-modal__section-title">Transaction Info</h4>
          <div className="payment-modal__row">
            <span>Method</span>
            <span>{payment.method_name || "Unknown"}</span>
          </div>
          <div className="payment-modal__row">
            <span>Reference</span>
            <span>{payment.transaction_ref || "N/A"}</span>
          </div>
        </div>

        {payment.order_id && (
          <div className="payment-modal__section">
            <h4 className="payment-modal__section-title">Order #{payment.order_id} {payment.order_type ? `(${payment.order_type})` : ""}</h4>
            <div className="payment-modal__items">
              {items && items.map(item => (
                <div key={item.order_item_id} className="payment-modal__item-row">
                  <span>{item.quantity}x {item.item_name}</span>
                  <span>{formatVND(item.subtotal)}</span>
                </div>
              ))}
            </div>
            <div className="payment-modal__totals">
              <div className="payment-modal__row">
                <span>Subtotal</span>
                <span>{formatVND(payment.total_amount)}</span>
              </div>
              <div className="payment-modal__row">
                <span>Tax</span>
                <span>{formatVND(payment.tax_amount)}</span>
              </div>
              {payment.discount_amount > 0 && (
                <div className="payment-modal__row">
                  <span>Discount</span>
                  <span style={{ color: "var(--phurai-success, #34c759)" }}>-{formatVND(payment.discount_amount)}</span>
                </div>
              )}
              <div className="payment-modal__row payment-modal__row--bold">
                <span>Total</span>
                <span>{formatVND(payment.net_amount)}</span>
              </div>
            </div>
          </div>
        )}

        {payment.reservation_id && !payment.order_id && (
          <div className="payment-modal__section">
            <h4 className="payment-modal__section-title">Reservation Deposit</h4>
            <div className="payment-modal__row">
              <span>Reservation ID</span>
              <span>#{payment.reservation_id}</span>
            </div>
            <div className="payment-modal__row">
              <span>Date & Time</span>
              <span>{payment.reservation_start_at ? format(new Date(payment.reservation_start_at), "MMM d, yyyy h:mm a") : ""}</span>
            </div>
            <div className="payment-modal__row">
              <span>Guests</span>
              <span>{payment.guest_count}</span>
            </div>
            <div className="payment-modal__row">
              <span>Table</span>
              <span>{payment.table_number || "Unassigned"}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return createPortal(
    <div className="payment-modal__backdrop">
      <div className="payment-modal__panel mac-animate" ref={panelRef}>
        <button type="button" className="payment-modal__close" onClick={onClose} aria-label="Close">
          &times;
        </button>
        <h2 className="payment-modal__title">Transaction Details</h2>
        {renderContent()}
      </div>
    </div>,
    document.body
  );
}

export default PaymentDetailsModal;
