# PROGRESS.md

## 🏛️ [ARCHITECTURE] Wave 9 Cleanup — Core Utils Consolidation

**Status:** DONE  
**Date:** 2026-07-09  
**Methodology:** BMAD — Strangler Fig Wave 9 (per `DangQuangPhu-DE190951/ARCHITECTURE.md`)

### What Was Done

**Problem:** Legacy `src/utils/` folder held live utility code (`asArray.js`) and dead stubs (`formatBookingId.js`), while the architecture mandates that shared cross-cutting utils live in `src/core/utils/`.

**Changes:**

| Action | File |
|--------|------|
| ✅ Created canonical | `src/core/utils/asArray.js` — live function moved here |
| ✅ Converted to shim | `src/utils/asArray.js` → re-exports from `@/core/utils/asArray.js` |
| ✅ Updated 15 consumer files | All `@/utils/asArray` imports → `@/core/utils/asArray` |
| ✅ Updated 14 consumer files | All `@/utils/formatCurrency` imports → `@/core/utils/formatCurrency` |
| ✅ Deleted dead stub | `src/utils/formatBookingId.js` (deprecated, zero consumers) |
| ✅ Deleted dead shim | `src/api/index.js` + removed empty `src/api/` directory |

**Verification:** `vite build` → ✓ 3772 modules, zero errors.

---

## 🚀 [BMAD] Smart Reservation Time UX &amp; Auto-Duration 🚀


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

**Status:** DONE (superseded by FSM Dashboard feature below)

---

## 🚀 [BMAD] Live FSM Dashboard, RBAC Tabs & AuditLog Timeline 🚀

**Status:** IN PROGRESS — Phase 2 (PLAN) complete, awaiting /feature-dev approval
**Module:** Manager Dashboard / ReservationsSection
**Methodology:** ECC-ARCH + ECC-RBAC + ECC-SEC (clean-architecture.md, SECURITY_GUARDRAILS.md, api-security-patterns.md)
**Started:** 2026-07-08

### 1. Context & Mission
Replacing the static status dropdown in `ReservationsSection.jsx` with 5 FSM tab pills (Pending / Upcoming / In Progress / Completed / Cancelled). Adding RBAC so Staff cannot see the Cancel/Reject/Edit actions. Upgrading the Timeline drawer to use the live `/api/reservations/:id/timeline` endpoint (with `role_name` enrichment) instead of the legacy `/manager/reservations/:id/history`.

### 2. DB Verification (Phase 1 — READ)
- AuditLog JOIN schema confirmed from `backend/src/routes/reservations.js` (lines 1741–1757)
- `test-timeline-schema.js` written and validated (schema shape confirmed; outbound TCP blocked in AI sandbox, but dev server runs fine at 6h+ uptime)
- **Security**: No `password_hash`/`otp_hash` in SELECT, parameterized query, LEFT JOIN pattern safe

### 3. Key Finding — Duplicate Route Bug
`backend/src/routes/reservations.js` has TWO `/:id/timeline` handlers (line 48 + line 1713). The inline handler at line 1713 shadows the canonical `timelineLogger.js` handler. **Removing the duplicate at lines 1709–1822 is a critical fix in Phase 3.**

### 4. Phase 3 File Scope (BUILD)
- `frontend/.../ReservationsSection.jsx` — FSM tabs + RBAC guards + timeline source upgrade
- `frontend/.../managerApi.js` — Add `getReservationTimeline()`
- `backend/src/utils/timelineLogger.js` — Add `role_name` JOIN to query
- `backend/src/routes/reservations.js` — Remove duplicate timeline handler (lines 1709–1822)

---

## 🚀 [BMAD] Fix FSM: Reservation Check-in vs Table Status 🚀

**Status:** DONE
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


---

## [BMAD] Z-Index UI Fix, Table Filter and Auto-Occupied Workflow

**Status:** DONE
**Completed:** 2026-07-09

Files: AddWalkInModal.jsx/css, ReservationManagement.jsx, staffReservationController.js, staff.js routes

Key fixes:
- Walk-in modal z-index: moved outside stacking context (z-index 1200 now effective)
- Area filter pills with all table statuses shown (only Available selectable)
- Removed ALL Assign Table buttons (row + drawer)
- Check-in now opens table-select modal first
- Fixed RESERVATION_STATUS.SEATED (undefined) to DINING (3 locations)
- Added UPDLOCK guard to staffCheckIn
- Swapped POST+PATCH /check-in routes to staffCheckIn

---

## [BMAD] Operational Edge Cases: Ghost Tables, Auto-QR and Race UI

**Status:** DONE
**Completed:** 2026-07-09

Directive A (Ghost Table): Removed AND table_status = Reserved condition in staffCheckIn old-table release. Old tables are now unconditionally freed to N'Available' when replaced by a new table assignment.

Directive B (Auto-QR): Walk-in QR session now always created. Stale active sessions on the table are expired first. Token uses epoch-ms + 6-char hex random suffix (e.g. qr-walkin-t01-1720484000000-a3f2c1) guaranteeing uniqueness. transaction.commit() restored after QR INSERT block.

Directive C (Race UI): handleCheckInWithTable in ReservationManagement.jsx now catches err.status === 409 specifically. Shows "This table was just taken by another staff member" toast. Auto-refreshes the table grid from server so staff sees current floor plan without closing modal.

---

## [BMAD] KDS Device Auth + Employee Registry + Kitchen Ticket FSM

**Status:** IN PROGRESS (Phases 2-4 complete, pending DB re-init)
**Started:** 2026-07-11

### TEAMMATES - ACTION REQUIRED
Schema has changed significantly. You MUST drop and re-run the database:
1. Drop your local [System_Restaurant] database
2. Re-run `database/System_Restaurant.sql` from top to bottom
3. No other migration files needed - System_Restaurant.sql is the single source of truth

### Key Schema Changes
- KitchenDevices table (PIN-based auth, station routing, brute-force lockout)
- KitchenTickets: added device_id FK, updated_at (CAS), CHECK now includes Sent To Kitchen + Served
- StaffProfiles: user_id nullable, has_system_account, salary, department, job_title_id
- JobTitles lookup table + seed
- PerformanceReviews table
- UserAccounts: force_password_reset BIT column
- role_id=3 kept in Roles for history but never assigned

### Backend Changes
- kitchenController.js: Full FSM with role-gating, overdue detection, Manager-override cancel, AuditLogs
- socket.js: Removed role_id=3 dead code
- manager.routes.js: GET /api/manager/kitchen/metrics
- employeeController.js: grantSystemAccess re-grant bug fixed

### Frontend Changes
- StaffSection.jsx: Full rewrite to Employee Registry
- KdsDeviceManager.jsx: New Admin component
- Accounts.jsx: KDS Devices tab added
- managerApi.js: +14 new API functions
