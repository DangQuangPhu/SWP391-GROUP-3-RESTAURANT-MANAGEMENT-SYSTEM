import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "./StaffUI.jsx";
import { asArray } from "@/utils/asArray.js";
import "../styles/staff-order-tab.css";

function formatPrice(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function StaffAddItemModal({ open, dishes, onClose, onSubmit, busy }) {
  const dishList = asArray(dishes);
  const [search, setSearch] = useState("");
  const [dishId, setDishId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return dishList;
    return dishList.filter(
      (d) =>
        d.dish_name.toLowerCase().includes(kw) ||
        String(d.category_name || "").toLowerCase().includes(kw)
    );
  }, [dishList, search]);

  const selected = dishList.find((d) => String(d.dish_id) === String(dishId));

  if (!open) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!dishId) return;
    onSubmit({
      dish_id: Number(dishId),
      quantity: Number(quantity) || 1,
      notes: notes.trim() || null,
    });
  };

  return createPortal(
    <div className="staff-order-modal fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center" role="dialog" aria-modal="true">
      <button
        type="button"
        className="staff-order-modal__backdrop fixed inset-0 z-[100] w-screen h-screen bg-black/50"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="staff-order-modal__panel relative z-[101]">
        <header className="staff-order-modal__head">
          <div>
            <h3 id="staff-add-item-title">Add Item</h3>
            <p>Select a menu item and add it to the active table bill.</p>
          </div>
          <button type="button" className="staff-order-modal__close" onClick={onClose}>
            ×
          </button>
        </header>

        <form className="staff-order-modal__body" onSubmit={handleSubmit}>
          <label className="staff-order-field">
            <span>Search menu</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Dish name or category…"
            />
          </label>

          <label className="staff-order-field">
            <span>Item</span>
            <select
              value={dishId}
              onChange={(e) => setDishId(e.target.value)}
              required
            >
              <option value="">— Select item —</option>
              {filtered.map((dish) => (
                <option key={dish.dish_id} value={dish.dish_id}>
                  {dish.dish_name} · {formatPrice(dish.price)}
                </option>
              ))}
            </select>
          </label>

          {selected ? (
            <p className="staff-order-modal__hint">
              {selected.category_name} — {formatPrice(selected.price)}
            </p>
          ) : null}

          <div className="staff-order-modal__row">
            <label className="staff-order-field">
              <span>Quantity</span>
              <input
                type="number"
                min={1}
                max={99}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </label>
            <label className="staff-order-field staff-order-field--grow">
              <span>Notes (optional)</span>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Less spicy, no onion…"
              />
            </label>
          </div>

          <footer className="staff-order-modal__foot">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={busy || !dishId}>
              {busy ? "Adding…" : "Add to bill"}
            </Button>
          </footer>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default StaffAddItemModal;
