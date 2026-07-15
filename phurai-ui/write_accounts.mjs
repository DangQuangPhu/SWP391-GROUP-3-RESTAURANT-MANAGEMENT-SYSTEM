import fs from 'fs';

const target = '/Volumes/Kingston/Github/SWP391-GROUP-3-RESTAURANT-MANAGEMENT-SYSTEM/phurai-ui/frontend/src/features/admin-dashboard/pages/Accounts.jsx';
const content = `import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiGet, apiPut, apiPatch } from '@/core/api/httpClient';
import AdminPageHeader from '@/features/admin-dashboard/components/AdminPageHeader';
import AdminDataTable from '@/features/admin-dashboard/components/AdminDataTable';
import { Pagination } from '@/components/ui/Pagination';
import { Edit, UserPlus, Power, FileText, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fadeScaleVariants } from '@/components/ui/Skeleton';
import '../styles/AdminAccountsPage.css';

const LIMIT = 15;

export default function Accounts() {
  const [accounts,    setAccounts]    = useState([]);
  const [jobTitles,   setJobTitles]   = useState([]);
  const [roles,       setRoles]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [filterType,  setFilterType]  = useState('all'); // 'all' | 'with-acct' | 'without-acct'
  const [search,      setSearch]      = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [toastMsg,    setToastMsg]    = useState(null);
  const [updatingRow, setUpdatingRow] = useState(null);

  const toast = useCallback(({ type, message }) => {
    setToastMsg({ type, message });
    setTimeout(() => setToastMsg(null), 4000);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [acctsRes, jtRes, rolesRes] = await Promise.all([
        apiGet('/admin/accounts'),
        apiGet('/admin/job-titles'),
        apiGet('/admin/roles'),
      ]);

      if (acctsRes.success) setAccounts(acctsRes.data || []);
      if (jtRes.success)    setJobTitles(jtRes.data || []);
      if (rolesRes.success) setRoles(rolesRes.data || []);

      if (!acctsRes.success) setError('Failed to load accounts data.');
    } catch (err) {
      setError(err.message || 'An error occurred during data load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    window.addEventListener('phurai_admin_refresh', fetchData);
    return () => window.removeEventListener('phurai_admin_refresh', fetchData);
  }, [fetchData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, search]);

  const handleJobTitleChange = async (row, newJtId) => {
    const staffId = row.staff_id;
    if (!staffId) return;

    setUpdatingRow(\`jt-\${staffId}\`);
    try {
      const res = await apiPut(\`/admin/staff/\${staffId}/job-title\`, { job_title_id: Number(newJtId) });
      if (res.success) {
        toast({ type: 'success', message: \`Updated job title for \${row.full_name || 'Staff'}\` });
        const selectedJt = jobTitles.find(j => j.job_title_id === Number(newJtId));
        
        setAccounts(prev => prev.map(item => {
          if (item.staff_id === staffId) {
            return { 
              ...item, 
              job_title_id: Number(newJtId), 
              job_title: selectedJt?.title_name || item.job_title 
            };
          }
          return item;
        }));

        if (row.user_id && selectedJt?.default_role_id) {
          await apiPatch(\`/admin/users/\${row.user_id}/role\`, { role_id: selectedJt.default_role_id });
          fetchData();
        }
      } else {
        toast({ type: 'error', message: res.message || 'Failed to update job title.' });
      }
    } catch (err) {
      toast({ type: 'error', message: err.message || 'Connection error.' });
    } finally {
      setUpdatingRow(null);
    }
  };

  const handleToggleStatus = async (row) => {
    const uid = row.user_id;
    if (!uid) return;

    setUpdatingRow(\`status-\${uid}\`);
    const originalStatus = row.is_active;
    
    setAccounts(prev => prev.map(item => 
      item.user_id === uid ? { ...item, is_active: originalStatus ? 0 : 1 } : item
    ));

    try {
      const res = await apiPut(\`/admin/accounts/\${uid}/status\`);
      if (res.success) {
        toast({ 
          type: 'success', 
          message: \`\${row.full_name} is now \${res.is_active ? 'Active' : 'Inactive'}\` 
        });
      } else {
        setAccounts(prev => prev.map(item => 
          item.user_id === uid ? { ...item, is_active: originalStatus } : item
        ));
        toast({ type: 'error', message: res.message || 'Status update failed.' });
      }
    } catch (err) {
      setAccounts(prev => prev.map(item => 
        item.user_id === uid ? { ...item, is_active: originalStatus } : item
      ));
      toast({ type: 'error', message: err.message || 'Connection error.' });
    } finally {
      setUpdatingRow(null);
    }
  };

  const columns = [
    {
      header: 'NAME',
      key: 'full_name',
      render: (row) => (
        <div className="adm-name-card">
          <div className="adm-name-title">\${row.full_name || '—'}</div>
          {row.email && <div className="adm-name-email">\${row.email}</div>}
          {row.phone && <div className="adm-name-phone">\${row.phone}</div>}
        </div>
      )
    },
    {
      header: 'ROLE',
      key: 'job_title_id',
      render: (row) => (
        <div className="adm-select-wrapper">
          <select
            value={row.job_title_id || ''}
            disabled={updatingRow === \`jt-\${row.staff_id}\`}
            onChange={(e) => handleJobTitleChange(row, e.target.value)}
            className="adm-inline-select"
          >
            <option value="" disabled>Select Job Role</option>
            {jobTitles.map(jt => (
              <option key={jt.job_title_id} value={jt.job_title_id}>
                {jt.title_name}
              </option>
            ))}
          </select>
        </div>
      )
    },
    {
      header: 'ACCOUNT STATUS',
      key: 'is_active',
      render: (row) => {
        if (!row.user_id) {
          return (
            <span className="adm-status-badge adm-status-badge--no-account">
              <span className="adm-badge-dot"></span>
              No Account
            </span>
          );
        }

        const isActive = !!row.is_active;
        return (
          <button
            onClick={() => handleToggleStatus(row)}
            disabled={updatingRow === \`status-\${row.user_id}\`}
            className={\`adm-status-badge-btn \${isActive ? 'adm-status-badge-btn--active' : 'adm-status-badge-btn--inactive'}\`}
            title="Click to toggle account status"
          >
            <span className="adm-badge-dot"></span>
            {isActive ? 'Active' : 'Inactive'}
          </button>
        );
      }
    },
    {
      header: 'SHIFT & ONLINE',
      render: () => (
        <div className="adm-shift-col">
          <div className="adm-shift-status">
            <span className="adm-status-dot adm-status-dot--offline"></span>
            Offline
          </div>
          <div className="adm-shift-time">No Shift Today</div>
        </div>
      )
    },
    {
      header: 'ACTIONS',
      render: (row) => (
        <div className="adm-action-pills">
          <button
            onClick={() => alert(\`Edit profile details for \${row.full_name || 'Staff'}\`)}
            className="adm-pill-btn adm-pill-btn--edit"
          >
            Edit
          </button>
          <button
            onClick={() => alert(\`Performance reviews for \${row.full_name || 'Staff'}\`)}
            className="adm-pill-btn adm-pill-btn--review"
          >
            Review
          </button>
          <button
            onClick={() => alert(\`Delete registry entry for \${row.full_name || 'Staff'}\`)}
            className="adm-pill-btn adm-pill-btn--delete"
          >
            Delete
          </button>
        </div>
      )
    }
  ];

  const filteredData = accounts.filter(item => {
    if (filterType === 'with-acct' && !item.user_id) return false;
    if (filterType === 'without-acct' && item.user_id) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName  = item.full_name?.toLowerCase().includes(q);
      const matchEmail = item.email?.toLowerCase().includes(q);
      const matchPhone = item.phone?.includes(q);
      const matchTitle = item.job_title?.toLowerCase().includes(q);
      return matchName || matchEmail || matchPhone || matchTitle;
    }
    return true;
  });

  const totalCount = filteredData.length;
  const totalPages = Math.ceil(totalCount / LIMIT);
  const pagedData  = filteredData.slice((currentPage - 1) * LIMIT, currentPage * LIMIT);

  return (
    <motion.div
      className="adm-page"
      variants={fadeScaleVariants}
      initial="hidden"
      animate="visible"
    >
      <AnimatePresence>
        {toastMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className={\`adm-toast \${toastMsg.type === 'error' ? 'adm-toast--error' : 'adm-toast--success'}\`}
          >
            {toastMsg.message}
          </motion.div>
        )}
      </AnimatePresence>

      <AdminPageHeader
        title="Staff Registry"
        description="Active employees and roles"
      />

      <div className="adm-filter-bar">
        <div className="adm-filter-pills">
          <button
            onClick={() => setFilterType('all')}
            className={\`adm-filter-pill \${filterType === 'all' ? 'adm-filter-pill--active' : ''}\`}
          >
            All
          </button>
          <button
            onClick={() => setFilterType('with-acct')}
            className={\`adm-filter-pill \${filterType === 'with-acct' ? 'adm-filter-pill--active' : ''}\`}
          >
            With Account
          </button>
          <button
            onClick={() => setFilterType('without-acct')}
            className={\`adm-filter-pill \${filterType === 'without-acct' ? 'adm-filter-pill--active' : ''}\`}
          >
            Without Account
          </button>
        </div>

        <div className="adm-search-wrapper">
          <input
            type="text"
            placeholder="Search name, email, title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="adm-search-input"
          />
        </div>
      </div>

      {error ? (
        <div className="adm-error-banner">{error}</div>
      ) : (
        <div className="adm-table-section">
          <AdminDataTable
            columns={columns}
            data={pagedData}
            loading={loading}
            emptyMessage="No staff registry entries found."
          />
          {!loading && totalCount > LIMIT && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              onPageChange={setCurrentPage}
              limit={LIMIT}
            />
          )}
        </div>
      )}
    </motion.div>
  );
}
`;

fs.writeFileSync(target, content, 'utf8');
console.log('Accounts.jsx successfully written!');
