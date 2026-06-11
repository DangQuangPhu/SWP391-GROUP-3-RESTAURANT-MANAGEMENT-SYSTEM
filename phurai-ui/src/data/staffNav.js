/* Sidebar navigation map for the /staff portal.
   Each item: { id, label, view, icon, action?, managerOnly? }
   - view: which section component renders in the main canvas
   - action: an optional one-shot intent consumed by the section
             (e.g. open "Add Dish" modal on arrival)
   - managerOnly: hidden for Restaurant/Kitchen staff roles
   The `subtitle` per view powers the header tagline. */

export const NAV_GROUPS = [
  {
    group: "Overview",
    items: [
      { id: "overview", label: "Dashboard", view: "overview", icon: "grid" },
      { id: "today", label: "Today Operations", view: "today", icon: "clock" },
    ],
  },
  {
    group: "Reservations",
    items: [
      { id: "reservations", label: "Live Reservations", view: "reservations", icon: "calendar" },
      { id: "checkin", label: "Check-in Guests", view: "reservations", icon: "check", action: "filter-arriving" },
      { id: "res-report", label: "Reservation Report", view: "reports", icon: "report", action: "tab-reservations", managerOnly: true },
      { id: "res-stats", label: "Reservation Statistics", view: "reports", icon: "chart", action: "tab-stats", managerOnly: true },
    ],
  },
  {
    group: "Tables",
    items: [
      { id: "table-map", label: "Table Map", view: "tables", icon: "table" },
      { id: "table-add", label: "Add Table", view: "tables", icon: "plus", action: "add", managerOnly: true },
    ],
  },
  {
    group: "Menu & Dishes",
    items: [
      { id: "dish-list", label: "Dish List", view: "dishes", icon: "dish" },
      { id: "dish-add", label: "Add Dish", view: "dishes", icon: "plus", action: "add", managerOnly: true },
      { id: "dish-best", label: "Best-selling Dishes", view: "dishes", icon: "star", action: "tab-best" },
    ],
  },
  {
    group: "Orders & Kitchen",
    items: [
      { id: "orders-active", label: "Active Orders", view: "orders", icon: "receipt" },
      { id: "orders-kitchen", label: "Kitchen Queue", view: "orders", icon: "fire", action: "tab-kitchen" },
      { id: "orders-ready", label: "Ready to Serve", view: "orders", icon: "check", action: "tab-ready" },
    ],
  },
  {
    group: "Staff",
    items: [
      { id: "staff-list", label: "Staff List", view: "staff", icon: "users", managerOnly: true },
      { id: "staff-add", label: "Add Staff", view: "staff", icon: "plus", action: "add", managerOnly: true },
    ],
  },
  {
    group: "Promotions",
    items: [
      { id: "promo-list", label: "Promotion List", view: "promotions", icon: "tag", managerOnly: true },
      { id: "promo-add", label: "Create Promotion", view: "promotions", icon: "plus", action: "add", managerOnly: true },
    ],
  },
  {
    group: "Reports",
    items: [
      { id: "report-revenue", label: "Revenue Dashboard", view: "reports", icon: "chart", action: "tab-revenue", managerOnly: true },
      { id: "report-export", label: "Export & View", view: "reports", icon: "download", action: "tab-export", managerOnly: true },
    ],
  },
  {
    group: "Settings",
    items: [{ id: "settings", label: "Restaurant Settings", view: "settings", icon: "settings" }],
  },
];

export const VIEW_SUBTITLE = {
  overview: "Today's service overview",
  today: "Live floor & kitchen operations",
  reservations: "Manage bookings and guest check-in",
  tables: "Floor layout, capacity and status",
  dishes: "Menu items and best-sellers",
  orders: "Active orders and kitchen queue",
  staff: "Team roster and scheduling",
  promotions: "Campaigns, vouchers and discounts",
  reports: "Revenue, statistics and exports",
  settings: "Portal and restaurant configuration",
};
