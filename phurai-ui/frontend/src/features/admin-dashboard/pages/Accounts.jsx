import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiGet, apiPut, apiPatch } from '@/core/api/httpClient';
import AdminPageHeader from '@/features/admin-dashboard/components/AdminPageHeader';
import AdminDataTable from '@/features/admin-dashboard/components/AdminDataTable';
import { Pagination } from '@/components/ui/Pagination';
import { Edit, UserPlus, Power, FileText, Trash2, Users, UserCheck, UserX, Star } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fadeScaleVariants } from '@/components/ui/Skeleton';
import '../styles/AdminAccountsPage.css';
import '../../manager-dashboard/styles/manager-dashboard.css';
import StaffSection from '../../manager-dashboard/components/sections/StaffSection';
import { ManagerPortalContext } from '../../manager-dashboard/context/ManagerPortalContext';
import { useAuth } from '@/features/auth/context/AuthContext';
import ReviewCustomerModal from '../components/ReviewCustomerModal';

const LIMIT = 10;

export default function Accounts() {
  const { currentUser } = useAuth();
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
  const [activeTab,   setActiveTab]   = useState('staff'); // 'staff' | 'customer'
  const [reviewModalCustomerId, setReviewModalCustomerId] = useState(null);

  const toast = useCallback(({ type, message }) => {
    setToastMsg({ type, message });
    setTimeout(() => setToastMsg(null), 4000);
  }, []);

  const customerKpis = React.useMemo(() => {
    const custs = accounts.filter(a => a.account_type === 'customer');
    return [
      { label: "Total Customers", value: custs.length, color: "blue", icon: Users },
      { label: "Active Accounts", value: custs.filter(a => a.is_active).length, color: "green", icon: UserCheck },
      { label: "Suspended", value: custs.filter(a => !a.is_active).length, color: "amber", icon: UserX },
      { label: "New This Month", value: custs.filter(a => new Date(a.created_at) > new Date(new Date().setDate(1))).length, color: "purple", icon: Star }
    ];
  }, [accounts]);

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
  }, [filterType, search, activeTab]);

  const handleJobTitleChange = async (row, newJtId) => {
    const staffId = row.staff_id;
    if (!staffId) return;

    setUpdatingRow(`jt-${staffId}`);
    try {
      const res = await apiPut(`/admin/staff/${staffId}/job-title`, { job_title_id: Number(newJtId) });
      if (res.success) {
        toast({ type: 'success', message: `Updated job title for ${row.full_name || 'Staff'}` });
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
          await apiPatch(`/admin/users/${row.user_id}/role`, { role_id: selectedJt.default_role_id });
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

    setUpdatingRow(`status-${uid}`);
    const originalStatus = row.is_active;
    
    setAccounts(prev => prev.map(item => 
      item.user_id === uid ? { ...item, is_active: originalStatus ? 0 : 1 } : item
    ));

    try {
      const res = await apiPut(`/admin/accounts/${uid}/status`);
      if (res.success) {
        toast({ 
          type: 'success', 
          message: `${row.full_name} is now ${res.is_active ? 'Active' : 'Inactive'}` 
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

  const staffColumns = [
    {
      header: 'NAME',
      key: 'full_name',
      render: (row) => (
        <div className="adm-name-card">
          <div className="adm-name-title">{row.full_name || '—'}</div>
          {row.email && <div className="adm-name-email">{row.email}</div>}
          {row.phone && <div className="adm-name-phone">{row.phone}</div>}
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
            disabled={updatingRow === `jt-${row.staff_id}`}
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
            disabled={updatingRow === `status-${row.user_id}`}
            className={`adm-status-badge-btn ${isActive ? 'adm-status-badge-btn--active' : 'adm-status-badge-btn--inactive'}`}
            title="Click to toggle account status"
          >
            <span className="adm-badge-dot"></span>
            {isActive ? 'Active' : 'Inactive'}
          </button>
        );
      }
    },
    {
      header: 'ONLINE STATUS',
      render: () => (
        <div className="adm-shift-col">
          <div className="adm-shift-status">
            <span className="adm-status-dot adm-status-dot--offline"></span>
            Offline
          </div>
        </div>
      )
    },
    {
      header: 'ACTIONS',
      render: (row) => (
        <div className="adm-action-pills">
          <button
            onClick={() => alert(`Edit profile details for ${row.full_name || 'Staff'}`)}
            className="adm-pill-btn adm-pill-btn--edit"
          >
            Edit
          </button>
          <button
            onClick={() => alert(`Performance reviews for ${row.full_name || 'Staff'}`)}
            className="adm-pill-btn adm-pill-btn--review"
          >
            Review
          </button>
          <button
            onClick={() => alert(`Delete registry entry for ${row.full_name || 'Staff'}`)}
            className="adm-pill-btn adm-pill-btn--delete"
          >
            Delete
          </button>
        </div>
      )
    }
  ];

  const customerColumns = [
    {
      header: '#',
      render: (_, index) => (
        <div style={{ textAlign: "center", fontWeight: "600", color: "var(--text-muted, #777)", fontSize: "13px" }}>
          {index + 1}
        </div>
      )
    },
    {
      header: 'NAME / CONTACT',
      key: 'full_name',
      render: (row) => (
        <div className="adm-name-card">
          <div className="adm-name-title">{row.full_name || '—'}</div>
          {row.email && <div className="adm-name-email">{row.email}</div>}
          {row.phone && <div className="adm-name-phone">{row.phone}</div>}
        </div>
      )
    },
    {
      header: 'REGISTERED ON',
      key: 'created_at',
      render: (row) => (
        <div className="adm-text-sub">
          {row.created_at ? format(new Date(row.created_at), 'dd MMM yyyy') : 'N/A'}
        </div>
      )
    },
    {
      header: 'LAST LOGIN',
      key: 'last_login_at',
      render: (row) => (
        <div className="adm-text-sub">
          {row.last_login_at ? format(new Date(row.last_login_at), 'dd MMM yyyy, HH:mm') : 'Never'}
        </div>
      )
    },
    {
      header: 'ACCOUNT STATUS',
      key: 'is_active',
      render: (row) => {
        const isActive = !!row.is_active;
        return (
          <button
            onClick={() => handleToggleStatus(row)}
            disabled={updatingRow === `status-${row.user_id}`}
            className={`adm-status-badge-btn ${isActive ? 'adm-status-badge-btn--active' : 'adm-status-badge-btn--inactive'}`}
            title="Click to toggle account status"
          >
            <span className="adm-badge-dot"></span>
            {isActive ? 'Active' : 'Suspended'}
          </button>
        );
      }
    },
    {
      header: 'ACTIONS',
      render: (row) => {
        const isActive = !!row.is_active;
        return (
          <div className="adm-action-pills">
            <button
              onClick={() => handleToggleStatus(row)}
              disabled={updatingRow === `status-${row.user_id}`}
              className={`adm-pill-btn ${isActive ? 'adm-pill-btn--delete' : 'adm-pill-btn--edit'}`}
              style={{ width: '80px', textAlign: 'center' }}
            >
              {updatingRow === `status-${row.user_id}` ? '...' : (isActive ? 'Deactivate' : 'Activate')}
            </button>
            <button
              onClick={() => setReviewModalCustomerId(row.user_id)}
              className="adm-pill-btn adm-pill-btn--review"
            >
              Review
            </button>
          </div>
        );
      }
    }
  ];

  const filteredData = accounts.filter(item => {
    // Filter by tab
    if (activeTab === 'staff' && item.account_type !== 'staff') return false;
    if (activeTab === 'customer' && item.account_type !== 'customer') return false;

    // Filter by with/without account (mostly for staff)
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
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={`adm-toast ${toastMsg.type === 'error' ? 'adm-toast--error' : 'adm-toast--success'}`}
          >
            {toastMsg.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="adm-accounts-tabs">
        <button
          className={`adm-accounts-tab ${activeTab === 'staff' ? 'active' : ''}`}
          onClick={() => setActiveTab('staff')}
        >
          Staff Registry
        </button>
        <button
          className={`adm-accounts-tab ${activeTab === 'customer' ? 'active' : ''}`}
          onClick={() => setActiveTab('customer')}
        >
          Customer Accounts
        </button>
      </div>

      {activeTab === 'staff' ? (
        <ManagerPortalContext.Provider value={{ currentUser }}>
          <StaffSection 
            toast={(msg, type) => toast({ type: type === 'error' ? 'error' : 'success', message: msg })} 
            hideHeader={true} 
          />
        </ManagerPortalContext.Provider>
      ) : (
        <>
          <div className="sfx-kpis mb-6" aria-label="Customer summary">
            {customerKpis.map((kpi, idx) => {
              const IconComponent = kpi.icon;
              return (
                <article key={idx} className={`sfx-kpi sfx-kpi--${kpi.color}`}>
                  <div className="sfx-kpi__top">
                    <span className="sfx-kpi__icon" aria-hidden="true">
                      <IconComponent size={18} />
                    </span>
                  </div>
                  <p className="sfx-kpi__value">{kpi.value}</p>
                  <p className="sfx-kpi__label">{kpi.label}</p>
                </article>
              );
            })}
          </div>

          <div className="adm-filter-bar">
            <div className="adm-filter-pills">
          <button
            onClick={() => setFilterType('all')}
            className={`adm-filter-pill ${filterType === 'all' ? 'adm-filter-pill--active' : ''}`}
          >
            All
          </button>
          {activeTab === 'staff' && (
            <>
              <button
                onClick={() => setFilterType('with-acct')}
                className={`adm-filter-pill ${filterType === 'with-acct' ? 'adm-filter-pill--active' : ''}`}
              >
                With Account
              </button>
              <button
                onClick={() => setFilterType('without-acct')}
                className={`adm-filter-pill ${filterType === 'without-acct' ? 'adm-filter-pill--active' : ''}`}
              >
                Without Account
              </button>
            </>
          )}
        </div>

        <div className="adm-search-wrapper">
          <input
            type="text"
            placeholder="Search name, email, phone..."
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
            columns={customerColumns}
            data={pagedData}
            loading={loading}
            emptyMessage="No customer accounts found."
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
        </>
      )}
      {reviewModalCustomerId && (
        <ReviewCustomerModal
          customerId={reviewModalCustomerId}
          onClose={() => setReviewModalCustomerId(null)}
          onRefresh={fetchData}
        />
      )}
    </motion.div>
  );
}

