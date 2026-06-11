import { useEffect, useMemo, useState } from "react";
import { formatVND } from "@/utils/formatCurrency";
import { getPreorderMenu } from "@/services/reservationApi";

/**
 * Order-in-advance overlay shown INSIDE the reservation flow (never navigates
 * away). Reuses the live preorder menu from the backend. Selections are kept in
 * local state and handed back to the page via onApply — they are persisted to
 * the backend only after the reservation is created (and only for members).
 */
function PreorderModal({ open, initialItems = [], onClose, onApply }) {
  const [menu, setMenu] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const [quantities, setQuantities] = useState({});

  // Load menu the first time the modal opens.
  useEffect(() => {
    if (!open || status !== "idle") return undefined;
    let active = true;
    setStatus("loading");
    getPreorderMenu()
      .then((res) => {
        if (!active) return;
        setMenu(res?.dishes || []);
        setStatus("ready");
      })
      .catch(() => active && setStatus("error"));
    return () => {
      active = false;
    };
  }, [open, status]);

  // Seed quantities from current selection each time it opens.
  useEffect(() => {
    if (!open) return;
    const seed = {};
    initialItems.forEach((i) => {
      seed[i.dish_id] = i.quantity;
    });
    setQuantities(seed);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock body scroll + close on Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const dish of menu) {
      const key = dish.category_name || "Menu";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(dish);
    }
    return [...map.entries()];
  }, [menu]);

  const dishById = useMemo(() => {
    const map = new Map();
    for (const dish of menu) map.set(dish.dish_id, dish);
    return map;
  }, [menu]);

  const { count, total } = useMemo(() => {
    let c = 0;
    let t = 0;
    for (const [id, qty] of Object.entries(quantities)) {
      if (qty > 0) {
        c += qty;
        t += (dishById.get(Number(id))?.price || 0) * qty;
      }
    }
    return { count: c, total: t };
  }, [quantities, dishById]);

  if (!open) return null;

  const setQty = (dishId, next) => {
    setQuantities((prev) => {
      const value = Math.max(0, Math.min(20, next));
      const copy = { ...prev };
      if (value <= 0) delete copy[dishId];
      else copy[dishId] = value;
      return copy;
    });
  };

  const handleApply = () => {
    const items = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const dish = dishById.get(Number(id));
        return {
          dish_id: Number(id),
          dish_name: dish?.dish_name || "",
          price: dish?.price || 0,
          quantity: qty,
        };
      });
    onApply?.(items);
    onClose?.();
  };

  return (
    <div className="rzv-modal" role="dialog" aria-modal="true" aria-label="Order in advance">
      <div className="rzv-modal__scrim" onClick={onClose} />
      <div className="rzv-modal__panel rzv-modal__panel--menu">
        <header className="rzv-modal__head">
          <div>
            <span className="rzv-modal__kicker">Order in advance</span>
            <h3 className="rzv-modal__title rzv-serif">Pre-select your dishes</h3>
          </div>
          <button type="button" className="rzv-modal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="rzv-modal__body">
          {status === "loading" ? (
            <p className="rzv-preorder__state">Loading menu…</p>
          ) : null}
          {status === "error" ? (
            <p className="rzv-preorder__state rzv-preorder__state--error">
              Could not load the menu. Please try again later.
            </p>
          ) : null}

          {status === "ready" ? (
            <div className="rzv-premenu">
              {grouped.map(([category, dishes]) => (
                <section key={category} className="rzv-premenu__group">
                  <h4 className="rzv-premenu__group-name">{category}</h4>
                  <div className="rzv-premenu__grid">
                    {dishes.map((dish) => {
                      const qty = quantities[dish.dish_id] || 0;
                      return (
                        <article
                          key={dish.dish_id}
                          className={`rzv-premenu__card ${qty > 0 ? "rzv-premenu__card--active" : ""}`}
                        >
                          <div className="rzv-premenu__card-body">
                            <span className="rzv-premenu__name">{dish.dish_name}</span>
                            <span className="rzv-premenu__price">{formatVND(dish.price)}</span>
                          </div>
                          <div className="rzv-premenu__stepper">
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
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : null}
        </div>

        <footer className="rzv-modal__foot">
          <div className="rzv-preorder__total">
            <span>{count} item{count === 1 ? "" : "s"}</span>
            <strong>{formatVND(total)}</strong>
          </div>
          <div className="rzv-modal__foot-actions">
            <button type="button" className="rzv-btn rzv-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="rzv-btn rzv-btn--solid"
              onClick={handleApply}
              disabled={status !== "ready"}
            >
              {count > 0 ? "Add to reservation" : "Done"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default PreorderModal;
