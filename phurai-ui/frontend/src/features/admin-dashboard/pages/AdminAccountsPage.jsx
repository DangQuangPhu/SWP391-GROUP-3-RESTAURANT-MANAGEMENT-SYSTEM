import { useState, useMemo } from 'react';
import { MOCK_ACCOUNTS, ROLE_OPTIONS, getRoleLabel } from '../data/adminMockData';
import AccountFormModal from '../components/AccountFormModal';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import '../styles/AdminAccountsPage.css';

let nextId = MOCK_ACCOUNTS.length + 1;

export default function AdminAccountsPage() {
  const [accounts, setAccounts] = useState(MOCK_ACCOUNTS);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editingAccount, setEditingAccount] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(null);

  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      const matchesSearch =
        !search ||
        a.fullName.toLowerCase().includes(search.toLowerCase()) ||
        a.email.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === 'all' || a.roleId === Number(roleFilter);
      return matchesSearch && matchesRole;
    });
  }, [accounts, search, roleFilter]);

  const handleSave = (form) => {
    if (form.id) {
      // Update — TODO: call PATCH /api/admin/accounts/:id when connecting to backend
      setAccounts((prev) => prev.map((a) => (a.id === form.id ? { ...a, ...form } : a)));
    } else {
      // Create — TODO: call POST /api/admin/accounts when connecting to backend
      setAccounts((prev) => [
        ...prev,
        { ...form, id: nextId++, createdAt: new Date().toISOString() },
      ]);
    }
    setEditingAccount(null);
    setCreating(false);
  };

  const handleDelete = () => {
    // TODO: call DELETE /api/admin/accounts/:id when connecting to backend
    setAccounts((prev) => prev.filter((a) => a.id !== deletingAccount.id));
    setDeletingAccount(null);
  };

  return (
    <div>
      <div className="aap-toolbar">
        <div className="aap-filters">
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="aap-search"
          />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">All roles</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </div>
        <button className="aap-btn-primary" onClick={() => setCreating(true)}>
          <i className="ti ti-user-plus" aria-hidden="true" /> New account
        </button>
      </div>

      <div className="aap-panel">
        <table className="aap-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((account) => (
              <tr key={account.id}>
                <td className="aap-name-cell">{account.fullName}</td>
                <td>{account.email}</td>
                <td>{account.phone}</td>
                <td>
                  <span className="aap-role-badge">{getRoleLabel(account.roleId)}</span>
                </td>
                <td>
                  <span className={`aap-status-badge ${account.isActive ? 'aap-status-active' : 'aap-status-inactive'}`}>
                    {account.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="aap-date-cell">{new Date(account.createdAt).toLocaleDateString('en-GB')}</td>
                <td className="aap-actions-cell">
                  <button className="aap-icon-btn" onClick={() => setEditingAccount(account)} aria-label="Edit">
                    <i className="ti ti-edit" aria-hidden="true" />
                  </button>
                  <button className="aap-icon-btn" onClick={() => setDeletingAccount(account)} aria-label="Delete">
                    <i className="ti ti-trash" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="aap-empty">No accounts match your filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(creating || editingAccount) && (
        <AccountFormModal
          account={editingAccount}
          onClose={() => { setCreating(false); setEditingAccount(null); }}
          onSave={handleSave}
        />
      )}

      {deletingAccount && (
        <ConfirmDeleteModal
          accountName={deletingAccount.fullName}
          onCancel={() => setDeletingAccount(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
