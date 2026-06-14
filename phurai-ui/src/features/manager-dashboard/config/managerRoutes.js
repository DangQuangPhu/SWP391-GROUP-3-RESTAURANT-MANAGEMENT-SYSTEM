import { NAV_GROUPS } from "./managerNav.js";

const FLAT_NAV = NAV_GROUPS.flatMap((g) => g.items);

/** Views with a single sidebar entry; internal tabs/filters use URL query params. */
const CONSOLIDATED_VIEWS = new Set([
  "reports",
  "orders",
  "reservations",
  "menu",
  "tables",
  "staff",
  "promotions",
]);

/** Legacy view ids still used by section callbacks until Overview is updated. */
const VIEW_ALIASES = {
  dishes: "menu",
  manager: "staff",
};

const SEGMENT_TO_VIEW = {
  dashboard: "overview",
  today: "today",
  reservations: "reservations",
  tables: "tables",
  menu: "menu",
  orders: "orders",
  staff: "staff",
  promotions: "promotions",
  reports: "reports",
  settings: "settings",
};

const VIEW_TO_SEGMENT = Object.fromEntries(
  Object.entries(SEGMENT_TO_VIEW).map(([segment, view]) => [view, segment])
);

const ACTION_TO_SEARCH = {
  add: "action=add",
  "filter-arriving": "filter=arriving",
  "tab-kitchen": "tab=kitchen",
  "tab-ready": "tab=ready",
  "tab-best": "tab=best",
  "tab-revenue": "tab=revenue",
  "tab-export": "tab=export",
  "tab-reservations": "tab=reservations",
  "tab-stats": "tab=stats",
};

const SEARCH_TO_ACTION = Object.fromEntries(
  Object.entries(ACTION_TO_SEARCH).map(([action, query]) => {
    const [key, value] = query.split("=");
    return [`${key}=${value}`, action];
  })
);

function parseSearchParams(search = "") {
  return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
}

export function normalizeView(view) {
  return VIEW_ALIASES[view] || view;
}

export function getManagerSegment(pathname) {
  const match = pathname.match(/^\/manager\/([^/?#]+)/);
  return match?.[1] || null;
}

export function getViewFromPath(pathname) {
  const segment = getManagerSegment(pathname);
  if (!segment) return "overview";
  return SEGMENT_TO_VIEW[segment] || "overview";
}

export function pendingActionFromSearch(search) {
  const params = parseSearchParams(search);
  for (const [key, action] of Object.entries(SEARCH_TO_ACTION)) {
    const [param, value] = key.split("=");
    if (params.get(param) === value) return action;
  }
  if (params.get("action") === "add") return "add";
  return null;
}

export function buildManagerPath(view, action = null) {
  const normalized = normalizeView(view);
  const segment = VIEW_TO_SEGMENT[normalized] || "dashboard";
  const pathname = `/manager/${segment}`;
  const search = action && ACTION_TO_SEARCH[action] ? `?${ACTION_TO_SEARCH[action]}` : "";
  return `${pathname}${search}`;
}

export const REPORT_TAB_IDS = ["revenue", "reservations", "stats", "export"];

export function getReportsTabFromSearch(search = "") {
  const tab = parseSearchParams(search).get("tab");
  return REPORT_TAB_IDS.includes(tab) ? tab : "revenue";
}

export const ORDER_TAB_IDS = ["active", "kitchen", "ready", "history"];

export function getOrdersTabFromSearch(search = "") {
  const tab = parseSearchParams(search).get("tab");
  return ORDER_TAB_IDS.includes(tab) ? tab : "active";
}

export const MENU_TAB_IDS = ["list", "best"];

export function getMenuTabFromSearch(search = "") {
  const tab = parseSearchParams(search).get("tab");
  return tab === "best" ? "best" : "list";
}

export function getReservationsFilterFromSearch(search = "") {
  const filter = parseSearchParams(search).get("filter");
  return filter === "arriving" ? "arriving" : "all";
}

export const STAFF_TAB_IDS = ["list", "shifts"];

export function getStaffTabFromSearch(search = "") {
  const tab = parseSearchParams(search).get("tab");
  return tab === "shifts" ? "shifts" : "list";
}

export function isEphemeralPendingAction(action) {
  return action === "add";
}

export function resolveActiveNavItem(pathname, search = "") {
  const view = getViewFromPath(pathname);

  if (CONSOLIDATED_VIEWS.has(view)) {
    return (
      FLAT_NAV.find((it) => it.view === view && !it.action) ||
      FLAT_NAV.find((it) => it.id === view) ||
      FLAT_NAV.find((it) => it.id === "overview")
    );
  }

  const action = pendingActionFromSearch(search);
  return (
    FLAT_NAV.find((it) => it.view === view && it.action === action) ||
    FLAT_NAV.find((it) => it.view === view && !it.action) ||
    FLAT_NAV.find((it) => it.view === view) ||
    FLAT_NAV.find((it) => it.id === "overview")
  );
}

export function navItemToPath(item) {
  return buildManagerPath(item.view, item.action || null);
}
