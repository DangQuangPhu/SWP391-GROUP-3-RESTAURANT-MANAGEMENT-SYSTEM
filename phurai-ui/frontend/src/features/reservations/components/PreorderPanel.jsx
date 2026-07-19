import { useEffect, useMemo, useState } from "react";
import { formatVND } from "@/core/utils/formatCurrency";
import { Skeleton } from "@/components/ui/Skeleton.jsx";
import { getPreorderMenu, savePreorder } from "../services/reservationApi.js";

/**
 * Inline pre-order editor for a single reservation (optional Phase 2).
 * Lets the guest attach dishes to an upcoming reservation. Prices are
 * always re-validated on the backend; the UI only previews totals.
 */
function PreorderPanel({ reservation, userId, onSaved, value, onChange }) {
  const [menu, setMenu] = useState([]);
  const [menuStatus, setMenuStatus] = useState("idle"); // idle | loading | ready | error
  // quantities keyed by dish_id
  const [quantities, setQuantities] = useState(() => {
    if (value) return value;
    const initial = {};
    (reservation?.preorders || []).forEach((p) => {
      initial[p.dish_id] = p.quantity;
    });
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type, text }

  // Sync internal state with external value if provided
  useEffect(() => {
    if (value) {
      setQuantities(value);
    }
  }, [value]);

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
    const value = Math.max(0, Math.min(20, next));
    const copy = { ...quantities };
    if (value <= 0) delete copy[dishId];
    else copy[dishId] = value;
    
    setQuantities(copy);
    if (onChange) {
      onChange(copy, totalForNext(copy)); // Pass updated quantities and total up
    }
  };

  const totalForNext = (newQuantities) => {
    return Object.entries(newQuantities).reduce((sum, [dishId, qty]) => {
      const price = priceById.get(Number(dishId)) || 0;
      return sum + price * qty;
    }, 0);
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
        <div className="rzv-preorder__menu" aria-busy="true" aria-label="Loading menu">
          <div className="rzv-preorder__group">
            <ul className="rzv-preorder__list" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="rzv-preorder__item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px' }}>
                  <div className="rzv-preorder__item-info" style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                    <Skeleton className="w-1/2 h-5" />
                    <Skeleton className="w-24 h-4" />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <Skeleton className="w-6 h-4" />
                    <Skeleton className="w-8 h-8 rounded-full" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
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
                  const isAvailable = dish.is_available !== false && dish.is_available !== 0;
                  return (
                    <li key={dish.dish_id} className={`rzv-preorder__item ${!isAvailable ? 'rzv-preorder__item--unavailable' : ''}`} style={!isAvailable ? { opacity: 0.6 } : {}}>
                      <div className="rzv-preorder__item-info">
                        <span className="rzv-preorder__item-name">
                          {dish.dish_name}
                          {!isAvailable && (
                            <span style={{
                              display: 'inline-block',
                              marginLeft: '8px',
                              backgroundColor: '#fee2e2',
                              color: '#dc2626',
                              padding: '2px 8px',
                              borderRadius: '9999px',
                              fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
                              fontSize: '11px',
                              fontWeight: '700',
                              verticalAlign: 'middle'
                            }}>
                              Sold Out
                            </span>
                          )}
                        </span>
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
                          disabled={!isAvailable}
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
        {reservation && (
          <button
            type="button"
            className="rzv-btn rzv-btn--solid rzv-preorder__save"
            onClick={handleSave}
            disabled={saving || menuStatus !== "ready"}
          >
            {saving ? "Saving…" : "Save Pre-order"}
          </button>
        )}
      </div>
    </div>
  );
}

export default PreorderPanel;
