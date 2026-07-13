import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CalendarCheck, ShoppingBag, Wallet, Gem, Calendar, ChevronDown, ArrowRight } from 'lucide-react';
import StatCard from './StatCard';
import { ExpenditureTrendChart, OrderCategoryChart } from './DashboardCharts';
import {
  getCustomerDashboardSummary,
  getCustomerExpenditureTrend,
  getCustomerOrdersByCategory,
  getCustomerRecentActivity
} from '../services/profileApi';
import { useAuth } from '@/features/auth/context/AuthContext';
import { Link } from 'react-router-dom';
import { format, isSameDay } from "date-fns";
import DashboardDateRangePicker from "@/features/manager-dashboard/components/shared/DashboardDateRangePicker.jsx";

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
        <div className="col-span-1 xl:col-span-2">
          <ChartSkeleton type="pie" />
        </div>
        <div className="col-span-1 xl:col-span-3">
          <ChartSkeleton type="area" />
        </div>
      </div>
    </div>
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
  const { currentUser } = useAuth();
  const userId = currentUser?.user_id || currentUser?.userId || currentUser?.id;
  const userName = (currentUser?.full_name || currentUser?.fullName || currentUser?.name || 'User');

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

  const closePicker = useCallback(() => setPickerOpen(false), []);
  const openPicker = useCallback(() => {
    setDraftRange({ startDate: appliedRange.startDate, endDate: appliedRange.endDate, key: "selection" });
    setPickerOpen(true);
  }, [appliedRange]);

  const handleApplyDate = useCallback((sel) => {
    setAppliedRange({ startDate: sel.startDate, endDate: sel.endDate });
    closePicker();
  }, [closePicker]);

  const handlePresetSelect = useCallback((preset) => {
    const range = preset.range || { startDate: preset.startDate, endDate: preset.endDate, key: "selection" };
    setActivePresetId(preset.id);
    setDraftRange(range);
    setAppliedRange({ startDate: range.startDate, endDate: range.endDate });
    closePicker();
  }, [closePicker]);

  const dateFilter = useMemo(() => {
    const sd = appliedRange.startDate;
    const ed = appliedRange.endDate;
    
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
  }, [appliedRange, activePresetId]);

  const { data, isLoading, isRefetching, isError, error, refetch } = useDashboardQuery(userId, dateFilter);

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
    <div className={`h-full flex flex-col overflow-hidden p-4 gap-4 bg-[#f3f4f6] ${isRefetching ? 'opacity-85 pointer-events-none' : ''}`} style={{ transition: 'opacity 0.2s ease' }}>
      {/* Top Row: Header & KPIs */}
      <div className="flex-none flex flex-col gap-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-end gap-4">
          
          {/* Filter Periode */}
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
                <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 1000 }}>
                  <DashboardDateRangePicker
                    inline={true}
                    allowFuture={false}
                    draftRange={draftRange}
                    activePresetId={activePresetId}
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

        {/* Row 1: Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Reservations"
            value={summary?.totalReservations?.value || 0}
            icon={CalendarCheck}
            deltaPercent={summary?.totalReservations?.deltaPercent ?? null}
            formatValue={(v) => Math.round(v)}
            theme="blue"
          />
          <StatCard
            label="Total Expenditure"
            value={summary?.totalExpenditure?.value || 0}
            icon={Wallet}
            deltaPercent={summary?.totalExpenditure?.deltaPercent ?? null}
            formatValue={(v) => `${Math.round(v).toLocaleString('vi-VN')} VND`}
            theme="red"
          />
          <StatCard
            label="Total Orders"
            value={summary?.totalOrders?.value || 0}
            icon={ShoppingBag}
            deltaPercent={summary?.totalOrders?.deltaPercent ?? null}
            formatValue={(v) => Math.round(v)}
            theme="green"
          />
          <StatCard
            label="Loyalty Points"
            value={summary?.totalLoyaltyPoints?.value || 0}
            icon={Gem}
            deltaPercent={summary?.totalLoyaltyPoints?.deltaPercent ?? null}
            formatValue={(v) => Math.round(v)}
            theme="gold"
          />
        </div>
      </div>

      {/* Middle Row: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 flex-[2] min-h-0">
        
        {/* Orders Summary (Pie) */}
        <div className="col-span-1 lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col min-h-0">
          <div className="flex justify-between items-center mb-4 flex-none">
            <div>
              <h2 className="font-bold text-gray-900 text-base">Orders Summary</h2>
              <p className="text-xs text-gray-400 mt-1">Breakdown of your recent orders</p>
            </div>
            <Link to="/profile/payments" className="text-xs font-semibold text-[#8c764b] hover:underline">
              Manage
            </Link>
          </div>
          
          <div className="flex-1 min-h-0 flex flex-col">
            {categories && categories.length > 0 ? (
              <OrderCategoryChart data={categories} />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                <ShoppingBag size={32} opacity={0.3} className="mb-2" />
                <p className="text-sm">No orders found.</p>
              </div>
            )}
          </div>
        </div>

        {/* Revenue (Expenditure Area Chart) */}
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

      {/* Bottom Row: Recent Activity & Manage Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-[1] min-h-0">
        <div className="col-span-1 lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col min-h-0">
          <div className="flex justify-between items-center mb-3 flex-none">
            <div>
              <h2 className="font-bold text-gray-900 text-base">Recent Activity</h2>
              <p className="text-xs text-gray-400 mt-0.5">Your latest transactions and reservations</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 overflow-y-auto flex-1 pr-2">
            {!activity || activity.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No activities found in this period.</p>
            ) : (
              activity.map((item, idx) => (
                <div key={`${item.type}-${item.id}-${idx}`} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-100 text-gray-600 shadow-sm border border-gray-200">
                      {item.type === 'order' ? <ShoppingBag size={18} /> : <CalendarCheck size={18} />}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-gray-800 capitalize">{item.type} #{item.id}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(item.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-gray-900">
                      {`${Math.round(item.amount).toLocaleString('vi-VN')} VND`}
                    </p>
                    <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${item.status === 'Completed' || item.status === 'Paid' || item.status === 'Served'
                        ? 'bg-green-100 text-green-700'
                        : (item.status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700')
                      }`}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="col-span-1 bg-gray-800 rounded-2xl shadow-lg p-5 flex flex-col justify-between text-white relative overflow-hidden flex-none lg:flex-auto">
          {/* Decorative abstract squares */}
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
