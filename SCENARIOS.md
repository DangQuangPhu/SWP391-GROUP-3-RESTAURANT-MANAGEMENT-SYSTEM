# PCK-SCP: Activity & Task Scenarios

This document contains **two detailed operational scenarios** for the **Phūrai Collaborative Kitchen & Service Coordination Portal (PCK-SCP)**. Each scenario maps out how the system facilitates collaboration by highlighting the five key scenario components: **Setting, Agents, Goals, Actions, and Events**.

---

## 1. Project Title
**Phūrai Collaborative Kitchen & Service Coordination Portal (PCK-SCP)**

---

## 2. Scenario 1: Resolving a High-Priority Allergy Customization Under Pressure

* **Setting:** The noisy, crowded dining room and hot main kitchen line of Phūrai Restaurant during the Friday night rush at 7:45 PM. 
* **Agents:** Minh "Sunny" Tran (FOH Server, 22) and Chef Hung Nguyen (BOH Head Chef, 48).
* **Goals:** Place, customize, and prepare a Japanese A5 Wagyu dish for Table T14, ensuring that a severe peanut allergy is communicated clearly and the dish is served hot without error.
* **Actions:** Minh stands at Table T14 and takes the customer’s order. Tapping his mobile tablet terminal, he adds the Wagyu Beef Burger. He hits the "Add Prep Note" button, selecting the **"ALLERGY"** flag, and types *"SEVERE PEANUT ALLERGY - NO COOKING OIL"* on the screen. He taps `Send to Kitchen`. In the kitchen, Chef Hung sees a new high-priority ticket flash at the top of his KDS monitor. Tapping the big screen button labeled `START PREPARATION`, Hung prepares the burger at a dedicated allergy-safe station. Once cooked, Hung plates the burger and taps the large green `MARK READY` button on the KDS panel.
* **Events:** When Minh submits the order, the system automatically routes the ticket to the top of Chef Hung's KDS queue, highlighting it in flashing red with a warning icon due to the allergy flag. Once Hung taps `MARK READY`, the system plays a distinct audio beep in the kitchen, clears the KDS card, and pushes a vibration alert to Minh's smartwatch reading: *"Table T14 - Wagyu Burger ready at counter. Serve immediately."* Minh walks to the counter, picks up the fresh, hot plate, and serves it safely.

---

## 3. Scenario 2: Managing a Crowded Entryway and Seating Waitlists

* **Setting:** The front entrance lobby and host stand at Phūrai Restaurant on Saturday evening at 6:30 PM. The entryway is packed with walk-in parties waiting for tables.
* **Agents:** Lan Anh (FOH Receptionist, 24) and the floor bus staff.
* **Goals:** Efficiently seat a walk-in family of six guests at an available table to reduce bottlenecking in the lobby and keep table turnover high.
* **Actions:** Lan Anh views the real-time floor plan map on the host stand monitor. She selects the `6+ Guests` filter at the top of the interface. The map automatically dims out smaller 2-seater and 4-seater tables, highlighting Table T4, which is currently colored orange (Cleaning). Lan Anh taps Table T4 to check its status. On the floor, the bus staff finish wiping down Table T4 and tap the `Mark Available` button on their wall-mounted service terminal. Back at the host stand, T4 turns green on Lan Anh's monitor. She taps the table and selects `Assign Walk-in`, typing the customer's name into the pop-up field.
* **Events:** As the bus staff mark the table clean, the system syncs the database state instantly, changing Table T4's color status from orange (Cleaning) to green (Available) on the central map. When Lan Anh assigns the walk-in party to T4, the table's color state turns red (Occupied) on all staff screens, and the host printer prints a seating ticket for the family. This allows Lan Anh to guide the family to their table immediately, clearing the lobby.
