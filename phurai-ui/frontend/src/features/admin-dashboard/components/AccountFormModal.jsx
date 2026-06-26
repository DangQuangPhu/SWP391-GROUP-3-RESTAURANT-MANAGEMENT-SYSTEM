import { useState, useEffect } from 'react';
import { ROLE_OPTIONS } from '../data/adminMockData';
import './AccountFormModal.css';

const EMPTY_FORM = { fullName: '', email: '', phone: '', roleId: 2, isActive: true };

export default function AccountFormModal({ account, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const isEdit = !!account;

  useEffect(() => {
    setForm(
      account
        ? { fullName: account.fullName, email: account.email, phone: account.phone, roleId: account.roleId, isActive: account.isActive }
        : EMPTY_FORM
    );
  }, [account]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const isValid = form.fullName.trim() && form.email.trim() && form.phone.trim();

  return (
    <div className="afm-overlay">
      <div className="afm-modal">
        <p className="afm-title">{isEdit ? 'Edit account' : 'Create account'}</p>

        <div className="afm-field">
          <label>FULL NAME</label>
          <input type="text" value={form.fullName} onChange={(e) => update('fullName', e.target.value)} />
        </div>

        <div className="afm-row-2">
          <div className="afm-field">
            <label>EMAIL</label>
            <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
          </div>
          <div className="afm-field">
            <label>PHONE</label>
            <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
          </div>
        </div>

        <div className="afm-row-2">
          <div className="afm-field">
            <label>ROLE</label>
            <select value={form.roleId} onChange={(e) => update('roleId', Number(e.target.value))}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="afm-field">
            <label>STATUS</label>
            <select value={form.isActive ? '1' : '0'} onChange={(e) => update('isActive', e.target.value === '1')}>
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </select>
          </div>
        </div>

        {!isEdit && (
          <p className="afm-note">
            The initial password will be automatically generated and sent via email.
          </p>
        )}

        <div className="afm-actions">
          <button className="afm-btn-outline" onClick={onClose}>Cancel</button>
          <button
            className="afm-btn-primary"
            disabled={!isValid}
            onClick={() => onSave({ ...form, id: account?.id })}
          >
            {isEdit ? 'Save changes' : 'Create account'}
          </button>
        </div>
      </div>
    </div>
  );
}
