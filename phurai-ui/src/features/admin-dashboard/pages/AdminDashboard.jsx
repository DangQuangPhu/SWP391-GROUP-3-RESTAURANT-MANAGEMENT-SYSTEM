import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AdminLayout from '../components/layout/AdminLayout';
import AuditLogTable from '../components/AuditLogTable';
import SettingsEditor from '../components/SettingsEditor';

export default function AdminDashboard({ currentUser, onSignOut }) {
  const role = currentUser?.role_id;

  // Strict guard: Must be role 5
  if (role !== 5) {
    return <Navigate to="/" replace />;
  }

  return (
    <AdminLayout onSignOut={onSignOut}>
      <Routes>
        <Route path="/" element={<Navigate to="logs" replace />} />
        <Route path="logs" element={<AuditLogTable />} />
        <Route path="settings" element={<SettingsEditor />} />
        <Route path="*" element={<Navigate to="logs" replace />} />
      </Routes>
    </AdminLayout>
  );
}
