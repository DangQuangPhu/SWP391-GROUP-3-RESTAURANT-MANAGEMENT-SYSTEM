import {
  differenceInCalendarDays,
  eachWeekOfInterval,
  endOfDay,
  endOfWeek,
  format,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
} from "date-fns";

/* ============================================================
   Phūrai — Manager/Manager Dashboard mock fallback data
   ------------------------------------------------------------
   This file holds SAMPLE data used by the /manager portal when a
   real backend endpoint is not yet connected. Structures mirror
   the SQL schema (dbo.Dishes, dbo.RestaurantTables, dbo.Orders,
   dbo.Reservations, dbo.Promotions, dbo.ManagerProfiles, etc.) so a
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
    value: 48750000,
    format: "currency",
    icon: "wallet",
    trend: { dir: "up", text: "+18.2% vs yesterday" },
    accent: "gold",
  },
  {
    id: "reservations",
    label: "Reservations Today",
    value: 45,
    format: "number",
    icon: "calendar",
    trend: { dir: "up", text: "+11 new today" },
    accent: "blue",
  },
  {
    id: "occupied",
    label: "Occupied Tables",
    value: 18,
    suffix: " / 28",
    format: "number",
    icon: "grid",
    trend: { dir: "up", text: "64% capacity" },
    accent: "green",
  },
  {
    id: "pendingOrders",
    label: "Pending Orders",
    value: 12,
    format: "number",
    icon: "receipt",
    trend: { dir: "up", text: "+4 since 6pm" },
    accent: "amber",
  },
  {
    id: "kitchen",
    label: "Kitchen Queue",
    value: 8,
    format: "number",
    icon: "fire",
    trend: { dir: "up", text: "3 firing now" },
    accent: "red",
  },
  {
    id: "bestDish",
    label: "Best-selling Dish",
    value: "Wagyu Sukiyaki",
    format: "text",
    icon: "star",
    trend: { dir: "up", text: "124 sold today" },
    accent: "gold",
  },
  {
    id: "promos",
    label: "Active Promotions",
    value: 5,
    format: "number",
    icon: "tag",
    trend: { dir: "flat", text: "2 ending soon" },
    accent: "purple",
  },
  {
    id: "rating",
    label: "Customer Rating",
    value: "4.8",
    suffix: " / 5",
    format: "text",
    icon: "heart",
    trend: { dir: "up", text: "2,547 verified reviews" },
    accent: "green",
  },
];

/* ---- Revenue chart series (day / week / month) ---- */
export const REVENUE_SERIES = {
  day: [
    { label: "10a", value: 1.8 },
    { label: "12p", value: 3.6 },
    { label: "2p", value: 2.9 },
    { label: "4p", value: 4.2 },
    { label: "6p", value: 6.8 },
    { label: "8p", value: 9.4 },
    { label: "10p", value: 8.2 },
  ],
  week: [
    { label: "Mon", value: 28.5 },
    { label: "Tue", value: 32.1 },
    { label: "Wed", value: 34.8 },
    { label: "Thu", value: 38.2 },
    { label: "Fri", value: 44.5 },
    { label: "Sat", value: 52.8 },
    { label: "Sun", value: 48.6 },
  ],
  month: [
    { label: "W1", value: 168 },
    { label: "W2", value: 182 },
    { label: "W3", value: 198 },
    { label: "W4", value: 218 },
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
  {
    reservation_id: 8808,
    customer_name: "James Wong",
    email: "james.wong@example.com",
    phone: "0908 331 220",
    reservation_date: "2026-06-11",
    start_time: "17:30",
    party_size: 4,
    area_name: "Main Dining",
    table_label: "M-04",
    status: "checked_in",
    occasion: "Business dinner",
    special_request: "Vegetarian options",
    preorder: [{ dish_name: "Truffle Udon", qty: 2 }],
  },
  {
    reservation_id: 8809,
    customer_name: "Thu Ha",
    email: "thu.ha@example.com",
    phone: "0933 882 114",
    reservation_date: "2026-06-11",
    start_time: "18:15",
    party_size: 8,
    area_name: "Private Room",
    table_label: "P-01",
    status: "confirmed",
    occasion: "Corporate",
    special_request: "Projector setup",
    preorder: [{ dish_name: "Omakase Set", qty: 8 }],
  },
  {
    reservation_id: 8810,
    customer_name: "Peter Chen",
    email: "peter.chen@example.com",
    phone: "0911 445 667",
    reservation_date: "2026-06-11",
    start_time: "19:15",
    party_size: 2,
    area_name: "Wine Bar",
    table_label: "B-06",
    status: "checked_in",
    occasion: "Date night",
    special_request: "Champagne on arrival",
    preorder: [],
  },
  {
    reservation_id: 8811,
    customer_name: "Ngoc Tran",
    email: "ngoc.tran@example.com",
    phone: "0976 220 889",
    reservation_date: "2026-06-11",
    start_time: "19:45",
    party_size: 3,
    area_name: "Rooftop Terrace",
    table_label: "R-07",
    status: "confirmed",
    occasion: "Birthday",
    special_request: "Birthday dessert plate",
    preorder: [{ dish_name: "Matcha Tiramisu", qty: 3 }],
  },
  {
    reservation_id: 8812,
    customer_name: "David Kim",
    email: "david.kim@example.com",
    phone: "0904 778 332",
    reservation_date: "2026-06-11",
    start_time: "20:15",
    party_size: 6,
    area_name: "VIP Lounge",
    table_label: "V-02",
    status: "pending",
    occasion: "Celebration",
    special_request: "",
    preorder: [{ dish_name: "Wagyu Sukiyaki", qty: 4 }],
  },
  {
    reservation_id: 8813,
    customer_name: "Huyen Le",
    email: "huyen.le@example.com",
    phone: "0988 112 445",
    reservation_date: "2026-06-11",
    start_time: "20:45",
    party_size: 2,
    area_name: "Window Area",
    table_label: "W-16",
    status: "confirmed",
    occasion: "Anniversary",
    special_request: "Rose petals on table",
    preorder: [],
  },
  {
    reservation_id: 8814,
    customer_name: "Michael Vo",
    email: "michael.vo@example.com",
    phone: "0922 556 778",
    reservation_date: "2026-06-11",
    start_time: "21:15",
    party_size: 5,
    area_name: "Main Dining",
    table_label: "M-09",
    status: "confirmed",
    occasion: "Family",
    special_request: "Kids menu x2",
    preorder: [{ dish_name: "Spicy Miso Ramen", qty: 3 }],
  },
  {
    reservation_id: 8815,
    customer_name: "Yen Pham",
    email: "yen.pham@example.com",
    phone: "0944 990 221",
    reservation_date: "2026-06-11",
    start_time: "21:30",
    party_size: 4,
    area_name: "Balcony",
    table_label: "G-08",
    status: "pending",
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
  { table_id: 3, table_number: "M-03", area_name: "Main Dining", capacity: 4, status: "reserved" },
  { table_id: 4, table_number: "M-04", area_name: "Main Dining", capacity: 4, status: "occupied" },
  { table_id: 5, table_number: "M-05", area_name: "Main Dining", capacity: 2, status: "available" },
  { table_id: 6, table_number: "M-06", area_name: "Main Dining", capacity: 6, status: "occupied" },
  { table_id: 7, table_number: "M-08", area_name: "Main Dining", capacity: 4, status: "reserved" },
  { table_id: 8, table_number: "M-09", area_name: "Main Dining", capacity: 4, status: "occupied" },
  { table_id: 9, table_number: "M-10", area_name: "Main Dining", capacity: 2, status: "occupied" },
  { table_id: 10, table_number: "W-10", area_name: "Window Area", capacity: 2, status: "available" },
  { table_id: 11, table_number: "W-12", area_name: "Window Area", capacity: 4, status: "occupied" },
  { table_id: 12, table_number: "W-14", area_name: "Window Area", capacity: 2, status: "occupied" },
  { table_id: 13, table_number: "W-16", area_name: "Window Area", capacity: 4, status: "occupied" },
  { table_id: 14, table_number: "B-03", area_name: "Wine Bar", capacity: 2, status: "occupied" },
  { table_id: 15, table_number: "B-05", area_name: "Wine Bar", capacity: 2, status: "cleaning" },
  { table_id: 16, table_number: "B-06", area_name: "Wine Bar", capacity: 2, status: "occupied" },
  { table_id: 17, table_number: "B-08", area_name: "Wine Bar", capacity: 4, status: "occupied" },
  { table_id: 18, table_number: "V-01", area_name: "VIP Lounge", capacity: 8, status: "occupied" },
  { table_id: 19, table_number: "V-02", area_name: "VIP Lounge", capacity: 6, status: "reserved" },
  { table_id: 20, table_number: "P-01", area_name: "Private Room", capacity: 10, status: "occupied" },
  { table_id: 21, table_number: "P-02", area_name: "Private Room", capacity: 10, status: "reserved" },
  { table_id: 22, table_number: "R-05", area_name: "Rooftop Terrace", capacity: 4, status: "occupied" },
  { table_id: 23, table_number: "R-06", area_name: "Rooftop Terrace", capacity: 4, status: "occupied" },
  { table_id: 24, table_number: "R-07", area_name: "Rooftop Terrace", capacity: 4, status: "occupied" },
  { table_id: 25, table_number: "G-04", area_name: "Balcony", capacity: 2, status: "occupied" },
  { table_id: 26, table_number: "G-06", area_name: "Balcony", capacity: 2, status: "available" },
  { table_id: 27, table_number: "G-08", area_name: "Balcony", capacity: 4, status: "occupied" },
  { table_id: 28, table_number: "G-10", area_name: "Balcony", capacity: 2, status: "cleaning" },
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
  { rank: 1, dish_name: "Wagyu Sukiyaki", qty_sold: 124, revenue: 110360000 },
  { rank: 2, dish_name: "Omakase Set", qty_sold: 89, revenue: 129050000 },
  { rank: 3, dish_name: "Truffle Udon", qty_sold: 98, revenue: 41160000 },
  { rank: 4, dish_name: "Yellowtail Jalapeño", qty_sold: 86, revenue: 27520000 },
  { rank: 5, dish_name: "Hokkaido Scallop", qty_sold: 72, revenue: 27360000 },
  { rank: 6, dish_name: "Spicy Miso Ramen", qty_sold: 68, revenue: 19040000 },
  { rank: 7, dish_name: "Matcha Tiramisu", qty_sold: 54, revenue: 8910000 },
];

/* ---- Active orders (dbo.Orders + OrderItems + KitchenTickets) ---- */
export const ORDERS = [
  { order_id: 5101, order_number: "#A-5101", table_label: "M-02", items_count: 5, total: 2140000, status: "in_progress", kitchen_status: "cooking" },
  { order_id: 5102, order_number: "#A-5102", table_label: "B-03", items_count: 3, total: 980000, status: "in_progress", kitchen_status: "queued" },
  { order_id: 5103, order_number: "#A-5103", table_label: "R-05", items_count: 7, total: 3260000, status: "ready", kitchen_status: "ready" },
  { order_id: 5104, order_number: "#A-5104", table_label: "M-08", items_count: 2, total: 640000, status: "served", kitchen_status: "done" },
  { order_id: 5105, order_number: "#A-5105", table_label: "V-01", items_count: 9, total: 8700000, status: "in_progress", kitchen_status: "cooking" },
  { order_id: 5106, order_number: "#A-5106", table_label: "M-04", items_count: 4, total: 1680000, status: "in_progress", kitchen_status: "cooking" },
  { order_id: 5107, order_number: "#A-5107", table_label: "W-12", items_count: 6, total: 2450000, status: "in_progress", kitchen_status: "queued" },
  { order_id: 5108, order_number: "#A-5108", table_label: "R-06", items_count: 3, total: 1120000, status: "in_progress", kitchen_status: "queued" },
  { order_id: 5109, order_number: "#A-5109", table_label: "P-01", items_count: 12, total: 12400000, status: "in_progress", kitchen_status: "cooking" },
  { order_id: 5110, order_number: "#A-5110", table_label: "B-06", items_count: 2, total: 720000, status: "in_progress", kitchen_status: "queued" },
  { order_id: 5111, order_number: "#A-5111", table_label: "G-08", items_count: 5, total: 1980000, status: "in_progress", kitchen_status: "queued" },
  { order_id: 5112, order_number: "#A-5112", table_label: "M-09", items_count: 4, total: 1560000, status: "in_progress", kitchen_status: "queued" },
];

export const ORDER_STATUS_META = {
  queued: { label: "Queued", tone: "muted" },
  in_progress: { label: "In Progress", tone: "amber" },
  cooking: { label: "Cooking", tone: "red" },
  ready: { label: "Ready", tone: "green" },
  served: { label: "Served", tone: "blue" },
  done: { label: "Done", tone: "muted" },
};

/* ---- Manager (dbo.ManagerProfiles + UserAccounts + Roles) ---- */
export const MANAGER = [
  { manager_id: 1, full_name: "Hoa Dang", role_name: "Manager", phone: "0901 234 567", email: "hoa.dang@phurai.com", status: "active", shift: "Morning" },
  { manager_id: 2, full_name: "Tuan Le", role_name: "Restaurant Manager", phone: "0902 345 678", email: "tuan.le@phurai.com", status: "active", shift: "Evening" },
  { manager_id: 3, full_name: "Minh Vo", role_name: "Kitchen Manager", phone: "0903 456 789", email: "minh.vo@phurai.com", status: "active", shift: "Evening" },
  { manager_id: 4, full_name: "Lan Pham", role_name: "Restaurant Manager", phone: "0904 567 890", email: "lan.pham@phurai.com", status: "on_leave", shift: "Morning" },
  { manager_id: 5, full_name: "Bao Nguyen", role_name: "Kitchen Manager", phone: "0905 678 901", email: "bao.nguyen@phurai.com", status: "inactive", shift: "Night" },
];

export const MANAGER_ROLES = ["Manager", "Restaurant Manager", "Kitchen Manager", "Admin"];
export const MANAGER_STATUS_META = {
  active: { label: "Active", tone: "green" },
  on_leave: { label: "On Leave", tone: "amber" },
  inactive: { label: "Inactive", tone: "muted" },
};
export const SHIFTS = ["Morning", "Evening", "Night"];

/* ---- Promotions (dbo.Promotions + Vouchers) ---- */
export const PROMOTIONS = [
  { promo_id: 1, name: "Weekday Lunch 15%", code: "LUNCH15", discount_type: "percent", discount_value: 15, min_order: 300000, start_date: "2026-06-01", end_date: "2026-06-30", status: "active", usage_count: 428 },
  { promo_id: 2, name: "Anniversary Gift", code: "PHURAI2Y", discount_type: "amount", discount_value: 200000, min_order: 1000000, start_date: "2026-06-05", end_date: "2026-06-20", status: "active", usage_count: 186 },
  { promo_id: 3, name: "Rooftop Happy Hour", code: "ROOF20", discount_type: "percent", discount_value: 20, min_order: 0, start_date: "2026-06-01", end_date: "2026-07-15", status: "active", usage_count: 312 },
  { promo_id: 4, name: "VIP Member 10%", code: "VIP10", discount_type: "percent", discount_value: 10, min_order: 500000, start_date: "2026-01-01", end_date: "2026-12-31", status: "active", usage_count: 892 },
  { promo_id: 5, name: "Omakase Pairing", code: "OMAKASE", discount_type: "amount", discount_value: 350000, min_order: 2500000, start_date: "2026-06-10", end_date: "2026-06-25", status: "active", usage_count: 74 },
  { promo_id: 6, name: "New Year Set", code: "NY2026", discount_type: "amount", discount_value: 500000, min_order: 2000000, start_date: "2026-01-01", end_date: "2026-02-15", status: "expired", usage_count: 318 },
  { promo_id: 7, name: "Manager Test Promo", code: "INTERNAL", discount_type: "percent", discount_value: 50, min_order: 0, start_date: "2026-06-01", end_date: "2026-12-31", status: "disabled", usage_count: 4 },
];

export const PROMO_STATUS_META = {
  active: { label: "Active", tone: "green" },
  scheduled: { label: "Scheduled", tone: "blue" },
  expired: { label: "Expired", tone: "muted" },
  disabled: { label: "Disabled", tone: "red" },
};

/* ---- Reports: reservation statistics ---- */
export const RESERVATION_STATS = {
  totalThisMonth: 1248,
  completionRate: 92,
  noShowRate: 4,
  avgPartySize: 3.8,
  byArea: [
    { area: "Main Dining", count: 412 },
    { area: "Window Area", count: 228 },
    { area: "Rooftop Terrace", count: 196 },
    { area: "VIP Lounge", count: 142 },
    { area: "Wine Bar", count: 158 },
    { area: "Private Room", count: 112 },
  ],
};

export const TABLE_UTILIZATION = [
  { area: "Main Dining", utilization: 84 },
  { area: "Window Area", utilization: 78 },
  { area: "Rooftop Terrace", utilization: 88 },
  { area: "VIP Lounge", utilization: 62 },
  { area: "Wine Bar", utilization: 71 },
  { area: "Private Room", utilization: 58 },
];

/* ============================================================
   Daily revenue time-series helpers (2-year mock trend)
   ============================================================ */

/** Fixed "today" anchor for demo data (June 2026). */
export const DASHBOARD_TODAY = new Date(2026, 5, 13);

function pseudoRandom(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Generate daily revenue for the last 2 years ending on `endDate`.
 * @returns {Array<{ date: string, revenue: number }>}
 */
export function generateTwoYearDailyRevenue(endDate = DASHBOARD_TODAY) {
  const totalDays = 730;
  const series = [];
  const floorRevenue = 16_500_000;

  for (let offset = totalDays - 1; offset >= 0; offset -= 1) {
    const date = startOfDay(subDays(endDate, offset));
    const progress = (totalDays - 1 - offset) / (totalDays - 1);
    const growth = 1 + progress * 0.92;
    const day = date.getDay();
    const weekendBoost = day === 0 || day === 5 || day === 6 ? 1.24 : 1;
    const month = date.getMonth();
    const seasonal = 1 + 0.14 * Math.sin((month / 12) * Math.PI * 2 - 0.4);
    const noise = 0.86 + pseudoRandom(offset + 17) * 0.28;
    const revenue = Math.round(floorRevenue * growth * weekendBoost * seasonal * noise);

    series.push({
      date: format(date, "yyyy-MM-dd"),
      revenue,
    });
  }

  return series;
}

export function getDefaultDateRange(today = DASHBOARD_TODAY) {
  return {
    startDate: startOfDay(subDays(today, 29)),
    endDate: endOfDay(today),
    key: "selection",
  };
}

export function filterDailyRevenue(dailySeries, range) {
  if (!Array.isArray(dailySeries) || !range?.startDate || !range?.endDate) return [];

  const start = startOfDay(range.startDate);
  const end = endOfDay(range.endDate);

  return dailySeries.filter((point) => {
    const day = parseISO(point.date);
    return isWithinInterval(day, { start, end });
  });
}

function aggregateWeekly(filtered) {
  if (!filtered.length) return [];

  const start = parseISO(filtered[0].date);
  const end = parseISO(filtered[filtered.length - 1].date);
  const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });

  return weeks.map((weekStart) => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const bucket = filtered.filter((point) => {
      const day = parseISO(point.date);
      return day >= weekStart && day <= weekEnd;
    });
    const revenue = bucket.reduce((sum, point) => sum + point.revenue, 0);
    return {
      date: format(weekStart, "yyyy-MM-dd"),
      label: format(weekStart, "MMM d"),
      revenue,
      value: revenue,
    };
  });
}

export function prepareChartSeries(filtered) {
  if (!filtered.length) return [];

  if (filtered.length > 90) {
    return aggregateWeekly(filtered);
  }

  return filtered.map((point) => ({
    ...point,
    value: point.revenue,
    label: format(parseISO(point.date), filtered.length <= 14 ? "EEE d" : "MMM d"),
  }));
}

export function formatDateRangeLabel(range) {
  if (!range?.startDate || !range?.endDate) return "Select dates";
  const { startDate, endDate } = range;
  if (isSameDay(startDate, endDate)) {
    return format(startDate, "MMMM d, yyyy");
  }
  return `${format(startDate, "MMMM d, yyyy")} - ${format(endDate, "MMMM d, yyyy")}`;
}

export function getDateRangePresets(today = DASHBOARD_TODAY) {
  const end = endOfDay(today);
  return [
    {
      id: "today",
      label: "Today",
      range: { startDate: startOfDay(today), endDate: end, key: "selection" },
    },
    {
      id: "last7",
      label: "Last 7 days",
      range: { startDate: startOfDay(subDays(today, 6)), endDate: end, key: "selection" },
    },
    {
      id: "last30",
      label: "Last 30 days",
      range: { startDate: startOfDay(subDays(today, 29)), endDate: end, key: "selection" },
    },
    {
      id: "mtd",
      label: "Month to date",
      range: { startDate: startOfMonth(today), endDate: end, key: "selection" },
    },
    {
      id: "ytd",
      label: "Year to date",
      range: { startDate: startOfYear(today), endDate: end, key: "selection" },
    },
    {
      id: "all",
      label: "All time",
      range: {
        startDate: startOfDay(subDays(today, 729)),
        endDate: end,
        key: "selection",
      },
    },
  ];
}

export function deriveKpisForRange(baseKpis, fullDailySeries, dateRange, reservations = []) {
  const base = Array.isArray(baseKpis) && baseKpis.length ? baseKpis : KPI_CARDS;
  const filtered = filterDailyRevenue(fullDailySeries, dateRange);
  const totalRevenue = filtered.reduce((sum, point) => sum + point.revenue, 0);

  const days = differenceInCalendarDays(dateRange.endDate, dateRange.startDate) + 1;
  const prevEnd = endOfDay(subDays(dateRange.startDate, 1));
  const prevStart = startOfDay(subDays(prevEnd, days - 1));
  const prevFiltered = filterDailyRevenue(fullDailySeries, {
    startDate: prevStart,
    endDate: prevEnd,
    key: "selection",
  });
  const prevRevenue = prevFiltered.reduce((sum, point) => sum + point.revenue, 0);
  const revenueDelta =
    prevRevenue > 0
      ? (((totalRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1)
      : null;

  const rangeStart = startOfDay(dateRange.startDate);
  const rangeEnd = endOfDay(dateRange.endDate);
  const reservationCount = (Array.isArray(reservations) ? reservations : []).filter((row) => {
    if (!row?.reservation_date) return false;
    const day = parseISO(row.reservation_date);
    return isWithinInterval(day, { start: rangeStart, end: rangeEnd });
  }).length;

  const scaledReservations =
    reservationCount > 0 ? reservationCount : Math.max(1, Math.round(45 * (days / 30)));

  const rangeLabel = days === 1 ? "Today" : `${days}-day range`;

  return base.map((kpi) => {
    if (kpi.id === "revenue") {
      return {
        ...kpi,
        value: totalRevenue,
        trend: {
          dir: totalRevenue >= prevRevenue ? "up" : "down",
          text:
            revenueDelta != null
              ? `${revenueDelta}% vs prior ${days}d`
              : "Selected period total",
        },
      };
    }
    if (kpi.id === "reservations") {
      return {
        ...kpi,
        value: scaledReservations,
        trend: { dir: "up", text: `${rangeLabel} · bookings` },
      };
    }
    if (kpi.id === "promos") {
      const activeBoost = days <= 7 ? 0 : days <= 30 ? 0 : 1;
      return {
        ...kpi,
        value: Number(kpi.value) + activeBoost,
        trend: {
          ...kpi.trend,
          text: days >= 30 ? "2 ending soon" : kpi.trend?.text,
        },
      };
    }
    return kpi;
  });
}

/** Expand mock reservations across recent weeks for richer range filtering demos. */
export function expandReservationsForDemo(reservations, today = DASHBOARD_TODAY) {
  if (!Array.isArray(reservations) || !reservations.length) return [];

  const expanded = [...reservations];
  const templates = reservations.slice(0, 5);

  for (let week = 1; week <= 8; week += 1) {
    templates.forEach((template, index) => {
      const date = format(subDays(today, week * 7 + index), "yyyy-MM-dd");
      expanded.push({
        ...template,
        reservation_id: template.reservation_id + week * 100 + index,
        reservation_date: date,
        status: week % 2 === 0 ? "completed" : "confirmed",
      });
    });
  }

  return expanded;
}
