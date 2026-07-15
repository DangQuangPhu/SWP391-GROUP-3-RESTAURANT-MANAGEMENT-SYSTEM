export const RESERVATION_STATUS = {
  PENDING_REQUEST: 'Pending Request',
  AWAITING_DEPOSIT: 'Awaiting Deposit',
  AWAIT_CHECK_IN: 'Await Check-in',
  DINING: 'Dining',
  PENDING_PAYMENT: 'Pending Payment',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No Show',
  // Legacy aliases mapped to the 8 pure states for seamless compatibility
  get CONFIRMED() { return 'Await Check-in'; },
  get CHECK_IN() { return 'Await Check-in'; },
  get PAYMENT_PENDING() { return 'Pending Payment'; },
  get PAID() { return 'Await Check-in'; },
  get PAYMENT_FAILED() { return 'Awaiting Deposit'; },
  get RESERVED() { return 'Await Check-in'; },
  get OCCUPIED() { return 'Dining'; },
  get CLEANING() { return 'Await Check-in'; },
  get CHECK_OUT() { return 'Completed'; },
  get COMPLETE_PAID() { return 'Completed'; },
  get REJECT_REQUEST() { return 'Cancelled'; },
  get REJECT_CHECK_IN() { return 'Cancelled'; },
  get REJECT_CHECK_OUT() { return 'Completed'; },
  get PENDING_LEGACY() { return 'Pending Request'; }
};

// Display group for UI (badge color, filter group)
export const STATUS_GROUP = {
  PENDING: 'pending',     // amber
  ACTIVE: 'active',       // blue
  SUCCESS: 'success',     // green
  NEGATIVE: 'negative',   // red
};

export const RESERVATION_STATUS_META = {
  // pulse: true → badge gets animate-pulse for attention-requiring statuses
  'Pending Request': { label: 'Pending Request', tone: 'amber', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', pulse: true },
  'Awaiting Deposit': { label: 'Awaiting Deposit', tone: 'amber', color: 'bg-orange-100 text-orange-800 border-orange-200', pulse: true },
  'Await Check-in': { label: 'Await Check-in', tone: 'blue', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  'Dining': { label: 'Dining', tone: 'green', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', pulse: true },
  // Pending Payment: post-dining, bill presented, awaiting payment — purple pulse
  'Pending Payment': { label: 'Pending Payment', tone: 'purple', color: 'bg-violet-100 text-violet-800 border-violet-200', pulse: true },
  'Completed': { label: 'Completed', tone: 'muted', color: 'bg-green-100 text-green-800 border-green-200' },
  'Cancelled': { label: 'Cancelled', tone: 'red', color: 'bg-red-100 text-red-800 border-red-200' },
  'No Show': { label: 'No Show', tone: 'red', color: 'bg-rose-100 text-rose-800 border-rose-200' },
  // Legacy aliases mapped for UI robustness
  'Payment Pending': { label: 'Pending Payment', tone: 'purple', color: 'bg-violet-100 text-violet-800 border-violet-200', pulse: true },
  'Pending': { label: 'Pending Request', tone: 'amber', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  'Reserved': { label: 'Await Check-in', tone: 'blue', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  'Confirmed': { label: 'Await Check-in', tone: 'blue', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  'Check-in': { label: 'Await Check-in', tone: 'blue', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  'Occupied': { label: 'Dining', tone: 'green', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', pulse: true },
  'Paid': { label: 'Await Check-in', tone: 'blue', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  'Complete Paid': { label: 'Completed', tone: 'muted', color: 'bg-green-100 text-green-800 border-green-200' },
  'Check-out': { label: 'Completed', tone: 'muted', color: 'bg-green-100 text-green-800 border-green-200' },
  'Cleaning': { label: 'Await Check-in', tone: 'purple', color: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200' },
  'Overdue': { label: 'Cancelled', tone: 'red', color: 'bg-red-100 text-red-800 border-red-200' },
  'PaymentFailed': { label: 'Payment Failed', tone: 'red', color: 'bg-red-100 text-red-800 border-red-200' },
  'Reject Check-in': { label: 'Check-in Rejected', tone: 'red', color: 'bg-red-100 text-red-800 border-red-200' },
  'Reject Request': { label: 'Request Rejected', tone: 'red', color: 'bg-red-100 text-red-800 border-red-200' },
  'Reject Check-out': { label: 'Check-out Rejected', tone: 'red', color: 'bg-red-100 text-red-800 border-red-200' }
};

export const FILTER_GROUPS = {
  'Pending': [RESERVATION_STATUS.PENDING_REQUEST, RESERVATION_STATUS.AWAITING_DEPOSIT],
  'Upcoming': [RESERVATION_STATUS.AWAIT_CHECK_IN],
  'In Progress': [RESERVATION_STATUS.DINING],
  'Completed': [RESERVATION_STATUS.COMPLETED],
  'Cancelled/Rejected': [
    RESERVATION_STATUS.CANCELLED,
    RESERVATION_STATUS.NO_SHOW,
  ],
};

export const ALL_RESERVATION_STATUSES = [
  RESERVATION_STATUS.PENDING_REQUEST,
  RESERVATION_STATUS.AWAITING_DEPOSIT,
  RESERVATION_STATUS.AWAIT_CHECK_IN,
  RESERVATION_STATUS.DINING,
  RESERVATION_STATUS.PENDING_PAYMENT,
  RESERVATION_STATUS.COMPLETED,
  RESERVATION_STATUS.CANCELLED,
  RESERVATION_STATUS.NO_SHOW,
];

export const STAFF_VISIBLE_STATUSES = [
  RESERVATION_STATUS.AWAIT_CHECK_IN,
  RESERVATION_STATUS.DINING,
  RESERVATION_STATUS.PENDING_PAYMENT,
  RESERVATION_STATUS.AWAITING_DEPOSIT,
  RESERVATION_STATUS.COMPLETED
];

// Finite state machine validating status transitions
export const ALLOWED_TRANSITIONS = {
  [RESERVATION_STATUS.PENDING_REQUEST]: [RESERVATION_STATUS.AWAITING_DEPOSIT, RESERVATION_STATUS.AWAIT_CHECK_IN, RESERVATION_STATUS.CANCELLED],
  [RESERVATION_STATUS.AWAITING_DEPOSIT]: [RESERVATION_STATUS.AWAIT_CHECK_IN, RESERVATION_STATUS.NO_SHOW, RESERVATION_STATUS.CANCELLED],
  [RESERVATION_STATUS.AWAIT_CHECK_IN]: [RESERVATION_STATUS.DINING, RESERVATION_STATUS.CANCELLED, RESERVATION_STATUS.NO_SHOW],
  [RESERVATION_STATUS.DINING]: [RESERVATION_STATUS.PENDING_PAYMENT, RESERVATION_STATUS.COMPLETED],
  [RESERVATION_STATUS.PENDING_PAYMENT]: [RESERVATION_STATUS.COMPLETED],
  [RESERVATION_STATUS.COMPLETED]: [],
  [RESERVATION_STATUS.CANCELLED]: [],
  [RESERVATION_STATUS.NO_SHOW]: [],
};

export function canTransition(fromStatus, toStatus) {
  const allowed = ALLOWED_TRANSITIONS[fromStatus];
  return Array.isArray(allowed) && allowed.includes(toStatus);
}
