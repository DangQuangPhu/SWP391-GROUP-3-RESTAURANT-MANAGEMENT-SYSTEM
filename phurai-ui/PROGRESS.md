# BMAD Progress Log

## In Progress
- **Feature 1: Pre-order to KDS Integration** (Security Audited)
- **Feature 2: Real-time Dashboard Sync (Socket.IO Broadcast)** (Security Audited)

## Completed
- **[DONE] Feature 3: Live API Sync, Role-Based FSM Tabs & AuditLog Timeline** (Security Audited)
  - UI is now fully decoupled from static mock data.
  - Strictly uses the `@/` path alias globally (resolved 38-file relative import bugs).
  - Deeply integrated with live `dbo.Reservations` and `dbo.AuditLogs` for full FSM state tracking.
  - Implemented 5 unified English tabs (Pending, Upcoming, In Progress, Completed, Cancelled/Rejected) in Staff and Manager dashboards.
  - Disabled Cancel/Reject for Staff roles (only No Show or Reject Check-in is available when checking in).
  - Implemented AuditLogs timeline with proper role coalescing and JSON parsing for both manager and staff views.
  - **[Security Audit Passed]** Fixed SQL Injection in cancel reasons, restricted staff routes from Reject/Cancel actions, prevented PII leaks on Timeline.
- **[COMPLETED & DEPLOYED] Epic: Smart Checkout Engine (SePay Webhook & FSM)**
  - Fully decoupled Promotion API from Reservation components.
  - Implemented Apple Wallet styled UI for Receipts.
- **[COMPLETED & DEPLOYED] Epic: Dine-in QR (Table QR Code Generation & Validation)**
  - UUID generation using `crypto.randomUUID()` for `static_qr_code` with collision retry loops.
  - Integrated `qrcode.react` into Manager Table UI for QR code rendering and downloading.
  - Exposed `GET /api/customer/qr-sessions/scan/:qr_code` public scan endpoint with ghost-order prevention guardrails (ensures table is Occupied and resolves merged tables dynamically).
- **[COMPLETED & DEPLOYED] Epic: Dine-in QR (Option 2: Pending Approval Flow)**
  - Updated `System_Restaurant.sql` `QROrderSessions` CHECK constraint to allow `N'Pending'`.
  - Updated Scan API to insert `Pending` session if table is `Available`, and emit `NEW_QR_REQUEST` Socket.IO event.
  - Added Staff UI `StaffNotificationListener` globally rendering pending requests as toast-like modals with `Approve` button.
  - Created `PATCH /api/staff/qr-sessions/:id/approve` (shared for manager/staff) to update session to `Active`, Table to `Occupied`, and broadcast `SESSION_APPROVED`.
  - Added Customer UI `QrScanPage` with waiting screen tracking `Pending` status and `SESSION_APPROVED` socket hook to redirect to `/menus`.
  - **Milestone Log:** Global Socket.IO Approval Shell & Customer Waiting Screen synchronized perfectly.
- **[COMPLETED & DEPLOYED] Epic: Dine-in QR (Bypass Auth for Active QR Guests & Real-time Order Appending)**
  - Created dedicated `POST /api/public/qr-order/submit` public endpoint for QR Guest Accounts.
  - Implemented secure Tab Appending SQL Transaction tracking `dbo.Orders` vs `dbo.OrderItems` dynamically natively tracking first round vs subsequent rounds.
  - Hooked `NEW_DINEIN_ORDER` into `StaffNotificationListener.jsx` to broadcast real-time dish requests directly to the floor staff.
  - Updated `MenuCartDrawer.jsx` to dynamically switch between Takeout Checkout and Dine-in "Send Order to Kitchen".
