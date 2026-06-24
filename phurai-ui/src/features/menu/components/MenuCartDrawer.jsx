import { useEffect, useRef, useState, useCallback } from 'react';
import { useMenuCart } from '../context/MenuCartContext.jsx';
import { formatVND } from '@/utils/formatCurrency';
import { appToastError } from '@/core/notifications/appToast.js';
import toast from 'react-hot-toast';
import { useTableSession } from '@/features/table-session';
import { useNavigate } from 'react-router-dom';

const getStatusColor = (status) => {
  switch (status) {
    case 'Served':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'Ready':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'Preparing':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'Pending':
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

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
  const [activeTab, setActiveTab] = useState('cart'); // 'cart' | 'history'
  
  // History State
  const [history, setHistory] = useState({ preorders: [], sessionOrders: [], summary: null });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  
  const { session } = useTableSession();
  const navigate = useNavigate();
  const isDineInQr = session && session.session_status === 'Active';

  // Fetch History Logic
  const fetchHistory = useCallback(async () => {
    if (!session?.token) return;
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const res = await fetch(`/api/public/qr-order/session/${session.token}/history`);
      const result = await res.json();
      if (result.success) {
        setHistory(result.data);
      } else {
        setHistoryError(result.message || 'Failed to fetch history');
      }
    } catch (err) {
      setHistoryError('Error fetching history');
    } finally {
      setLoadingHistory(false);
    }
  }, [session?.token]);

  useEffect(() => {
    if (isDrawerOpen) {
      if (activeTab === 'history') {
        fetchHistory();
      }
    }
  }, [isDrawerOpen, activeTab, fetchHistory]);

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

  const handleCancelItem = async (itemId) => {
    if (!window.confirm("Are you sure you want to cancel this item?")) return;
    try {
      const res = await fetch(`/api/public/qr-order/items/${itemId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchHistory(); // Refresh history
      } else {
        alert(data.message || 'Failed to cancel item');
      }
    } catch (err) {
      alert('Network error while cancelling item');
    }
  };

  const handleCheckoutCart = async () => {
      if (items.length === 0) return;
      setIsCheckingOut(true);
      try {
          const formattedItems = items.map(item => {
              const realNumericId = typeof item.id === 'number' ? item.id : item.dish_id || item.db_id || item.menu_id || parseInt(item.id); 
              return { dish_id: realNumericId, quantity: item.quantity || 1, notes: item.notes || "" };
          });
          const payload = { items: formattedItems };

          if (isDineInQr) {
              const fullPayload = { table_id: session.table_id, session_id: session.session_id, items: payload.items };
              const res = await fetch('/api/orders/checkout', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fullPayload)
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.message || 'Failed to send order');
              toast.success("Order sent to kitchen!");
              clearCart();
              setActiveTab('history'); // Switch to history tab after ordering!
          } else {
             toast.error("Not supported in Dine-In mode");
          }
      } catch (error) {
          appToastError(error.message);
      } finally {
          setIsCheckingOut(false);
      }
  };

  const historyItems = [...history.preorders, ...history.sessionOrders];
  const activeOrder = history.sessionOrders[0] || history.preorders[0];
  const orderId = activeOrder?.order_id;
  const isReadyToPay = historyItems.length > 0;

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
        className={`menu-cart-drawer${isDrawerOpen ? ' menu-cart-drawer--open' : ''} flex flex-col`}
        aria-hidden={!isDrawerOpen}
        inert={!isDrawerOpen ? true : undefined}
        tabIndex={-1}
        style={{ padding: 0 }}
      >
        <header className="px-6 pt-6 pb-0 border-b border-gray-100 flex-shrink-0 relative">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Your Session</h2>
          </div>
          <div className="flex w-full">
            <button 
              onClick={() => setActiveTab('cart')}
              className={`flex-1 pb-3 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'cart' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-400 hover:text-gray-700'}`}
            >
              Current Cart {items.length > 0 && <span className="ml-1 bg-emerald-100 text-emerald-700 py-0.5 px-2 rounded-full text-xs">{items.length}</span>}
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`flex-1 pb-3 text-sm font-bold text-center border-b-2 transition-colors flex items-center justify-center gap-1 ${activeTab === 'history' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-400 hover:text-gray-700'}`}
            >
              Order History {historyItems.length > 0 && <span className="bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">{historyItems.length}</span>}
            </button>
          </div>
          <button
            type="button"
            className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
            onClick={closeDrawer}
            aria-label="Close panel"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto bg-slate-50 relative">
          {activeTab === 'cart' ? (
            <div className="p-6 h-full flex flex-col">
              {items.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-2xl">🛒</div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Cart is empty</h3>
                  <p className="text-gray-500 text-sm">Add some delicious items from the menu!</p>
                </div>
              ) : (
                <ul className="space-y-4">
                  {items.map((item) => (
                    <li key={item.id} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex gap-3">
                      <div className="w-16 h-16 shrink-0">
                        {item.image ? (
                          <img src={item.image} alt="" className="w-full h-full object-cover rounded-lg border border-gray-50" loading="lazy" />
                        ) : (
                          <div className="w-full h-full bg-gray-100 rounded-lg"></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800 truncate">{item.name}</p>
                        <p className="text-sm font-bold text-emerald-600 mt-0.5">{formatVND(item.price)}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center bg-gray-100 rounded-full p-0.5">
                            <button
                              type="button"
                              className="w-6 h-6 flex items-center justify-center rounded-full bg-white shadow-sm text-gray-600 hover:text-emerald-600 font-bold"
                              onClick={() => setQuantity(item.id, item.quantity - 1)}
                            >−</button>
                            <span className="w-6 text-center text-xs font-bold text-gray-800">{item.quantity}</span>
                            <button
                              type="button"
                              className="w-6 h-6 flex items-center justify-center rounded-full bg-white shadow-sm text-gray-600 hover:text-emerald-600 font-bold"
                              onClick={() => setQuantity(item.id, item.quantity + 1)}
                            >+</button>
                          </div>
                          <button
                            type="button"
                            className="text-xs font-medium text-red-500 hover:text-red-600 hover:underline ml-auto"
                            onClick={() => removeItem(item.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="p-6 h-full flex flex-col">
              {loadingHistory ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                  <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <p>Loading history...</p>
                </div>
              ) : historyError ? (
                <div className="py-8 text-center text-red-500 bg-red-50 rounded-xl border border-red-100">
                  <p>{historyError}</p>
                </div>
              ) : historyItems.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-2xl">🧾</div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">No Orders Yet</h3>
                  <p className="text-gray-500 text-sm">Send your cart to kitchen first.</p>
                </div>
              ) : (
                <div className="space-y-6 pb-2">
                  
                  {history.preorders.length > 0 && (
                    <section>
                      <div className="flex justify-between items-end mb-3">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pre-ordered</h3>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Remaining 70%</span>
                      </div>
                      <div className="space-y-3">
                        {history.preorders.map((item) => (
                          <div key={item.order_item_id} className="bg-white rounded-xl p-3 flex gap-3 shadow-sm border border-gray-100 relative overflow-hidden group">
                            <div className="w-12 h-12 shrink-0">
                              <img src={item.image_url} alt="" onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/150x150/f8fafc/94a3b8?text=Dish'; }} className="w-full h-full object-cover rounded-md border border-gray-50" />
                            </div>
                            <div className="flex-1 min-w-0 pr-10">
                              <h4 className="font-semibold text-gray-800 text-sm truncate">{item.dish_name}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-medium text-gray-500">x{item.quantity}</span>
                                <span className="text-gray-300">•</span>
                                <span className="text-xs font-bold text-gray-900">{formatVND(item.unit_price)}</span>
                              </div>
                            </div>
                            {item.item_status === 'Pending' && (
                              <button onClick={() => handleCancelItem(item.order_item_id)} className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center font-bold">✕</button>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {history.sessionOrders.length > 0 && (
                    <section>
                      <div className="flex justify-between items-end mb-3">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Session Orders</h3>
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Unpaid (100%)</span>
                      </div>
                      <div className="space-y-3">
                        {history.sessionOrders.map((item) => (
                          <div key={item.order_item_id} className="bg-white rounded-xl p-3 flex gap-3 shadow-sm border border-gray-100">
                            <div className="w-12 h-12 shrink-0">
                              <img src={item.image_url} alt="" onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/150x150/f8fafc/94a3b8?text=Dish'; }} className="w-full h-full object-cover rounded-md border border-gray-50" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-800 text-sm truncate pr-2">{item.dish_name}</h4>
                              <div className="flex items-center justify-between mt-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-gray-500">x{item.quantity}</span>
                                  <span className="text-gray-300">•</span>
                                  <span className="text-xs font-bold text-gray-900">{formatVND(item.unit_price)}</span>
                                </div>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${getStatusColor(item.item_status)}`}>
                                  {item.item_status.toUpperCase()}
                                </span>
                              </div>
                            </div>
                            {item.item_status === 'Pending' && (
                              <button onClick={() => handleCancelItem(item.order_item_id)} className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center font-bold">✕</button>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                  
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="bg-white border-t border-gray-100 p-6 flex-shrink-0">
          {activeTab === 'cart' ? (
            <>
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-500 text-sm">{totalQuantity} item{totalQuantity === 1 ? '' : 's'}</span>
                <span className="font-bold text-gray-900 text-lg">{formatVND(subtotal)}</span>
              </div>
              <button 
                  type="button" 
                  onClick={handleCheckoutCart} 
                  disabled={isCheckingOut || items.length === 0}
                  className={`w-full py-3.5 rounded-xl font-bold text-base transition-all flex justify-center items-center gap-2 ${items.length === 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#2f7d4f] text-white hover:bg-[#1f5a37] shadow-md'}`}
              >
                  {isCheckingOut ? 'Processing...' : (
                    <>
                      Send Order to Kitchen
                    </>
                  )}
              </button>
            </>
          ) : (
            <>
              {isReadyToPay && history.summary && (
                <>
                  <div className="space-y-1.5 mb-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="font-medium text-gray-900">{formatVND(history.summary.subtotal)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Prepaid Deposit</span>
                      <span className="font-bold text-emerald-600">-{formatVND(history.summary.prepaidDeposit)}</span>
                    </div>
                    <div className="h-px bg-gray-100 my-2"></div>
                    <div className="flex justify-between items-center text-base">
                      <span className="font-bold text-gray-900">Remaining</span>
                      <span className="font-bold text-amber-600 text-lg">{formatVND(history.summary.remainingToPay)}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      closeDrawer();
                      navigate(`/checkout/${orderId}`, { state: { amount: history.summary.remainingToPay } });
                    }}
                    className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2"
                  >
                    Pay Now
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </>
              )}
            </>
          )}
        </footer>
      </aside>
    </>
  );
}

export default MenuCartDrawer;
