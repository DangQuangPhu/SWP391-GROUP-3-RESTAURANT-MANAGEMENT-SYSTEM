import { useEffect, useMemo, useState } from "react";
import { formatVND } from "@/utils/formatCurrency";
import { menuImages, MenuImagePreview } from "@/features/menu";
import "../styles/PreorderModal.css";

function resolveImage(url) {
  if (!url) return menuImages.hero;
  const filename = url.split('/').pop().replace(/\.\w+$/, '');
  const camel = filename.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  return menuImages[camel] || menuImages.hero;
}

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
  const [previewDish, setPreviewDish] = useState(null);

  const [searchText, setSearchText] = useState("");
  const [sortOrder, setSortOrder] = useState("");

  // Load menu the first time the modal opens.
  useEffect(() => {
    console.log("Preorder modal open:", open);
    if (!open) return undefined;
    if (menu.length > 0 && status === "ready") return undefined; // already loaded

    let active = true;
    setStatus("loading");
    console.log("Loading preorder dishes...");

    fetch("http://localhost:5001/api/dishes/preorder")
      .then((res) => {
        if (!res.ok) throw new Error("Network response was not ok");
        return res.json();
      })
      .then((json) => {
        if (!active) return;
        console.log("Preorder API json:", json);
        const items = Array.isArray(json) ? json : json.data || [];
        console.log("Parsed preorder items:", items);
        setMenu(items);
        setStatus("ready");
      })
      .catch((err) => {
        if (active) {
          console.error("Failed to load preorder menu:", err);
          setStatus("error");
        }
      });

    return () => {
      active = false;
    };
  }, [open, menu.length, status]);

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
    let filtered = menu.filter((d) => {
      const cat = (d.category_name || "").toLowerCase();
      return !cat.includes("chef") && !cat.includes("set menu");
    });

    if (searchText) {
      const q = searchText.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.dish_name.toLowerCase().includes(q) ||
          (d.description && d.description.toLowerCase().includes(q))
      );
    }

    if (sortOrder === "price_asc") {
      filtered.sort((a, b) => a.price - b.price);
    } else if (sortOrder === "price_desc") {
      filtered.sort((a, b) => b.price - a.price);
    }

    const map = new Map();
    for (const dish of filtered) {
      const key = dish.category_name || "Menu";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(dish);
    }
    return [...map.entries()];
  }, [menu, searchText, sortOrder]);

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
      <div className="rzv-modal__panel rzv-modal__panel--menu rzv-preorder-panel">
        <header className="rzv-modal__head">
          <div>
            <span className="rzv-modal__kicker">Order in advance</span>
            <h3 className="rzv-modal__title rzv-serif">Pre-select your dishes</h3>
          </div>
          <button type="button" className="rzv-modal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="rzv-modal__body rzv-preorder-body">

          {status === "ready" && menu.length > 0 ? (
            <div className="rzv-preorder-toolbar">
              <input
                type="text"
                placeholder="Search dishes..."
                className="rzv-preorder-search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              <select
                className="rzv-preorder-sort"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <option value="">Sort by: Default</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          ) : null}

          {status === "loading" ? (
            <p className="rzv-preorder__state">Loading menu…</p>
          ) : null}
          {status === "error" ? (
            <p className="rzv-preorder__state rzv-preorder__state--error">
              Could not load the menu. Please try again later.
            </p>
          ) : null}

          {status === "ready" && menu.length === 0 ? (
            <p className="rzv-preorder__state">No pre-order dishes available.</p>
          ) : null}

          {status === "ready" && menu.length > 0 ? (
            <div className="rzv-premenu">
              {grouped.map(([category, dishes]) => (
                <section key={category} className="rzv-preorder-group">
                  <h4 className="rzv-preorder-group-name">{category}</h4>
                  <div className="rzv-preorder-grid">
                    {dishes.map((dish) => {
                      const qty = quantities[dish.dish_id] || 0;
                      return (
                        <article
                          key={dish.dish_id}
                          className={`rzv-preorder-card ${qty > 0 ? "rzv-preorder-card--active" : ""}`}
                        >
                          <button
                            type="button"
                            className="rzv-preorder-img-btn"
                            onClick={() => setPreviewDish({ ...dish, image: resolveImage(dish.image_url), name: dish.dish_name })}
                            aria-label={`View full image of ${dish.dish_name}`}
                          >
                            <div className="rzv-preorder-img-wrap">
                              <img src={resolveImage(dish.image_url)} alt={dish.dish_name} className="rzv-preorder-img" />
                              <div className="rzv-preorder-img-icon">
                                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                              </div>
                            </div>
                          </button>

                          <div className="rzv-preorder-card-body">
                            <span className="rzv-preorder-name">{dish.dish_name}</span>
                            {dish.description && (
                              <span className="rzv-preorder-desc">{dish.description}</span>
                            )}

                            <div className="rzv-preorder-price-row">
                              <span className="rzv-preorder-price">{formatVND(dish.price)}</span>

                              <div className="rzv-preorder-stepper">
                                <button
                                  type="button"
                                  className={`rzv-preorder-step ${qty > 0 ? "rzv-preorder-step--active" : "rzv-preorder-step--disabled"}`}
                                  aria-label={`Remove one ${dish.dish_name}`}
                                  disabled={qty <= 0}
                                  onClick={() => setQty(dish.dish_id, qty - 1)}
                                >
                                  −
                                </button>
                                <span className="rzv-preorder-qty">{qty}</span>
                                <button
                                  type="button"
                                  className="rzv-preorder-step rzv-preorder-step--active"
                                  aria-label={`Add one ${dish.dish_name}`}
                                  onClick={() => setQty(dish.dish_id, qty + 1)}
                                >
                                  +
                                </button>
                              </div>
                            </div>
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

      {previewDish && (
        <MenuImagePreview dish={previewDish} onClose={() => setPreviewDish(null)} />
      )}
    </div>
  );
}

export default PreorderModal;
