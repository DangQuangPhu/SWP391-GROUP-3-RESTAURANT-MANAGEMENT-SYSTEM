
import { STAFF_ROLE, STAFF_ROLE_LABEL } from "./staffRoles.js";

export const STAFF_BASE = "/staff";

export { STAFF_ROLE, STAFF_ROLE_LABEL };

const ROLE_ID_MAP = {
  2: STAFF_ROLE.RESTAURANT,
};

const ROLE_NAME_MAP = {
  "restaurant staff": STAFF_ROLE.RESTAURANT,
  "kitchen staff": STAFF_ROLE.KITCHEN,
};

export const STAFF_DEFAULT_PATH = {
  [STAFF_ROLE.RESTAURANT]: `${STAFF_BASE}/reservations`,
  [STAFF_ROLE.KITCHEN]:    `/kds`,
};

// Role 2 = Restaurant Staff: all floor ops + KDS (user-JWT Staff view)
// KDS Devices use /kds directly via device-JWT, not through /staff/*
const SEGMENT_ROLE_ACCESS = {
  reservations: [STAFF_ROLE.RESTAURANT],
  tables:       [STAFF_ROLE.RESTAURANT],
  orders:       [STAFF_ROLE.RESTAURANT],
  payments:     [STAFF_ROLE.RESTAURANT],
  kds:          [STAFF_ROLE.RESTAURANT],  // Staff (user-JWT): Ready alerts + Served action
};

export function resolveStaffRole(user) {
  if (!user) return null;

  const roleId = Number(user.roleId ?? user.role_id);
  if (ROLE_ID_MAP[roleId]) return ROLE_ID_MAP[roleId];

  const roleName = String(user.roleName ?? user.role_name ?? user.role ?? "")
    .trim()
    .toLowerCase();

  if (ROLE_NAME_MAP[roleName]) return ROLE_NAME_MAP[roleName];

  return null;
}

export function isStaffPortalUser(user) {
  return Boolean(resolveStaffRole(user));
}

export function getStaffSegment(pathname) {
  const base = STAFF_BASE.endsWith("/") ? STAFF_BASE.slice(0, -1) : STAFF_BASE;
  const prefix = `${base}/`;

  if (pathname === base || pathname === `${base}/`) {
    return "";
  }

  if (!pathname.startsWith(prefix)) {
    return "";
  }

  return pathname.slice(prefix.length).split("/")[0] || "";
}

export function getDefaultStaffPath(role) {
  return STAFF_DEFAULT_PATH[role] || `${STAFF_BASE}/tables`;
}

export function canAccessStaffSegment(role, segment) {
  if (!role || !segment) return false;
  const allowed = SEGMENT_ROLE_ACCESS[segment];
  return Array.isArray(allowed) && allowed.includes(role);
}



export function navItemToPath(item) {
  return `${STAFF_BASE}/${item.segment}`;
}
