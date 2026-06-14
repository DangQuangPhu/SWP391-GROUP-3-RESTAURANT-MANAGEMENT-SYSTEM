import { FLAT_NAV } from "./staffNav.js";

export const STAFF_BASE = "/staff";

export const STAFF_ROLE = {
  RESTAURANT: "restaurant_staff",
  KITCHEN: "kitchen_staff",
};

export const STAFF_ROLE_LABEL = {
  [STAFF_ROLE.RESTAURANT]: "Restaurant Staff",
  [STAFF_ROLE.KITCHEN]: "Kitchen Staff",
};

const ROLE_ID_MAP = {
  2: STAFF_ROLE.RESTAURANT,
  3: STAFF_ROLE.KITCHEN,
};

const ROLE_NAME_MAP = {
  "restaurant staff": STAFF_ROLE.RESTAURANT,
  "kitchen staff": STAFF_ROLE.KITCHEN,
};

export const STAFF_DEFAULT_PATH = {
  [STAFF_ROLE.RESTAURANT]: `${STAFF_BASE}/reservations`,
  [STAFF_ROLE.KITCHEN]: `${STAFF_BASE}/kitchen`,
};

const SEGMENT_ROLE_ACCESS = {
  reservations: [STAFF_ROLE.RESTAURANT],
  tables: [STAFF_ROLE.RESTAURANT],
  orders: [STAFF_ROLE.RESTAURANT],
  kitchen: [STAFF_ROLE.KITCHEN],
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
  return STAFF_DEFAULT_PATH[role] || STAFF_BASE;
}

export function canAccessStaffSegment(role, segment) {
  if (!role || !segment) return false;
  const allowed = SEGMENT_ROLE_ACCESS[segment];
  return Array.isArray(allowed) && allowed.includes(role);
}

export function resolveActiveNavItem(pathname) {
  const segment = getStaffSegment(pathname);
  if (!segment) return null;

  return FLAT_NAV.find((item) => item.segment === segment) || null;
}

export function navItemToPath(item) {
  return `${STAFF_BASE}/${item.segment}`;
}
