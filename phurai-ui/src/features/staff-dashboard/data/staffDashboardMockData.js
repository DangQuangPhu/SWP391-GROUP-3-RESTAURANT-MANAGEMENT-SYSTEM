/* Sample data for /staff portal when the live API is unreachable. */

export const DEMO_NOTICE =
  "Showing sample reservation queue data. Connect the live API to replace it.";

export const RESERVATION_STATUS_META = {
  pending: { label: "Pending", tone: "amber" },
  confirmed: { label: "Confirmed", tone: "blue" },
  checked_in: { label: "Checked In", tone: "green" },
  completed: { label: "Completed", tone: "muted" },
  cancelled: { label: "Cancelled", tone: "red" },
  no_show: { label: "No Show", tone: "red" },
};

export const QUEUE_RESERVATIONS = [
  {
    reservation_id: 9101,
    customer_name: "Nguyen Thi Mai",
    email: "mai.nguyen@example.com",
    phone: "0903 221 445",
    reservation_date: "2026-06-13",
    start_time: "18:30",
    party_size: 4,
    area_name: "Window Area",
    table_label: "—",
    status: "pending",
    source: "online",
    special_request: "High chair needed for toddler",
    preorder: [],
  },
  {
    reservation_id: 9102,
    customer_name: "Tran Van Duc",
    email: "duc.tran@example.com",
    phone: "0918 552 901",
    reservation_date: "2026-06-13",
    start_time: "19:00",
    party_size: 2,
    area_name: "VIP Lounge",
    table_label: "—",
    status: "pending",
    source: "online",
    special_request: "Anniversary — quiet corner if possible",
    preorder: [{ dish_name: "Omakase Set B", qty: 2 }],
  },
  {
    reservation_id: 9103,
    customer_name: "Le Hoang Anh",
    email: "anh.le@example.com",
    phone: "0935 778 120",
    reservation_date: "2026-06-13",
    start_time: "20:15",
    party_size: 6,
    area_name: "Private Room",
    table_label: "—",
    status: "pending",
    source: "online",
    special_request: "Business dinner — need projector outlet",
    preorder: [],
  },
];

export const ASSIGN_TABLE_OPTIONS = [
  { table_id: 1, table_number: "W-01", area_name: "Window Area", capacity: 2 },
  { table_id: 3, table_number: "W-03", area_name: "Window Area", capacity: 4 },
  { table_id: 8, table_number: "S-03", area_name: "Standard Area", capacity: 4 },
  { table_id: 18, table_number: "VIP-01", area_name: "VIP Lounge", capacity: 4 },
  { table_id: 21, table_number: "PR-01", area_name: "Private Room", capacity: 10 },
];

export const STAFF_TABLES = [
  { table_id: 1, table_number: "M-01", area_name: "Main Dining", capacity: 2, status: "available" },
  { table_id: 2, table_number: "M-02", area_name: "Main Dining", capacity: 4, status: "occupied" },
  { table_id: 3, table_number: "M-03", area_name: "Main Dining", capacity: 4, status: "reserved" },
  { table_id: 4, table_number: "M-04", area_name: "Main Dining", capacity: 4, status: "occupied" },
  { table_id: 10, table_number: "W-10", area_name: "Window Area", capacity: 2, status: "available" },
  { table_id: 11, table_number: "W-12", area_name: "Window Area", capacity: 4, status: "occupied" },
  { table_id: 14, table_number: "B-03", area_name: "Wine Bar", capacity: 2, status: "occupied" },
  { table_id: 18, table_number: "V-01", area_name: "VIP Lounge", capacity: 8, status: "occupied" },
  { table_id: 20, table_number: "P-01", area_name: "Private Room", capacity: 10, status: "occupied" },
];

export const TABLE_STATUS_META = {
  available: { label: "Available", tone: "green" },
  reserved: { label: "Reserved", tone: "blue" },
  occupied: { label: "Occupied", tone: "amber" },
  cleaning: { label: "Cleaning", tone: "purple" },
  inactive: { label: "Inactive", tone: "muted" },
};

export const STAFF_AREAS = [
  "Main Dining",
  "Window Area",
  "Wine Bar",
  "VIP Lounge",
  "Private Room",
];

export const STAFF_ORDERS = [
  { order_id: 5101, order_number: "#A-5101", table_label: "M-02", items_count: 5, total: 2140000, status: "in_progress", kitchen_status: "cooking" },
  { order_id: 5102, order_number: "#A-5102", table_label: "B-03", items_count: 3, total: 980000, status: "in_progress", kitchen_status: "queued" },
  { order_id: 5103, order_number: "#A-5103", table_label: "R-05", items_count: 7, total: 3260000, status: "ready", kitchen_status: "ready" },
  { order_id: 5105, order_number: "#A-5105", table_label: "V-01", items_count: 9, total: 8700000, status: "in_progress", kitchen_status: "cooking" },
  { order_id: 5107, order_number: "#A-5107", table_label: "W-12", items_count: 6, total: 2450000, status: "in_progress", kitchen_status: "queued" },
  { order_id: 5109, order_number: "#A-5109", table_label: "P-01", items_count: 12, total: 12400000, status: "in_progress", kitchen_status: "cooking" },
];

export const ORDER_STATUS_META = {
  queued: { label: "Queued", tone: "muted" },
  in_progress: { label: "In Progress", tone: "amber" },
  cooking: { label: "Cooking", tone: "red" },
  ready: { label: "Ready", tone: "green" },
  served: { label: "Served", tone: "blue" },
  done: { label: "Done", tone: "muted" },
};

export const KITCHEN_TICKETS = [
  {
    ticket_id: 1,
    order_number: "#A-5102",
    table_label: "B-03",
    items: [{ name: "Yellowtail Jalapeño", qty: 2 }, { name: "Hokkaido Scallop", qty: 1 }],
    kitchen_status: "queued",
    elapsed_min: 3,
  },
  {
    ticket_id: 2,
    order_number: "#A-5107",
    table_label: "W-12",
    items: [{ name: "Wagyu Sukiyaki", qty: 1 }, { name: "Truffle Udon", qty: 2 }],
    kitchen_status: "queued",
    elapsed_min: 5,
  },
  {
    ticket_id: 3,
    order_number: "#A-5101",
    table_label: "M-02",
    items: [{ name: "Omakase Set", qty: 2 }, { name: "Spicy Miso Ramen", qty: 1 }],
    kitchen_status: "cooking",
    elapsed_min: 11,
  },
  {
    ticket_id: 4,
    order_number: "#A-5105",
    table_label: "V-01",
    items: [{ name: "Wagyu Sukiyaki", qty: 3 }, { name: "Matcha Tiramisu", qty: 2 }],
    kitchen_status: "cooking",
    elapsed_min: 14,
  },
  {
    ticket_id: 5,
    order_number: "#A-5109",
    table_label: "P-01",
    items: [{ name: "Omakase Set", qty: 4 }],
    kitchen_status: "cooking",
    elapsed_min: 18,
  },
  {
    ticket_id: 6,
    order_number: "#A-5103",
    table_label: "R-05",
    items: [{ name: "Truffle Udon", qty: 3 }],
    kitchen_status: "ready",
    elapsed_min: 22,
  },
];
