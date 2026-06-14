import { useCallback, useEffect, useMemo, useState } from "react";
import "@/features/home/styles/home.css";
import { HomePage as Home } from "@/features/home";
import {
  TakeOutPage as TakeOut,
  CateringPage as Catering,
  PrivateEventsPage as PrivateEvents,
  CareersPage as Careers,
  ContactHoursPage as ContactHours,
} from "@/features/content";
import { MenuPage as Menu } from "@/features/menu";
import {
  ReservationPage,
  MyReservationsPage,
} from "@/features/reservations";
import {
  ProfilePage,
  SettingsPage,
  useUserProfile,
  normalizeStoredAvatarUrl,
} from "@/features/profile";
import { ManagerDashboardPage as ManagerDashboard } from "@/features/manager-dashboard";
import { StaffDashboardPage as StaffDashboard, isStaffPortalUser } from "@/features/staff-dashboard";
import NotFound from "@/pages/NotFound";
import LandingPage from "@/pages/public/LandingPage";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import FloatingActionButtons from "@/components/common/FloatingActionButtons";
import {
  Register,
  VerifyEmail,
  AuthModal,
  AuthSuccessOverlay,
  ProfileModal,
  blurActiveElement,
} from "@/features/auth";
import {
  clearAuthUser,
  getProfile,
  loadAuthUser,
  mapApiUserToFrontend,
  saveAuthUser,
} from "@/api";

function normalizeAuthUser(user) {
  const mapped = mapApiUserToFrontend(user) || user;
  return {
    ...mapped,
    avatarUrl: normalizeStoredAvatarUrl(mapped?.avatarUrl),
    id: mapped.id ?? mapped.userId,
    userId: mapped.userId ?? mapped.id,
  };
}

function isManagerUser(user) {
  if (!user) return false;
  const roleId = Number(user.roleId ?? user.role_id);
  if (roleId === 4 || roleId === 5) return true;
  const role = String(user.roleName ?? user.role_name ?? user.role ?? "")
    .trim()
    .toLowerCase();
  return role === "manager" || role === "admin";
}

function normalizePathname(path) {
  if (!path || path === "/") return "/";
  return path.replace(/\/+$/, "") || "/";
}

function getPageFromPath(path) {
  const normalized = normalizePathname(path);

  if (normalized.startsWith("/settings")) return "settings";
  if (normalized === "/manager" || normalized.startsWith("/manager/")) return "manager";
  if (normalized === "/staff" || normalized.startsWith("/staff/")) return "staff";
  if (normalized === "/profile") return "profile";
  if (normalized === "/login") return "login";
  if (normalized === "/take-out") return "takeout";
  if (normalized === "/catering") return "catering";
  if (normalized === "/menus") return "menus";
  if (normalized === "/reservations") return "reservations";
  if (normalized === "/my-reservations") return "myReservations";
  if (normalized === "/private-events") return "privateEvents";
  if (normalized === "/careers") return "careers";
  if (normalized === "/contact-hours") return "contactHours";
  if (normalized === "/register") return "register";
  if (normalized === "/verify") return "verify";
  if (normalized === "/landing") return "landing";
  if (normalized === "/") return "home";

  return "notFound";
}

function App() {
  const [activePage, setActivePage] = useState("home");
  const [pathname, setPathname] = useState(
    typeof window !== "undefined" ? window.location.pathname : "/"
  );
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [pendingAuthUser, setPendingAuthUser] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeFading, setWelcomeFading] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileView, setProfileView] = useState("view");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState("login");
  const [loginSuccessMessage, setLoginSuccessMessage] = useState("");

  const handleProfileSave = (updatedUser) => {
    const normalized = normalizeAuthUser(updatedUser);
    setCurrentUser(normalized);
    const remember = Boolean(localStorage.getItem("phurai_auth_user"));
    saveAuthUser(normalized, remember);
  };

  const {
    profile,
    status,
    saveStatus,
    clearStatus,
    saveProfileFields,
    savePhoneNumber,
    applyAvatarUpdate,
    persistExtended,
    loading: profileLoading,
    loadError: profileLoadError,
    refetchProfile,
  } = useUserProfile(currentUser, handleProfileSave);

  const profileEditMode = useMemo(() => {
    if (activePage !== "profile") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("mode") === "edit";
  }, [pathname, activePage]);

  const openAuthModal = (mode = "login") => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    blurActiveElement();
    setIsAuthModalOpen(false);
  };

  const navigateToPath = useCallback((path) => {
    const nextPath =
      path === "/settings" || path === "/settings/" ? "/settings/profile" : path;
    setPathname(nextPath);
    setActivePage(getPageFromPath(nextPath));
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, "", nextPath);
    }
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
          .catch(() => {});
      }
    }

    let initialPath = window.location.pathname;
    if (initialPath === "/settings" || initialPath === "/settings/") {
      initialPath = "/settings/profile";
      window.history.replaceState(null, "", initialPath);
    }
    setPathname(initialPath);
    const initialPage = getPageFromPath(initialPath);
    if (initialPage === "login") {
      setActivePage("home");
      setIsAuthModalOpen(true);
      if (window.location.pathname === "/login") {
        window.history.replaceState(null, "", "/");
        setPathname("/");
      }
    } else {
      setActivePage(initialPage);
    }

    const onPopState = () => {
      let path = window.location.pathname;
      if (path === "/settings" || path === "/settings/") {
        path = "/settings/profile";
        window.history.replaceState(null, "", path);
      }
      setPathname(path);
      const page = getPageFromPath(path);
      if (page === "login") {
        setActivePage("home");
        openAuthModal("login");
        window.history.replaceState(null, "", "/");
        setPathname("/");
        return;
      }
      setActivePage(page);
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
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
        if (isManagerUser(pendingAuthUser)) {
          navigateToPath("/manager");
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

  const handleNavigate = (page) => {
    if (page === "login") {
      openAuthModal("login");
      return;
    }

    if (page === "profile") {
      navigateToPath("/profile");
      return;
    }

    if (page === "profileEdit") {
      navigateToPath("/profile?mode=edit");
      return;
    }

    if (page === "settings") {
      navigateToPath("/settings/profile");
      return;
    }

    if (page === "reservations") {
      navigateToPath("/reservations");
      return;
    }

    if (page === "myReservations") {
      navigateToPath("/my-reservations");
      return;
    }

    if (page === "reservation") {
      navigateToPath("/");
      window.requestAnimationFrame(() => {
        document.getElementById("reserve")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
      return;
    }

    if (page === "manager") {
      navigateToPath("/manager");
      return;
    }

    if (page === "staff") {
      navigateToPath("/staff");
      return;
    }

    setActivePage(page);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    const nextPath =
      page === "takeout"
        ? "/take-out"
        : page === "catering"
        ? "/catering"
        : page === "menus"
        ? "/menus"
        : page === "privateEvents"
        ? "/private-events"
        : page === "careers"
        ? "/careers"
        : page === "contactHours"
        ? "/contact-hours"
        : page === "landing"
        ? "/landing"
        : page === "manager"
        ? "/manager"
        : page === "staff"
        ? "/staff"
        : "/";

    setPathname(nextPath);
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, "", nextPath);
    }
  };

  const handleAuthSuccess = (user, options = {}) => {
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
      navigateToPath("/manager");
    } else if (isStaffPortalUser(normalized)) {
      navigateToPath("/staff");
    }
  };

  const handleSignOut = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setShowProfile(false);
    setPendingAuthUser(null);
    setShowWelcome(false);
    clearAuthUser();
    navigateToPath("/");
  };

  const handlePasswordReset = ({ message } = {}) => {
    clearAuthUser();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setShowProfile(false);
    setProfileView("view");
    setLoginSuccessMessage(
      message || "Password reset successfully. Please sign in with your new password."
    );
    openAuthModal("login");
  };

  const openChangePassword = () => {
    setProfileView("password");
    setShowProfile(true);
  };

  const isManagerPage = pathname === "/manager" || pathname.startsWith("/manager/");
  const isStaffPage = pathname === "/staff" || pathname.startsWith("/staff/");
  const isAccountPage =
    pathname.startsWith("/profile") || pathname.startsWith("/settings");
  const isPortalPage = isAccountPage || isManagerPage || isStaffPage;

  return (
    <>
      {!isPortalPage ? (
        <Navbar
          activePage={activePage}
          onNavigate={handleNavigate}
          isAuthenticated={isAuthenticated}
          currentUser={currentUser}
          status={status}
          onSaveStatus={saveStatus}
          onClearStatus={clearStatus}
          onOpenAuth={() => openAuthModal("login")}
          onOpenProfile={(view = "view") => {
            if (view === "password") {
              openChangePassword();
              return;
            }
            handleNavigate("profile");
          }}
          onSignOut={handleSignOut}
        />
      ) : null}

      {activePage === "home" && <Home />}
      {activePage === "landing" && <LandingPage />}
      {activePage === "takeout" && <TakeOut />}
      {activePage === "catering" && <Catering />}
      {activePage === "menus" && (
        <Menu isAuthenticated={isAuthenticated} currentUser={currentUser} />
      )}
      {activePage === "reservations" && (
        <ReservationPage
          isAuthenticated={isAuthenticated}
          currentUser={currentUser}
          onNavigate={handleNavigate}
          onRequireAuth={() => openAuthModal("register")}
        />
      )}
      {activePage === "myReservations" && (
        <MyReservationsPage
          isAuthenticated={isAuthenticated}
          currentUser={currentUser}
          onNavigate={handleNavigate}
          onNavigateLogin={() => openAuthModal("login")}
        />
      )}
      {activePage === "privateEvents" && (
        <PrivateEvents onNavigate={handleNavigate} />
      )}
      {activePage === "careers" && <Careers />}
      {activePage === "contactHours" && <ContactHours />}
      {activePage === "register" && <Register />}
      {activePage === "verify" && <VerifyEmail />}
      {activePage === "profile" && (
        <ProfilePage
          profile={profile}
          profileLoading={profileLoading}
          profileError={profileLoadError}
          onRetryProfile={refetchProfile}
          isAuthenticated={isAuthenticated}
          initialEditMode={profileEditMode}
          onSaveProfile={saveProfileFields}
          onSavePhone={savePhoneNumber}
          onSavePreferences={persistExtended}
          onApplyAvatar={applyAvatarUpdate}
          onOpenChangePassword={openChangePassword}
          onPasswordReset={handlePasswordReset}
          onNavigateLogin={() => openAuthModal("login")}
          onNavigateHome={() => handleNavigate("home")}
        />
      )}
      {activePage === "settings" && (
        <SettingsPage
          profile={profile}
          pathname={pathname}
          isAuthenticated={isAuthenticated}
          onNavigatePath={navigateToPath}
          onNavigateLogin={() => openAuthModal("login")}
          onNavigateHome={() => handleNavigate("home")}
          onOpenChangePassword={openChangePassword}
          onApplyAvatar={applyAvatarUpdate}
        />
      )}
      {activePage === "manager" && (
        <ManagerDashboard
          isAuthenticated={isAuthenticated}
          currentUser={currentUser}
          onSignOut={handleSignOut}
          onNavigateHome={() => handleNavigate("home")}
          onNavigate={handleNavigate}
          onOpenAuth={() => openAuthModal("login")}
        />
      )}
      {activePage === "staff" && (
        <StaffDashboard
          isAuthenticated={isAuthenticated}
          currentUser={currentUser}
          onSignOut={handleSignOut}
          onNavigate={handleNavigate}
        />
      )}
      {activePage === "notFound" && (
        <NotFound
          onNavigate={handleNavigate}
          pathname={pathname}
          currentUser={currentUser}
          isAuthenticated={isAuthenticated}
        />
      )}

      {!isPortalPage ? <Footer /> : null}

      {!isPortalPage ? <FloatingActionButtons /> : null}

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

      <ProfileModal
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        user={currentUser}
        onSave={handleProfileSave}
        initialView={profileView}
        onPasswordReset={handlePasswordReset}
      />
    </>
  );
}

export default App;
