import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatVND } from '@/utils/formatCurrency';
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

function MenuHistoryDrawer({ isOpen, onClose }) {
  const [history, setHistory] = useState({ preorders: [], sessionOrders: [], summary: { subtotal: 0, prepaidDeposit: 0, remainingToPay: 0 } });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const { session } = useTableSession();

  // Use the orderId from the first session order (or preorder) as the active order
  const activeOrder = history.sessionOrders[0] || history.preorders[0];
  const orderId = activeOrder?.order_id;

  const fetchHistory = useCallback(async () => {
    if (!session?.token) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/qr-order/session/${session.token}/history`);
      const result = await res.json();
      if (result.success) {
        setHistory(result.data);
      } else {
        setError(result.message || 'Failed to fetch history');
      }
    } catch (err) {
      setError('An error occurred while fetching history');
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, fetchHistory]);

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

  const totalItems = history.preorders.length + history.sessionOrders.length;
  const hasItems = totalItems > 0;
  const orderItems = [...history.preorders, ...history.sessionOrders];
  const isReadyToPay = orderItems.length > 0;
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-[60] bg-slate-50 rounded-t-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden max-w-md mx-auto"
          >
            {/* Header */}
            <div className="bg-white px-6 py-4 border-b border-gray-100 sticky top-0 z-10 flex items-center justify-between rounded-t-3xl">
              <div>
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">Order History</h2>
                <p className="text-sm text-gray-500 font-medium mt-0.5">{totalItems} {totalItems === 1 ? 'item' : 'items'} ordered</p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors"
                aria-label="Close history"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto p-4 flex-1">
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center text-gray-400">
                  <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <p>Loading your history...</p>
                </div>
              ) : error ? (
                <div className="py-8 text-center text-red-500 bg-red-50 rounded-xl border border-red-100">
                  <p>{error}</p>
                </div>
              ) : !hasItems ? (
                <div className="py-16 flex flex-col items-center justify-center text-center px-6">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-2xl">
                    🧾
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">No Orders Yet</h3>
                  <p className="text-gray-500 text-sm">You haven't placed any orders in this session yet.</p>
                </div>
              ) : (
                <div className="space-y-6 pb-8">

                  {/* Preorders Section */}
                  {history.preorders.length > 0 && (
                    <section>
                      <div className="flex items-center gap-2 mb-3 px-1">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Pre-ordered Items</h3>
                        <div className="h-px bg-gray-200 flex-1"></div>
                      </div>
                      <div className="space-y-3">
                        {history.preorders.map((item) => (
                          <div key={item.order_item_id} className="bg-white rounded-xl p-3 flex gap-3 shadow-sm border border-gray-100 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 bg-amber-500/10 text-amber-700 text-[10px] font-bold px-2 py-1 rounded-bl-lg border-l border-b border-amber-500/20">
                              PRE-PAID 30%
                            </div>
                            <div className="w-16 h-16 shrink-0">
                              <img
                                src={item.image_url}
                                alt={item.dish_name}
                                onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/150x150/f8fafc/94a3b8?text=Ph%C5%ABrai+Dish'; }}
                                className="w-full h-full object-cover rounded-lg border border-gray-50"
                              />
                            </div>
                            <div className="flex-1 min-w-0 pr-16">
                              <h4 className="font-bold text-gray-800 truncate">{item.dish_name}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm font-medium text-gray-500">x{item.quantity}</span>
                                <span className="text-gray-300">•</span>
                                <span className="text-sm font-bold text-gray-900">{formatVND(item.unit_price)}</span>
                              </div>
                            </div>
                            {item.item_status === 'Pending' && (
                              <button
                                onClick={() => handleCancelItem(item.order_item_id)}
                                className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center font-bold"
                              >
                                -
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Session Orders Section */}
                  {history.sessionOrders.length > 0 && (
                    <section>
                      <div className="flex items-center gap-2 mb-3 px-1">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Current Session</h3>
                        <div className="h-px bg-gray-200 flex-1"></div>
                      </div>
                      <div className="space-y-3">
                        {history.sessionOrders.map((item) => (
                          <div key={item.order_item_id} className="bg-white rounded-xl p-3 flex gap-3 shadow-sm border border-gray-100">
                            <div className="w-16 h-16 shrink-0">
                              <img
                                src={item.image_url}
                                alt={item.dish_name}
                                onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/150x150/f8fafc/94a3b8?text=Ph%C5%ABrai+Dish'; }}
                                className="w-full h-full object-cover rounded-lg border border-gray-50"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-gray-800 truncate pr-2">{item.dish_name}</h4>
                              <div className="flex items-center justify-between mt-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-500">x{item.quantity}</span>
                                  <span className="text-gray-300">•</span>
                                  <span className="text-sm font-bold text-gray-900">{formatVND(item.unit_price)}</span>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusColor(item.item_status)}`}>
                                  {item.item_status.toUpperCase()}
                                </span>
                              </div>
                            </div>
                            {item.item_status === 'Pending' && (
                              <button
                                onClick={() => handleCancelItem(item.order_item_id)}
                                className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center font-bold"
                              >
                                -
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                </div>
              )}
            </div>

            {/* Footer Summary */}
            {orderItems.length > 0 && history.summary && (
              <div className="bg-white border-t border-gray-100 p-5 rounded-b-3xl">
                <div className="space-y-2 mb-4">
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
                    <span className="font-bold text-gray-900">Remaining to Pay</span>
                    <span className="font-bold text-amber-600 text-lg">{formatVND(history.summary.remainingToPay)}</span>
                  </div>
                </div>
                {isReadyToPay && (
                  <button
                    onClick={() => {
                      onClose();
                      navigate(`/checkout/${orderId}`, { state: { amount: history.summary.remainingToPay } });
                    }}
                    className="w-full mt-4 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2"
                  >
                    Pay Now
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default MenuHistoryDrawer;
