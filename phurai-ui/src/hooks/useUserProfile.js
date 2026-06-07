import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL, updateProfile, updateProfilePhone, saveAuthUser, loadAuthUser } from "../components/auth/api";
import { normalizePhone, splitFullName } from "../components/auth/authHelpers";
import { normalizeStoredAvatarUrl } from "../components/auth/avatarUtils";

const DEFAULT_EXTENDED = {
  gender: "",
  country: "",
  language: "",
  timeZone: "",
  dateOfBirth: "",
  address: "",
  bio: "",
  status: null,
  coverTheme: "blue-cream",
  reduceMotion: false,
  largerText: false,
  highContrast: false,
};

function getUserId(user) {
  return user?.userId ?? user?.id ?? null;
}

function getProfileStorageKey(email) {
  return `phurai:user-profile:${email || "guest"}`;
}

function loadLocalProfile(email) {
  try {
    const raw = localStorage.getItem(getProfileStorageKey(email));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function storageKey(userId) {
  return userId ? `phurai:user-profile:${userId}` : null;
}

function storageKeyByEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  return normalized ? `phurai:user-profile:${normalized}` : null;
}

function loadExtended(userId, email) {
  const keys = [storageKey(userId), storageKeyByEmail(email), getProfileStorageKey(email)].filter(
    Boolean
  );
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_EXTENDED, ...parsed };
    } catch {
      continue;
    }
  }
  return { ...DEFAULT_EXTENDED };
}

function saveExtended(userId, email, data) {
  const payload = JSON.stringify(data);
  const keys = [storageKey(userId), storageKeyByEmail(email), getProfileStorageKey(email)].filter(
    Boolean
  );
  keys.forEach((key) => localStorage.setItem(key, payload));
}

function mergeUser(user, extended) {
  if (!user) return null;
  const dateOfBirth =
    extended.dateOfBirth || user.dateOfBirth || user.dob || "";
  return {
    ...user,
    ...extended,
    dateOfBirth,
    dob: dateOfBirth,
    avatarUrl: normalizeStoredAvatarUrl(user.avatarUrl),
    googleAvatarUrl:
      user.googleAvatarUrl || user.google_avatar_url || user.picture || "",
    avatarSource: user.avatarSource || user.avatar_source || "",
    fullName:
      user.fullName ||
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim(),
    nickname: user.nickname || user.username,
  };
}

const PROFILE_API_FIELD_KEYS = [
  "firstName",
  "lastName",
  "fullName",
  "username",
  "phone",
  "phoneNumber",
  "dateOfBirth",
  "gender",
  "bio",
  "address",
  "country",
  "language",
  "avatarUrl",
  "googleAvatarUrl",
];

function hasProfileApiFields(fields) {
  return PROFILE_API_FIELD_KEYS.some((key) =>
    Object.prototype.hasOwnProperty.call(fields, key)
  );
}

function getEmailLocalPart(email = "") {
  const normalized = String(email || "").trim().toLowerCase();
  return normalized.includes("@") ? normalized.split("@")[0] : normalized;
}

function buildProfileApiPayload(user, fields, extended) {
  const hasFullNameField = Object.prototype.hasOwnProperty.call(fields, "fullName");
  const fullName = String(
    hasFullNameField ? fields.fullName ?? "" : fields.fullName ?? user?.fullName ?? ""
  ).trim();
  const { firstName, lastName } = splitFullName(
    fullName || user?.fullName || user?.firstName || "User"
  );
  const fallbackUsername = (
    fields.username ??
    user?.username ??
    (getEmailLocalPart(user?.email) || "user")
  )
    .trim()
    .toLowerCase();

  return {
    fullName: fullName || user?.fullName,
    firstName,
    lastName,
    username: fallbackUsername,
    phone: fields.phone ?? fields.phoneNumber ?? user?.phone ?? "",
    phoneNumber: fields.phone ?? fields.phoneNumber ?? user?.phoneNumber ?? "",
    dateOfBirth: fields.dateOfBirth ?? user?.dateOfBirth ?? extended.dateOfBirth ?? "",
    gender: fields.gender ?? user?.gender ?? extended.gender ?? "",
    bio: fields.bio ?? user?.bio ?? extended.bio ?? "",
    address: fields.address ?? user?.address ?? extended.address ?? "",
    country: fields.country ?? user?.country ?? extended.country ?? "",
    language: fields.language ?? user?.language ?? extended.language ?? "",
  };
}

async function fetchProfileSafe(userId, email) {
  if (!userId) {
    return { payload: loadLocalProfile(email), failed: false };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/profile/${encodeURIComponent(userId)}`);

    if (!response.ok) {
      console.warn("Profile API unavailable, using local profile fallback.");
      return { payload: loadLocalProfile(email), failed: true };
    }

    return { payload: await response.json(), failed: false };
  } catch (error) {
    console.warn("Profile API failed, using local profile fallback.", error);
    return { payload: loadLocalProfile(email), failed: true };
  }
}

export function useUserProfile(user, onUserUpdate) {
  const userId = getUserId(user);
  const email = user?.email || "";
  const onUserUpdateRef = useRef(onUserUpdate);
  const apiFailedRef = useRef(new Set());

  onUserUpdateRef.current = onUserUpdate;

  const [extended, setExtended] = useState(() => loadExtended(userId, email));
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    setExtended(loadExtended(userId, email));
  }, [userId, email]);

  const applyProfilePayload = useCallback((data) => {
    if (data?.user) {
      const normalized = {
        ...data.user,
        avatarUrl: normalizeStoredAvatarUrl(data.user.avatarUrl),
        googleAvatarUrl:
          data.user.googleAvatarUrl || data.user.google_avatar_url || "",
        avatarSource: data.user.avatarSource || data.user.avatar_source || "",
        id: data.user.id ?? data.user.userId,
        userId: data.user.userId ?? data.user.id,
      };
      onUserUpdateRef.current?.(normalized);
      setExtended((prev) => ({
        ...prev,
        gender: data.user.gender ?? prev.gender,
        bio: data.user.bio ?? prev.bio,
        address: data.user.address ?? prev.address,
        country: data.user.country ?? prev.country,
        language: data.user.language ?? prev.language,
        dateOfBirth: data.user.dateOfBirth || prev.dateOfBirth,
      }));
      return;
    }

    if (data && typeof data === "object") {
      setExtended((prev) => ({ ...prev, ...data }));
    }
  }, []);

  const fetchAndApplyProfile = useCallback(
    async ({ skipCache = false } = {}) => {
      if (!userId && !email) return { failed: false };

      const userKey = String(userId || email);
      if (!skipCache && apiFailedRef.current.has(userKey)) {
        return { failed: true, cached: true };
      }

      if (!userId || String(userId).startsWith("mock-")) {
        const local = loadLocalProfile(email);
        if (Object.keys(local).length) {
          setExtended((prev) => ({ ...prev, ...local }));
        }
        return { failed: false };
      }

      setLoading(true);
      setLoadError(null);

      try {
        const { payload: data, failed } = await fetchProfileSafe(userId, email);

        if (failed) {
          apiFailedRef.current.add(userKey);
          setLoadError("Could not refresh profile from the server. Showing saved data.");
          const local = loadLocalProfile(email);
          if (Object.keys(local).length) {
            setExtended((prev) => ({ ...prev, ...local }));
          }
          return { failed: true };
        }

        apiFailedRef.current.delete(userKey);
        applyProfilePayload(data);
        return { failed: false };
      } catch {
        apiFailedRef.current.add(userKey);
        setLoadError("Could not load profile. Showing saved data.");
        const local = loadLocalProfile(email);
        if (Object.keys(local).length) {
          setExtended((prev) => ({ ...prev, ...local }));
        }
        return { failed: true };
      } finally {
        setLoading(false);
      }
    },
    [userId, email, applyProfilePayload]
  );

  useEffect(() => {
    if (!userId && !email) return undefined;

    let cancelled = false;

    fetchAndApplyProfile().catch(() => {
      if (cancelled) return;
      const local = loadLocalProfile(email);
      if (Object.keys(local).length) {
        setExtended((prev) => ({ ...prev, ...local }));
      }
      setLoadError("Could not load profile. Showing saved data.");
    });

    return () => {
      cancelled = true;
    };
  }, [userId, email, fetchAndApplyProfile]);

  const refetchProfile = useCallback(async () => {
    const userKey = String(userId || email);
    apiFailedRef.current.delete(userKey);
    return fetchAndApplyProfile({ skipCache: true });
  }, [userId, email, fetchAndApplyProfile]);

  const profile = useMemo(() => mergeUser(user, extended), [user, extended]);

  const persistExtended = useCallback(
    (patch) => {
      if (!userId && !email) return;
      setExtended((prev) => {
        const next = { ...prev, ...patch };
        saveExtended(userId, email, next);
        return next;
      });
    },
    [userId, email]
  );

  const saveStatus = useCallback(
    (status) => {
      persistExtended({ status });
    },
    [persistExtended]
  );

  const clearStatus = useCallback(() => {
    persistExtended({ status: null });
  }, [persistExtended]);

  const savePhoneNumber = useCallback(
    async (phoneNumber) => {
      const normalized = normalizePhone(phoneNumber);
      if (!normalized) {
        throw new Error("Phone number is required.");
      }

      let apiUser = user;

      if (userId) {
        try {
          const data = await updateProfilePhone(userId, normalized);
          if (data?.user) {
            apiUser = {
              ...data.user,
              avatarUrl: normalizeStoredAvatarUrl(data.user.avatarUrl),
              id: data.user.id ?? data.user.userId,
              userId: data.user.userId ?? data.user.id,
            };
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            console.error("Phone update failed:", error);
          }
          const apiErrors = error?.data?.errors;
          const phoneError = apiErrors?.phoneNumber || apiErrors?.phone;
          if (phoneError) {
            const enhanced = new Error(phoneError);
            enhanced.status = error.status;
            enhanced.data = error.data;
            throw enhanced;
          }
          if (error?.message && !error.message.includes("Validation failed")) {
            throw error;
          }
          throw new Error(error?.message || "Could not save phone number.");
        }
      }

      const mergedAuthUser = {
        ...apiUser,
        phone: apiUser.phone ?? normalized,
        phoneNumber: apiUser.phoneNumber ?? normalized,
      };
      const remember = Boolean(localStorage.getItem("phurai_auth_user"));
      saveAuthUser(mergedAuthUser, remember);
      onUserUpdateRef.current?.(mergedAuthUser);
      return mergeUser(mergedAuthUser, extended);
    },
    [user, userId, extended]
  );

  const saveProfileFields = useCallback(
    async (fields) => {
      const {
        firstName,
        lastName,
        fullName,
        username,
        phone,
        phoneNumber,
        dateOfBirth,
        gender,
        country,
        language,
        timeZone,
        address,
        bio,
        coverTheme,
        reduceMotion,
        largerText,
        highContrast,
      } = fields;

      let apiUser = user;
      const apiPayload = buildProfileApiPayload(user, fields, extended);

      if (userId && hasProfileApiFields(fields)) {
        try {
          const data = await updateProfile(userId, apiPayload);
          if (data?.user) {
            apiUser = {
              ...data.user,
              avatarUrl: normalizeStoredAvatarUrl(data.user.avatarUrl),
              id: data.user.id ?? data.user.userId,
              userId: data.user.userId ?? data.user.id,
            };
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            console.error("Profile API update failed:", error);
          }
          const apiErrors = error?.data?.errors;
          const firstFieldError =
            apiErrors && typeof apiErrors === "object"
              ? Object.values(apiErrors).find(Boolean)
              : null;
          if (firstFieldError) {
            const enhanced = new Error(firstFieldError);
            enhanced.status = error.status;
            enhanced.data = error.data;
            throw enhanced;
          }
          throw error;
        }
      }

      const resolvedDateOfBirth =
        dateOfBirth ?? extended.dateOfBirth ?? apiUser?.dateOfBirth ?? "";

      const nextExtended = {
        gender: gender ?? apiUser?.gender ?? extended.gender,
        country: country ?? extended.country,
        language: language ?? extended.language,
        timeZone: timeZone ?? extended.timeZone,
        dateOfBirth: resolvedDateOfBirth,
        address: address ?? apiUser?.address ?? extended.address,
        bio: bio ?? apiUser?.bio ?? extended.bio,
        coverTheme: coverTheme ?? extended.coverTheme,
        reduceMotion: reduceMotion ?? extended.reduceMotion,
        largerText: largerText ?? extended.largerText,
        highContrast: highContrast ?? extended.highContrast,
      };

      persistExtended(nextExtended);

      const mergedAuthUser = {
        ...apiUser,
        fullName: fullName || apiUser.fullName,
        username: username ?? apiUser.username,
        gender: gender ?? apiUser.gender,
        bio: bio ?? apiUser.bio,
        country: country ?? apiUser.country,
        language: language ?? apiUser.language,
        googleAvatarUrl: apiUser.googleAvatarUrl || user?.googleAvatarUrl || "",
        avatarSource: apiUser.avatarSource || user?.avatarSource || "",
        phone: apiUser.phone ?? apiPayload.phone ?? apiPayload.phoneNumber,
        phoneNumber: apiUser.phoneNumber ?? apiPayload.phoneNumber ?? apiPayload.phone,
        dateOfBirth: resolvedDateOfBirth,
        dob: resolvedDateOfBirth,
      };
      const remember = Boolean(localStorage.getItem("phurai_auth_user"));
      saveAuthUser(mergedAuthUser, remember);
      onUserUpdateRef.current?.(mergedAuthUser);
      return mergeUser(mergedAuthUser, nextExtended);
    },
    [user, userId, extended, persistExtended]
  );

  const applyAvatarUpdate = useCallback((updatedUser) => {
    const normalized = {
      ...updatedUser,
      avatarUrl: normalizeStoredAvatarUrl(updatedUser.avatarUrl),
      googleAvatarUrl:
        updatedUser.googleAvatarUrl || updatedUser.google_avatar_url || "",
      avatarSource: updatedUser.avatarSource || updatedUser.avatar_source || "",
      id: updatedUser.id ?? updatedUser.userId,
      userId: updatedUser.userId ?? updatedUser.id,
    };
    const remember = Boolean(localStorage.getItem("phurai_auth_user"));
    saveAuthUser(normalized, remember);
    onUserUpdateRef.current?.(normalized);
  }, []);

  return {
    profile,
    extended,
    loading,
    loadError,
    refetchProfile,
    status: extended.status,
    saveStatus,
    clearStatus,
    saveProfileFields,
    savePhoneNumber,
    applyAvatarUpdate,
    persistExtended,
  };
}

export function getStoredAuthUser() {
  return loadAuthUser();
}
