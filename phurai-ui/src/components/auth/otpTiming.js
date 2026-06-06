export const OTP_EXPIRES_IN_SECONDS = 5 * 60;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

export function formatOtpExpiry(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function resolveRetryAfterSeconds(data = {}) {
  const value = data.retryAfter ?? data.retryAfterSeconds;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : OTP_RESEND_COOLDOWN_SECONDS;
}

export function buildInitialTiming(data) {
  if (!data || (data.expiresIn == null && data.resendCooldown == null)) {
    return null;
  }

  return {
    expiresIn: data.expiresIn,
    resendCooldown: data.resendCooldown,
  };
}

export function applyOtpSentTiming(data, { setOtpExpiresIn, setResendSeconds }) {
  const expiresIn = Number(data?.expiresIn);
  const resendCooldown = Number(data?.resendCooldown);

  if (typeof setOtpExpiresIn === "function") {
    setOtpExpiresIn(
      Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : OTP_EXPIRES_IN_SECONDS
    );
  }

  if (typeof setResendSeconds === "function") {
    setResendSeconds(
      Number.isFinite(resendCooldown) && resendCooldown > 0
        ? resendCooldown
        : OTP_RESEND_COOLDOWN_SECONDS
    );
  }
}
