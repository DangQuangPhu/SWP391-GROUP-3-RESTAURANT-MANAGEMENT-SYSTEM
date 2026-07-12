import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Strict RBAC Route Guard
 * Enforces domain access based on the exact decoded database role_name.
 */
export default function RequireRole({ allowedRoles }) {
  const { authReady, isAuthenticated, currentUser } = useAuth();

  // Wait for auth initialization
  if (!authReady) {
    return null;
  }

  // Not logged in -> kick out to home
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const userRole = currentUser?.roleName || currentUser?.role_name;

  // Strict Authorization Check
  if (allowedRoles && !allowedRoles.includes(userRole)) {
    // Unauthorized access: redirect to their authorized domain root
    if (userRole === 'Admin') return <Navigate to="/admin" replace />;
    if (userRole === 'Manager') return <Navigate to="/manager" replace />;
    if (userRole === 'Restaurant Staff') return <Navigate to="/staff" replace />;
    // Kitchen Staff (role_id=3) deprecated — KDS is device-based, no user redirect

    
    // Fallback for missing/unknown roles
    return <Navigate to="/" replace />;
  }

  // Authorized
  return <Outlet />;
}
