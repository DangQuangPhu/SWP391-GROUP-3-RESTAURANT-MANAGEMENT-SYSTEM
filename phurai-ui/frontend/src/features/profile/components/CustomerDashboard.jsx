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
    <div className="h-full flex flex-col overflow-hidden p-4 gap-4 bg-white">
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

  // Filter Period State
  const [filterType, setFilterType] = useState('30d');
  
  const dateFilter = useMemo(() => {
    const end = new Date();
    const start = new Date();
    if (filterType === 'today') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { range: 'today', startDate: start.toISOString(), endDate: end.toISOString(), label: 'Today' };
    }
    if (filterType === '7d') {
      start.setDate(end.getDate() - 7);
      return { range: '7d', startDate: start.toISOString(), endDate: end.toISOString(), label: 'Last 7 Days' };
    }
    if (filterType === '30d') {
      start.setDate(end.getDate() - 30);
      return { range: '30d', startDate: start.toISOString(), endDate: end.toISOString(), label: 'Last 30 Days' };
    }
    if (filterType === '1y') {
      start.setFullYear(end.getFullYear() - 1);
      return { range: '1y', startDate: start.toISOString(), endDate: end.toISOString(), label: 'Last Year' };
    }
    return { range: 'all', startDate: null, endDate: null, label: 'All Time' };
  }, [filterType]);

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
    <div className={`h-full flex flex-col overflow-hidden p-4 gap-4 bg-white ${isRefetching ? 'opacity-85 pointer-events-none' : ''}`} style={{ transition: 'opacity 0.2s ease' }}>
      {/* Top Row: Header & KPIs */}
      <div className="flex-none flex flex-col gap-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500 mt-1">Welcome back, {userName}!</p>
          </div>
          
          {/* Filter Periode */}
          <div className="flex items-center gap-3">
            {isRefetching && (
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8c764b] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#8c764b]"></span>
              </span>
            )}
            <div className="relative group z-20">
              <button className="flex items-center gap-3 bg-white border border-gray-200 px-4 py-2.5 rounded-xl shadow-sm hover:bg-gray-50 transition-colors">
                <div className="bg-blue-50 p-1.5 rounded-lg text-[#8c764b]">
                  <Calendar size={18} strokeWidth={2.5} />
                </div>
                <div className="text-left mr-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Filter Period</p>
                  <p className="text-sm font-semibold text-gray-800">{dateFilter.label}</p>
                </div>
                <ChevronDown size={16} className="text-gray-400" />
              </button>
              
              <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <div className="py-1">
                  <button onClick={() => setFilterType('today')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Today</button>
                  <button onClick={() => setFilterType('7d')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Last 7 Days</button>
                  <button onClick={() => setFilterType('30d')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Last 30 Days</button>
                  <button onClick={() => setFilterType('1y')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Last Year</button>
                  <button onClick={() => setFilterType('all')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">All Time</button>
                </div>
              </div>
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
          />
          <StatCard
            label="Total Expenditure"
            value={summary?.totalExpenditure?.value || 0}
            icon={Wallet}
            deltaPercent={summary?.totalExpenditure?.deltaPercent ?? null}
            formatValue={(v) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(v)}
          />
          <StatCard
            label="Total Orders"
            value={summary?.totalOrders?.value || 0}
            icon={ShoppingBag}
            deltaPercent={summary?.totalOrders?.deltaPercent ?? null}
            formatValue={(v) => Math.round(v)}
          />
          <StatCard
            label="Loyalty Points"
            value={summary?.totalLoyaltyPoints?.value || 0}
            icon={Gem}
            deltaPercent={summary?.totalLoyaltyPoints?.deltaPercent ?? null}
            formatValue={(v) => Math.round(v)}
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
                      {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.amount)}
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
    </div>
  );
};

export default CustomerDashboard;
