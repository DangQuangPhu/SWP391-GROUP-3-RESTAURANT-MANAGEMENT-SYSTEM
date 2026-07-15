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
  AWAIT_CHECK_IN: 'Await Check-in',
  DINING: 'Dining',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No Show',
  // Legacy aliases mapped to the 7 pure states for seamless compatibility
  get CONFIRMED() { return 'Await Check-in'; },
  get CHECK_IN() { return 'Await Check-in'; },
  get PAYMENT_PENDING() { return 'Awaiting Deposit'; },
  get PENDING_PAYMENT() { return 'Awaiting Deposit'; },
  get PAID() { return 'Await Check-in'; },
  get PAYMENT_FAILED() { return 'Awaiting Deposit'; },
  get RESERVED() { return 'Await Check-in'; },
  get AWAIT_CHECK_IN() { return 'Await Check-in'; },
  get OCCUPIED() { return 'Dining'; },
  get CLEANING() { return 'Await Check-in'; },
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
  RESERVATION_STATUS.AWAIT_CHECK_IN,
  RESERVATION_STATUS.DINING,
  RESERVATION_STATUS.COMPLETED,
  RESERVATION_STATUS.CANCELLED,
  RESERVATION_STATUS.NO_SHOW,
];

export const STAFF_VISIBLE_STATUSES = [
  RESERVATION_STATUS.AWAIT_CHECK_IN,
  RESERVATION_STATUS.DINING,
  RESERVATION_STATUS.AWAITING_DEPOSIT,
  RESERVATION_STATUS.COMPLETED
];

// Finite state machine validating status transitions
export const ALLOWED_TRANSITIONS = {
  [RESERVATION_STATUS.PENDING_REQUEST]: [RESERVATION_STATUS.AWAITING_DEPOSIT, RESERVATION_STATUS.AWAIT_CHECK_IN, RESERVATION_STATUS.CANCELLED],
  [RESERVATION_STATUS.AWAITING_DEPOSIT]: [RESERVATION_STATUS.AWAIT_CHECK_IN, RESERVATION_STATUS.NO_SHOW, RESERVATION_STATUS.CANCELLED],
  [RESERVATION_STATUS.AWAIT_CHECK_IN]: [RESERVATION_STATUS.DINING, RESERVATION_STATUS.CANCELLED, RESERVATION_STATUS.NO_SHOW],
  [RESERVATION_STATUS.DINING]: [RESERVATION_STATUS.COMPLETED],
  [RESERVATION_STATUS.COMPLETED]: [],
  [RESERVATION_STATUS.CANCELLED]: [],
  [RESERVATION_STATUS.NO_SHOW]: [],
};

export function canTransition(fromStatus, toStatus) {
  const allowed = ALLOWED_TRANSITIONS[fromStatus];
  return Array.isArray(allowed) && allowed.includes(toStatus);
}
