# Google Flights Usability Test Report

## 1. Project Title
**Usability Evaluation of Google Flights: Assessing Navigation Efficiency and Information Visibility for Frequent Travelers**

---

## 2. Executive Summary
This report presents the findings of a usability test conducted on **Google Flights** with five frequent travelers (who have purchased at least one plane ticket online in the past year and have not previously used Google Flights). The test evaluated user efficiency, errors, and overall satisfaction across direct, multi-city, and complex family bookings. 

* **Overall Usability (SUS Score):** Google Flights scored an average **System Usability Scale (SUS) score of 72.0**, indicating good usability, though significant points of friction remain.
* **Core Task Completion:** Tasks 1 (Easy) and 2 (Medium) achieved high success rates (100% and 80%, respectively). However, Task 3 (Challenging) fell to a **40% completion rate** due to visibility issues surrounding baggage policies and infant passenger setup.
* **Top Recommendation:** Redesign the multi-city date picker overlay to prevent chronological selection errors and make baggage policy details immediately visible in the primary flight cards rather than hiding them under nested menus.

---

## 3. Methodology & Test Structure

### Testing Environment
* **Platform:** Google Flights desktop web application.
* **Recording Methods:** Screen capture with audio recording and researcher observation logs.

### Participant Recruitment Criteria
* **Recruitment Filters:** Must have bought a flight ticket online in the past 12 months; must have zero previous familiarity with Google Flights.
* **Demographic Diversity:** Balanced across flight frequency (High vs. Low) and booking complexity preferences.

### Tasks Administered
1. **Task 1 (Easy) — Direct Weekend Booking:** Sourced direct flight from NY to Chicago (Oct 16–18, 2026). *Purpose:* Test basic entry fields, date selectors, and sorting layout.
2. **Task 2 (Medium) — Multi-City Business Itinerary:** Book SFO ➜ SEA (Nov 9), SEA ➜ BOS (arrive before 6:00 PM, Nov 11), BOS ➜ SFO (Nov 13). *Purpose:* Test multi-city layout additions and departure time range sliders.
3. **Task 3 (Challenging) — Complex Passenger Count & Cabin Upgrades:** Book LAX ➜ Tokyo (Dec 11–27, 2026) for 2 adults and 1 lap infant. Compare Business vs. Premium Economy fares, identify cheapest airlines, and verify if 2 checked bags are included. *Purpose:* Test advanced passenger filters, cabin dropdowns, and deep baggage policy cards.

---

## 4. Participant Profiles & Baseline Metrics

The following metrics were compiled across the 5 test sessions:

| Participant ID | Flight Frequency (Annual) | Booking Profile | Task 1 (S / T / E)* | Task 2 (S / T / E)* | Task 3 (S / T / E)* | SUS Score |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **P1** | High (5+ trips) | Standard | S / 42s / 0 | S / 115s / 1 | F / 300s (T/O) / 3 | 77.5 |
| **P2** | Low (1-2 trips) | Complex (Baggage focus) | S / 68s / 1 | S / 140s / 2 | F / 300s (T/O) / 4 | 62.5 |
| **P3** | High (8+ trips) | Standard | S / 35s / 0 | S / 98s / 0 | S / 210s / 1 | 85.0 |
| **P4** | Low (2 trips) | Complex (Infant focus) | S / 72s / 1 | F / 180s (Abandon) / 3 | F / 300s (T/O) / 5 | 55.0 |
| **P5** | High (6 trips) | Complex (Diet/Baggage) | S / 48s / 0 | S / 122s / 1 | S / 245s / 2 | 80.0 |
| **Averages** | **5.4 trips** | | **100% / 53s / 0.4** | **80% / 131s / 1.4** | **40% / 271s / 3.0** | **72.0** |

*\*S/T/E = Status (S=Success, F=Fail/Timeout) / Time in Seconds / Error Count*

---

## 5. Key Usability Findings

### Finding 1: Multi-City Date Picker Overlap Conflicts (High Severity)
* **Description:** When setting dates in the Multi-City search panel, selecting a departure date for a subsequent flight (e.g., Flight 2) that conflicts with or precedes the date of Flight 1 causes calendar selections to lock up or reset without clear error messaging.
* **Evidence:** P4 abandoned the task after trying to change the date of Flight 2 three times. P4 stated, *"It keeps setting my Seattle trip date back to today instead of November, and I don't know why it's blocking me."*
* **Mockup Illustration:**

![Multi-City Date Picker Conflict](/Users/phu/.gemini/antigravity-ide/brain/3fc4c2a7-197e-4b74-9595-9c0bcdc11fdb/google_flights_multicity_1782553937924.png)

* **Recommendation:** Replace the restricted calendar dropdown with an interactive multi-flight timeline widget. If a date conflict occurs, display a clear warning banner (e.g., *"Flight 2 departure date must be after Flight 1"*) rather than silently resetting the inputs.

---

### Finding 2: Baggage Policy and Fee Information is Buried (High Severity)
* **Description:** Users struggled to verify baggage allowance. Google Flights displays a small grey suitcase icon inside collapsed flight details cards, forcing users to click through multiple dropdown levels to confirm if checked bags are included in the fare.
* **Evidence:** P1, P2, and P4 timed out on Task 3 because they could not locate the checked-bag criteria. P2 commented, *"I see the flight price, but I have no idea if my bags will cost me another $150. I'm clicking everything, and I don't see it."*
* **Mockup Illustration:**

![Buried Baggage Information](/Users/phu/.gemini/antigravity-ide/brain/3fc4c2a7-197e-4b74-9595-9c0bcdc11fdb/google_flights_baggage_1782553955400.png)

* **Recommendation:** Display baggage details directly on the primary flight card using clear icons (e.g., `[Carry-on: Yes]` `[Checked: Extra Fee]`). This prevents users from having to drill down into collapsed menus.

---

### Finding 3: Lap Infant Passenger Selection is Hidden (Medium Severity)
* **Description:** The passenger count selector displays "1 adult" by default. The options for adding kids or lap infants are hidden inside a secondary dropdown menu. Users frequently missed this setting when trying to book travel for an infant.
* **Evidence:** P4 spent 85 seconds searching the page for the infant option. P4 commented, *"I thought I'd find it in the search results or when choosing seats, but it's hidden under the passenger count number at the very top."*
* **Recommendation:** Expand the passenger selection dropdown into a clear popup row when the user clicks passenger options. This makes it easier to select the correct number of Adults, Children, and Lap Infants.

---

## 6. Actionable Recommendations Summary

1. **Date Flow Validation:** Implement non-restrictive date inputs for multi-city search, displaying validation warnings rather than blocking user input.
2. **First-Tier Baggage Status:** Display baggage indicators directly on the search results cards to reduce clicks.
3. **Redesigned Passenger Picker:** Open a comprehensive passenger picker overlay to make it clear how to select children and infants.

---

## 7. Appendices: Complete List of Identified Issues

* **Issue A1 (High):** Multi-city date selection resets in non-chronological order.
* **Issue A2 (High):** Checked bag fees are hidden behind multiple click levels.
* **Issue A3 (Medium):** Lap infant selector is hidden under the default passenger count dropdown.
* **Issue A4 (Medium):** Class filter dropdown (Business/Economy) collapses automatically without confirming selections.
* **Issue A5 (Low):** Filter tags (Stops, Airlines, Price) are placed far from the search button on wider monitors.
* **Issue A6 (Low):** Price graph visualization lacks clear y-axis pricing grids on mobile-responsive widths.
