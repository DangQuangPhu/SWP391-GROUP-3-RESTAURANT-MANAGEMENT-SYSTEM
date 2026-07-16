# CAPSTONE PROJECT REPORT

# Report 3 - Software Requirement Specification

Phurai Restaurant Management System

Da Nang, July 2026

## Record of Changes

| Date | Type | In charge | Change Description |
| --- | --- | --- | --- |
| 19/05/2025 | A | Project Team | Add initial version |
| 20/05/2025 | M | Project Team | Create base document |
| 01/06/2025 | M | Project Team | Update mentor comments |
| 16/07/2026 | M | Project Team | Rewrite SRS scope for Restaurant Management System |

## 1. Product Overview

Phurai Restaurant Management System is a web-based platform designed to support restaurant operations from customer ordering to back-office administration. The system connects guests, registered customers, restaurant staff, kitchen staff, managers, and administrators in one centralized application.

Customers can browse the restaurant menu, search dishes, place online or table-based orders, reserve tables, make reservation deposits or order payments, view personal order and reservation history, receive notifications, and submit reviews. The system also supports table QR sessions so dine-in customers can order from their own device.

Restaurant staff can manage walk-in orders, table sessions, reservations, check-in workflows, table movement, table merging, order status updates, and customer service requests. Kitchen staff can use the Kitchen Display System to view, accept, prepare, complete, and track kitchen tickets in real time.

Managers can manage menu items, categories, promotions, vouchers, reservations, table/floor operations, staff information, kitchen performance, customer feedback, and operational reports. Administrators manage accounts, roles, permissions, restaurant settings, KDS devices, audit logs, and system-wide configuration.

The system is intended to improve service efficiency, reduce manual errors, support better management decisions, and provide customers with a more convenient dining experience.

### 1.1 Context Diagram

Figure 1: Context Diagram for Phurai Restaurant Management System

External actors include Guest, Customer, Staff, Kitchen Staff, Manager, Admin, Payment Gateway, Email Service, OAuth Provider, and Notification/WebSocket Service.

### 1.2 Main Workflows

#### 1.2.1 Make an Online Reservation

Customer selects reservation date, time, party size, contact information, and optional preorder items. The system checks table availability, calculates reservation deposit where applicable, creates the reservation, sends confirmation, and updates reservation status in staff and manager dashboards.

Figure 2: Workflow of Making an Online Reservation

#### 1.2.2 Place and Process an Order

Customer or staff creates an order, adds menu items, confirms the order, and sends kitchen-required items to the Kitchen Display System. Kitchen staff prepares items, staff serves the order, and the customer completes payment.

Figure 3: Workflow of Placing and Processing an Order

#### 1.2.3 Dine-in QR Table Session

Staff opens or confirms a table session. Customer scans the table QR code, browses menu items, submits requests/orders, and receives live updates while staff and kitchen dashboards remain synchronized.

Figure 4: Workflow of Dine-in QR Table Session

## 2. User Requirements

### 2.1 Actors

| Actor | Description |
| --- | --- |
| Guest | A non-authenticated visitor who can view public pages, menu information, promotions, restaurant information, and start registration or login. |
| Customer | A registered user who can reserve tables, order food, manage profile information, view order and reservation history, pay online, receive notifications, use loyalty features, and submit reviews. |
| Staff | Restaurant service staff who can manage table sessions, walk-in orders, reservations, customer requests, check-in, table movement, and order serving status. |
| Kitchen Staff | Kitchen users or KDS device users who can view kitchen tickets, accept preparation tasks, update cooking status, and mark items as ready or served. |
| Manager | Restaurant manager who can manage menu, promotions, vouchers, staff, reservations, reports, kitchen operations, floor plan, and customer feedback. |
| Admin | System administrator who manages accounts, roles, permissions, system settings, KDS devices, audit logs, and high-level restaurant configuration. |

### 2.2 Use Cases

| ID | Use Case | Actors | Use Case Description |
| --- | --- | --- | --- |
| UC-01 | Sign Up | Guest | Guest creates a customer account using email/password or supported OAuth. |
| UC-02 | Sign In | Guest, Customer, Staff, Manager, Admin | User logs into the system and receives role-based access. |
| UC-03 | Forgot Password | Guest, Customer, Staff, Manager, Admin | User requests a password reset through registered email. |
| UC-04 | Manage Profile | Customer | Customer views and updates profile, avatar, contact details, and account settings. |
| UC-05 | Browse Menu | Guest, Customer | User views menu categories, dishes, prices, images, and availability. |
| UC-06 | Search and Filter Menu | Guest, Customer | User searches dishes by keyword, category, or preference. |
| UC-07 | Add Items to Cart | Customer | Customer adds dishes to cart for online or table-session order. |
| UC-08 | Place Order | Customer, Staff | Customer or staff submits an order to the system. |
| UC-09 | Pay Order | Customer, Staff | Customer pays for an order using supported payment methods. |
| UC-10 | Make Reservation | Customer | Customer creates a table reservation with date, time, party size, and contact details. |
| UC-11 | Pay Reservation Deposit | Customer | Customer pays required reservation deposit through the payment gateway. |
| UC-12 | View My Reservations | Customer | Customer views reservation list, details, and statuses. |
| UC-13 | Cancel Reservation | Customer, Staff, Manager | Reservation is cancelled based on policy and current status. |
| UC-14 | Check In Reservation | Staff | Staff verifies a reservation and seats the customer at a table. |
| UC-15 | Manage Table Session | Staff | Staff opens, updates, moves, merges, or closes active table sessions. |
| UC-16 | Process Customer Request | Staff | Staff receives and resolves customer service requests from table sessions. |
| UC-17 | Manage Kitchen Tickets | Kitchen Staff | Kitchen staff accepts, prepares, completes, and tracks kitchen tickets. |
| UC-18 | Manage Menu Items | Manager | Manager creates, edits, disables, or deletes dishes and categories. |
| UC-19 | Manage Promotions | Manager | Manager creates, updates, disables, and monitors promotions. |
| UC-20 | Manage Vouchers | Manager | Manager creates and manages voucher codes and usage rules. |
| UC-21 | Manage Reservations | Staff, Manager | Staff or manager views, filters, updates, and handles reservation lifecycle. |
| UC-22 | Manage Staff | Manager, Admin | Manager or admin manages staff profiles, roles, and employment information. |
| UC-23 | View Reports and Analytics | Manager, Admin | Manager or admin reviews operational metrics, revenue, orders, and reservations. |
| UC-24 | Manage Accounts and Roles | Admin | Admin manages system users, role assignments, and account status. |
| UC-25 | Manage System Settings | Admin | Admin updates restaurant configuration and access-related settings. |
| UC-26 | Manage KDS Devices | Admin, Manager | Admin or manager registers and controls kitchen display devices. |
| UC-27 | Send and Receive Notifications | Customer, Staff, Manager, Admin | System sends real-time and email notifications for important actions. |
| UC-28 | Submit Review | Customer | Customer reviews restaurant service or menu items after using the service. |
| UC-29 | Moderate Reviews | Manager, Admin | Manager or admin views and handles inappropriate reviews. |
| UC-30 | View Audit Logs | Admin | Admin monitors important system activities and security events. |
| UC-31 | Apply Voucher to Order | Customer, Staff | Customer or staff applies a valid voucher code to an order before checkout. |
| UC-32 | View Payment History | Customer, Manager, Admin | User views completed, pending, failed, or refunded payment records according to role permissions. |
| UC-33 | Manage Loyalty Points | Customer, Manager | Customer views earned points and rewards while manager reviews loyalty activity and rules. |
| UC-34 | Purchase Gift Card | Customer | Customer purchases a digital gift card and receives confirmation after payment. |
| UC-35 | Redeem Gift Card | Customer, Staff | Customer or staff redeems a valid gift card during payment. |
| UC-36 | Manage Floor Plan | Manager, Admin | Manager or admin manages restaurant areas, table positions, table capacity, and table availability. |
| UC-37 | Move Table Session | Staff, Manager | Staff or manager moves an active table session from one table to another when operationally required. |
| UC-38 | Merge Tables | Staff, Manager | Staff or manager merges tables or sessions for larger parties while preserving active order data. |
| UC-39 | Handle No-show Reservation | Staff, Manager | Staff or manager marks overdue reservations as no-show according to restaurant policy. |
| UC-40 | Manage Restaurant Information | Admin, Manager | Admin or manager updates public restaurant information such as address, contact details, opening hours, and branding. |

## 3. Functional Requirements

### 3.1 System Functional Overview

#### 3.1.1 Screen Flow

Figure 5: Screen Flow for Customer

Customer flow includes Landing Page, Menu, Cart/Checkout, Reservation, My Reservations, Profile, Loyalty, Gift Cards, Reviews, and Notifications.

Figure 6: Screen Flow for Staff

Staff flow includes Staff Dashboard, Reservations, Table/Floor View, Orders, Table Sessions, Customer Requests, and Service Status Updates.

Figure 7: Screen Flow for Kitchen Staff

Kitchen flow includes KDS Login/PIN, Kitchen Ticket Board, Ticket Detail, Preparation Status, Ready/Served Update, and Overdue Monitoring.

Figure 8: Screen Flow for Manager and Admin

Manager/Admin flow includes Dashboard, Menu Management, Reservation Management, Staff Management, Kitchen Metrics, Promotions, Vouchers, Reports, Accounts, Roles, Settings, KDS Devices, and Audit Logs.

#### 3.1.2 Screen Descriptions

| Screen | Description |
| --- | --- |
| Landing Page | Public entry screen showing restaurant brand, highlights, navigation, and reservation call-to-action. |
| Menu Page | Displays menu categories, dish cards, dish details, prices, availability, and search/filter controls. |
| Reservation Page | Allows customers to create reservations and review reservation summary before confirmation. |
| My Reservations | Shows customer reservation history, status, payment state, and detail actions. |
| Checkout Page | Supports order or reservation payment confirmation and payment result display. |
| Profile and Settings | Allows customer to update account, phone, avatar, password, and preferences. |
| Staff Dashboard | Provides reservation queue, floor/table state, walk-in actions, order actions, and customer requests. |
| Kitchen Display | Shows kitchen tickets and item preparation statuses for kitchen staff. |
| Manager Dashboard | Shows operational KPIs, reservations, orders, staff, kitchen metrics, menu, promotions, and reports. |
| Admin Dashboard | Provides account, role, system setting, audit log, restaurant information, and KDS device management. |

#### 3.1.3 Screen Authorization

| Screen/Function | Guest | Customer | Staff | Kitchen Staff | Manager | Admin |
| --- | --- | --- | --- | --- | --- | --- |
| Landing Page | X | X | X | X | X | X |
| Menu View | X | X | X | X | X | X |
| Register/Login/Forgot Password | X | X | X | X | X | X |
| Cart and Customer Checkout |  | X |  |  |  |  |
| Reservation Creation |  | X |  |  |  |  |
| My Reservations |  | X |  |  |  |  |
| Profile and Loyalty |  | X |  |  |  |  |
| Staff Dashboard |  |  | X |  | X | X |
| Kitchen Display System |  |  |  | X | X | X |
| Menu Management |  |  |  |  | X | X |
| Promotion and Voucher Management |  |  |  |  | X | X |
| Staff Management |  |  |  |  | X | X |
| Account and Role Management |  |  |  |  |  | X |
| System Settings and Audit Logs |  |  |  |  |  | X |

#### 3.1.4 Non-Screen Functions

| Feature | System Function | Description |
| --- | --- | --- |
| Authorization | Role-based access control | All protected requests are checked through authentication and role authorization middleware. |
| WebSocket Connection | Real-time updates | Sends live order, reservation, table, kitchen ticket, and notification updates. |
| Email Service | Transactional email | Sends OTP, password reset, reservation confirmation, and account-related emails. |
| Payment Integration | Online payment processing | Handles reservation deposits, order payments, payment callbacks, and payment history. |
| Audit Logging | System activity tracking | Records important actions for security, accountability, and troubleshooting. |
| Auto Scheduling | Background jobs | Runs reminders, no-show checks, OTP cleanup, and operational cron jobs. |

#### 3.1.5 Entity Relationship Overview

| Entity | Description |
| --- | --- |
| UserAccount | Stores login credentials, role, account status, verification status, and security data. |
| CustomerProfile | Stores customer personal information, phone, avatar, preferences, and loyalty data. |
| StaffProfile | Stores staff employment information, job title, department, shift, and system access state. |
| Role | Defines access level such as Customer, Staff, Manager, Kitchen Staff, or Admin. |
| MenuCategory | Groups dishes into logical restaurant categories. |
| Dish/MenuItem | Stores dish name, price, description, image, availability, and kitchen routing information. |
| Table/FloorArea | Represents restaurant floor plan, area, table capacity, and table status. |
| Reservation | Stores reservation date, time, party size, customer contact, status, assigned table, and deposit. |
| Order | Stores dine-in or online order header, customer/table/session, total amount, and order status. |
| OrderItem | Stores ordered dishes, quantity, notes, price, and preparation state. |
| KitchenTicket | Tracks kitchen preparation workflow for order items. |
| Payment | Stores transaction amount, method, status, reference, and related order/reservation. |
| Promotion/Voucher | Stores discount campaign rules, validity, usage limits, and eligibility. |
| Review | Stores customer feedback, rating, content, visibility, and moderation status. |
| Notification | Stores user notifications and delivery/read state. |
| AuditLog | Stores important system actions and actor information. |

### 3.2 Register

Function Description: Allows guests to create customer accounts using email/password or supported OAuth. The system validates input, prevents duplicate accounts, creates the user profile, and returns authentication data.

Actors: Guest

Inputs: Full name, email, phone, password, OAuth credential where applicable.

Processing: Validate required fields, verify email format, check duplicate email/phone, hash password, create account, assign Customer role, send verification or welcome notification.

Outputs: Created account, success message, authentication token or redirect to login.

Business Rules: Email must be unique. Password must follow the configured security policy. Users must accept terms and privacy policy before registration.

### 3.3 Login

Function Description: Allows users to log in and access role-based screens.

Actors: Customer, Staff, Kitchen Staff, Manager, Admin

Inputs: Email/username and password or OAuth credential.

Processing: Validate credentials, check account status, generate JWT/session data, load role and permissions, redirect to the correct dashboard.

Outputs: Login success message, token/session, role-based navigation.

Business Rules: Disabled or locked accounts cannot log in. Protected APIs require valid tokens.

### 3.4 Forgot Password

Function Description: Allows users to securely reset forgotten passwords by email verification.

Actors: Customer, Staff, Manager, Admin

Inputs: Registered email, reset token/OTP, new password and confirmation.

Processing: Validate email, generate time-limited reset token or OTP, send reset email, verify token, validate new password, update hashed password.

Outputs: Reset email, success/failure message, optional redirect to login.

Business Rules: Reset tokens are time-limited and one-time use. New password must meet policy and match confirmation.

### 3.5 Menu Browsing and Search

Function Description: Allows guests and customers to browse available menu categories and dishes.

Actors: Guest, Customer

Inputs: Search keyword, category, availability filter, dish selection.

Processing: Fetch active menu categories and dishes, apply search/filter criteria, display dish details, prices, images, and availability.

Outputs: Filtered menu list, dish detail information.

Business Rules: Disabled or unavailable dishes must not be orderable. Prices must be displayed consistently in VND.

### 3.6 Cart and Order Placement

Function Description: Allows customers or staff to create an order by selecting menu items and confirming quantities, notes, table/session, and service type.

Actors: Customer, Staff

Inputs: Menu item IDs, quantities, notes, table/session ID, customer information, voucher where applicable.

Processing: Validate menu availability, calculate subtotal/discount/final total, create order and order items, send kitchen-required items to KDS, notify staff/kitchen.

Outputs: Order confirmation, order ID, updated kitchen tickets, payment requirement where applicable.

Business Rules: Quantity must be greater than zero. Unavailable items cannot be ordered. A dine-in table session must be active for table-based ordering.

### 3.7 Payment Processing

Function Description: Allows customers to pay order totals or reservation deposits through supported payment methods.

Actors: Customer, Staff

Inputs: Payment target, amount, method, transaction reference, gateway callback data.

Processing: Create payment record, generate payment information/QR where applicable, verify callback or mock success in local testing, update payment status, update order/reservation state.

Outputs: Payment pending/success/failure status, receipt/invoice data, notifications.

Business Rules: Payment amount must match the required payable amount. Completed payments cannot be duplicated. Failed or expired payments must keep the order/reservation in a valid state.

### 3.8 Reservation Management

Function Description: Allows customers to reserve tables and staff/managers to process reservation lifecycle.

Actors: Customer, Staff, Manager

Inputs: Date, time, party size, contact name, phone, note, optional preorder, payment/deposit data.

Processing: Validate future reservation time, check table capacity and availability, calculate expected dining window, create reservation, collect deposit if required, update status through pending, confirmed, checked-in/dining, completed, cancelled, or no-show.

Outputs: Reservation record, status updates, confirmation notification, staff dashboard entry.

Business Rules: Reservations must not overlap table availability rules. Cancellation and no-show behavior must follow restaurant policy. Staff must verify customer details before check-in.

### 3.9 Staff Table and Floor Operations

Function Description: Allows staff to manage table states and dine-in service flow.

Actors: Staff, Manager

Inputs: Table ID, reservation ID, session ID, check-in action, move/merge action, request status.

Processing: Load current floor plan, validate table status, open or update table sessions, move/merge tables when allowed, update table status, log action, notify related screens.

Outputs: Updated table state, updated reservation/order/session state, notification to staff and kitchen when needed.

Business Rules: Occupied tables cannot be assigned to another active party without a valid move/merge operation. Conflicting table updates must be rejected.

### 3.10 Kitchen Display System

Function Description: Allows kitchen staff to manage preparation workflow for kitchen tickets.

Actors: Kitchen Staff, Manager, Admin

Inputs: Device/PIN login, ticket selection, accept/start/ready/served/cancel action.

Processing: Authenticate KDS device or kitchen user, load pending tickets, update preparation status, detect overdue tickets, emit socket updates to staff and manager dashboards.

Outputs: Updated ticket board, preparation status, audit log, notifications.

Business Rules: Only authorized kitchen devices/users can update kitchen ticket status. Ticket status transitions must follow the configured kitchen workflow.

### 3.11 Manager Operations

Function Description: Allows managers to control restaurant operations and business data.

Actors: Manager

Inputs: Menu item data, promotion rules, voucher data, staff details, reservation updates, report filters.

Processing: Validate manager permissions, update menu/promotions/vouchers/staff/reservations, aggregate reports, export operational data where supported.

Outputs: Updated business data, dashboard KPIs, reports, notifications.

Business Rules: Manager changes must be auditable. Menu and promotion changes must not break active orders.

### 3.12 Admin Operations

Function Description: Allows administrators to manage system governance, access, and configuration.

Actors: Admin

Inputs: Account data, role data, system settings, KDS device data, audit log filters.

Processing: Validate admin permission, create/update/disable accounts, assign roles, update settings, manage KDS devices, inspect audit logs.

Outputs: Updated system configuration, role/account state, audit records.

Business Rules: Admin-only actions cannot be performed by lower roles. Critical changes must be logged.

### 3.13 Reviews and Feedback

Function Description: Allows customers to submit feedback and managers/admins to moderate reviews.

Actors: Customer, Manager, Admin

Inputs: Rating, comment, related order/reservation where applicable, moderation action.

Processing: Validate review eligibility, store review, display approved reviews, allow manager/admin moderation.

Outputs: Review record, public/private visibility state, moderation result.

Business Rules: Customers should only review completed services where possible. Offensive or fraudulent reviews may be hidden or removed.

### 3.14 Notifications

Function Description: Sends real-time and email notifications for operational events.

Actors: Customer, Staff, Kitchen Staff, Manager, Admin

Inputs: Trigger event, target user/role, message content.

Processing: Create notification record, emit WebSocket event, send email for configured events, update read status when viewed.

Outputs: Notification list, toast/message, optional email.

Business Rules: Users only receive notifications relevant to their role or owned data.

## 4. Non-Functional Requirements

### 4.1 External Interfaces

#### 4.1.1 User Interfaces

UI-01: The system must display success and error messages after user actions.

UI-02: Destructive actions such as cancel, delete, close session, or refund must show confirmation before execution.

UI-03: Input fields must provide validation messages for invalid or missing data.

UI-04: Main pages must provide consistent navigation according to the user's role.

UI-05: Customer-facing pages must be responsive on desktop and mobile devices.

UI-06: Staff, kitchen, manager, and admin dashboards must prioritize clear status visibility and fast operations.

#### 4.1.2 Software Interfaces

SI-01: The system uses JWT-based authentication for protected API calls.

SI-02: The system integrates with email/SMTP services for OTP, reset password, and operational emails.

SI-03: The system integrates with payment gateway or QR payment services for reservation deposits and order payments.

SI-04: The system uses WebSocket/Socket.IO for real-time notifications and dashboard synchronization.

SI-05: The system stores data in SQL Server and must maintain relational integrity.

SI-06: The system supports image upload for avatars and menu item images using the configured upload service.

### 4.2 Quality Attributes

#### 4.2.1 Usability

The customer interface must be easy to navigate for menu browsing, reservation, ordering, checkout, and profile management. Staff and kitchen workflows must minimize clicks during busy restaurant operations. Manager and admin dashboards must present operational data in a scannable and role-appropriate manner.

#### 4.2.2 Security

The system shall require authentication for protected functions. Passwords must be hashed. Role-based authorization must prevent unauthorized access. Inputs must be validated to reduce injection and invalid-state risks. Sensitive payment and account actions must be logged.

#### 4.2.3 Performance

Common customer actions such as menu loading, reservation creation, and checkout status checks should respond within acceptable web application timing under normal load. Real-time staff and kitchen updates should be delivered promptly so operational dashboards remain synchronized.

#### 4.2.4 Reliability

The system must handle network errors, payment callback delays, duplicate submissions, table conflicts, and unavailable menu items gracefully. Data updates for orders, reservations, and payments must preserve consistent state.

#### 4.2.5 Maintainability

The system should be organized by feature modules and shared services. Backend routes, controllers, services, and repositories should keep responsibilities clear. Configuration should be environment-based.

## 5. Requirement Appendix

### 5.1 Business Rules

| ID | Rule Definition |
| --- | --- |
| BR-01 | The system has main roles: Guest, Customer, Staff, Kitchen Staff, Manager, and Admin. |
| BR-02 | Customers must be authenticated before placing orders, making reservations, paying, or viewing personal history. |
| BR-03 | Staff can manage table/session/reservation operations but cannot perform admin-only account or system setting actions. |
| BR-04 | Kitchen staff can update kitchen ticket status but cannot change payment, account, or admin settings. |
| BR-05 | Managers can manage restaurant operations such as menu, promotions, reservations, staff, and reports. |
| BR-06 | Admins can manage roles, accounts, KDS devices, system settings, and audit logs. |
| BR-07 | Menu items marked unavailable or inactive cannot be ordered. |
| BR-08 | A reservation must contain valid customer contact, date, time, and party size. |
| BR-09 | Reservation check-in must verify customer information and table availability. |
| BR-10 | Orders linked to a table must belong to an active table session. |
| BR-11 | Payment records must match the order or reservation amount before marking success. |
| BR-12 | Duplicate payments or duplicate order submissions must be prevented where possible. |
| BR-13 | Table movement and merging must not create conflicting occupied states. |
| BR-14 | Important actions such as account changes, payment updates, reservation transitions, and kitchen overrides must be logged. |
| BR-15 | Notifications must be sent for key events such as reservation confirmation, payment success, order status update, and kitchen readiness. |

### 5.2 Application Messages List

| # | Message Code | Message Type | Content |
| --- | --- | --- | --- |
| 1 | MSG_01 | Validation | Username is required. |
| 2 | MSG_02 | Validation | Password is required. |
| 3 | MSG_03 | Validation | Email format is invalid. |
| 4 | MSG_04 | Validation | Phone number is not valid. |
| 5 | MSG_05 | Validation | Value cannot be empty. |
| 6 | MSG_06 | Validation | Please accept the terms before continuing. |
| 7 | MSG_07 | Authentication | Session expired. Please log in again. |
| 8 | MSG_08 | Success | Action completed successfully. |
| 9 | MSG_09 | Authorization | You are not authorized to perform this action. |
| 10 | MSG_10 | Success | Data saved successfully. |
| 11 | MSG_11 | Authentication | Invalid login credentials. |
| 12 | MSG_12 | Validation | This field must be unique. |
| 13 | MSG_13 | Authorization | Unauthorized. |
| 14 | MSG_14 | Validation | Password must meet the configured security policy. |
| 15 | MSG_15 | Reservation | Reservation created successfully. |
| 16 | MSG_16 | Reservation | Selected time or table is not available. |
| 17 | MSG_17 | Order | Order submitted successfully. |
| 18 | MSG_18 | Order | One or more selected items are unavailable. |
| 19 | MSG_19 | Payment | Payment completed successfully. |
| 20 | MSG_20 | Payment | Payment failed or expired. |
| 21 | MSG_21 | Kitchen | Kitchen ticket status updated. |
| 22 | MSG_22 | Table | Table is already occupied. |
| 23 | MSG_23 | Notification | New notification received. |
| 24 | MSG_24 | Review | Review submitted successfully. |
