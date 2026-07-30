import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiGet } from '@/core/api/httpClient';
import PortalIcon from '@/components/portal/PortalIcon.jsx';
import '../styles/AdminDashboardPage.css';
import '../../manager-dashboard/styles/manager-dashboard.css';
import {
  SkeletonPresence,
  Skeleton,
  KpiSkeleton,
  fadeScaleVariants,
  listContainerVariants,
  listItemVariants,
} from '@/components/ui/Skeleton';
import AdminReviewsTable from '../components/AdminReviewsTable.jsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';

const COLORS = ['#9f8655', '#5a8bb0', '#2f7d4f', '#b7791f', '#7c5cbf', '#b42318', '#3a6ea5', '#e3d6b8'];

/* ── Skeleton for chart panel ─────────────────────────────────── */
function ChartSkeleton() {
  return (
    <motion.div
      key="chart-skeleton"
      variants={fadeScaleVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      aria-busy="true"
      style={{
        background: '#fff',
        borderRadius: 16,
        border: '1px solid rgba(31,26,23,0.07)',
        boxShadow: '0 1px 2px rgba(31,26,23,0.04), 0 8px 24px rgba(31,26,23,0.06)',
        padding: '20px 24px',
      }}
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Skeleton className="w-40 h-5" />
        <Skeleton className="w-24 h-5" style={{ marginLeft: 'auto' }} />
      </div>
      <Skeleton className="w-full" style={{ height: 280, borderRadius: 10 }} />
    </motion.div>
  );
}

/* ── Analytics meta per type ──────────────────────────────────── */
const ANALYTICS_META = {
  revenue: {
    icon: 'chart',
    label: 'Revenue Trend',
    color: 'green',
    kpiKeys: [],
  },
  reservations: {
    icon: 'calendar',
    label: 'Reservation Analytics',
    color: 'blue',
    kpiKeys: [],
  },
  orders: {
    icon: 'orders',
    label: 'Order Analytics',
    color: 'amber',
    kpiKeys: [],
  },
  reviews: {
    icon: 'star',
    label: 'Customer Reviews',
    color: 'gold',
    kpiKeys: [],
  },
  'staff-performance': {
    icon: 'staff',
    label: 'Staff Performance',
    color: 'purple',
    kpiKeys: [],
  },
};

import DashboardDateRangePicker from '../../manager-dashboard/components/shared/DashboardDateRangePicker.jsx';
import { useCountUp } from '@/hooks/useCountUp.js';
import { getDefaultDateRange, formatDateRangeLabel } from '@/shared/constants.js';

/* ── KPI summary row ──────────────────────────────────────────── */
function AnimatedKpiValue({ value, formatFn = (v) => Math.round(v) }) {
  const isNumeric = typeof value === 'number' && !isNaN(value);
  const display = useCountUp(isNumeric ? value : 0, 0.8, formatFn);
  return <>{isNumeric ? display : value}</>;
}

function KpiRow({ data, type }) {
  const cards = deriveKpis(data, type);
  if (!cards.length) return null;
  return (
    <motion.div
      className="adp-analytic-kpis"
      variants={listContainerVariants}
      initial="hidden"
      animate="visible"
    >
      {cards.map((c, i) => (
        <motion.div key={i} className={`sfx-kpi sfx-kpi--${c.color || 'blue'}`} variants={listItemVariants}>
          <div className="sfx-kpi__top">
            <button
              type="button"
              className="sfx-kpi__icon sfx-kpi__icon--trigger"
              title={c.label}
              aria-label={c.label}
              tabIndex={-1}
              style={{ pointerEvents: 'none' }}
            >
              <PortalIcon name={c.icon} size={16} />
            </button>
          </div>
          <div className="sfx-kpi__value">
            <AnimatedKpiValue value={c.value} formatFn={c.formatFn} />
            {c.suffix ? <span className="sfx-kpi__suffix">{c.suffix}</span> : null}
          </div>
          <p className="sfx-kpi__label">{c.label}</p>
        </motion.div>
      ))}
    </motion.div>
  );
}

function deriveKpis(data, type) {
  if (!data || !data.length) return [];
  switch (type) {
    case 'revenue': {
      const total = data.reduce((sum, item) => sum + (item.daily_revenue || 0), 0);
      const avg = data.length ? total / data.length : 0;
      return [
        { icon: 'chart', label: 'Total Revenue', color: 'green', value: total, formatFn: fmtVnd, suffix: ' VND' },
        { icon: 'chart', label: 'Daily Average', color: 'blue', value: avg, formatFn: fmtVnd, suffix: ' VND' },
        { icon: 'orders', label: 'Days with Revenue', color: 'amber', value: data.filter(d => d.daily_revenue > 0).length, formatFn: v => Math.round(v) },
      ];
    }
    case 'reservations': {
      const total = data.reduce((s, d) => s + (Number(d.count) || 0), 0);
      const completed = data.find(d => d.reservation_status === 'Completed')?.count || 0;
      const pending = data.find(d => d.reservation_status === 'Pending')?.count || 0;
      return [
        { icon: 'calendar', label: 'Total Reservations', color: 'blue', value: total, formatFn: v => Math.round(v) },
        { icon: 'check', label: 'Completed', color: 'green', value: completed, formatFn: v => Math.round(v) },
        { icon: 'clock', label: 'Pending', color: 'amber', value: pending, formatFn: v => Math.round(v) },
        { icon: 'close', label: 'Statuses', color: 'purple', value: data.length, formatFn: v => Math.round(v) },
      ];
    }
    case 'orders': {
      const total = data.reduce((s, d) => s + (Number(d.count) || 0), 0);
      const avgVal = data.reduce((s, d) => s + (Number(d.avg_value) || 0), 0) / (data.length || 1);
      return [
        { icon: 'orders', label: 'Total Orders', color: 'amber', value: total, formatFn: v => Math.round(v) },
        { icon: 'chart', label: 'Avg Order Value', color: 'green', value: avgVal, formatFn: fmtVnd, suffix: ' VND' },
        { icon: 'tag', label: 'Order Types', color: 'blue', value: data.length, formatFn: v => Math.round(v) },
      ];
    }
    case 'reviews': {
      const total = data.reduce((s, d) => s + (Number(d.count) || 0), 0);
      const weighted = data.reduce((s, d) => s + (Number(d.overall_rating) * Number(d.count)), 0);
      const avg = total ? (weighted / total) : 0;
      return [
        { icon: 'star', label: 'Total Reviews', color: 'amber', value: total, formatFn: v => Math.round(v) },
        { icon: 'star', label: 'Avg Rating', color: 'green', value: avg, formatFn: v => total === 0 ? '—' : v.toFixed(1), suffix: '★' },
        { icon: 'chart', label: 'Rating Levels', color: 'blue', value: data.length, formatFn: v => Math.round(v) },
      ];
    }
    case 'staff-performance': {
      const totalShifts = data.reduce((s, d) => s + (Number(d.total_shifts) || 0), 0);
      const top = data.reduce((best, d) => (Number(d.total_shifts) > Number(best.total_shifts) ? d : best), data[0] || {});
      return [
        { icon: 'staff', label: 'Staff Members', color: 'purple', value: data.length, formatFn: v => Math.round(v) },
        { icon: 'orders', label: 'Total Shifts', color: 'blue', value: totalShifts, formatFn: v => Math.round(v) },
        { icon: 'star', label: 'Top Performer', color: 'green', value: top?.staff_code || '—' },
      ];
    }
    default: return [];
  }
}

function fmtVnd(n) {
  if (!n && n !== 0) return '—';
  const num = Math.round(Number(n));
  return new Intl.NumberFormat('en-US').format(num);
}

function fmtVndShort(n) {
  if (!n && n !== 0) return '—';
  const num = Math.round(Number(n));
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(0) + 'k';
  return num.toString();
}

/* ── Chart renderers ──────────────────────────────────────────── */
function renderChart(type, data) {
  const chartCard = {
    background: '#fff',
    borderRadius: 16,
    border: '1px solid rgba(31,26,23,0.07)',
    boxShadow: '0 1px 2px rgba(31,26,23,0.04), 0 8px 24px rgba(31,26,23,0.06)',
    padding: '20px 24px',
  };

  switch (type) {
    case 'revenue':
      return (
        <motion.div style={{ ...chartCard, height: 360 }} variants={fadeScaleVariants} initial="hidden" animate="visible">
          <h3 className="adp-chart-title">Daily Revenue (VND)</h3>
          <ResponsiveContainer width="100%" height={290} minWidth={1} minHeight={290}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#9f8655" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#9f8655" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickMargin={8} stroke="#c9c0b2" />
              <YAxis tickFormatter={v => fmtVndShort(v)} tick={{ fontSize: 11 }} stroke="#c9c0b2" />
              <Tooltip formatter={v => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v)} />
              <Area type="monotone" dataKey="daily_revenue" name="Revenue" stroke="#9f8655" strokeWidth={2.5} fill="url(#revGrad)" activeDot={{ r: 6 }} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      );

    case 'reservations':
      return (
        <motion.div style={{ ...chartCard, height: 360 }} variants={fadeScaleVariants} initial="hidden" animate="visible">
          <h3 className="adp-chart-title">Reservations by Status</h3>
          <ResponsiveContainer width="100%" height={290} minWidth={1} minHeight={290}>
            <BarChart data={data} barSize={36}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="reservation_status" tick={{ fontSize: 12 }} stroke="#c9c0b2" />
              <YAxis tick={{ fontSize: 12 }} stroke="#c9c0b2" />
              <Tooltip />
              <Bar dataKey="count" name="Total" fill="#5a8bb0" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      );

    case 'orders':
      return (
        <motion.div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}
          variants={fadeScaleVariants} initial="hidden" animate="visible"
        >
          <div style={{ ...chartCard, height: 360 }}>
            <h3 className="adp-chart-title">Orders by Status</h3>
            <ResponsiveContainer width="100%" height={280} minWidth={1} minHeight={280}>
              <PieChart>
                <Pie data={data} dataKey="count" nameKey="order_status" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ ...chartCard, height: 360 }}>
            <h3 className="adp-chart-title">Avg Order Value by Status (VND)</h3>
            <ResponsiveContainer width="100%" height={280} minWidth={1} minHeight={280}>
              <BarChart data={data} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="order_status" tick={{ fontSize: 11 }} stroke="#c9c0b2" />
                <YAxis tickFormatter={v => fmtVndShort(v)} tick={{ fontSize: 11 }} stroke="#c9c0b2" />
                <Tooltip formatter={v => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v)} />
                <Bar dataKey="avg_value" name="Avg Value" fill="#b8a379" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      );

    case 'reviews':
      return (
        <motion.div style={{ ...chartCard, height: 360 }} variants={fadeScaleVariants} initial="hidden" animate="visible">
          <h3 className="adp-chart-title">Reviews by Rating</h3>
          <ResponsiveContainer width="100%" height={290} minWidth={1} minHeight={290}>
            <BarChart data={data} layout="vertical" barSize={28}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke="#c9c0b2" />
              <YAxis dataKey="overall_rating" type="category" tick={{ fontSize: 12 }} stroke="#c9c0b2" tickFormatter={v => `${v} ★`} width={48} />
              <Tooltip />
              <Bar dataKey="count" name="Reviews" fill="#f6c453" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      );

    case 'staff-performance':
      return (
        <motion.div style={{ ...chartCard, height: 360 }} variants={fadeScaleVariants} initial="hidden" animate="visible">
          <h3 className="adp-chart-title">Shifts Handled per Staff</h3>
          <ResponsiveContainer width="100%" height={290} minWidth={1} minHeight={290}>
            <BarChart data={data} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="staff_code" tick={{ fontSize: 11 }} stroke="#c9c0b2" />
              <YAxis tick={{ fontSize: 12 }} stroke="#c9c0b2" />
              <Tooltip />
              <Bar dataKey="total_shifts" name="Shifts" fill="#7c5cbf" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      );

    default:
      return <div style={{ textAlign: 'center', padding: 48, color: '#8a8175' }}>Unsupported chart type.</div>;
  }
}

import { useSocket } from '@/core/socket/SocketContext.jsx';

/* ── Main component ───────────────────────────────────────────── */
export default function Analytics({ type, title, description }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { socket } = useSocket();

  const today = React.useMemo(() => new Date(), []);
  const [dateRange, setDateRange] = useState(() => {
    if (type === 'reviews') {
      return { startDate: null, endDate: null, key: "selection" };
    }
    return getDefaultDateRange(today);
  });
  const [draftRange, setDraftRange] = useState(() => {
    if (type === 'reviews') {
      return { startDate: null, endDate: null, key: "selection" };
    }
    return getDefaultDateRange(today);
  });
  const [activePresetId, setActivePresetId] = useState(type === 'reviews' ? "allDates" : "last30");
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerAnchorRef = React.useRef(null);
  const dateRangeLabel = React.useMemo(() => formatDateRangeLabel(dateRange), [dateRange]);

  const [fetchTrigger, setFetchTrigger] = useState(0);
  const [localRefreshing, setLocalRefreshing] = useState(false);

  // Listen for global Refresh Data button from AdminLayout
  useEffect(() => {
    const handler = () => setFetchTrigger(t => t + 1);
    window.addEventListener('phurai_admin_refresh', handler);
    return () => window.removeEventListener('phurai_admin_refresh', handler);
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleNewReview = () => {
      setFetchTrigger(t => t + 1);
    };
    socket.on('review:created', handleNewReview);
    return () => {
      socket.off('review:created', handleNewReview);
    };
  }, [socket]);

  useEffect(() => {
    let alive = true;
    async function fetchAnalytics() {
      try {
        setLoading(true);
        setError(null);
        const queryParams = new URLSearchParams();
        if (dateRange.startDate) queryParams.append('startDate', dateRange.startDate.toISOString());
        if (dateRange.endDate) queryParams.append('endDate', dateRange.endDate.toISOString());
        const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
        const res = await apiGet(`/admin/analytics/${type}${qs}`);
        if (!alive) return;
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError('Failed to load analytics data.');
        }
      } catch (err) {
        if (!alive) return;
        setError(err.message || 'An error occurred while fetching analytics.');
      } finally {
        if (alive) setLoading(false);
      }
    }
    fetchAnalytics();
    return () => { alive = false; };
  }, [type, dateRange, fetchTrigger]);

  const handleLocalRefresh = useCallback(() => {
    if (localRefreshing) return;
    setLocalRefreshing(true);
    setFetchTrigger(t => t + 1);
    setTimeout(() => setLocalRefreshing(false), 1500);
  }, [localRefreshing]);

  const meta = ANALYTICS_META[type] || {};

  return (
    <div className="adp-analytic-root">
      {/* Page header */}
      <div className="adp-analytic-header">
        <div className="adp-analytic-header__text">
          <h2 className="adp-page-title">{title || meta.label || 'Analytics'}</h2>
          <p className="adp-subtitle">{description || 'Data insights for operational decisions'}</p>
        </div>
      </div>

      {/* Filter bar replacement */}
      <div className="adp-filter-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', overflow: 'visible' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="adp-filter-bar__label" style={{ margin: 0 }}>Period: <span style={{ fontWeight: 500, color: '#1f1a17', marginLeft: 4 }}>{dateRangeLabel}</span></span>
          <div
            className={`sfx-chart__picker-anchor${pickerOpen ? " is-open" : ""}`}
            ref={pickerAnchorRef}
            style={{ position: "relative" }}
          >
            <button
              type="button"
              className="sfx-kpi__icon sfx-kpi__icon--trigger"
              style={{ position: "relative", zIndex: 20, background: "#f8f5ef", border: "1px solid #e2dcd0", borderRadius: 8, width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#b09460", cursor: "pointer" }}
              onClick={() => (pickerOpen ? setPickerOpen(false) : setPickerOpen(true))}
              aria-label="Choose date range"
              aria-expanded={pickerOpen}
            >
              <PortalIcon name="calendar" size={18} />
            </button>
            {pickerOpen && (
              <div style={{
                position: "absolute",
                left: 0,
                top: "calc(100% + 8px)",
                zIndex: 1000,
              }}>
                <DashboardDateRangePicker
                  inline={true}
                  draftRange={draftRange}
                  activePresetId={activePresetId}
                  onDraftChange={(selection) => {
                    setDraftRange(selection);
                    setActivePresetId("custom");
                  }}
                  onPresetSelect={(preset) => {
                    setActivePresetId(preset.id);
                    setDraftRange(preset.range);
                  }}
                  onApply={(selection) => {
                    setDateRange(selection);
                    setPickerOpen(false);
                    setFetchTrigger(t => t + 1);
                  }}
                  onCancel={() => {
                    setPickerOpen(false);
                    setDraftRange(dateRange);
                  }}
                />
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          className="adp-filter-bar__refresh"
          onClick={handleLocalRefresh}
          disabled={localRefreshing || loading}
          title="Refresh chart data"
        >
          <PortalIcon name="refresh" size={14} />
          <span>{localRefreshing || loading ? 'Refreshing…' : 'Refresh'}</span>
        </button>
      </div>

      {/* KPI summary */}
      <AnimatePresence mode="wait">
        {loading ? (
          <KpiSkeleton key="kpi-sk" count={3} className="adp-analytic-kpis" />
        ) : (
          <KpiRow key="kpi-row" data={data} type={type} />
        )}
      </AnimatePresence>

      {/* Chart */}
      <AnimatePresence mode="wait">
        {error ? (
          <motion.div
            key="err"
            variants={fadeScaleVariants} initial="hidden" animate="visible"
            style={{ background: '#fff1f0', border: '1px solid #fecaca', borderRadius: 12, padding: '20px 24px', color: '#b42318' }}
          >
            {error}
          </motion.div>
        ) : loading ? (
          <ChartSkeleton key="chart-sk" />
        ) : !data.length ? (
          <motion.div
            key="empty"
            variants={fadeScaleVariants} initial="hidden" animate="visible"
            style={{ background: '#f9fafb', border: '1px solid rgba(31,26,23,0.07)', borderRadius: 12, padding: '48px 24px', textAlign: 'center', color: '#8a8175' }}
          >
            No data available for this metric.
          </motion.div>
        ) : (
          <motion.div key="chart" variants={fadeScaleVariants} initial="hidden" animate="visible">
            {renderChart(type, data)}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Render Reviews Table if type is 'reviews' */}
      {type === 'reviews' && (
        <AdminReviewsTable startDate={dateRange.startDate} endDate={dateRange.endDate} />
      )}

      {/* Render Incoming Reports Table if type is 'revenue' */}
      {type === 'revenue' && (
        <AdminIncomingReportsTable />
      )}
    </div>
  );
}

function AdminIncomingReportsTable() {
  const [submissions, setSubmissions] = useState([]);
  const [unreviewedCount, setUnreviewedCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchSubmissions = useCallback(async () => {
    try {
      const res = await apiGet('/admin/reports/submissions');
      if (res?.success) {
        setSubmissions(res.data || []);
        setUnreviewedCount(res.unreviewed_count || 0);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const handleMarkReviewed = async (id) => {
    try {
      const token = localStorage.getItem("phurai_token") || localStorage.getItem("token");
      const response = await fetch(`http://localhost:5001/api/admin/reports/submissions/${id}/review`, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        fetchSubmissions();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownload = (id) => {
    const token = localStorage.getItem("phurai_token") || localStorage.getItem("token");
    window.open(`http://localhost:5001/api/admin/reports/submissions/${id}/download?token=${token}`, '_blank');
  };

  const handleView = (item) => {
    const token = localStorage.getItem("phurai_token") || localStorage.getItem("token");
    window.open(`http://localhost:5001/api/admin/reports/submissions/${item.submission_id}/view?token=${token}`, '_blank');
  };

  return (
    <div style={{ marginTop: 24, background: '#fff', borderRadius: 16, border: '1px solid rgba(31,26,23,0.07)', padding: '20px 24px', boxShadow: '0 1px 2px rgba(31,26,23,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h3 className="adp-chart-title" style={{ margin: 0 }}>Incoming Reports (Manager Submissions)</h3>
          {unreviewedCount > 0 && (
            <span style={{ background: '#e06c6c', color: '#fff', fontSize: '11px', fontWeight: 'bold', borderRadius: '12px', padding: '2px 8px' }}>
              {unreviewedCount} New
            </span>
          )}
        </div>
        <button type="button" onClick={fetchSubmissions} style={{ background: 'none', border: '1px solid #e2dcd0', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: '12px' }}>
          Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#888' }}>Loading submitted reports...</div>
      ) : submissions.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#888' }}>No submissions received from Managers yet.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#faf8f5', textAlign: 'left', borderBottom: '1px solid #eee' }}>
                <th style={{ padding: '10px 12px' }}>Manager</th>
                <th style={{ padding: '10px 12px' }}>Report Type</th>
                <th style={{ padding: '10px 12px' }}>Date Range</th>
                <th style={{ padding: '10px 12px' }}>Submitted At</th>
                <th style={{ padding: '10px 12px' }}>Status</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((item, idx) => {
                let dateRangeStr = "—";
                if (item.date_range_from) {
                  dateRangeStr = `${String(item.date_range_from).split('T')[0]} to ${String(item.date_range_to).split('T')[0]}`;
                } else if (item.intent_json) {
                  try {
                    const parsed = typeof item.intent_json === "string" ? JSON.parse(item.intent_json) : item.intent_json;
                    if (parsed.date_range?.from) {
                      dateRangeStr = `${parsed.date_range.from} to ${parsed.date_range.to}`;
                    }
                  } catch {
                    // Ignore JSON parse error fallback
                  }
                }

                return (
                  <tr key={item.submission_id || idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{item.manager_name}</td>
                    <td style={{ padding: '10px 12px' }}>{item.report_type}</td>
                    <td style={{ padding: '10px 12px' }}>{dateRangeStr}</td>
                    <td style={{ padding: '10px 12px' }}>{new Date(item.submitted_at).toLocaleString('vi-VN')}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 10, fontSize: '11px', fontWeight: 600,
                        background: item.status === 'Submitted' ? '#fef3c7' : '#d1fae5',
                        color: item.status === 'Submitted' ? '#92400e' : '#065f46'
                      }}>
                        {item.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={() => handleView(item)}
                          style={{ background: '#8b5cf6', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}
                        >
                          View Direct
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownload(item.submission_id)}
                          style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: '12px' }}
                        >
                          Download
                        </button>
                        {item.status === 'Submitted' && (
                          <button
                            type="button"
                            onClick={() => handleMarkReviewed(item.submission_id)}
                            style={{ background: '#10b981', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: '12px' }}
                          >
                            Mark Reviewed
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
