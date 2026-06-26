import React, { useEffect, useState } from 'react';
import { apiGet, apiPut } from '@/core/api/httpClient';
import AdminPageHeader from '@/features/admin-dashboard/components/AdminPageHeader';
import AdminDataTable from '@/features/admin-dashboard/components/AdminDataTable';
import { toast } from 'react-hot-toast';

export default function Roles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiGet('/admin/roles');
      if (res.success && res.data) {
        setRoles(res.data);
      } else {
        setError('Failed to load roles data.');
      }
    } catch (err) {
      console.error('Error fetching roles:', err);
      setError(err.message || 'An error occurred while fetching roles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleEditRole = (row) => {
    alert(`Edit Role feature coming soon. Role ID: ${row.role_id}`);
    // You can implement the modal logic and call apiPut('/admin/roles/' + row.role_id, {...})
  };

  const columns = [
    {
      header: 'Role ID',
      key: 'role_id',
      render: (row) => <span className="font-mono text-gray-500">#{row.role_id}</span>,
    },
    {
      header: 'Role Name',
      key: 'role_name',
      render: (row) => (
        <span className="font-semibold text-gray-900">{row.role_name}</span>
      ),
    },
    {
      header: 'Description',
      key: 'description',
      render: (row) => <span className="text-gray-600">{row.description || 'N/A'}</span>,
    },
    {
      header: 'Actions',
      render: (row) => (
        <button
          onClick={() => handleEditRole(row)}
          className="text-gray-400 hover:text-blue-600 p-1 rounded-lg hover:bg-blue-50 transition-colors"
          title="Edit Role"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <AdminPageHeader
        title="Roles & Permissions"
        description="Manage system access levels and role definitions."
        primaryAction={{
          label: '+ Create Role',
          onClick: () => alert('Create Role feature coming soon!'),
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
          data={roles}
          emptyMessage="No roles found."
        />
      )}
    </div>
  );
}
