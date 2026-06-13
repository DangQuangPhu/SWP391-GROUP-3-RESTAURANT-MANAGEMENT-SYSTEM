import { useEffect, useRef, useState } from "react";
import { UserAvatar } from "@/features/auth";
import { ProfileDropdown } from "@/features/profile";
import "@/styles/profile.css";

const navLinks = [
  "TAKE OUT",
  "CATERING",
  "MENUS",
  "PRIVATE EVENTS",
  "CAREERS",
  "CONTRACT & HOURS",
];

const pageClassMap = {
  home: "home",
  takeout: "takeout",
  catering: "catering",
  menus: "menus",
  privateEvents: "private-events",
  careers: "careers",
  contactHours: "contact-hours",
  reservations: "reservations",
  myReservations: "my-reservations",
};

const darkTopPages = [
  "home",
  "takeout",
  "privateEvents",
  "careers",
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
  const [navState, setNavState] = useState("top");
  const [profileOpen, setProfileOpen] = useState(false);
  const lastScrollY = useRef(0);

  const isDarkTopPage = darkTopPages.includes(activePage);
  const pageClass = pageClassMap[activePage] || activePage;
  
  const isBlackReservationPage = ["takeout", "catering", "menus"].includes(activePage);
  useEffect(() => {
    setNavState("top");
    lastScrollY.current = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

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
    if (link === "CAREERS") return "/careers";
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

    if (link === "CAREERS") {
      event.preventDefault();
      onNavigate?.("careers");
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
    if (link === "CAREERS") return activePage === "careers";
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
  const handleSettings = () => {
    setProfileOpen(false);
    onNavigate?.("settings");
  };
  const handleChangePassword = () => openProfile("password");

  return (
    <header
      className={`phurai-navbar phurai-navbar--${navState} phurai-navbar--page-${pageClass} ${isDarkTopPage
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
        <a
          href="/reservations"
          className={`phurai-navbar__cta ${isBlackReservationPage ? "phurai-navbar__cta--black" : ""
            }`}
          onClick={(event) => {
            event.preventDefault();
            onNavigate?.("reservations");
          }}
        >
          RESERVATIONS
        </a>
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
              onSettings={handleSettings}
              onChangePassword={handleChangePassword}
              onSignOut={onSignOut}
              onOpenAuth={onOpenAuth}
            />
          </div>
        ) : null}
      </div>
    </header>
  );
}

export default Navbar;
