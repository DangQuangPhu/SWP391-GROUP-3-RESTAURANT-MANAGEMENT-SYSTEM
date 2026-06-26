import React, { useEffect, useState } from 'react';
import { apiGet } from '@/core/api/httpClient';
import AdminPageHeader from '@/features/admin-dashboard/components/AdminPageHeader';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#8c764b', '#b8a379', '#d4bc8b', '#f6c453', '#3b2c15', '#6b5c3e', '#5a8bb0', '#e3d6b8'];

export default function Analytics({ type, title, description }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setLoading(true);
        setError(null);
        const res = await apiGet(`/admin/analytics/${type}`);
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError('Failed to load analytics data.');
        }
      } catch (err) {
        console.error(`Error fetching ${type} analytics:`, err);
        setError(err.message || 'An error occurred while fetching analytics.');
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, [type]);

  const renderChart = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#8c764b]"></div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-red-50 border border-red-100 rounded-xl p-6 text-red-700 text-center">
          {error}
        </div>
      );
    }

    if (!data || data.length === 0) {
      return (
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-10 text-gray-500 text-center">
          No data available for this metric.
        </div>
      );
    }

    switch (type) {
      case 'revenue':
        return (
          <div className="h-96 w-full bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{fontSize: 12}} tickMargin={10} stroke="#9ca3af" />
                <YAxis tickFormatter={(val) => `₫${(val/1000).toFixed(0)}k`} tick={{fontSize: 12}} stroke="#9ca3af" />
                <Tooltip formatter={(value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)} />
                <Legend />
                <Line type="monotone" dataKey="daily_revenue" name="Daily Revenue" stroke="#8c764b" strokeWidth={3} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      
      case 'reservations':
        return (
          <div className="h-96 w-full bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="reservation_status" tick={{fontSize: 12}} stroke="#9ca3af" />
                <YAxis tick={{fontSize: 12}} stroke="#9ca3af" />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" name="Total Reservations" fill="#5a8bb0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case 'orders':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-96 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-500 mb-4 text-center">Orders by Status</h3>
              <ResponsiveContainer width="100%" height="90%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="count"
                    nameKey="order_status"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="h-96 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-500 mb-4 text-center">Average Value by Status</h3>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="order_status" tick={{fontSize: 12}} stroke="#9ca3af" />
                  <YAxis tickFormatter={(val) => `₫${(val/1000).toFixed(0)}k`} tick={{fontSize: 12}} stroke="#9ca3af" />
                  <Tooltip formatter={(value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)} />
                  <Bar dataKey="avg_value" name="Avg Value" fill="#b8a379" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case 'reviews':
        return (
          <div className="h-96 w-full bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" tick={{fontSize: 12}} stroke="#9ca3af" />
                <YAxis dataKey="overall_rating" type="category" tick={{fontSize: 12}} stroke="#9ca3af" tickFormatter={(val) => `${val} Stars`} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" name="Number of Reviews" fill="#f6c453" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case 'staff-performance':
        return (
          <div className="h-96 w-full bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="staff_code" tick={{fontSize: 12}} stroke="#9ca3af" />
                <YAxis tick={{fontSize: 12}} stroke="#9ca3af" />
                <Tooltip />
                <Legend />
                <Bar dataKey="total_shifts" name="Total Shifts Handled" fill="#8c764b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      default:
        return <div>Unsupported chart type.</div>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <AdminPageHeader
        title={title}
        description={description}
      />
      {renderChart()}
    </div>
  );
}
