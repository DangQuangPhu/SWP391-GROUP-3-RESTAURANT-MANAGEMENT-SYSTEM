import { useState } from "react";
import { Button } from "./StaffUI.jsx";
import { splitOrderItemsApi } from "../services/staffApi.js";
import "../styles/staff-order-tab.css";

export function SplitBillModal({ isOpen, onClose, bill, userId, toast, onSplitSuccess }) {
  // Track quantities to split: { [order_item_id]: split_quantity }
  const [splitQuantities, setSplitQuantities] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !bill) return null;

  const items = bill.items || [];

  const handleIncrement = (item) => {
    const current = splitQuantities[item.order_item_id] || 0;
    if (current < item.quantity) {
      setSplitQuantities((prev) => ({ ...prev, [item.order_item_id]: current + 1 }));
    }
  };

  const handleDecrement = (item) => {
    const current = splitQuantities[item.order_item_id] || 0;
    if (current > 0) {
      setSplitQuantities((prev) => ({ ...prev, [item.order_item_id]: current - 1 }));
    }
  };

  const handleSplit = async () => {
    const itemsToSplit = Object.entries(splitQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([order_item_id, split_quantity]) => ({
        order_item_id: Number(order_item_id),
        split_quantity,
      }));

    if (itemsToSplit.length === 0) {
      toast("Please select at least one item to split.", "error");
      return;
    }

    // Check if splitting ALL items
    const totalOriginalQty = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalSplitQty = itemsToSplit.reduce((sum, item) => sum + item.split_quantity, 0);
    
    if (totalOriginalQty === totalSplitQty) {
      toast("Cannot split all items into a new bill. Just use the original bill.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      await splitOrderItemsApi(bill.order_id, userId, itemsToSplit);
      toast("Items successfully split into a new bill.", "success");
      onSplitSuccess?.();
      onClose();
    } catch (error) {
      toast(error.message || "Failed to split bill.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate totals for preview
  const splitSubtotal = items.reduce((sum, item) => {
    const qty = splitQuantities[item.order_item_id] || 0;
    return sum + qty * Number(item.unit_price || item.line_total / item.quantity);
  }, 0);

  return (
    <div className="staff-order-modal" role="dialog" aria-modal="true">
      <div 
        className="staff-order-modal__backdrop" 
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="staff-order-modal__panel" style={{ maxWidth: '500px' }}>
        <header className="staff-order-modal__head">
          <h2>Split by Item</h2>
          <button type="button" className="staff-order-modal__close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </header>

        <div className="staff-order-modal__body">
          <p style={{ marginBottom: '1rem', color: '#8b8a91' }}>
            Select the items and quantities you want to move to a <strong>new bill</strong> for this table.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto' }}>
            {items.map((item) => {
              const qtyToSplit = splitQuantities[item.order_item_id] || 0;
              return (
                <div key={item.order_item_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: 'var(--bg-layer-2)', borderRadius: '6px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500 }}>{item.dish_name}</div>
                    <div style={{ fontSize: '0.875rem', color: '#8b8a91' }}>Max: {item.quantity}</div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Button variant="ghost" onClick={() => handleDecrement(item)} disabled={qtyToSplit <= 0}>-</Button>
                    <span style={{ width: '2rem', textAlign: 'center', fontWeight: 600 }}>{qtyToSplit}</span>
                    <Button variant="ghost" onClick={() => handleIncrement(item)} disabled={qtyToSplit >= item.quantity}>+</Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
            <span>New Bill Subtotal:</span>
            <span>{new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(splitSubtotal)}</span>
          </div>
        </div>

        <footer className="staff-order-modal__foot">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button variant="primary" onClick={handleSplit} disabled={isSubmitting || splitSubtotal === 0}>
            {isSubmitting ? "Splitting..." : "Confirm Split"}
          </Button>
        </footer>
      </div>
    </div>
  );
}
