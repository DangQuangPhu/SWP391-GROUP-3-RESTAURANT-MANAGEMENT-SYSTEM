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
  const titleText = context === "reset" ? "Password Reset" : "Verification Code";
  const instructions = context === "reset"
    ? "You requested a password reset. Your secure code is:"
    : "Please use the following code to verify your account:";

  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${titleText} — Phūrai</title>
</head>
<body style="margin:0;padding:0;background:#f8f5ef;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f5ef;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(31,26,23,0.10);">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1008 0%,#2c1d0a 100%);padding:36px 48px;text-align:center;">
              <h1 style="margin:0;font-size:32px;letter-spacing:0.14em;color:#c9a96e;font-weight:300;">Phūrai</h1>
              <p style="margin:6px 0 0;color:#8a7a60;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;">Restaurant &amp; Bar</p>
            </td>
          </tr>

          <!-- Gold divider -->
          <tr><td style="height:3px;background:linear-gradient(90deg,transparent,#c9a96e,transparent);"></td></tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 48px 48px;text-align:center;">
              <h2 style="margin:0 0 16px;font-size:22px;color:#2c1d0a;font-weight:600;">${titleText}</h2>
              <p style="margin:0 0 28px;font-size:15px;color:#4a3f35;line-height:1.7;">
                ${instructions}
              </p>

              <!-- OTP Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
                <tr>
                  <td align="center">
                    <div style="background:#faf7f2;border:1px solid #e8dcc8;border-radius:10px;padding:24px 32px;display:inline-block;">
                      <div style="font-size:36px;font-weight:700;letter-spacing:14px;color:#9f7c3a;margin-right:-14px;">
                        ${safeOtp}
                      </div>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 20px;font-size:14px;color:#8a7a60;">
                This code will expire in <strong style="color:#c0392b;">5 minutes</strong>.
              </p>
              
              ${context === "reset"
      ? `<p style="margin:0;font-size:13px;color:#a09080;">If you didn't request a password reset, you can safely ignore this email.</p>`
      : `<p style="margin:0;font-size:13px;color:#a09080;">You can also verify directly at: <a href="${primaryOrigin}/login" style="color:#9f7c3a;text-decoration:none;font-weight:600;">${primaryOrigin}/login</a></p>`
    }
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 48px;text-align:center;background:#fcfbf9;border-top:1px solid #f0e9df;">
              <p style="margin:0 0 4px;font-size:12px;color:#a09080;">&copy; 2026 Phūrai Restaurant &amp; Bar. All rights reserved.</p>
              <p style="margin:0;font-size:11px;color:#b8a898;">This is an automated email. Please do not reply.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    await transport.sendMail({
      from: `"Phūrai Restaurant" <${getSmtpFrom()}>`,
      to: recipient,
      subject,
      text: `${titleText}\n\n${instructions} ${safeOtp}\n\nThis code will expire in 5 minutes.\n\n© 2026 Phūrai Restaurant & Bar`,
      html: htmlBody,
    });
    return { sent: true };
  } catch (error) {
    const smtpMessage = String(error?.message || error);
    console.error("[sendVerificationEmail] Failed:", smtpMessage);
    // Protocol #1: NEVER crash the caller due to email failure.
    // Return a structured failure object instead of throwing.
    return { sent: false, error: smtpMessage };
  }
}

/** OTP routes accept `{ to, otp, purpose }`. */
export async function sendOtpEmail({ to, otp, purpose = "verify_account" }) {
  const normalizedPurpose = String(purpose || "").toLowerCase();
  const context =
    normalizedPurpose === "reset" ||
      normalizedPurpose === "reset_password" ||
      normalizedPurpose === "password_reset" ||
      normalizedPurpose === "forgot_password"
      ? "reset"
      : "account";
  return sendVerificationEmail(to, otp, { context });
}

/**
 * Send a formal Vietnamese reservation-confirmation email to the customer.
 *
 * @param {object} opts
 * @param {string} opts.toEmail       - Customer email address
 * @param {string} opts.customerName  - Customer full name
 * @param {string} opts.reservationDate - e.g. "17/06/2026"
 * @param {string} opts.reservationTime - e.g. "19:00"
 * @param {number|string} opts.reservationId - Reservation ID for reference
 */
export async function sendBookingConfirmationEmail({
  toEmail,
  customerName,
  customerPhone,
  reservationDate,
  reservationTime,
  reservationId,
  diningPurpose,
  duration,
  areaName,
  tables,
}) {
  const recipient = String(toEmail || "").trim().toLowerCase();
  if (!recipient) {
    console.warn("[sendBookingConfirmationEmail] No recipient email — skipping.");
    return { sent: false, reason: "no_recipient" };
  }

  if (!isSmtpConfigured()) {
    console.log(
      `[DEV] Booking confirmation email for ${recipient} — SMTP not configured, skipping.`
    );
    return { sent: false, devMode: true };
  }

  const transport = getTransporter();
  const primaryOrigin = (process.env.APP_URL || "http://localhost:5173")
    .split(",")[0]
    .trim();

  // Formatted booking ID with leading zeros: #000009
  const formattedId = `#${String(reservationId).padStart(6, "0")}`;

  const safeName = customerName || "Guest";
  const safePhone = customerPhone || "Not provided";
  const safeArea = areaName || "Not assigned";
  const safePurpose = diningPurpose ? String(diningPurpose).trim() : "None";
  const safeDuration = duration ? String(duration).trim() : "Not specified";

  // Build bold table list string
  const tableList = Array.isArray(tables) && tables.length > 0
    ? tables.map((t) => `<strong>#${t.display_label || t.table_number}</strong>`).join(", ")
    : "Not assigned";

  const tableListText = Array.isArray(tables) && tables.length > 0
    ? tables.map((t) => `#${t.display_label || t.table_number}`).join(", ")
    : "Not assigned";

  // Helper to render one info row
  const infoRow = (label, value) => `
    <tr>
      <td style="padding:8px 0;font-size:13px;color:#8a7a60;width:170px;vertical-align:top;">${label}</td>
      <td style="padding:8px 0;font-size:14px;color:#2c1d0a;font-weight:600;">${value}</td>
    </tr>`;

  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reservation Confirmed — Phūrai</title>
</head>
<body style="margin:0;padding:0;background:#f8f5ef;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f5ef;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(31,26,23,0.10);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1008 0%,#2c1d0a 100%);padding:36px 48px;text-align:center;">
              <h1 style="margin:0;font-size:32px;letter-spacing:0.14em;color:#c9a96e;font-weight:300;">Phūrai</h1>
              <p style="margin:6px 0 0;color:#8a7a60;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;">Restaurant &amp; Bar &middot; Est. 2025</p>
            </td>
          </tr>

          <!-- Gold divider -->
          <tr><td style="height:3px;background:linear-gradient(90deg,transparent,#c9a96e,transparent);"></td></tr>

          <!-- Status badge -->
          <tr>
            <td style="padding:28px 48px 0;text-align:center;">
              <span style="display:inline-block;background:#d4edda;color:#155724;font-size:12px;font-weight:700;padding:6px 18px;border-radius:24px;letter-spacing:0.08em;">
                ✓ RESERVATION CONFIRMED
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 48px 36px;">
              <p style="margin:0 0 24px;font-size:16px;color:#4a3f35;line-height:1.7;">
                Dear <strong style="color:#2c1d0a;">${safeName}</strong>,<br />
                Your reservation <strong style="color:#9f7c3a;">${formattedId}</strong> has been
                <em>successfully confirmed</em> by the Phūrai Restaurant management team.
              </p>

              <!-- Ticket grid -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#faf7f2;border:1px solid #e8dcc8;border-radius:10px;margin:0 0 28px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <p style="margin:0 0 14px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#a09080;font-weight:600;">
                      Reservation Details
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      ${infoRow("Booking ID", `<strong style="color:#9f7c3a;font-size:15px;">${formattedId}</strong>`)}
                      ${infoRow("Guest Name", safeName)}
                      ${infoRow("Phone Number", safePhone)}
                      ${infoRow("Date", reservationDate)}
                      ${infoRow("Arrival Time", reservationTime)}
                      ${infoRow("Duration", safeDuration)}
                      ${infoRow("Area", safeArea)}
                      ${infoRow("Selected Table", tableList)}
                      ${infoRow("Dining Purpose", safePurpose)}
                      ${infoRow("Status", `<span style="background:#d4edda;color:#155724;font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;">✓ Confirmed</span>`)}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
                <tr>
                  <td style="background:linear-gradient(135deg,#9f7c3a,#c9a96e);border-radius:8px;">
                    <a href="${primaryOrigin}/my-reservations"
                       style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:600;color:#fff;text-decoration:none;letter-spacing:0.06em;">
                      View My Reservation &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:14px;color:#4a3f35;line-height:1.8;font-style:italic;">
                We look forward to welcoming you at Phūrai. If you have any questions, feel free to contact us. 🌸
              </p>
            </td>
          </tr>

          <!-- Gold divider -->
          <tr><td style="height:1px;background:linear-gradient(90deg,transparent,#e8dcc8,transparent);"></td></tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 48px;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#a09080;">&copy; 2026 Phūrai Restaurant &amp; Bar. All rights reserved.</p>
              <p style="margin:0;font-size:11px;color:#b8a898;">This is an automated email. Please do not reply directly to this message.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const textBody = [
    `Dear ${safeName},`,
    ``,
    `Your reservation ${formattedId} has been successfully confirmed.`,
    ``,
    `Details:`,
    `  Guest Name    : ${safeName}`,
    `  Phone Number  : ${safePhone}`,
    `  Date          : ${reservationDate}`,
    `  Arrival Time  : ${reservationTime}`,
    `  Duration      : ${safeDuration}`,
    `  Area          : ${safeArea}`,
    `  Selected Table: ${tableListText}`,
    `  Dining Purpose: ${safePurpose}`,
    ``,
    `View your reservation: ${primaryOrigin}/my-reservations`,
    ``,
    `© 2026 Phūrai Restaurant & Bar`,
  ].join("\n");

  try {
    await transport.sendMail({
      from: `"Phūrai Restaurant" <${getSmtpFrom()}>`,
      to: recipient,
      subject: `[Phūrai] Reservation ${formattedId} Confirmed — ${reservationDate} at ${reservationTime}`,
      text: textBody,
      html: htmlBody,
    });
    console.log(`[sendBookingConfirmationEmail] Sent to ${recipient} for reservation #${reservationId}`);
    return { sent: true };
  } catch (error) {
    const msg = String(error?.message || error);
    console.error("[sendBookingConfirmationEmail] Failed:", msg);
    return { sent: false, error: msg };
  }
}

/**
 * Staff confirmed customer walk-in.
 */
export async function sendBookingCheckedInEmail({
  toEmail, customerName, reservationId, reservationDate, reservationTime,
}) {
  const recipient = String(toEmail || "").trim().toLowerCase();
  if (!recipient) return { sent: false, reason: "no_recipient" };
  if (!isSmtpConfigured()) {
    console.log(`[DEV] CheckedIn email for ${recipient} — SMTP not configured.`);
    return { sent: false, devMode: true };
  }
  const primaryOrigin = (process.env.APP_URL || "http://localhost:5173").split(",")[0].trim();
  const html = `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f8f5ef;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f5ef;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 6px 32px rgba(31,26,23,.10);">
        <tr><td style="background:linear-gradient(135deg,#1a1008,#2c1d0a);padding:32px 44px;text-align:center;">
          <h1 style="margin:0;font-size:26px;letter-spacing:.12em;color:#c9a96e;font-weight:300;">Phūrai</h1>
          <p style="margin:4px 0 0;color:#8a7a60;font-size:11px;letter-spacing:.18em;text-transform:uppercase;">Restaurant &amp; Bar</p>
        </td></tr>
        <tr><td style="height:3px;background:linear-gradient(90deg,transparent,#c9a96e,transparent);"></td></tr>
        <tr><td style="padding:40px 44px;">
          <p style="margin:0 0 16px;font-size:16px;color:#4a3f35;line-height:1.7;">Dear <strong style="color:#2c1d0a;">${customerName || "Guest"}</strong>,</p>
          <p style="margin:0 0 20px;font-size:15px;color:#4a3f35;line-height:1.8;">
            Great news! Your reservation <strong style="color:#9f7c3a;">#${reservationId}</strong>
            on <strong>${reservationDate}</strong> at <strong>${reservationTime}</strong>
            has been <em>checked in and verified</em> by our staff. Welcome to Phūrai!
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f2;border:1px solid #e8dcc8;border-radius:10px;margin:0 0 24px;">
            <tr><td style="padding:20px 26px;">
              <table width="100%"><tr>
                <td style="font-size:13px;color:#8a7a60;width:140px;padding:5px 0;">Reference</td>
                <td style="font-size:14px;color:#2c1d0a;font-weight:600;padding:5px 0;">#${reservationId}</td>
              </tr><tr>
                <td style="font-size:13px;color:#8a7a60;padding:5px 0;">Date</td>
                <td style="font-size:14px;color:#2c1d0a;font-weight:600;padding:5px 0;">${reservationDate}</td>
              </tr><tr>
                <td style="font-size:13px;color:#8a7a60;padding:5px 0;">Time</td>
                <td style="font-size:14px;color:#2c1d0a;font-weight:600;padding:5px 0;">${reservationTime}</td>
              </tr><tr>
                <td style="font-size:13px;color:#8a7a60;padding:5px 0;">Status</td>
                <td style="padding:5px 0;"><span style="background:#d4edda;color:#155724;font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;">✓ CHECKED IN</span></td>
              </tr></table>
            </td></tr>
          </table>
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:linear-gradient(135deg,#9f7c3a,#c9a96e);border-radius:8px;">
              <a href="${primaryOrigin}/my-reservations" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#fff;text-decoration:none;letter-spacing:.06em;">View My Reservation →</a>
            </td>
          </tr></table>
          <p style="margin:28px 0 0;font-size:15px;color:#4a3f35;font-style:italic;">Enjoy your dining experience at Phūrai! 🌸</p>
        </td></tr>
        <tr><td style="padding:20px 44px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#a09080;">© 2026 Phūrai Restaurant &amp; Bar. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim();

  try {
    await getTransporter().sendMail({
      from: `"Phūrai Restaurant" <${getSmtpFrom()}>`,
      to: recipient,
      subject: `[Phūrai] Check-in Confirmed — Reservation #${reservationId}`,
      text: `Dear ${customerName || "Guest"},\n\nYour reservation #${reservationId} on ${reservationDate} at ${reservationTime} has been checked in. Enjoy your dining experience!\n\n© 2026 Phūrai Restaurant & Bar`,
      html,
    });
    console.log(`[sendBookingCheckedInEmail] Sent to ${recipient} for #${reservationId}`);
    return { sent: true };
  } catch (err) {
    console.error("[sendBookingCheckedInEmail] Failed:", String(err?.message || err));
    return { sent: false, error: String(err?.message || err) };
  }
}

/**
 * Staff rejected / marked customer as No-Show.
 */
export async function sendBookingRejectedEmail({
  toEmail, customerName, reservationId, reason,
}) {
  const recipient = String(toEmail || "").trim().toLowerCase();
  if (!recipient) return { sent: false, reason: "no_recipient" };
  if (!isSmtpConfigured()) {
    console.log(`[DEV] Rejected email for ${recipient} — SMTP not configured.`);
    return { sent: false, devMode: true };
  }
  const html = `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f8f5ef;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f5ef;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 6px 32px rgba(31,26,23,.10);">
        <tr><td style="background:linear-gradient(135deg,#1a1008,#2c1d0a);padding:32px 44px;text-align:center;">
          <h1 style="margin:0;font-size:26px;letter-spacing:.12em;color:#c9a96e;font-weight:300;">Phūrai</h1>
        </td></tr>
        <tr><td style="height:3px;background:linear-gradient(90deg,transparent,#c9a96e,transparent);"></td></tr>
        <tr><td style="padding:40px 44px;">
          <p style="margin:0 0 16px;font-size:16px;color:#4a3f35;line-height:1.7;">Dear <strong style="color:#2c1d0a;">${customerName || "Guest"}</strong>,</p>
          <p style="margin:0 0 20px;font-size:15px;color:#4a3f35;line-height:1.8;">
            We regret to inform you that your reservation <strong style="color:#9f7c3a;">#${reservationId}</strong>
            could not be completed during check-in.
          </p>
          ${reason ? `<p style="margin:0 0 20px;font-size:14px;color:#6b5c50;background:#fdf3f0;border-left:3px solid #c0392b;padding:12px 16px;border-radius:4px;">Reason: ${reason}</p>` : ""}
          <p style="margin:0;font-size:15px;color:#4a3f35;line-height:1.8;">If you have any questions, please contact us directly. We apologize for any inconvenience.</p>
        </td></tr>
        <tr><td style="padding:20px 44px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#a09080;">© 2026 Phūrai Restaurant &amp; Bar. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim();

  try {
    await getTransporter().sendMail({
      from: `"Phūrai Restaurant" <${getSmtpFrom()}>`,
      to: recipient,
      subject: `[Phūrai] Reservation #${reservationId} — Update`,
      text: `Dear ${customerName || "Guest"},\n\nYour reservation #${reservationId} could not be completed.${reason ? `\n\nReason: ${reason}` : ""}\n\n© 2026 Phūrai Restaurant & Bar`,
      html,
    });
    console.log(`[sendBookingRejectedEmail] Sent to ${recipient} for #${reservationId}`);
    return { sent: true };
  } catch (err) {
    console.error("[sendBookingRejectedEmail] Failed:", String(err?.message || err));
    return { sent: false, error: String(err?.message || err) };
  }
}

/**
 * Manager edited a booking — notify customer of updated details.
 */
export async function sendBookingEditedEmail({
  toEmail, customerName, reservationId, changes = {},
}) {
  const recipient = String(toEmail || "").trim().toLowerCase();
  if (!recipient) return { sent: false, reason: "no_recipient" };
  if (!isSmtpConfigured()) {
    console.log(`[DEV] Edited email for ${recipient} — SMTP not configured.`);
    return { sent: false, devMode: true };
  }
  const changeLines = Object.entries(changes)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `<tr><td style="font-size:13px;color:#8a7a60;width:160px;padding:5px 0;">${k}</td><td style="font-size:14px;color:#2c1d0a;font-weight:600;padding:5px 0;">${v}</td></tr>`)
    .join("");

  const primaryOrigin = (process.env.APP_URL || "http://localhost:5173").split(",")[0].trim();
  const html = `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f8f5ef;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f5ef;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 6px 32px rgba(31,26,23,.10);">
        <tr><td style="background:linear-gradient(135deg,#1a1008,#2c1d0a);padding:32px 44px;text-align:center;">
          <h1 style="margin:0;font-size:26px;letter-spacing:.12em;color:#c9a96e;font-weight:300;">Phūrai</h1>
        </td></tr>
        <tr><td style="height:3px;background:linear-gradient(90deg,transparent,#c9a96e,transparent);"></td></tr>
        <tr><td style="padding:40px 44px;">
          <p style="margin:0 0 16px;font-size:16px;color:#4a3f35;line-height:1.7;">Dear <strong style="color:#2c1d0a;">${customerName || "Guest"}</strong>,</p>
          <p style="margin:0 0 20px;font-size:15px;color:#4a3f35;line-height:1.8;">
            Your reservation <strong style="color:#9f7c3a;">#${reservationId}</strong>
            has been updated by our management team. Here are the updated details:
          </p>
          ${changeLines ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f2;border:1px solid #e8dcc8;border-radius:10px;margin:0 0 24px;"><tr><td style="padding:20px 26px;"><table width="100%">${changeLines}</table></td></tr></table>` : ""}
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:linear-gradient(135deg,#9f7c3a,#c9a96e);border-radius:8px;">
              <a href="${primaryOrigin}/my-reservations" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#fff;text-decoration:none;letter-spacing:.06em;">View Updated Reservation →</a>
            </td>
          </tr></table>
          <p style="margin:28px 0 0;font-size:14px;color:#6b5c50;">If you have concerns about these changes, please contact us directly.</p>
        </td></tr>
        <tr><td style="padding:20px 44px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#a09080;">© 2026 Phūrai Restaurant &amp; Bar. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim();

  try {
    await getTransporter().sendMail({
      from: `"Phūrai Restaurant" <${getSmtpFrom()}>`,
      to: recipient,
      subject: `[Phūrai] Your Reservation #${reservationId} Has Been Updated`,
      text: `Dear ${customerName || "Guest"},\n\nYour reservation #${reservationId} has been updated by our management team.\n\nPlease view your updated reservation at: ${primaryOrigin}/my-reservations\n\n© 2026 Phūrai Restaurant & Bar`,
      html,
    });
    console.log(`[sendBookingEditedEmail] Sent to ${recipient} for #${reservationId}`);
    return { sent: true };
  } catch (err) {
    console.error("[sendBookingEditedEmail] Failed:", String(err?.message || err));
    return { sent: false, error: String(err?.message || err) };
  }
}

// ============================================================================
// sendEditRequestDeclinedEmail
// ============================================================================
export async function sendEditRequestDeclinedEmail({ toEmail, customerName, reservationId }) {
  const recipient = String(toEmail || "").trim().toLowerCase();
  if (!recipient) return { sent: false, reason: "no_recipient" };
  if (!isSmtpConfigured()) return { sent: false, devMode: true };
  const primaryOrigin = (process.env.APP_URL || "http://localhost:5173").split(",")[0].trim();
  try {
    await getTransporter().sendMail({
      from: `"Phūrai Restaurant" <${getSmtpFrom()}>`,
      to: recipient,
      subject: `[Phūrai] Your Edit Request for Reservation #${reservationId} Was Declined`,
      text: `Dear ${customerName || "Guest"},\n\nYour edit request for reservation #${reservationId} was declined. Your original booking remains Confirmed — no changes have been applied.\n\nView your reservation: ${primaryOrigin}/my-reservations\n\n© 2026 Phūrai Restaurant & Bar`,
      html: `<p>Dear <strong>${customerName || "Guest"}</strong>,</p><p>Your edit request for reservation <strong>#${reservationId}</strong> has been <strong style="color:#c0392b;">declined</strong>. Your original booking remains <strong style="color:#27ae60;">Confirmed</strong> — no changes have been applied.</p><p><a href="${primaryOrigin}/my-reservations">View My Reservation →</a></p>`,
    });
    return { sent: true };
  } catch (err) {
    console.error("[sendEditRequestDeclinedEmail] Failed:", String(err?.message || err));
    return { sent: false, error: String(err?.message || err) };
  }
}

// ============================================================================
// sendCancelConfirmedEmail — refund processed, booking cancelled
// ============================================================================
export async function sendCancelConfirmedEmail({ toEmail, customerName, reservationId }) {
  const recipient = String(toEmail || "").trim().toLowerCase();
  if (!recipient) return { sent: false, reason: "no_recipient" };
  if (!isSmtpConfigured()) return { sent: false, devMode: true };
  try {
    await getTransporter().sendMail({
      from: `"Phūrai Restaurant" <${getSmtpFrom()}>`,
      to: recipient,
      subject: `[Phūrai] Your Cancelled Reservation Request Have Been Successful`,
      text: `Dear ${customerName || "Guest"},\n\nYour cancellation for reservation #${reservationId} is confirmed. Your refund has been initiated — please allow 3-7 business days to reflect in your payment account.\n\nThank you for dining with Phūrai.\n\n© 2026 Phūrai Restaurant & Bar`,
      html: `<p>Dear <strong>${customerName || "Guest"}</strong>,</p><h2 style="color:#27ae60;">Your Cancelled Reservation Request Have Been Successful</h2><p>Your cancellation for reservation <strong>#${reservationId}</strong> is confirmed.</p><p>Your refund has been initiated. Please check your payment account to confirm the refund reflects within the usual processing window (typically 3-7 business days).</p><p>Thank you for understanding. We hope to welcome you at Phūrai again soon.</p>`,
    });
    return { sent: true };
  } catch (err) {
    console.error("[sendCancelConfirmedEmail] Failed:", String(err?.message || err));
    return { sent: false, error: String(err?.message || err) };
  }
}

// ============================================================================
// sendCancelRejectedEmail — manager rejected the cancellation request
// ============================================================================
export async function sendCancelRejectedEmail({ toEmail, customerName, reservationId }) {
  const recipient = String(toEmail || "").trim().toLowerCase();
  if (!recipient) return { sent: false, reason: "no_recipient" };
  if (!isSmtpConfigured()) return { sent: false, devMode: true };
  const primaryOrigin = (process.env.APP_URL || "http://localhost:5173").split(",")[0].trim();
  try {
    await getTransporter().sendMail({
      from: `"Phūrai Restaurant" <${getSmtpFrom()}>`,
      to: recipient,
      subject: `[Phūrai] Your Cancellation Request for Reservation #${reservationId} Was Not Approved`,
      text: `Dear ${customerName || "Guest"},\n\nYour cancellation request for reservation #${reservationId} was not approved. Your booking remains Confirmed and your table is still reserved.\n\nPlease contact us if you have questions.\n\n© 2026 Phūrai Restaurant & Bar`,
      html: `<p>Dear <strong>${customerName || "Guest"}</strong>,</p><p>Your cancellation request for reservation <strong>#${reservationId}</strong> was <strong style="color:#c0392b;">not approved</strong>. Your booking remains <strong style="color:#27ae60;">Confirmed</strong>.</p><p><a href="${primaryOrigin}/my-reservations">View My Reservation →</a></p>`,
    });
    return { sent: true };
  } catch (err) {
    console.error("[sendCancelRejectedEmail] Failed:", String(err?.message || err));
    return { sent: false, error: String(err?.message || err) };
  }
}

// ============================================================================
// sendManagerCancelledEmail — manager proactively cancelled a booking
// ============================================================================
export async function sendManagerCancelledEmail({ toEmail, customerName, reservationId, cancelReason }) {
  const recipient = String(toEmail || '').trim().toLowerCase();
  if (!recipient) return { sent: false, reason: 'no_recipient' };
  if (!isSmtpConfigured()) return { sent: false, devMode: true };
  const primaryOrigin = (process.env.APP_URL || 'http://localhost:5173').split(',')[0].trim();
  const formattedId = `#${String(reservationId).padStart(6, '0')}`;
  const safeName = customerName || 'Guest';
  const safeReason = cancelReason || 'No reason specified.';
  try {
    await getTransporter().sendMail({
      from: `"Phūrai Restaurant" <${getSmtpFrom()}>`,
      to: recipient,
      subject: `[Phūrai] Reservation ${formattedId} Has Been Cancelled`,
      text: `Dear ${safeName},\n\nWe regret to inform you that your reservation ${formattedId} has been cancelled by our management team.\n\nReason: ${safeReason}\n\nWe sincerely apologize for any inconvenience.\n\n© 2026 Phūrai Restaurant & Bar`,
      html: `<p>Dear <strong>${safeName}</strong>,</p><p>Your reservation <strong>${formattedId}</strong> has been <strong style="color:#c0392b;">cancelled</strong> by our management team.</p><p><strong>Reason:</strong> ${safeReason}</p><p>We sincerely apologize. Please <a href="${primaryOrigin}/reservations">make a new reservation</a> or contact us directly.</p><p style="font-size:11px;color:#a09080;">© 2026 Phūrai Restaurant &amp; Bar</p>`,
    });
    console.log(`[sendManagerCancelledEmail] Sent to ${recipient} for ${formattedId}`);
    return { sent: true };
  } catch (err) {
    console.error('[sendManagerCancelledEmail] Failed:', String(err?.message || err));
    return { sent: false, error: String(err?.message || err) };
  }
}

// ============================================================================
// sendEditConfirmedEmail — Manager confirmed customer's edit request
// Shows old vs new info comparison table
// ============================================================================
export async function sendEditConfirmedEmail({ toEmail, customerName, reservationId, oldInfo = {}, newInfo = {} }) {
  const recipient = String(toEmail || "").trim().toLowerCase();
  if (!recipient) return { sent: false, reason: "no_recipient" };
  if (!isSmtpConfigured()) return { sent: false, devMode: true };
  const primaryOrigin = (process.env.APP_URL || "http://localhost:5173").split(",")[0].trim();
  const formattedId = `#${String(reservationId).padStart(6, "0")}`;
  const safeName = customerName || "Guest";

  // Build comparison rows
  const allFields = new Set([...Object.keys(oldInfo), ...Object.keys(newInfo)]);
  let comparisonRows = "";
  for (const field of allFields) {
    const oldVal = oldInfo[field] ?? "—";
    const newVal = newInfo[field] ?? "—";
    const changed = String(oldVal) !== String(newVal);
    comparisonRows += `
      <tr>
        <td style="padding:7px 0;font-size:13px;color:#8a7a60;width:150px;">${field}</td>
        <td style="padding:7px 0;font-size:13px;color:#888;text-decoration:${changed ? "line-through" : "none"}">${oldVal}</td>
        <td style="padding:7px 0;font-size:14px;color:${changed ? "#27ae60" : "#2c1d0a"};font-weight:${changed ? "700" : "400"};">${newVal}${changed ? " ✓" : ""}</td>
      </tr>`;
  }

  const html = `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f8f5ef;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f5ef;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(31,26,23,.10);">
        <tr><td style="background:linear-gradient(135deg,#1a1008,#2c1d0a);padding:32px 48px;text-align:center;">
          <h1 style="margin:0;font-size:28px;letter-spacing:.14em;color:#c9a96e;font-weight:300;">Phūrai</h1>
          <p style="margin:5px 0 0;color:#8a7a60;font-size:11px;letter-spacing:.2em;text-transform:uppercase;">Restaurant &amp; Bar · Est. 2025</p>
        </td></tr>
        <tr><td style="height:3px;background:linear-gradient(90deg,transparent,#c9a96e,transparent);"></td></tr>
        <tr><td style="padding:32px 48px 0;text-align:center;">
          <span style="display:inline-block;background:#d4edda;color:#155724;font-size:12px;font-weight:700;padding:6px 18px;border-radius:24px;letter-spacing:.08em;">
            ✓ CHANGE REQUEST APPROVED
          </span>
        </td></tr>
        <tr><td style="padding:24px 48px 36px;">
          <p style="margin:0 0 20px;font-size:16px;color:#4a3f35;line-height:1.7;">
            Dear <strong style="color:#2c1d0a;">${safeName}</strong>,<br/>
            Great news! Your change request for reservation <strong style="color:#9f7c3a;">${formattedId}</strong> has been <em>approved</em> by our management team.
          </p>
          <p style="margin:0 0 12px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#a09080;font-weight:600;">What Changed</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f2;border:1px solid #e8dcc8;border-radius:10px;margin:0 0 24px;">
            <tr><td style="padding:20px 26px;">
              <table width="100%">
                <tr>
                  <th style="text-align:left;font-size:11px;color:#a09080;padding-bottom:8px;">Field</th>
                  <th style="text-align:left;font-size:11px;color:#a09080;padding-bottom:8px;">Before</th>
                  <th style="text-align:left;font-size:11px;color:#a09080;padding-bottom:8px;">After</th>
                </tr>
                ${comparisonRows}
              </table>
            </td></tr>
          </table>
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:linear-gradient(135deg,#9f7c3a,#c9a96e);border-radius:8px;">
              <a href="${primaryOrigin}/my-reservations" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#fff;text-decoration:none;letter-spacing:.06em;">View Updated Reservation →</a>
            </td>
          </tr></table>
          <p style="margin:24px 0 0;font-size:14px;color:#4a3f35;font-style:italic;">We look forward to welcoming you at Phūrai. 🌸</p>
        </td></tr>
        <tr><td style="padding:20px 48px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#a09080;">© 2026 Phūrai Restaurant &amp; Bar. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim();

  try {
    await getTransporter().sendMail({
      from: `"Phūrai Restaurant" <${getSmtpFrom()}>`,
      to: recipient,
      subject: `[Phūrai] Your Change Request for ${formattedId} Has Been Approved`,
      text: `Dear ${safeName},\n\nYour change request for reservation ${formattedId} has been approved.\n\nView your updated reservation: ${primaryOrigin}/my-reservations\n\n© 2026 Phūrai Restaurant & Bar`,
      html,
    });
    console.log(`[sendEditConfirmedEmail] Sent to ${recipient} for ${formattedId}`);
    return { sent: true };
  } catch (err) {
    console.error("[sendEditConfirmedEmail] Failed:", String(err?.message || err));
    return { sent: false, error: String(err?.message || err) };
  }
}

// ============================================================================
// sendEditRejectedEmail — Manager rejected customer's edit request
// ============================================================================
export async function sendEditRejectedEmail({ toEmail, customerName, reservationId, rejectReason, currentInfo = {} }) {
  const recipient = String(toEmail || "").trim().toLowerCase();
  if (!recipient) return { sent: false, reason: "no_recipient" };
  if (!isSmtpConfigured()) return { sent: false, devMode: true };
  const primaryOrigin = (process.env.APP_URL || "http://localhost:5173").split(",")[0].trim();
  const formattedId = `#${String(reservationId).padStart(6, "0")}`;
  const safeName = customerName || "Guest";
  const safeReason = rejectReason || "The requested changes could not be accommodated at this time.";

  const currentInfoRows = Object.entries(currentInfo)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `<tr><td style="font-size:13px;color:#8a7a60;width:150px;padding:6px 0;">${k}</td><td style="font-size:14px;color:#2c1d0a;font-weight:600;padding:6px 0;">${v}</td></tr>`)
    .join("");

  const html = `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f8f5ef;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f5ef;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(31,26,23,.10);">
        <tr><td style="background:linear-gradient(135deg,#1a1008,#2c1d0a);padding:32px 48px;text-align:center;">
          <h1 style="margin:0;font-size:28px;letter-spacing:.14em;color:#c9a96e;font-weight:300;">Phūrai</h1>
          <p style="margin:5px 0 0;color:#8a7a60;font-size:11px;letter-spacing:.2em;text-transform:uppercase;">Restaurant &amp; Bar · Est. 2025</p>
        </td></tr>
        <tr><td style="height:3px;background:linear-gradient(90deg,transparent,#c9a96e,transparent);"></td></tr>
        <tr><td style="padding:32px 48px 0;text-align:center;">
          <span style="display:inline-block;background:#fce8e6;color:#c0392b;font-size:12px;font-weight:700;padding:6px 18px;border-radius:24px;letter-spacing:.08em;">
            ✕ CHANGE REQUEST DECLINED
          </span>
        </td></tr>
        <tr><td style="padding:24px 48px 36px;">
          <p style="margin:0 0 20px;font-size:16px;color:#4a3f35;line-height:1.7;">
            Dear <strong style="color:#2c1d0a;">${safeName}</strong>,<br/>
            We regret to inform you that your change request for reservation <strong style="color:#9f7c3a;">${formattedId}</strong> could not be accommodated.
          </p>
          <div style="background:#fdf3f0;border-left:3px solid #c0392b;padding:14px 18px;border-radius:4px;margin:0 0 24px;">
            <strong style="font-size:13px;color:#c0392b;">Reason:</strong>
            <p style="margin:4px 0 0;font-size:14px;color:#6b5c50;">${safeReason}</p>
          </div>
          <p style="margin:0 0 16px;font-size:14px;color:#4a3f35;line-height:1.7;">
            <strong>Your original booking remains confirmed.</strong> No changes have been applied. Your table is still reserved for you.
          </p>
          ${currentInfoRows ? `
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f2;border:1px solid #e8dcc8;border-radius:10px;margin:0 0 24px;">
            <tr><td style="padding:20px 26px;">
              <p style="margin:0 0 10px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#a09080;font-weight:600;">Your Current Booking</p>
              <table width="100%">${currentInfoRows}</table>
            </td></tr>
          </table>` : ""}
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:linear-gradient(135deg,#9f7c3a,#c9a96e);border-radius:8px;">
              <a href="${primaryOrigin}/my-reservations" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#fff;text-decoration:none;letter-spacing:.06em;">View My Reservation →</a>
            </td>
          </tr></table>
          <p style="margin:24px 0 0;font-size:14px;color:#4a3f35;">If you have any questions, please don't hesitate to contact us. We look forward to welcoming you! 🌸</p>
        </td></tr>
        <tr><td style="padding:20px 48px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#a09080;">© 2026 Phūrai Restaurant &amp; Bar. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim();

  try {
    await getTransporter().sendMail({
      from: `"Phūrai Restaurant" <${getSmtpFrom()}>`,
      to: recipient,
      subject: `[Phūrai] Your Change Request for ${formattedId} Was Not Approved`,
      text: `Dear ${safeName},\n\nYour change request for reservation ${formattedId} was declined.\n\nReason: ${safeReason}\n\nYour original booking remains confirmed. View your reservation: ${primaryOrigin}/my-reservations\n\n© 2026 Phūrai Restaurant & Bar`,
      html,
    });
    console.log(`[sendEditRejectedEmail] Sent to ${recipient} for ${formattedId}`);
    return { sent: true };
  } catch (err) {
    console.error("[sendEditRejectedEmail] Failed:", String(err?.message || err));
    return { sent: false, error: String(err?.message || err) };
  }
}

// ============================================================================
// sendEditRequestReceivedEmail
// ============================================================================
export async function sendEditRequestReceivedEmail({ toEmail, customerName, reservationId }) {
  const recipient = String(toEmail || "").trim().toLowerCase();
  if (!recipient) return { sent: false, reason: "no_recipient" };
  if (!isSmtpConfigured()) return { sent: false, devMode: true };
  const primaryOrigin = (process.env.APP_URL || "http://localhost:5173").split(",")[0].trim();
  const formattedId = `#${String(reservationId).padStart(6, "0")}`;
  const safeName = customerName || "Guest";

  try {
    await getTransporter().sendMail({
      from: `"Phūrai Restaurant" <${getSmtpFrom()}>`,
      to: recipient,
      subject: `[Phūrai] We've Received Your Change Request for ${formattedId}`,
      text: `Dear ${safeName},\n\nWe have received your request to edit reservation ${formattedId}.\n\nOur management team will review your request shortly. Your current booking remains confirmed until the request is approved.\n\nView your reservation: ${primaryOrigin}/my-reservations\n\n© 2026 Phūrai Restaurant & Bar`,
      html: `<p>Dear <strong>${safeName}</strong>,</p><p>We have received your request to edit reservation <strong>${formattedId}</strong>.</p><p>Our management team will review your request shortly. Your current booking remains confirmed until the request is approved.</p><p><a href="${primaryOrigin}/my-reservations">View My Reservation →</a></p>`,
    });
    console.log(`[sendEditRequestReceivedEmail] Sent to ${recipient} for ${formattedId}`);
    return { sent: true };
  } catch (err) {
    console.error("[sendEditRequestReceivedEmail] Failed:", String(err?.message || err));
    return { sent: false, error: String(err?.message || err) };
  }
}

// ============================================================================
// sendCancelRequestReceivedEmail
// ============================================================================
export async function sendCancelRequestReceivedEmail({ toEmail, customerName, reservationId }) {
  const recipient = String(toEmail || "").trim().toLowerCase();
  if (!recipient) return { sent: false, reason: "no_recipient" };
  if (!isSmtpConfigured()) return { sent: false, devMode: true };
  const primaryOrigin = (process.env.APP_URL || "http://localhost:5173").split(",")[0].trim();
  const formattedId = `#${String(reservationId).padStart(6, "0")}`;
  const safeName = customerName || "Guest";

  try {
    await getTransporter().sendMail({
      from: `"Phūrai Restaurant" <${getSmtpFrom()}>`,
      to: recipient,
      subject: `[Phūrai] We've Received Your Cancellation Request for ${formattedId}`,
      text: `Dear ${safeName},\n\nWe have received your request to cancel reservation ${formattedId}.\n\nOur management team will process your request shortly. You will receive another email once your cancellation is confirmed and any applicable refunds are initiated.\n\nView your reservation: ${primaryOrigin}/my-reservations\n\n© 2026 Phūrai Restaurant & Bar`,
      html: `<p>Dear <strong>${safeName}</strong>,</p><p>We have received your request to cancel reservation <strong>${formattedId}</strong>.</p><p>Our management team will process your request shortly. You will receive another email once your cancellation is confirmed and any applicable refunds are initiated.</p><p><a href="${primaryOrigin}/my-reservations">View My Reservation →</a></p>`,
    });
    console.log(`[sendCancelRequestReceivedEmail] Sent to ${recipient} for ${formattedId}`);
    return { sent: true };
  } catch (err) {
    console.error("[sendCancelRequestReceivedEmail] Failed:", String(err?.message || err));
    return { sent: false, error: String(err?.message || err) };
  }
}

// ============================================================================
// sendReservationReminderEmail
// ============================================================================
export async function sendReservationReminderEmail({ toEmail, customerName, reservationId, reservationDate, reservationTime }) {
  const recipient = String(toEmail || "").trim().toLowerCase();
  if (!recipient) return { sent: false, reason: "no_recipient" };
  if (!isSmtpConfigured()) return { sent: false, devMode: true };
  const primaryOrigin = (process.env.APP_URL || "http://localhost:5173").split(",")[0].trim();
  const formattedId = `#${String(reservationId).padStart(6, "0")}`;
  const safeName = customerName || "Guest";

  try {
    await getTransporter().sendMail({
      from: `"Phūrai Restaurant" <${getSmtpFrom()}>`,
      to: recipient,
      subject: `[Phūrai] Reminder: Your Upcoming Reservation ${formattedId}`,
      text: `Dear ${safeName},\n\nWe look forward to welcoming you soon!\n\nYour reservation ${formattedId} is scheduled for ${reservationDate} at ${reservationTime}.\n\nPlease check in at the front desk upon arrival.\n\nView your reservation: ${primaryOrigin}/my-reservations\n\n© 2026 Phūrai Restaurant & Bar`,
      html: `<p>Dear <strong>${safeName}</strong>,</p><p>We look forward to welcoming you soon!</p><p>Your reservation <strong>${formattedId}</strong> is scheduled for <strong>${reservationDate}</strong> at <strong>${reservationTime}</strong>.</p><p>Please check in at the front desk upon arrival.</p><p><a href="${primaryOrigin}/my-reservations">View My Reservation →</a></p>`,
    });
    console.log(`[sendReservationReminderEmail] Sent to ${recipient} for ${formattedId}`);
    return { sent: true };
  } catch (err) {
    console.error("[sendReservationReminderEmail] Failed:", String(err?.message || err));
    return { sent: false, error: String(err?.message || err) };
  }
}

// ============================================================================
// sendReservationInvoiceEmail
// ============================================================================
export async function sendReservationInvoiceEmail({ to, reservation, preorderItems, totalAmount, paymentId }) {
  const recipient = String(to || "").trim().toLowerCase();
  if (!recipient) return { sent: false, reason: "no_recipient" };
  if (!isSmtpConfigured()) return { sent: false, devMode: true };
  const primaryOrigin = (process.env.APP_URL || "http://localhost:5173").split(",")[0].trim();
  const formattedId = `#${String(reservation.reservation_id).padStart(6, "0")}`;
  const safeName = reservation.contact_name || "Guest";

  const formatDateTimeVN = (dateObj) => {
    if (!dateObj) return '—';
    const d = new Date(dateObj);
    if (isNaN(d.getTime())) return String(dateObj);
    const pad = (n) => String(n).padStart(2, '0');
    // GMT+7 time offset adjustment if server timezone differs, but usually d.toLocale... is fine.
    // Let's use simple UTC/Local pad formatting:
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const formatDateVN = (dateObj) => {
    if (!dateObj) return '—';
    const d = new Date(dateObj);
    if (isNaN(d.getTime())) return String(dateObj);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  };

  const infoRow = (label, value) => `
    <tr>
      <td style="padding:8px 0;font-size:13px;color:#8a7a60;width:170px;vertical-align:top;">${label}</td>
      <td style="padding:8px 0;font-size:14px;color:#2c1d0a;font-weight:600;">${value}</td>
    </tr>`;

  const depositAmount = Number(reservation.deposit_amount || 0);
  const finalRemaining = Number(reservation.final_total || 0);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Reservation Have Been Successful — Phūrai</title>
</head>
<body style="margin:0;padding:0;background:#f8f5ef;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f5ef;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(31,26,23,0.10);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1008 0%,#2c1d0a 100%);padding:36px 48px;text-align:center;">
              <h1 style="margin:0;font-size:32px;letter-spacing:0.14em;color:#c9a96e;font-weight:300;">Phūrai</h1>
              <p style="margin:6px 0 0;color:#8a7a60;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;">Restaurant &amp; Bar</p>
            </td>
          </tr>

          <!-- Gold divider -->
          <tr><td style="height:3px;background:linear-gradient(90deg,transparent,#c9a96e,transparent);"></td></tr>

          <!-- Status badge -->
          <tr>
            <td style="padding:28px 48px 0;text-align:center;">
              <span style="display:inline-block;background:#d4edda;color:#155724;font-size:12px;font-weight:700;padding:6px 18px;border-radius:24px;letter-spacing:0.08em;text-transform:uppercase;">
                ✓ Your Reservation Have Been Successful
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 48px 36px;">
              <p style="margin:0 0 24px;font-size:15px;color:#4a3f35;line-height:1.7;">
                Dear <strong style="color:#2c1d0a;">${safeName}</strong>,<br />
                We are delighted to confirm that your table reservation at Phūrai has been successfully processed and confirmed.
              </p>

              <!-- Main Details Ticket -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f2;border:1px solid #e8dcc8;border-radius:10px;margin:0 0 28px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <p style="margin:0 0 14px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#a09080;font-weight:600;">
                      Reservation Information
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      ${infoRow("Your Reservation ID", `<strong style="color:#9f7c3a;font-size:15px;">${formattedId}</strong>`)}
                      ${paymentId ? infoRow("Payment ID", `<strong style="color:#9f7c3a;font-size:15px;">#${paymentId}</strong>`) : ''}
                      ${infoRow("Request time", formatDateTimeVN(reservation.created_at))}
                      ${infoRow("Customer Name", safeName)}
                      ${infoRow("Phone Number", reservation.contact_phone || "—")}
                      ${infoRow("Email Address", recipient)}
                      ${infoRow("Reservation Date", formatDateVN(reservation.reservation_start_at))}
                      ${infoRow("Arrival Time", reservation.time || "—")}
                      ${infoRow("Guest Count", `${reservation.guest_count} guests`)}
                      ${infoRow("Dining Area", reservation.area_name || "Standard area")}
                      ${infoRow("Assigned Table(s)", reservation.table_names ? `<strong>#${reservation.table_names}</strong>` : "Assigned on arrival")}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Payment summary & Preorders -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f2;border:1px solid #e8dcc8;border-radius:10px;margin:0 0 28px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <p style="margin:0 0 14px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#a09080;font-weight:600;">
                      Payment &amp; Pre-orders
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px; line-height: 1.6;">
                      ${preorderItems && preorderItems.length > 0 ? `
                        <tr>
                          <td colspan="2" style="font-weight: 600; font-size:13px; color:#a09080; padding-bottom: 6px; border-bottom: 1px dashed #e8dcc8;">Pre-ordered Items:</td>
                        </tr>
                        ${preorderItems.map(item => `
                          <tr>
                            <td style="padding: 8px 0; border-bottom: 1px solid #eee; color:#4a3f35;">${item.dish_name || item.name} x${item.quantity || item.qty}</td>
                            <td align="right" style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: 600; color:#2c1d0a;">${Number(item.price || item.unit_price || 0).toLocaleString('vi-VN')} đ</td>
                          </tr>
                        `).join('')}
                      ` : ''}
                      <tr>
                        <td style="padding: 8px 0; color:#4a3f35;">Table Charge:</td>
                        <td align="right" style="padding: 8px 0; font-weight: 600; color:#2c1d0a;">20.000 đ</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color:#4a3f35; font-weight: 600;">Total Paid (30% Deposit):</td>
                        <td align="right" style="padding: 8px 0; font-weight: 700; color:#27ae60; font-size: 16px;">${depositAmount.toLocaleString('vi-VN')} đ</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color:#8a7a60; font-style: italic;">Remaining Balance (70%):</td>
                        <td align="right" style="padding: 8px 0; font-weight: 600; color:#8a7a60; font-style: italic;">${finalRemaining.toLocaleString('vi-VN')} đ</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Action Link -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 32px; width:100%;">
                <tr>
                  <td align="center">
                    <div style="background:linear-gradient(135deg,#9f7c3a,#c9a96e);border-radius:8px; display:inline-block;">
                      <a href="${primaryOrigin}/my-reservations"
                         style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:600;color:#fff;text-decoration:none;letter-spacing:0.06em;">
                        View My Reservation &rarr;
                      </a>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:14px;color:#4a3f35;line-height:1.8;font-style:italic;text-align:center;">
                We look forward to welcoming you at Phūrai. Thank you for dining with us! 🌸
              </p>
            </td>
          </tr>

          <!-- Gold divider -->
          <tr><td style="height:1px;background:linear-gradient(90deg,transparent,#e8dcc8,transparent);"></td></tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 48px;text-align:center;background:#fcfbf9;">
              <p style="margin:0 0 4px;font-size:12px;color:#a09080;">&copy; 2026 Phūrai Restaurant &amp; Bar. All rights reserved.</p>
              <p style="margin:0;font-size:11px;color:#b8a898;">This is an automated email. Please do not reply directly to this message.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    await getTransporter().sendMail({
      from: `"Phūrai Restaurant" <${getSmtpFrom()}>`,
      to: recipient,
      subject: `[Phūrai] Successful Reservation Confirmation — ${formattedId}`,
      html,
    });
    console.log(`[sendReservationInvoiceEmail] Sent to ${recipient} for ${formattedId}`);
    return { sent: true };
  } catch (err) {
    console.error("[sendReservationInvoiceEmail] Failed:", String(err?.message || err));
    return { sent: false, error: String(err?.message || err) };
  }
}

// ============================================================================
// sendCheckoutReceiptEmail
// ============================================================================
export async function sendCheckoutReceiptEmail({ toEmail, customerName, orderId, items, discountAmount, totalPaid, tableNumber, dateStr }) {
  const recipient = String(toEmail || "").trim().toLowerCase();
  if (!recipient) return { sent: false, reason: "no_recipient" };
  if (!isSmtpConfigured()) return { sent: false, devMode: true };
  const primaryOrigin = (process.env.APP_URL || "http://localhost:5173").split(",")[0].trim();
  const formattedId = `#ORD${String(orderId).padStart(6, "0")}`;
  const safeName = customerName || "Guest";
  
  const discountHtml = discountAmount > 0 
    ? `
      <tr>
        <td style="padding: 8px 0; color:#4a3f35; font-weight: 600;">Discount Applied:</td>
        <td align="right" style="padding: 8px 0; font-weight: 700; color:#c0392b;">-${Number(discountAmount).toLocaleString('vi-VN')} đ</td>
      </tr>
    ` : '';

  const itemsHtml = items && items.length > 0 ? items.map(item => `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee; color:#4a3f35;">${item.name} x${item.quantity || item.qty}</td>
      <td align="right" style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: 600; color:#2c1d0a;">${Number(item.price || item.unit_price || 0).toLocaleString('vi-VN')} đ</td>
    </tr>
  `).join('') : '';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Payment Receipt — Phūrai</title>
</head>
<body style="margin:0;padding:0;background:#f8f5ef;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f5ef;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(31,26,23,0.10);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1008 0%,#2c1d0a 100%);padding:36px 48px;text-align:center;">
              <h1 style="margin:0;font-size:32px;letter-spacing:0.14em;color:#c9a96e;font-weight:300;">Phūrai</h1>
              <p style="margin:6px 0 0;color:#8a7a60;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;">Restaurant &amp; Bar</p>
            </td>
          </tr>
          <!-- Status badge -->
          <tr>
            <td style="padding:28px 48px 0;text-align:center;">
              <span style="display:inline-block;background:#d4edda;color:#155724;font-size:12px;font-weight:700;padding:6px 18px;border-radius:24px;letter-spacing:0.08em;text-transform:uppercase;">
                ✓ Payment Successful
              </span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:28px 48px 36px;">
              <p style="margin:0 0 24px;font-size:15px;color:#4a3f35;line-height:1.7;">
                Dear <strong style="color:#2c1d0a;">${safeName}</strong>,<br />
                Thank you for dining at Phūrai! Here is your final receipt.
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f2;border:1px solid #e8dcc8;border-radius:10px;margin:0 0 28px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <p style="margin:0 0 14px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#a09080;font-weight:600;">
                      Order Information
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:8px 0;font-size:13px;color:#8a7a60;width:170px;vertical-align:top;">Order Reference</td>
                        <td style="padding:8px 0;font-size:14px;color:#2c1d0a;font-weight:600;">${formattedId}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:13px;color:#8a7a60;width:170px;vertical-align:top;">Date</td>
                        <td style="padding:8px 0;font-size:14px;color:#2c1d0a;font-weight:600;">${dateStr}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:13px;color:#8a7a60;width:170px;vertical-align:top;">Table</td>
                        <td style="padding:8px 0;font-size:14px;color:#2c1d0a;font-weight:600;">${tableNumber}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Payment summary & Items -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f2;border:1px solid #e8dcc8;border-radius:10px;margin:0 0 28px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <p style="margin:0 0 14px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#a09080;font-weight:600;">
                      Receipt Items
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px; line-height: 1.6;">
                      ${itemsHtml}
                      ${discountHtml}
                      <tr>
                        <td style="padding: 8px 0; color:#4a3f35; font-weight: 600;">Total Paid:</td>
                        <td align="right" style="padding: 8px 0; font-weight: 700; color:#27ae60; font-size: 16px;">${Number(totalPaid).toLocaleString('vi-VN')} đ</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:14px;color:#4a3f35;line-height:1.8;font-style:italic;text-align:center;">
                We look forward to welcoming you back to Phūrai! 🌸
              </p>
            </td>
          </tr>
          <tr><td style="height:1px;background:linear-gradient(90deg,transparent,#e8dcc8,transparent);"></td></tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 48px;text-align:center;background:#fcfbf9;">
              <p style="margin:0 0 4px;font-size:12px;color:#a09080;">&copy; 2026 Phūrai Restaurant &amp; Bar. All rights reserved.</p>
              <p style="margin:0;font-size:11px;color:#b8a898;">This is an automated email. Please do not reply directly to this message.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    await getTransporter().sendMail({
      from: `"Phūrai Restaurant" <${getSmtpFrom()}>`,
      to: recipient,
      subject: `[Phūrai] Payment Receipt — ${formattedId}`,
      html,
    });
    console.log(`[sendCheckoutReceiptEmail] Sent to ${recipient} for ${formattedId}`);
    return { sent: true };
  } catch (err) {
    console.error("[sendCheckoutReceiptEmail] Failed:", String(err?.message || err));
    return { sent: false, error: String(err?.message || err) };
  }
}
