import { useEffect, useState } from 'react';
import { apiGet, apiPut, apiPost } from '@/core/api/httpClient';
import AdminPageHeader from '@/features/admin-dashboard/components/AdminPageHeader';
import AdminDataTable from '@/features/admin-dashboard/components/AdminDataTable';
import RoleFormModal from '../components/RoleFormModal';
import { toast } from 'react-hot-toast';

export default function Roles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeModalRole, setActiveModalRole] = useState(null);

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
    let active = true;
    Promise.resolve().then(() => {
      if (active) fetchRoles();
    });
    // Listen for Refresh Data button in AdminLayout header
    const handleRefresh = () => {
      if (active) fetchRoles();
    };
    window.addEventListener("phurai_admin_refresh", handleRefresh);
    return () => {
      active = false;
      window.removeEventListener("phurai_admin_refresh", handleRefresh);
    };
  }, []);

  const handleEditRole = (row) => {
    setActiveModalRole(row);
  };

  const handleCreateRole = () => {
    setActiveModalRole({});
  };

  const handleSaveRole = async (formData) => {
    try {
      const isEdit = !!activeModalRole.role_id;
      let res;
      if (isEdit) {
        res = await apiPut(`/admin/roles/${activeModalRole.role_id}`, formData);
      } else {
        res = await apiPost('/admin/roles', formData);
      }

      if (res.success) {
        toast.success(res.message || (isEdit ? 'Role updated successfully' : 'Role created successfully'));
        setActiveModalRole(null);
        fetchRoles();
      } else {
        toast.error(res.message || 'Failed to save role');
      }
    } catch (err) {
      console.error('Error saving role:', err);
      toast.error(err.message || 'An error occurred while saving the role.');
    }
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
          onClick: handleCreateRole,
        }}
      />

      {error ? (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      ) : (
        <AdminDataTable
          columns={columns}
          data={roles}
          loading={loading}
          emptyMessage="No roles found."
        />
      )}

      {activeModalRole && (
        <RoleFormModal
          role={activeModalRole.role_id ? activeModalRole : null}
          onClose={() => setActiveModalRole(null)}
          onSave={handleSaveRole}
        />
      )}
    </div>
  );
}
