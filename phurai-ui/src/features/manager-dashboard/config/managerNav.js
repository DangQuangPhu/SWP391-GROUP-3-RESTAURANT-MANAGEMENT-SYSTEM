/* Sidebar navigation map for the /manager portal.
   Each item: { id, label, view, icon, managerOnly? }
   - view: which section component renders in the main canvas
   - managerOnly: hidden for Restaurant/Kitchen manager roles
   Sub-views (tabs, filters, modals) live inside each section via ?tab= / ?filter= / ?action=
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
    group: "Operations",
    items: [
      { id: "reservations", label: "Reservations", view: "reservations", icon: "calendar" },
      { id: "tables", label: "Tables", view: "tables", icon: "table" },
      { id: "menu", label: "Menu", view: "menu", icon: "dish" },
      { id: "orders", label: "Orders", view: "orders", icon: "receipt" },
    ],
  },
  {
    group: "Team & Marketing",
    items: [
      { id: "staff", label: "Staff", view: "staff", icon: "users", managerOnly: true },
      { id: "promotions", label: "Promotions", view: "promotions", icon: "tag", managerOnly: true },
    ],
  },
  {
    group: "Insights",
    items: [
      { id: "reports", label: "Reports", view: "reports", icon: "chart", managerOnly: true },
    ],
  },
];

export const VIEW_SUBTITLE = {
  overview: "Today's service overview",
  today: "Live floor & kitchen operations",
  reservations: "Manage bookings and guest check-in",
  tables: "Floor layout, capacity and status",
  menu: "Menu items and best-sellers",
  orders: "Active orders and kitchen queue",
  staff: "Staff roster, shifts and working status",
  promotions: "Campaigns, vouchers and discounts",
  reports: "Revenue, statistics and exports",
};
