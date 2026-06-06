import { useState } from "react";
import UserAvatar from "../../components/auth/UserAvatar";
import AvatarPickerModal from "../../components/account/AvatarPickerModal";
import AccountBackHome from "../../components/account/AccountBackHome";
import { getDisplayName } from "../../components/auth/authHelpers";
import "./Settings.css";
import "./accountShared.css";

const MAIN_ITEMS = [
  { id: "profile", label: "Public profile", path: "/settings/profile", icon: "user" },
  { id: "account", label: "Account", path: "/settings/account", icon: "gear" },
  { id: "appearance", label: "Appearance", path: "/settings/appearance", icon: "brush" },
  { id: "accessibility", label: "Accessibility", path: "/settings/accessibility", icon: "accessibility" },
  { id: "notifications", label: "Notifications", path: "/settings/notifications", icon: "bell" },
];

const BILLING_ITEMS = [
  { id: "billing-overview", label: "Overview", path: "/settings/billing/overview" },
  { id: "billing-usage", label: "Usage", path: "/settings/billing/usage" },
  { id: "billing-ai", label: "AI usage", path: "/settings/billing/ai-usage" },
  { id: "billing-budgets", label: "Budgets and alerts", path: "/settings/billing/budgets-and-alerts" },
  { id: "billing-licensing", label: "Licensing", path: "/settings/billing/licensing" },
  { id: "billing-payment", label: "Payment information", path: "/settings/billing/payment-information" },
  { id: "billing-history", label: "Payment history", path: "/settings/billing/payment-history" },
  {
    id: "billing-details",
    label: "Additional billing details",
    path: "/settings/billing/additional-billing-details",
  },
  { id: "billing-education", label: "Education benefits", path: "/settings/billing/education-benefits" },
];

const ACCESS_ITEMS = [
  { id: "emails", label: "Emails", path: "/settings/emails", icon: "mail" },
  { id: "password-authentication", label: "Password and authentication", path: "/settings/password-authentication", icon: "lock" },
  { id: "sessions", label: "Sessions", path: "/settings/sessions", icon: "session" },
];

function SettingsNavIcon({ name }) {
  const icons = {
    user: (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 17c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    gear: (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 2.5v2M10 15.5v2M4.5 10h-2M17.5 10h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    brush: (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M4 16l8-8 4 4-8 8H4v-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
    accessibility: (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="4.5" r="1.5" fill="currentColor" />
        <path d="M6 7h8M10 7v5M8 16l2-4 2 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    bell: (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 3a4 4 0 00-4 4v2.5L5 12h10l-1-2.5V7a4 4 0 00-4-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8.5 14a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    card: (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 8h14" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    mail: (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 6l7 5 7-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
    lock: (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="4" y="9" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 9V7a3 3 0 116 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    session: (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 2v2M10 16v2M2 10h2M16 10h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  };
  return <span className="settings-page__nav-icon">{icons[name] || icons.gear}</span>;
}

function resolveSection(pathname) {
  const allItems = [...MAIN_ITEMS, ...ACCESS_ITEMS, ...BILLING_ITEMS];
  const exact = allItems.find((item) => item.path === pathname);
  if (exact) return exact.id;
  if (pathname === "/settings" || pathname === "/settings/") return "profile";
  return "profile";
}

function SettingsPanel({ section, profile, onOpenChangePassword, onOpenAvatarPicker }) {
  const displayName = getDisplayName(profile);

  if (section === "profile") {
    return (
      <div className="settings-panel">
        <div className="settings-panel__row">
          <label htmlFor="settings-name">Name</label>
          <input id="settings-name" type="text" defaultValue={displayName} readOnly />
        </div>
        <div className="settings-panel__row">
          <label htmlFor="settings-public-email">Public email</label>
          <select id="settings-public-email" defaultValue={profile?.email || ""}>
            <option value={profile?.email || ""}>{profile?.email || "No email"}</option>
          </select>
        </div>
        <div className="settings-panel__row">
          <label htmlFor="settings-bio">Bio</label>
          <textarea id="settings-bio" rows={4} defaultValue={profile?.bio || ""} placeholder="Tell us about yourself" />
        </div>
        <div className="settings-panel__avatar-row">
          <UserAvatar user={profile} size="md" />
          <button type="button" className="settings-page__cta" onClick={onOpenAvatarPicker}>
            Edit avatar
          </button>
        </div>
      </div>
    );
  }

  if (section === "account") {
    return (
      <div className="settings-panel">
        <div className="settings-panel__row">
          <label>Username</label>
          <input type="text" defaultValue={profile?.username || ""} readOnly />
        </div>
        <div className="settings-panel__row">
          <label>Email</label>
          <input type="email" defaultValue={profile?.email || ""} readOnly />
        </div>
        <div className="settings-panel__row">
          <label>Account type</label>
          <input type="text" defaultValue={profile?.authProvider === "google" ? "Google" : "Email"} readOnly />
        </div>
        <div className="settings-panel__danger">
          <h3>Delete account</h3>
          <p>Account deletion is not available in this demo environment.</p>
        </div>
      </div>
    );
  }

  if (section === "appearance") {
    return (
      <div className="settings-panel">
        <div className="settings-panel__row">
          <label htmlFor="settings-theme">Theme</label>
          <select id="settings-theme" defaultValue="system">
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </div>
      </div>
    );
  }

  if (section === "accessibility") {
    return (
      <div className="settings-panel">
        <label className="settings-panel__checkbox">
          <input type="checkbox" />
          <span>Reduce motion</span>
        </label>
        <div className="settings-panel__row">
          <label htmlFor="settings-font">Font size</label>
          <select id="settings-font" defaultValue="default">
            <option value="default">Default</option>
            <option value="large">Large</option>
          </select>
        </div>
        <label className="settings-panel__checkbox">
          <input type="checkbox" />
          <span>High contrast</span>
        </label>
      </div>
    );
  }

  if (section === "notifications") {
    return (
      <div className="settings-panel">
        <label className="settings-panel__checkbox">
          <input type="checkbox" defaultChecked />
          <span>Email notifications</span>
        </label>
        <label className="settings-panel__checkbox">
          <input type="checkbox" defaultChecked />
          <span>Reservation updates</span>
        </label>
        <label className="settings-panel__checkbox">
          <input type="checkbox" />
          <span>Promotions and offers</span>
        </label>
      </div>
    );
  }

  if (section === "emails") {
    return (
      <div className="settings-panel">
        <div className="settings-panel__row">
          <label>Primary email</label>
          <input type="email" defaultValue={profile?.email || ""} readOnly />
        </div>
        <button type="button" className="settings-page__cta settings-page__cta--ghost" disabled>
          Add email address
        </button>
      </div>
    );
  }

  if (section === "password-authentication") {
    return (
      <div className="settings-panel">
        <button type="button" className="settings-page__cta" onClick={onOpenChangePassword}>
          Change password
        </button>
        <div className="settings-panel__note">
          <p>Two-factor authentication setup will be available in a future release.</p>
        </div>
      </div>
    );
  }

  if (section === "sessions") {
    return (
      <div className="settings-panel">
        <div className="settings-panel__session">
          <p className="settings-panel__session-title">Current session</p>
          <p className="settings-panel__session-meta">This device · Active now</p>
        </div>
        <button type="button" className="settings-page__cta settings-page__cta--ghost" disabled>
          Sign out other sessions
        </button>
      </div>
    );
  }

  if (section.startsWith("billing-")) {
    const titles = {
      "billing-overview": "Billing overview",
      "billing-usage": "Usage",
      "billing-ai": "AI usage",
      "billing-budgets": "Budgets and alerts",
      "billing-licensing": "Licensing",
      "billing-payment": "Payment information",
      "billing-history": "Payment history",
      "billing-details": "Additional billing details",
      "billing-education": "Education benefits",
    };
    return (
      <div className="settings-panel settings-panel--placeholder">
        <p>{titles[section] || "Billing"} details will appear here when billing is connected.</p>
      </div>
    );
  }

  return null;
}

function SettingsPage({
  profile,
  pathname,
  onNavigatePath,
  isAuthenticated,
  onNavigateLogin,
  onNavigateHome,
  onOpenChangePassword,
  onApplyAvatar,
}) {
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const section = resolveSection(pathname);

  const panelTitles = {
    profile: "Public profile",
    account: "Account",
    appearance: "Appearance",
    accessibility: "Accessibility",
    notifications: "Notifications",
    emails: "Emails",
    "password-authentication": "Password and authentication",
    sessions: "Sessions",
    "billing-overview": "Billing overview",
    "billing-usage": "Usage",
    "billing-ai": "AI usage",
    "billing-budgets": "Budgets and alerts",
    "billing-licensing": "Licensing",
    "billing-payment": "Payment information",
    "billing-history": "Payment history",
    "billing-details": "Additional billing details",
    "billing-education": "Education benefits",
  };

  if (!isAuthenticated) {
    return (
      <main className="settings-page settings-page--empty">
        <AccountBackHome onNavigateHome={onNavigateHome} className="settings-page__back-home" />
        <div className="settings-page__empty-panel">
          <h1>Settings</h1>
          <p>Sign in to manage your account settings.</p>
          <button type="button" className="settings-page__cta" onClick={onNavigateLogin}>
            Sign in
          </button>
        </div>
      </main>
    );
  }

  const displayName = getDisplayName(profile);

  const renderNavButton = (item, iconName) => (
    <button
      key={item.id}
      type="button"
      className={`settings-page__nav-item${section === item.id ? " is-active" : ""}`}
      onClick={() => onNavigatePath?.(item.path)}
    >
      <SettingsNavIcon name={iconName || item.icon || "gear"} />
      <span>{item.label}</span>
    </button>
  );

  return (
    <main className="settings-page">
      <AccountBackHome onNavigateHome={onNavigateHome} className="settings-page__back-home" />

      <div className="settings-page__layout">
        <aside className="settings-page__sidebar">
          <div className="settings-page__user">
            <UserAvatar user={profile} size="md" />
            <div>
              <p className="settings-page__user-name">{displayName}</p>
              <p className="settings-page__user-handle">@{profile?.username}</p>
              <p className="settings-page__user-caption">Your personal account</p>
            </div>
          </div>

          <nav className="settings-page__nav" aria-label="Settings">
            {MAIN_ITEMS.map((item) => renderNavButton(item))}

            <p className="settings-page__nav-heading">Access</p>
            {ACCESS_ITEMS.map((item) => renderNavButton(item))}

            <p className="settings-page__nav-heading">Billing and licensing</p>
            {BILLING_ITEMS.map((item) => renderNavButton(item, "card"))}
          </nav>
        </aside>

        <section className="settings-page__content">
          <h1>{panelTitles[section] || "Settings"}</h1>
          <SettingsPanel
            section={section}
            profile={profile}
            onOpenChangePassword={onOpenChangePassword}
            onOpenAvatarPicker={() => setShowAvatarPicker(true)}
          />
        </section>
      </div>

      <AvatarPickerModal
        isOpen={showAvatarPicker}
        onClose={() => setShowAvatarPicker(false)}
        user={profile}
        onSave={onApplyAvatar}
      />
    </main>
  );
}

export default SettingsPage;

export { resolveSection };
