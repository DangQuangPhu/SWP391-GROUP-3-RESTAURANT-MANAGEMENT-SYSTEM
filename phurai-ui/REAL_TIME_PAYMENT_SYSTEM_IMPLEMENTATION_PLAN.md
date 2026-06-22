# Real-Time Payment System Implementation Plan

## Phurai Premium Restaurant Table Ordering System

## 1. System Context and Core Technical Issues Resolved

During previous development sessions, the multi-port application architecture, consisting of the Frontend on port `5173`, the Backend on port `5001`, and Nginx Reverse Proxy on port `8080`, encountered several critical issues related to real-time data flow and payload structure.

The team isolated and resolved the following structural issues:

- **Customer-side wide-area network connection breakage:** Fixed issues in `src/context/SocketContext.jsx` and the ordering interface by adding the required fallback transport configuration: `transports: ['polling', 'websocket']`. This prevents WebSocket connections from closing before being successfully established in customer incognito browsers.

- **400 Bad Request payload error:** Fixed in `src/pages/customer/MenuCartDrawer.jsx`. The system replaced string slugs with the original integer database identifiers, specifically `dish_id`, eliminating invalid dish recognition errors when submitting orders to the backend.

- **401 Unauthorized authentication error:** Updated `src/components/notifications/NotificationBell.jsx` by attaching the required local-development identity headers, allowing approval actions to pass through the Auth Middleware.

- **Kitchen Display queue filter issue:** Updated `src/pages/kitchen/KitchenDisplay.jsx` to remove the old time-based filter that only showed long-wait alerts. The interface was expanded to display the full real kitchen queue as soon as a socket event announces a new order.

## 2. Integrated Sepay Payment Flow

After the customer submits an order to the kitchen, the system moves the ordering session into a payment-pending flow. This business process is split into two independent payment options to optimize both customer experience and restaurant operations.

### Option 1: Request Staff Assistance for Direct Payment

This is the traditional payment method using cash or card payment through a staff-operated POS device.

The technical flow is as follows:

1. The customer clicks **Request Direct Payment** in the application interface.
2. The frontend emits a socket event named `REQUEST_TABLE_PAYMENT`, carrying the table ID and session ID.
3. The backend receives the event and broadcasts it globally to the staff room through the Socket Server.
4. The staff notification interface in `src/components/notifications/NotificationBell.jsx` catches the event and immediately displays a real-time notification card with the table ID and two quick actions: **Confirm Payment Collected** and **Cancel Request**.
5. After the staff member collects payment at the table and clicks **Confirm Payment Collected**, the staff frontend sends a `PATCH` request to the backend API.
6. The backend updates the bill status to successful, releases the table back to the available state, and emits a socket event to end the customer's active session.

### Option 2: Automatic In-App Payment Through Sepay

This is an automated payment method that does not require staff intervention. It uses a dynamic bank transfer QR code through VietQR.

The technical flow is as follows:

1. The customer selects **Pay Through App**.
2. The system calls a backend API to create a unique transaction code in the database.
3. The backend generates a required encoded transfer description using a fixed structure, for example: `PHURAI SH22`. In this example, `PHURAI` identifies the restaurant and `SH22` represents the session ID or order ID.
4. A dynamic QR code containing the exact bill total and transfer description is displayed on the customer's screen.
5. The customer scans the QR code using a banking application and completes the transfer.
6. Sepay detects the balance change in the restaurant's bank account and immediately sends a secure HTTP `POST` webhook to the configured backend endpoint: `/api/payments/sepay-webhook`.
7. The backend payment controller processes the webhook payload by verifying the security signature, parsing the transfer description to extract the session identifier, and matching the transferred amount against the bill total.
8. If the data is valid, the backend updates the order status in the database to `PAID` and broadcasts a global socket event announcing that the session has completed payment.
9. The customer screen automatically transitions to the successful electronic receipt state without requiring a page reload.

## 3. Four-Phase Implementation Plan

To preserve the integrity of the current codebase and avoid data-flow conflicts, the payment feature development process is divided into four clear phases.

| Phase | Main Task | Primary Files Affected | Expected Output |
| --- | --- | --- | --- |
| Phase 1: Stabilization | Standardize and freeze the current ordering and kitchen display flow. Verify numeric dish ID synchronization across all cart-related components. | `src/pages/customer/Menu.jsx`<br>`src/pages/kitchen/KitchenDisplay.jsx` | The ordering flow runs reliably, with no remaining `400` errors or WebSocket connection failures. |
| Phase 2: Backend Structure | Design the payment data table. Build APIs for staff payment requests, VietQR transaction generation, and Sepay webhook handling. | `server/models/Payment.js`<br>`server/routes/paymentRoutes.js`<br>`server/controllers/paymentController.js` | The backend can receive automatic Sepay bank-transfer information and accurately parse the related order data. |
| Phase 3: UI and Socket Integration | Build the customer payment-method selection UI. Update the staff notification bell to handle direct payment calls. Configure socket listeners for session-completion events. | `src/pages/customer/MenuCartDrawer.jsx`<br>`src/components/notifications/NotificationBell.jsx` | The UI displays real-time transfer QR codes or successful staff-call payment notifications. |
| Phase 4: Testing and Packaging | Simulate Sepay webhooks locally to test exception cases, such as incorrect transfer descriptions and incorrect payment amounts. Optimize port coordination through Nginx Reverse Proxy. Release socket memory when sessions end. | Network and local environment middleware<br>Full black-box system testing procedure | The full closed-loop system works smoothly: QR scan, table approval, ordering, kitchen receipt, payment, and table release. |

## Required Development Boundary Rules

Throughout Phase 1 to Phase 4, Codex or AI tooling may only modify explicitly assigned interface files or routers listed in the implementation scope.

The following restrictions must be respected:

- Do not modify the core Socket.io CORS configuration unless there is an approved technical reconciliation record.
- Do not change the current table-storage schema without prior validation.
- Do not edit unrelated backend logic while implementing payment-specific tasks.
- Keep each implementation phase isolated and verifiable before moving to the next phase.

## Final Target Flow

The final system must support a complete real-time restaurant workflow:

1. Customer scans the QR code.
2. Staff approves table access.
3. Customer places an order.
4. Kitchen receives the order instantly.
5. Customer completes payment through direct staff payment or Sepay.
6. Backend confirms payment.
7. Customer session ends.
8. Table is released for the next guest.
