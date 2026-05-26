export const DEMO_EMAIL = "demo@phurai.com";
export const DEMO_PHONE = "0964813966";
export const DEMO_USERNAME = "amanda";
export const DEMO_PASSWORD = "Phurai123!";
export const DEMO_OTP = "123456";
export const DEMO_USER_NAME = "Amanda";

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_INPUT_REGEX = /^[\d\s+\-()]{7,}$/;

export function normalizePhone(value) {
  return value.replace(/\D/g, "");
}

export function isEmailValue(value) {
  return value.trim().includes("@");
}

export function isValidEmail(value) {
  return EMAIL_REGEX.test(value.trim());
}

export function isValidPhoneInput(value) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (!PHONE_INPUT_REGEX.test(trimmed)) return false;
  return normalizePhone(trimmed).length >= 7;
}

export function accountExists(identifier) {
  const trimmed = identifier.trim().toLowerCase();
  if (trimmed === DEMO_EMAIL) return true;
  if (trimmed === DEMO_USERNAME) return true;
  return normalizePhone(identifier) === DEMO_PHONE;
}

export function getPasswordStrength(password) {
  if (!password) {
    return { level: "neutral", bars: 0, label: "Enter a password to check strength" };
  }

  const checks = {
    length: password.length >= 8,
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length;

  if (password.length < 8 || score <= 2) {
    return { level: "low", bars: 1, label: "Weak" };
  }

  if (score >= 4 && checks.special) {
    return { level: "strong", bars: 3, label: "Strong" };
  }

  return { level: "medium", bars: 2, label: "Medium" };
}

export function createDefaultProfile(overrides = {}) {
  const firstName = overrides.firstName ?? DEMO_USER_NAME;
  const lastName = overrides.lastName ?? "";
  const fullName =
    overrides.fullName ?? `${firstName}${lastName ? ` ${lastName}` : ""}`.trim();

  return {
    firstName,
    lastName,
    fullName,
    username: overrides.username ?? DEMO_USERNAME,
    nickname: overrides.nickname ?? firstName,
    email: overrides.email ?? DEMO_EMAIL,
    phone: overrides.phone ?? DEMO_PHONE,
    avatarUrl: "",
    ...overrides,
  };
}

export function buildUserFromLogin(identifier) {
  const trimmed = identifier.trim().toLowerCase();
  const isEmail = isEmailValue(identifier);
  return createDefaultProfile({
    firstName: DEMO_USER_NAME,
    lastName: "",
    fullName: DEMO_USER_NAME,
    username: isEmail ? DEMO_USERNAME : trimmed,
    email: isEmail ? trimmed : DEMO_EMAIL,
    phone: DEMO_PHONE,
  });
}

export function buildUserFromSignup(signup) {
  const firstName = signup.firstName.trim();
  const lastName = signup.lastName.trim();
  return createDefaultProfile({
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    username: signup.username.trim().toLowerCase(),
    nickname: signup.username.trim(),
    email: signup.email.trim().toLowerCase(),
    phone: signup.phone.trim(),
  });
}

export function buildGoogleDemoUser() {
  return createDefaultProfile({
    firstName: DEMO_USER_NAME,
    lastName: "",
    fullName: DEMO_USER_NAME,
    username: DEMO_USERNAME,
    email: DEMO_EMAIL,
    phone: DEMO_PHONE,
  });
}

export function getDisplayName(user) {
  if (user?.firstName) {
    return `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`.trim();
  }
  return user?.fullName?.trim() || user?.nickname?.trim() || DEMO_USER_NAME;
}

export function getInitials(user) {
  if (user?.firstName) {
    const first = user.firstName[0] ?? "";
    const last = user.lastName?.[0] ?? "";
    return `${first}${last}`.toUpperCase() || "PH";
  }
  const name = getDisplayName(user);
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
