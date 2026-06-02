export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const USERNAME_REGEX = /^[a-zA-Z0-9._]{3,30}$/;
export const NAME_REGEX = /^[a-zA-Z\s]+$/;

export function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

export function isEmailValue(value) {
  return value.trim().includes("@");
}

export function isValidEmail(value) {
  return EMAIL_REGEX.test(value.trim());
}

export function isValidVietnamPhone(value) {
  const digits = normalizePhone(value);
  return /^\d{10,11}$/.test(digits);
}

export function isValidPhoneInput(value) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (!/^\d+$/.test(normalizePhone(trimmed))) return false;
  return isValidVietnamPhone(trimmed);
}

export function parseDateOfBirth(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function isAtLeast13YearsOld(value) {
  const dob = parseDateOfBirth(value);
  if (!dob) return false;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age >= 13;
}

export function isPasswordStrong(password) {
  if (!password || password.length < 8) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
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

  if (score >= 5) {
    return { level: "strong", bars: 3, label: "Strong" };
  }

  return { level: "medium", bars: 2, label: "Medium" };
}

export function validateName(value, label) {
  const trimmed = value?.trim();
  if (!trimmed) return `${label} is required.`;
  if (!NAME_REGEX.test(trimmed)) {
    return `${label} can only contain letters and spaces.`;
  }
  return "";
}

export function validateUsername(value) {
  const trimmed = value?.trim();
  if (!trimmed) return "Username is required.";
  if (!USERNAME_REGEX.test(trimmed)) {
    return "Username must be 3–30 characters (letters, numbers, underscore, dot only).";
  }
  return "";
}

export function getDisplayName(user) {
  if (user?.firstName) {
    return `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`.trim();
  }
  return user?.fullName?.trim() || user?.username?.trim() || "Guest";
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

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export function validateAvatarFile(file) {
  if (!file) return "";
  if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
    return "Avatar must be JPG, PNG, or WEBP.";
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return "Avatar must be 2MB or smaller.";
  }
  return "";
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
