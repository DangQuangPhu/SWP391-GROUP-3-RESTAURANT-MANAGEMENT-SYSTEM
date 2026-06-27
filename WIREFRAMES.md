# PCK-SCP: Lo-Fi Wireframe Layout Specifications

This document contains text-based, low-fidelity wireframe layouts for **10 essential screens** of the **Phūrai Collaborative Kitchen & Service Coordination Portal (PCK-SCP)**. These layouts focus strictly on layout hierarchy, content structure, and collaborative interface elements, adhering to lo-fi design principles.

---

## Screen 1: Staff Authentication & Clock-In Console
**Purpose:** Authenticate FOH/BOH staff and verify their location before granting access.

```text
+-------------------------------------------------------------+
|  [PHŪRAI LOGO]          PCK-SCP Operations Portal   10:00 AM|
+-------------------------------------------------------------+
|                                                             |
|                    +------------------+                     |
|                    |  STAFF LOGIN     |                     |
|                    +------------------+                     |
|                                                             |
|                    Enter PIN: [ * * * * ]                   |
|                                                             |
|                    [ 1 ]  [ 2 ]  [ 3 ]                      |
|                    [ 4 ]  [ 5 ]  [ 6 ]                      |
|                    [ 7 ]  [ 8 ]  [ 9 ]                      |
|                    [Clear] [ 0 ] [Back]                     |
|                                                             |
|             Location Status: [X] Verified (GPS Match)       |
|                                                             |
|                   +--------------------+                    |
|                   |    CLOCK IN NOW    |                    |
|                   +--------------------+                    |
|                                                             |
+-------------------------------------------------------------+
```
### Layout Breakdown:
* **Header:** Logo, app name, and current time.
* **PIN Input Field:** Large central text field with numerical keyboard underneath.
* **GPS Status Panel:** Shows a green status checkbox checking location verification.
* **Primary Action:** Large "Clock In Now" button to register the start of a shift.

---

## Screen 2: FOH Hostess Seating & Floor-Plan Map
**Purpose:** Manage seating allocations, check table statuses, and seat incoming parties.

```text
+-------------------------------------------------------------+
| [Menu] [Floor Plan Map]       [Waitlist: 4 Parties] 10:15 AM|
+-------------------------------------------------------------+
|  +--------------------+   +------------------------------+  |
|  | FILTER:            |   |           MAP VIEW           |  |
|  | ( ) All   ( ) Free |   |                              |  |
|  | ( ) Occupied       |   |   +--------+    +--------+   |  |
|  +--------------------+   |   |T1 (4p) |    |T2 (2p) |   |  |
|                           |   |Occupied|    |Available|  |
|  +--------------------+   |   +--------+    +--------+   |  |
|  | SELECTED TABLE: T3 |   |                              |  |
|  | Size: 4-seater     |   |   +--------+    +--------+   |  |
|  | Status: Cleaning   |   |   |T3 (4p) |    |T4 (6p) |   |  |
|  | Temp: 23°C         |   |   |Cleaning|    |Reserved|   |  |
|  |                    |   |   +--------+    +--------+   |  |
|  | [ Mark Available ] |   |                              |  |
|  | [ Assign Walk-in ] |   +------------------------------+  |
|  +--------------------+                                     |
+-------------------------------------------------------------+
```
### Layout Breakdown:
* **Sidebar Filters:** Radio buttons to filter tables by status, alongside detail box for the selected table.
* **Map Canvas:** Grid layout of tables represented as boxes with indicators: Table Number, Seating Capacity, and State.
* **Secondary Actions:** "Mark Available" and "Assign Walk-in" buttons in the sidebar.

---

## Screen 3: Waiter Order Placement & Customization
**Purpose:** Waiters select items and add prep instructions at the customer's table.

```text
+-------------------------------------------------------------+
| [Back] Table: T1 (Dine-in)                      Subtotal:0k |
+-------------------------------------------------------------+
| CATEGORIES: [Appetizers] [Mains] [Desserts] [Beverages]     |
| +---------------------------------------------------------+ |
| | [Dish Card: Wagyu Beef Burger]                          | |
| | Price: 280k VND   Qty: [-] [ 1 ] [+]                    | |
| | Prep Note: [ Medium rare, no onions_________________ ] | |
| +---------------------------------------------------------+ |
| | [Dish Card: Caesar Salad]                               | |
| | Price: 120k VND   Qty: [-] [ 2 ] [+]                    | |
| | Prep Note: [ Dressing on the side___________________ ] | |
| +---------------------------------------------------------+ |
|                                                             |
|                    +-------------------+                    |
|                    | SEND TO KITCHEN   |                    |
|                    +-------------------+                    |
+-------------------------------------------------------------+
```
### Layout Breakdown:
* **Cart Status Header:** Displays table number and real-time subtotal.
* **Category Bar:** Horizontal tab selection.
* **Dish List:** Rows featuring item titles, plus/minus quantity adjustments, and a text input box for allergen/prep specifications.
* **Footer Action:** Large "Send to Kitchen" action button.

---

## Screen 4: Waiter Billing & Voucher Checkout
**Purpose:** Process payments at the table, split bills, and apply customer loyalty vouchers.

```text
+-------------------------------------------------------------+
| [Back] Checkout — Table T1                                  |
+-------------------------------------------------------------+
|  Order Subtotal: 620,000 VND                                |
|  Service Charge:  18,000 VND                                |
|                                                             |
|  VOUCHER APPLIED: [ PR-GOLD50K ]  [Remove]                  |
|  Discount Amount: -50,000 VND                               |
|  Final Total:     588,000 VND                               |
|                                                             |
|  Split Method: ( ) Even Split  (X) Item Split               |
|                                                             |
|  +-------------------------------------------------------+  |
|  | Guest 1: 294,000 VND  [ Pay Cash ]  [ Pay QR ]        |  |
|  | Guest 2: 294,000 VND  [ Pay Cash ]  [ Pay QR ]        |  |
|  +-------------------------------------------------------+  |
|                                                             |
+-------------------------------------------------------------+
```
### Layout Breakdown:
* **Bill Breakdown:** Vertical listing of subtotal, service charges, discounts, and final total.
* **Voucher Field:** Input element with state indicators demonstrating discount outcomes.
* **Split Controls:** Segmented radio buttons selecting payment divisions.
* **Sub-Payment Rows:** Lists guest assignments with individual QR/Cash action options.

---

## Screen 5: BOH Kitchen Display System (KDS) Active Queue
**Purpose:** Interactive cook board listing active dish prep priority tickets.

```text
+-------------------------------------------------------------+
| KDS Queue — Active Tickets                        Chef: Son |
+-------------------------------------------------------------+
| +------------------+  +------------------+  +-------------+ |
| | Table: T1   #005 |  | Table: T3   #006 |  | Table: T2   | |
| | Prep: 12m ago    |  | Prep: 8m ago     |  | Prep: 2m ago| |
| |------------------|  |------------------|  |-------------| |
| | 1x Wagyu Burger  |  | 2x Black Cod     |  | 1x Ribeye   | |
| |  - Medium rare   |  | 1x Miso Soup     |  |  - Well done| |
| | 1x Truffle Fries |  |                  |  |             | |
| |------------------|  |------------------|  |-------------| |
| | [START]  [READY] |  | [START]  [READY] |  | [START] [RDY| |
| +------------------+  +------------------+  +-------------+ |
+-------------------------------------------------------------+
```
### Layout Breakdown:
* **chef Badge:** Identifies the logged-in cook station.
* **Grid Columns:** Horizontal card layout, with each card representing a ticket containing: Table ID, time elapsed, dish list with customization notes, and action states ("Start" and "Ready").

---

## Screen 6: FOH Waiter Dish Pickup Notification Panel
**Purpose:** Notifies waiters of prepared dishes and flags temperature alerts.

```text
+-------------------------------------------------------------+
| [Menu] Dish Pickup Alerts (4)                      11:00 AM |
+-------------------------------------------------------------+
|                                                             |
|  +-------------------------------------------------------+  |
|  | [!] DISH COLD DANGER WARNING (Elapsed: 8 mins)        |  |
|  | Table T1: Wagyu Beef Burger is waiting at counter.    |  |
|  | [Swipe to Dismiss]                                    |  |
|  +-------------------------------------------------------+  |
|                                                             |
|  +-------------------------------------------------------+  |
|  | Table T3: 2x Black Cod (Ready now)                    |  |
|  | [Swipe to Dismiss]                                    |  |
|  +-------------------------------------------------------+  |
|                                                             |
|  +-------------------------------------------------------+  |
|  | Table T2: 1x Ribeye Steak (Ready now)                 |  |
|  | [Swipe to Dismiss]                                    |  |
|  +-------------------------------------------------------+  |
|                                                             |
+-------------------------------------------------------------+
```
### Layout Breakdown:
* **Header Alert Count:** Badge showing count of unserved dishes.
* **Alert Stack:** Chronological stack of alerts. Critical alerts (like "Cold Danger") are highlighted at the top with urgent indicators.
* **Interaction:** Swipe actions on mobile screens to dismiss alerts.

---

## Screen 7: Manager Real-Time Inventory Control Panel
**Purpose:** Manage ingredient levels and toggle menu items.

```text
+-------------------------------------------------------------+
| [Menu] Inventory & Menu Sync                       11:15 AM |
+-------------------------------------------------------------+
| Search Ingredient: [ search...___________________________ ] |
|                                                             |
| Ingredient    Stock Level   Alert Threshold   Menu Link     |
| +---------------------------------------------------------+ |
| | Wagyu Beef  [====   ] 15  [ 20 units    ]   [ Active ]  | |
| | Black Cod   [====== ] 22  [ 10 units    ]   [ Active ]  | |
| | Truffle Oil [=      ]  2  [  5 units [!] ]  [Sold Out]  | |
| +---------------------------------------------------------+ |
|                                                             |
|  [!] Low-stock items detected. Menu listings updated.       |
|                                                             |
+-------------------------------------------------------------+
```
### Layout Breakdown:
* **Search Bar:** Simple text input element.
* **Stock Table:** Structured rows listing ingredient name, horizontal visual progress bars of stock levels, threshold setting inputs, and current menu availability state.

---

## Screen 8: Manager Performance Reporting Dashboard
**Purpose:** Track operational speeds, turnover rates, and revenue.

```text
+-------------------------------------------------------------+
| [Menu] Manager Reports                             11:30 AM |
+-------------------------------------------------------------+
| Filter: [ Last 30 Days |v]        Export: [ CSV ]  [ PDF ]  |
|                                                             |
|  +------------------+  +------------------+  +------------+ |
|  | Avg Prep Time    |  | Table Turn Rate  |  | Revenue    | |
|  | 14.2 minutes     |  | 1.8 turns/shift  |  | 185M VND   | |
|  +------------------+  +------------------+  +------------+ |
|                                                             |
|  Prep Time Trend Over Time (Graph)                          |
|  +-------------------------------------------------------+  |
|  |  *                                                    |  |
|  |     *     *                                           |  |
|  |        *     *                                        |  |
|  +-------------------------------------------------------+  |
|                                                             |
+-------------------------------------------------------------+
```
### Layout Breakdown:
* **Dashboard Filter Controls:** Dropdown to select time period and export actions.
* **KPI Metrics Row:** Key indicators displayed in prominent, structured summary boxes.
* **Data Visualization Canvas:** Space for charting trends.

---

## Screen 9: Customer Reservation Preorder & Deposit Screen
**Purpose:** Customer-facing page to select dining options and process payments.

```text
+-------------------------------------------------------------+
| [Back] Booking Deposit & Meal Preorder                      |
+-------------------------------------------------------------+
|  Selected: Table 5 (VIP Room) - June 30, 7:00 PM            |
|                                                             |
|  Base Table Reservation Fee: 20,000 VND                     |
|                                                             |
|  [X] Add Food Preorder (Save time at the restaurant)        |
|  +-------------------------------------------------------+  |
|  | Selected Dishes: 1x Japanese A5 Wagyu                 |  |
|  | Meal Subtotal: 1,500,000 VND                          |  |
|  +-------------------------------------------------------+  |
|                                                             |
|  Required 30% Booking Deposit: 456,000 VND                  |
|                                                             |
|  [ APPLY VOUCHER CODE ]                                     |
|                                                             |
|              +--------------------------+                   |
|              | PROCEED TO DEPOSIT CHECK |                   |
|              +--------------------------+                   |
+-------------------------------------------------------------+
```
### Layout Breakdown:
* **Booking Summary:** Details of reservation date, table choice, and base fee.
* **Preorder Toggle:** Checkbox to expand or collapse dish preorders.
* **Deposit Calculation:** Shows the 30% required deposit value based on subtotal.
* **Payment CTA:** Action button to load the payment gateway.

---

## Screen 10: Admin Role Management & System Settings Console
**Purpose:** Manage employee profiles and adjust access permissions.

```text
+-------------------------------------------------------------+
| [Menu] System Admin Settings                       11:45 AM |
+-------------------------------------------------------------+
| Employee Select: [ Son Nguyen (Chef)                   |v]  |
|                                                             |
| Access Permissions Grid:                                    |
| [X] Can View Kitchen KDS Queue                              |
| [X] Can Edit Kitchen Ticket Status                          |
| [ ] Can Access Manager Billing Reports                      |
| [ ] Can Adjust Global Inventory Thresholds                  |
| [ ] Can Modify Floor-Plan Layouts                           |
|                                                             |
|              +------------------------------+               |
|              |     SAVE PERMISSION CHANGES  |               |
|              +------------------------------+               |
+-------------------------------------------------------------+
```
### Layout Breakdown:
* **Selection Dropdown:** Menu to select staff profiles.
* **Permissions Checklist:** Vertical array of checkboxes mapping functional capabilities.
* **Footer Action:** "Save Permission Changes" button.
