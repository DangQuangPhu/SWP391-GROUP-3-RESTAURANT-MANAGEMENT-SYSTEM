import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserAvatar } from "@/features/auth";
import { isMenuCustomer } from "@/features/menu/utils/menuCustomer.js";
import { ProfileDropdown } from "@/features/profile";
import { getPortalInfo } from "@/features/profile/components/ProfileDropdown.jsx";
import CustomerNotificationBell from "@/components/notifications/CustomerNotificationBell.jsx";
import { ViewQrTableModal, useTableSession } from "@/features/table-session";
import "@/features/table-session/styles/table-session.css";
import "@/features/profile/styles/profile.css";
import "./Navbar.css";

const navLinks = [
  "TAKE OUT",
  "CATERING",
  "MENUS",
  "PRIVATE EVENTS",
  "CONTRACT & HOURS",
];

const pageClassMap = {
  home: "home",
  takeout: "takeout",
  catering: "catering",
  menus: "menus",
  privateEvents: "private-events",
  contactHours: "contact-hours",
  reservations: "reservations",
  myReservations: "my-reservations",
  giftCards: "gift-cards",
};

const darkTopPages = [
  "home",
  "giftCards",
  "takeout",
  "privateEvents",
  "contactHours",
  "reservations",
  "notFound",
];

function Navbar({
  onNavigate,
  activePage = "home",
  isAuthenticated = false,
  currentUser = null,
  status = null,
  onSaveStatus,
  onClearStatus,
  onOpenAuth,
  onOpenProfile,
  onSignOut,
}) {
  const openProfile = (view) => {
    setProfileOpen(false);
    onOpenProfile?.(view);
  };
  const navigate = useNavigate();
  const [navState, setNavState] = useState("top");
  const [isScrolled, setIsScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const lastScrollY = useRef(0);

  const { hasActiveSession = false } = useTableSession() || {};
  const isMenuCustomerUser = isMenuCustomer(isAuthenticated, currentUser);
  const showQrTableAction = isMenuCustomerUser && hasActiveSession;
  const portalInfo = getPortalInfo(currentUser);

  const isDarkTopPage = darkTopPages.includes(activePage);
  const pageClass = pageClassMap[activePage] || activePage;
  
  const isBlackReservationPage = ["takeout", "catering", "menus"].includes(activePage);
  useEffect(() => {
    setNavState("top");
    setIsScrolled(window.scrollY > 0);
    lastScrollY.current = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      setIsScrolled(currentScrollY > 0);

      if (currentScrollY <= 40) {
        setNavState("top");
      } else if (currentScrollY > lastScrollY.current) {
        setNavState("hidden");
      } else {
        setNavState("visible");
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [activePage]);

  useEffect(() => {
    setProfileOpen(false);
  }, [activePage, isAuthenticated]);

  const handleLogoClick = (event) => {
    event.preventDefault();
    onNavigate?.("home");
  };

  const getLinkHref = (link) => {
    if (link === "TAKE OUT") return "/take-out";
    if (link === "CATERING") return "/catering";
    if (link === "MENUS") return "/menus";
    if (link === "PRIVATE EVENTS") return "/private-events";
    if (link === "CONTRACT & HOURS") return "/contact-hours";
    return "#";
  };

  const handleLinkClick = (link, event) => {
    if (link === "TAKE OUT") {
      event.preventDefault();
      onNavigate?.("takeout");
      return;
    }

    if (link === "CATERING") {
      event.preventDefault();
      onNavigate?.("catering");
      return;
    }

    if (link === "MENUS") {
      event.preventDefault();
      onNavigate?.("menus");
      return;
    }

    if (link === "PRIVATE EVENTS") {
      event.preventDefault();
      onNavigate?.("privateEvents");
      return;
    }

    if (link === "CONTRACT & HOURS") {
      event.preventDefault();
      onNavigate?.("contactHours");
    }
  };

  const isActiveLink = (link) => {
    if (link === "TAKE OUT") return activePage === "takeout";
    if (link === "CATERING") return activePage === "catering";
    if (link === "MENUS") return activePage === "menus";
    if (link === "PRIVATE EVENTS") return activePage === "privateEvents";
    if (link === "CONTRACT & HOURS") return activePage === "contactHours";
    return false;
  };

  const handleMyProfile = () => {
    setProfileOpen(false);
    onNavigate?.("profile");
  };
  const handleMyReservations = () => {
    setProfileOpen(false);
    onNavigate?.("myReservations");
  };
  const handleMyFavorites = () => {
    setProfileOpen(false);
    onNavigate?.("favorites");
  };
  const handleSettings = () => {
    setProfileOpen(false);
    onNavigate?.("settings");
  };
  const handleChangePassword = () => openProfile("password");
  const handleViewQrTable = () => {
    setProfileOpen(false);
    setQrModalOpen(true);
  };

  return (
    <>
    <header
      className={`phurai-navbar phurai-navbar--${navState} phurai-navbar--page-${pageClass} ${
        isScrolled ? "phurai-navbar--scrolled" : ""
      } ${isDarkTopPage
          ? "phurai-navbar--dark-top-page"
          : "phurai-navbar--light-top-page"
        }`}
    >
      <a
        href="/"
        className="phurai-navbar__logo"
        aria-label="Phūrai home"
        onClick={handleLogoClick}
      >
        Phūrai
      </a>

      <nav className="phurai-navbar__nav" aria-label="Main navigation">
        <ul>
          {navLinks.map((link) => {
            const isActive = isActiveLink(link);

            return (
              <li key={link}>
                <a
                  href={getLinkHref(link)}
                  className={isActive ? "is-active" : undefined}
                  onClick={(event) => handleLinkClick(link, event)}
                  aria-current={isActive ? "page" : undefined}
                >
                  {link}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="phurai-navbar__actions">
        {!isAuthenticated ? (
          <button type="button" className="phurai-navbar__auth" onClick={onOpenAuth}>
            SIGN IN
          </button>
        ) : null}

        {isAuthenticated && isMenuCustomerUser && (
          <CustomerNotificationBell />
        )}

        <a
          href="/reservations"
          className={`phurai-navbar__cta phurai-navbar__cta--reservations ${
            isBlackReservationPage ? "phurai-navbar__cta--black" : ""
          }`}
          onClick={(event) => {
            event.preventDefault();
            onNavigate?.("reservations");
          }}
        >
          RESERVATIONS
        </a>
        {portalInfo ? (
          <button
            type="button"
            className="phurai-navbar__cta phurai-navbar__cta--portal"
            style={{
              background: "linear-gradient(135deg, #b8a379 0%, #9f8655 100%)",
              color: "#0f172a",
              fontWeight: "700",
              letterSpacing: "0.04em",
              borderRadius: "8px",
              padding: "8px 16px",
              fontSize: "13px",
              cursor: "pointer",
              border: "none",
              boxShadow: "0 2px 8px rgba(184, 163, 121, 0.4)",
              transition: "transform 0.2s, opacity 0.2s"
            }}
            onClick={() => navigate(portalInfo.path)}
          >
            {portalInfo.label.toUpperCase()}
          </button>
        ) : null}
        {isAuthenticated ? (
          <div className="phurai-navbar__profile-wrap">
            <button
              type="button"
              className="phurai-navbar__avatar-btn"
              onClick={() => setProfileOpen((prev) => !prev)}
              aria-label="Open profile menu"
              aria-expanded={profileOpen}
            >
              <UserAvatar
                user={currentUser}
                size="sm"
                imgClassName="phurai-navbar__avatar-img"
              />
            </button>
            <ProfileDropdown
              isOpen={profileOpen}
              onClose={() => setProfileOpen(false)}
              currentUser={currentUser}
              status={status}
              onSaveStatus={onSaveStatus}
              onClearStatus={onClearStatus}
              onMyProfile={handleMyProfile}
              onMyReservations={handleMyReservations}
              onMyFavorites={handleMyFavorites}
              onViewQrTable={showQrTableAction ? handleViewQrTable : undefined}
              onSettings={handleSettings}
              onChangePassword={handleChangePassword}
              onSignOut={onSignOut}
              onOpenAuth={onOpenAuth}
            />
          </div>
        ) : null}
      </div>
    </header>

    {showQrTableAction ? (
      <ViewQrTableModal isOpen={qrModalOpen} onClose={() => setQrModalOpen(false)} />
    ) : null}
    </>
  );
}

export default Navbar;
