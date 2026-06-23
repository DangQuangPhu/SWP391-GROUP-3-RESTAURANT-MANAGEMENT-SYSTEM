import React, { useEffect, useState } from 'react';
import { apiGet } from '@/core/api/httpClient';
import AdminPageHeader from '@/features/admin-dashboard/components/AdminPageHeader';
import AdminDataTable from '@/features/admin-dashboard/components/AdminDataTable';

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiGet('/admin/accounts');
      if (res.success && res.data) {
        setAccounts(res.data);
      } else {
        setError('Failed to load accounts data.');
      }
    } catch (err) {
      console.error('Error fetching accounts:', err);
      setError(err.message || 'An error occurred while fetching accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleCreateAccount = () => {
    alert('Create Account feature is coming soon!');
  };

  const columns = [
    {
      header: 'Name',
      key: 'full_name',
      render: (row) => (
        <span className="font-semibold text-gray-900">{row.full_name || 'N/A'}</span>
      ),
    },
    {
      header: 'Email',
      key: 'email',
      render: (row) => <span className="text-gray-600">{row.email}</span>,
    },
    {
      header: 'Role',
      key: 'role_name',
      render: (row) => (
        <span className="px-2.5 py-1 text-xs font-medium text-amber-800 bg-amber-50 rounded-full border border-amber-100">
          {row.role_name || 'Customer'}
        </span>
      ),
    },
    {
      header: 'Status',
      key: 'is_active',
      render: (row) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
            row.is_active
              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
              : 'bg-rose-50 text-rose-700 border-rose-100'
          }`}
        >
          {row.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      header: 'Actions',
      render: (row) => (
        <div className="flex gap-2">
          <button
            onClick={() => alert(`Edit user: ${row.full_name}`)}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
            title="Edit User"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => alert(`Delete user: ${row.full_name}`)}
            className="text-gray-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors"
            title="Delete User"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <AdminPageHeader
        title="Accounts"
        description="Manage restaurant user accounts, view active employees, and assign roles."
        primaryAction={{
          label: '+ Create Account',
          onClick: handleCreateAccount,
        }}
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
          data={accounts}
          emptyMessage="No user accounts found."
        />
      )}
    </div>
  );
}
