export const RESERVATION_STATUS = {
  PENDING_REQUEST: 'Pending Request',
  PENDING_PAYMENT: 'Pending Payment',
  PAID: 'Paid',
  PAYMENT_FAILED: 'PaymentFailed',
  RESERVED: 'Reserved',
  CONFIRMED: 'Confirmed',
  AWAIT_CHECK_IN: 'Await Check-in',
  CHECK_IN: 'Check-in',
  SEATED: 'Seated',
  OCCUPIED: 'Occupied',
  CLEANING: 'Cleaning',
  CHECK_OUT: 'Check-out',
  COMPLETED: 'Completed',
  COMPLETE_PAID: 'Complete Paid',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No Show',
  REJECT_REQUEST: 'Reject Request',
  REJECT_CHECK_IN: 'Reject Check-in',
  REJECT_CHECK_OUT: 'Reject Check-out',
  // Legacy — chỉ tồn tại trên data cũ chưa migrate hết, KHÔNG set giá trị
  // này từ code mới. Giữ lại trong enum để code không throw khi đọc data cũ.
  PENDING_LEGACY: 'Pending',
};

// Nhóm hiển thị cho UI (badge color, filter group)
export const STATUS_GROUP = {
  PENDING: 'pending',     // amber
  ACTIVE: 'active',       // blue
  SUCCESS: 'success',     // green
  NEGATIVE: 'negative',   // red
};

export const RESERVATION_STATUS_META = {
  'Pending Request': { label: 'Pending Request', tone: 'amber', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  'Pending Payment': { label: 'Pending Payment', tone: 'amber', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  'Pending': { label: 'Pending', tone: 'amber', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  'Reserved': { label: 'Reserved', tone: 'blue', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  'Confirmed': { label: 'Confirmed', tone: 'blue', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  'Await Check-in': { label: 'Await Check-in', tone: 'purple', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  'Check-in': { label: 'Checked In', tone: 'purple', color: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200' },
  'Seated': { label: 'Seated', tone: 'purple', color: 'bg-pink-100 text-pink-800 border-pink-200' },
  'Occupied': { label: 'Occupied', tone: 'purple', color: 'bg-pink-100 text-pink-800 border-pink-200' },
  'Paid': { label: 'Paid', tone: 'green', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  'Complete Paid': { label: 'Complete Paid', tone: 'green', color: 'bg-teal-100 text-teal-800 border-teal-200' },
  'Completed': { label: 'Completed', tone: 'muted', color: 'bg-green-100 text-green-800 border-green-200' },
  'Check-out': { label: 'Checked Out', tone: 'muted', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  'Cleaning': { label: 'Cleaning', tone: 'purple', color: 'bg-gray-100 text-gray-800 border-gray-200' },
  'Cancelled': { label: 'Cancelled', tone: 'red', color: 'bg-red-100 text-red-800 border-red-200' },
  'No Show': { label: 'No Show', tone: 'red', color: 'bg-rose-100 text-rose-800 border-rose-200' },
  'Overdue': { label: 'Overdue', tone: 'red', color: 'bg-red-200 text-red-900 border-red-300' },
  'PaymentFailed': { label: 'Payment Failed', tone: 'red', color: 'bg-red-100 text-red-800 border-red-200' },
  'Reject Check-in': { label: 'Check-in Rejected', tone: 'red', color: 'bg-red-100 text-red-800 border-red-200' },
  'Reject Request': { label: 'Request Rejected', tone: 'red', color: 'bg-red-100 text-red-800 border-red-200' },
  'Reject Check-out': { label: 'Check-out Rejected', tone: 'red', color: 'bg-red-100 text-red-800 border-red-200' }
};

export const FILTER_GROUPS = {
  'Pending': [RESERVATION_STATUS.PENDING_REQUEST, RESERVATION_STATUS.PENDING_PAYMENT, RESERVATION_STATUS.PENDING_LEGACY],
  'Upcoming': [RESERVATION_STATUS.RESERVED, RESERVATION_STATUS.CONFIRMED, RESERVATION_STATUS.PAID, RESERVATION_STATUS.AWAIT_CHECK_IN],
  'In Progress': [RESERVATION_STATUS.CHECK_IN, RESERVATION_STATUS.SEATED, RESERVATION_STATUS.OCCUPIED, RESERVATION_STATUS.CLEANING, RESERVATION_STATUS.CHECK_OUT],
  'Completed': [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.COMPLETE_PAID],
  'Cancelled/Rejected': [
    RESERVATION_STATUS.CANCELLED,
    RESERVATION_STATUS.NO_SHOW,
    RESERVATION_STATUS.REJECT_REQUEST,
    RESERVATION_STATUS.REJECT_CHECK_IN,
    RESERVATION_STATUS.REJECT_CHECK_OUT,
    RESERVATION_STATUS.PAYMENT_FAILED,
  ],
};

// Finite state machine — validate MỌI lần update status ở backend bằng map này,
// không cho phép nhảy cóc (ví dụ Pending Request -> Completed).
export const ALLOWED_TRANSITIONS = {
  [RESERVATION_STATUS.PENDING_REQUEST]: [RESERVATION_STATUS.PENDING_PAYMENT, RESERVATION_STATUS.REJECT_REQUEST, RESERVATION_STATUS.CANCELLED],
  [RESERVATION_STATUS.PENDING_PAYMENT]: [RESERVATION_STATUS.PAID, RESERVATION_STATUS.PAYMENT_FAILED, RESERVATION_STATUS.CANCELLED],
  [RESERVATION_STATUS.PAYMENT_FAILED]: [RESERVATION_STATUS.PENDING_PAYMENT, RESERVATION_STATUS.CANCELLED], // cho phép thử lại
  [RESERVATION_STATUS.PAID]: [RESERVATION_STATUS.CONFIRMED],
  [RESERVATION_STATUS.RESERVED]: [RESERVATION_STATUS.SEATED, RESERVATION_STATUS.NO_SHOW, RESERVATION_STATUS.REJECT_CHECK_IN, RESERVATION_STATUS.CANCELLED],
  [RESERVATION_STATUS.CONFIRMED]: [RESERVATION_STATUS.SEATED, RESERVATION_STATUS.NO_SHOW, RESERVATION_STATUS.REJECT_CHECK_IN, RESERVATION_STATUS.CANCELLED],
  [RESERVATION_STATUS.SEATED]: [RESERVATION_STATUS.CLEANING, RESERVATION_STATUS.REJECT_CHECK_OUT],
  [RESERVATION_STATUS.CLEANING]: [RESERVATION_STATUS.CHECK_OUT],
  [RESERVATION_STATUS.CHECK_OUT]: [RESERVATION_STATUS.COMPLETED],
  // Terminal states — không có transition tiếp theo:
  [RESERVATION_STATUS.COMPLETED]: [],
  [RESERVATION_STATUS.CANCELLED]: [],
  [RESERVATION_STATUS.NO_SHOW]: [],
  [RESERVATION_STATUS.REJECT_REQUEST]: [],
  [RESERVATION_STATUS.REJECT_CHECK_IN]: [],
  [RESERVATION_STATUS.REJECT_CHECK_OUT]: [],
};

export function canTransition(fromStatus, toStatus) {
  const allowed = ALLOWED_TRANSITIONS[fromStatus];
  return Array.isArray(allowed) && allowed.includes(toStatus);
}
