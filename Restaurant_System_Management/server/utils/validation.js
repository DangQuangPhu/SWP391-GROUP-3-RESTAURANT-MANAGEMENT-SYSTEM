export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const USERNAME_REGEX = /^[a-zA-Z0-9._]{3,30}$/;
export const NAME_REGEX = /^[a-zA-Z\s]+$/;

export function isValidEmail(value) {
  return EMAIL_REGEX.test(String(value || "").trim());
}

export function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

export function isValidVietnamPhone(value) {
  const digits = normalizePhone(value);
  return /^\d{10,11}$/.test(digits);
}

export function parseDateOfBirth(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function isAtLeast13YearsOld(dateOfBirth) {
  const dob = parseDateOfBirth(dateOfBirth);
  if (!dob) return false;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age >= 13;
}

export function validateRegisterPayload(body) {
  const errors = {};
  const firstName = body.firstName?.trim();
  const lastName = body.lastName?.trim();
  const username = body.username?.trim().toLowerCase();
  const email = body.email?.trim().toLowerCase();
  const phoneNumber = normalizePhone(body.phoneNumber);
  const dateOfBirth = body.dateOfBirth;
  const password = body.password;
  const confirmPassword = body.confirmPassword;

  if (!firstName) errors.firstName = "First name is required.";
  if (!lastName) errors.lastName = "Last name is required.";
  if (!username) errors.username = "Username is required.";
  else if (!USERNAME_REGEX.test(username)) {
    errors.username =
      "Username must be 3–30 characters (letters, numbers, underscore, dot only).";
  }
  if (!email) errors.email = "Email is required.";
  else if (!isValidEmail(email)) errors.email = "Enter a valid email address.";
  if (!phoneNumber) errors.phoneNumber = "Phone number is required.";
  else if (!isValidVietnamPhone(phoneNumber)) {
    errors.phoneNumber = "Phone number must be 10–11 digits.";
  }
  if (!dateOfBirth) errors.dateOfBirth = "Date of birth is required.";
  else if (!parseDateOfBirth(dateOfBirth)) {
    errors.dateOfBirth = "Enter a valid date of birth.";
  } else if (!isAtLeast13YearsOld(dateOfBirth)) {
    errors.dateOfBirth = "You must be at least 13 years old.";
  }
  if (!password) errors.password = "Password is required.";
  if (!confirmPassword) errors.confirmPassword = "Confirm password is required.";
  if (password && confirmPassword && password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return { errors, normalized: { firstName, lastName, username, email, phoneNumber, dateOfBirth, password } };
}

export function validateProfilePayload(body) {
  const errors = {};
  const firstName = body.firstName?.trim();
  const lastName = body.lastName?.trim();
  const username = body.username?.trim().toLowerCase();
  const phoneNumber = normalizePhone(body.phone);
  const dateOfBirth = body.dateOfBirth;

  if (!firstName) errors.firstName = "First name is required.";
  else if (!NAME_REGEX.test(firstName)) {
    errors.firstName = "First name can only contain letters and spaces.";
  }
  if (!lastName) errors.lastName = "Last name is required.";
  else if (!NAME_REGEX.test(lastName)) {
    errors.lastName = "Last name can only contain letters and spaces.";
  }
  if (!username) errors.username = "Username is required.";
  else if (!USERNAME_REGEX.test(username)) {
    errors.username =
      "Username must be 3–30 characters (letters, numbers, underscore, dot only).";
  }
  if (!phoneNumber) errors.phoneNumber = "Phone number is required.";
  else if (!isValidVietnamPhone(phoneNumber)) {
    errors.phoneNumber = "Phone number must be 10–11 digits.";
  }
  if (!dateOfBirth) errors.dateOfBirth = "Date of birth is required.";
  else if (!parseDateOfBirth(dateOfBirth)) {
    errors.dateOfBirth = "Enter a valid date of birth.";
  } else if (!isAtLeast13YearsOld(dateOfBirth)) {
    errors.dateOfBirth = "You must be at least 13 years old.";
  }

  return { errors, normalized: { firstName, lastName, username, phoneNumber, dateOfBirth } };
}
