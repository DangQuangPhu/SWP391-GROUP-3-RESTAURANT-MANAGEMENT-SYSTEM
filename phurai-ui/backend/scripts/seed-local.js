/**
 * seed-local.js — Native Batched Query Seeder for Local Development
 *
 * Generates 1 year of deterministic, realistic restaurant data and inserts
 * it directly into the database using batched multi-row INSERT statements.
 *
 * Why this is extremely robust:
 *  1. It specifies target columns explicitly, meaning it doesn't care about
 *     column order changes in the physical database schema.
 *  2. Omitted columns with DEFAULT values or NULLs work automatically.
 *  3. Bypasses the strict BCP requirements of request.bulk() which often fail
 *     due to low-level type mapping mismatches.
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
  startDate.setDate(endDate.getDate() - 365);

  const TOTAL_DAYS       = 365;
  let   globalOrderId    = 1000;
  let   globalOiId       = 1000;
  let   globalKtId       = 1000;
  let   globalResId      = 1000;
  let   globalUserId     = 1000;

  // ── Build 500 repeat customers ─────────────────────────────────────────────
  const REPEAT_CUSTOMERS = [];
  for (let i = 0; i < 500; i++) {
    const id  = globalUserId++;
    const idt = makeIdentity(prng, i + 1);
    REPEAT_CUSTOMERS.push({ userId: id, ...idt });
  }

  const allUsers = [];
  const allProfiles = [];
  const allReservations = [];
  const allResTables = [];
  const allOrders = [];
  const allOItems = [];
  const allKt = [];
  const allPayments = [];
  const allAudit = [];
  const allSchedules = [];
  const allReviews = [];

  const PH = '$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6';
  for (const rc of REPEAT_CUSTOMERS) {
    allUsers.push(`(${rc.userId}, 1, ${escapeSqlString(rc.fullName)}, ${escapeSqlString(rc.email)}, '${rc.phone}', '${PH}', 1, 1, '${startDate.toISOString()}')`);
    allProfiles.push(`(${rc.userId}, ${rc.userId}, 'user_${rc.userId}', 0)`);
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

    let vol = prng.nextRange(2, 3);
    if (isFriday || (isWeekend && dow !== 0)) vol = Math.floor(vol * prng.nextRange(15, 20) / 10);
    else if (dow === 0) vol = Math.floor(vol * 1.3);
    vol = Math.floor(vol * (1 + (dayCounter / TOTAL_DAYS) * 0.3));
    if (prng.chance(0.02)) vol *= prng.nextRange(2, 3);
    if (prng.chance(0.05)) vol = Math.max(1, Math.floor(vol * 0.5));

    for (let o = 0; o < vol; o++) {
      const isLunch    = prng.chance(0.5);
      const hour       = isLunch ? prng.nextRange(11, 13) : prng.nextRange(18, 21);
      const minute     = prng.nextRange(0, 59);
      const orderTime  = new Date(currentDate);
      orderTime.setHours(hour, minute, 0, 0);
      const endTime = new Date(orderTime.getTime() + 2 * 3600 * 1000);

      const isCancelled = prng.chance(0.07);

      // Customer
      let customer;
      if (prng.chance(0.65)) {
        customer = prng.nextElement(REPEAT_CUSTOMERS);
      } else {
        const uid = globalUserId++;
        const idt = makeIdentity(prng, uid);
        customer  = { userId: uid, ...idt };
        allUsers.push(`(${uid}, 1, ${escapeSqlString(idt.fullName)}, ${escapeSqlString(idt.email)}, '${idt.phone}', '${PH}', 1, 1, '${orderTime.toISOString()}')`);
        allProfiles.push(`(${uid}, ${uid}, 'user_${uid}', 0)`);
      }

      const table     = prng.nextElement(TABLES);
      const partySize = prng.nextRange(1, table.capacity);

      // Reservation
      const resId = globalResId++;
      allReservations.push(`(${resId}, ${customer.userId}, ${escapeSqlString(customer.fullName)}, '${customer.phone}', '${orderTime.toISOString()}', '${endTime.toISOString()}', ${partySize}, '${isCancelled ? 'Cancelled' : 'Completed'}', '${orderTime.toISOString()}')`);
      allResTables.push(`(${resId}, ${table.table_id})`);

      // Order
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

      allOrders.push(`(${orderId}, ${resId}, ${table.table_id}, ${customer.userId}, ${staffUser}, 'Dine In', '${isCancelled ? 'Cancelled' : 'Paid'}', ${subtotal}, ${discount}, ${serviceCharge}, ${total}, '${orderTime.toISOString()}')`);

      // Order Items + Kitchen Tickets
      let ktOffset = 0;
      for (const item of items) {
        const oiId    = globalOiId++;
        const status  = isCancelled ? 'Cancelled' : 'Served';
        allOItems.push(`(${oiId}, ${orderId}, ${item.dish.dish_id}, ${item.qty}, ${item.price}, '${status}')`);

        const ktId     = globalKtId++;
        const sentAt   = new Date(orderTime.getTime() + ktOffset * 1000);
        const startAt  = new Date(sentAt.getTime()  + prng.nextRange(60, 180) * 1000);
        const readyAt  = new Date(startAt.getTime() + prng.nextRange(480, 1200) * 1000);

        if (isCancelled) {
          const cancelAt = new Date(sentAt.getTime() + prng.nextRange(60, 600) * 1000);
          allKt.push(`(${ktId}, ${oiId}, 'Cancelled', 3, '${sentAt.toISOString()}', NULL, NULL, '${cancelAt.toISOString()}')`);
          if (prng.chance(0.3)) {
            const mgr = prng.nextElement(MANAGER_STAFF).user_id;
            allAudit.push(`(${mgr}, ${ktId}, 'KitchenTickets', 'KITCHEN_MANAGER_OVERRIDE_CANCEL', N'{"old_status": "Preparing", "new_status": "Cancelled"}', '127.0.0.1', '${cancelAt.toISOString()}')`);
          }
        } else {
          allKt.push(`(${ktId}, ${oiId}, 'Served', 3, '${sentAt.toISOString()}', '${startAt.toISOString()}', '${readyAt.toISOString()}', NULL)`);
        }
        ktOffset += 30;
      }

      // Payment
      if (!isCancelled) {
        const pmId = prng.chance(0.7) ? prng.nextElement(PAYMENT_METHODS_QR) : PAYMENT_METHOD_CASH;
        allPayments.push(`(${orderId}, ${pmId}, ${total}, 'Completed', '${orderTime.toISOString()}', '${orderTime.toISOString()}')`);
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

  console.log(`\n  Summary: ${allReservations.length} reservations | ${allOrders.length} orders | ${allPayments.length} payments`);
}
