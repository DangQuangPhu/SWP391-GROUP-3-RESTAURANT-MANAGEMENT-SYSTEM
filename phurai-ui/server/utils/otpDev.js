export const DEV_OTP_SAMPLE_EMAILS = new Set([
  "nguyenminhan@gmail.com",
  "tranmylinh@gmail.com",
  "lebaokhanh@gmail.com",
]);

export function isDevOtpSampleEmail(email) {
  return DEV_OTP_SAMPLE_EMAILS.has(String(email || "").trim().toLowerCase());
}

export function logDevOtp(email, purpose, code) {
  const normalizedPurpose = String(purpose || "EMAIL_VERIFY").toUpperCase();
  console.log(`[DEV OTP] ${email} ${normalizedPurpose} code: ${code}`);
}

export function logOtpSent(email) {
  console.log(`OTP has been sent to ${email}`);
}
