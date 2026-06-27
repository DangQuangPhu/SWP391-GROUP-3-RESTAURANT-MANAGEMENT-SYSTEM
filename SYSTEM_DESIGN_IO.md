# System Input/Output Design Specification

## 1. Project Title
**Phūrai Collaborative Kitchen & Service Coordination Portal (PCK-SCP)**

---

## 2. System Description
The **Phūrai Collaborative Kitchen & Service Coordination Portal (PCK-SCP)** is a real-time, cloud-based collaborative operations system designed to synchronize restaurant front-of-house (FOH) hosts/waiters, back-of-house (BOH) chefs, and supervisors. In a fast-paced restaurant environment, lack of alignment leads to delayed orders, table seat planning conflicts, cold food, and inventory bottlenecks. The PCK-SCP solves these coordination breakdowns by acting as a shared state manager. It aggregates inputs from floor terminals, kitchen displays, and reservation logs, and outputs real-time queue listings, push notifications, and visual layout updates. This keeps all staff members aligned on active service priorities and order statuses.

---

## 3. System Inputs (5 Pieces of Information)

### Input 1: Order Item Customization & Notes
* **Description:** Specific customer details (e.g., *"Medium rare A5 Wagyu"* or *"Nut allergy"*), inputted by the waiter via mobile tablet terminals when placing a table order.
* **Why it's needed:** This input is critical to transmit preparation preferences from FOH staff to BOH chefs, preventing health safety issues and reducing dish preparation errors.

### Input 2: Kitchen Ticket Status Transitions
* **Description:** State changes (e.g., *'Pending'* to *'Preparing'*, or *'Preparing'* to *'Ready'*) input by station chefs on touch-screen Kitchen Display System (KDS) panels.
* **Why it's needed:** This indicates when a preparation step starts or finishes, updating the central order state so FOH staff know exactly which food items are ready for table service.

### Input 3: Table State Updates (Sensor/Manual)
* **Description:** Status information (e.g., *'Occupied'*, *'Cleaning'*, or *'Available'*) input manually by bus staff via terminal toggles or collected automatically from infrared table-occupancy sensors.
* **Why it's needed:** This information helps the hosting team at the entrance see table turnover in real-time, allowing them to seat incoming guests immediately and keep customer waiting times low.

### Input 4: Staff Clock-In / Location Verification
* **Description:** Shift start triggers accompanied by location coordinates (using GPS sensors or local Wi-Fi beacon checks) from FOH/BOH employee mobile devices.
* **Why it's needed:** This data verifies attendance and ensures staff are physically present at the restaurant before they can receive task allocations or shift assignments.

### Input 5: Low-Stock Inventory Adjustments
* **Description:** Changes in ingredient availability input by the store manager during morning counts, or triggered by automated weight-sensor scales in cold storage.
* **Why it's needed:** This input updates the digital menu in real-time. If key ingredients (e.g., Black Cod) run out, the system automatically tags corresponding menu items as "Sold Out" across all mobile checkout tablets to prevent invalid orders.

---

## 4. System Outputs & Feedback (5 Types of Information)

### Output 1: Real-Time Kitchen Display Queue
* **Description:** A chronologically sorted, priority-colored board displayed on BOH kitchen monitors showing active food preparation tasks.
* **Why it's needed:** This dashboard helps chefs organize their prep queues efficiently, highlighting VIP orders and flagging tickets that have exceeded target prep times (e.g., 20 minutes).

### Output 2: Waiter Service Push Notifications
* **Description:** Instant audio-visual alerts pushed to a waiter's smartwatch or tablet when a chef marks their table's order as *'Ready'* in the kitchen.
* **Why it's needed:** This prompt ensures that ready dishes are picked up and served immediately, ensuring guests receive their food fresh and hot.

### Output 3: Visual Floor-Plan Table Map
* **Description:** A color-coded, interactive floor plan display (e.g., Green for Available, Blue for Reserved, Red for Occupied) shown on the hostess terminal.
* **Why it's needed:** This map helps the greeting team locate available tables quickly and manage dining floor seating flow during busy shifts.

### Output 4: Automated Customer Booking Confirmation (SMS/Email)
* **Description:** A digital receipt sent to a customer's email or phone containing their booking details, deposit status, and voucher codes.
* **Why it's needed:** This output gives guests immediate confirmation of their booking, details how to redeem their vouchers, and reduces no-shows by outlining deposit terms.

### Output 5: Manager Operational Shift Report
* **Description:** An end-of-day summary detailing ticket preparation averages, table turnover rates, staff attendance logs, and high-margin sales trends.
* **Why it's needed:** This report gives managers the data they need to optimize staff shifts, update table layout plans, and refine preparation procedures for future dining service.
