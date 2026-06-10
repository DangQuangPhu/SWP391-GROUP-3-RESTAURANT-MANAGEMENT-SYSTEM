import {
  authHeaders,
  createApiError,
  request,
} from "./httpClient.js";
import { mapApiUserToFrontend } from "@/utils/userMapper.js";

export function registerAccount(payload) {
  return request("/register", {
    method: "POST",
    body: JSON.stringify({
      firstName: payload.firstName,
      lastName: payload.lastName,
      username: payload.username,
      email: payload.email,
      phoneNumber: payload.phoneNumber,
      dateOfBirth: payload.dateOfBirth,
      password: payload.password,
      confirmPassword: payload.confirmPassword,
    }),
  });
}

export async function loginAccount(payload) {
  const data = await request("/login", {
    method: "POST",
    body: JSON.stringify({
      email: payload.email,
      emailOrUsername: payload.emailOrUsername,
      identifier: payload.identifier,
      password: payload.password,
    }),
  });

  if (data?.user) {
    return { ...data, user: mapApiUserToFrontend(data.user) };
  }
  return data;
}

export function verifyOtp({ email, otp, purpose = "EMAIL_VERIFY", userId }) {
  const body = {
    email: String(email || "").trim().toLowerCase(),
    otp,
    purpose,
  };

  if (userId) {
    body.userId = userId;
  }

  return request("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function verifyEmailCode({ email, userId, code }) {
  return verifyOtp({
    email,
    userId,
    otp: code,
    purpose: "EMAIL_VERIFY",
  });
}

export function requestOtp({ email, purpose = "EMAIL_VERIFY" }) {
  return request("/auth/request-otp", {
    method: "POST",
    body: JSON.stringify({
      email: String(email || "").trim().toLowerCase(),
      purpose,
    }),
  });
}

export function resendOtp({ email, purpose = "EMAIL_VERIFY" }) {
  return request("/auth/resend-otp", {
    method: "POST",
    body: JSON.stringify({
      email: String(email || "").trim().toLowerCase(),
      purpose,
    }),
  });
}

export function resendVerificationCode({ email, purpose = "EMAIL_VERIFY" } = {}) {
  return resendOtp({ email, purpose });
}

export function googleRegister(credential) {
  return request("/auth/google-register", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });
}

export function googleRegisterWithAccessToken(accessToken) {
  return request("/auth/google-register", {
    method: "POST",
    body: JSON.stringify({ accessToken }),
  });
}

export function googleLogin(payload) {
  return request("/auth/google", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function forgotPasswordRequestOtp({ email, purpose, userId } = {}) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return Promise.reject(
      createApiError("Email is required.", {
        status: 400,
        data: { message: "Email is required." },
      })
    );
  }

  const body = { email: normalizedEmail };
  if (purpose) {
    body.purpose = purpose;
  }
  if (userId) {
    body.userId = userId;
  }

  return request("/auth/forgot-password/request-otp", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** @deprecated Use forgotPasswordRequestOtp */
export function forgotPasswordRequest(payload) {
  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (trimmed.includes("@")) {
      return forgotPasswordRequestOtp({ email: trimmed });
    }
    return Promise.reject(
      createApiError("Email is required.", {
        status: 400,
        data: { message: "Email is required." },
      })
    );
  }

  const email = payload?.email || payload?.identifier;
  if (email && String(email).includes("@")) {
    return forgotPasswordRequestOtp({
      email: String(email).trim().toLowerCase(),
    });
  }

  return Promise.reject(
    createApiError("Email is required.", {
      status: 400,
      data: { message: "Email is required." },
    })
  );
}

export function forgotPasswordVerifyOtp({
  email,
  otp,
  code,
  purpose = "forgot_password",
  phone,
  userId,
} = {}) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedOtp = String(otp ?? code ?? "").trim();

  if (!normalizedEmail || !normalizedOtp) {
    return Promise.reject(
      createApiError("Email and OTP are required.", {
        status: 400,
        data: { message: "Email and OTP are required." },
      })
    );
  }

  const body = {
    email: normalizedEmail,
    otp: normalizedOtp,
    purpose,
  };

  if (phone) {
    body.phone = String(phone).replace(/\D/g, "");
  }

  if (userId) {
    body.userId = userId;
  }

  return request("/auth/forgot-password/verify-otp", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function forgotPasswordResendOtp({ email, purpose = "forgot_password", userId } = {}) {
  const body = {
    email: String(email || "").trim().toLowerCase(),
    purpose,
  };

  if (userId) {
    body.userId = userId;
  }

  return request("/auth/forgot-password/resend-otp", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function forgotPasswordReset({
  email,
  otp,
  code,
  newPassword,
  confirmPassword,
} = {}) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedOtp = String(otp ?? code ?? "").trim();

  if (!normalizedEmail || !normalizedOtp || !newPassword) {
    return Promise.reject(
      createApiError("Email, OTP, and new password are required.", {
        status: 400,
        data: { message: "Email, OTP, and new password are required." },
      })
    );
  }

  if (confirmPassword != null && newPassword !== confirmPassword) {
    return Promise.reject(
      createApiError("Passwords do not match.", {
        status: 400,
        data: { message: "Passwords do not match." },
      })
    );
  }

  return request("/auth/forgot-password/reset", {
    method: "POST",
    body: JSON.stringify({
      email: normalizedEmail,
      otp: normalizedOtp,
      new_password: newPassword,
    }),
  });
}

export function changePassword({ userId, email, currentPassword, newPassword, confirmPassword }) {
  const body = {
    old_password: currentPassword,
    new_password: newPassword,
  };

  if (userId != null && userId !== "") {
    body.user_id = userId;
  }
  if (email) {
    body.email = String(email).trim().toLowerCase();
  }

  return request("/auth/change-password", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
}

export function verifyOldPassword(userId, oldPassword) {
  return request("/auth/profile/change-password/verify-old", {
    method: "POST",
    body: JSON.stringify({ userId, oldPassword }),
  });
}

export function resetProfilePassword(payload) {
  return request("/auth/profile/change-password/reset", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export const changePasswordReset = resetProfilePassword;
