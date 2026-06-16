import { STAFF_ROLE } from "./staffRoutes.js";

/**
 * Phase 2 staff portal navigation — five operational tabs.
 */
export const STAFF_NAV = [
  {
    group: "OPERATIONS",
    roles: [STAFF_ROLE.RESTAURANT, STAFF_ROLE.KITCHEN],
    items: [
      { id: "orders", label: "Orders", segment: "orders", icon: "receipt" },
      { id: "tables", label: "Tables", segment: "tables", icon: "grid" },
      { id: "reservations", label: "Reservation", segment: "reservations", icon: "calendar" },
      { id: "kds", label: "Alerts & KDS", segment: "kds", icon: "fire" },
      { id: "payments", label: "Payments", segment: "payments", icon: "card" },
      { id: "shifts", label: "Shift Reports", segment: "shifts", icon: "chart" },
    ],
  },
];

export const FLAT_NAV = STAFF_NAV.flatMap((group) =>
  group.items.map((item) => ({
    ...item,
    roles: group.roles,
    group: group.group,
  }))
);

export function getNavForRole(role) {
  if (!role) return [];

  return STAFF_NAV.filter((group) => group.roles.includes(role)).map((group) => ({
    ...group,
    items: group.items.filter(() => true),
  }));
}

export const VIEW_SUBTITLE = {
  orders: "Monitor and process active orders on the floor",
  tables: "Floor map by area — check-in, reset, and QR session management",
  reservations: "Today's reservation queue — verify, assign tables, and check in guests",
  kds: "Kitchen queue, ready items, and timeout alerts",
  payments: "Collect payment, apply vouchers, and close table sessions",
  shifts: "Shift summary and daily revenue reporting",
};
