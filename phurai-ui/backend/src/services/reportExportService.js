import { query } from "../config/db.js";

// Ensure date ranges are safely parsed
function parseDateParams(dateRange) {
  const from = dateRange?.from ? new Date(dateRange.from) : new Date(0);
  const to = dateRange?.to ? new Date(dateRange.to) : new Date();
  
  // Set to end of day for the "to" date to include all records on that day
  to.setHours(23, 59, 59, 999);
  
  return { from, to };
}

const ALLOWED_AREAS = [
  "Window Area", "Standard Area", "Premium Area", "VIP Lounge", 
  "Private Room", "Kitchen View", "Rooftop Outdoor", "Wine Bar", 
  "Event Corner", "Rooftop Terrace"
];

function buildWhitelistedFilterConditions(intentFilters, customerTypeFilter, params) {
  let extraSql = "";
  
  // Customer Type filter
  const custType = intentFilters?.customer_type || customerTypeFilter;
  if (custType === "walkin") {
    extraSql += " AND r.reservation_source = N'Walk-in'";
  } else if (custType === "reservation_system") {
    extraSql += " AND (r.reservation_source = N'Online' OR r.reservation_source = N'Phone')";
  }

  // Area filter
  if (intentFilters?.area_name && ALLOWED_AREAS.includes(intentFilters.area_name)) {
    extraSql += " AND a.area_name = @area_name";
    params.area_name = intentFilters.area_name;
  }

  // Table filter
  if (intentFilters?.table_id && typeof intentFilters.table_id === 'number' && Number.isFinite(intentFilters.table_id)) {
    extraSql += " AND t.table_id = @table_id";
    params.table_id = intentFilters.table_id;
  }

  return extraSql;
}

export async function fetchReportData(intent) {
  const { report_type, date_range, customer_type_filter, filters, columns_requested, include_grand_total } = intent;
  const { from, to } = parseDateParams(date_range);

  let dataset = [];
  let grandTotalRow = null;

  if (report_type === "revenue_summary") {
    const sql = `
      SELECT 
        CAST(created_at AS DATE) as date,
        COUNT(order_id) as total_orders,
        SUM(total_amount) as total_amount
      FROM Orders
      WHERE order_status = N'Paid' 
        AND created_at >= @from AND created_at <= @to
      GROUP BY CAST(created_at AS DATE)
      ORDER BY date ASC
    `;
    const res = await query(sql, { from, to });
    dataset = res.map(row => {
      const d = new Date(row.date);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return {
        date: dateStr,
        total_orders: row.total_orders,
        total_amount: row.total_amount
      };
    });

    const sumOrders = dataset.reduce((acc, row) => acc + Number(row.total_orders || 0), 0);
    const sumAmount = dataset.reduce((acc, row) => acc + Number(row.total_amount || 0), 0);
    grandTotalRow = { date: "TỔNG CỘNG", total_orders: sumOrders, total_amount: sumAmount };

  } else if (report_type === "reservation_stats") {
    const params = { from, to };
    const filterSql = buildWhitelistedFilterConditions(filters, customer_type_filter, params);
    const sql = `
      SELECT 
        reservation_source as customer_type,
        COUNT(reservation_id) as total_reservations,
        SUM(guest_count) as total_guests
      FROM Reservations r
      WHERE reservation_start_at >= @from AND reservation_start_at <= @to
        ${filterSql}
      GROUP BY reservation_source
    `;
    const res = await query(sql, params);
    dataset = res;

    const sumReservations = dataset.reduce((acc, row) => acc + Number(row.total_reservations || 0), 0);
    const sumGuests = dataset.reduce((acc, row) => acc + Number(row.total_guests || 0), 0);
    grandTotalRow = { customer_type: "TỔNG CỘNG", total_reservations: sumReservations, total_guests: sumGuests };

  } else if (report_type === "top_dishes") {
    const sql = `
      SELECT TOP 50
        d.dish_name,
        SUM(oi.quantity) as total_quantity_sold,
        SUM(oi.line_total) as total_amount
      FROM OrderItems oi
      JOIN Orders o ON oi.order_id = o.order_id
      JOIN Dishes d ON oi.dish_id = d.dish_id
      WHERE o.order_status = N'Paid' 
        AND o.created_at >= @from AND o.created_at <= @to
      GROUP BY d.dish_name
      ORDER BY total_amount DESC
    `;
    const res = await query(sql, { from, to });
    dataset = res;

    const sumQty = dataset.reduce((acc, row) => acc + Number(row.total_quantity_sold || 0), 0);
    const sumAmount = dataset.reduce((acc, row) => acc + Number(row.total_amount || 0), 0);
    grandTotalRow = { dish_name: "TỔNG CỘNG", total_quantity_sold: sumQty, total_amount: sumAmount };

  } else if (report_type === "revenue_detail" || report_type === "custom_filtered") {
    const params = { from, to };
    const filterSql = buildWhitelistedFilterConditions(filters, customer_type_filter, params);

    const sql = `
      SELECT 
        r.reservation_id,
        r.contact_name as customer_name,
        CAST(o.created_at AS DATE) as date,
        CAST(o.created_at AS TIME) as time,
        t.table_number as table_id,
        a.area_name,
        o.total_amount,
        r.reservation_source as customer_type,
        o.order_id
      FROM Orders o
      LEFT JOIN Reservations r ON o.reservation_id = r.reservation_id
      JOIN RestaurantTables t ON o.table_id = t.table_id
      LEFT JOIN RestaurantAreas a ON t.area_id = a.area_id
      WHERE o.order_status = N'Paid' 
        AND o.created_at >= @from AND o.created_at <= @to
        ${filterSql}
      ORDER BY o.created_at DESC
    `;
    const res = await query(sql, params);
    
    // Fetch items separately for simplicity to avoid row duplication, then map
    const orderIds = res.map(row => row.order_id);
    let itemsMap = {};
    if (orderIds.length > 0) {
      const itemsSql = `
        SELECT oi.order_id, d.dish_name, oi.quantity 
        FROM OrderItems oi
        JOIN Dishes d ON oi.dish_id = d.dish_id
        WHERE oi.order_id IN (${orderIds.join(",")})
      `;
      // Using IN clause dynamically is safe here since orderIds are numeric from our DB
      const itemsRes = await query(itemsSql, {});
      itemsRes.forEach(item => {
        if (!itemsMap[item.order_id]) itemsMap[item.order_id] = [];
        itemsMap[item.order_id].push(`${item.dish_name} (x${item.quantity})`);
      });
    }

    dataset = res.map(row => {
      // Format date and time
      const dateObj = new Date(row.date);
      const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      
      let timeStr = "";
      if (row.time) {
         // row.time is a Date object returned by mssql for TIME types, starting from 1970-01-01
         const t = new Date(row.time);
         timeStr = `${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`;
      }

      // Aggregate items
      const items = itemsMap[row.order_id] || [];
      const order_item = items.length > 3 
        ? items.slice(0, 3).join(", ") + ` (+${items.length - 3} món khác)`
        : items.join(", ");
        
      // customer_type label logic
      const custType = (row.customer_type === "Walk-in" || !row.customer_type) ? "Walk-in" : "Reservation-System";

      const fullRow = {
        reservation_id: row.reservation_id,
        customer_name: row.customer_name || "Khách lẻ",
        date: dateStr,
        time: timeStr,
        table_id: row.table_id,
        order_item: order_item,
        total_amount: row.total_amount,
        customer_type: custType
      };

      // Project only requested columns if it's custom_filtered
      if (report_type === "custom_filtered" && columns_requested && columns_requested.length > 0) {
        const projected = {};
        for (const col of columns_requested) {
          if (fullRow[col] !== undefined) {
            projected[col] = fullRow[col];
          }
        }
        // Always ensure total_amount exists if grand total is requested
        if (include_grand_total && !projected.total_amount && fullRow.total_amount !== undefined) {
           projected.total_amount = fullRow.total_amount;
        }
        return projected;
      }
      
      return fullRow;
    });

    const sum = dataset.reduce((acc, row) => acc + Number(row.total_amount || 0), 0);
    grandTotalRow = { customer_name: "TỔNG CỘNG", total_amount: sum };
  }

  return { dataset, grandTotalRow };

  return { dataset, grandTotalRow };
}
