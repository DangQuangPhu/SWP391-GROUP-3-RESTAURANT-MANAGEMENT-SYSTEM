import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { MonitorSmartphone, CreditCard, LayoutDashboard, Gem, ArrowDownLeft, ArrowUpRight, X } from "lucide-react";
import CustomerDashboard from "../components/CustomerDashboard";
import LoyaltyPointsPage from "@/features/loyalty/pages/LoyaltyPointsPage";
import { useFavoritesStore } from "@/features/menu/context/MenuFavoritesContext.jsx";
import MenuImagePreview from "@/features/menu/components/MenuImagePreview.jsx";
import { resolveDishImage } from "@/features/menu/data/menuAssets.js";
import CustomerNotificationBell from "@/components/notifications/CustomerNotificationBell.jsx";



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
import "@/features/auth/styles/OtpCodeInput.css";
import "@/features/profile/styles/profile.css";

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

const BookmarkSidebarIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M5 4.5C5 3.67 5.67 3 6.5 3h11C18.33 3 19 3.67 19 4.5v15.75l-7-3.89L5 20.25V4.5z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);

const DASHBOARD_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "loyalty", label: "Loyalty Points", icon: Gem, customerOnly: true },
  { key: "favorites", label: "My Favorites", icon: BookmarkSidebarIcon, customerOnly: true },
  { key: "profile", label: "Profile", icon: ProfileIcon },
  { key: "appearance", label: "Appearance", icon: AppearanceIcon },
  { key: "accessibility", label: "Accessibility", icon: AccessibilityIcon },
  { key: "password", label: "Password & Authentication", icon: PasswordIcon },
  { key: "sessions", label: "Sessions", icon: MonitorSmartphone },
  { key: "payments", label: "Payment History", icon: CreditCard, customerOnly: true },
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

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
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

function ProfileField({ field, value, isEditing, onChange, error, disabled }) {
  const isDateField = field.key === "dateOfBirth";
  const displayValue = isDateField
    ? formatDateOfBirthDisplay(value)
    : value || "—";

  return (
    <div className="profile-dashboard__field">
      <label htmlFor={isEditing ? `profile-${field.key}` : undefined}>{field.label}</label>
      {isEditing ? (
        field.type === "select" ? (
          <select id={`profile-${field.key}`} value={value} onChange={onChange} disabled={disabled}>
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
            disabled={disabled}
            className={`${error ? "profile-dashboard__input--error" : ""} ${disabled ? "opacity-50 cursor-not-allowed bg-gray-50" : ""}`}
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

  const getStatusBadge = (status) => {
    const isSuccess = status === "Completed" || status === "Paid" || status === "Successful" || status === "Served";
    const label = isSuccess ? "Successful" : "Failed";
    const badgeClass = isSuccess 
      ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
      : "bg-rose-50 text-rose-700 border-rose-100";
    const dotClass = isSuccess ? "ripple-dot--success" : "ripple-dot--failed";

    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeClass}`}>
        <span className={`ripple-dot ${dotClass}`} />
        <span>{label}</span>
      </div>
    );
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
        <div className="profile-dashboard__payments-list">
          {payments.map((p) => {
            const isRefund = p.payment_status === "Refunded";
            const isSuccess = p.payment_status === "Completed" || p.payment_status === "Paid" || p.payment_status === "Successful" || p.payment_status === "Served";
            const isFailed = !isSuccess && !isRefund;
            const amountColor = isRefund ? "var(--phurai-success, #10b981)" : (isFailed ? "var(--phurai-danger, #ef4444)" : "var(--phurai-text, #1d1d1f)");
            const sign = isRefund ? "+" : "-";
            
            const iconBg = isFailed
              ? 'bg-red-50 text-red-600'
              : (isRefund ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-500');

            return (
              <div 
                key={p.payment_id} 
                className="profile-dashboard__payment-card" 
                onClick={() => setSelectedPaymentId(p.payment_id)}
              >
                {/* Icon Column */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-none ${iconBg}`}>
                  {isFailed ? (
                    <X size={20} strokeWidth={2.5} />
                  ) : isRefund ? (
                    <ArrowDownLeft size={20} strokeWidth={2.5} />
                  ) : (
                    <ArrowUpRight size={20} strokeWidth={2.5} />
                  )}
                </div>

                {/* Purpose & Date Column */}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate m-0">{p.payment_purpose || "Order Payment"}</p>
                  <p className="text-xs text-gray-500 m-0 mt-1">
                    {p.paid_at || p.created_at ? format(new Date(p.paid_at || p.created_at), "MMM d, yyyy h:mm a") : "—"}
                    {p.transaction_ref ? ` • Ref: ${p.transaction_ref}` : ""}
                  </p>
                </div>

                {/* Status Badge Column */}
                <div className="flex items-center flex-none">
                  {getStatusBadge(p.payment_status)}
                </div>

                {/* Amount Column */}
                <div className="text-right pl-4 flex-none min-w-[120px]">
                  <p className="text-base font-bold m-0" style={{ color: amountColor }}>
                    {sign}{formatVND(p.amount_paid)}
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

function FavoritesProfilePanel({ currentUser }) {
  const { favorites, removeFavorite } = useFavoritesStore(currentUser);
  const [searchTerm, setSearchTerm] = useState("");
  const [previewDish, setPreviewDish] = useState(null);

  const FALLBACK = '/src/assets/images/menu/dish-sushi-sashimi.jpg';

  const filteredFavorites = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    if (!query) return favorites;
    return favorites.filter((dish) =>
      (dish.name || '').toLowerCase().includes(query) ||
      (dish.description || '').toLowerCase().includes(query)
    );
  }, [favorites, searchTerm]);

  if (favorites.length === 0) {
    return (
      <div className="profile-favorites__empty-container">
        <svg viewBox="0 0 24 24" fill="none" className="profile-favorites__empty-svg">
          <path d="M5 4.5C5 3.67 5.67 3 6.5 3h11C18.33 3 19 3.67 19 4.5v15.75l-7-3.89L5 20.25V4.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
        <p className="profile-favorites__empty-title">No favorites yet</p>
        <p className="profile-favorites__empty-subtitle">Browse the menu and tap the bookmark icon to save your favorite dishes here.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="profile-dashboard__section-header" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 className="profile-favorites__title">My Favorites</h2>
          <p className="profile-favorites__subtitle">{favorites.length} saved {favorites.length === 1 ? 'dish' : 'dishes'}</p>
        </div>

        {/* Filter Search Bar in Profile */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search saved dishes..."
            style={{
              width: '100%',
              padding: '9px 14px 9px 36px',
              borderRadius: '9999px',
              border: '1px solid #e0d8cd',
              background: '#ffffff',
              fontSize: '0.85rem',
              color: '#342716',
              outline: 'none',
              fontFamily: "'Hanken Grotesk', system-ui, sans-serif"
            }}
          />
          <svg
            viewBox="0 0 20 20"
            fill="none"
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '16px',
              height: '16px',
              color: '#9b845e',
              pointerEvents: 'none'
            }}
          >
            <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {filteredFavorites.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 16px', color: '#8c7d6c', fontFamily: "'Hanken Grotesk', system-ui, sans-serif" }}>
          <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>No matching favorites found for "{searchTerm}".</p>
        </div>
      ) : (
        <div className="profile-favorites__grid">
          {filteredFavorites.map((dish) => (
            <div
              key={dish.id ?? dish.dish_id}
              className="profile-favorites__card"
            >
              <img
                src={resolveDishImage(dish.image) || FALLBACK}
                alt={dish.name}
                onClick={() => setPreviewDish({ ...dish, image: resolveDishImage(dish.image) })}
                onError={(e) => { e.currentTarget.src = FALLBACK; }}
                className="profile-favorites__img"
                style={{ cursor: 'zoom-in' }}
              />
              <div className="profile-favorites__info" onClick={() => setPreviewDish({ ...dish, image: resolveDishImage(dish.image) })} style={{ cursor: 'pointer' }}>

                <p className="profile-favorites__name">
                  {dish.name}
                </p>
                {/* Note: Price omitted in Profile view per requirements */}
              </div>
              <button
                type="button"
                onClick={() => removeFavorite(dish.id ?? dish.dish_id)}
                aria-label={`Remove ${dish.name} from favorites`}
                className="profile-favorites__btn-delete"
              >
                <svg viewBox="0 0 16 16" fill="none" className="profile-favorites__btn-delete-svg">
                  <path d="M2 4h12M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M10 7v5M6 7v5M3 4l.8 8a1 1 0 0 0 1 .9h6.4a1 1 0 0 0 1-.9L13 4H3z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <MenuImagePreview dish={previewDish} onClose={() => setPreviewDish(null)} />
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
  const { currentUser: authUser } = useAuth();
  const roleId = Number(authUser?.roleId ?? authUser?.role_id);
  const isCustomer = roleId === 1;

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

  useEffect(() => {
    const customerOnlyPanels = ["loyalty", "payments", "favorites"];
    if (authUser && !isCustomer && customerOnlyPanels.includes(activePanel)) {
      navigate("/profile", { replace: true });
    }
  }, [authUser, isCustomer, activePanel, navigate]);

  const sidebarItems = useMemo(() => {
    return DASHBOARD_ITEMS.filter((item) => {
      if (item.customerOnly) {
        return isCustomer;
      }
      return true;
    });
  }, [isCustomer]);

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
    if (activePanel === "favorites") {
      return <FavoritesProfilePanel currentUser={authUser} />;
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
            disabled={true}
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

        <section className="profile-dashboard__contact">
          <h3 className="profile-gradient-title">Contact & Info</h3>
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
                {phoneDisplay || (
                  <span className="profile-dashboard__missing-alert">
                    Missing. Please update to enable table booking.
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="profile-dashboard__contact-block">
            <p className="profile-dashboard__contact-label">Account created on</p>
            <div className="profile-dashboard__email-row">
              <span className="profile-dashboard__email-icon">
                <CalendarIcon />
              </span>
              <p className="profile-dashboard__email-text">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-GB') : "—"}
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
          {sidebarItems.map((item, index) => {
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
              <CustomerNotificationBell variant="profile" />
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
            <article className={`profile-dashboard__card mac-animate animate-scale ${activePanel === "dashboard" ? "flex flex-col h-full overflow-hidden flex-1 min-h-0" : ""}`} style={{ "--delay": "100ms", ...(activePanel === "loyalty" ? { minHeight: "unset", overflow: "visible" } : {}) }}>
            {activePanel !== "dashboard" && activePanel !== "loyalty" && (
              <div
                className="profile-dashboard__cover"
                style={{ background: coverGradient }}
                aria-hidden="true"
              />
            )}

            {activePanel !== "dashboard" && activePanel !== "loyalty" && (
              <div
                className="profile-dashboard__profile-header"
                style={{ background: `linear-gradient(180deg, transparent 0%, #f3f4f6 100%)` }}
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

            <div className={`profile-dashboard__card-body ${activePanel === "dashboard" ? "p-0 flex-1 flex flex-col min-h-0 overflow-hidden" : ""}`} style={activePanel === "loyalty" ? { paddingTop: 28 } : {}}>
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
