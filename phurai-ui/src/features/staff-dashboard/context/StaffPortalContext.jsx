import { createContext, use } from "react";

export const StaffPortalContext = createContext(null);

export function useStaffPortal() {
  const value = use(StaffPortalContext);
  if (!value) {
    throw new Error("useStaffPortal must be used within StaffPortalContext.Provider");
  }
  return value;
}
