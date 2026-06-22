Full Table Lifecycle (Available -> Occupied -> Cleaning -> Available) is complete.

---
### **Phase 1: Payment Check-out & Verification Flow (SePay)** - **[COMPLETED & DEPLOYED]**

- **[SECURED & DONE]** Task 1: Manager Promotions UI and Backend CRUD (+ DB verify).
- **[SECURED & DONE]** Task 2: Pre-save API & Pricing Engine (Added deposit_amount, final_total, order_code, applied_promo_code, preorder_json, implemented createPreSaveReservation API).
- **[SECURED & DONE]** Task 3: SePay Webhook Endpoint (Strict Transaction logic, PreorderItems insertion, Amount Validation, Socket Emission).
- **[SECURED & DONE]** Task 4: Expiration Cronjob & Manual Cancel (15-min timeout automated cleanup, `PaymentFailed` FSM handling, dedicated API).
- **[SECURED & DONE]** Decoupled Promotion API Hotfix: Shared `checkPromoValidity`, template literal syntax fixed, added `GET /api/promotions/validate/:code`.
- **[SECURED & DONE]** Task 5: Customer UI Animations & Staff Socket Illusion (Apple Wallet Ticket, 10s Flash Illusion).

**BMAD STATE LOCKED (SMART CHECKOUT):** 
The reservation payment lifecycle is now completely dynamic, zero-trust driven, real-time reactive via Socket.IO, and self-cleansing via the 15-minute cron interval. All dependencies are mapped correctly.
