import { SHARED_MOCK_RESERVATIONS } from "../../../data/sharedMockReservations.js";


export const RESERVATION_STATUS_META = {
  "pending request": { label: "Pending Request", tone: "amber" },
  "await check-in": { label: "Await Check-in", tone: "blue" },
  "check-in": { label: "Check-in", tone: "green" },
  "occupied": { label: "Occupied", tone: "purple" },
  "complete paid": { label: "Complete Paid", tone: "muted" },
  "check-out": { label: "Check-out", tone: "muted" },
  "reject check-in": { label: "Reject Check-in", tone: "red" },
  "reject request": { label: "Reject Request", tone: "red" },
};
const todayIso = new Date().toISOString().split("T")[0];
export const QUEUE_RESERVATIONS = SHARED_MOCK_RESERVATIONS;

export const ASSIGN_TABLE_OPTIONS = [
  { table_id: 1, table_number: "W-01", area_name: "Window Area", capacity: 2 },
  { table_id: 3, table_number: "W-03", area_name: "Window Area", capacity: 4 },
  { table_id: 8, table_number: "S-03", area_name: "Standard Area", capacity: 4 },
  { table_id: 18, table_number: "VIP-01", area_name: "VIP Lounge", capacity: 4 },
  { table_id: 21, table_number: "PR-01", area_name: "Private Room", capacity: 10 },
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



export const STAFF_MENU_DISHES = [
  { dish_id: 1, dish_name: "Omakase Set A", category_name: "Omakase", price: 890000, is_available: true },
  { dish_id: 3, dish_name: "Yellowtail Jalapeño", category_name: "Sashimi", price: 320000, is_available: true },
  { dish_id: 5, dish_name: "Matcha Tiramisu", category_name: "Dessert", price: 180000, is_available: true },
  { dish_id: 8, dish_name: "Wagyu Sukiyaki", category_name: "Hot Pot", price: 1250000, is_available: true },
];

export const STAFF_PAYMENT_BILL = {
  table_id: 2,
  table_number: "M-02",
  area_name: "Main Dining",
  capacity: 4,
  order_id: 5101,
  order_status: "Billed",
  service_charge_percent: 5,
  subtotal: 2100000,
  service_charge: 105000,
  discount_amount: 0,
  total_amount: 2205000,
  applied_voucher: null,
  items: [
    {
      order_item_id: 102,
      dish_name: "Yellowtail Jalapeño",
      quantity: 1,
      unit_price: 320000,
      line_total: 320000,
      notes: "Ít cay",
      item_status: "Ready",
    },
    {
      order_item_id: 103,
      dish_name: "Matcha Tiramisu",
      quantity: 1,
      unit_price: 180000,
      line_total: 180000,
      notes: null,
      item_status: "Served",
    },
    {
      order_item_id: 101,
      dish_name: "Omakase Set A",
      quantity: 2,
      unit_price: 890000,
      line_total: 1780000,
      notes: null,
      item_status: "Served",
    },
  ],
};

export function getMockPaymentBill(tableId) {
  return {
    ...STAFF_PAYMENT_BILL,
    table_id: tableId,
    table_number: `T-${tableId}`,
  };
}

export const STAFF_ORDERS = [
  { order_id: 5101, order_number: "#A-5101", table_label: "M-02", items_count: 5, total: 2140000, status: "in_progress", kitchen_status: "cooking" },
  { order_id: 5102, order_number: "#A-5102", table_label: "B-03", items_count: 3, total: 980000, status: "in_progress", kitchen_status: "queued" },
  { order_id: 5103, order_number: "#A-5103", table_label: "R-05", items_count: 7, total: 3260000, status: "ready", kitchen_status: "ready" },
  { order_id: 5105, order_number: "#A-5105", table_label: "V-01", items_count: 9, total: 8700000, status: "in_progress", kitchen_status: "cooking" },
  { order_id: 5107, order_number: "#A-5107", table_label: "W-12", items_count: 6, total: 2450000, status: "in_progress", kitchen_status: "queued" },
  { order_id: 5109, order_number: "#A-5109", table_label: "P-01", items_count: 12, total: 12400000, status: "in_progress", kitchen_status: "cooking" },
];

export const STAFF_KDS_READY = [
  {
    order_item_id: 102,
    order_id: 5103,
    dish_name: "Yellowtail Jalapeño",
    table_number: "M-02",
    quantity: 1,
    wait_minutes: 3,
    item_status: "Ready",
    display_status: "Ready",
  },
  {
    order_item_id: 205,
    order_id: 5103,
    dish_name: "Truffle Udon",
    table_number: "R-05",
    quantity: 3,
    wait_minutes: 6,
    item_status: "Ready",
    display_status: "Ready",
  },
];

export const STAFF_KDS_DELAYED = [
  {
    order_item_id: 301,
    order_id: 5109,
    dish_name: "Omakase Set",
    table_number: "P-01",
    quantity: 4,
    wait_minutes: 22,
    item_status: "Preparing",
    display_status: "Cooking",
  },
  {
    order_item_id: 302,
    order_id: 5101,
    dish_name: "Spicy Miso Ramen",
    table_number: "M-02",
    quantity: 1,
    wait_minutes: 18,
    item_status: "Sent To Kitchen",
    display_status: "Cooking",
  },
  {
    order_item_id: 303,
    order_id: 5107,
    dish_name: "Wagyu Sukiyaki",
    table_number: "W-12",
    quantity: 1,
    wait_minutes: 16,
    item_status: "Pending",
    display_status: "Pending",
  },
];

export const STAFF_REPORT_SUMMARY = {
  report_date: "2026-06-13",
  total_revenue: 18450000,
  completed_payments_count: 6,
  paid_orders_count: 6,
  tables_served_count: 5,
};

export const STAFF_REPORT_AUDIT = [
  {
    audit_log_id: 1,
    created_at: "2026-05-18T09:15:00",
    action_name: "CONFIRM_RESERVATION",
    user_name: "Le Minh Staff",
    target_table: "Reservations",
    target_id: 1,
    target_label: "Reservations #1",
    ip_address: "127.0.0.1",
  },
  {
    audit_log_id: 2,
    created_at: "2026-06-13T14:22:00",
    action_name: "CHECKOUT_PAYMENT",
    user_name: "Le Minh Staff",
    target_table: "Orders",
    target_id: 5102,
    target_label: "Orders #5102",
    ip_address: "192.168.1.12",
  },
  {
    audit_log_id: 3,
    created_at: "2026-06-13T13:05:00",
    action_name: "TABLE_CHECK_IN",
    user_name: "Le Minh Staff",
    target_table: "RestaurantTables",
    target_id: 18,
    target_label: "RestaurantTables #18",
    ip_address: "192.168.1.12",
  },
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
