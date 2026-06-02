import { useEffect, useState } from "react";
import "./styles/home.css";
import Home from "./pages/customer/Home";
import TakeOut from "./pages/customer/TakeOut";
import Catering from "./pages/customer/Catering";
import PrivateEvents from "./pages/customer/PrivateEvents";
import Careers from "./pages/customer/Careers";
import ContactHours from "./pages/customer/ContactHours";
import Menu from "./pages/customer/Menu";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import LoginPage from "./pages/auth/LoginPage";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail.jsx";
import WelcomeOverlay from "./components/auth/WelcomeOverlay";
import ProfileModal from "./components/auth/ProfileModal";
import { clearAuthUser, getProfile, loadAuthUser, saveAuthUser } from "./components/auth/api";
import { normalizeStoredAvatarUrl } from "./components/auth/avatarUtils";

function normalizeAuthUser(user) {
  return {
    ...user,
    avatarUrl: normalizeStoredAvatarUrl(user?.avatarUrl),
    id: user.id ?? user.userId,
    userId: user.userId ?? user.id,
  };
}

function App() {
  const [activePage, setActivePage] = useState("home");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [pendingAuthUser, setPendingAuthUser] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeFading, setWelcomeFading] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileView, setProfileView] = useState("view");
  const [loginSuccessMessage, setLoginSuccessMessage] = useState("");

  const getPageFromPath = (path) => {
    if (path === "/login") return "login";
    if (path === "/take-out") return "takeout";
    if (path === "/catering") return "catering";
    if (path === "/menus") return "menus";
    if (path === "/private-events") return "privateEvents";
    if (path === "/careers") return "careers";
    if (path === "/contact-hours") return "contactHours";
    if (path === "/register") return "register";
    if (path === "/verify") return "verify";
    return "home";
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
    setActivePage(getPageFromPath(window.location.pathname));

    const onPopState = () => {
      setActivePage(getPageFromPath(window.location.pathname));
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
      if (pendingAuthUser) {
        setIsAuthenticated(true);
        setCurrentUser(pendingAuthUser);
        saveAuthUser(pendingAuthUser, Boolean(localStorage.getItem("phurai_auth_user")));
        setPendingAuthUser(null);
        setActivePage("home");
        if (window.location.pathname !== "/") {
          window.history.pushState(null, "", "/");
        }
      }
    }, 3200);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(closeTimer);
    };
  }, [showWelcome, pendingAuthUser]);

  const handleNavigate = (page) => {
    setActivePage(page);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    const nextPath =
      page === "login"
        ? "/login"
        : page === "takeout"
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
        : "/";

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
    handleNavigate("home");
  };

  const handleSignOut = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setShowProfile(false);
    setPendingAuthUser(null);
    setShowWelcome(false);
    clearAuthUser();
  };

  const handleProfileSave = (updatedUser) => {
    const normalized = normalizeAuthUser(updatedUser);
    setCurrentUser(normalized);
    const remember = Boolean(localStorage.getItem("phurai_auth_user"));
    saveAuthUser(normalized, remember);
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
    handleNavigate("login");
  };

  const isLoginPage = activePage === "login";

  return (
    <>
      {!isLoginPage ? (
        <Navbar
          activePage={activePage}
          onNavigate={handleNavigate}
          isAuthenticated={isAuthenticated}
          currentUser={currentUser}
          onOpenAuth={() => handleNavigate("login")}
          onOpenProfile={(view = "view") => {
            setProfileView(view);
            setShowProfile(true);
          }}
          onSignOut={handleSignOut}
        />
      ) : null}

      {activePage === "home" && <Home />}
      {activePage === "takeout" && <TakeOut />}
      {activePage === "catering" && <Catering />}
      {activePage === "menus" && <Menu />}
      {activePage === "privateEvents" && (
        <PrivateEvents onNavigate={handleNavigate} />
      )}
      {activePage === "careers" && <Careers />}
      {activePage === "contactHours" && <ContactHours />}
      {activePage === "register" && <Register />}
      {activePage === "verify" && <VerifyEmail />}
      {isLoginPage && (
        <LoginPage
          isAuthenticated={isAuthenticated}
          onAuthSuccess={handleAuthSuccess}
          onNavigateHome={() => handleNavigate("home")}
          successMessage={loginSuccessMessage}
          onClearSuccess={() => setLoginSuccessMessage("")}
        />
      )}

      {!isLoginPage ? <Footer /> : null}

      <WelcomeOverlay
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
