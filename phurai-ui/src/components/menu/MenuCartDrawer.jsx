import { useEffect, useRef } from 'react';
import { useMenuCart } from '@/context/MenuCartContext';
import { formatVND } from '@/utils/formatCurrency';

function MenuCartDrawer() {
  const {
    items,
    totalQuantity,
    subtotal,
    isDrawerOpen,
    closeDrawer,
    setQuantity,
    removeItem,
  } = useMenuCart();

  const panelRef = useRef(null);

  useEffect(() => {
    if (!isDrawerOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeDrawer();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isDrawerOpen, closeDrawer]);

  useEffect(() => {
    if (isDrawerOpen && panelRef.current) {
      panelRef.current.focus();
    }
  }, [isDrawerOpen]);

  return (
    <>
      <button
        type="button"
        className={`menu-cart-drawer__backdrop${isDrawerOpen ? ' is-visible' : ''}`}
        aria-label="Close cart"
        onClick={closeDrawer}
        tabIndex={isDrawerOpen ? 0 : -1}
      />

      <aside
        ref={panelRef}
        className={`menu-cart-drawer${isDrawerOpen ? ' menu-cart-drawer--open' : ''}`}
        aria-hidden={!isDrawerOpen}
        tabIndex={-1}
      >
        <header className="menu-cart-drawer__header">
          <div>
            <p className="menu-cart-drawer__eyebrow">YOUR ORDER</p>
            <h2 className="menu-cart-drawer__title">Cart</h2>
          </div>
          <button
            type="button"
            className="menu-cart-drawer__close"
            onClick={closeDrawer}
            aria-label="Close cart panel"
          >
            ×
          </button>
        </header>

        <div className="menu-cart-drawer__body">
          {items.length === 0 ? (
            <p className="menu-cart-drawer__empty">Your cart is empty.</p>
          ) : (
            <ul className="menu-cart-drawer__list">
              {items.map((item) => (
                <li key={item.id} className="menu-cart-drawer__item">
                  <div className="menu-cart-drawer__thumb">
                    {item.image ? (
                      <img src={item.image} alt="" loading="lazy" />
                    ) : null}
                  </div>
                  <div className="menu-cart-drawer__details">
                    <p className="menu-cart-drawer__name">{item.name}</p>
                    <p className="menu-cart-drawer__price">{formatVND(item.price)}</p>
                    <div className="menu-cart-drawer__qty">
                      <button
                        type="button"
                        className="menu-cart-drawer__qty-btn"
                        aria-label={`Decrease ${item.name}`}
                        onClick={() => setQuantity(item.id, item.quantity - 1)}
                      >
                        −
                      </button>
                      <span className="menu-cart-drawer__qty-value">{item.quantity}</span>
                      <button
                        type="button"
                        className="menu-cart-drawer__qty-btn"
                        aria-label={`Increase ${item.name}`}
                        onClick={() => setQuantity(item.id, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="menu-cart-drawer__remove"
                    onClick={() => removeItem(item.id)}
                    aria-label={`Remove ${item.name}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="menu-cart-drawer__footer">
          <div className="menu-cart-drawer__summary">
            <span>{totalQuantity} item{totalQuantity === 1 ? '' : 's'}</span>
            <strong>{formatVND(subtotal)}</strong>
          </div>
          <p className="menu-cart-drawer__hint">
            Continue browsing the menu — your selections stay here.
          </p>
        </footer>
      </aside>
    </>
  );
}

export default MenuCartDrawer;
