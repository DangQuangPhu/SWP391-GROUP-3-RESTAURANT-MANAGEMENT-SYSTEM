import React, { useEffect, useRef } from "react";
import gsap from "gsap";

const CrownIcon = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
  </svg>
);

const StarIcon = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const CheckIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export default function UpgradeMembershipModal({
  isOpen,
  onClose,
  requiredTier,
  userTier,
  isAuthenticated,
  onNavigateLogin,
  onNavigateRegister,
  onNavigateUpgrade,
}) {
  const overlayRef = useRef(null);
  const modalRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      gsap.to(overlayRef.current, {
        autoAlpha: 1,
        duration: 0.22,
        ease: "power2.out",
      });
      gsap.fromTo(
        modalRef.current,
        { scale: 0.97, y: 8, autoAlpha: 0 },
        { scale: 1, y: 0, autoAlpha: 1, duration: 0.22, ease: "power2.out" }
      );
    } else {
      gsap.to(overlayRef.current, {
        autoAlpha: 0,
        duration: 0.2,
        ease: "power2.in",
      });
      gsap.to(modalRef.current, {
        scale: 0.97,
        y: 8,
        autoAlpha: 0,
        duration: 0.2,
        ease: "power2.in",
      });
    }
  }, [isOpen]);

  if (
    !isOpen &&
    (!overlayRef.current || gsap.getProperty(overlayRef.current, "opacity") === 0)
  ) {
    return null;
  }

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  const isDiamond = requiredTier === "Diamond";
  const isGold = requiredTier === "Gold";

  let title = "";
  let description = "";
  let benefits = [];
  let primaryCtaText = "";

  if (!isAuthenticated) {
    title = "Sign in to unlock premium dining";
    description =
      "Sign in to view membership plans and premium access details.";
    benefits = [
      { tier: "Silver", items: ["Rooftop / Outdoor table access", "Priority booking"] },
      { tier: "Gold", items: ["Premium Area access", "Complimentary dessert", "Early access to seasonal menus"] },
      { tier: "Diamond", items: ["VIP Lounge and Private Room access", "Exclusive tasting menus"] },
    ];
    primaryCtaText = "Sign In";
  } else if (isDiamond) {
    title = "Unlock the VIP experience with Diamond";
    description =
      "Diamond members enjoy access to VIP Lounge and Private Rooms, along with the highest level of dining service.";
    benefits = [
      {
        tier: "Diamond Benefits",
        items: [
          "VIP Lounge access",
          "Private Room access",
          "Highest booking priority",
          "Dedicated staff support",
          "Exclusive tasting menu access",
        ],
      },
    ];
    primaryCtaText = "Upgrade to Diamond";
  } else if (isGold) {
    title = "Upgrade to Gold to unlock Premium tables";
    description =
      "Gold members can reserve Premium tables and enjoy elevated dining benefits.";
    benefits = [
      {
        tier: "Gold Benefits",
        items: [
          "Premium Area access",
          "Priority table recommendations",
          "Complimentary dessert on eligible bookings",
          "Wine pairing offers",
          "Early access to seasonal menus",
        ],
      },
    ];
    primaryCtaText = "Upgrade to Gold";
  } else {
    title = `Upgrade to ${requiredTier}`;
    description = "Enjoy better tables and exclusive perks by upgrading your membership.";
    benefits = [];
    primaryCtaText = `Upgrade to ${requiredTier}`;
  }

  return (
    <div
      ref={overlayRef}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(26, 21, 18, 0.25)",
        backdropFilter: "blur(3px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        visibility: "hidden",
        opacity: 0,
      }}
      onClick={handleOverlayClick}
    >
      <div
        ref={modalRef}
        style={{
          background: "#FFFDF9",
          border: "1px solid #E6D7BE",
          borderRadius: "20px",
          width: "100%",
          maxWidth: "520px",
          padding: "32px",
          color: "#2A211B",
          boxShadow: "0 16px 40px rgba(26, 21, 18, 0.08)",
          visibility: "hidden",
          opacity: 0,
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* HEADER SECTION */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: "24px" }}>
          <div style={{ color: "#B8945B", marginBottom: "12px" }}>
            {isDiamond ? <CrownIcon /> : <StarIcon />}
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px 14px",
              borderRadius: "20px",
              backgroundColor: "rgba(184, 148, 91, 0.12)",
              border: "1px solid rgba(184, 148, 91, 0.25)",
              color: "#B8945B",
              fontSize: "0.75rem",
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              marginBottom: "16px",
            }}
          >
            {isDiamond ? "VIP Access" : "Premium Access"}
          </div>
          <h2 style={{ fontSize: "1.65rem", fontWeight: 500, margin: "0 0 12px 0", lineHeight: 1.2, color: "#2A211B" }}>
            {title}
          </h2>
          <p style={{ margin: 0, fontSize: "0.95rem", color: "#5C5146", lineHeight: 1.5, maxWidth: "420px" }}>
            {description}
          </p>
        </div>

        {/* TIER ROW */}
        {isAuthenticated && (
          <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "16px",
                backgroundColor: "#FAF6EF",
                border: "1px solid #E6D7BE",
                borderRadius: "12px",
              }}
            >
              <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#8A7C6B", marginBottom: "4px" }}>
                Current Tier
              </span>
              <span style={{ fontSize: "1.1rem", fontWeight: 500, color: "#5C5146" }}>
                {userTier}
              </span>
            </div>
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "16px",
                backgroundColor: "rgba(184, 148, 91, 0.05)",
                border: "1px solid rgba(184, 148, 91, 0.25)",
                borderRadius: "12px",
              }}
            >
              <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#B8945B", marginBottom: "4px" }}>
                Required Tier
              </span>
              <span style={{ fontSize: "1.1rem", fontWeight: 500, color: "#B8945B" }}>
                {requiredTier}
              </span>
            </div>
          </div>
        )}

        {/* BENEFITS SECTION */}
        <div style={{ marginBottom: "28px", padding: isAuthenticated ? "0 8px" : "0", flex: 1 }}>
          {benefits.map((b, i) => (
            <div key={i} style={{ marginBottom: isAuthenticated ? "0" : "16px" }}>
              <div
                style={{
                  fontSize: "0.85rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#8A7C6B",
                  marginBottom: "12px",
                  fontWeight: 600,
                }}
              >
                {b.tier}
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {b.items.map((item, idx) => (
                  <li
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      fontSize: "0.95rem",
                      color: "#5C5146",
                      marginBottom: "10px",
                      lineHeight: 1.5,
                    }}
                  >
                    <span style={{ color: "#B8945B", marginRight: "10px", marginTop: "2px" }}>
                      <CheckIcon />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* FOOTER / CTA SECTION */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {isAuthenticated && (
            <div style={{ textAlign: "center", marginBottom: "4px" }}>
              <span style={{ fontSize: "0.8rem", color: "#8A7C6B", fontStyle: "italic" }}>
                Membership pricing will be available soon.
              </span>
            </div>
          )}

          {!isAuthenticated ? (
            <>
              <button
                type="button"
                onClick={onNavigateLogin}
                style={{
                  width: "100%",
                  padding: "14px",
                  backgroundColor: "#B8945B",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "10px",
                  fontSize: "1rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background-color 0.2s ease",
                }}
                onMouseOver={(e) => (e.target.style.backgroundColor = "#c9a469")}
                onMouseOut={(e) => (e.target.style.backgroundColor = "#B8945B")}
              >
                {primaryCtaText}
              </button>
              <button
                type="button"
                onClick={onNavigateRegister}
                style={{
                  width: "100%",
                  padding: "14px",
                  backgroundColor: "transparent",
                  color: "#5C5146",
                  border: "1px solid #E6D7BE",
                  borderRadius: "10px",
                  fontSize: "1rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseOver={(e) => {
                  e.target.style.backgroundColor = "rgba(0,0,0,0.03)";
                  e.target.style.borderColor = "#c4b49b";
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = "transparent";
                  e.target.style.borderColor = "#E6D7BE";
                }}
              >
                Create Account
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onNavigateUpgrade}
                style={{
                  width: "100%",
                  padding: "14px",
                  backgroundColor: "#B8945B",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "10px",
                  fontSize: "1rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background-color 0.2s ease",
                }}
                onMouseOver={(e) => (e.target.style.backgroundColor = "#c9a469")}
                onMouseOut={(e) => (e.target.style.backgroundColor = "#B8945B")}
              >
                {primaryCtaText}
              </button>
              {userTier === "Gold" && requiredTier === "Diamond" && (
                <button
                  type="button"
                  style={{
                    width: "100%",
                    padding: "14px",
                    backgroundColor: "transparent",
                    color: "#5C5146",
                    border: "1px solid #E6D7BE",
                    borderRadius: "10px",
                    fontSize: "1rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseOver={(e) => {
                    e.target.style.backgroundColor = "rgba(0,0,0,0.03)";
                    e.target.style.borderColor = "#c4b49b";
                  }}
                  onMouseOut={(e) => {
                    e.target.style.backgroundColor = "transparent";
                    e.target.style.borderColor = "#E6D7BE";
                  }}
                >
                  Request VIP Access
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: "transparent",
              color: "#8A7C6B",
              border: "none",
              fontSize: "0.95rem",
              fontWeight: 500,
              cursor: "pointer",
              transition: "color 0.2s ease",
              marginTop: "4px"
            }}
            onMouseOver={(e) => (e.target.style.color = "#2A211B")}
            onMouseOut={(e) => (e.target.style.color = "#8A7C6B")}
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
