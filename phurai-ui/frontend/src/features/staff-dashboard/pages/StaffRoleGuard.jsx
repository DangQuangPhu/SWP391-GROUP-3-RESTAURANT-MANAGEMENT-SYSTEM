import { Navigate } from "react-router-dom";
import { canAccessStaffSegment, getDefaultStaffPath } from "../config/staffRoutes.js";
import { useStaffPortal } from "../context/StaffPortalContext.jsx";

function StaffRoleGuard({ segment, children }) {
  const { staffRole } = useStaffPortal();

  if (!canAccessStaffSegment(staffRole, segment)) {
    return <Navigate to={getDefaultStaffPath(staffRole)} replace />;
  }

  return children;
}

export default StaffRoleGuard;
