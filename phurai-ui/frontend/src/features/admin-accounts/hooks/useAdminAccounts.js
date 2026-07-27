import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchAccounts,
  fetchJobTitles,
  fetchRoles,
  toggleUserStatus,
  updateStaffJobTitle,
  deactivateStaff,
} from '../services/adminAccountsApi';

export function useAdminAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [jobTitles, setJobTitles] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('staff');
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [toastMsg, setToastMsg] = useState(null);
  const [updatingRow, setUpdatingRow] = useState(null);
  const [reviewModalCustomerId, setReviewModalCustomerId] = useState(null);
  const [deactivateModalRow, setDeactivateModalRow] = useState(null);
  const [deactivating, setDeactivating] = useState(false);

  const toast = useCallback(({ type, message }) => {
    setToastMsg({ type, message });
    setTimeout(() => setToastMsg(null), 4000);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [acctsRes, jtRes, rolesRes] = await Promise.all([
        fetchAccounts(),
        fetchJobTitles(),
        fetchRoles(),
      ]);

      if (acctsRes?.success) setAccounts(acctsRes.data || []);
      if (jtRes?.success) setJobTitles(jtRes.data || []);
      if (rolesRes?.success) setRoles(rolesRes.data || []);

      if (!acctsRes?.success) setError('Failed to load accounts data.');
    } catch (err) {
      setError(err.message || 'An error occurred while loading data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    window.addEventListener('phurai_admin_refresh', loadData);
    return () => window.removeEventListener('phurai_admin_refresh', loadData);
  }, [loadData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, search, activeTab]);

  const handleJobTitleChange = async (row, newJtId) => {
    const staffId = row.staff_id;
    if (!staffId) return;

    setUpdatingRow(`jt-${staffId}`);
    try {
      const res = await updateStaffJobTitle(staffId, newJtId);
      if (res?.success) {
        toast({ type: 'success', message: `Updated job title for ${row.full_name || 'Staff'}` });
        const selectedJt = jobTitles.find((j) => j.job_title_id === Number(newJtId));

        setAccounts((prev) =>
          prev.map((item) => {
            if (item.staff_id === staffId) {
              return {
                ...item,
                job_title_id: Number(newJtId),
                job_title: selectedJt?.title_name || item.job_title,
              };
            }
            return item;
          })
        );
      } else {
        toast({ type: 'error', message: res?.message || 'Failed to update job title.' });
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

    setAccounts((prev) =>
      prev.map((item) => (item.user_id === uid ? { ...item, is_active: originalStatus ? 0 : 1 } : item))
    );

    try {
      const res = await toggleUserStatus(uid);
      if (res?.success) {
        toast({
          type: 'success',
          message: `${row.full_name || 'User'} is now ${res.is_active ? 'Active' : 'Inactive'}`,
        });
      } else {
        setAccounts((prev) =>
          prev.map((item) => (item.user_id === uid ? { ...item, is_active: originalStatus } : item))
        );
        toast({ type: 'error', message: res?.message || 'Status update failed.' });
      }
    } catch (err) {
      setAccounts((prev) =>
        prev.map((item) => (item.user_id === uid ? { ...item, is_active: originalStatus } : item))
      );
      toast({ type: 'error', message: err.message || 'Connection error.' });
    } finally {
      setUpdatingRow(null);
    }
  };

  const confirmDeactivateStaff = async (row) => {
    const staffId = row?.staff_id;
    if (!staffId) return;

    setDeactivating(true);
    try {
      const res = await deactivateStaff(staffId);
      if (res?.success) {
        toast({
          type: 'success',
          message: `Deactivated staff member ${row.full_name || 'Staff'}.`,
        });
        setAccounts((prev) =>
          prev.map((item) =>
            item.staff_id === staffId
              ? { ...item, is_active: 0, employment_status: 'Resigned' }
              : item
          )
        );
        setDeactivateModalRow(null);
        await loadData();
      } else {
        toast({ type: 'error', message: res?.message || 'Failed to deactivate staff.' });
      }
    } catch (err) {
      toast({ type: 'error', message: err.message || 'Error deactivating staff.' });
    } finally {
      setDeactivating(false);
    }
  };

  const filteredData = useMemo(() => {
    return accounts.filter((item) => {
      if (activeTab === 'staff' && item.account_type !== 'staff') return false;
      if (activeTab === 'customer' && item.account_type !== 'customer') return false;

      if (filterType === 'with' && !item.user_id) return false;
      if (filterType === 'without' && item.user_id) return false;
      if (filterType === 'active' && !item.is_active) return false;
      if (filterType === 'inactive' && item.is_active) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = item.full_name?.toLowerCase().includes(q);
        const matchEmail = item.email?.toLowerCase().includes(q);
        const matchPhone = item.phone?.includes(q);
        const matchTitle = item.job_title?.toLowerCase().includes(q);
        return matchName || matchEmail || matchPhone || matchTitle;
      }
      return true;
    });
  }, [accounts, activeTab, filterType, search]);

  return {
    accounts,
    jobTitles,
    roles,
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
    handleJobTitleChange,
    handleToggleStatus,
    filteredData,
    loadData,
  };
}
