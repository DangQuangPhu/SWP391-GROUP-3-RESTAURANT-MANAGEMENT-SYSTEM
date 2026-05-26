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
import AuthModal from "./components/auth/AuthModal";
import WelcomeOverlay from "./components/auth/WelcomeOverlay";
import ProfileModal from "./components/auth/ProfileModal";

function App() {
  const [activePage, setActivePage] = useState("home");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [pendingAuthUser, setPendingAuthUser] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeFading, setWelcomeFading] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const getPageFromPath = (path) => {
    if (path === "/take-out") return "takeout";
    if (path === "/catering") return "catering";
    if (path === "/menus") return "menus";
    if (path === "/private-events") return "privateEvents";
    if (path === "/careers") return "careers";
    if (path === "/contact-hours") return "contactHours";
    return "home";
  };

  useEffect(() => {
    setActivePage(getPageFromPath(window.location.pathname));

    const onPopState = () => {
      setActivePage(getPageFromPath(window.location.pathname));
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!showWelcome) {
      return undefined;
    }

    const fadeTimer = setTimeout(() => {
      setWelcomeFading(true);
    }, 2600);

    const closeTimer = setTimeout(() => {
      setShowWelcome(false);
      setWelcomeFading(false);
      setIsAuthenticated(true);
      setCurrentUser(pendingAuthUser);
      setPendingAuthUser(null);
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
        : "/";

    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, "", nextPath);
    }
  };

  const handleOpenAuth = () => {
    setShowAuth(true);
    setShowOtp(false);
    setPendingAuthUser(null);
  };

  const handleCloseAuth = () => {
    setShowAuth(false);
    setShowOtp(false);
    setPendingAuthUser(null);
  };

  const handleProceedToOtp = (user) => {
    setPendingAuthUser(user);
    setShowOtp(true);
  };

  const handleOtpBack = () => {
    setShowOtp(false);
  };

  const handleOtpVerified = () => {
    setShowAuth(false);
    setShowOtp(false);
    setShowWelcome(true);
  };

  const handleSignOut = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setShowProfile(false);
    setPendingAuthUser(null);
    setShowAuth(false);
    setShowOtp(false);
    setShowWelcome(false);
  };

  const handleProfileSave = (updatedUser) => {
    setCurrentUser(updatedUser);
  };

  return (
    <>
      <Navbar
        activePage={activePage}
        onNavigate={handleNavigate}
        isAuthenticated={isAuthenticated}
        currentUser={currentUser}
        onOpenAuth={handleOpenAuth}
        onOpenProfile={() => setShowProfile(true)}
        onSignOut={handleSignOut}
      />
      {activePage === "home" && <Home />}
      {activePage === "takeout" && <TakeOut />}
      {activePage === "catering" && <Catering />}
      {activePage === "menus" && <Menu />}
      {activePage === "privateEvents" && (
        <PrivateEvents onNavigate={handleNavigate} />
      )}
      {activePage === "careers" && <Careers />}
      {activePage === "contactHours" && <ContactHours />}
      <Footer />

      <AuthModal
        isOpen={showAuth}
        showOtp={showOtp}
        onClose={handleCloseAuth}
        onProceedToOtp={handleProceedToOtp}
        onOtpVerified={handleOtpVerified}
        onOtpBack={handleOtpBack}
      />

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
      />
    </>
  );
}

export default App;
