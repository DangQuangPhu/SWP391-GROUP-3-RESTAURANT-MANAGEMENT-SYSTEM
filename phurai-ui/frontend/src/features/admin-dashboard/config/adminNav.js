/**
 * Admin nav groups configuration — mirrors managerNav.js structure.
 * Each item has: { id, label, icon, to, end? }
 * `to` is the full path (not a segment) since Admin uses React Router <NavLink> directly.
 */

export const ADMIN_NAV_GROUPS = [
  {
    group: "OVERVIEW",
    items: [
      { id: "dashboard", label: "Dashboard", icon: "grid",    to: "/admin",                          end: true },
    ],
  },
  {
    group: "ACCOUNTS",
    items: [
      { id: "accounts",   label: "Accounts",          icon: "users",   to: "/admin/accounts" },
      { id: "audit-logs", label: "Audit logs",         icon: "report",  to: "/admin/audit-logs" },
    ],
  },
  {
    group: "ANALYTICS",
    items: [
      { id: "reservations-analytics", label: "Reservations",      icon: "calendar", to: "/admin/analytics/reservations" },
      { id: "revenue-analytics",      label: "Revenue",           icon: "wallet",   to: "/admin/analytics/revenue" },
      { id: "orders-analytics",       label: "Orders",            icon: "receipt",  to: "/admin/analytics/orders" },
      { id: "reviews-analytics",      label: "Customer reviews",  icon: "star",     to: "/admin/analytics/reviews" },
    ],
  },
  {
    group: "SETTINGS",
    items: [
      { id: "system-settings",  label: "System settings",   icon: "settings", to: "/admin/settings/system" },
      { id: "floor-plan",       label: "Floor Plan Config",  icon: "table",    to: "/admin/settings/floor-plan" },
    ],
  },
];
