/* ============================================================
   Phūrai — Staff/Manager Dashboard mock fallback data
   ------------------------------------------------------------
   This file holds SAMPLE data used by the /staff portal when a
   real backend endpoint is not yet connected. Structures mirror
   the SQL schema (dbo.Dishes, dbo.RestaurantTables, dbo.Orders,
   dbo.Reservations, dbo.Promotions, dbo.StaffProfiles, etc.) so a
   real API response can replace it later with minimal changes.

   NOTE: This is frontend-only sample data. Nothing here is written
   to the database. Mutations live in component state only.
   ============================================================ */

export const DEMO_NOTICE =
  "Showing sample operations data. Connect the live API to replace it.";

/* ---- KPI summary (overview cards) ---- */
export const KPI_CARDS = [
  {
    id: "revenue",
    label: "Today Revenue",
    value: 18450000,
    format: "currency",
    icon: "wallet",
    trend: { dir: "up", text: "+12.4% vs yesterday" },
    accent: "gold",
  },
  {
    id: "reservations",
    label: "Reservations Today",
    value: 42,
    format: "number",
    icon: "calendar",
    trend: { dir: "up", text: "+6 new today" },
    accent: "blue",
  },
  {
    id: "occupied",
    label: "Occupied Tables",
    value: 18,
    suffix: " / 32",
    format: "number",
    icon: "grid",
    trend: { dir: "flat", text: "56% capacity" },
    accent: "green",
  },
  {
    id: "pendingOrders",
    label: "Pending Orders",
    value: 7,
    format: "number",
    icon: "receipt",
    trend: { dir: "down", text: "-3 since 6pm" },
    accent: "amber",
  },
  {
    id: "kitchen",
    label: "Kitchen Queue",
    value: 5,
    format: "number",
    icon: "fire",
    trend: { dir: "up", text: "2 firing now" },
    accent: "red",
  },
  {
    id: "bestDish",
    label: "Best-selling Dish",
    value: "Wagyu Sukiyaki",
    format: "text",
    icon: "star",
    trend: { dir: "up", text: "86 sold today" },
    accent: "gold",
  },
  {
    id: "promos",
    label: "Active Promotions",
    value: 3,
    format: "number",
    icon: "tag",
    trend: { dir: "flat", text: "1 ending soon" },
    accent: "purple",
  },
  {
    id: "rating",
    label: "Customer Rating",
    value: "4.8",
    suffix: " / 5",
    format: "text",
    icon: "heart",
    trend: { dir: "up", text: "+0.2 this week" },
    accent: "green",
  },
];

/* ---- Revenue chart series (day / week / month) ---- */
export const REVENUE_SERIES = {
  day: [
    { label: "10a", value: 1.2 },
    { label: "12p", value: 3.4 },
    { label: "2p", value: 2.1 },
    { label: "4p", value: 1.6 },
    { label: "6p", value: 4.8 },
    { label: "8p", value: 6.2 },
    { label: "10p", value: 3.9 },
  ],
  week: [
    { label: "Mon", value: 14.2 },
    { label: "Tue", value: 12.8 },
    { label: "Wed", value: 16.4 },
    { label: "Thu", value: 18.4 },
    { label: "Fri", value: 24.6 },
    { label: "Sat", value: 31.2 },
    { label: "Sun", value: 27.5 },
  ],
  month: [
    { label: "W1", value: 142 },
    { label: "W2", value: 168 },
    { label: "W3", value: 155 },
    { label: "W4", value: 189 },
  ],
};

/* ---- Today's reservations (dbo.Reservations + ReservationTables) ---- */
export const RESERVATIONS = [
  {
    reservation_id: 8801,
    customer_name: "Linh Tran",
    email: "linh.tran@example.com",
    phone: "0905 112 233",
    reservation_date: "2026-06-11",
    start_time: "18:00",
    party_size: 4,
    area_name: "Window Area",
    table_label: "W-12",
    status: "confirmed",
    occasion: "Birthday",
    special_request: "Window seat, candle for cake",
    preorder: [
      { dish_name: "Wagyu Sukiyaki", qty: 2 },
      { dish_name: "Yellowtail Jalapeño", qty: 1 },
    ],
  },
  {
    reservation_id: 8802,
    customer_name: "Daniel Pham",
    email: "daniel.pham@example.com",
    phone: "0912 884 551",
    reservation_date: "2026-06-11",
    start_time: "18:30",
    party_size: 2,
    area_name: "Wine Bar",
    table_label: "B-03",
    status: "checked_in",
    occasion: "Date night",
    special_request: "",
    preorder: [],
  },
  {
    reservation_id: 8803,
    customer_name: "Mai Nguyen",
    email: "mai.nguyen@example.com",
    phone: "0938 220 117",
    reservation_date: "2026-06-11",
    start_time: "19:00",
    party_size: 6,
    area_name: "VIP Lounge",
    table_label: "V-01",
    status: "pending",
    occasion: "Business dinner",
    special_request: "Quiet corner, invoice required",
    preorder: [{ dish_name: "Omakase Set", qty: 6 }],
  },
  {
    reservation_id: 8804,
    customer_name: "Sophie Le",
    email: "sophie.le@example.com",
    phone: "0977 553 991",
    reservation_date: "2026-06-11",
    start_time: "19:30",
    party_size: 3,
    area_name: "Main Dining",
    table_label: "M-08",
    status: "confirmed",
    occasion: "Anniversary",
    special_request: "Allergic to shellfish",
    preorder: [],
  },
  {
    reservation_id: 8805,
    customer_name: "Khoa Vu",
    email: "khoa.vu@example.com",
    phone: "0902 110 778",
    reservation_date: "2026-06-11",
    start_time: "20:00",
    party_size: 2,
    area_name: "Rooftop Terrace",
    table_label: "R-05",
    status: "completed",
    occasion: "Casual",
    special_request: "",
    preorder: [],
  },
  {
    reservation_id: 8806,
    customer_name: "Anh Bui",
    email: "anh.bui@example.com",
    phone: "0967 442 305",
    reservation_date: "2026-06-11",
    start_time: "20:30",
    party_size: 5,
    area_name: "Private Room",
    table_label: "P-02",
    status: "cancelled",
    occasion: "Family",
    special_request: "High chair x1",
    preorder: [],
  },
  {
    reservation_id: 8807,
    customer_name: "Grace Hoang",
    email: "grace.hoang@example.com",
    phone: "0918 765 003",
    reservation_date: "2026-06-11",
    start_time: "21:00",
    party_size: 2,
    area_name: "Balcony",
    table_label: "G-04",
    status: "no_show",
    occasion: "Casual",
    special_request: "",
    preorder: [],
  },
];

export const RESERVATION_STATUS_META = {
  pending: { label: "Pending", tone: "amber" },
  confirmed: { label: "Confirmed", tone: "blue" },
  checked_in: { label: "Checked In", tone: "green" },
  completed: { label: "Completed", tone: "muted" },
  cancelled: { label: "Cancelled", tone: "red" },
  no_show: { label: "No Show", tone: "red" },
};

/* ---- Tables (dbo.RestaurantTables + RestaurantAreas) ---- */
export const TABLES = [
  { table_id: 1, table_number: "M-01", area_name: "Main Dining", capacity: 2, status: "available" },
  { table_id: 2, table_number: "M-02", area_name: "Main Dining", capacity: 4, status: "occupied" },
  { table_id: 3, table_number: "M-08", area_name: "Main Dining", capacity: 4, status: "reserved" },
  { table_id: 4, table_number: "W-12", area_name: "Window Area", capacity: 4, status: "reserved" },
  { table_id: 5, table_number: "W-14", area_name: "Window Area", capacity: 2, status: "available" },
  { table_id: 6, table_number: "B-03", area_name: "Wine Bar", capacity: 2, status: "occupied" },
  { table_id: 7, table_number: "B-05", area_name: "Wine Bar", capacity: 2, status: "cleaning" },
  { table_id: 8, table_number: "V-01", area_name: "VIP Lounge", capacity: 8, status: "reserved" },
  { table_id: 9, table_number: "P-02", area_name: "Private Room", capacity: 10, status: "available" },
  { table_id: 10, table_number: "R-05", area_name: "Rooftop Terrace", capacity: 4, status: "occupied" },
  { table_id: 11, table_number: "R-06", area_name: "Rooftop Terrace", capacity: 4, status: "available" },
  { table_id: 12, table_number: "G-04", area_name: "Balcony", capacity: 2, status: "cleaning" },
  { table_id: 13, table_number: "G-06", area_name: "Balcony", capacity: 2, status: "available" },
  { table_id: 14, table_number: "E-01", area_name: "Event Corner", capacity: 12, status: "inactive" },
];

export const TABLE_STATUS_META = {
  available: { label: "Available", tone: "green" },
  reserved: { label: "Reserved", tone: "blue" },
  occupied: { label: "Occupied", tone: "amber" },
  cleaning: { label: "Cleaning", tone: "purple" },
  inactive: { label: "Inactive", tone: "muted" },
};

export const AREAS = [
  "Main Dining",
  "Window Area",
  "Wine Bar",
  "VIP Lounge",
  "Private Room",
  "Rooftop Terrace",
  "Balcony",
  "Event Corner",
];

/* ---- Dishes (dbo.Dishes + MenuCategories) ---- */
export const DISHES = [
  { dish_id: 1, dish_name: "Wagyu Sukiyaki", category_name: "Signature", price: 890000, is_available: true, is_recommended: true, spicy_level: 1, prep_minutes: 18 },
  { dish_id: 2, dish_name: "Yellowtail Jalapeño", category_name: "Starters", price: 320000, is_available: true, is_recommended: true, spicy_level: 2, prep_minutes: 10 },
  { dish_id: 3, dish_name: "Omakase Set", category_name: "Signature", price: 1450000, is_available: true, is_recommended: true, spicy_level: 0, prep_minutes: 35 },
  { dish_id: 4, dish_name: "Truffle Udon", category_name: "Mains", price: 420000, is_available: true, is_recommended: false, spicy_level: 0, prep_minutes: 14 },
  { dish_id: 5, dish_name: "Spicy Miso Ramen", category_name: "Mains", price: 280000, is_available: true, is_recommended: false, spicy_level: 3, prep_minutes: 12 },
  { dish_id: 6, dish_name: "Matcha Tiramisu", category_name: "Desserts", price: 165000, is_available: true, is_recommended: false, spicy_level: 0, prep_minutes: 8 },
  { dish_id: 7, dish_name: "Yuzu Sorbet", category_name: "Desserts", price: 120000, is_available: false, is_recommended: false, spicy_level: 0, prep_minutes: 5 },
  { dish_id: 8, dish_name: "Hokkaido Scallop", category_name: "Starters", price: 380000, is_available: true, is_recommended: true, spicy_level: 0, prep_minutes: 11 },
];

export const DISH_CATEGORIES = ["Signature", "Starters", "Mains", "Desserts", "Drinks"];

/* ---- Best-selling dishes (revenue ranking) ---- */
export const BEST_SELLERS = [
  { rank: 1, dish_name: "Wagyu Sukiyaki", qty_sold: 86, revenue: 76540000 },
  { rank: 2, dish_name: "Omakase Set", qty_sold: 54, revenue: 78300000 },
  { rank: 3, dish_name: "Truffle Udon", qty_sold: 73, revenue: 30660000 },
  { rank: 4, dish_name: "Yellowtail Jalapeño", qty_sold: 61, revenue: 19520000 },
  { rank: 5, dish_name: "Spicy Miso Ramen", qty_sold: 58, revenue: 16240000 },
];

/* ---- Active orders (dbo.Orders + OrderItems + KitchenTickets) ---- */
export const ORDERS = [
  { order_id: 5101, order_number: "#A-5101", table_label: "M-02", items_count: 5, total: 2140000, status: "in_progress", kitchen_status: "cooking" },
  { order_id: 5102, order_number: "#A-5102", table_label: "B-03", items_count: 3, total: 980000, status: "in_progress", kitchen_status: "queued" },
  { order_id: 5103, order_number: "#A-5103", table_label: "R-05", items_count: 7, total: 3260000, status: "ready", kitchen_status: "ready" },
  { order_id: 5104, order_number: "#A-5104", table_label: "M-08", items_count: 2, total: 640000, status: "served", kitchen_status: "done" },
  { order_id: 5105, order_number: "#A-5105", table_label: "V-01", items_count: 9, total: 8700000, status: "in_progress", kitchen_status: "cooking" },
];

export const ORDER_STATUS_META = {
  queued: { label: "Queued", tone: "muted" },
  in_progress: { label: "In Progress", tone: "amber" },
  cooking: { label: "Cooking", tone: "red" },
  ready: { label: "Ready", tone: "green" },
  served: { label: "Served", tone: "blue" },
  done: { label: "Done", tone: "muted" },
};

/* ---- Staff (dbo.StaffProfiles + UserAccounts + Roles) ---- */
export const STAFF = [
  { staff_id: 1, full_name: "Hoa Dang", role_name: "Manager", phone: "0901 234 567", email: "hoa.dang@phurai.com", status: "active", shift: "Morning" },
  { staff_id: 2, full_name: "Tuan Le", role_name: "Restaurant Staff", phone: "0902 345 678", email: "tuan.le@phurai.com", status: "active", shift: "Evening" },
  { staff_id: 3, full_name: "Minh Vo", role_name: "Kitchen Staff", phone: "0903 456 789", email: "minh.vo@phurai.com", status: "active", shift: "Evening" },
  { staff_id: 4, full_name: "Lan Pham", role_name: "Restaurant Staff", phone: "0904 567 890", email: "lan.pham@phurai.com", status: "on_leave", shift: "Morning" },
  { staff_id: 5, full_name: "Bao Nguyen", role_name: "Kitchen Staff", phone: "0905 678 901", email: "bao.nguyen@phurai.com", status: "inactive", shift: "Night" },
];

export const STAFF_ROLES = ["Manager", "Restaurant Staff", "Kitchen Staff", "Admin"];
export const STAFF_STATUS_META = {
  active: { label: "Active", tone: "green" },
  on_leave: { label: "On Leave", tone: "amber" },
  inactive: { label: "Inactive", tone: "muted" },
};
export const SHIFTS = ["Morning", "Evening", "Night"];

/* ---- Promotions (dbo.Promotions + Vouchers) ---- */
export const PROMOTIONS = [
  { promo_id: 1, name: "Weekday Lunch 15%", code: "LUNCH15", discount_type: "percent", discount_value: 15, min_order: 300000, start_date: "2026-06-01", end_date: "2026-06-30", status: "active", usage_count: 142 },
  { promo_id: 2, name: "Anniversary Gift", code: "PHURAI5Y", discount_type: "amount", discount_value: 200000, min_order: 1000000, start_date: "2026-06-05", end_date: "2026-06-20", status: "active", usage_count: 64 },
  { promo_id: 3, name: "Rooftop Happy Hour", code: "ROOF20", discount_type: "percent", discount_value: 20, min_order: 0, start_date: "2026-06-15", end_date: "2026-07-15", status: "scheduled", usage_count: 0 },
  { promo_id: 4, name: "New Year Set", code: "NY2026", discount_type: "amount", discount_value: 500000, min_order: 2000000, start_date: "2026-01-01", end_date: "2026-02-15", status: "expired", usage_count: 318 },
  { promo_id: 5, name: "Staff Test Promo", code: "INTERNAL", discount_type: "percent", discount_value: 50, min_order: 0, start_date: "2026-06-01", end_date: "2026-12-31", status: "disabled", usage_count: 4 },
];

export const PROMO_STATUS_META = {
  active: { label: "Active", tone: "green" },
  scheduled: { label: "Scheduled", tone: "blue" },
  expired: { label: "Expired", tone: "muted" },
  disabled: { label: "Disabled", tone: "red" },
};

/* ---- Reports: reservation statistics ---- */
export const RESERVATION_STATS = {
  totalThisMonth: 612,
  completionRate: 88,
  noShowRate: 6,
  avgPartySize: 3.4,
  byArea: [
    { area: "Main Dining", count: 210 },
    { area: "Window Area", count: 118 },
    { area: "Rooftop Terrace", count: 96 },
    { area: "VIP Lounge", count: 64 },
    { area: "Wine Bar", count: 71 },
    { area: "Private Room", count: 53 },
  ],
};

export const TABLE_UTILIZATION = [
  { area: "Main Dining", utilization: 78 },
  { area: "Window Area", utilization: 64 },
  { area: "Rooftop Terrace", utilization: 82 },
  { area: "VIP Lounge", utilization: 45 },
  { area: "Wine Bar", utilization: 58 },
  { area: "Private Room", utilization: 38 },
];
