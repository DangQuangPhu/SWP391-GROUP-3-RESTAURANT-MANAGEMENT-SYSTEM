/**
 * reservationStatus.js (backend/src/constants)
 *
 * Backend-owned copy of reservation status constants.
 * Originally from frontend/src/shared/reservationStatus.js.
 *
 * IMPORTANT: Keep this in sync with frontend/src/shared/reservationStatus.js.
 * The frontend version is the source of truth for the UI; this copy exists
 * because Docker's backend container does NOT include the frontend directory.
 */

export const RESERVATION_STATUS = {
  PENDING_REQUEST: 'Pending Request',
  AWAITING_DEPOSIT: 'Awaiting Deposit',
  CONFIRMED: 'Confirmed',
  CHECK_IN: 'Check-in',
  DINING: 'Dining',
  PAYMENT_PENDING: 'Payment Pending',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No Show',
  // Legacy aliases mapped to the 9 pure states for seamless compatibility
  get PENDING_PAYMENT() { return 'Payment Pending'; },
  get PAID() { return 'Confirmed'; },
  get PAYMENT_FAILED() { return 'Payment Pending'; },
  get RESERVED() { return 'Confirmed'; },
  get AWAIT_CHECK_IN() { return 'Confirmed'; },
  get OCCUPIED() { return 'Dining'; },
  get CLEANING() { return 'Check-in'; },
  get CHECK_OUT() { return 'Completed'; },
  get COMPLETE_PAID() { return 'Completed'; },
  get REJECT_REQUEST() { return 'Cancelled'; },
  get REJECT_CHECK_IN() { return 'Cancelled'; },
  get REJECT_CHECK_OUT() { return 'Completed'; },
  get PENDING_LEGACY() { return 'Pending Request'; }
};

export const STATUS_GROUP = {
  PENDING: 'pending',
  ACTIVE: 'active',
  SUCCESS: 'success',
  NEGATIVE: 'negative',
};

export const ALL_RESERVATION_STATUSES = [
  RESERVATION_STATUS.PENDING_REQUEST,
  RESERVATION_STATUS.AWAITING_DEPOSIT,
  RESERVATION_STATUS.CONFIRMED,
  RESERVATION_STATUS.CHECK_IN,
  RESERVATION_STATUS.DINING,
  RESERVATION_STATUS.PAYMENT_PENDING,
  RESERVATION_STATUS.COMPLETED,
  RESERVATION_STATUS.CANCELLED,
  RESERVATION_STATUS.NO_SHOW,
];

export const STAFF_VISIBLE_STATUSES = [
  RESERVATION_STATUS.CONFIRMED,
  RESERVATION_STATUS.CHECK_IN,
  RESERVATION_STATUS.DINING,
  RESERVATION_STATUS.PAYMENT_PENDING,
  RESERVATION_STATUS.COMPLETED
];

// Finite state machine validating status transitions
export const ALLOWED_TRANSITIONS = {
  [RESERVATION_STATUS.PENDING_REQUEST]: [RESERVATION_STATUS.AWAITING_DEPOSIT, RESERVATION_STATUS.CONFIRMED, RESERVATION_STATUS.CANCELLED],
  [RESERVATION_STATUS.AWAITING_DEPOSIT]: [RESERVATION_STATUS.CONFIRMED, RESERVATION_STATUS.PAYMENT_PENDING, RESERVATION_STATUS.CANCELLED],
  [RESERVATION_STATUS.PAYMENT_PENDING]: [RESERVATION_STATUS.CONFIRMED, RESERVATION_STATUS.CANCELLED],
  [RESERVATION_STATUS.CONFIRMED]: [RESERVATION_STATUS.CHECK_IN, RESERVATION_STATUS.DINING, RESERVATION_STATUS.CANCELLED, RESERVATION_STATUS.NO_SHOW],
  [RESERVATION_STATUS.CHECK_IN]: [RESERVATION_STATUS.DINING, RESERVATION_STATUS.CANCELLED],
  [RESERVATION_STATUS.DINING]: [RESERVATION_STATUS.COMPLETED],
  [RESERVATION_STATUS.COMPLETED]: [],
  [RESERVATION_STATUS.CANCELLED]: [],
  [RESERVATION_STATUS.NO_SHOW]: [],
};

export function canTransition(fromStatus, toStatus) {
  const allowed = ALLOWED_TRANSITIONS[fromStatus];
  return Array.isArray(allowed) && allowed.includes(toStatus);
}
