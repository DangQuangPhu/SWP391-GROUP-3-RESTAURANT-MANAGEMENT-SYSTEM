import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
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
import { ManagerPortalPage } from "@/features/manager-dashboard";
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

const PAGE_PATHS = {
  home: "/",
  landing: "/landing",
  takeout: "/take-out",
  catering: "/catering",
  menus: "/menus",
  reservations: "/reservations",
  myReservations: "/my-reservations",
  privateEvents: "/private-events",
  careers: "/careers",
  contactHours: "/contact-hours",
  register: "/register",
  verify: "/verify",
  profile: "/profile",
  settings: "/settings/profile",
  manager: "/manager/dashboard",
  staff: "/staff",
};

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
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const activePage = getPageFromPath(pathname);

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
    return new URLSearchParams(location.search).get("mode") === "edit";
  }, [location.search, activePage]);

  const navigateToPath = useCallback(
    (path) => {
      const nextPath =
        path === "/settings" || path === "/settings/" ? "/settings/profile" : path;
      navigate(nextPath);
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    },
    [navigate]
  );

  const openAuthModal = (mode = "login") => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    blurActiveElement();
    setIsAuthModalOpen(false);
  };

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

    if (pathname === "/login") {
      openAuthModal("login");
      navigate("/", { replace: true });
    }
  }, []);

  useEffect(() => {
    if (pathname === "/settings" || pathname === "/settings/") {
      navigate("/settings/profile", { replace: true });
    }
  }, [pathname, navigate]);

  /* Managers/Admins belong on /manager — never on /staff (waiter/kitchen portal). */
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;
    if (!isManagerUser(currentUser)) return;
    const onStaffRoute = pathname === "/staff" || pathname.startsWith("/staff/");
    if (onStaffRoute) {
      navigateToPath("/manager/dashboard");
    }
  }, [isAuthenticated, currentUser, pathname, navigateToPath]);

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

    const nextPath = PAGE_PATHS[page];
    if (nextPath) {
      navigateToPath(nextPath);
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
      navigateToPath("/manager/dashboard");
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

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/take-out" element={<TakeOut />} />
        <Route path="/catering" element={<Catering />} />
        <Route
          path="/menus"
          element={<Menu isAuthenticated={isAuthenticated} currentUser={currentUser} />}
        />
        <Route
          path="/reservations"
          element={
            <ReservationPage
              isAuthenticated={isAuthenticated}
              currentUser={currentUser}
              onNavigate={handleNavigate}
              onRequireAuth={() => openAuthModal("register")}
            />
          }
        />
        <Route
          path="/my-reservations"
          element={
            <MyReservationsPage
              isAuthenticated={isAuthenticated}
              currentUser={currentUser}
              onNavigate={handleNavigate}
              onNavigateLogin={() => openAuthModal("login")}
            />
          }
        />
        <Route path="/private-events" element={<PrivateEvents onNavigate={handleNavigate} />} />
        <Route path="/careers" element={<Careers />} />
        <Route path="/contact-hours" element={<ContactHours />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify" element={<VerifyEmail />} />
        <Route
          path="/profile"
          element={
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
          }
        />
        <Route
          path="/settings/*"
          element={
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
          }
        />
        <Route path="/manager" element={<Navigate to="/manager/dashboard" replace />} />
        <Route
          path="/manager/*"
          element={
            <ManagerPortalPage
              isAuthenticated={isAuthenticated}
              currentUser={currentUser}
              onSignOut={handleSignOut}
              onNavigate={handleNavigate}
            />
          }
        />
        <Route
          path="/staff/*"
          element={
            <StaffDashboard
              isAuthenticated={isAuthenticated}
              currentUser={currentUser}
              onSignOut={handleSignOut}
              onNavigate={handleNavigate}
            />
          }
        />
        <Route
          path="*"
          element={
            <NotFound
              onNavigate={handleNavigate}
              pathname={pathname}
              currentUser={currentUser}
              isAuthenticated={isAuthenticated}
            />
          }
        />
      </Routes>

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
