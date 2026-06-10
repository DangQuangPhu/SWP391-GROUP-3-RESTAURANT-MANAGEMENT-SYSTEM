import { useEffect, useMemo, useState } from "react";
import { formatVND } from "@/utils/formatCurrency";
import { getPreorderMenu, savePreorder } from "@/services/reservationApi";

/**
 * Inline pre-order editor for a single reservation (optional Phase 2).
 * Lets the guest attach dishes to an upcoming reservation. Prices are
 * always re-validated on the backend; the UI only previews totals.
 */
function PreorderPanel({ reservation, userId, onSaved }) {
  const [menu, setMenu] = useState([]);
  const [menuStatus, setMenuStatus] = useState("idle"); // idle | loading | ready | error
  // quantities keyed by dish_id
  const [quantities, setQuantities] = useState(() => {
    const initial = {};
    (reservation.preorders || []).forEach((p) => {
      initial[p.dish_id] = p.quantity;
    });
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type, text }

  useEffect(() => {
    let active = true;
    setMenuStatus("loading");
    getPreorderMenu()
      .then((res) => {
        if (!active) return;
        setMenu(res?.dishes || []);
        setMenuStatus("ready");
      })
      .catch(() => {
        if (active) setMenuStatus("error");
      });
    return () => {
      active = false;
    };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const dish of menu) {
      const key = dish.category_name || "Menu";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(dish);
    }
    return [...map.entries()];
  }, [menu]);

  const priceById = useMemo(() => {
    const map = new Map();
    for (const dish of menu) map.set(dish.dish_id, dish.price);
    return map;
  }, [menu]);

  const total = useMemo(() => {
    return Object.entries(quantities).reduce((sum, [dishId, qty]) => {
      const price = priceById.get(Number(dishId)) || 0;
      return sum + price * qty;
    }, 0);
  }, [quantities, priceById]);

  const selectedCount = useMemo(
    () => Object.values(quantities).filter((q) => q > 0).length,
    [quantities]
  );

  const setQty = (dishId, next) => {
    setFeedback(null);
    setQuantities((prev) => {
      const value = Math.max(0, Math.min(20, next));
      const copy = { ...prev };
      if (value <= 0) delete copy[dishId];
      else copy[dishId] = value;
      return copy;
    });
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setFeedback(null);
    const items = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([dishId, qty]) => ({ dish_id: Number(dishId), quantity: qty }));

    try {
      const res = await savePreorder(reservation.reservation_id, items, userId);
      setFeedback({ type: "success", text: res?.message || "Pre-order saved." });
      onSaved?.(reservation.reservation_id, res?.preorders || []);
    } catch (err) {
      setFeedback({
        type: "error",
        text: err?.message || "Could not save pre-order.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rzv-preorder">
      <div className="rzv-preorder__head">
        <h4 className="rzv-preorder__title">Pre-order dishes</h4>
        <p className="rzv-preorder__hint">
          Optional — have your favourites prepared ahead of arrival.
        </p>
      </div>

      {menuStatus === "loading" ? (
        <p className="rzv-preorder__state">Loading menu…</p>
      ) : null}
      {menuStatus === "error" ? (
        <p className="rzv-preorder__state rzv-preorder__state--error">
          Could not load the menu. Please try again later.
        </p>
      ) : null}

      {menuStatus === "ready" ? (
        <div className="rzv-preorder__menu">
          {grouped.map(([category, dishes]) => (
            <div key={category} className="rzv-preorder__group">
              <span className="rzv-preorder__group-name">{category}</span>
              <ul className="rzv-preorder__list">
                {dishes.map((dish) => {
                  const qty = quantities[dish.dish_id] || 0;
                  return (
                    <li key={dish.dish_id} className="rzv-preorder__item">
                      <div className="rzv-preorder__item-info">
                        <span className="rzv-preorder__item-name">{dish.dish_name}</span>
                        <span className="rzv-preorder__item-price">
                          {formatVND(dish.price)}
                        </span>
                      </div>
                      <div className="rzv-preorder__stepper">
                        <button
                          type="button"
                          className="rzv-preorder__step"
                          aria-label={`Remove one ${dish.dish_name}`}
                          disabled={qty <= 0}
                          onClick={() => setQty(dish.dish_id, qty - 1)}
                        >
                          −
                        </button>
                        <span className="rzv-preorder__qty">{qty}</span>
                        <button
                          type="button"
                          className="rzv-preorder__step"
                          aria-label={`Add one ${dish.dish_name}`}
                          onClick={() => setQty(dish.dish_id, qty + 1)}
                        >
                          +
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      {feedback ? (
        <p
          className={`rzv-preorder__feedback ${
            feedback.type === "error" ? "rzv-preorder__feedback--error" : ""
          }`}
        >
          {feedback.text}
        </p>
      ) : null}

      <div className="rzv-preorder__footer">
        <div className="rzv-preorder__total">
          <span>{selectedCount} item{selectedCount === 1 ? "" : "s"}</span>
          <strong>{formatVND(total)}</strong>
        </div>
        <button
          type="button"
          className="rzv-btn rzv-btn--solid rzv-preorder__save"
          onClick={handleSave}
          disabled={saving || menuStatus !== "ready"}
        >
          {saving ? "Saving…" : "Save Pre-order"}
        </button>
      </div>
    </div>
  );
}

export default PreorderPanel;
