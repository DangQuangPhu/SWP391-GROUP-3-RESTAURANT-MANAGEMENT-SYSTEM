import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL, updateProfile, saveAuthUser, loadAuthUser } from "../components/auth/api";
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
    fullName:
      user.fullName ||
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim(),
    nickname: user.nickname || user.username,
  };
}

const PROFILE_API_FIELD_KEYS = new Set([
  "firstName",
  "lastName",
  "fullName",
  "username",
  "phone",
  "phoneNumber",
  "dateOfBirth",
]);

function hasProfileApiFields(fields) {
  return PROFILE_API_FIELD_KEYS.some((key) => Object.prototype.hasOwnProperty.call(fields, key));
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

  useEffect(() => {
    setExtended(loadExtended(userId, email));
  }, [userId, email]);

  useEffect(() => {
    if (!userId && !email) return;

    const userKey = String(userId || email);
    if (apiFailedRef.current.has(userKey)) return;

    let cancelled = false;

    const loadProfile = async () => {
      if (!userId || String(userId).startsWith("mock-")) {
        const local = loadLocalProfile(email);
        if (!cancelled && Object.keys(local).length) {
          setExtended((prev) => ({ ...prev, ...local }));
        }
        return;
      }

      setLoading(true);
      try {
        const { payload: data, failed } = await fetchProfileSafe(userId, email);
        if (cancelled) return;

        if (failed) {
          apiFailedRef.current.add(userKey);
        }

        if (data?.user) {
          const normalized = {
            ...data.user,
            avatarUrl: normalizeStoredAvatarUrl(data.user.avatarUrl),
            id: data.user.id ?? data.user.userId,
            userId: data.user.userId ?? data.user.id,
          };
          onUserUpdateRef.current?.(normalized);
          return;
        }

        if (data && typeof data === "object") {
          setExtended((prev) => ({ ...prev, ...data }));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadProfile().catch(() => {
      apiFailedRef.current.add(userKey);
      const local = loadLocalProfile(email);
      if (!cancelled && Object.keys(local).length) {
        setExtended((prev) => ({ ...prev, ...local }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [userId, email]);

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
      const nameParts = String(fullName || "")
        .trim()
        .split(/\s+/);
      const apiPayload = {
        firstName: firstName || nameParts[0] || user?.firstName,
        lastName:
          lastName || (nameParts.length > 1 ? nameParts.slice(1).join(" ") : user?.lastName),
        username: username ?? user?.username,
        phone: phone ?? phoneNumber ?? user?.phone,
        dateOfBirth: dateOfBirth ?? user?.dateOfBirth,
      };

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
        } catch {
          apiUser = { ...user, ...apiPayload, fullName: fullName || user?.fullName };
        }
      }

      const resolvedDateOfBirth =
        dateOfBirth ?? extended.dateOfBirth ?? apiUser?.dateOfBirth ?? "";

      const nextExtended = {
        gender: gender ?? extended.gender,
        country: country ?? extended.country,
        language: language ?? extended.language,
        timeZone: timeZone ?? extended.timeZone,
        dateOfBirth: resolvedDateOfBirth,
        address: address ?? extended.address,
        bio: bio ?? extended.bio,
        coverTheme: coverTheme ?? extended.coverTheme,
        reduceMotion: reduceMotion ?? extended.reduceMotion,
        largerText: largerText ?? extended.largerText,
        highContrast: highContrast ?? extended.highContrast,
      };

      persistExtended(nextExtended);

      const mergedAuthUser = {
        ...apiUser,
        fullName: fullName || apiUser.fullName,
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
    status: extended.status,
    saveStatus,
    clearStatus,
    saveProfileFields,
    applyAvatarUpdate,
    persistExtended,
  };
}

export function getStoredAuthUser() {
  return loadAuthUser();
}
