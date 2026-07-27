import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pagination } from '@/components/ui/Pagination';
import { Users, UserCheck, UserX, Star, Clock, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { fadeScaleVariants, listContainerVariants, listItemVariants } from '@/components/ui/Skeleton';
import '@/features/admin-dashboard/styles/AdminAccountsPage.css';
import '@/features/manager-dashboard/styles/manager-dashboard.css';
import StaffSection from '@/features/manager-dashboard/components/sections/StaffSection';
import { ManagerPortalContext } from '@/features/manager-dashboard/context/ManagerPortalContext';
import { useAuth } from '@/features/auth/context/AuthContext';
import ReviewCustomerModal from '@/features/admin-dashboard/components/ReviewCustomerModal';
import AdminDataTable from '@/features/admin-dashboard/components/AdminDataTable';
import AccountsSectionHeader from '../components/AccountsSectionHeader';
import StatusFilterDropdown from '../components/StatusFilterDropdown';
import AccountActionButtons from '../components/AccountActionButtons';
import { SearchField } from '@/features/manager-dashboard/components/ManagerUI';
import { useAdminAccounts } from '../hooks/useAdminAccounts';

const LIMIT = 10;

const STAFF_STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'with', label: 'With Account' },
  { value: 'without', label: 'Without Account' },
];

const CUSTOMER_STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active Only' },
  { value: 'inactive', label: 'Suspended Only' },
];

export default function AccountsPage() {
  const { currentUser } = useAuth();
  const {
    accounts,
    jobTitles,
    loading,
    error,
    activeTab,
    setActiveTab,
    filterType,
    setFilterType,
    search,
    setSearch,
    currentPage,
    setCurrentPage,
    toastMsg,
    toast,
    updatingRow,
    reviewModalCustomerId,
    setReviewModalCustomerId,
    deactivateModalRow,
    setDeactivateModalRow,
    deactivating,
    confirmDeactivateStaff,
    handleToggleStatus,
    filteredData,
    loadData,
  } = useAdminAccounts();

  const customerKpis = React.useMemo(() => {
    const custs = accounts.filter((a) => a.account_type === 'customer');
    return [
      { label: 'Total Customers', value: custs.length, color: 'blue', icon: Users },
      { label: 'Active Accounts', value: custs.filter((a) => a.is_active).length, color: 'green', icon: UserCheck },
      { label: 'Suspended', value: custs.filter((a) => !a.is_active).length, color: 'amber', icon: UserX },
      {
        label: 'New This Month',
        value: custs.filter((a) => new Date(a.created_at) > new Date(new Date().setDate(1))).length,
        color: 'purple',
        icon: Star,
      },
    ];
  }, [accounts]);

  const customerColumns = [
    {
      header: '#',
      render: (_, index) => (
        <div style={{ textAlign: 'center', fontWeight: '600', color: 'var(--text-muted, #777)', fontSize: '13px' }}>
          {(currentPage - 1) * LIMIT + index + 1}
        </div>
      ),
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
      ),
    },
    {
      header: 'REGISTERED ON',
      key: 'created_at',
      render: (row) => (
        <div className="adm-text-sub">
          {row.created_at ? format(new Date(row.created_at), 'dd MMM yyyy') : 'N/A'}
        </div>
      ),
    },
    {
      header: 'LAST LOGIN',
      key: 'last_login_at',
      render: (row) => (
        <div className="adm-text-sub">
          {row.last_login_at ? format(new Date(row.last_login_at), 'dd MMM yyyy, HH:mm') : 'Never'}
        </div>
      ),
    },
    {
      header: 'ACCOUNT STATUS',
      key: 'is_active',
      render: (row) => {
        const isActive = !!row.is_active;
        return (
          <button
            type="button"
            onClick={() => handleToggleStatus(row)}
            disabled={updatingRow === `status-${row.user_id}`}
            className={`adm-status-badge-btn ${isActive ? 'adm-status-badge-btn--active' : 'adm-status-badge-btn--inactive'}`}
            title="Click to toggle account status"
          >
            <span className="adm-badge-dot"></span>
            {isActive ? 'Active' : 'Suspended'}
          </button>
        );
      },
    },
    {
      header: 'ACTIONS',
      render: (row) => (
        <AccountActionButtons
          row={row}
          accountType="customer"
          onReview={(r) => setReviewModalCustomerId(r.user_id)}
          onDeactivate={(r) => handleToggleStatus(r)}
          updating={updatingRow === `status-${row.user_id}`}
        />
      ),
    },
  ];

  const totalCount = filteredData.length;
  const totalPages = Math.ceil(totalCount / LIMIT);
  const pagedData = filteredData.slice((currentPage - 1) * LIMIT, currentPage * LIMIT);

  const statusOptions = activeTab === 'staff' ? STAFF_STATUS_OPTIONS : CUSTOMER_STATUS_OPTIONS;

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
          type="button"
          className={`adm-accounts-tab ${activeTab === 'staff' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('staff');
            setFilterType('all');
          }}
        >
          Staff Registry
        </button>
        <button
          type="button"
          className={`adm-accounts-tab ${activeTab === 'customer' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('customer');
            setFilterType('all');
          }}
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

          <div className="sfx-card sfx-card--overflow-visible sfx-card--featured-dashboard">

            <div className="sfx-staff__toolbar">
              <div className="sfx-staff__search-wrapper">
                <SearchField
                  placeholder="Search name, email, phone..."
                  value={search}
                  onChange={setSearch}
                />
              </div>
              <div className="sfx-staff__actions">
                <StatusFilterDropdown
                  options={CUSTOMER_STATUS_OPTIONS}
                  value={filterType}
                  onChange={(val) => setFilterType(val)}
                />
              </div>
            </div>

            {error ? (
              <div className="adm-error-banner">{error}</div>
            ) : loading ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>Loading customers…</div>
            ) : pagedData.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>No customer accounts found.</div>
            ) : (
              <div className="sfx-table-wrap">
                <table className="sfx-table sfx-table--hover sfx-staff__table-bg">
                  <thead>
                    <tr className="sfx-staff__tr-head-bg">
                      <th className="sfx-staff__th sfx-staff__th--index">#</th>
                      <th className="sfx-staff__th">NAME / CONTACT</th>
                      <th className="sfx-staff__th">REGISTERED ON</th>
                      <th className="sfx-staff__th">ACCOUNT STATUS</th>
                      <th className="sfx-staff__th">ONLINE STATUS</th>
                      <th className="sfx-staff__th sfx-staff__th--right">ACTIONS</th>
                    </tr>
                  </thead>
                  <motion.tbody variants={listContainerVariants} initial="hidden" animate="visible">
                    {pagedData.map((row, index) => {
                      const isActive = !!row.is_active;
                      return (
                        <motion.tr
                          key={row.user_id || index}
                          variants={listItemVariants}
                          className="sfx-staff__tr"
                        >
                          <td className="sfx-staff__td--index">
                            {(currentPage - 1) * LIMIT + index + 1}
                          </td>
                          <td className="sfx-staff__td--main">
                            <div className="sfx-staff__emp-name">{row.full_name || '—'}</div>
                            {row.email && <div className="sfx-staff__emp-email">{row.email}</div>}
                            {row.phone && <div className="sfx-staff__emp-phone">{row.phone}</div>}
                          </td>
                          <td className="sfx-staff__td">
                            <div style={{ color: 'var(--text-main, #333)', fontSize: '13px', fontWeight: 500 }}>
                              {row.created_at ? format(new Date(row.created_at), 'dd MMM yyyy') : 'N/A'}
                            </div>
                          </td>
                          <td className="sfx-staff__td">
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(row)}
                              disabled={updatingRow === `status-${row.user_id}`}
                              className={`sfx-staff__account-btn ${isActive ? "sfx-staff__account-btn--active" : "sfx-staff__account-btn--suspended"}`}
                              style={{ cursor: 'pointer' }}
                              title="Click to toggle account status"
                            >
                              <span className={`sfx-staff__account-dot ${isActive ? "sfx-staff__account-dot--active" : "sfx-staff__account-dot--suspended"}`} />
                              {isActive ? 'Active' : 'Suspended'}
                            </button>
                          </td>
                          <td className="sfx-staff__td">
                            <div className="sfx-staff__online-status-container">
                              <span className={`sfx-staff__online-indicator ${row.is_online ? "sfx-staff__online-indicator--active" : "sfx-staff__online-indicator--inactive"}`} />
                              <span className={`sfx-staff__online-text ${row.is_online ? "sfx-staff__online-text--active" : "sfx-staff__online-text--inactive"}`}>
                                {row.is_online ? "Online" : "Offline"}
                              </span>
                            </div>
                          </td>
                          <td className="sfx-staff__td">
                            <AccountActionButtons
                              row={row}
                              accountType="customer"
                              onReview={(r) => setReviewModalCustomerId(r.user_id)}
                              onDeactivate={(r) => handleToggleStatus(r)}
                              updating={updatingRow === `status-${row.user_id}`}
                            />
                          </td>
                        </motion.tr>
                      );
                    })}
                  </motion.tbody>
                </table>
                {!loading && totalCount > LIMIT && (
                  <div style={{ padding: '16px 20px' }}>
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalCount={totalCount}
                      onPageChange={setCurrentPage}
                      limit={LIMIT}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {reviewModalCustomerId && (
        <ReviewCustomerModal
          customerId={reviewModalCustomerId}
          onClose={() => setReviewModalCustomerId(null)}
          onRefresh={loadData}
        />
      )}

      {deactivateModalRow && (
        <div className="sfx-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="sfx-modal-content" style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '420px', width: '90%', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', color: '#111' }}>Confirm Deactivation</h3>
            <p style={{ color: '#555', fontSize: '14px', marginBottom: '24px', lineHeight: '1.5' }}>
              Are you sure you want to deactivate staff profile for <strong>{deactivateModalRow.full_name}</strong>? This action updates their status to inactive and logs an audit record.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setDeactivateModalRow(null)}
                disabled={deactivating}
                className="adm-pill-btn adm-pill-btn--edit"
                style={{ padding: '8px 16px', borderRadius: '8px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmDeactivateStaff(deactivateModalRow)}
                disabled={deactivating}
                className="adm-pill-btn adm-pill-btn--delete"
                style={{ padding: '8px 16px', borderRadius: '8px', background: '#ef4444', color: '#fff' }}
              >
                {deactivating ? 'Deactivating...' : 'Delete Staff'}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
