# Phurai Reservations — Real-World Scheduling & Table Status Test Cases

**Location:** `test-cases/reservation-booking-test-cases.md`

Use these cases to verify that scheduling estimate and actual occupancy are separated:

- Scheduling estimate blocks double-booking for the same table/time window.
- Actual occupancy is released only by payment completion, staff checkout, or staff table release.
- Table ID and Area always come from the selected/assigned table, not from another area.

---

## A. Create Reservation And Slot Blocking

| ID | Title | Preconditions | Steps | Test Data | Expected Result | Status |
|----|-------|---------------|-------|-----------|-----------------|--------|
| R-A01 | WIN-A blocks same slot after pre-save | Logged in customer; WIN-A available | Create reservation for WIN-A, then open Choose Table again with the same date/time | `28/07/2026 17:00`, guests `2`, table `WIN-A` | WIN-A is shown as Reserved/Booked and cannot be selected | |
| R-A02 | WIN-A does not reserve PR-01 | WIN-A available; PR-01 available | Create reservation selecting WIN-A only | table `WIN-A` | Staff/Manager table cards show WIN-A reserved/await check-in; PR-01 stays Available unless it has its own booking | |
| R-A03 | One booking saves one ReservationTables row | After R-A01 | Query `ReservationTables` for the new reservation | reservation id from UI | Exactly one row exists and its table number is WIN-A | |
| R-A04 | Area displays assigned table area | After R-A01 | Open Staff Portal reservation detail/list | table `WIN-A` | Area shows `Window Zone A` / Window Area, not `Any` and not Private Room | |
| R-A05 | Overlapping slot is blocked | WIN-A booked 17:00-18:30 estimated | Try booking WIN-A at 17:30 | same date, guests `2` | API returns slot conflict or UI disables WIN-A | |
| R-A06 | Adjacent slot after estimate + hold is allowed only after buffer | WIN-A booked 17:00-18:30, table hold `15m` | Try 18:30, then 18:45 | same date | 18:30 is blocked if hold buffer applies; 18:45 is available if no actual occupancy session blocks it | |
| R-A07 | Different table same slot is allowed | WIN-A booked 17:00 | Try booking WIN-B at 17:00 | guests fit WIN-B | WIN-B remains selectable and reservation succeeds | |
| R-A08 | Different area does not inherit selected table | Select WIN-A on floor map | Inspect summary/invoice/staff detail | table `WIN-A` | Table ID is WIN-A and area is Window Zone A across all views | |

---

## B. Booking Status Rules

| ID | Title | Preconditions | Steps | Test Data | Expected Result | Status |
|----|-------|---------------|-------|-----------|-----------------|--------|
| R-B01 | Awaiting Deposit blocks slot | Reservation exists with `Awaiting Deposit` | Load availability for same slot/table | same date/time/table | Table is Booked/Reserved in slot availability | |
| R-B02 | Await Check-in blocks slot | Complete deposit payment | Load availability for same slot/table | same date/time/table | Table is Booked/Reserved | |
| R-B03 | Dining blocks slot by actual session | Staff checks in reservation | Load availability for a time before estimated release | table in Dining | Table is Occupied and not bookable | |
| R-B04 | Customer eating longer than ERT remains occupied | Dining session estimated release passed; no payment/staff release yet | Load availability for same table | later time | Table remains Occupied because actual session has no `released_at` | |
| R-B05 | Completed releases scheduling block for future slots | Reservation checked out/completed and table released/cleaned | Load availability after release | later slot | Table can become Available after operational status is Available | |
| R-B06 | Cancelled does not block slot | Cancel reservation | Load same date/time/table | cancelled reservation | Table is Available unless another active booking/session exists | |
| R-B07 | No Show does not block after sweep | Reservation past grace period | Trigger availability or sweeper | same table | Reservation becomes No Show and no longer blocks new future slots | |

---

## C. Actual Table Occupancy And Release

| ID | Title | Preconditions | Steps | Test Data | Expected Result | Status |
|----|-------|---------------|-------|-----------|-----------------|--------|
| R-C01 | Check-in creates occupancy session | Await Check-in reservation exists | Staff confirms check-in | table WIN-A | Table status changes to Occupied; occupancy session has `check_in_at` and `estimated_release_at` | |
| R-C02 | Payment success moves table to Cleaning/Available workflow | Dining order exists | Complete payment | table WIN-A | Audit log saved; table leaves Occupied according to configured checkout/cleaning flow | |
| R-C03 | Cash checkout requires staff confirmation | Walk-in or cash customer is dining | Staff confirms bill/table ID | table ID | Audit log saved; table changes from Occupied to Cleaning/Available only after staff action | |
| R-C04 | Actual occupancy overrides scheduling estimate | Table has unreleased occupancy session | Query availability for any time before actual release | table ID | Table is Occupied, even if reservation_end_at has passed | |

---

## D. My Reservations

| ID | Title | Preconditions | Steps | Test Data | Expected Result | Status |
|----|-------|---------------|-------|-----------|-----------------|--------|
| R-D01 | Logged-in reservation appears in My Reservations | Customer account exists and is logged in | Create reservation, go to `/my-reservations` | same account | New reservation appears under its reservation date | |
| R-D02 | Email fallback recovers guest booking | Existing guest booking uses same email as logged-in account | Open My Reservations | matching email | Booking appears even if `customer_id` was null | |
| R-D03 | Date filter finds booking | Booking exists on selected date | Filter by exact date | reservation date | Count is 1+ and booking row appears | |
| R-D04 | Wrong date filter returns empty state | Booking exists on another date | Filter by date with no bookings | empty date | Empty state appears with correct date text | |

---

## E. Edit Reservation Request

| ID | Title | Preconditions | Steps | Test Data | Expected Result | Status |
|----|-------|---------------|-------|-----------|-----------------|--------|
| R-E01 | Past time rejected in realtime | Current time is after 16:00 | Try edit request to 13:00 today | today's date, `13:00` | UI blocks request and no API call is accepted | |
| R-E02 | Future time allowed for request | Reservation exists | Edit to later future time | `17:00` or later | Confirm dialog opens and request is submitted | |
| R-E03 | Change table request is sent | Reservation currently WIN-A | Edit table to WIN-B | available table | Pending changes include table change; staff/manager can see requested table | |
| R-E04 | Guest count request validates capacity | Reservation has 2 guests | Change to 8 guests and select 2-seat table | table capacity too small | UI/API rejects or table is disabled | |
| R-E05 | Pre-order request is included | Reservation exists | Add pre-order text in edit modal | `2 Pho Bo, no onion` | Pending request comparison shows Pre-order | |
| R-E06 | Request approval preserves one table assignment | Pending edit request changes WIN-A to WIN-B | Staff/manager accepts request | pending change | ReservationTables has WIN-B only; WIN-A is no longer assigned | |

---

## F. Real-Time UI Regression

| ID | Title | Preconditions | Steps | Test Data | Expected Result | Status |
|----|-------|---------------|-------|-----------|-----------------|--------|
| R-F01 | Socket does not overwrite slot booking | WIN-A booked at 17:00 | Emit/trigger table status Available, then keep date/time 17:00 | socket table event | UI refreshes availability and WIN-A remains Booked/Reserved for 17:00 | |
| R-F02 | Refresh button no longer required for table events | Staff changes table status | Watch customer/staff table views | table event | Cards update automatically via socket refresh | |
| R-F03 | PR-01 independent from WIN-A | WIN-A receives table event | Watch PR-01 card | PR-01 | PR-01 status does not change unless event/table assignment targets PR-01 | |

---

## Manual API Checks

```bash
# Availability for a specific slot
curl "http://localhost:5001/api/reservations/availability?date=2026-07-28&time=17:00&durationMinutes=105&guestCount=2"

# Verify a reservation has exactly one assigned table
docker exec -it sqlserver /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'PhuSql@123456' -C \
  -d RestaurantManagementDB \
  -Q "SELECT r.reservation_id, r.reservation_status, r.reservation_start_at, r.reservation_end_at, t.table_number, a.area_name FROM dbo.Reservations r JOIN dbo.ReservationTables rt ON r.reservation_id = rt.reservation_id JOIN dbo.RestaurantTables t ON rt.table_id = t.table_id JOIN dbo.RestaurantAreas a ON t.area_id = a.area_id WHERE r.reservation_id = 100122;"

# Verify WIN-A and PR-01 are independent
docker exec -it sqlserver /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'PhuSql@123456' -C \
  -d RestaurantManagementDB \
  -Q "SELECT t.table_id, t.table_number, t.table_status, a.area_name FROM dbo.RestaurantTables t JOIN dbo.RestaurantAreas a ON t.area_id = a.area_id WHERE t.table_number IN (N'WIN-A', N'PR-01');"
```
