import React from "react";
import notFoundImage from "@/assets/images/fork-near-plate-with-twig.jpg";
import "@/styles/notFound.css";

function HomeIcon() {
  return (
    <svg
      className="not-found-page__button-icon"
      viewBox="0 0 12 14"
      width="12"
      height="14"
      aria-hidden="true"
    >
      <path fill="currentColor" d="M6 0.75 0.75 6v7.25H4V9.25h4V13.25h3.25V6L6 0.75Z" />
    </svg>
  );
}

function getErrorContent({ pathname = "", currentUser, isAuthenticated }) {
  const role = currentUser?.roleName || currentUser?.role || "Guest";
  const lowerPath = pathname.toLowerCase();

  const isAdminRoute = lowerPath.startsWith("/admin");
  const isManagerRoute = lowerPath.startsWith("/manager");
  const isStaffRoute = lowerPath.startsWith("/staff");
  const isRestrictedRoute = isAdminRoute || isManagerRoute || isStaffRoute;

  const isOldManagementRoute =
    lowerPath.includes("wp-admin") ||
    lowerPath.includes("admin-login") ||
    lowerPath.includes("old-admin") ||
    lowerPath.includes("dashboard-old") ||
    lowerPath.includes("cms") ||
    lowerPath.includes("backend");

  if (isOldManagementRoute) {
    return {
      type: "old-management-link",
      title: "Management Link Not Found",
      subtitle: "This management path is no longer available.",
      description: "You may be using an old domain, an outdated admin link, or a bookmarked management URL. Please use the current Phūrai sign-in page or return to the main website.",
      primaryAction: { label: "Go to Sign In", target: "login" },
      secondaryAction: { label: "Back to Home", target: "home" },
    };
  }

  if (isRestrictedRoute && !isAuthenticated) {
    return {
      type: "guest-restricted",
      title: "Restricted Area",
      subtitle: "This section is reserved for authorized Phūrai team members.",
      description: isStaffRoute
        ? "The staff portal is for restaurant and kitchen team members. Please sign in with an authorized staff account to manage the reservation queue."
        : "You may have opened an old management link, changed the URL manually, or tried to access a manager-only workspace. Please sign in with an authorized account to continue.",
      helperText: "If you are a customer, please use the reservation and dining features from the main website.",
      primaryAction: {
        label: isStaffRoute ? "Staff Sign In" : "Manager Sign In",
        target: "login",
      },
      secondaryAction: { label: "Back to Home", target: "home" },
    };
  }

  if (isRestrictedRoute && role === "Customer") {
    return {
      type: "customer-restricted",
      title: "Access Not Allowed",
      subtitle: "Your customer account cannot access this workspace.",
      description: isStaffRoute
        ? "The staff portal is for restaurant and kitchen team members. Customer accounts can manage reservations, view booking history, order from the menu, and update profile information."
        : "This page belongs to the internal restaurant management system. Customer accounts can manage reservations, view booking history, order from the menu, and update profile information, but cannot access manager or admin tools.",
      primaryAction: { label: "Go to My Reservations", target: "myReservations" },
      secondaryAction: { label: "Back to Home", target: "home" },
      tertiaryAction: { label: "Switch Account", target: "login" },
    };
  }

  if ((isAdminRoute || isManagerRoute) && role === "Staff") {
    return {
      type: "manager-permission-required",
      title: "Permission Required",
      subtitle: "Your account does not have permission to open this page.",
      description: "This area requires a manager or admin account. Please contact your manager if you believe you should have access.",
      primaryAction: { label: "Go to Manager Dashboard", target: "manager" },
      secondaryAction: { label: "Back to Home", target: "home" },
    };
  }

  if (isAdminRoute && role === "Manager") {
    return {
      type: "admin-permission-required",
      title: "Admin Permission Required",
      subtitle: "This page is only available to system administrators.",
      description: "Managers can manage restaurant operations, reports, staff scheduling, reservations, menu items, vouchers, and inventory, but cannot access system-level admin controls.",
      primaryAction: { label: "Go to Manager Dashboard", target: "manager" },
      secondaryAction: { label: "Back to Home", target: "home" },
    };
  }

  return {
    type: "normal-404",
    title: "404",
    subtitle: "This page is not available",
    description: "The page you are looking for may have been moved, removed, or is no longer being served. Let us guide you back to the main floor.",
    primaryAction: { label: "Back to Home", target: "home" },
  };
}

function NotFound({ onNavigate, pathname = "", currentUser, isAuthenticated }) {
  const navigate = (page) => {
    if (typeof onNavigate === "function") {
      onNavigate(page);
      return;
    }

    const paths = {
      home: "/",
      menus: "/menus",
      reservation: "/",
      login: "/login",
      myReservations: "/my-reservations",
      manager: "/manager",
      staff: "/staff",
    };
    window.location.href = paths[page] || "/";
  };

  const content = getErrorContent({ pathname, currentUser, isAuthenticated });

  return (
    <main className="not-found-page" aria-labelledby="not-found-heading">
      <div className="not-found-page__hero">
        <div className="not-found-page__visual">
          <img
            src={notFoundImage}
            alt=""
            className="not-found-page__image"
            loading="eager"
            decoding="async"
          />
          <div className="not-found-page__overlay" aria-hidden="true" />
        </div>

        <div className="not-found-page__content">
          <div className="not-found-page__inner">
            <div className="not-found-page__code-wrap" aria-hidden="true">
              <span className="not-found-page__code" style={{ fontSize: content.title.length > 5 ? "1.2rem" : undefined, letterSpacing: content.title.length > 5 ? "0.1em" : undefined, padding: content.title.length > 5 ? "8px 16px" : undefined }}>
                {content.title}
              </span>
            </div>

            <h1 id="not-found-heading" className="not-found-page__title">
              {content.subtitle.toUpperCase()}
            </h1>

            <div className="not-found-page__divider" role="presentation" />

            <p className="not-found-page__description">
              {content.description}
            </p>
            
            {content.helperText && (
              <p className="not-found-page__description" style={{ fontSize: "0.85rem", opacity: 0.7, marginTop: "-10px", marginBottom: "30px" }}>
                {content.helperText}
              </p>
            )}

            <div className="not-found-page__actions" style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
              {content.primaryAction && (
                <button
                  type="button"
                  className="not-found-page__button not-found-page__button--primary"
                  onClick={() => navigate(content.primaryAction.target)}
                >
                  {content.primaryAction.target === "home" && <HomeIcon />}
                  <span>{content.primaryAction.label.toUpperCase()}</span>
                </button>
              )}

              {content.secondaryAction && (
                <button
                  type="button"
                  className="not-found-page__button"
                  onClick={() => navigate(content.secondaryAction.target)}
                  style={{ backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }}
                >
                  {content.secondaryAction.target === "home" && <HomeIcon />}
                  <span>{content.secondaryAction.label.toUpperCase()}</span>
                </button>
              )}
              
              {content.tertiaryAction && (
                <button
                  type="button"
                  className="not-found-page__button"
                  onClick={() => navigate(content.tertiaryAction.target)}
                  style={{ backgroundColor: "transparent", border: "none", color: "var(--rzv-gold, #BCA995)", padding: "0 1rem", textDecoration: "underline" }}
                >
                  <span>{content.tertiaryAction.label}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default NotFound;
