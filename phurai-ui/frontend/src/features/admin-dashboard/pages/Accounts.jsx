import React, { useEffect, useState } from 'react';
import { apiGet } from '@/core/api/httpClient';
import AdminPageHeader from '@/features/admin-dashboard/components/AdminPageHeader';
import AdminDataTable from '@/features/admin-dashboard/components/AdminDataTable';
import KdsDeviceManager from '@/features/admin-dashboard/components/KdsDeviceManager';
import { Pagination } from '@/components/ui/Pagination';
import { Edit, Trash2, UserPlus, Monitor } from 'lucide-react';

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('staff'); // 'staff' | 'customers' | 'kds'
  const [currentPage, setCurrentPage] = useState(1);
  const [toastMsg, setToastMsg] = useState(null);

  const limit = 20;

  const toast = ({ type, message }) => {
    setToastMsg({ type, message });
    setTimeout(() => setToastMsg(null), 4000);
  };

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
    // Listen for Refresh Data button in AdminLayout header
    window.addEventListener("phurai_admin_refresh", fetchAccounts);
    return () => window.removeEventListener("phurai_admin_refresh", fetchAccounts);
  }, []);

  // Reset page when switching tabs
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);


  const handleCreateAccount = () => {
    alert(`Create ${activeTab === 'staff' ? 'Staff' : 'Customer'} Account feature is coming soon!`);
  };

  const staffColumns = [
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
      header: 'Job Title',
      key: 'job_title',
      render: (row) => {
        const title = row.job_title || row.role_name || 'Staff';
        let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
        
        if (row.role_name === 'Admin') badgeColor = 'bg-purple-100 text-purple-700 border-purple-200';
        else if (row.role_name === 'Manager') badgeColor = 'bg-blue-100 text-blue-700 border-blue-200';
        else if (row.role_name === 'Restaurant Staff') badgeColor = 'bg-amber-100 text-amber-700 border-amber-200';

        return (
          <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${badgeColor}`}>
            {title}
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

  const customerColumns = [
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
      header: 'Phone',
      key: 'phone',
      render: (row) => <span className="text-gray-600">{row.phone || '—'}</span>,
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

  const staffData = accounts.filter(a => a.role_name !== 'Customer');
  const staffTotalCount = staffData.length;
  const staffTotalPages = Math.ceil(staffTotalCount / limit);
  const paginatedStaffData = staffData.slice((currentPage - 1) * limit, currentPage * limit);

  const customerData = accounts.filter(a => a.role_name === 'Customer');
  const customerTotalCount = customerData.length;
  const customerTotalPages = Math.ceil(customerTotalCount / limit);
  const paginatedCustomerData = customerData.slice((currentPage - 1) * limit, currentPage * limit);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 99999,
          padding: '12px 20px', borderRadius: '10px', fontWeight: '500', fontSize: '14px',
          background: toastMsg.type === 'error' ? '#e05252' : '#4caf7d', color: '#fff',
          boxShadow: '0 4px 20px rgba(0,0,0,.4)'
        }}>
          {toastMsg.message}
        </div>
      )}

      <AdminPageHeader
        title="Accounts & Devices"
        description="Manage restaurant user accounts, assign roles, and configure KDS kitchen terminals."
        primaryAction={activeTab !== 'kds' ? {
          label: (
            <span className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Create {activeTab === 'staff' ? 'Staff' : 'Customer'} Account
            </span>
          ),
          onClick: handleCreateAccount,
        } : undefined}
      />

      {/* Tab selector */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
        {[
          { id: 'staff', label: 'Staff Accounts' },
          { id: 'customers', label: 'Customer Accounts' },
          { id: 'kds', label: 'KDS Devices' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 20px', borderRadius: '24px', border: 'none', cursor: 'pointer',
              fontWeight: activeTab === tab.id ? '600' : '400',
              background: activeTab === tab.id ? '#c8a96e' : '#2a2a2a',
              color: '#fff', fontSize: '14px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'staff' && (
        error ? (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-red-700 text-sm">{error}</div>
        ) : (
          <div className="space-y-4">
            <AdminDataTable
              columns={staffColumns}
              data={paginatedStaffData}
              loading={loading}
              emptyMessage="No staff accounts found."
            />
            {!loading && staffTotalCount > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={staffTotalPages}
                totalCount={staffTotalCount}
                onPageChange={setCurrentPage}
                limit={limit}
              />
            )}
          </div>
        )
      )}

      {activeTab === 'customers' && (
        error ? (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-red-700 text-sm">{error}</div>
        ) : (
          <div className="space-y-4">
            <AdminDataTable
              columns={customerColumns}
              data={paginatedCustomerData}
              loading={loading}
              emptyMessage="No customer accounts found."
            />
            {!loading && customerTotalCount > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={customerTotalPages}
                totalCount={customerTotalCount}
                onPageChange={setCurrentPage}
                limit={limit}
              />
            )}
          </div>
        )
      )}

      {activeTab === 'kds' && (
        <KdsDeviceManager toast={toast} />
      )}
    </div>
  );
}
