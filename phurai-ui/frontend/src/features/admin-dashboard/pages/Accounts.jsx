import React, { useEffect, useState } from 'react';
import { apiGet } from '@/core/api/httpClient';
import AdminPageHeader from '@/features/admin-dashboard/components/AdminPageHeader';
import AdminDataTable from '@/features/admin-dashboard/components/AdminDataTable';
import { Edit, Trash2, UserPlus } from 'lucide-react';

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
      render: (row) => {
        const role = row.role_name || 'Customer';
        let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
        
        if (role === 'Admin') badgeColor = 'bg-purple-100 text-purple-700 border-purple-200';
        else if (role === 'Manager') badgeColor = 'bg-blue-100 text-blue-700 border-blue-200';
        else if (role === 'Restaurant Staff' || role === 'Kitchen Staff') badgeColor = 'bg-amber-100 text-amber-700 border-amber-200';
        
        return (
          <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${badgeColor}`}>
            {role}
          </span>
        );
      },
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
            className="p-2 rounded-md hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition-colors"
            title="Edit User"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => alert(`Delete user: ${row.full_name}`)}
            className="p-2 rounded-md hover:bg-rose-50 text-gray-500 hover:text-rose-600 transition-colors"
            title="Delete User"
          >
            <Trash2 className="w-4 h-4" />
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
          label: (
            <span className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Create Account
            </span>
          ),
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
