import { STAFF_ROLE } from "./staffRoutes.js";

export const STAFF_NAV = [
  {
    group: "Front of House",
    roles: [STAFF_ROLE.RESTAURANT],
    items: [
      { id: "reservations", label: "Reservation Queue", segment: "reservations", icon: "calendar" },
      { id: "tables", label: "Table Map", segment: "tables", icon: "grid" },
      { id: "orders", label: "Active Orders", segment: "orders", icon: "receipt" },
    ],
  },
  {
    group: "Back of House",
    roles: [STAFF_ROLE.KITCHEN],
    items: [
      { id: "kitchen", label: "Cooking Queue", segment: "kitchen", icon: "fire" },
    ],
  },
];

export const FLAT_NAV = STAFF_NAV.flatMap((group) =>
  group.items.map((item) => ({
    ...item,
    roles: group.roles,
    group: group.group,
  })),
);

export function getNavForRole(role) {
  if (!role) return [];

  return STAFF_NAV.filter((group) => group.roles.includes(role)).map((group) => ({
    ...group,
    items: group.items.filter(() => true),
  }));
}

export const VIEW_SUBTITLE = {
  reservations: "Pending online bookings awaiting table assignment",
  tables: "Live floor layout, capacity and table status",
  orders: "Active guest orders on the floor",
  kitchen: "Back-of-house cooking queue and ticket flow",
};
