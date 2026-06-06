import nodemailer from "nodemailer";
import "./config.js";
import {
  OTP_EXPIRES_IN_SECONDS,
  OTP_RESEND_COOLDOWN_SECONDS,
} from "./utils/otpService.js";

export const RESEND_COOLDOWN_SECONDS = OTP_RESEND_COOLDOWN_SECONDS;
export { OTP_EXPIRES_IN_SECONDS };

const PLACEHOLDER_PASS = "your_google_app_password_without_spaces";

function getSmtpUser() {
  return String(process.env.SMTP_USER || process.env.EMAIL_USER || "").trim();
}

function getSmtpPass() {
  return String(process.env.SMTP_PASS || process.env.EMAIL_PASS || "")
    .trim()
    .replace(/\s+/g, "");
}

function getSmtpFrom() {
  return (
    String(process.env.SMTP_FROM || process.env.EMAIL_FROM || "").trim() ||
    getSmtpUser()
  );
}

export function isSmtpConfigured() {
  const user = getSmtpUser();
  const pass = getSmtpPass();
  return Boolean(user && pass && pass !== PLACEHOLDER_PASS);
}

let transporter = null;

function buildTransportOptions() {
  const user = getSmtpUser();
  const pass = getSmtpPass();
  const host = String(process.env.SMTP_HOST || "smtp.gmail.com").trim().toLowerCase();
  const port = Number(process.env.SMTP_PORT) || 587;

  const timeouts = {
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  };

  if (host === "smtp.gmail.com") {
    return {
      service: "gmail",
      auth: { user, pass },
      ...timeouts,
    };
  }

  return {
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user, pass },
    ...timeouts,
  };
}

function getTransporter() {
  if (!isSmtpConfigured()) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport(buildTransportOptions());
  }
  return transporter;
}

/**
 * Send verification OTP to the user's email (recipient = toEmail).
 */
export async function sendVerificationEmail(toEmail, otp, options = {}) {
  const { context = "account" } = options;
  const subject =
    options.subject ||
    (context === "reset" ? "Your Phūrai password reset code" : "Your Phūrai verification code");
  const safeOtp = String(otp).trim();
  const recipient = String(toEmail || "").trim().toLowerCase();
  const primaryOrigin = (process.env.APP_URL || "http://localhost:5173")
    .split(",")[0]
    .trim();

  if (!recipient) {
    throw new Error("Recipient email is required.");
  }

  console.log("SMTP configured:", isSmtpConfigured());
  console.log("Sending OTP to:", recipient);

  if (!isSmtpConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV] OTP for ${recipient} -> ${safeOtp}`);
    }
    return { sent: false, devMode: true };
  }

  const transport = getTransporter();
  const htmlBody =
    context === "reset"
      ? `
      <div style="font-family:Arial,sans-serif">
        <h2>Phūrai Verification Code</h2>
        <p>Your password reset code is:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px">${safeOtp}</div>
        <p>This code will expire in 5 minutes.</p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `
      : `
      <div style="font-family:Arial,sans-serif">
        <h2>Phūrai Verification Code</h2>
        <p>Your verification code is:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px">${safeOtp}</div>
        <p>This code will expire in 5 minutes.</p>
        <p>You can also verify at: <a href="${primaryOrigin}/login">${primaryOrigin}/login</a></p>
      </div>
    `;

  try {
    await transport.sendMail({
      from: `"Phūrai Restaurant" <${getSmtpFrom()}>`,
      to: recipient,
      subject,
      text: `Your Phūrai verification code is: ${safeOtp}\n\nThis code will expire in 5 minutes.`,
      html: htmlBody,
    });
    return { sent: true };
  } catch (error) {
    const smtpMessage = String(error?.message || error);
    console.error("Email send error:", smtpMessage);
    if (/535|BadCredentials|Username and Password not accepted/i.test(smtpMessage)) {
      throw new Error(
        "SMTP authentication failed. Generate a Gmail App Password for the SMTP_USER account and update SMTP_PASS in server/.env."
      );
    }
    throw new Error("Could not send OTP email. Please try again later.");
  }
}

/** OTP routes accept `{ to, otp, purpose }`. */
export async function sendOtpEmail({ to, otp, purpose = "verify_account" }) {
  const context =
    purpose === "reset" || purpose === "reset_password" ? "reset" : "account";
  return sendVerificationEmail(to, otp, { context });
}
