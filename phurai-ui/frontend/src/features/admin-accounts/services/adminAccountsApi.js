import { apiGet, apiPut, request } from '@/core/api/httpClient';

export async function fetchAccounts() {
  return await apiGet('/admin/accounts');
}

export async function fetchJobTitles() {
  return await apiGet('/admin/job-titles');
}

export async function fetchRoles() {
  return await apiGet('/admin/roles');
}

export async function toggleUserStatus(userId) {
  return await apiPut(`/admin/accounts/${userId}/status`);
}

export async function updateStaffJobTitle(staffId, jobTitleId) {
  return await apiPut(`/admin/staff/${staffId}/job-title`, { job_title_id: Number(jobTitleId) });
}

export async function deactivateStaff(staffId) {
  return await request(`/manager/employees/${staffId}/deactivate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}
