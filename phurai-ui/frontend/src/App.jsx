import { useEffect, useMemo, useState } from "react";
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
  ContactHoursPage as ContactHours,
} from "@/features/content";
import { MenuPage as Menu } from "@/features/menu";
import { isMenuCustomer } from "@/features/menu/utils/menuCustomer.js";
import { TableSessionProvider } from "@/features/table-session";
import AppRealtimeShell from "@/components/notifications/AppRealtimeShell.jsx";
import {
  ReservationPage,
  MyReservationsPage,
} from "@/features/reservations";
import {
  ProfilePage,
  SettingsPage,
  useUserProfile,
} from "@/features/profile";
import { ManagerPortalPage } from "@/features/manager-dashboard";
import ScrollToTop from "@/components/common/ScrollToTop.jsx";
import { StaffDashboardPage as StaffDashboard } from "@/features/staff-dashboard";
import { KitchenLayout, KitchenDashboardPage } from "@/features/kitchen-dashboard";
import AdminLayout from '@/features/admin-dashboard/layout/AdminLayout';
import AdminDashboardPage from '@/features/admin-dashboard/pages/AdminDashboardPage';
import AdminAccountsPage from '@/features/admin-dashboard/pages/Accounts';
import AdminAuditLogsPage from '@/features/admin-dashboard/pages/AuditLogs';
import AdminSystemSettingsPage from '@/features/admin-dashboard/pages/SystemSettings';
import AdminRolesPage from '@/features/admin-dashboard/pages/Roles';
import AdminAnalyticsPage from '@/features/admin-dashboard/pages/Analytics';
import AdminRestaurantInfoPage from '@/features/admin-dashboard/pages/RestaurantInfo';
import AdminFloorPlanConfigPage from '@/features/admin-dashboard/pages/FloorPlanSetup';
import RequireRole from "@/features/auth/components/RequireRole";
import NotFound from "@/pages/NotFound";
import LandingPage from "@/pages/public/LandingPage";
import QrScanPage from "@/pages/public/QrScanPage.jsx";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import FloatingActionButtons from "@/components/common/FloatingActionButtons";
import { ProfileModal, Register, VerifyEmail } from "@/features/auth";
import { saveAuthUser } from "@/core/api";
import { useAuth } from "@/features/auth/context/AuthContext";
import CustomerCheckout from "@/features/payment/pages/CustomerCheckout.jsx";

const PAGE_PATHS = {
  home: "/",
  landing: "/landing",
  takeout: "/take-out",
  catering: "/catering",
  menus: "/menus",
  reservations: "/reservations",
  myReservations: "/my-reservations",
  privateEvents: "/private-events",
  contactHours: "/contact-hours",
  giftCards: "/gift-cards",
  register: "/register",
  verify: "/verify",
  profile: "/profile",
  favorites: "/profile/favorites",
  settings: "/settings/profile",
  manager: "/manager/dashboard",
  staff: "/staff",
};

function normalizePathname(path) {
  if (!path || path === "/") return "/";
  return path.replace(/\/+$/, "") || "/";
}

function getPageFromPath(path) {
  const normalized = normalizePathname(path);

  if (normalized.startsWith("/settings")) return "settings";
  if (normalized === "/manager" || normalized.startsWith("/manager/")) return "manager";
  if (normalized === "/staff" || normalized.startsWith("/staff/")) return "staff";
  if (normalized === "/profile" || normalized.startsWith("/profile/")) return "profile";
  if (normalized === "/login") return "login";
  if (normalized === "/take-out") return "takeout";
  if (normalized === "/catering") return "catering";
  if (normalized === "/menus") return "menus";
  if (normalized === "/reservations" || normalized.startsWith("/reservations/")) return "reservations";
  if (normalized === "/my-reservations") return "myReservations";
  if (normalized === "/private-events") return "privateEvents";
  if (normalized === "/contact-hours") return "contactHours";
  if (normalized === "/gift-cards") return "giftCards";
  if (normalized === "/register") return "register";
  if (normalized === "/verify") return "verify";
  if (normalized === "/landing") return "landing";
  if (normalized === "/") return "home";

  return "notFound";
}

function MenuRouteRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/menus${search}`} replace />;
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const activePage = getPageFromPath(pathname);

  const {
    isAuthenticated,
    currentUser,
    authReady,
    setCurrentUser,
    handleSignOut,
    handlePasswordReset,
    openAuthModal,
    navigateToPath
  } = useAuth();

  const [showProfile, setShowProfile] = useState(false);
  const [profileView, setProfileView] = useState("view");

  const handleProfileSave = (updatedUser) => {
    setCurrentUser(updatedUser);
    const remember = Boolean(localStorage.getItem("phurai_auth_user"));
    saveAuthUser(updatedUser, remember);
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

  const customerUserId = useMemo(() => {
    const id = currentUser?.userId ?? currentUser?.id;
    const parsed = Number(id);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [currentUser]);

  const isCustomerUser = useMemo(
    () => isMenuCustomer(isAuthenticated, currentUser),
    [isAuthenticated, currentUser]
  );

  useEffect(() => {
    if (pathname === "/login") {
      openAuthModal("login");
      navigate("/", { replace: true });
    }
  }, [pathname, navigate, openAuthModal]);

  useEffect(() => {
    if (pathname === "/settings" || pathname === "/settings/") {
      navigate("/settings/profile", { replace: true });
    }
  }, [pathname, navigate]);

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

  const openChangePassword = () => {
    setProfileView("password");
    setShowProfile(true);
  };

  const isManagerPage = pathname === "/manager" || pathname.startsWith("/manager/");
  const isStaffPage = pathname === "/staff" || pathname.startsWith("/staff/");
  const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAccountPage =
    pathname.startsWith("/profile") || pathname.startsWith("/settings") || pathname.startsWith("/dashboard");
  const isReservationPage = pathname === "/reservations" || pathname.startsWith("/reservations/");
  const isKdsPage = pathname === "/kds" || pathname.startsWith("/kds/");
  const isQrPage = pathname.startsWith("/scan") || pathname.startsWith("/checkout");
  const isPortalPage = isAccountPage || isManagerPage || isStaffPage || isAdminPage || isReservationPage || isKdsPage || isQrPage;

  if (!authReady) {
    return null; // Or a loading spinner
  }

  return (
    <TableSessionProvider userId={customerUserId} isCustomer={isCustomerUser}>
      <AppRealtimeShell
        currentUser={currentUser}
        isAuthenticated={isAuthenticated}
      >
        <ScrollToTop />
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
          <Route path="/scan/:qr_code" element={<QrScanPage />} />
          {/* Review route handled by modal now */}
          <Route path="/checkout/:orderId" element={<CustomerCheckout />} />
          <Route path="/menu" element={<MenuRouteRedirect />} />
          <Route path="/take-out" element={<TakeOut />} />
          <Route path="/catering" element={<Catering />} />
          <Route
            path="/menus"
            element={<Menu isAuthenticated={isAuthenticated} currentUser={currentUser} />}
          />
          <Route
            path="/reservations/:step?"
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
          <Route path="/contact-hours" element={<ContactHours />} />
          <Route path="/gift-cards" element={<Navigate to="/" replace />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify" element={<VerifyEmail />} />
          <Route
            path="/dashboard"
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
            path="/profile/*"
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
          <Route element={<RequireRole allowedRoles={['Admin']} />}>
            <Route path="/admin" element={<AdminLayout currentUser={currentUser} onSignOut={handleSignOut} />}>

              <Route index element={<AdminDashboardPage />} />
              
              {/* Accounts Group */}
              <Route path="accounts" element={<AdminAccountsPage />} />
              <Route path="roles" element={<AdminRolesPage />} />
              <Route path="audit-logs" element={<AdminAuditLogsPage />} />
              
              {/* Analytics Group */}
              <Route path="analytics/reservations" element={<AdminAnalyticsPage type="reservations" title="Reservations Analytics" description="Status distribution of reservations" />} />
              <Route path="analytics/revenue" element={<AdminAnalyticsPage type="revenue" title="Revenue Analytics" description="30-day revenue trends" />} />
              <Route path="analytics/orders" element={<AdminAnalyticsPage type="orders" title="Orders Analytics" description="Order status and average values" />} />
              <Route path="analytics/reviews" element={<AdminAnalyticsPage type="reviews" title="Customer Reviews" description="Overall rating distribution" />} />
              <Route path="analytics/staff-performance" element={<AdminAnalyticsPage type="staff-performance" title="Staff Performance" description="Total shifts handled per staff member" />} />
              
              {/* Settings Group */}
              <Route path="settings/restaurant" element={<AdminRestaurantInfoPage />} />
              <Route path="settings/system" element={<AdminSystemSettingsPage />} />
              <Route path="settings/floor-plan" element={<AdminFloorPlanConfigPage />} />
            </Route>
          </Route>
          <Route element={<RequireRole allowedRoles={['Manager', 'Admin']} />}>
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
          </Route>
          <Route element={<RequireRole allowedRoles={['Restaurant Staff']} />}>
            <Route
              path="/staff/*"
              element={
                <StaffDashboard
                  authReady={authReady}
                  isAuthenticated={isAuthenticated}
                  currentUser={currentUser}
                  onSignOut={handleSignOut}
                  onNavigate={handleNavigate}
                />
              }
            />
          </Route>
          {/* /kds — device-based PIN gate (no user role restriction; PinGate handles auth) */}
          <Route element={<RequireRole allowedRoles={['Restaurant Staff', 'Manager', 'Admin']} />}>
            <Route path="/kds" element={<KitchenLayout currentUser={currentUser} onSignOut={handleSignOut} />}>
              <Route index element={<KitchenDashboardPage currentUser={currentUser} />} />
            </Route>
          </Route>

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

        <ProfileModal
          isOpen={showProfile}
          onClose={() => setShowProfile(false)}
          user={currentUser}
          onSave={handleProfileSave}
          initialView={profileView}
          onPasswordReset={handlePasswordReset}
        />
      </AppRealtimeShell>
    </TableSessionProvider>
  );
}

export default App;
