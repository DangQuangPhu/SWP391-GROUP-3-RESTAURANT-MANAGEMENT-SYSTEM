import nodemailer from "nodemailer";
import "./config.js";

const RESEND_COOLDOWN_SECONDS = 30;

function isSmtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_PASS !== "your_google_app_password_without_spaces"
  );
}

let transporter = null;

function getTransporter() {
  if (!isSmtpConfigured()) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

/**
 * Send verification OTP to the user's email (recipient = toEmail, sender = SMTP_USER).
 */
export async function sendVerificationEmail(toEmail, otp, options = {}) {
  const { context = "account" } = options;
  const subject =
    options.subject ||
    (context === "reset" ? "Your Phūrai password reset code" : "Your Phūrai verification code");
  const safeOtp = String(otp).trim();
  const primaryOrigin = (process.env.APP_URL || "http://localhost:5173")
    .split(",")[0]
    .trim();

  if (!isSmtpConfigured()) {
    console.log(`[DEV] OTP for ${toEmail} -> ${safeOtp}`);
    return { sent: false, devMode: true };
  }

  const transport = getTransporter();
  const htmlBody =
    context === "reset"
      ? `
      <p>Hello,</p>
      <p>Your Phūrai password reset code is:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${safeOtp}</p>
      <p>This code expires in 5 minutes.</p>
      <p>If you did not request this, you can ignore this email.</p>
      <p>— Phūrai Restaurant</p>
    `
      : `
      <p>Hello,</p>
      <p>Your Phūrai verification code is:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${safeOtp}</p>
      <p>You can also verify at: <a href="${primaryOrigin}/login">${primaryOrigin}/login</a></p>
      <p>— Phūrai Restaurant</p>
    `;

  try {
    await transport.sendMail({
      from: `"Phūrai Restaurant" <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject,
      text: `Your Phūrai code is: ${safeOtp}`,
      html: htmlBody,
    });
    return { sent: true };
  } catch (error) {
    console.error("Email send error:", error);
    throw new Error("Unable to send email. Please try again later.");
  }
}

export { RESEND_COOLDOWN_SECONDS, isSmtpConfigured };
