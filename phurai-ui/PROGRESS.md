# PROGRESS.md

## 🚀 [BMAD] Smart Reservation Time UX & Auto-Duration 🚀

**Status:** DONE
**Module:** Reservation UX & Validation Layer
**Methodology:** ECC-VAL (Error-Control & Context - Validation) & ECC-ARCH

### 1. Context & Mission
Refining the reservation time selection UX by replacing static duration selections with a flexible dining duration logic. The dining duration is fixed at **90 minutes** (1h30m). The Expected End Time is calculated as `Expected End Time = Start Time + 90 minutes + table_hold_min` (grace period). The explicit End Time and Duration selectors are hidden from the customer form, and replaced with a friendly policy notification showing the dining limit and hold duration.

### 2. Implementation & Exact File Paths

**File 1: `src/features/reservations/components/ReservationDetails.jsx`**
- Hides the End Time input field and the Duration dropdown.
- Renders a notice banner showing the dining duration and hold limit.
- Recalculates expected end time when the start time changes.
- Validates that the start time plus full window does not exceed midnight.

**File 2: `src/features/reservations/pages/ReservationPage.jsx`**
- Passes the database-derived `table_hold_min` value to `ReservationDetails` prop.
- Queries availability for the entire reservation window (`90 + table_hold_min`) to prevent overlapping bookings.
- Maps form fields appropriately on transition to the summary step.

**File 3: `server/middleware/validateReservation.js`**
- Adjusts `validateReservationCreate` and `validateReservationUpdate` checks to support reservations up to `90 + body.durationMinutes`.
- Triggers extra fee surcharge logic dynamically if the grace period exceeds 30 minutes.


## 🚀 [BMAD] Fix FSM: Reservation Check-in vs Table Status 🚀

**Status:** TESTING
**Module:** Staff Portal / FSM Seating Flow
**Methodology:** ECC-STATE & ECC-ARCH

### 1. Context & Mission
Currently, clicking check-in on a reserved table in the floor map bypasses the customer's reservation details and throws a 409 conflict because table check-in operates on reservations rather than physical tables. The mission is to intercept this action, display customer details first, update the FSM transition paths, and run an atomic SQL transaction to seat the guest, link their active QR session, and process preorders to the KDS queue.

### 2. Proposed File Paths & Scope
- `server/db.js`: Enable startup database migration patch to update constraints.
- `server/controllers/staffController.js`: Include `active_reservation_id` and customer name in `/api/staff/tables` endpoint.
- `server/controllers/staffReservationController.js`: Enhance reservation check-in with table updates, QR session creation, preorder KDS queuing, and check-in emails.
- `server/routes/staff.js`: Add check-in route aliases to support both hyphenated and non-hyphenated API endpoints.
- `src/features/staff-dashboard/services/staffApi.js`: Add single reservation detail fetcher.
- `src/features/staff-dashboard/components/StaffTableTab.jsx`: Intercept check-in on reserved tables, redirecting to the customer verification and seating confirmation modal.
