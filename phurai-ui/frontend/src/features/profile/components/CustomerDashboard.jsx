import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarCheck, CalendarX, XCircle, ShoppingBag, Wallet, Gem, Calendar, ChevronDown, ArrowRight, History, X, ChevronRight, UtensilsCrossed } from 'lucide-react';
import StatCard from './StatCard';
import { ExpenditureTrendChart, OrderCategoryChart } from './DashboardCharts';
import {
  getCustomerDashboardSummary,
  getCustomerExpenditureTrend,
  getCustomerOrdersByCategory,
  getCustomerRecentActivity,
  getCustomerRecentActivityAll,
  getActivityItems,
  getCustomerDetailedItemsByCategory,
} from '../services/profileApi';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';
import { Link } from 'react-router-dom';
import { format, isSameDay, isValid } from "date-fns";
import DashboardDateRangePicker from "@/features/manager-dashboard/components/shared/DashboardDateRangePicker.jsx";
import { imagePathMap } from "@/features/menu/data/menuAssets.js";
import { useSocket } from "@/core/socket/SocketContext.jsx";

function StatCardSkeleton() {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100 animate-pulse">
      <div className="flex items-center gap-4 mb-4">
        <div className="h-14 w-14 rounded-full bg-gray-100" />
        <div className="flex flex-col gap-2">
          <div className="h-7 w-24 rounded bg-gray-100" />
          <div className="h-4 w-32 rounded bg-gray-100" />
        </div>
      </div>
      <div className="h-4 w-20 rounded bg-gray-100" />
    </div>
  );
}

function ChartSkeleton({ type = 'area' }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100 animate-pulse h-full w-full flex items-end justify-center gap-2">
      {type === 'area'
        ? [40, 60, 35, 70, 50, 80, 65].map((h, i) => (
          <div key={i} className="flex-1 rounded-t bg-gray-100" style={{ height: `${h}%` }} />
        ))
        : <div className="w-48 h-48 rounded-full border-[20px] border-gray-100 mx-auto self-center" />
      }
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_CLASSES = {
  Completed: 'bg-emerald-100 text-emerald-700',
  Paid: 'bg-emerald-100 text-emerald-700',
  Served: 'bg-emerald-100 text-emerald-700',
  'Await Check-in': 'bg-blue-100 text-blue-700',
  Dining: 'bg-purple-100 text-purple-700',
  Cancelled: 'bg-red-100 text-red-700',
  'No Show': 'bg-red-100 text-red-700',
  Failed: 'bg-red-100 text-red-700',
};
function statusClass(s) { return STATUS_CLASSES[s] ?? 'bg-yellow-100 text-yellow-700'; }
function fmtVND(amount) { return `${Math.round(amount || 0).toLocaleString('vi-VN')} VND`; }
function fmtDate(d) {
  if (!d) return '';
  const parsed = new Date(d);
  if (!isValid(parsed)) return '';
  return format(parsed, 'MMM d, yyyy · h:mm a');
}

// ── Skeleton Components ───────────────────────────────────────────────────────
function ItemSkeleton() {
  return (
    <div className="animate-pulse flex items-center gap-3 p-3">
      <div className="w-10 h-10 rounded-xl bg-gray-100 flex-none"/>
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="h-4 w-32 rounded bg-gray-100"/>
        <div className="h-3 w-48 rounded bg-gray-100"/>
      </div>
      <div className="h-4 w-20 rounded bg-gray-100"/>
    </div>
  );
}
function DishSkeletonRow() {
  return (
    <div className="animate-pulse flex items-center gap-3 py-2.5 px-3">
      <div className="w-8 h-8 rounded-lg bg-gray-100 flex-none"/>
      <div className="flex-1 flex flex-col gap-1">
        <div className="h-3.5 w-28 rounded bg-gray-100"/>
        <div className="h-3 w-16 rounded bg-gray-100"/>
      </div>
      <div className="h-3.5 w-20 rounded bg-gray-100"/>
    </div>
  );
}
function DashboardSkeleton() {
  return (
    <div className="h-full flex flex-col overflow-hidden p-4 gap-4 bg-[#f3f4f6]">
      <div className="flex items-center justify-between flex-none">
        <div className="h-8 w-1/3 rounded bg-gray-100 animate-pulse"></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 flex-none">
        {[1, 2, 3, 4].map(i => <StatCardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 flex-[2] min-h-0">
        <div className="col-span-1 xl:col-span-2"><ChartSkeleton type="pie" /></div>
        <div className="col-span-1 xl:col-span-3"><ChartSkeleton type="area" /></div>
      </div>
    </div>
  );
}

// ── Orders Summary Category Details Modal (Apple-style right-slide full page overlay) ────
function OrdersSummaryCategoryDetailsModal({ userId, dateFilter, category, onClose }) {
  const isOpen = category !== null;
  const [activeCategory, setActiveCategory] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const panelRef = useRef(null);

  // Sync internal activeCategory only when a category is selected
  useEffect(() => {
    if (category) {
      setActiveCategory(category);
    }
  }, [category]);

  // Click outside to close, ignoring clicks on the orders summary container
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        if (!e.target.closest('.orders-summary-container')) {
          onClose();
        }
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Fetch items whenever activeCategory or dateFilter changes
  useEffect(() => {
    if (!activeCategory || !isOpen) return;
    const loadItems = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await getCustomerDetailedItemsByCategory(userId, activeCategory, dateFilter.startDate, dateFilter.endDate);
        setItems(res?.items || []);
      } catch {
        setError('Could not load detailed category breakdown.');
      } finally {
        setLoading(false);
      }
    };
    loadItems();
  }, [userId, activeCategory, dateFilter, isOpen]);

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
  }, [items]);

  const totalQty = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  }, [items]);

  return (
    <motion.div
      ref={panelRef}
      className="fixed top-0 right-0 bottom-0 z-[200] w-full max-w-lg bg-white shadow-2xl flex flex-col border-l border-gray-100"
      initial={{ x: '100%' }}
      animate={{ x: isOpen ? 0 : '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 32 }}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-none">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#8c764b]/10 flex items-center justify-center">
            <ShoppingBag size={16} className="text-[#8c764b]" />
          </div>
          <div>
            <div className="h-6 overflow-hidden relative min-w-[120px]">
              <AnimatePresence mode="wait">
                <motion.h2
                  key={activeCategory}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.15 }}
                  className="font-bold text-gray-900 text-base capitalize absolute left-0 right-0 truncate"
                >
                  {activeCategory || 'Category'} Details
                </motion.h2>
              </AnimatePresence>
            </div>
            <p className="text-xs text-gray-400">Purchased items breakdown ({dateFilter.label})</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
        >
          <X size={16} className="text-gray-600" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 relative">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-1"
            >
              {[1,2,3,4,5].map(k => <ItemSkeleton key={k}/>)}
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-12 text-center text-sm text-red-500"
            >
              {error}
            </motion.div>
          ) : items.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2"
            >
              <ShoppingBag size={32} className="opacity-30" />
              <p className="text-sm">No items found under this category</p>
            </motion.div>
          ) : (
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-2"
            >
              {items.map((d, idx) => (
                <div
                  key={`${d.dish_id}-${idx}`}
                  className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{d.dish_name}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(d.created_at)}</p>
                  </div>
                  <div className="text-right flex-none">
                    <p className="text-sm font-bold text-[#8c764b]">{d.quantity}x</p>
                    <p className="text-[10px] text-gray-400">{fmtVND(d.subtotal)}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Activity Item Row (expandable) ────────────────────────────────────────────
function ActivityItemRow({ item, userId }) {
  const [expanded, setExpanded] = useState(false);
  const [dishes, setDishes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState(null);
  const canExpand = item.item_count > 0;
  const isReservation = item.type === 'reservation';

  const handleExpand = useCallback(async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && dishes === null && canExpand) {
      setLoading(true);
      try {
        const res = await getActivityItems(userId, item.type, item.id);
        setDishes(res?.items || []);
        setMeta(res?.meta || null);
      } catch { setDishes([]); }
      finally { setLoading(false); }
    }
  }, [expanded, dishes, userId, item, canExpand]);

  return (
    <div className={`rounded-xl border transition-all duration-200 ${
      expanded ? 'border-[#8c764b]/20 bg-amber-50/30' : 'border-transparent hover:bg-gray-50'
    }`}>
      <button
        onClick={canExpand ? handleExpand : undefined}
        className={`w-full flex items-center justify-between p-2.5 text-left ${canExpand ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-center gap-3">
          {(() => {
            const isFailed = item.status === 'Cancelled' || item.status === 'No Show' || item.status === 'Failed';
            const iconContainerClass = isFailed 
              ? 'bg-red-50 border-red-100 text-red-600' 
              : (isReservation ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-amber-50 border-amber-100 text-amber-700');
            return (
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border flex-none ${iconContainerClass}`}>
                {isFailed 
                  ? (isReservation ? <CalendarX size={16} /> : <XCircle size={16} />) 
                  : (isReservation ? <CalendarCheck size={16} /> : <ShoppingBag size={16} />)
                }
              </div>
            );
          })()}
          <div className="text-left">
            <p className="font-bold text-sm text-gray-800 flex items-center gap-1.5 flex-wrap">
              <span>{isReservation ? (item.source === 'Walk-in' ? 'Walk-in Reservation' : 'Reservation') : 'Order'} #{item.id}</span>
              {item.source === 'Walk-in' && (
                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">Walk-in</span>
              )}
              {item.table_number && <span className="text-xs font-medium text-gray-400">· Table {item.table_number}</span>}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{fmtDate(item.created_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-right">
          <div>
            <p className="font-bold text-sm text-gray-900">{fmtVND(item.amount)}</p>
            <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${statusClass(item.status)}`}>
              {item.status}
            </span>
          </div>
          {canExpand && (
            <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronRight size={14} className="text-gray-400 flex-none" />
            </motion.div>
          )}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 35 }}
            className="overflow-hidden"
          >
            <div className="mx-2.5 mb-2.5 bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
              {meta && isReservation && (
                <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-4 flex-wrap text-xs text-gray-500 bg-gray-50/60">
                  {meta.reservation_start_at && <span>📅 {format(new Date(meta.reservation_start_at), 'MMM d, yyyy h:mm a')}</span>}
                  {meta.guest_count && <span>👥 {meta.guest_count} guests</span>}
                  {meta.table_number && <span>🪑 Table {meta.table_number}</span>}
                </div>
              )}
              {loading && <div className="divide-y divide-gray-50">{[1,2,3].map(k => <DishSkeletonRow key={k}/>)}</div>}
              {!loading && dishes && dishes.length > 0 && (
                <div className="divide-y divide-gray-50">
                  {dishes.map((d, idx) => {
                    const resolvedImg = (d.image_url && imagePathMap[d.image_url]) 
                      ? imagePathMap[d.image_url] 
                      : (d.image_url && (d.image_url.startsWith('http://') || d.image_url.startsWith('https://') || d.image_url.startsWith('/api') || d.image_url.startsWith('/uploads'))) 
                        ? d.image_url 
                        : null;
                    return (
                      <motion.div
                        key={d.order_item_id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className="flex items-center gap-3 px-3 py-2.5"
                      >
                        {resolvedImg ? (
                          <img src={resolvedImg} alt={d.dish_name} className="w-8 h-8 rounded-lg object-cover flex-none" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-none">
                            <UtensilsCrossed size={12} className="text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{d.dish_name}</p>
                          {d.category_name && <p className="text-[10px] text-gray-400 capitalize">{d.category_name}</p>}
                        </div>
                        <div className="text-right flex-none">
                          <p className="text-xs font-bold text-gray-800">{fmtVND(d.subtotal)}</p>
                          <p className="text-[10px] text-gray-400">{d.quantity}x · {fmtVND(d.unit_price)}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
              {!loading && dishes && dishes.length === 0 && (
                <div className="py-4 text-center text-xs text-gray-400">No items recorded</div>
              )}
              {!loading && meta && (
                <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/60 flex justify-between items-center">
                  <span className="text-xs text-gray-500 font-medium">
                    {isReservation ? 'Total Paid (Deposit)' : 'Total Paid'}
                  </span>
                  <span className="text-sm font-bold text-[#8c764b]">
                    {fmtVND(isReservation ? meta.total_paid : meta.total_amount)}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Activity History Modal ────────────────────────────────────────────────────
function ActivityHistoryModal({ userId, onClose }) {
  const [allActivity, setAllActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true); setError(null);
        const res = await getCustomerRecentActivityAll(userId);
        setAllActivity(res?.activity || []);
      } catch { setError('Could not load activity history.'); }
      finally { setLoading(false); }
    };
    loadHistory();
  }, [userId]);

  const grouped = useMemo(() => {
    if (!allActivity) return [];
    const groups = {};
    allActivity.forEach(item => {
      const d = new Date(item.created_at);
      const key = isValid(d) ? format(d, 'MMMM yyyy') : 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return Object.entries(groups);
  }, [allActivity]);

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-stretch justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        className="relative z-10 w-full max-w-lg bg-white shadow-2xl flex flex-col"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 35 }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-none">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#8c764b]/10 flex items-center justify-center">
              <History size={16} className="text-[#8c764b]" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-base">Activity History</h2>
              <p className="text-xs text-gray-400">All your transactions & reservations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <X size={16} className="text-gray-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading && <div className="flex flex-col gap-1">{[1,2,3,4,5].map(k => <ItemSkeleton key={k}/>)}</div>}
          {error && <div className="py-12 text-center text-sm text-gray-400">{error}</div>}
          {!loading && !error && grouped.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
              <History size={32} className="opacity-30" />
              <p className="text-sm">No activity found</p>
            </div>
          )}
          {!loading && !error && grouped.map(([month, items]) => (
            <div key={month} className="mb-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">{month}</p>
              <div className="flex flex-col gap-1">
                {items.map((item, idx) => (
                  <motion.div
                    key={`${item.type}-${item.id}-${idx}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    <ActivityItemRow item={item} userId={userId} />
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}


function useDashboardQuery(userId, dateFilter) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState(null);
  const hasDataRef = React.useRef(false);

  const fetchAll = useCallback(async () => {
    if (!userId) return;
    if (!hasDataRef.current) {
      setIsLoading(true);
    } else {
      setIsRefetching(true);
    }
    setIsError(false);
    setError(null);
    try {
      const { startDate, endDate, range } = dateFilter;
      const [summaryRes, trendRes, catRes, actRes] = await Promise.all([
        getCustomerDashboardSummary(userId, startDate, endDate),
        getCustomerExpenditureTrend(userId, range, startDate, endDate),
        getCustomerOrdersByCategory(userId, startDate, endDate),
        getCustomerRecentActivity(userId, startDate, endDate)
      ]);

      setData({
        summary: summaryRes,
        trend: trendRes?.trend || [],
        categories: catRes?.categories || [],
        activity: actRes?.activity || []
      });
      hasDataRef.current = true;
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setIsError(true);
      setError(err);
    } finally {
      setIsLoading(false);
      setIsRefetching(false);
    }
  }, [userId, dateFilter]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { data, isLoading, isRefetching, isError, error, refetch: fetchAll };
}

const CustomerDashboard = () => {
  const { currentUser, setCurrentUser } = useAuth();
  const { profile } = useUserProfile(currentUser, setCurrentUser);
  const userId = currentUser?.user_id || currentUser?.userId || currentUser?.id;

  const accountOpenedDate = useMemo(() => {
    return profile?.created_at ? new Date(profile.created_at) : null;
  }, [profile]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftRange, setDraftRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(end.getMonth() - 6);
    return { startDate: start, endDate: end, key: "selection" };
  });
  const [appliedRange, setAppliedRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(end.getMonth() - 6);
    return { startDate: start, endDate: end };
  });
  const [activePresetId, setActivePresetId] = useState("6m");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Clamp ranges when profile.created_at loads
  useEffect(() => {
    if (accountOpenedDate) {
      const minD = new Date(accountOpenedDate);
      minD.setHours(0, 0, 0, 0);

      setAppliedRange(prev => {
        if (prev.startDate && prev.startDate < minD) {
          return { ...prev, startDate: minD };
        }
        return prev;
      });

      setDraftRange(prev => {
        if (prev.startDate && prev.startDate < minD) {
          return { ...prev, startDate: minD };
        }
        return prev;
      });
    }
  }, [accountOpenedDate]);

  const closePicker = useCallback(() => setPickerOpen(false), []);
  const openPicker = useCallback(() => {
    let start = appliedRange.startDate;
    if (accountOpenedDate) {
      const minD = new Date(accountOpenedDate);
      minD.setHours(0, 0, 0, 0);
      if (!start || start < minD) {
        start = minD;
      }
    }
    setDraftRange({ startDate: start, endDate: appliedRange.endDate, key: "selection" });
    setPickerOpen(true);
  }, [appliedRange, accountOpenedDate]);

  const handleApplyDate = useCallback((sel) => {
    let start = sel.startDate;
    if (accountOpenedDate) {
      const minD = new Date(accountOpenedDate);
      minD.setHours(0, 0, 0, 0);
      if (!start || start < minD) {
        start = minD;
      }
    }
    setAppliedRange({ startDate: start, endDate: sel.endDate });
    closePicker();
  }, [closePicker, accountOpenedDate]);

  const handlePresetSelect = useCallback((preset) => {
    const range = preset.range || { startDate: preset.startDate, endDate: preset.endDate, key: "selection" };
    
    let start = range.startDate;
    if (accountOpenedDate) {
      const minD = new Date(accountOpenedDate);
      minD.setHours(0, 0, 0, 0);
      if (!start || start < minD) {
        start = minD;
      }
    }

    setActivePresetId(preset.id);
    setDraftRange({ ...range, startDate: start });
    setAppliedRange({ startDate: start, endDate: range.endDate });
    closePicker();
  }, [closePicker, accountOpenedDate]);

  const dateFilter = useMemo(() => {
    let sd = appliedRange.startDate;
    const ed = appliedRange.endDate;
    
    if (accountOpenedDate) {
      const minD = new Date(accountOpenedDate);
      minD.setHours(0, 0, 0, 0);
      if (!sd || sd < minD) {
        sd = minD;
      }
    }

    let label = "All Time";
    if (sd && ed) {
      if (isSameDay(sd, ed)) {
        label = format(sd, "dd/MM/yyyy");
      } else {
        label = `${format(sd, "dd/MM")} – ${format(ed, "dd/MM/yyyy")}`;
      }
    } else if (activePresetId === "all_time") {
      label = "All Time";
    }

    const startIso = sd ? new Date(sd).toISOString() : null;
    const endIso = ed ? new Date(ed).toISOString() : null;

    let rangeVal = "all";
    if (activePresetId === "today") rangeVal = "today";
    else if (activePresetId === "7d") rangeVal = "7d";
    else if (activePresetId === "30d") rangeVal = "30d";
    else if (activePresetId === "6m") rangeVal = "6m";
    else if (activePresetId === "1y") rangeVal = "1y";
    else if (sd && ed) rangeVal = "custom";

    return {
      range: rangeVal,
      startDate: startIso,
      endDate: endIso,
      label
    };
  }, [appliedRange, activePresetId, accountOpenedDate]);

  const { data, isLoading, isRefetching, isError, error, refetch } = useDashboardQuery(userId, dateFilter);

  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !userId) return;

    const handleRealtimeUpdate = (payload) => {
      console.log("[Dashboard] Real-time action received, reloading page...", payload);
      window.location.reload();
    };

    socket.on("STAFF_ACTION_UPDATE", handleRealtimeUpdate);
    socket.on("reservation:processed", handleRealtimeUpdate);
    socket.on("reservation:status_changed", handleRealtimeUpdate);
    socket.on("reservation:request_resolved", handleRealtimeUpdate);

    return () => {
      socket.off("STAFF_ACTION_UPDATE", handleRealtimeUpdate);
      socket.off("reservation:processed", handleRealtimeUpdate);
      socket.off("reservation:status_changed", handleRealtimeUpdate);
      socket.off("reservation:request_resolved", handleRealtimeUpdate);
    };
  }, [socket, userId, refetch]);

  if (isLoading) return <DashboardSkeleton />;

  if (isError) {
    return (
      <div className="p-6 text-center w-full h-full flex flex-col items-center justify-center">
        <p className="text-[var(--color-danger)] mb-3">Failed to load data: {error?.message || "Server error"}</p>
        <button onClick={() => refetch()} className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white">
          Try Again
        </button>
      </div>
    );
  }

  const { summary, trend, categories, activity } = data || {};

  return (
    <div className={`h-full flex flex-col overflow-hidden p-4 gap-4 bg-[#f3f4f6] customer-dashboard ${isRefetching ? 'opacity-85 pointer-events-none' : ''}`}>

      {/* History Overlay */}
      <AnimatePresence>
        {historyOpen && <ActivityHistoryModal userId={userId} onClose={() => setHistoryOpen(false)} />}
      </AnimatePresence>

      {/* Orders Summary Category Details Sidebar */}
      <OrdersSummaryCategoryDetailsModal
        userId={userId}
        dateFilter={dateFilter}
        category={selectedCategory}
        onClose={() => setSelectedCategory(null)}
      />

      {/* Top Row: Header & KPIs */}
      <div className="flex-none flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-end gap-4">
          <div className="flex items-center gap-3">
            {isRefetching && (
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8c764b] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#8c764b]"></span>
              </span>
            )}
            <div className="relative z-20">
              <button
                type="button"
                onClick={() => (pickerOpen ? closePicker() : openPicker())}
                aria-expanded={pickerOpen}
                className="flex items-center justify-center bg-white border border-gray-200 w-10 h-10 rounded-xl shadow-sm hover:bg-gray-50 transition-colors text-[#8c764b]"
                title={`Filter Period: ${dateFilter.label}`}
              >
                <Calendar size={18} strokeWidth={2.2} />
              </button>
              {pickerOpen && (
                <div className="customer-dashboard__picker-wrapper">
                  <DashboardDateRangePicker
                    inline={true}
                    allowFuture={false}
                    draftRange={draftRange}
                    activePresetId={activePresetId}
                    minDate={accountOpenedDate}
                    onDraftChange={(selection) => { setDraftRange(selection); setActivePresetId("custom"); }}
                    onPresetSelect={handlePresetSelect}
                    onApply={handleApplyDate}
                    onCancel={closePicker}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Reservations" value={summary?.totalReservations?.value || 0} icon={CalendarCheck} deltaPercent={summary?.totalReservations?.deltaPercent ?? null} formatValue={(v) => Math.round(v)} theme="blue" />
          <StatCard label="Total Expenditure" value={summary?.totalExpenditure?.value || 0} icon={Wallet} deltaPercent={summary?.totalExpenditure?.deltaPercent ?? null} formatValue={(v) => `${Math.round(v).toLocaleString('vi-VN')} VND`} theme="red" />
          <StatCard label="Total Orders" value={summary?.totalOrders?.value || 0} icon={ShoppingBag} deltaPercent={summary?.totalOrders?.deltaPercent ?? null} formatValue={(v) => Math.round(v)} theme="green" />
          <StatCard label="Loyalty Points" value={summary?.totalLoyaltyPoints?.value || 0} icon={Gem} deltaPercent={summary?.totalLoyaltyPoints?.deltaPercent ?? null} formatValue={(v) => Math.round(v)} theme="gold" />
        </div>
      </div>

      {/* Middle Row: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 flex-[2] min-h-0">

        {/* Orders Summary */}
        <div className="col-span-1 lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col min-h-0 overflow-hidden orders-summary-container">
          <div className="flex justify-between items-center mb-4 flex-none">
            <div>
              <h2 className="font-bold text-gray-900 text-base">Orders Summary</h2>
              <p className="text-xs text-gray-400 mt-1">Breakdown of your recent orders</p>
            </div>
          </div>
          <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
            {categories && categories.length > 0 ? (
              <OrderCategoryChart data={categories} onCategoryClick={setSelectedCategory} />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                <ShoppingBag size={32} opacity={0.3} className="mb-2" />
                <p className="text-sm">No orders found.</p>
              </div>
            )}
          </div>
        </div>

        {/* Expenditure Chart */}
        <div className="col-span-1 lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col min-h-0">
          <div className="flex justify-between items-center mb-4 flex-none">
            <div>
              <h2 className="font-bold text-gray-900 text-base">Expenditure</h2>
              <p className="text-xs text-gray-400 mt-1">Your spending over time</p>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            {trend && trend.length > 0 ? (
              <ExpenditureTrendChart data={trend} />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                <Wallet size={32} opacity={0.3} className="mb-2" />
                <p className="text-sm">No transactions found.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-[1] min-h-0">
        <div className="col-span-1 lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col min-h-0">
          <div className="flex justify-between items-center mb-3 flex-none">
            <div>
              <h2 className="font-bold text-gray-900 text-base">Recent Activity</h2>
              <p className="text-xs text-gray-400 mt-0.5">Your latest transactions and reservations</p>
            </div>
            {/* History button */}
            <button
              onClick={() => setHistoryOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#8c764b]/30 text-[#8c764b] hover:bg-[#8c764b]/10 transition-colors text-xs font-semibold"
            >
              <History size={13} /> History
            </button>
          </div>
          <div className="flex flex-col gap-1 overflow-y-auto flex-1 pr-1">
            {!activity || activity.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                <History size={28} className="opacity-30" />
                <p className="text-sm">No activities found in this period.</p>
                <button onClick={() => setHistoryOpen(true)} className="text-xs text-[#8c764b] underline">View all history</button>
              </div>
            ) : (
              activity.map((item, idx) => (
                <ActivityItemRow key={`${item.type}-${item.id}-${idx}`} item={item} userId={userId} />
              ))
            )}
          </div>
        </div>

        <div className="col-span-1 bg-gray-800 rounded-2xl shadow-lg p-5 flex flex-col justify-between text-white relative overflow-hidden flex-none lg:flex-auto">
          <div className="absolute top-4 right-4 w-20 h-20 bg-white/5 rounded-3xl border border-white/10 rotate-12"></div>
          <div className="absolute bottom-4 right-12 w-28 h-28 bg-white/5 rounded-3xl border border-white/10 -rotate-12"></div>
          <div className="z-10 relative">
            <h2 className="text-xl font-bold mb-1 leading-tight">Manage<br />profile settings</h2>
            <p className="text-gray-400 text-xs w-5/6">Update your personal information, address, and preferences.</p>
          </div>
          <Link to="/profile/details" className="z-10 mt-4 inline-flex items-center gap-2 text-xs font-semibold hover:text-[#8c764b] transition-colors self-start bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/10 hover:bg-white hover:text-gray-900 text-white">
            Go to Profile <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        /* Date Picker Popover Overrides */
        .sfx-dp-popover {
          background: #ffffff !important;
          border: 1px solid #e5e7eb !important;
          border-radius: 16px !important;
          box-shadow: 0 10px 40px rgba(0,0,0,0.12) !important;
          color: #374151 !important;
          overflow: hidden !important;
          display: inline-flex !important;
          flex-direction: column !important;
        }

        .sfx-dp-body {
          display: grid !important;
          grid-template-columns: 180px max-content !important;
          background: #ffffff !important;
        }

        .sfx-dp-presets {
          display: flex !important;
          flex-direction: column !important;
          gap: 6px !important;
          padding: 16px 12px !important;
          border-right: 1px solid #f3f4f6 !important;
          background: #f9fafb !important;
        }

        .sfx-dp-preset {
          border: none !important;
          background: transparent !important;
          text-align: left !important;
          padding: 8px 12px !important;
          border-radius: 8px !important;
          font-size: 13px !important;
          font-weight: 500 !important;
          color: #4b5563 !important;
          cursor: pointer !important;
          transition: all 0.15s ease !important;
        }

        .sfx-dp-preset:hover {
          background: rgba(140, 118, 75, 0.08) !important;
          color: #8c764b !important;
        }

        .sfx-dp-preset.is-active {
          background: rgba(140, 118, 75, 0.12) !important;
          color: #8c764b !important;
          font-weight: 600 !important;
        }

        .sfx-dp-foot {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          padding: 12px 16px !important;
          border-top: 1px solid #f3f4f6 !important;
          background: #ffffff !important;
        }

        .sfx-dp-range-label {
          font-size: 13px !important;
          font-weight: 500 !important;
          color: #4b5563 !important;
          margin-right: auto !important;
        }

        .sfx-dp-foot-actions {
          display: flex !important;
          gap: 8px !important;
        }

        .sfx-btn {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          border-radius: 8px !important;
          cursor: pointer !important;
          transition: all 0.15s ease !important;
          border: 1px solid transparent !important;
          padding: 8px 16px !important;
        }

        .sfx-btn--ghost {
          background: #ffffff !important;
          border-color: #d1d5db !important;
          color: #374151 !important;
        }

        .sfx-btn--ghost:hover {
          background: #f9fafb !important;
          border-color: #9ca3af !important;
        }

        .sfx-btn--gold {
          background: #8c764b !important;
          color: #ffffff !important;
        }

        .sfx-btn--gold:hover {
          background: #735f3a !important;
        }

        .rdrDateRangePickerWrapper {
          background: #ffffff !important;
        }
      `}} />
    </div>
  );
};

export default CustomerDashboard;
