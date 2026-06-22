# 🚨 SYSTEM AUDIT REPORT 🚨

**Date:** 2026-06-20
**Role:** Lead System Auditor & Principal Backend Architect

## 1. Executive Summary
The Phūrai project is currently in a precarious state due to critical backend transaction handling flaws and a stalled architectural migration. While the frontend presents a clean UI, the Node.js/Express backend suffers from intermittent "Loops of Death" caused by SQL Server trigger conflicts and connection pool exhaustion. Immediate intervention is required to stabilize the data layer before any further UI or feature development continues.

## 2. The "Loops of Death" (Critical Backend Failures)
These are the top bugs that have caused infinite fix loops and system crashes:

*   **The `OUTPUT INSERTED.*` Trigger Conflict:**
    *   **The Issue:** Several controllers (e.g., `staffReservationController.js`, `orderService.js`, `auth.js`) use the `OUTPUT INSERTED.*` clause in SQL `UPDATE` and `INSERT` statements to return newly created IDs or timestamps.
    *   **Why it fails:** In SQL Server, you *cannot* use the `OUTPUT` clause without an `INTO` clause if the target table has enabled triggers. If a trigger is added to track audit logs or timestamps, these queries instantly crash with a fatal SQL error.
    *   **The Inconsistency:** We fixed this in `managerReservationController.js` (explicitly stating `NO OUTPUT INSERTED.*`), but the fix was never propagated to the Staff or Order controllers, causing them to fail repeatedly.
*   **Connection Pool Hanging (The Silent Killer):**
    *   **The Issue:** When the `OUTPUT INSERTED.*` error (or any other SQL error) occurs during an active `sql.Transaction`, the error is caught, but the `rollback()` often fails or the `connection.release()` is skipped.
    *   **Why it fails:** The MSSQL pool gets exhausted by "hanging" uncommitted transactions. After 10 failed requests, the server stops responding entirely, requiring a hard PM2 restart.
*   **Idempotency & Double-Sending Cooking Queues:**
    *   **The Issue:** In `staffReservationController.js` (`sendCookingQueue`), there are attempts to prevent double-sending to the kitchen, relying on application-level checks and DB constraints (`UQ_KitchenTickets_order_item`). When the constraint fails, the transaction aborts abruptly, exacerbating the pool hanging issue.

## 3. Database vs. Backend Discrepancies
There are severe mismatches between the Express controllers and `System_Restaurant.sql`:
*   **Reservation Status Constraints:** The `managerReservationController.js` has a state machine (`RESERVATION_STATUS` dictionary). However, some edge-case statuses like `"Check-in Rejected"` or `"Complete Paid"` are being forced into the DB. If these do not strictly match the `CK_Reservations_status` CHECK constraint in SQL, the transaction aborts.
*   **`PreorderItems` Schema Drift:** The backend still refers to legacy concepts of "cooking status" on `PreorderItems` which have been reverted in the canonical `System_Restaurant.sql`.

## 4. Architectural Violations (Frontend)
The frontend migration (Strangler Fig) is severely fragmented:
*   **The `StaffDashboard.jsx` Monolith:** This file is a massive "God Component" (300+ lines). It owns business logic, data fetching, routing, and layout switching. It violates the "Avoid Boolean Props" rule and desperately needs to be refactored into **Compound Components**.
*   **Stalled Strangler Fig Migration:** The target architecture dictates moving from a monolithic `src/` to a domain-driven `src/features/`. Currently, only `manager-dashboard` has been partially migrated (Wave 1). `staff-dashboard`, `auth`, and `reservations` are stuck in the legacy folder structure, causing massive import coupling and prop drilling.
*   **Prop Drilling vs. Context:** Several nested Staff components are passing `reservation_id` and callbacks down 4-5 layers instead of utilizing a localized feature Context.

## 5. Technical Debt & Zombie Code
*   **Incomplete Refactors:** Files like `staffReservationController.js` still use `pool.getConnection()` and manual transaction management mixed with `sql.Transaction(rawPool)`. This dual-paradigm creates unpredictable connection leaks.
*   **Orphaned Pages:** Duplicate Auth pages exist in `pages/auth/*` which are unused by the main router, creating confusion during development.

## 6. The "Master Fix" Plan (Strict Execution Priority)

**Phase 1: Database Stability (Immediate Action Required)**
1.  **Purge `OUTPUT INSERTED.*`:** Do a global search and replace across all `server/controllers/` and `server/services/`. Replace `OUTPUT INSERTED.[column]` with an `OUTPUT INSERTED.[column] INTO @TempTable` pattern, OR separate the `INSERT`/`UPDATE` from the `SELECT` query.
2.  **Bulletproof Transactions:** Refactor all database queries to use a strict `try { ... } catch { await transaction.rollback() } finally { connection.release() }` structure.
3.  **Sync Constraints:** Audit the `RESERVATION_STATUS` dictionary in the Node backend against the `CK_Reservations_status` constraint in `System_Restaurant.sql` to prevent silent rejections.

**Phase 2: Architectural Migration**
1.  **Refactor `StaffDashboard.jsx`:** Break down the staff dashboard using Compound Components (`<StaffDashboard.Header>`, `<StaffDashboard.Sidebar>`, `<StaffDashboard.Content>`).
2.  **Resume Strangler Fig:** Execute Wave 8 (`staff-dashboard` migration) and Wave 2 (`auth` migration) as defined in `ARCHITECTURE.md`.

*End of Report.*
