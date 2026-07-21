/**
 * seed-local.js — Native Batched Query Seeder for Local Development
 *
 * Generates 1 year of deterministic, realistic restaurant data and inserts
 * it directly into the database using batched multi-row INSERT statements.
 */

import sql from 'mssql';

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic PRNG (Linear Congruential Generator, seed=42)
// ─────────────────────────────────────────────────────────────────────────────
class LCG {
  constructor(seed) {
    this.seed = seed;
    this.a = 1664525;
    this.c = 1013904223;
    this.m = Math.pow(2, 32);
  }
  next()               { this.seed = (this.a * this.seed + this.c) % this.m; return this.seed / this.m; }
  nextRange(min, max)  { return Math.floor(this.next() * (max - min + 1)) + min; }
  nextElement(arr)     { return arr[this.nextRange(0, arr.length - 1)]; }
  chance(p)            { return this.next() < p; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Static reference data (must match what's in System_Restaurant.sql)
// ─────────────────────────────────────────────────────────────────────────────
const TABLES = [
  { table_id: 1, capacity: 2 }, { table_id: 2, capacity: 4 }, { table_id: 3, capacity: 6 }, { table_id: 4, capacity: 8 },
  { table_id: 5, capacity: 6 }, { table_id: 7, capacity: 6 }, { table_id: 8, capacity: 4 }, { table_id: 9, capacity: 4 },
  { table_id: 11, capacity: 4 }, { table_id: 12, capacity: 4 }, { table_id: 13, capacity: 4 }, { table_id: 15, capacity: 4 },
  { table_id: 16, capacity: 4 }, { table_id: 17, capacity: 4 }, { table_id: 18, capacity: 4 }, { table_id: 19, capacity: 4 },
  { table_id: 20, capacity: 4 }, { table_id: 21, capacity: 4 }, { table_id: 22, capacity: 4 }, { table_id: 23, capacity: 4 },
  { table_id: 25, capacity: 4 }, { table_id: 26, capacity: 6 }, { table_id: 27, capacity: 8 }, { table_id: 28, capacity: 4 },
  { table_id: 29, capacity: 4 }, { table_id: 30, capacity: 4 }, { table_id: 31, capacity: 4 },
];
const DISHES = [
  { dish_id: 1, price: 168000 }, { dish_id: 2, price: 428000 }, { dish_id: 3, price: 188000 }, { dish_id: 4, price: 228000 },
  { dish_id: 5, price: 168000 }, { dish_id: 6, price: 148000 }, { dish_id: 7, price: 188000 }, { dish_id: 8, price: 260000 },
  { dish_id: 9, price: 499000 }, { dish_id: 10, price: 690000 }, { dish_id: 11, price: 690000 }, { dish_id: 12, price: 248000 },
  { dish_id: 13, price: 890000 }, { dish_id: 14, price: 360000 }, { dish_id: 15, price: 98000 }, { dish_id: 16, price: 118000 },
  { dish_id: 17, price: 89000 }, { dish_id: 18, price: 89000 }, { dish_id: 19, price: 1290000 }, { dish_id: 20, price: 990000 },
];
const MANAGER_STAFF  = [{ user_id: 1 }, { user_id: 2 }];
const REGULAR_STAFF  = [{ user_id: 3 }, { user_id: 4 }, { user_id: 14 }];
const VOUCHERS       = [
  { voucher_id: 1, discount_type: 'Percent', discount_value: 10 },
  { voucher_id: 2, discount_type: 'Fixed',   discount_value: 20000 },
];
const PAYMENT_METHODS_QR   = [2, 3]; // Bank Transfer, MOMO
const PAYMENT_METHOD_CASH  = 1;

// Name pools for identity generation
const SURNAMES       = ['Nguyễn','Trần','Lê','Phạm','Hoàng','Phan','Vũ','Đặng','Bùi'];
const MID_NAMES      = ['Văn','Thị','Minh','Hữu','Thanh','Ngọc','Quốc','Tuấn','Đức','Bảo'];
const FIRST_NAMES    = ['An','Bình','Châu','Dũng','Đạt','Giang','Hùng','Hương','Khánh','Linh','Long','Mai','Nam','Nga','Phong','Sơn','Thảo','Trang','Uyên','Vinh'];
const MOBILE_PREFIXES= ['09','08','07','03','05'];

function removeAccents(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D');
}
function makeIdentity(prng, idx) {
  const sur   = prng.nextElement(SURNAMES);
  const mid   = prng.nextElement(MID_NAMES);
  const first = prng.nextElement(FIRST_NAMES);
  const full  = `${sur} ${mid} ${first}`;
  const email = `${removeAccents(full.toLowerCase()).replace(/\s/g,'')}${idx}@gmail.com`;
  const phone = prng.nextElement(MOBILE_PREFIXES) + prng.nextRange(10000000,99999999);
  return { fullName: full, email, phone };
}

function escapeSqlString(str) {
  if (str === null || str === undefined) return 'NULL';
  return `N'${str.replace(/'/g, "''")}'`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: batched query insert
// ─────────────────────────────────────────────────────────────────────────────
async function executeInserts(pool, tableName, columns, valueRows, identityInsert = false) {
  if (valueRows.length === 0) return;
  
  const CHUNK_SIZE = 500;
  for (let i = 0; i < valueRows.length; i += CHUNK_SIZE) {
    const chunk = valueRows.slice(i, i + CHUNK_SIZE);
    let query = '';
    if (identityInsert) {
      query += `SET IDENTITY_INSERT dbo.${tableName} ON;\n`;
    }
    query += `INSERT INTO dbo.${tableName} (${columns}) VALUES \n${chunk.join(',\n')};\n`;
    if (identityInsert) {
      query += `SET IDENTITY_INSERT dbo.${tableName} OFF;\n`;
    }

    try {
      await pool.query(query);
    } catch (e) {
      console.error(`\n[ERROR] Failed to insert into dbo.${tableName} at chunk starting index ${i}:`);
      console.error(e.message);
      process.exit(1);
    }
  }
  console.log(`    ✓ dbo.${tableName}: ${valueRows.length} rows inserted.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export — called by run_master_schema.js
// ─────────────────────────────────────────────────────────────────────────────
export async function generateAndSeed(pool) {
  const prng = new LCG(42);

  const endDate   = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 30);

  const TOTAL_DAYS       = 365;
  let   globalOrderId    = 100000;
  let   globalOiId       = 100000;
  let   globalKtId       = 100000;
  let   globalResId      = 100000;
  let   globalUserId     = 1000;
  let   globalTimelineId = 1000;
  let   globalLoyaltyId  = 1000;

  // ── IMPORTANT: Include Demo User (ID 15) ───────────────────────────────────
  // Note: user_id 15 is already created by System_Restaurant.sql, so we just add
  // them to the REPEAT_CUSTOMERS pool but DO NOT inject them into allUsers again.
  const REPEAT_CUSTOMERS = [
    { userId: 15, fullName: 'Đặng Quang Phú', email: 'quagphu159@gmail.com', phone: '0964813966', isGenerated: false }
  ];

  // We only track the loyalty points accrued to update CustomerProfiles later
  const customerLoyaltyMap = { 15: 1250 }; // user 15 starts with 1250 from SQL

  // Generate more repeat customers
  for (let i = 0; i < 499; i++) {
    const id  = globalUserId++;
    const idt = makeIdentity(prng, i + 1);
    REPEAT_CUSTOMERS.push({ userId: id, ...idt, isGenerated: true });
    customerLoyaltyMap[id] = 0;
  }

  const allUsers = [];
  const allProfiles = [];
  const allReservations = [];
  const allResTables = [];
  const allTimelines = [];
  const allOrders = [];
  const allOItems = [];
  const allKt = [];
  const allPayments = [];
  const allAudit = [];
  const allSchedules = [];
  const allReviews = [];
  const allLoyaltyTx = [];

  const PH = '$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6';
  
  // Only inject the ones we generated
  for (const rc of REPEAT_CUSTOMERS) {
    if (rc.isGenerated) {
      allUsers.push(`(${rc.userId}, 1, ${escapeSqlString(rc.fullName)}, ${escapeSqlString(rc.email)}, '${rc.phone}', '${PH}', 1, 1, '${startDate.toISOString()}')`);
      allProfiles.push(`(${rc.userId}, ${rc.userId}, 'user_${rc.userId}', 0)`);
    }
  }

  // ── Generate daily data ────────────────────────────────────────────────────
  let currentDate = new Date(startDate);
  let dayCounter  = 0;

  const staffIdMap = { 3: 2, 4: 3, 14: 6 }; // user_id → staff_id

  while (currentDate <= endDate) {
    dayCounter++;
    const dow       = currentDate.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const isFriday  = dow === 5;

    let vol = prng.nextRange(3, 5); // Increased slightly for more data
    if (isFriday || (isWeekend && dow !== 0)) vol = Math.floor(vol * prng.nextRange(15, 20) / 10);
    else if (dow === 0) vol = Math.floor(vol * 1.3);
    vol = Math.floor(vol * (1 + (dayCounter / TOTAL_DAYS) * 0.3));
    if (prng.chance(0.02)) vol *= prng.nextRange(2, 3);
    if (prng.chance(0.05)) vol = Math.max(1, Math.floor(vol * 0.5));

    for (let o = 0; o < vol; o++) {
      const isLunch    = prng.chance(0.5);
      const hour       = isLunch ? prng.nextRange(11, 13) : prng.nextRange(18, 21);
      const minute     = prng.nextRange(0, 59);
      
      const reservationStartAt = new Date(currentDate);
      reservationStartAt.setHours(hour, minute, 0, 0);
      const reservationEndAt = new Date(reservationStartAt.getTime() + 2 * 3600 * 1000);
      
      // Booking time should be earlier than start time (e.g., 2 to 48 hours ago)
      const bookingTime = new Date(reservationStartAt.getTime() - prng.nextRange(2, 48) * 3600 * 1000);

      const now = new Date();
      let isFuture = false;
      let isOngoing = false;
      let isCancelled = prng.chance(0.07);

      if (currentDate.getDate() === endDate.getDate()) {
        if (reservationStartAt > now) {
          isFuture = true;
          isCancelled = false;
        } else if (reservationStartAt <= now && reservationEndAt > now) {
          isOngoing = true;
          isCancelled = false;
        }
      }

      const resStatus = isCancelled ? 'Cancelled'
                      : isFuture ? 'Confirmed'
                      : isOngoing ? 'Dining'
                      : 'Completed';

      // Pick customer: bias 10% heavily towards Demo Customer (userId=15) so they get tons of data
      let customer;
      if (prng.chance(0.1)) {
        customer = REPEAT_CUSTOMERS[0]; // quagphu159
      } else if (prng.chance(0.65)) {
        customer = prng.nextElement(REPEAT_CUSTOMERS);
      } else {
        const uid = globalUserId++;
        const idt = makeIdentity(prng, uid);
        customer  = { userId: uid, ...idt };
        allUsers.push(`(${uid}, 1, ${escapeSqlString(idt.fullName)}, ${escapeSqlString(idt.email)}, '${idt.phone}', '${PH}', 1, 1, '${bookingTime.toISOString()}')`);
        allProfiles.push(`(${uid}, ${uid}, 'user_${uid}', 0)`);
        customerLoyaltyMap[uid] = 0;
      }

      const table     = prng.nextElement(TABLES);
      const partySize = prng.nextRange(1, table.capacity);

      // Reservation
      const resId = globalResId++;
      allReservations.push(`(${resId}, ${customer.userId}, ${escapeSqlString(customer.fullName)}, '${customer.phone}', '${reservationStartAt.toISOString()}', '${reservationEndAt.toISOString()}', ${partySize}, '${resStatus}', '${bookingTime.toISOString()}')`);
      allResTables.push(`(${resId}, ${table.table_id})`);

      // Timelines
      allTimelines.push(`(${globalTimelineId++}, ${resId}, 'PENDING', ${customer.userId}, N'Reservation created', '${bookingTime.toISOString()}')`);
      const confirmedTime = new Date(bookingTime.getTime() + prng.nextRange(10, 60) * 60 * 1000);
      if (confirmedTime < reservationStartAt && (confirmedTime < now || !isFuture)) {
          allTimelines.push(`(${globalTimelineId++}, ${resId}, 'CONFIRMED', ${prng.nextElement(REGULAR_STAFF).user_id}, N'Confirmed by staff', '${confirmedTime.toISOString()}')`);
      }

      if (isCancelled) {
          const cancelledTime = new Date(reservationStartAt.getTime() - prng.nextRange(1, 24) * 3600 * 1000);
          allTimelines.push(`(${globalTimelineId++}, ${resId}, 'CANCELLED', ${customer.userId}, N'Cancelled by customer', '${cancelledTime.toISOString()}')`);
      } else if (!isFuture) {
          allTimelines.push(`(${globalTimelineId++}, ${resId}, 'DINING', ${prng.nextElement(REGULAR_STAFF).user_id}, N'Guest arrived', '${reservationStartAt.toISOString()}')`);
      }

      // Order (only if not future)
      if (!isFuture) {
        const orderId      = globalOrderId++;
        const staffUser    = prng.nextElement(REGULAR_STAFF).user_id;
        let   subtotal     = 0;
        const items        = [];
        const numItems     = prng.nextRange(partySize, partySize * 2);

        for (let i = 0; i < numItems; i++) {
          const dish = prng.nextElement(DISHES);
          const qty  = prng.nextRange(1, 2);
          subtotal  += dish.price * qty;
          items.push({ dish, qty, price: dish.price });
        }

        let discount = 0;
        if (!isCancelled && prng.chance(0.2)) {
          const v = prng.nextElement(VOUCHERS);
          discount = v.discount_type === 'Percent'
            ? subtotal * (v.discount_value / 100)
            : v.discount_value;
          if (discount > subtotal) discount = subtotal;
        }
        const serviceCharge = (subtotal - discount) * 0.05;
        const total         = subtotal - discount + serviceCharge;

        let orderStatus = isCancelled ? 'Cancelled' : isOngoing ? 'Sent To Kitchen' : 'Paid';
        allOrders.push(`(${orderId}, ${resId}, ${table.table_id}, ${customer.userId}, ${staffUser}, 'Dine In', '${orderStatus}', ${subtotal}, ${discount}, ${serviceCharge}, ${total}, '${reservationStartAt.toISOString()}')`);

        // Order Items + Kitchen Tickets
        let ktOffset = 0;
        for (const item of items) {
          const oiId    = globalOiId++;
          const status  = isCancelled ? 'Cancelled' : isOngoing ? 'Preparing' : 'Served';
          allOItems.push(`(${oiId}, ${orderId}, ${item.dish.dish_id}, ${item.qty}, ${item.price}, '${status}')`);

          const ktId     = globalKtId++;
          const sentAt   = new Date(reservationStartAt.getTime() + ktOffset * 1000);
          const startAt  = new Date(sentAt.getTime()  + prng.nextRange(60, 180) * 1000);
          const readyAt  = new Date(startAt.getTime() + prng.nextRange(480, 1200) * 1000);

          if (isCancelled) {
            const cancelAt = new Date(sentAt.getTime() + prng.nextRange(60, 600) * 1000);
            allKt.push(`(${ktId}, ${oiId}, 'Cancelled', 3, '${sentAt.toISOString()}', NULL, NULL, '${cancelAt.toISOString()}')`);
            if (prng.chance(0.3)) {
              const mgr = prng.nextElement(MANAGER_STAFF).user_id;
              allAudit.push(`(${mgr}, ${ktId}, 'KitchenTickets', 'KITCHEN_MANAGER_OVERRIDE_CANCEL', N'{"old_status": "Preparing", "new_status": "Cancelled"}', '127.0.0.1', '${cancelAt.toISOString()}')`);
            }
          } else if (isOngoing) {
            allKt.push(`(${ktId}, ${oiId}, 'Preparing', 3, '${sentAt.toISOString()}', NULL, NULL, NULL)`);
          } else {
            allKt.push(`(${ktId}, ${oiId}, 'Served', 3, '${sentAt.toISOString()}', '${startAt.toISOString()}', '${readyAt.toISOString()}', NULL)`);
          }
          ktOffset += 30;
        }

        // Payment & Loyalty
        if (!isCancelled && !isOngoing) {
          const pmId = prng.chance(0.7) ? prng.nextElement(PAYMENT_METHODS_QR) : PAYMENT_METHOD_CASH;
          const paidAt = new Date(reservationEndAt.getTime() - prng.nextRange(5, 15) * 60 * 1000); // Paid ~10 mins before leaving
          allPayments.push(`(${orderId}, ${pmId}, ${total}, 'Completed', '${paidAt.toISOString()}', '${paidAt.toISOString()}')`);
          
          allTimelines.push(`(${globalTimelineId++}, ${resId}, 'COMPLETED', ${staffUser}, N'Table checked out', '${reservationEndAt.toISOString()}')`);

          // Earn Points (100k = 1 point)
          const earnedPoints = Math.floor(total / 100000);
          if (earnedPoints > 0) {
              allLoyaltyTx.push(`(${globalLoyaltyId++}, ${customer.userId}, ${earnedPoints}, 'Earn', 'Payment', '${orderId}', N'Earned from order #${orderId}', '${paidAt.toISOString()}')`);
              customerLoyaltyMap[customer.userId] = (customerLoyaltyMap[customer.userId] || 0) + earnedPoints;
          }
        }
      }
    }

    // Staff schedules
    for (const s of REGULAR_STAFF) {
      if (prng.chance(0.8)) {
        const shiftId = prng.nextRange(1, 2);
        const sid     = staffIdMap[s.user_id];
        if (sid) {
          allSchedules.push(`(${s.user_id}, ${sid}, ${shiftId}, '${currentDate.toISOString().slice(0, 10)}', 'Present', 1, '${currentDate.toISOString()}', '${currentDate.toISOString()}')`);
        }
      }
    }

    // Monthly performance reviews
    if (currentDate.getDate() === 1) {
      for (const s of REGULAR_STAFF) {
        const rating = prng.chance(0.9) ? prng.nextRange(35, 50) / 10 : prng.nextRange(20, 30) / 10;
        const sid    = staffIdMap[s.user_id];
        if (sid) {
          allReviews.push(`(${sid}, ${rating}, 'Monthly Review', 1, '${currentDate.toISOString().slice(0, 10)}', '${currentDate.toISOString()}')`);
        }
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // ── Execute inserts ────────────────────────────────────────────────────────
  console.log('  Inserting users...');
  await executeInserts(pool, 'UserAccounts', 'user_id, role_id, full_name, email, phone, password_hash, is_active, email_verified, created_at', allUsers, true);

  console.log('  Inserting customer profiles...');
  await executeInserts(pool, 'CustomerProfiles', 'customer_id, user_id, username, loyalty_points', allProfiles, true);

  console.log('  Inserting reservations...');
  await executeInserts(pool, 'Reservations', 'reservation_id, customer_id, contact_name, contact_phone, reservation_start_at, reservation_end_at, guest_count, reservation_status, created_at', allReservations, true);

  console.log('  Inserting reservation tables...');
  await executeInserts(pool, 'ReservationTables', 'reservation_id, table_id', allResTables, false);

  console.log('  Inserting reservation timelines...');
  await executeInserts(pool, 'ReservationTimelines', 'timeline_id, reservation_id, event_type, performed_by, notes, created_at', allTimelines, true);

  console.log('  Inserting orders...');
  await executeInserts(pool, 'Orders', 'order_id, reservation_id, table_id, customer_id, created_by_staff_id, order_type, order_status, subtotal, discount_amount, service_charge, total_amount, created_at', allOrders, true);

  console.log('  Inserting order items...');
  await executeInserts(pool, 'OrderItems', 'order_item_id, order_id, dish_id, quantity, unit_price, item_status', allOItems, true);

  console.log('  Inserting kitchen tickets...');
  await executeInserts(pool, 'KitchenTickets', 'kitchen_ticket_id, order_item_id, kitchen_status, priority_level, sent_at, started_at, ready_at, cancelled_at', allKt, true);

  console.log('  Inserting payments...');
  await executeInserts(pool, 'Payments', 'order_id, payment_method_id, amount_paid, payment_status, paid_at, created_at', allPayments, false);

  console.log('  Inserting audit logs...');
  await executeInserts(pool, 'AuditLogs', 'user_id, target_id, target_table, action_name, new_value_json, ip_address, created_at', allAudit, false);

  console.log('  Inserting staff schedules...');
  await executeInserts(pool, 'StaffSchedules', 'user_id, staff_id, shift_id, work_date, attendance_status, assigned_by, created_at, updated_at', allSchedules, false);

  console.log('  Inserting performance reviews...');
  await executeInserts(pool, 'PerformanceReviews', 'staff_id, rating, notes, reviewed_by, review_date, created_at', allReviews, false);

  console.log('  Inserting loyalty transactions...');
  await executeInserts(pool, 'LoyaltyTransactions', 'transaction_id, customer_id, points, transaction_type, reference_type, reference_id, description, created_at', allLoyaltyTx, true);

  console.log('  Updating customer profile loyalty points...');
  // Update generated profiles
  for (const [uid, points] of Object.entries(customerLoyaltyMap)) {
      if (points > 0) {
          await pool.query(`UPDATE dbo.CustomerProfiles SET loyalty_points = ${points} WHERE user_id = ${uid}`);
      }
  }

  // ── Promotions & Voucher Engine Seed ───────────────────────────────────────
  console.log('  Inserting promotions...');
  const futureEnd = new Date(); futureEnd.setFullYear(futureEnd.getFullYear() + 1);
  const pastStart = new Date(); pastStart.setFullYear(pastStart.getFullYear() - 1);
  const futureEndStr = futureEnd.toISOString();
  const pastStartStr = pastStart.toISOString();
  const nowStr = new Date().toISOString();

  // promotion_name, description, discount_type, discount_value, min_order_value, max_discount,
  // start_at, end_at, is_active, applicable_to, points_required, validity_duration_hours,
  // total_quantity, remaining_quantity, created_by_staff_id, created_at, updated_at
  const promotions = [
    // 1 — Welcome Gift (free, auto-granted on signup)
    `(N'Welcome Gift', N'Chào mừng đến với Phurai! Nhận ngay 50.000đ cho đơn hàng đầu tiên.', N'Fixed', 50000, 0, 50000,
      '${pastStartStr}', '${futureEndStr}', 1, N'Both', 0, 720, 9999, 9990, 1, SYSDATETIME(), SYSDATETIME())`,
    // 2 — Loyal Diner 10% (exchange 500 points)
    `(N'Loyal Diner 10%', N'Đổi 500 điểm lấy voucher giảm 10% cho bữa ăn. Áp dụng cho Order từ 200.000đ.', N'Percent', 10, 200000, 100000,
      '${pastStartStr}', '${futureEndStr}', 1, N'Order', 500, 48, 200, 185, 1, SYSDATETIME(), SYSDATETIME())`,
    // 3 — Reservation Discount 30K (exchange 300 points)
    `(N'Reservation Discount 30K', N'Đổi 300 điểm lấy voucher giảm 30.000đ khi đặt bàn. Áp dụng cho mọi giá trị đặt cọc.', N'Fixed', 30000, 0, 30000,
      '${pastStartStr}', '${futureEndStr}', 1, N'Reservation', 300, 72, 150, 143, 1, SYSDATETIME(), SYSDATETIME())`,
  ];
  await executeInserts(pool, 'Promotions',
    'promotion_name, description, discount_type, discount_value, min_order_value, max_discount, start_at, end_at, is_active, applicable_to, points_required, validity_duration_hours, total_quantity, remaining_quantity, created_by_staff_id, created_at, updated_at',
    promotions, false
  );

  // Get the actual promotion IDs we just inserted
  const [promoRows] = await pool.query(`SELECT TOP 3 promotion_id, promotion_name FROM dbo.Promotions ORDER BY promotion_id ASC`);
  const welcomePromoId = promoRows.find(r => r.promotion_name.startsWith('Welcome'))?.promotion_id;
  const loyalPromoId   = promoRows.find(r => r.promotion_name.startsWith('Loyal'))?.promotion_id;
  const resPromoId     = promoRows.find(r => r.promotion_name.startsWith('Reservation'))?.promotion_id;

    if (welcomePromoId && loyalPromoId && resPromoId) {
    // Seed global PromoCodes pool entries for each promotion
    const globalVouchers = [
      `(${welcomePromoId}, N'WELCOME-PROMO', 9999, 9, 1, SYSDATETIME(), SYSDATETIME())`,
      `(${loyalPromoId},   N'LOYAL10-PROMO', 200,  15, 1, SYSDATETIME(), SYSDATETIME())`,
      `(${resPromoId},     N'RES30K-PROMO',  150,  7,  1, SYSDATETIME(), SYSDATETIME())`,
    ];
    await executeInserts(pool, 'PromoCodes', 'promotion_id, promo_code, usage_limit, times_used, is_active, created_at, updated_at', globalVouchers, false);

    // ── CustomerPromotions for Demo User (user_id=15) ─────────────────────────
    console.log('  Inserting customer promotions for demo user...');
    const in30Days  = new Date(); in30Days.setDate(in30Days.getDate() + 30);
    const in2Days   = new Date(); in2Days.setDate(in2Days.getDate() + 2);
    const pastExp   = new Date(); pastExp.setDate(pastExp.getDate() - 5);

    const customerVouchers = [
      // Active: Welcome gift voucher (30 days)
      `(15, ${welcomePromoId}, 0,   N'WELCOME-U15-A1', N'active', SYSDATETIME(), '${in30Days.toISOString()}', NULL, NULL, NULL)`,
      // Active: Loyal Diner 10% (expires in 2 days — shows urgency in countdown)
      `(15, ${loyalPromoId},   500, N'LOYAL10-U15-A2', N'active', SYSDATETIME(), '${in2Days.toISOString()}', NULL, NULL, NULL)`,
      // Used: Reservation Discount used on demo reservation
      `(15, ${resPromoId},     300, N'RES30K-U15-USED', N'used', SYSDATETIME(), '${in30Days.toISOString()}', SYSDATETIME(), NULL, NULL)`,
      // Expired: Old welcome voucher
      `(15, ${welcomePromoId}, 0,   N'WELCOME-U15-EXP', N'expired', '${pastExp.toISOString()}', '${pastExp.toISOString()}', NULL, NULL, NULL)`,
    ];
    await executeInserts(pool, 'CustomerPromotions',
      'customer_id, promotion_id, points_spent, promo_code, status, redeemed_at, expires_at, used_at, used_in_order_id, used_in_reservation_id',
      customerVouchers, false
    );

    // ── Notifications for Demo User ─────────────────────────────────────────
    console.log('  Inserting notifications for demo user...');
    const notifications = [
      `(15, N'Promotion', N'🎉 Welcome Gift Received!', N'You have received a welcome promo code (WELCOME-U15-A1). Use it on your first order or reservation!', 0, SYSDATETIME())`,
      `(15, N'Promotion', N'⭐ Promo Code Redeemed: Loyal Diner 10%', N'Promo Code LOYAL10-U15-A2 is now active. Expires in 48 hours — apply it at checkout!', 0, SYSDATETIME())`,
      `(15, N'Promotion', N'✅ Promo Code Used: Reservation Discount 30K', N'Promo Code RES30K-U15-USED was applied and saved you 30.000đ on your reservation.', 1, SYSDATETIME())`,
    ];
    await executeInserts(pool, 'Notifications',
      'user_id, notification_type, title, message_body, is_read, sent_at',
      notifications, false
    );
  }

  // ── 100 CustomerReviews ───────────────────────────────────────────────────
  console.log('  Inserting 100 customer reviews with realistic rating distribution...');
  const comments12 = [
    "Worst service ever. We waited 45 minutes for our table.",
    "The meat was cold and tough. Very disappointed.",
    "Too expensive for subpar quality. Service was also inattentive.",
    "Extremely noisy and the table was dirty. Food was cold.",
    "Bad experience. The staff was rude when we complained about the food.",
    "Food was bland and overpriced. Will not return.",
    "Poor customer service. No one checked on our table.",
    "Very slow service, and the food was not cooked properly."
  ];

  const comments3 = [
    "The food was decent but service was quite slow.",
    "Average experience. The atmosphere was good but food was a bit salty.",
    "A bit overpriced for the portion size, but taste was okay.",
    "Decent steak, but nothing special. Ambiance was nice though.",
    "Good drinks, but the main courses took too long to arrive.",
    "Decent experience. Food was okay, service could be improved.",
    "Nothing outstanding, just your average restaurant."
  ];

  const comments45 = [
    "Absolutely stunning. Japanese A5 Wagyu was perfect.",
    "Black Cod Miso was divine. Staff were warm throughout.",
    "Best tasting menu in the city. Every dish was a work of art.",
    "Salmon Mentaiko beautifully presented. Will return for omakase.",
    "Wonderful service and Wagyu was incredibly delicious!",
    "Exquisite dining experience! The ambiance was lovely.",
    "Highly recommend the chef's special. Will definitely come back.",
    "Excellent service and food quality. A must-visit place.",
    "Outstanding dishes, every bite was flavorful.",
    "Attentive staff and great food. The desserts were amazing.",
    "A truly memorable meal. The wagyu beef literally melted in my mouth.",
    "Perfect ambiance for our anniversary. The service was impeccable.",
    "Fabulous food! The presentation was as good as the taste.",
    "Superb experience. Highly professional staff and great flavors."
  ];

  const allCustomerReviews = [];
  for (let i = 0; i < 100; i++) {
    let customerId;
    if (prng.chance(0.1)) {
      customerId = 15; // Demo user user_id=15
    } else {
      customerId = 1000 + i; // Pick generated users starting from 1000
    }

    const roll = prng.next();
    let baseRating;
    if (roll < 0.03) {
      baseRating = 1;
    } else if (roll < 0.10) {
      baseRating = 2;
    } else if (roll < 0.25) {
      baseRating = 3;
    } else if (roll < 0.50) {
      baseRating = 4;
    } else {
      baseRating = 5;
    }

    const getRating = (base) => {
      const noise = prng.nextRange(-1, 1);
      return Math.max(1, Math.min(5, base + noise));
    };

    const food = getRating(baseRating);
    const service = getRating(baseRating);
    const ambiance = getRating(baseRating);
    
    const overall = Math.round((food + service + ambiance) / 3);

    let comment = "NULL";
    if (prng.chance(0.60)) {
      let text = "";
      if (overall <= 2) {
        text = prng.nextElement(comments12);
      } else if (overall === 3) {
        text = prng.nextElement(comments3);
      } else {
        text = prng.nextElement(comments45);
      }
      comment = `N'${text.replace(/'/g, "''")}'`;
    }

    const dateOffsetDays = prng.nextRange(0, 180);
    const reviewDate = new Date();
    reviewDate.setDate(reviewDate.getDate() - dateOffsetDays);
    const dateStr = reviewDate.toISOString();

    allCustomerReviews.push(`(${customerId}, NULL, ${food}, ${service}, ${ambiance}, ${comment}, 1, '${dateStr}')`);
  }

  await pool.query(`DELETE FROM dbo.CustomerReviews`);
  await executeInserts(pool, 'CustomerReviews',
    'customer_id, order_id, food_rating, service_rating, ambiance_rating, comment, is_visible, created_at',
    allCustomerReviews, false
  );

  console.log(`\n  Summary: ${allReservations.length} reservations | ${allOrders.length} orders | ${allPayments.length} payments | ${allTimelines.length} timelines | ${allLoyaltyTx.length} loyalty txns | 100 customer reviews`);
}
