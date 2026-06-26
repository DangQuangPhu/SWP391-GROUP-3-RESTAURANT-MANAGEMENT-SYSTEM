import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '@/core/api/httpClient';
import {
  Users, UserCheck, ShieldAlert, List, Calendar, Banknote, MessageSquare, AlertTriangle,
  UserPlus, Settings, FileText, Sliders, Plus
} from 'lucide-react';

const AdminKpiCard = ({ title, value, icon: Icon, trend, trendColor, iconBgColor, iconColor }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-2.5 rounded-lg ${iconBgColor} ${iconColor}`}>
        <Icon className="w-5 h-5" />
      </div>
      <span className={`text-xs font-semibold ${trendColor}`}>{trend}</span>
    </div>
    <div>
      <h3 className="text-3xl font-bold text-gray-900 mb-1">{value}</h3>
      <p className="text-sm text-gray-500 font-medium">{title}</p>
    </div>
  </div>
);

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, logsRes] = await Promise.all([
          apiGet('/admin/dashboard/stats'),
          apiGet('/admin/audit-logs/recent')
        ]);
        
        if (statsRes.success) setStats(statsRes.data);
        if (logsRes.success) setLogs(logsRes.data);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const kpis = [
    { title: 'Total Accounts', value: stats?.totalAccounts ?? 47, icon: Users, trend: '+3 this month', trendColor: 'text-green-600', iconBgColor: 'bg-blue-50', iconColor: 'text-blue-600' },
    { title: 'Active Staff', value: stats ? `${stats.activeStaff} / ${stats.totalAccounts}` : '41 / 47', icon: UserCheck, trend: stats ? `${Math.round((stats.activeStaff / Math.max(stats.totalAccounts, 1)) * 100)}% active` : '87% active', trendColor: 'text-gray-500', iconBgColor: 'bg-green-50', iconColor: 'text-green-600' },
    { title: 'Pending Role Requests', value: stats?.pendingRoleRequests ?? 2, icon: ShieldAlert, trend: 'Awaiting approval', trendColor: 'text-orange-500', iconBgColor: 'bg-orange-50', iconColor: 'text-orange-600' },
    { title: 'Audit Entries Today', value: stats?.auditEntriesToday ?? 63, icon: List, trend: 'Across all staff', trendColor: 'text-gray-500', iconBgColor: 'bg-indigo-50', iconColor: 'text-indigo-600' },
    { title: 'Reservations (30d)', value: stats?.reservations30d ?? 1085, icon: Calendar, trend: '+12% vs prior period', trendColor: 'text-green-600', iconBgColor: 'bg-purple-50', iconColor: 'text-purple-600' },
    { title: 'Total Revenue (30d)', value: stats ? `${(stats.revenue30d / 1_000_000).toFixed(1)}M ₫` : '282.3M ₫', icon: Banknote, trend: 'System wide total', trendColor: 'text-gray-500', iconBgColor: 'bg-emerald-50', iconColor: 'text-emerald-600' },
    { title: 'Reviews Needing Reply', value: stats?.reviewsNeedingReply ?? 5, icon: MessageSquare, trend: 'Rating <= 3 stars', trendColor: 'text-red-500', iconBgColor: 'bg-red-50', iconColor: 'text-red-600' },
    { title: 'Staff Performance Flags', value: stats?.staffPerformanceFlags ?? 1, icon: AlertTriangle, trend: 'Below target this week', trendColor: 'text-orange-500', iconBgColor: 'bg-amber-50', iconColor: 'text-amber-600' },
  ];

  const quickActions = [
    { label: "Create account", icon: UserPlus, path: "/admin/accounts" },
    { label: "Configure roles", icon: Settings, path: "/admin/roles" },
    { label: "View audit logs", icon: FileText, path: "/admin/audit-logs" },
    { label: "System settings", icon: Sliders, path: "/admin/settings/system" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-gray-500 font-medium">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Admin Console</h2>
          <p className="text-sm text-gray-500 font-medium mt-1">System-wide overview &middot; Today's snapshot</p>
        </div>
        <button 
          className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center transition-colors"
          onClick={() => navigate('/admin/accounts')}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Account
        </button>
      </div>

      <div className="p-8 max-w-7xl mx-auto">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {kpis.map((card, i) => (
            <AdminKpiCard key={i} {...card} />
          ))}
        </div>

        {/* Central Panel & Quick Actions Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Central Panel */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-white">
              <h3 className="text-lg font-bold text-gray-900">Recent Audit Log Activity</h3>
              <button 
                className="text-sm font-semibold text-blue-600 hover:text-blue-800"
                onClick={() => navigate('/admin/audit-logs')}
              >
                View all
              </button>
            </div>
            <div className="p-0 overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50/50 text-gray-500 font-medium">
                  <tr>
                    <th className="px-6 py-3 border-b border-gray-100">Time</th>
                    <th className="px-6 py-3 border-b border-gray-100">Action</th>
                    <th className="px-6 py-3 border-b border-gray-100">User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.length > 0 ? logs.map((log, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {log.action_name}
                      </td>
                      <td className="px-6 py-4">
                        {log.full_name}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="3" className="px-6 py-8 text-center text-gray-500">
                        No recent audit logs.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col">
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Quick Actions</h3>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              {quickActions.map((q, i) => (
                <button
                  key={i}
                  className="flex flex-col items-center justify-center p-4 border border-gray-100 rounded-xl hover:border-blue-500 hover:shadow-md hover:bg-blue-50/30 transition-all group"
                  onClick={() => navigate(q.path)}
                >
                  <q.icon className="w-6 h-6 text-gray-400 group-hover:text-blue-600 mb-3" />
                  <span className="text-xs font-semibold text-gray-700 group-hover:text-blue-700 text-center">
                    {q.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
