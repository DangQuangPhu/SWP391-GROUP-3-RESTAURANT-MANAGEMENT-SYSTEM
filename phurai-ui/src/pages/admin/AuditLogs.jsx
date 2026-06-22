import React, { useEffect, useState } from 'react';
import { apiGet } from '@/core/api/httpClient';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminDataTable from '@/components/admin/AdminDataTable';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiGet('/admin/audit-logs');
      if (res.success && res.data) {
        setLogs(res.data);
      } else {
        setError('Failed to load audit logs.');
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setError(err.message || 'An error occurred while fetching audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const formatTimestamp = (isoString) => {
    if (!isoString) return 'N/A';
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch (err) {
      return isoString;
    }
  };

  const columns = [
    {
      header: 'Timestamp',
      key: 'created_at',
      render: (row) => (
        <span className="font-mono text-xs text-gray-500">{formatTimestamp(row.created_at)}</span>
      ),
    },
    {
      header: 'Action',
      key: 'action_name',
      render: (row) => (
        <span className="font-medium text-gray-800">{row.action_name}</span>
      ),
    },
    {
      header: 'User',
      key: 'full_name',
      render: (row) => (
        <span className="text-gray-600 font-medium">{row.full_name || 'System Auto'}</span>
      ),
    },
    {
      header: 'IP Address',
      key: 'ip_address',
      render: (row) => (
        <span className="font-mono text-xs text-gray-400">{row.ip_address || '-'}</span>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <AdminPageHeader
        title="System Audit Logs"
        description="Monitor system activities, safety audits, configuration modifications, and administrative operations."
      />

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8c764b]"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      ) : (
        <AdminDataTable
          columns={columns}
          data={logs}
          emptyMessage="No audit logs available."
        />
      )}
    </div>
  );
}
