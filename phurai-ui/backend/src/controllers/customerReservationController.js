import { getRawPool } from "../db.js";
import sql from "mssql";
import { RESERVATION_STATUS } from '../constants/reservationStatus.js';
import { getIO } from "../socket.js";

export const createPreSaveReservation = async (req, res) => {
  try {
    const {
      customer_id,
      contact_name,
      contact_phone,
      contact_email,
      reservation_start_at,
      reservation_end_at,
      durationMinutes,
      guest_count,
      special_request,
      preorder_items = [],
      promo_code,
      table_ids = [],
      dining_purpose,
    } = req.body;

    if (!reservation_start_at || !guest_count || table_ids.length === 0) {
      return res.status(400).json({ success: false, message: "Missing required fields or table_ids" });
    }

    const pool = await getRawPool();
    let items_total = 0;
    let discount_amount = 0;
    let final_total = 0;
    
    // 1. Calculate items total securely from DB
    if (preorder_items && preorder_items.length > 0) {
      for (const item of preorder_items) {
        if (!item.dish_id || !item.quantity || item.quantity < 1) continue;
        const dishResult = await pool.request()
          .input('dish_id', sql.Int, item.dish_id)
          .query(`SELECT price FROM dbo.Dishes WHERE dish_id = @dish_id AND is_available = 1`);
        
        if (dishResult.recordset.length > 0) {
          const price = parseFloat(dishResult.recordset[0].price);
          items_total += price * item.quantity;
          item.unit_price = price; // store explicit verified price
          console.log(`[DEBUG TRACE 1 - PreSave] Added preorder item ${item.dish_id}, qty: ${item.quantity}, unitPrice: ${price}. Current items_total: ${items_total}`);
        } else {
          return res.status(400).json({ success: false, message: `Dish ID ${item.dish_id} is invalid or unavailable.` });
        }
      }
      console.log(`[DEBUG TRACE 2 - PreSave] Finished Preorder Items loop. Final items_total from preorder: ${items_total}`);
    }

    // 2. Validate Promo Code via voucher service (Discount applies ONLY to preorder food items subtotal)
    const BASE_TABLE_DEPOSIT = 20000;

    if (promo_code) {
       const { checkVoucherValidity } = await import("./vouchersController.js");
       // Validate against items_total (the preorder items total only)
       const result = await checkVoucherValidity(promo_code, items_total);
       
       if (!result.isValid) {
         return res.status(400).json({ success: false, message: result.message });
       }
       
       discount_amount = result.discount_amount;
    }

    // 3. Deposit Amount & Final Total Calculation (30% deposit, 70% remaining)
    const net_total = BASE_TABLE_DEPOSIT + Math.max(0, items_total - discount_amount);
    const deposit_amount = Math.round(net_total * 0.3);
    final_total = net_total - deposit_amount;

    console.log(`[AUTOMATION CHECK] Preorder: ${items_total} | Discount: ${discount_amount} | Net Total: ${net_total} | QR Target (30%): ${deposit_amount} | Remaining (70%): ${final_total}`);
    // 4. Generate Order Code (e.g. PHURAI123456)
    const order_code = `PHURAI${Math.floor(100000 + Math.random() * 900000)}`;

    // Calculate end time
    let computed_end_at = reservation_end_at;
    if (!computed_end_at && durationMinutes) {
      const start = new Date(reservation_start_at);
      start.setMinutes(start.getMinutes() + Number(durationMinutes));
      computed_end_at = start;
    } else if (!computed_end_at) {
      const start = new Date(reservation_start_at);
      start.setMinutes(start.getMinutes() + 120);
      computed_end_at = start;
    }

    // 5. Insert into DB with status 'Pending Payment'
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const insertResult = await transaction.request()
        .input('order_code', sql.VarChar(50), order_code)
        .input('customer_id', sql.Int, customer_id || null)
        .input('contact_name', sql.NVarChar(100), contact_name || null)
        .input('contact_phone', sql.NVarChar(20), contact_phone || null)
        .input('contact_email', sql.NVarChar(100), contact_email || null)
        .input('reservation_start_at', sql.DateTime2, reservation_start_at)
        .input('reservation_end_at', sql.DateTime2, computed_end_at)
        .input('guest_count', sql.TinyInt, guest_count)
        .input('special_request', sql.NVarChar(1000), special_request || null)
        .input('dining_purpose', sql.NVarChar(100), dining_purpose || null)
        .input('deposit_amount', sql.Decimal(12, 2), deposit_amount)
        .input('final_total', sql.Decimal(12, 2), final_total)
        .input('applied_promo_code', sql.VarChar(50), promo_code || null)
        .input('reservation_status', sql.NVarChar(25), RESERVATION_STATUS.PENDING_PAYMENT)
        .input('reservation_source', sql.NVarChar(20), 'Online')
        .query(`
          INSERT INTO dbo.Reservations (
            order_code, customer_id, contact_name, contact_phone, contact_email,
            reservation_start_at, reservation_end_at, guest_count, special_request, dining_purpose,
            deposit_amount, final_total, applied_promo_code,
            reservation_status, reservation_source, created_at, updated_at,
            reminder_sent, edit_used_count
          )
          OUTPUT inserted.reservation_id
          VALUES (
            @order_code, @customer_id, @contact_name, @contact_phone, @contact_email,
            @reservation_start_at, @reservation_end_at, @guest_count, @special_request, @dining_purpose,
            @deposit_amount, @final_total, @applied_promo_code,
            @reservation_status, @reservation_source, SYSDATETIME(), SYSDATETIME(),
            0, 0
          )
        `);

      const reservation_id = insertResult.recordset[0].reservation_id;

      // Insert into ReservationTables
      for (const tableId of table_ids) {
        await transaction.request()
          .input('resId', sql.Int, reservation_id)
          .input('tableId', sql.SmallInt, tableId)
          .query(`
            INSERT INTO dbo.ReservationTables (reservation_id, table_id)
            VALUES (@resId, @tableId)
          `);
      }

      // Insert Preorder Items and Orders
      if (preorder_items && preorder_items.length > 0) {
        for (const item of preorder_items) {
          if (!item.dish_id || !item.quantity || item.quantity < 1) continue;
          await transaction.request()
            .input('resId', sql.Int, reservation_id)
            .input('dishId', sql.Int, item.dish_id)
            .input('qty', sql.SmallInt, item.quantity)
            .input('price', sql.Decimal(12, 2), item.unit_price)
            .input('notes', sql.NVarChar(255), item.customization_requests || null)
            .query(`
              INSERT INTO dbo.PreorderItems (reservation_id, dish_id, quantity, unit_price, notes, created_at)
              VALUES (@resId, @dishId, @qty, @price, @notes, SYSDATETIME())
            `);
        }

        const primaryTableId = table_ids.length > 0 ? table_ids[0] : null;
        await transaction.request()
          .input('resId', sql.Int, reservation_id)
          .input('tableId', sql.SmallInt, primaryTableId)
          .input('customerId', sql.Int, customer_id || null)
          .input('subtotal', sql.Decimal(12, 2), items_total)
          .input('totalAmount', sql.Decimal(12, 2), Math.max(0, items_total - discount_amount))
          .query(`
            INSERT INTO dbo.Orders (reservation_id, table_id, customer_id, order_type, order_status, subtotal, total_amount, amount_paid)
            VALUES (@resId, @tableId, @customerId, N'Preorder', N'Open', @subtotal, @totalAmount, 0)
          `);
      }

      const safeValueJson = JSON.stringify({
        reservation_id,
        reservation_status: RESERVATION_STATUS.PENDING_PAYMENT,
        order_code,
        deposit_amount,
        final_total
      });

      await transaction.request()
        .input('userId', sql.Int, customer_id || null)
        .input('actionName', sql.VarChar(100), 'CUSTOMER_INITIATED_RESERVATION')
        .input('targetTable', sql.VarChar(128), 'Reservations')
        .input('targetId', sql.Int, reservation_id)
        .input('newValue', sql.NVarChar(sql.MAX), safeValueJson)
        .query(`
          INSERT INTO dbo.AuditLogs (user_id, action_name, target_table, target_id, new_value_json, created_at)
          VALUES (@userId, @actionName, @targetTable, @targetId, @newValue, SYSDATETIME())
        `);

      await transaction.commit();

    // Emit real-time notification
    try {
      const io = getIO();
      if (io) {
        io.emit("NEW_RESERVATION_REQUEST", {
          reservation_id,
          reservation_status: RESERVATION_STATUS.PENDING_PAYMENT,
          order_code,
          contact_name,
          guest_count,
          reservation_start_at,
          customer_id
        });
      }
    } catch (socketErr) {
      console.warn("Socket emit failed for NEW_RESERVATION_REQUEST", socketErr);
    }

    // 6. Formulate VietQR payload URL
    // Standard template based on the user's previously mentioned VietQR format:
    // https://qr.sepay.vn/img?bank=TPBank&acc=00003942326&amount=10000&des=RES123456&template=&showinfo=true&holder=DANG%20QUANG%20PHU&store=PHURAI%20RESTAURANT
    const vietqr_url = `https://qr.sepay.vn/img?bank=TPBank&acc=00003942326&amount=${deposit_amount}&des=${order_code}&template=&showinfo=true&holder=DANG%20QUANG%20PHU&store=PHURAI%20RESTAURANT`;

    res.status(201).json({
      success: true,
      reservation_id,
      order_code,
      items_total,
      discount_amount,
      deposit_amount,
      final_total,
      vietqr_url
    });

    } catch (transactionError) {
      await transaction.rollback();
      console.error("[pre-save] Transaction error:", transactionError);
      throw transactionError;
    }

  } catch (error) {
    console.error("Error creating pre-save reservation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process reservation payment setup",
      detail: process.env.NODE_ENV !== 'production' ? (error?.message || String(error)) : undefined,
    });
  }
};

export const applyPromoCodeToReservation = async (req, res) => {
  try {
    const reservationId = parseInt(req.params.id, 10);
    const { promo_code } = req.body;
    
    if (isNaN(reservationId) || reservationId <= 0 || !promo_code) {
      return res.status(400).json({ success: false, message: "Invalid input" });
    }

    const pool = await getRawPool();
    const resResult = await pool.request()
      .input('resId', sql.Int, reservationId)
      .query(`
        SELECT reservation_status, final_total, deposit_amount, applied_promo_code 
        FROM dbo.Reservations 
        WHERE reservation_id = @resId
      `);

    if (resResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: "Reservation not found" });
    }

    const reservation = resResult.recordset[0];
    if (reservation.reservation_status !== RESERVATION_STATUS.PENDING_PAYMENT) {
      return res.status(400).json({ success: false, message: "Can only apply promo to Pending Payment reservations" });
    }

    if (reservation.applied_promo_code) {
      return res.status(400).json({ success: false, message: "A promo code has already been applied" });
    }

    const { checkVoucherValidity } = await import("./vouchersController.js");
    
    // Calculate the preorder items total from PreorderItems in the DB
    const itemsTotalResult = await pool.request()
      .input('resId', sql.Int, reservationId)
      .query(`SELECT ISNULL(SUM(quantity * unit_price), 0) AS items_total FROM dbo.PreorderItems WHERE reservation_id = @resId`);
    const preorderItemsTotal = parseFloat(itemsTotalResult.recordset[0].items_total);

    if (preorderItemsTotal <= 0) {
      return res.status(400).json({ success: false, message: "Voucher can only be applied to reservations with food preorder." });
    }

    // Check if it's a customer-redeemed loyalty voucher
    const userVoucherResult = await pool.request()
      .input('code', sql.NVarChar(50), promo_code)
      .input('userId', sql.Int, req.userId || 0)
      .query(`
        SELECT cv.customer_voucher_id, cv.status, cv.expires_at, p.applicable_to, p.discount_type, p.discount_value, p.min_order_value, p.promotion_name
        FROM dbo.CustomerVouchers cv
        JOIN dbo.Promotions p ON cv.promotion_id = p.promotion_id
        WHERE cv.voucher_code = @code AND cv.customer_id = @userId
      `);

    let discount_amount = 0;
    let customerVoucherId = null;
    let promoName = '';

    if (userVoucherResult.recordset.length > 0) {
      const voucher = userVoucherResult.recordset[0];
      
      // Check status
      if (voucher.status !== 'active') {
        return res.status(400).json({ success: false, message: `Voucher is already ${voucher.status}` });
      }

      // Check expiry
      if (new Date(voucher.expires_at) <= new Date()) {
        await pool.request()
          .input('voucherId', sql.Int, voucher.customer_voucher_id)
          .query("UPDATE dbo.CustomerVouchers SET status = N'expired' WHERE customer_voucher_id = @voucherId");
        return res.status(400).json({ success: false, message: "Voucher has expired" });
      }

      // Check applicability
      if (voucher.applicable_to !== 'Both' && voucher.applicable_to !== 'Reservation') {
        return res.status(400).json({ success: false, message: "Voucher is only applicable to Orders" });
      }

      // Check minimum order value
      if (preorderItemsTotal < parseFloat(voucher.min_order_value)) {
        return res.status(400).json({ 
          success: false, 
          message: `Minimum order value of ${parseFloat(voucher.min_order_value).toLocaleString()} VND required to apply this voucher.` 
        });
      }

      // Calculate discount
      if (voucher.discount_type === 'Fixed') {
        discount_amount = parseFloat(voucher.discount_value);
      } else if (voucher.discount_type === 'Percent') {
        discount_amount = preorderItemsTotal * (parseFloat(voucher.discount_value) / 100);
      }
      discount_amount = Math.min(discount_amount, preorderItemsTotal);
      customerVoucherId = voucher.customer_voucher_id;
      promoName = voucher.promotion_name;
    } else {
      // Fallback to traditional promo code check
      const result = await checkVoucherValidity(promo_code, preorderItemsTotal, 'Reservation');
      if (!result.isValid) {
        return res.status(400).json({ success: false, message: result.message });
      }
      discount_amount = Number(result.discount_amount) || 0;
      promoName = result.promo.promotion_name;
    }

    const BASE_TABLE_DEPOSIT = 20000;
    const net_total = BASE_TABLE_DEPOSIT + Math.max(0, preorderItemsTotal - discount_amount);
    const new_deposit_amount = Math.round(net_total * 0.3);
    const new_final_total = net_total - new_deposit_amount;

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      // Update reservation
      await transaction.request()
        .input('resId', sql.Int, reservationId)
        .input('promo', sql.VarChar(50), promo_code)
        .input('voucherId', sql.Int, customerVoucherId)
        .input('newDeposit', sql.Decimal(12,2), new_deposit_amount)
        .input('newFinalTotal', sql.Decimal(12,2), new_final_total)
        .query(`
          UPDATE dbo.Reservations 
          SET applied_promo_code = @promo, 
              applied_voucher_id = @voucherId,
              deposit_amount = @newDeposit, 
              final_total = @newFinalTotal
          WHERE reservation_id = @resId
        `);

      // If it's a customer-redeemed voucher, mark it used
      if (customerVoucherId) {
        await transaction.request()
          .input('voucherId', sql.Int, customerVoucherId)
          .input('resId', sql.Int, reservationId)
          .query(`
            UPDATE dbo.CustomerVouchers
            SET status = N'used',
                used_at = SYSDATETIME(),
                used_in_reservation_id = @resId
            WHERE customer_voucher_id = @voucherId
          `);
      }

      // Sync the preorder total_amount inside dbo.Orders
      await transaction.request()
        .input('resId', sql.Int, reservationId)
        .input('totalAmount', sql.Decimal(12, 2), Math.max(0, preorderItemsTotal - discount_amount))
        .query(`
          UPDATE dbo.Orders 
          SET total_amount = @totalAmount 
          WHERE reservation_id = @resId AND order_type = N'Preorder' AND order_status = 'Open'
        `);

      await transaction.commit();
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }

    return res.json({
      success: true,
      discount_amount,
      new_deposit_amount,
      promotion_name: promoName
    });

  } catch (error) {
    console.error("Error applying promo to reservation:", error);
    res.status(500).json({ success: false, message: "Failed to apply promo code" });
  }
};

export const cancelPendingPayment = async (req, res) => {
  try {
    const reservationId = parseInt(req.params.id, 10);
    const userId = req.userId; // Provided by auth middleware

    if (isNaN(reservationId) || reservationId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid reservation ID" });
    }

    const pool = await getRawPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const resResult = await transaction.request()
        .input('resId', sql.Int, reservationId)
        .input('customerId', sql.Int, userId || null)
        .query(`
          SELECT reservation_status, customer_id 
          FROM dbo.Reservations 
          WHERE reservation_id = @resId 
            AND (customer_id = @customerId OR @customerId IS NULL)
        `);

      if (resResult.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: "Reservation not found or unauthorized" });
      }

      const reservation = resResult.recordset[0];
      if (reservation.reservation_status !== RESERVATION_STATUS.PENDING_PAYMENT) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: "Only 'Pending Payment' reservations can be aborted." });
      }

      await transaction.request()
        .input('resId', sql.Int, reservationId)
        .input('resStatus', sql.NVarChar(25), 'PaymentFailed')
        .input('cancelReason', sql.NVarChar(255), 'Aborted by customer during checkout')
        .query(`
          UPDATE dbo.Reservations 
          SET reservation_status = @resStatus,
              cancel_reason = @cancelReason,
              cancelled_at = SYSDATETIME(),
              updated_at = SYSDATETIME()
          WHERE reservation_id = @resId
        `);

      await transaction.request()
        .input('actionName', sql.VarChar, 'PAYMENT_CANCELLED - Created by: Customer - Manual Abort')
        .input('targetTable', sql.VarChar, 'Reservations')
        .input('targetId', sql.Int, reservationId)
        .input('newValue', sql.VarChar, JSON.stringify({ reservation_status: RESERVATION_STATUS.PAYMENT_FAILED }))
        .query(`
          INSERT INTO dbo.AuditLogs (action_name, target_table, target_id, new_value_json, created_at)
          VALUES (@actionName, @targetTable, @targetId, @newValue, SYSDATETIME());

          INSERT INTO dbo.ReservationTimelines (reservation_id, event_type, performed_by, notes, created_at)
          VALUES (@targetId, 'PAYMENT_FAILED', NULL, 'Aborted by customer during checkout', SYSDATETIME());
        `);

      await transaction.commit();
      return res.json({ success: true, message: "Payment aborted successfully." });

    } catch (dbError) {
      await transaction.rollback();
      throw dbError;
    }

  } catch (error) {
    console.error("Error aborting payment:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

export const submitReservationReview = async (req, res) => {
  try {
    const reservationId = parseInt(req.params.id, 10);
    const { rating, notes } = req.body;
    
    if (isNaN(reservationId) || reservationId <= 0 || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Invalid input" });
    }

    const { getRawPool } = await import("../db.js");
    const sql = (await import("mssql")).default;
    const pool = await getRawPool();
    
    // Attempt to find the customer_id associated with the reservation
    const resResult = await pool.request()
      .input('resId', sql.Int, reservationId)
      .query(`SELECT customer_id FROM dbo.Reservations WHERE reservation_id = @resId`);
      
    if (resResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: "Reservation not found" });
    }
    
    const customer_id = resResult.recordset[0].customer_id;
    
    // Attempt to find an order_id if it exists for this reservation (Preorder order)
    const orderResult = await pool.request()
      .input('resId', sql.Int, reservationId)
      .query(`SELECT TOP 1 order_id FROM dbo.Orders WHERE reservation_id = @resId ORDER BY created_at DESC`);
      
    const order_id = orderResult.recordset.length > 0 ? orderResult.recordset[0].order_id : null;

    await pool.request()
      .input('customerId', sql.Int, customer_id || null)
      .input('resId', sql.Int, reservationId)
      .input('orderId', sql.Int, order_id || null)
      .input('rating', sql.TinyInt, rating)
      .input('notes', sql.NVarChar(1000), notes || '')
      .query(`
        INSERT INTO dbo.CustomerReviews (
          customer_id, reservation_id, order_id, food_rating, service_rating, ambiance_rating, comment, is_visible, created_at
        ) VALUES (
          @customerId, @resId, @orderId, @rating, @rating, @rating, @notes, 1, SYSDATETIME()
        )
      `);

    return res.json({ success: true, message: "Review submitted successfully" });

  } catch (error) {
    console.error("Error submitting reservation review:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};
