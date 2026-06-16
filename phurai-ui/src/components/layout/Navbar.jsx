import { useEffect, useRef, useState } from "react";
import { UserAvatar } from "@/features/auth";
import { isMenuCustomer } from "@/features/menu/utils/menuCustomer.js";
import { ProfileDropdown } from "@/features/profile";
import CustomerNotificationBell from "@/components/notifications/CustomerNotificationBell.jsx";
import { ViewQrTableModal, useTableSession } from "@/features/table-session";
import "@/features/table-session/styles/table-session.css";
import "@/styles/profile.css";
import "./Navbar.css";

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
  giftCards: "gift-cards",
};

const darkTopPages = [
  "home",
  "giftCards",
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
  const [isScrolled, setIsScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [localReservations, setLocalReservations] = useState([]);
  const [guestDropdownOpen, setGuestDropdownOpen] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const fetchLocal = () => {
      const data = JSON.parse(localStorage.getItem('customer_reservations')) || [];
      setLocalReservations(data);
    };
    fetchLocal();
    window.addEventListener('reservation_added', fetchLocal);
    return () => window.removeEventListener('reservation_added', fetchLocal);
  }, []);

  const { hasActiveSession } = useTableSession();
  const isMenuCustomerUser = isMenuCustomer(isAuthenticated, currentUser);
  const showQrTableAction = isMenuCustomerUser && hasActiveSession;

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
        {showQrTableAction ? (
          <button
            type="button"
            className={`phurai-navbar__cta phurai-navbar__cta--reservations ${
              isBlackReservationPage ? "phurai-navbar__cta--black" : ""
            }`}
            onClick={() => setQrModalOpen(true)}
          >
            View QR Table
          </button>
        ) : null}
        {!isAuthenticated && localReservations.length > 0 ? (
          <div 
            className="phurai-navbar__guest-wrap" 
            style={{ position: 'relative', display: 'flex', alignItems: 'center', marginLeft: '16px' }}
            onMouseEnter={() => setGuestDropdownOpen(true)}
            onMouseLeave={() => setGuestDropdownOpen(false)}
          >
            <button 
              type="button"
              className="phurai-navbar__avatar-btn"
              onClick={() => setGuestDropdownOpen(!guestDropdownOpen)}
              style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
            >
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: '#8c764b', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 'bold', fontSize: '16px'
              }}>
                G
              </div>
            </button>

            <div style={{
              position: 'absolute',
              top: 'calc(100% + 10px)',
              right: 0,
              width: '280px',
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '8px',
              padding: '16px',
              transition: 'all 0.3s ease',
              opacity: guestDropdownOpen ? 1 : 0,
              transform: guestDropdownOpen ? 'translateY(0)' : 'translateY(-10px)',
              pointerEvents: guestDropdownOpen ? 'auto' : 'none',
              zIndex: 1000,
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
            }}>
              <h4 style={{ color: '#fff', margin: '0 0 12px 0', fontSize: '16px', borderBottom: '1px solid #333', paddingBottom: '8px' }}>
                My Reservations
              </h4>
              {localReservations.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {localReservations.map((res, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: '#ccc', fontWeight: 'bold', fontSize: '14px' }}>{res.id}</span>
                        <span style={{ color: '#888', fontSize: '12px' }}>{res.date} • {res.time}</span>
                      </div>
                      <span style={{ 
                        fontSize: '12px', 
                        padding: '2px 8px', 
                        borderRadius: '12px', 
                        background: res.status === 'Pending' ? 'rgba(217, 119, 6, 0.2)' : 'rgba(140, 118, 75, 0.2)',
                        color: res.status === 'Pending' ? '#fbbf24' : '#8c764b'
                      }}>
                        {res.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>No recent reservations</p>
              )}
            </div>
          </div>
        ) : !isAuthenticated ? (
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
