import { createContext, use } from "react";

export const ManagerPortalContext = createContext(null);

export function useManagerPortal() {
  const value = use(ManagerPortalContext);
  if (!value) {
    throw new Error("useManagerPortal must be used within ManagerPortalContext.Provider");
  }
  return value;
}
