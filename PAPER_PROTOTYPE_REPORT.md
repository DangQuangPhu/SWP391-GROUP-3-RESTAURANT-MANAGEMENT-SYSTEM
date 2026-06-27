# Paper Prototyping & Usability Testing Report

## 1. Project Title
**Rapid Paper Prototyping and Usability Testing for the Phūrai Collaborative Kitchen & Service Coordination Portal (PCK-SCP)**

---

## 2. System Description
The **Phūrai Collaborative Kitchen & Service Coordination Portal (PCK-SCP)** is a real-time, collaborative operations system designed to synchronize restaurant front-of-house (FOH) hosts/waiters, back-of-house (BOH) chefs, and supervisors. In a fast-paced restaurant environment, lack of alignment leads to delayed orders, table seat planning conflicts, cold food, and inventory bottlenecks. The PCK-SCP solves these coordination breakdowns by acting as a shared state manager. It aggregates inputs from floor terminals, kitchen displays, and reservation logs, and outputs real-time queue listings, push notifications, and visual layout updates. This keeps all staff members aligned on active service priorities and order statuses.

---

## 3. Prototyped Tasks & Interactions

We prototyped and tested three core tasks supporting FOH/BOH operations, each comprising at least five key interactions:

### Task 1: Seating a Customer and Updating Floor Table State
* **Interaction 1:** Host presses the `Assign Walk-in` button on the FOH sidebar.
* **Interaction 2:** Host inputs the guest party size (e.g., "4 people") into the pop-up field.
* **Interaction 3:** Host taps Table T14 on the interactive floor-plan map.
* **Interaction 4:** Host confirms the assignment by pressing the `Seat Party` button.
* **Interaction 5:** The system updates the table state, and the table card changes to yellow (Occupied).

### Task 2: Creating an Order with Custom Chef Customizations
* **Interaction 1:** Waiter selects Table T14 from the floor plan to open the menu order page.
* **Interaction 2:** Waiter taps the `Burgers` category tab to filter food options.
* **Interaction 3:** Waiter presses `+` on the `Wagyu Beef Burger` card to add it to the cart.
* **Interaction 4:** Waiter taps the `Prep Note` input box and writes *"Medium rare, add aioli"* on the virtual keyboard.
* **Interaction 5:** Waiter presses the large `Send to Kitchen` button to dispatch the ticket to the BOH KDS queue.

### Task 3: Redeeming Loyalty Points and Splitting the Bill
* **Interaction 1:** Waiter opens the table details page and clicks `Proceed to Checkout`.
* **Interaction 2:** Waiter clicks the `Apply Voucher` field to view the available coupon drawer.
* **Interaction 3:** Waiter selects the active `-50k VND` loyalty voucher from the list.
* **Interaction 4:** Waiter taps the `Item Split` payment option to divide the bill between two guests.
* **Interaction 5:** Waiter triggers the `Pay QR` action for Guest 1, generating the dynamic VietQR payment code.

---

## 4. Usability Testing & State Transitions

We conducted a usability test with a participant simulating a restaurant waiter/host. The participant interacted with paper-drawn screens, while the researcher acted as the "computer," replacing paper cutouts and shifting sticky notes in real-time to represent system changes.

### Prototype Testing State Photos

#### State 1: Staff Location Verification & PIN Login
The participant inputs their staff PIN, verifying their shift check-in location.

![State 1: PIN Login](/Users/phu/.gemini/antigravity-ide/brain/3fc4c2a7-197e-4b74-9595-9c0bcdc11fdb/prototype_state_login_1782553011580.png)

---

#### State 2: Seating Selections on the Floor Plan Map
The participant assigns an incoming group of 6 to Table T14 on the physical layout sheet.

![State 2: Seating Assignment](/Users/phu/.gemini/antigravity-ide/brain/3fc4c2a7-197e-4b74-9595-9c0bcdc11fdb/prototype_state_map_1782553026247.png)

---

#### State 3: Dish Preorder Customization
The participant places a physical Wagyu Burger icon onto the active order sheet and writes prep notes.

![State 3: Dish Customization](/Users/phu/.gemini/antigravity-ide/brain/3fc4c2a7-197e-4b74-9595-9c0bcdc11fdb/prototype_state_menu_1782553039635.png)

---

#### State 4: Billing Checkout and Voucher Application
The participant applies a `-50k VND` voucher sticky note to update the order final total.

![State 4: Voucher Application](/Users/phu/.gemini/antigravity-ide/brain/3fc4c2a7-197e-4b74-9595-9c0bcdc11fdb/prototype_state_checkout_1782553053993.png)

---

## 5. Five Design Changes Based on Usability Feedback

Based on observations and participant comments during the paper prototype run, we identified five design friction points and planned the following changes:

### Revision 1: Adding Haptic & Sound Feedback to the PIN Pad
* **Problem Observed:** The tester was unsure if their PIN keystroke registered because the blank circles did not update quickly enough, leading to double-pressing.
* **Revision:** We will add haptic vibration feedback for every keypress and immediate visual bullet indicators (`*`) as soon as a key is touched.

### Revision 2: Table Search Filter in Map View
* **Problem Observed:** When tasked with finding a table with a capacity of 6, the tester spent significant time reading through the capacities of every table on the map layout.
* **Revision:** We will add quick-filter toggle buttons (e.g., `2 Guests`, `4 Guests`, `6+ Guests`) at the top of the map to dim out mismatched tables.

### Revision 3: Auto-expanding Custom Preparation Notes
* **Problem Observed:** The tester did not notice the custom prep note text box below the dish card until explicitly prompted, missing the opportunity to write dietary instructions.
* **Revision:** We will make the "Add Prep Note / Allergy Details" button display as a clear button that expands the input field only when tapped, rather than a hidden text field.

### Revision 4: Visible Points Balance at Checkout
* **Problem Observed:** When applying vouchers on the checkout screen, the tester wanted to know their remaining point balance but had to leave the checkout flow to check their profile tab.
* **Revision:** We will display the customer's current points balance (e.g., *"Balance: 320 Pts"*) directly inside the voucher discount picker header.

### Revision 5: Split Bill Progress Visualization
* **Problem Observed:** When managing split payments, the tester was confused about which guest had successfully completed their payment and which transaction was still pending.
* **Revision:** We will add progress checkboxes (e.g., `[X] Paid` or `[ ] Pending`) and change the background color of guest rows to light green upon payment confirmation.
