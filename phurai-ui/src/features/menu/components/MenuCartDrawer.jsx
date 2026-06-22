import { useEffect, useRef, useState } from 'react';
import { useMenuCart } from '../context/MenuCartContext.jsx';
import { formatVND } from '@/utils/formatCurrency';
import { appToastError } from '@/core/notifications/appToast.js';
import toast from 'react-hot-toast';
import { useTableSession } from '@/features/table-session';

function MenuCartDrawer() {
  const {
    items,
    totalQuantity,
    subtotal,
    isDrawerOpen,
    closeDrawer,
    setQuantity,
    removeItem,
    clearCart,
  } = useMenuCart();

  const panelRef = useRef(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [qrUrl, setQrUrl] = useState(null);
  const [orderAmount, setOrderAmount] = useState(0);
  const [orderId, setOrderId] = useState(null);
  
  const { session } = useTableSession();
  const isDineInQr = session && session.session_status === 'Active';

  useEffect(() => {
    if (!isDrawerOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
          if (qrUrl) {
              setQrUrl(null);
          } else {
              closeDrawer();
          }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isDrawerOpen, closeDrawer, qrUrl]);

  useEffect(() => {
    if (isDrawerOpen && panelRef.current && !qrUrl) {
      panelRef.current.focus();
    }
  }, [isDrawerOpen, qrUrl]);

  const handleCheckout = async () => {
      if (items.length === 0) return;
      setIsCheckingOut(true);
      try {
          const formattedItems = items.map(item => {
              const realNumericId = typeof item.id === 'number' ? item.id : item.dish_id || item.db_id || item.menu_id || parseInt(item.id); 
              
              if (!realNumericId || isNaN(realNumericId)) {
                  console.warn("Missing or invalid numeric ID for cart item:", item);
              }
              
              return {
                  dish_id: realNumericId,
                  quantity: item.quantity || 1,
                  notes: item.notes || ""
              };
          });

          const payload = {
              items: formattedItems
          };

          if (isDineInQr) {
              const fullPayload = {
                  table_id: session.table_id,
                  session_id: session.session_id,
                  items: payload.items
              };
              console.log("[DEBUG] Sending Checkout Payload:", JSON.stringify(fullPayload, null, 2));

              const res = await fetch('/api/orders/checkout', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(fullPayload)
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.message || 'Failed to send order');
              
              toast.success("Order sent to kitchen!");
              clearCart();
          } else {
              payload.table_id = null;
              console.log("[DEBUG] Sending Checkout Payload:", JSON.stringify(payload, null, 2));

              const res = await fetch('/api/orders/checkout', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.message || 'Checkout failed');
              
              setQrUrl(data.data.qr_url);
              setOrderAmount(data.data.total_amount);
              setOrderId(data.data.order_id);
              clearCart();
          }
      } catch (error) {
          console.error("Checkout Failed:", error.message);
          appToastError(error.message);
      } finally {
          setIsCheckingOut(false);
      }
  };

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
        inert={!isDrawerOpen ? true : undefined}
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
          {items.length > 0 && (
            <button 
                type="button" 
                onClick={handleCheckout} 
                disabled={isCheckingOut}
                style={{
                    width: '100%',
                    padding: '12px',
                    background: '#2f7d4f',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    cursor: isCheckingOut ? 'wait' : 'pointer',
                    marginTop: '12px'
                }}
            >
                {isCheckingOut ? 'Processing...' : (isDineInQr ? 'Send Order to Kitchen' : 'Checkout & Pay')}
            </button>
          )}
          <p className="menu-cart-drawer__hint">
            Continue browsing the menu — your selections stay here.
          </p>
        </footer>
      </aside>

      {/* SePay QR Modal */}
      {qrUrl && (
          <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 9999
          }}>
              <div style={{
                  background: 'white', padding: '24px', borderRadius: '12px',
                  width: '90%', maxWidth: '400px', textAlign: 'center',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
              }}>
                  <h3 style={{ margin: '0 0 16px 0', color: '#1a1a1a' }}>Scan to Pay</h3>
                  <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
                      Order <strong>#{String(orderId).padStart(6, '0')}</strong><br/>
                      Total: <strong style={{ color: '#2f7d4f', fontSize: '18px' }}>{formatVND(orderAmount)}</strong>
                  </p>
                  <img src={qrUrl} alt="SePay QR Code" style={{ width: '100%', height: 'auto', borderRadius: '8px', marginBottom: '20px' }} />
                  <p style={{ color: '#888', fontSize: '13px', marginBottom: '20px' }}>
                      After payment, the system will automatically process your order.
                  </p>
                  <button 
                      type="button" 
                      onClick={() => setQrUrl(null)}
                      style={{
                          width: '100%', padding: '10px', background: '#f3f4f6',
                          border: '1px solid #e5e7eb', borderRadius: '6px',
                          color: '#374151', fontWeight: 'bold', cursor: 'pointer'
                      }}
                  >
                      Close
                  </button>
              </div>
          </div>
      )}
    </>
  );
}

export default MenuCartDrawer;
