import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import StaffLayout from "../components/StaffLayout.jsx";
import StaffReservationTab from "../components/StaffReservationTab.jsx";
import StaffTableTab from "../components/StaffTableTab.jsx";
import StaffOrderTab from "../components/StaffOrderTab.jsx";
import StaffPaymentTab from "../components/StaffPaymentTab.jsx";
import StaffKdsTab from "../components/StaffKdsTab.jsx";
import { useStaffStore } from "../store/staffStore.js";
import { resolveStaffRole } from "../config/staffRoutes.js";
import { resolveActiveNavItem, VIEW_SUBTITLE } from "../config/staffNav.js";
import toast from "react-hot-toast";

function StaffDashboard({ authReady, isAuthenticated, currentUser, onSignOut }) {
  const role = resolveStaffRole(currentUser);
  const location = useLocation();

  const activeNavItem = resolveActiveNavItem(location.pathname);
  const title = activeNavItem ? activeNavItem.label : "Dashboard";
  const subtitle = activeNavItem ? VIEW_SUBTITLE[activeNavItem.id] : "";

  const bootstrap = useStaffStore((s) => s.bootstrap);
  const initSocket = useStaffStore((s) => s.initSocket);
  const disconnectSocket = useStaffStore((s) => s.disconnectSocket);
  const refreshing = useStaffStore((s) => s.refreshing);
  const refreshAll = useStaffStore((s) => s.refreshAll);
  const tables = useStaffStore((s) => s.tables);
  const setTables = useStaffStore((s) => s.setTables);
  const orderTables = useStaffStore((s) => s.orderTables);
  const setOrderTables = useStaffStore((s) => s.setOrderTables);
  const dataSource = useStaffStore((s) => s.dataSource);

  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (role) {
      bootstrap(role);
      initSocket();
    }
    return () => disconnectSocket();
  }, [role, bootstrap, initSocket, disconnectSocket]);

  if (!authReady) return null;
  if (!isAuthenticated || !role) return <Navigate to="/login" replace />;

  // role_id=3 (Kitchen Staff) deprecated — KDS devices use /kds directly via device-JWT.
  // Restaurant Staff (role_id=2) may access /staff/kds as the user-JWT Staff KDS view.

  const defaultRoute = "reservations";

  return (
    <StaffLayout
      role={role}
      user={currentUser}
      title={title}
      subtitle={subtitle}
      search={searchQuery}
      onSearch={setSearchQuery}
      onRefresh={() => refreshAll(true)}
      refreshing={refreshing}
      refreshLabel="Refresh Data"

      onSignOut={onSignOut}
    >
      <Routes>
        <Route path="/" element={<Navigate to={defaultRoute} replace />} />
        <Route path="reservations" element={<StaffReservationTab search={searchQuery} tables={tables} user={currentUser} toast={toast} dataSource={dataSource} refreshing={refreshing} onRefresh={() => refreshAll(true)} />} />
        <Route path="tables" element={<StaffTableTab search={searchQuery} tables={tables} setTables={setTables} user={currentUser} toast={toast} dataSource={dataSource} refreshing={refreshing} onRefresh={() => refreshAll(true)} />} />
        <Route path="orders" element={<StaffOrderTab search={searchQuery} orderTables={orderTables} setOrderTables={setOrderTables} user={currentUser} toast={toast} dataSource={dataSource} refreshing={refreshing} onRefresh={() => refreshAll(true)} />} />
        <Route path="payments" element={<StaffPaymentTab search={searchQuery} tables={tables} setTables={setTables} orderTables={orderTables} setOrderTables={setOrderTables} user={currentUser} toast={toast} dataSource={dataSource} refreshing={refreshing} onRefresh={() => refreshAll(true)} />} />
        <Route path="kds" element={<StaffKdsTab user={currentUser} toast={toast} refreshing={refreshing} onRefresh={() => refreshAll(true)} />} />
        <Route path="*" element={<Navigate to={defaultRoute} replace />} />
      </Routes>
    </StaffLayout>
  );
}

export default StaffDashboard;
