import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  clearAuthUser,
  loadAuthUser,
  saveAuthUser,
} from "@/core/api";
import {
  mapApiUserToFrontend,
  AuthModal,
  AuthSuccessOverlay,
  blurActiveElement,
} from "@/features/auth";
import { getProfile } from "@/features/profile/services/profileApi";
import { normalizeStoredAvatarUrl } from "@/features/profile/utils/avatarUtils";
import { isStaffPortalUser } from "@/features/staff-dashboard";

export const AuthContext = createContext(null);

function normalizeAuthUser(user) {
  if (!user) return null;
  // If the object already has camelCase properties, do not remap it
  const mapped = (user.userId || user.fullName || user.email) ? user : mapApiUserToFrontend(user);
  return {
    ...mapped,
    avatarUrl: normalizeStoredAvatarUrl(mapped?.avatarUrl),
    id: mapped.id ?? mapped.userId,
    userId: mapped.userId ?? mapped.id,
  };
}

function isAdminUser(user) {
  if (!user) return false;
  const roleId = Number(user.roleId ?? user.role_id);
  if (roleId === 5) return true;
  const role = String(user.roleName ?? user.role_name ?? user.role ?? "").trim().toLowerCase();
  return role === "admin";
}

function isManagerUser(user) {
  if (!user) return false;
  const roleId = Number(user.roleId ?? user.role_id);
  if (roleId === 4) return true;
  const role = String(user.roleName ?? user.role_name ?? user.role ?? "").trim().toLowerCase();
  return role === "manager";
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  
  const [pendingAuthUser, setPendingAuthUser] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeFading, setWelcomeFading] = useState(false);
  
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState("login");
  const [loginSuccessMessage, setLoginSuccessMessage] = useState("");

  const navigateToPath = useCallback((path) => {
    const nextPath = path === "/settings" || path === "/settings/" ? "/settings/profile" : path;
    navigate(nextPath);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [navigate]);

  const openAuthModal = useCallback((mode = "login") => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    blurActiveElement();
    setIsAuthModalOpen(false);
  }, []);

  useEffect(() => {
    const stored = loadAuthUser();
    if (stored) {
      setIsAuthenticated(true);
      setCurrentUser(stored);

      const uid = stored.userId ?? stored.id;
      if (uid) {
        getProfile(uid)
          .then((data) => {
            if (!data?.user) return;
            const normalized = normalizeAuthUser(data.user);
            setCurrentUser(normalized);
            saveAuthUser(normalized, Boolean(localStorage.getItem("phurai_auth_user")));
          })
          .catch((err) => {
            if (err?.status === 404 || err?.status === 401) {
              console.warn("Ghost session detected, clearing auth data.");
              clearAuthUser();
              setIsAuthenticated(false);
              setCurrentUser(null);
            }
          });
      }
    }
    setAuthReady(true);
  }, []);

  useEffect(() => {
    if (!showWelcome) return undefined;

    const fadeTimer = setTimeout(() => setWelcomeFading(true), 2600);
    const closeTimer = setTimeout(() => {
      setShowWelcome(false);
      setWelcomeFading(false);
      blurActiveElement();
      setIsAuthModalOpen(false);
      if (pendingAuthUser) {
        setIsAuthenticated(true);
        setCurrentUser(pendingAuthUser);
        saveAuthUser(pendingAuthUser, Boolean(localStorage.getItem("phurai_auth_user")));
        if (isAdminUser(pendingAuthUser)) {
          navigateToPath("/admin");
        } else if (isManagerUser(pendingAuthUser)) {
          navigateToPath("/manager/dashboard");
        } else if (isStaffPortalUser(pendingAuthUser)) {
          navigateToPath("/staff");
        }
        setPendingAuthUser(null);
      }
    }, 3200);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(closeTimer);
    };
  }, [showWelcome, pendingAuthUser, navigateToPath]);

  const handleAuthSuccess = useCallback((user, options = {}) => {
    const normalized = normalizeAuthUser(user);

    if (options.showWelcome) {
      setPendingAuthUser(normalized);
      setShowWelcome(true);
      return;
    }

    setIsAuthenticated(true);
    setCurrentUser(normalized);
    saveAuthUser(normalized, options.remember);
    blurActiveElement();
    setIsAuthModalOpen(false);
    if (isManagerUser(normalized)) {
      navigateToPath("/manager/dashboard");
    } else if (isStaffPortalUser(normalized)) {
      navigateToPath("/staff");
    }
  }, [navigateToPath]);

  const handleSignOut = useCallback(() => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setPendingAuthUser(null);
    setShowWelcome(false);
    clearAuthUser();
    navigateToPath("/");
  }, [navigateToPath]);

  const handlePasswordReset = useCallback(({ message } = {}) => {
    clearAuthUser();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setLoginSuccessMessage(
      message || "Password reset successfully. Please sign in with your new password."
    );
    openAuthModal("login");
  }, [openAuthModal]);

  // Expose context value
  const value = useMemo(() => ({
    isAuthenticated,
    currentUser,
    authReady,
    setCurrentUser, // Allow manual updates (e.g. from profile edit)
    handleAuthSuccess,
    handleSignOut,
    handlePasswordReset,
    openAuthModal,
    closeAuthModal,
    isAdminUser: (user) => isAdminUser(user || currentUser),
    isManagerUser: (user) => isManagerUser(user || currentUser),
    navigateToPath
  }), [isAuthenticated, currentUser, authReady, handleAuthSuccess, handleSignOut, handlePasswordReset, openAuthModal, closeAuthModal, navigateToPath]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        isAuthenticated={isAuthenticated}
        onAuthSuccess={handleAuthSuccess}
        initialMode={authModalMode}
        successMessage={loginSuccessMessage}
        onClearSuccess={() => setLoginSuccessMessage("")}
      />
      <AuthSuccessOverlay
        isVisible={showWelcome}
        user={pendingAuthUser}
        fading={welcomeFading}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
