import fs from 'fs';
import path from 'path';
import { getRawPool } from '../src/db.js';
import sql from 'mssql';

// --- DETERMINISTIC PRNG ---
// Linear Congruential Generator for reproducible randomness
class LCG {
    constructor(seed) {
        this.seed = seed;
        this.a = 1664525;
        this.c = 1013904223;
        this.m = Math.pow(2, 32);
    }
    next() {
        this.seed = (this.a * this.seed + this.c) % this.m;
        return this.seed / this.m;
    }
    nextRange(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }
    nextElement(arr) {
        return arr[this.nextRange(0, arr.length - 1)];
    }
    chance(probability) {
        return this.next() < probability;
    }
}

const prng = new LCG(42); // Fixed seed for reproducible data

// --- IDENTITY POOLS ---
const SURNAMES = [
    { name: 'Nguyễn', weight: 40 },
    { name: 'Trần', weight: 15 },
    { name: 'Lê', weight: 10 },
    { name: 'Phạm', weight: 7 },
    { name: 'Hoàng', weight: 5 },
    { name: 'Huỳnh', weight: 5 },
    { name: 'Phan', weight: 4 },
    { name: 'Vũ', weight: 4 },
    { name: 'Võ', weight: 4 },
    { name: 'Đặng', weight: 3 },
    { name: 'Bùi', weight: 3 }
];
const MID_NAMES = ['Văn', 'Thị', 'Minh', 'Hữu', 'Thanh', 'Ngọc', 'Quốc', 'Tuấn', 'Đức', 'Phương', 'Bảo', 'Gia'];
const FIRST_NAMES = ['An', 'Bình', 'Châu', 'Dũng', 'Đạt', 'Giang', 'Hùng', 'Hương', 'Khánh', 'Linh', 'Long', 'Mai', 'Nam', 'Nga', 'Phong', 'Quân', 'Sơn', 'Thảo', 'Trang', 'Uyên', 'Vinh', 'Xuân'];
const MOBILE_PREFIXES = ['09', '08', '07', '03', '05'];

function weightedRandom(pool) {
    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
    let random = prng.nextRange(0, totalWeight - 1);
    for (const item of pool) {
        if (random < item.weight) return item;
        random -= item.weight;
    }
    return pool[pool.length - 1];
}

function removeAccents(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

function generateIdentity(index) {
    const surname = weightedRandom(SURNAMES).name;
    const midname = prng.nextElement(MID_NAMES);
    const firstname = prng.nextElement(FIRST_NAMES);
    const fullName = `${surname} ${midname} ${firstname}`;
    const emailBase = removeAccents(fullName.toLowerCase()).replace(/\s/g, '');
    const email = `${emailBase}${index}@gmail.com`;
    const phone = prng.nextElement(MOBILE_PREFIXES) + prng.nextRange(10000000, 99999999);
    return { fullName, email, phone };
}

// Generate customer pool (e.g. 500 repeat customers)
const REPEAT_CUSTOMERS = [];
for (let i = 0; i < 500; i++) {
    REPEAT_CUSTOMERS.push(generateIdentity(i + 1));
}

// --- MAIN SEED SCRIPT ---
export async function runRealisticSeed(pool) {
    console.log("=========================================");
    console.log("🚀 STARTING REALISTIC 2-YEAR DATA SEEDING");
    console.log("=========================================");

    const transaction = new sql.Transaction(pool);
    
    try {
        // Fetch static reference data
        const tablesRes = await pool.request().query("SELECT table_id, table_number, capacity FROM dbo.RestaurantTables WHERE status != 'Inactive'");
        const tables = tablesRes.recordset;
        
        const dishesRes = await pool.request().query("SELECT dish_id, dish_name, current_price FROM dbo.Dishes WHERE is_available = 1");
        const dishes = dishesRes.recordset;

        const staffRes = await pool.request().query("SELECT user_id, role_id FROM dbo.UserAccounts WHERE role_id IN (1, 2, 4, 5)"); // Admins, Managers, Staff
        const staff = staffRes.recordset;
        const managerOrAdminStaff = staff.filter(s => s.role_id === 4 || s.role_id === 5);
        const regularStaff = staff.filter(s => s.role_id === 2);

        const vouchersRes = await pool.request().query("SELECT voucher_id, discount_type, discount_value FROM dbo.Vouchers WHERE status = 'Active'");
        const vouchers = vouchersRes.recordset;

        const paymentMethodsRes = await pool.request().query("SELECT method_id, method_name FROM dbo.PaymentMethods WHERE is_active = 1");
        const paymentMethods = paymentMethodsRes.recordset;
        
        const qrMethods = paymentMethods.filter(p => p.method_name !== 'Cash');
        const cashMethod = paymentMethods.find(p => p.method_name === 'Cash');

        // Prepare Time Loop
        const endDate = new Date(); // Today
        const startDate = new Date();
        startDate.setFullYear(endDate.getFullYear() - 2); // 2 years ago

        const totalDays = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
        let currentDate = new Date(startDate);
        
        let globalOrderId = 1;
        let globalOrderItemId = 1;
        let globalKitchenTicketId = 1;
        let globalReservationId = 1;
        let globalUserId = 100; // Start customer IDs from 100 to avoid collision with staff
        
        let allUsers = [];
        let allProfiles = [];
        let allReservations = [];
        let allOrders = [];
        let allOrderItems = [];
        let allKitchenTickets = [];
        let allPayments = [];
        let allAuditLogs = [];
        let allStaffSchedules = [];
        let allPerformanceReviews = [];
        let allReservationTables = [];

        // Insert repeat customers into user pool first
        for (const rc of REPEAT_CUSTOMERS) {
            const userId = globalUserId++;
            rc.userId = userId;
            allUsers.push(`(${userId}, 1, N'${rc.fullName}', N'${rc.email}', '${rc.phone}', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, '${startDate.toISOString()}')`);
            allProfiles.push(`(${userId}, 0, N'Bronze')`);
        }
        
        let dayCounter = 0;
        console.log(`Starting loop for ~${totalDays} days...`);
        
        while (currentDate <= endDate) {
            dayCounter++;
            if (dayCounter % 30 === 0) {
                console.log(`Seeding month ${Math.round(dayCounter/30)}/24... ~${globalOrderId} orders created`);
            }

            const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
            const isFriday = currentDate.getDay() === 5;
            const isSunday = currentDate.getDay() === 0;
            
            // Base volume: 2 to 3 orders
            let dailyOrderVolume = prng.nextRange(2, 3);
            
            // Weekend multipliers
            if (isFriday || isWeekend && !isSunday) dailyOrderVolume = Math.floor(dailyOrderVolume * prng.nextRange(15, 20) / 10.0); // 1.5x - 2x
            else if (isSunday) dailyOrderVolume = Math.floor(dailyOrderVolume * 1.3);

            // Growth trend (0% at start to 30% at end)
            const growthFactor = 1 + (dayCounter / totalDays) * 0.3;
            dailyOrderVolume = Math.floor(dailyOrderVolume * growthFactor);
            
            // Holiday spikes (Tết, Valentine's, 8/3, etc. simplified for demo by just randomizing some peak days)
            if (prng.chance(0.02)) { // 2% chance of a massive peak day
                dailyOrderVolume = dailyOrderVolume * prng.nextRange(2, 3);
            }
            // Slow days
            if (prng.chance(0.05)) {
                dailyOrderVolume = Math.max(1, Math.floor(dailyOrderVolume * 0.5));
            }

            // Generate orders for the day
            for (let o = 0; o < dailyOrderVolume; o++) {
                const isLunch = prng.chance(0.5);
                
                // Meal time clustering: Lunch 11-14, Dinner 18-22
                let hour, minute = prng.nextRange(0, 59);
                if (isLunch) {
                    hour = prng.nextRange(11, 13);
                } else {
                    hour = prng.nextRange(18, 21);
                    if (isWeekend && prng.chance(0.2)) hour = 22; // Late night tail
                }
                
                const orderTime = new Date(currentDate);
                orderTime.setHours(hour, minute, 0, 0);

                // Is Cancelled? (5-10% chance)
                const isCancelled = prng.chance(0.07);
                const orderStatus = isCancelled ? 'Cancelled' : 'Paid';
                
                // Identify customer (60-70% repeat)
                let customer;
                if (prng.chance(0.65)) {
                    customer = prng.nextElement(REPEAT_CUSTOMERS);
                } else {
                    customer = generateIdentity(globalUserId);
                    const userId = globalUserId++;
                    customer.userId = userId;
                    allUsers.push(`(${userId}, 1, N'${customer.fullName}', N'${customer.email}', '${customer.phone}', N'$2b$10$RIY70dyCRrUSfUJsJGPyluad9hMxx1eYG5vckpjMPxOS/oJvumTz6', 1, 1, '${orderTime.toISOString()}')`);
                    allProfiles.push(`(${userId}, 0, N'Bronze')`);
                }

                // Table and Party Size
                const table = prng.nextElement(tables);
                // Party size constrained by capacity
                const partySize = prng.nextRange(1, table.capacity);

                // Create Reservation (most dine-in have a reservation in this setup)
                const resId = globalReservationId++;
                const resStatus = isCancelled ? 'Cancelled' : 'Completed';
                allReservations.push(`(${resId}, ${customer.userId}, N'${customer.fullName}', '${customer.phone}', '${orderTime.toISOString()}', ${partySize}, N'${resStatus}', NULL, '${orderTime.toISOString()}')`);
                allReservationTables.push(`(${resId}, ${table.table_id})`);

                // Create Order
                const orderId = globalOrderId++;
                const createdByStaff = prng.nextElement(regularStaff).user_id;
                
                // Order Items
                let totalAmount = 0;
                let numItems = prng.nextRange(partySize, partySize * 2); // 1-2 dishes per person
                let currentItems = [];
                for(let i=0; i<numItems; i++) {
                    const dish = prng.nextElement(dishes);
                    const qty = prng.nextRange(1, 2);
                    const price = dish.current_price;
                    totalAmount += price * qty;
                    currentItems.push({ dish, qty, price });
                }

                // Apply Voucher (15-25% chance)
                let discountAmount = 0;
                if (!isCancelled && vouchers.length > 0 && prng.chance(0.2)) {
                    const voucher = prng.nextElement(vouchers);
                    if (voucher.discount_type === 'Percentage') {
                        discountAmount = totalAmount * (voucher.discount_value / 100.0);
                    } else {
                        discountAmount = voucher.discount_value;
                    }
                    if (discountAmount > totalAmount) discountAmount = totalAmount;
                }
                const serviceCharge = (totalAmount - discountAmount) * 0.05; // 5% service
                const finalAmount = totalAmount - discountAmount + serviceCharge;

                allOrders.push(`(${orderId}, ${resId}, ${table.table_id}, ${customer.userId}, ${createdByStaff}, NULL, N'Dine In', N'${orderStatus}', ${totalAmount}, ${discountAmount}, ${serviceCharge}, ${finalAmount}, '${orderTime.toISOString()}')`);

                // Insert OrderItems and KitchenTickets
                let ktOffsetSeconds = 0;
                for (const item of currentItems) {
                    const oiId = globalOrderItemId++;
                    const oiStatus = isCancelled ? 'Cancelled' : 'Served';
                    allOrderItems.push(`(${oiId}, ${orderId}, ${item.dish.dish_id}, ${item.qty}, ${item.price}, NULL, N'${oiStatus}')`);

                    // Kitchen Ticket logic
                    let ktStatus = isCancelled ? 'Cancelled' : 'Served';
                    
                    const ktId = globalKitchenTicketId++;
                    const sentAt = new Date(orderTime.getTime() + ktOffsetSeconds * 1000);
                    const startedAt = new Date(sentAt.getTime() + prng.nextRange(60, 180) * 1000); // 1-3m
                    
                    // Is Overdue?
                    let prepSeconds = prng.nextRange(480, 1200); // 8-20m
                    if (!isCancelled && prng.chance(0.03)) { // 3% overdue
                        prepSeconds = prng.nextRange(1000, 1800); // >15m
                    }
                    const readyAt = new Date(startedAt.getTime() + prepSeconds * 1000);

                    if (isCancelled) {
                        const cancelledAt = new Date(sentAt.getTime() + prng.nextRange(60, 600) * 1000);
                        allKitchenTickets.push(`(${ktId}, ${oiId}, N'Cancelled', 3, NULL, '${sentAt.toISOString()}', NULL, NULL, '${cancelledAt.toISOString()}')`);
                        
                        // Manager override cancellation audit log (30% of cancels)
                        if (prng.chance(0.3)) {
                            const mgr = prng.nextElement(managerOrAdminStaff).user_id;
                            const auditJson = JSON.stringify({ old_status: 'Preparing', new_status: 'Cancelled', actor_type: 'manager_override', cancel_reason: 'Guest changed mind' });
                            allAuditLogs.push(`(${mgr}, ${ktId}, N'KitchenTickets', N'KITCHEN_MANAGER_OVERRIDE_CANCEL', N'${auditJson}', '127.0.0.1', '${cancelledAt.toISOString()}')`);
                        }
                    } else {
                        allKitchenTickets.push(`(${ktId}, ${oiId}, N'Served', 3, NULL, '${sentAt.toISOString()}', '${startedAt.toISOString()}', '${readyAt.toISOString()}', NULL)`);
                    }
                    ktOffsetSeconds += 30; // 30s gap between sending items to kitchen
                }

                // Insert Payment
                if (!isCancelled) {
                    const payMethod = prng.chance(0.7) ? prng.nextElement(qrMethods) : cashMethod; // 70% QR, 30% Cash
                    allPayments.push(`(${orderId}, ${payMethod.method_id}, ${finalAmount}, N'Completed', NULL, '${orderTime.toISOString()}')`);
                }
            } // end day orders

            // HR Data: Generate StaffSchedules every day for staff
            if (prng.chance(1)) { // Ensure some schedule records exist
                for (const s of regularStaff) {
                    if (prng.chance(0.8)) { // 80% attendance
                        const shiftId = prng.nextRange(1, 2);
                        allStaffSchedules.push(`(${s.user_id}, ${s.user_id}, ${shiftId}, '${currentDate.toISOString().split('T')[0]}', N'Present', 1, '${currentDate.toISOString()}', '${currentDate.toISOString()}')`);
                    }
                }
            }

            // HR Data: Generate PerformanceReviews periodically (e.g. 1st of month)
            if (currentDate.getDate() === 1) {
                for (const s of regularStaff) {
                    let rating = prng.chance(0.9) ? prng.nextRange(35, 50)/10.0 : prng.nextRange(20, 30)/10.0;
                    allPerformanceReviews.push(`(${s.user_id}, ${rating}, N'Monthly Review', 1, '${currentDate.toISOString().split('T')[0]}', '${currentDate.toISOString()}')`);
                }
            }
            
            currentDate.setDate(currentDate.getDate() + 1);
        }

        console.log("Data generation complete. Starting bulk inserts...");
        await transaction.begin();

        // Helper to batch insert
        const batchInsert = async (table, columns, valuesList, identityInsert = false) => {
            const BATCH_SIZE = 1000;
            for (let i = 0; i < valuesList.length; i += BATCH_SIZE) {
                const batch = valuesList.slice(i, i + BATCH_SIZE);
                let query = '';
                if (identityInsert) query += `SET IDENTITY_INSERT dbo.${table} ON;\n`;
                query += `INSERT INTO dbo.${table} (${columns}) VALUES \n${batch.join(',\n')};\n`;
                if (identityInsert) query += `SET IDENTITY_INSERT dbo.${table} OFF;\n`;
                await transaction.request().query(query);
            }
        };

        console.log(`Inserting ${allUsers.length} Users/Customers...`);
        await batchInsert('UserAccounts', 'user_id, role_id, full_name, email, phone, password_hash, is_active, email_verified, created_at', allUsers, true);
        await batchInsert('CustomerProfiles', 'customer_id, loyalty_points, tier_name', allProfiles, false);

        console.log(`Inserting ${allReservations.length} Reservations...`);
        await batchInsert('Reservations', 'reservation_id, customer_id, contact_name, contact_phone, reservation_time, guest_count, status, special_requests, created_at', allReservations, true);
        await batchInsert('ReservationTables', 'reservation_id, table_id', allReservationTables, false);

        console.log(`Inserting ${allOrders.length} Orders...`);
        await batchInsert('Orders', 'order_id, reservation_id, table_id, customer_id, created_by_staff_id, qr_session_id, order_type, order_status, subtotal, discount_amount, service_charge, total_amount, created_at', allOrders, true);

        console.log(`Inserting ${allOrderItems.length} OrderItems...`);
        await batchInsert('OrderItems', 'order_item_id, order_id, dish_id, quantity, unit_price, notes, item_status', allOrderItems, true);

        console.log(`Inserting ${allKitchenTickets.length} KitchenTickets...`);
        await batchInsert('KitchenTickets', 'kitchen_ticket_id, order_item_id, kitchen_status, priority_level, assigned_to_staff_id, sent_at, started_at, ready_at, cancelled_at', allKitchenTickets, true);

        console.log(`Inserting ${allPayments.length} Payments...`);
        await batchInsert('Payments', 'order_id, method_id, amount, payment_status, transaction_reference, created_at', allPayments, false);

        console.log(`Inserting ${allAuditLogs.length} AuditLogs...`);
        await batchInsert('AuditLogs', 'user_id, target_id, target_table, action_name, new_value_json, ip_address, created_at', allAuditLogs, false);

        console.log(`Inserting ${allStaffSchedules.length} StaffSchedules...`);
        await batchInsert('StaffSchedules', 'user_id, staff_id, shift_id, work_date, attendance_status, assigned_by, created_at, updated_at', allStaffSchedules, false);

        console.log(`Inserting ${allPerformanceReviews.length} PerformanceReviews...`);
        // Note: performance reviews uses staff_id, let's map user_id to staff_id
        // Staff profiles exist for UserIDs: 2, 3, 4, 5, 6, 14 -> StaffIDs: 1, 2, 3, 4, 5, 6
        // This is safe since we hardcoded this in clean_sql.
        // Wait, PerformanceReviews schema: staff_id (FK to StaffProfiles), rating, notes, reviewed_by, review_date
        const prMapped = allPerformanceReviews.map(pr => {
            const parts = pr.split(',');
            const uid = parseInt(parts[0].replace('(', ''));
            const sid = (uid === 2) ? 1 : (uid === 3) ? 2 : (uid === 4) ? 3 : (uid === 5) ? 4 : (uid === 6) ? 5 : (uid === 14) ? 6 : null;
            return pr.replace(`(${uid},`, `(${sid},`);
        });
        await batchInsert('PerformanceReviews', 'staff_id, rating, notes, reviewed_by, review_date, created_at', prMapped, false);

        await transaction.commit();
        console.log("✅ REALISTIC DATA SEEDING COMPLETE!");
        
        // Post-Seed Data Consistency Validation
        console.log("\n--- RUNNING POST-SEED DATA CONSISTENCY VALIDATION ---");
        const orphansResult = await pool.request().query(`
            SELECT 
                (SELECT COUNT(*) FROM dbo.Orders WHERE order_status NOT IN ('Pending', 'Cancelled') AND order_id NOT IN (SELECT order_id FROM dbo.OrderItems)) as OrdersWithoutItems,
                (SELECT COUNT(*) FROM dbo.OrderItems oi LEFT JOIN dbo.KitchenTickets kt ON oi.order_item_id = kt.order_item_id WHERE kt.kitchen_ticket_id IS NULL) as ItemsWithoutTickets,
                (SELECT COUNT(*) FROM dbo.RestaurantTables WHERE status = 'Occupied' AND table_id NOT IN (SELECT table_id FROM dbo.Orders WHERE order_status NOT IN ('Paid', 'Cancelled'))) as InvalidOccupiedTables
        `);
        console.table(orphansResult.recordset);
        if (orphansResult.recordset[0].OrdersWithoutItems > 0 || orphansResult.recordset[0].ItemsWithoutTickets > 0) {
            console.warn("⚠️ WARNING: Found orphaned states! This should be 0.");
        } else {
            console.log("✅ Data consistency check passed! Zero orphaned states.");
        }

    } catch (err) {
        await transaction.rollback();
        console.error("❌ Seeding failed:", err);
        throw err;
    }
}
