import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { MonitorSmartphone, CreditCard, LayoutDashboard, Gem } from "lucide-react";
import CustomerDashboard from "../components/CustomerDashboard";
import LoyaltyPointsPage from "@/features/loyalty/pages/LoyaltyPointsPage";
import { getProfilePayments } from "../services/profileApi.js";
import {
  getDisplayName,
  isValidVietnamPhone,
  normalizePhone,
} from "@/features/auth/utils/authHelpers.js";
import {
  OTP_EXPIRES_IN_SECONDS,
  OTP_RESEND_COOLDOWN_SECONDS,
  applyOtpSentTiming,
  formatOtpExpiry,
  resolveRetryAfterSeconds,
} from "@/features/auth/utils/otpTiming.js";
import UserAvatar from "@/features/auth/components/UserAvatar.jsx";
import OtpCodeInput from "@/features/auth/components/OtpCodeInput.jsx";
import AvatarPickerModal from "../components/AvatarPickerModal.jsx";
import AvatarPreviewModal from "../components/AvatarPreviewModal.jsx";
import PaymentDetailsModal from "../components/PaymentDetailsModal.jsx";
import AccountBackHome from "../components/AccountBackHome.jsx";
import PasswordAuthenticationPanel from "../components/PasswordAuthenticationPanel.jsx";
import { useAuth } from "@/features/auth/context/AuthContext.jsx";
import {
  changePassword,
  forgotPasswordRequestOtp,
  forgotPasswordVerifyOtp,
  forgotPasswordResendOtp,
  forgotPasswordReset,
} from "@/features/auth";
import { loadAuthUser } from "@/core/api";
import "@/styles/OtpCodeInput.css";
import "@/styles/profile.css";

const GENDERS = ["", "Male", "Female", "Other"];
const COUNTRIES = ["", "Vietnam", "United States", "United Kingdom", "Singapore", "Other"];
const LANGUAGES = ["", "English", "Vietnamese", "French", "Other"];

const FORM_FIELDS = [
  { key: "fullName", label: "Full Name", placeholder: "Your full name", type: "text" },
  { key: "username", label: "Username", placeholder: "Your username", type: "text" },
  { key: "gender", label: "Gender", placeholder: "Select gender", type: "select", options: GENDERS },
  { key: "country", label: "Country", placeholder: "Select country", type: "select", options: COUNTRIES },
  { key: "language", label: "Language", placeholder: "Select language", type: "select", options: LANGUAGES },
  {
    key: "dateOfBirth",
    label: "Date of Birth",
    placeholder: "Select your date of birth",
    type: "date",
  },
];

const COVER_THEMES = [
  {
    id: "blue-cream",
    label: "Blue Cream",
    gradient: "linear-gradient(90deg, #cfe6ff 0%, #f8f0d7 100%)",
  },
  {
    id: "warm-gold",
    label: "Warm Gold",
    gradient: "linear-gradient(90deg, #f3dfb2 0%, #fff5d8 100%)",
  },
  {
    id: "rose-beige",
    label: "Rose Beige",
    gradient: "linear-gradient(90deg, #f6d6d6 0%, #f7eadb 100%)",
  },
  {
    id: "matcha-green",
    label: "Matcha Green",
    gradient: "linear-gradient(90deg, #dcefd8 0%, #f5efd7 100%)",
  },
  {
    id: "lavender",
    label: "Lavender",
    gradient: "linear-gradient(90deg, #ded8ff 0%, #f8edf5 100%)",
  },
];

const getEmailPrefix = (email = "") => {
  return email.includes("@") ? email.split("@")[0] : email;
};

const resolveDisplayName = (profile = {}, user = {}) => {
  return (
    profile?.fullName ||
    user?.fullName ||
    user?.name ||
    user?.displayName ||
    getEmailPrefix(user?.email) ||
    "User"
  );
};

const resolveUsername = (profile = {}, user = {}) => {
  return (
    profile?.username ||
    user?.username ||
    user?.handle ||
    getEmailPrefix(user?.email) ||
    "user"
  );
};

const ProfileIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 12a4 4 0 1 0 0 -8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const AppearanceIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 3v2M12 19v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M3 12h2M19 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const AccessibilityIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="4" r="2" fill="currentColor" />
    <path
      d="M5 8h14M12 8v5M8 22l4-9 4 9M8.5 13h7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PasswordIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M7 10V7a5 5 0 0 1 10 0v3M6 10h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const DASHBOARD_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "loyalty", label: "Loyalty Points", icon: Gem },
  { key: "profile", label: "Profile", icon: ProfileIcon },
  { key: "appearance", label: "Appearance", icon: AppearanceIcon },
  { key: "accessibility", label: "Accessibility", icon: AccessibilityIcon },
  { key: "password", label: "Password & Authentication", icon: PasswordIcon },
  { key: "sessions", label: "Sessions", icon: MonitorSmartphone },
  { key: "payments", label: "Payment History", icon: CreditCard },
];

const SIDEBAR_ITEMS = DASHBOARD_ITEMS;

const getWelcomeName = (profile = {}, user = {}) => resolveDisplayName(profile, user);

function formatDateOfBirthDisplay(value) {
  if (!value) return "Not set";
  const parts = String(value).split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    if (year && month && day) {
      return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
    }
  }
  return value;
}

function formatPhoneDisplay(phone) {
  const digits = normalizePhone(phone);
  if (!digits) return "";
  if (digits.startsWith("84") && digits.length >= 11) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return String(phone).trim();
}

function ProfileContentSkeleton() {
  return (
    <div className="profile-content-skeleton" aria-hidden="true">
      <div className="profile-content-skeleton__row" />
      <div className="profile-content-skeleton__row" />
      <div className="profile-content-skeleton__row profile-content-skeleton__row--short" />
      <div className="profile-content-skeleton__block" />
    </div>
  );
}

function ProfileErrorBanner({ message, onRetry, retrying }) {
  return (
    <div className="profile-dashboard__error-card" role="alert">
      <p>{message}</p>
      <button
        type="button"
        className="profile-dashboard__btn profile-dashboard__btn--ghost"
        onClick={onRetry}
        disabled={retrying}
      >
        {retrying ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}

function getCoverGradient(themeId) {
  return COVER_THEMES.find((theme) => theme.id === themeId)?.gradient || COVER_THEMES[0].gradient;
}

function buildDraft(profile) {
  return {
    fullName: profile?.fullName || "",
    username: resolveUsername(profile, profile),
    email: profile?.email || "",
    gender: profile?.gender || "",
    country: profile?.country || "",
    language: profile?.language || "",
    dateOfBirth: profile?.dateOfBirth || profile?.dob || "",
    phone: profile?.phone || profile?.phoneNumber || "",
    address: profile?.address || "",
    bio: profile?.bio || "",
    preferences: Array.isArray(profile?.preferences) ? [...profile.preferences] : [],
    firstName: profile?.firstName || "",
    lastName: profile?.lastName || "",
    coverTheme: profile?.coverTheme || "blue-cream",
    reduceMotion: Boolean(profile?.reduceMotion),
    largerText: Boolean(profile?.largerText),
    highContrast: Boolean(profile?.highContrast),
  };
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 3a3.5 3.5 0 0 0 -3.5 3.5V9L5 12h10l-1.5-3V6.5A3.5 3.5 0 0 0 10 3z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8.5 14a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 7l7 4.5L17 7" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProfileAvatar({ user }) {
  return (
    <div className="profile-dashboard__profile-avatar-wrap">
      <UserAvatar
        user={user}
        size="lg"
        className="profile-dashboard__avatar-inner"
        imgClassName="profile-dashboard__profile-avatar"
      />
    </div>
  );
}

function ProfileField({ field, value, isEditing, onChange, error }) {
  const isDateField = field.key === "dateOfBirth";
  const displayValue = isDateField
    ? formatDateOfBirthDisplay(value)
    : value || "—";

  return (
    <div className="profile-dashboard__field">
      <label htmlFor={isEditing ? `profile-${field.key}` : undefined}>{field.label}</label>
      {isEditing ? (
        field.type === "select" ? (
          <select id={`profile-${field.key}`} value={value} onChange={onChange}>
            {field.options.map((opt) => (
              <option key={opt || "empty"} value={opt}>
                {opt || field.placeholder}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={`profile-${field.key}`}
            type={field.type}
            value={value}
            placeholder={field.placeholder}
            onChange={onChange}
            className={error ? "profile-dashboard__input--error" : ""}
            aria-invalid={Boolean(error)}
          />
        )
      ) : (
        <div className="profile-dashboard__field-value">{displayValue}</div>
      )}
      {isEditing && error ? (
        <span className="profile-dashboard__field-error">{error}</span>
      ) : null}
    </div>
  );
}

function AppearancePanel({ coverTheme, onSelectTheme }) {
  return (
    <div className="profile-dashboard__panel">
      <h3>Profile cover color</h3>
      <p className="profile-dashboard__panel-desc">Choose a color theme for your profile cover.</p>
      <div className="profile-dashboard__theme-grid">
        {COVER_THEMES.map((theme) => (
          <button
            key={theme.id}
            type="button"
            className={`profile-dashboard__theme-option${
              coverTheme === theme.id ? " is-active" : ""
            }`}
            onClick={() => onSelectTheme(theme.id)}
          >
            <span className="profile-dashboard__theme-swatch" style={{ background: theme.gradient }} />
            <span>{theme.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AccessibilityPanel({ prefs, onChange }) {
  return (
    <div className="profile-dashboard__panel">
      <h3>Accessibility preferences</h3>
      <label className="profile-dashboard__toggle">
        <input
          type="checkbox"
          checked={prefs.reduceMotion}
          onChange={(event) => onChange("reduceMotion", event.target.checked)}
        />
        <span>Reduce motion</span>
      </label>
      <label className="profile-dashboard__toggle">
        <input
          type="checkbox"
          checked={prefs.largerText}
          onChange={(event) => onChange("largerText", event.target.checked)}
        />
        <span>Larger text</span>
      </label>
      <label className="profile-dashboard__toggle">
        <input
          type="checkbox"
          checked={prefs.highContrast}
          onChange={(event) => onChange("highContrast", event.target.checked)}
        />
        <span>High contrast</span>
      </label>
    </div>
  );
}



function PreferencesPanel({ preferences = [], isEditing, onAdd, onRemove }) {
  const [draftPreference, setDraftPreference] = useState("");

  const handleAdd = () => {
    const value = draftPreference.trim();
    if (!value) return;
    onAdd?.(value);
    setDraftPreference("");
  };

  return (
    <section className="profile-dashboard__preferences">
      <h3 className="profile-gradient-title">Preferences</h3>
      <div className="profile-dashboard__preference-chips">
        {preferences.length ? (
          preferences.map((item) => (
            <span key={item} className="profile-dashboard__preference-chip">
              {item}
              {isEditing ? (
                <button
                  type="button"
                  className="profile-dashboard__preference-remove"
                  onClick={() => onRemove?.(item)}
                  aria-label={`Remove ${item}`}
                >
                  ×
                </button>
              ) : null}
            </span>
          ))
        ) : (
          <p className="profile-dashboard__preferences-empty">No preferences added yet.</p>
        )}
      </div>
      {isEditing ? (
        <div className="profile-dashboard__preference-add">
          <input
            type="text"
            value={draftPreference}
            placeholder="Add a preference"
            onChange={(event) => setDraftPreference(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleAdd();
              }
            }}
          />
          <button type="button" className="profile-dashboard__btn profile-dashboard__btn--ghost" onClick={handleAdd}>
            Add
          </button>
        </div>
      ) : null}
    </section>
  );
}

function SessionsPanel() {
  return (
    <div className="profile-dashboard__panel">
      <h3>Active sessions</h3>
      <div className="profile-dashboard__session-card">
        <p className="profile-dashboard__session-title">Current session</p>
        <p className="profile-dashboard__session-meta">This device · Active now</p>
      </div>
      <button type="button" className="profile-dashboard__btn profile-dashboard__btn--ghost" disabled>
        Sign out other sessions
      </button>
    </div>
  );
}

function PaymentHistoryPanel({ profile }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPaymentId, setSelectedPaymentId] = useState(null);

  useEffect(() => {
    let active = true;
    const loadPayments = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getProfilePayments(profile?.user_id || profile?.id);
        if (active) {
          setPayments(data);
        }
      } catch (err) {
        if (active) {
          setError("Failed to load payment history.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    if (profile?.user_id || profile?.id) {
      loadPayments();
    }
    return () => {
      active = false;
    };
  }, [profile]);

  const formatVND = (amount) => {
    return `${Math.round(amount).toLocaleString('vi-VN')} VND`;
  };

  return (
    <div className="profile-dashboard__panel">
      <h3>Payment History</h3>
      {loading ? (
        <p className="profile-dashboard__panel-desc">Loading your payments...</p>
      ) : error ? (
        <p className="profile-dashboard__panel-desc profile-dashboard__message--error">{error}</p>
      ) : payments.length === 0 ? (
        <div className="profile-dashboard__session-card">
          <p className="profile-dashboard__session-title">No recent payments</p>
          <p className="profile-dashboard__session-meta">Your payment history will appear here.</p>
        </div>
      ) : (
        <div className="profile-dashboard__payments-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {payments.map((p) => {
            const isRefund = p.payment_status === "Refunded";
            const amountColor = isRefund ? "var(--phurai-success, #34c759)" : "var(--phurai-text, #1d1d1f)";
            const sign = isRefund ? "+" : "-";
            
            return (
              <div 
                key={p.payment_id} 
                className="profile-dashboard__session-card" 
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                onClick={() => setSelectedPaymentId(p.payment_id)}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <div>
                  <p className="profile-dashboard__session-title">{p.payment_purpose}</p>
                  <p className="profile-dashboard__session-meta">
                    {p.paid_at || p.created_at ? format(new Date(p.paid_at || p.created_at), "MMM d, yyyy h:mm a") : "—"}
                    {p.transaction_ref ? ` • Ref: ${p.transaction_ref}` : ""}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p className="profile-dashboard__session-title" style={{ color: amountColor, fontWeight: 600 }}>
                    {sign}{formatVND(p.amount_paid)}
                  </p>
                  <p className="profile-dashboard__session-meta">
                    {p.payment_status}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      <PaymentDetailsModal
        isOpen={!!selectedPaymentId}
        onClose={() => setSelectedPaymentId(null)}
        userId={profile?.user_id || profile?.id}
        paymentId={selectedPaymentId}
      />
    </div>
  );
}

function ProfilePage({
  profile,
  profileLoading = false,
  profileError = null,
  onRetryProfile,
  onSaveProfile,
  onSavePhone,
  onSavePreferences,
  onApplyAvatar,
  initialEditMode = false,
  isAuthenticated,
  onNavigateLogin,
  onNavigateHome,
  onPasswordReset,
}) {
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isAvatarChooserOpen, setIsAvatarChooserOpen] = useState(false);
  const [isAvatarPreviewOpen, setIsAvatarPreviewOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const pathParts = location.pathname.split("/").filter(Boolean);
  let activePanel = "profile";
  if (pathParts[0] === "dashboard") {
    activePanel = "dashboard";
  } else if (pathParts.length > 1 && pathParts[1]) {
    activePanel = pathParts[1];
  }

  const [fieldErrors, setFieldErrors] = useState({});

  const handleEditAvatarClick = () => {
    setIsAvatarPreviewOpen(false);
    setIsAvatarChooserOpen(true);
  };

  const handleAvatarPreviewClick = () => {
    setIsAvatarChooserOpen(false);
    setIsAvatarPreviewOpen(true);
  };

  const handlePanelChange = useCallback((panelKey) => {
    if (panelKey === "dashboard") {
      navigate("/dashboard");
    } else if (panelKey === "profile") {
      navigate("/profile");
    } else {
      navigate(`/profile/${panelKey}`);
    }
  }, [navigate]);

  const fieldByKey = useMemo(
    () => Object.fromEntries(FORM_FIELDS.map((field) => [field.key, field])),
    []
  );

  const user = profile ?? {};
  const displayName = useMemo(
    () => resolveDisplayName(profile ?? {}, user),
    [profile]
  );
  const username = useMemo(
    () => resolveUsername(profile ?? {}, user),
    [profile]
  );
  const welcomeName = displayName;

  useEffect(() => {
    setIsEditing(initialEditMode);
  }, [initialEditMode]);

  useEffect(() => {
    if (!profile) return;
    setDraft((prev) => {
      if (prev && isEditing) return prev;
      return buildDraft(profile);
    });
  }, [profile, isEditing]);

  const handleRetryProfile = useCallback(async () => {
    if (!onRetryProfile) return;
    setRetrying(true);
    try {
      await onRetryProfile();
    } finally {
      setRetrying(false);
    }
  }, [onRetryProfile]);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(""), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  if (!isAuthenticated) {
    return (
      <main className="profile-page profile-page--empty">
        <AccountBackHome onNavigateHome={onNavigateHome} className="profile-page__back-home" />
        <div className="profile-page__empty-panel">
          <h1>My Profile</h1>
          <p>Sign in to view and edit your profile.</p>
          <button type="button" className="profile-dashboard__btn profile-dashboard__btn--primary" onClick={onNavigateLogin}>
            Sign in
          </button>
        </div>
      </main>
    );
  }

  const effectiveDraft = draft ?? (profile ? buildDraft(profile) : null);
  const isContentReady = Boolean(profile && effectiveDraft);
  const showSkeleton = profileLoading && !isContentReady;

  const email = profile?.email || effectiveDraft?.email || "";
  const phoneDisplay = formatPhoneDisplay(
    profile?.phone || profile?.phoneNumber || effectiveDraft?.phone
  );
  const coverGradient = getCoverGradient(
    effectiveDraft?.coverTheme || profile?.coverTheme || "blue-cream"
  );

  if (!profile) {
    return (
      <main className="profile-page profile-page--empty profile-shell-enter">
        <AccountBackHome onNavigateHome={onNavigateHome} className="profile-page__back-home" />
        <div className="profile-page__empty-panel">
          {showSkeleton ? <ProfileContentSkeleton /> : <p>Loading profile…</p>}
          {profileError ? (
            <ProfileErrorBanner
              message={profileError}
              onRetry={handleRetryProfile}
              retrying={retrying}
            />
          ) : null}
        </div>
      </main>
    );
  }

  const handleChange = (field) => (event) => {
    setDraft((prev) => {
      const base = prev ?? buildDraft(profile);
      return { ...base, [field]: event.target.value };
    });
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleCancel = () => {
    setDraft(buildDraft(profile));
    setIsEditing(false);
    setSuccessMessage("");
    setErrorMessage("");
    setFieldErrors({});
  };

  const handlePhoneUpdate = async (normalizedPhone) => {
    await onSavePhone?.(normalizedPhone);
    setSuccessMessage("Phone number updated successfully.");
  };

  const handleSave = async () => {
    if (!effectiveDraft) return;
    const phoneTrimmed = String(effectiveDraft.phone || "").trim();
    const nextFieldErrors = {};

    if (phoneTrimmed && !isValidVietnamPhone(phoneTrimmed)) {
      nextFieldErrors.phone = "Enter a valid phone number (10–11 digits).";
    }

    if (Object.keys(nextFieldErrors).length) {
      setFieldErrors(nextFieldErrors);
      setErrorMessage("Please fix the highlighted fields.");
      return;
    }

    try {
      setSaving(true);
      setErrorMessage("");
      setFieldErrors({});
      const payload = {
        ...effectiveDraft,
        phone: phoneTrimmed ? normalizePhone(phoneTrimmed) : "",
        phoneNumber: phoneTrimmed ? normalizePhone(phoneTrimmed) : "",
        preferences: effectiveDraft.preferences || [],
      };
      await onSaveProfile?.(payload);
      setIsEditing(false);
      setSuccessMessage("Profile saved successfully.");
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Profile save failed:", error);
      }
      const apiField = error?.data?.field;
      if (apiField === "phoneNumber" || apiField === "phone") {
        setFieldErrors({ phone: error?.message || "Phone number could not be saved." });
      }
      setErrorMessage(error?.message || "Could not save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSelectTheme = (themeId) => {
    setDraft((prev) => ({ ...(prev ?? buildDraft(profile)), coverTheme: themeId }));
    onSavePreferences?.({ coverTheme: themeId });
  };

  const handleAccessibilityChange = (key, value) => {
    setDraft((prev) => ({ ...(prev ?? buildDraft(profile)), [key]: value }));
    onSavePreferences?.({ [key]: value });
  };

  const handleAddPreference = (value) => {
    setDraft((prev) => {
      const base = prev ?? buildDraft(profile);
      const next = new Set([...(base.preferences || []), value]);
      return { ...base, preferences: Array.from(next) };
    });
  };

  const handleRemovePreference = (value) => {
    setDraft((prev) => {
      const base = prev ?? buildDraft(profile);
      return {
        ...base,
        preferences: (base.preferences || []).filter((item) => item !== value),
      };
    });
  };

  const renderPanelContent = () => {
    if (!effectiveDraft) {
      return <ProfileContentSkeleton />;
    }

    if (activePanel === "dashboard") {
      return <CustomerDashboard />;
    }

    if (activePanel === "loyalty") {
      return <LoyaltyPointsPage />;
    }

    if (activePanel === "appearance") {
      return (
        <AppearancePanel coverTheme={effectiveDraft.coverTheme} onSelectTheme={handleSelectTheme} />
      );
    }
    if (activePanel === "accessibility") {
      return (
        <AccessibilityPanel
          prefs={{
            reduceMotion: effectiveDraft.reduceMotion,
            largerText: effectiveDraft.largerText,
            highContrast: effectiveDraft.highContrast,
          }}
          onChange={handleAccessibilityChange}
        />
      );
    }
    if (activePanel === "password") {
      return (
        <PasswordAuthenticationPanel
          profile={profile}
          onPasswordReset={onPasswordReset}
          onPhoneUpdate={handlePhoneUpdate}
        />
      );
    }
    if (activePanel === "sessions") {
      return <SessionsPanel />;
    }
    if (activePanel === "payments") {
      return <PaymentHistoryPanel profile={profile} />;
    }

    return (
      <>
        <div className="profile-dashboard__form-grid">
          <ProfileField
            field={fieldByKey.fullName}
            value={effectiveDraft.fullName}
            isEditing={isEditing}
            onChange={handleChange("fullName")}
          />
          <ProfileField
            field={fieldByKey.username}
            value={effectiveDraft.username}
            isEditing={isEditing}
            onChange={handleChange("username")}
          />
          <ProfileField
            field={fieldByKey.gender}
            value={effectiveDraft.gender}
            isEditing={isEditing}
            onChange={handleChange("gender")}
          />
          <ProfileField
            field={fieldByKey.country}
            value={effectiveDraft.country}
            isEditing={isEditing}
            onChange={handleChange("country")}
          />
          <ProfileField
            field={fieldByKey.language}
            value={effectiveDraft.language}
            isEditing={isEditing}
            onChange={handleChange("language")}
          />
          <ProfileField
            field={fieldByKey.dateOfBirth}
            value={effectiveDraft.dateOfBirth}
            isEditing={isEditing}
            onChange={handleChange("dateOfBirth")}
          />

          <div className="profile-dashboard__field profile-dashboard__field--bio">
            <label htmlFor={isEditing ? "profile-bio" : undefined}>Bio</label>
            {isEditing ? (
              <textarea
                id="profile-bio"
                className="profile-dashboard__bio-textarea"
                rows={4}
                value={effectiveDraft.bio}
                placeholder="Tell us a little bit about yourself"
                onChange={handleChange("bio")}
              />
            ) : (
              <div className="profile-dashboard__field-value profile-dashboard__field-value--bio">
                {effectiveDraft.bio || "Tell us a little bit about yourself"}
              </div>
            )}
          </div>
        </div>

        <PreferencesPanel
          preferences={effectiveDraft.preferences || []}
          isEditing={isEditing}
          onAdd={handleAddPreference}
          onRemove={handleRemovePreference}
        />

        <section className="profile-dashboard__contact">
          <h3 className="profile-gradient-title">Contact</h3>
          <div className="profile-dashboard__contact-block">
            <p className="profile-dashboard__contact-label">My email address</p>
            <div className="profile-dashboard__email-row">
              <span className="profile-dashboard__email-icon">
                <MailIcon />
              </span>
              {email ? (
                <a className="profile-dashboard__email-text" href={`mailto:${email}`}>
                  {email}
                </a>
              ) : (
                <p className="profile-dashboard__email-text">—</p>
              )}
            </div>
          </div>
          <div className="profile-dashboard__contact-block">
            <p className="profile-dashboard__contact-label">My phone number</p>
            <div className="profile-dashboard__email-row">
              <span className="profile-dashboard__email-icon">
                <PhoneIcon />
              </span>
              <p className="profile-dashboard__email-text">
                {phoneDisplay || "No phone number added"}
              </p>
            </div>
          </div>
        </section>
      </>
    );
  };

  return (
    <main className="profile-page profile-shell-enter">
      <div className="profile-dashboard profile-sticky-card">
        <aside className="profile-dashboard__sidebar mac-animate animate-up sticky top-0 h-screen overflow-y-auto" style={{ "--delay": "0ms" }} aria-label="Profile navigation">
          <div className="profile-sidebar__home-wrapper">
            <AccountBackHome onNavigateHome={onNavigateHome} className="profile-page__back-home" />
          </div>
          {SIDEBAR_ITEMS.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                className={`profile-dashboard__nav-item${
                  activePanel === item.key ? " is-active" : ""
                } mac-animate animate-up`}
                style={{ "--delay": `${(index + 1) * 50}ms` }}
                onClick={() => handlePanelChange(item.key)}
              >
                <span className="profile-dashboard__nav-icon">
                  <Icon />
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </aside>

        <div className="profile-dashboard__main">
          <header className="profile-dashboard__top">
            <div className="profile-dashboard__welcome">
              <h1 className="profile-gradient-title">Welcome, {welcomeName}</h1>
            </div>

            <div className="profile-dashboard__top-actions">
              <label className="profile-dashboard__search">
                <SearchIcon />
                <input
                  type="search"
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  aria-label="Search profile"
                />
              </label>
              <button type="button" className="profile-dashboard__icon-btn" aria-label="Notifications">
                <BellIcon />
              </button>
            </div>
          </header>

          {successMessage ? (
            <p className="profile-dashboard__message profile-dashboard__message--success">
              {successMessage}
            </p>
          ) : null}
          {errorMessage ? (
            <p className="profile-dashboard__message profile-dashboard__message--error">{errorMessage}</p>
          ) : null}

          {profileError ? (
            <ProfileErrorBanner
              message={profileError}
              onRetry={handleRetryProfile}
              retrying={retrying}
            />
          ) : null}

          <div className={`profile-dashboard__content ${activePanel === "dashboard" ? "flex flex-col h-full overflow-hidden" : ""}`}>
            <article className={`profile-dashboard__card mac-animate animate-scale ${activePanel === "dashboard" ? "flex flex-col h-full overflow-hidden flex-1 min-h-0" : ""}`} style={{ "--delay": "100ms" }}>
            {activePanel !== "dashboard" && (
              <div
                className="profile-dashboard__cover"
                style={{ background: coverGradient }}
                aria-hidden="true"
              />
            )}

            {activePanel !== "dashboard" && (
              <div
                className="profile-dashboard__profile-header"
                style={{ background: `linear-gradient(180deg, transparent 0%, #ffffff 100%)` }}
              >
                <div className="profile-dashboard__avatar-block">
                <button
                  type="button"
                  className="profile-dashboard__avatar-btn profile-dashboard__avatar-btn--preview"
                  onClick={handleAvatarPreviewClick}
                  aria-label="View profile avatar"
                >
                  <ProfileAvatar user={profile} />
                </button>
                {isEditing ? (
                  <button
                    type="button"
                    className="profile-dashboard__avatar-edit"
                    onClick={handleEditAvatarClick}
                  >
                    Edit avatar
                  </button>
                ) : null}
              </div>

              <div className="profile-dashboard__identity mac-animate animate-up" style={{ "--delay": "200ms" }}>
                <h1 className="profile-dashboard__name">
                  {welcomeName}
                </h1>
              </div>

              {activePanel === "profile" ? (
                <div className="profile-dashboard__header-actions">
                  {!isEditing ? (
                    <button
                      type="button"
                      className="profile-dashboard__btn profile-dashboard__btn--primary"
                      onClick={() => setIsEditing(true)}
                    >
                      Edit
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="profile-dashboard__btn profile-dashboard__btn--ghost"
                        onClick={handleCancel}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="profile-dashboard__btn profile-dashboard__btn--primary"
                        onClick={handleSave}
                        disabled={saving}
                      >
                        {saving ? "Saving…" : "Save changes"}
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </div>
            )}

            <div className={`profile-dashboard__card-body ${activePanel === "dashboard" ? "p-0 flex-1 flex flex-col min-h-0 overflow-hidden" : ""}`}>
              <div key={activePanel} className={`profile-content-panel mac-animate animate-up ${activePanel === "dashboard" ? "flex-1 flex flex-col min-h-0 overflow-hidden" : ""}`} style={{ "--delay": "250ms" }}>
                {showSkeleton ? <ProfileContentSkeleton /> : renderPanelContent()}
              </div>
            </div>
          </article>
          </div>
        </div>
      </div>

      <AvatarPickerModal
        isOpen={isAvatarChooserOpen}
        onClose={() => setIsAvatarChooserOpen(false)}
        user={profile}
        onSave={onApplyAvatar}
      />
      <AvatarPreviewModal
        isOpen={isAvatarPreviewOpen}
        onClose={() => setIsAvatarPreviewOpen(false)}
        user={profile}
      />
    </main>
  );
}

export default ProfilePage;
