import crypto from "node:crypto";
import bcrypt from "bcryptjs";

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derivedKey}`;
}

export function verifyPassword(password, passwordHash) {
  const [method, salt, storedKey] = String(passwordHash || "").split("$");

  if (method !== "scrypt" || !salt || !storedKey) {
    return false;
  }

  const derivedKey = crypto.scryptSync(password, salt, 64);
  const storedBuffer = Buffer.from(storedKey, "hex");

  return (
    storedBuffer.length === derivedKey.length &&
    crypto.timingSafeEqual(storedBuffer, derivedKey)
  );
}

export async function verifyStoredPassword(password, passwordHash) {
  const hash = String(passwordHash || "");
  if (!hash) return false;

  if (hash.startsWith("$2a$") || hash.startsWith("$2b$")) {
    return bcrypt.compare(String(password || ""), hash);
  }

  if (hash.startsWith("scrypt$")) {
    return verifyPassword(password, hash);
  }

  return false;
}

export function generateOtpCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

export function generateSecureToken() {
  return crypto.randomBytes(32).toString("hex");
}

export const PASSWORD_RULES_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.";

export function isPasswordStrong(password) {
  if (!password || password.length < 8) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}
