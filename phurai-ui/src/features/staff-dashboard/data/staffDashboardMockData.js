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
