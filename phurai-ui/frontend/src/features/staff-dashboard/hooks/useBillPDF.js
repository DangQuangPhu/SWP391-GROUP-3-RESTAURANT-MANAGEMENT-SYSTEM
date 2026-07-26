/**
 * useBillPDF — Thermal receipt PDF print hook matching professional restaurant standard
 *
 * Modeled after professional receipt layout:
 * - Restaurant Name: PHŪRAI (Premium Japanese-Peruvian Dining)
 * - Metadata: Guest Name, Table ID, Invoice No, Date & Time Range (Start -> End)
 * - Itemized Table: Item | Price | Qty | Total
 * - Calculation Summary:
 *     - Sub-Total
 *     - Voucher / Promo: Code & Discount amount (or "None" if no voucher applied)
 *     - Service Charge / Tax (if any)
 *     - Mode of payment (Cash / QR Pay / VNPAY)
 *     - Final Total (and Original Total if discounted)
 * - Footer: THANK YOU. VISIT AGAIN.
 */

function formatVND(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatDateStr(dateVal) {
  if (!dateVal) return "";
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatTimeStr(dateVal) {
  if (!dateVal) return "";
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function buildReceiptHTML(bill, options = {}) {
  const now = new Date();
  const currentDate = formatDateStr(now);
  const currentTime = formatTimeStr(now);

  // Time range calculation: Session/Reservation start time to current print time
  const startTime = bill.created_at || bill.reservation_start_at || bill.start_time;
  const startStr = startTime ? formatTimeStr(startTime) : currentTime;
  const timeRange = `${startStr} - ${currentTime}`;

  // Customer identity
  const guestName =
    options.customerName ||
    options.verifiedUser?.full_name ||
    bill.contact_name ||
    bill.customer_name ||
    bill.full_name ||
    bill.guest_name ||
    (options.customerEmail ? options.customerEmail : "Walk-in Guest");

  // Table label
  const tableNum = bill.table_number ? `#${bill.table_number}` : "Walk-in";
  const areaName = bill.area_name ? ` (${bill.area_name})` : "";
  const fullTableLabel = `${tableNum}${areaName}`;

  // Invoice Code
  const invoiceNo = `INV-${now.getFullYear()}-${bill.order_id || bill.reservation_id || "001"}`;

  // Items calculation
  const items = bill.items || [];
  const itemRowsHTML = items.length > 0
    ? items.map((item) => {
        const name = item.dish_name || item.name || "Item";
        const price = Number(item.unit_price || item.price || 0);
        const qty = Number(item.quantity || item.qty || 1);
        const lineTotal = price * qty;
        return `
        <tr>
          <td class="col-item">${name}</td>
          <td class="col-price">${formatVND(price)}</td>
          <td class="col-qty">${qty}</td>
          <td class="col-total">${formatVND(lineTotal)}</td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="4" style="text-align:center; color:#777;">No ordered items</td></tr>`;

  // Financial calculations
  const rawSubtotal = items.reduce(
    (sum, i) => sum + Number(i.unit_price || i.price || 0) * Number(i.quantity || i.qty || 1),
    0
  );
  const subtotal = rawSubtotal > 0 ? rawSubtotal : Number(bill.subtotal || bill.total_amount || 0);

  const discountAmount = Number(bill.discount_amount || bill.applied_promo?.discount_amount || 0);
  const promoCode = bill.applied_promo?.promo_code || bill.applied_promo_code || null;
  const promoName = bill.applied_promo?.promotion_name || "";

  const serviceCharge = Number(bill.service_charge || (subtotal * 0.05) || 0);
  const finalTotal = Number(bill.total_amount || (subtotal - discountAmount + serviceCharge));

  let paymentMode = options.paymentMode;
  if (!paymentMode) {
    if (options.paymentMethodId === 1 || bill.payment_method_id === 1 || bill.payment_method === "Cash") {
      paymentMode = "Cash On Delivery (Cash at Table)";
    } else if (options.paymentMethodId === 4 || bill.payment_method_id === 4 || bill.payment_method === "VNPAY") {
      paymentMode = "Payment Online (VNPAY)";
    } else if (bill.order_status === "Paid" || options.paymentMethodId === 2) {
      paymentMode = "Payment Online (SePay / QR)";
    } else {
      paymentMode = "Cash On Delivery";
    }
  }

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8" />
<title>Receipt - ${invoiceNo}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }

  @page {
    size: A4 portrait;
    margin: 10mm 15mm;
  }

  body {
    font-family: 'SF Mono', 'Courier New', Courier, monospace;
    font-size: 13.5px;
    line-height: 1.55;
    width: 100%;
    color: #111;
    background: #fff;
    padding: 0;
    margin: 0;
  }

  .center { text-align: center; }
  .right  { text-align: right; }
  .bold   { font-weight: bold; }

  .header {
    margin-bottom: 12px;
  }

  .brand-title {
    font-family: Georgia, serif;
    font-size: 32px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #000;
    text-transform: uppercase;
  }

  .brand-subtitle {
    font-size: 12px;
    letter-spacing: 0.15em;
    color: #444;
    text-transform: uppercase;
    margin-top: 3px;
  }

  .receipt-tag {
    font-size: 15px;
    font-weight: bold;
    letter-spacing: 0.2em;
    margin: 12px 0 8px;
    text-transform: uppercase;
  }

  .dashed-divider {
    border: none;
    border-top: 1.5px dashed #333;
    margin: 10px 0;
  }

  .meta-grid {
    display: table;
    width: 100%;
    font-size: 13.5px;
    margin: 8px 0;
  }

  .meta-row {
    display: table-row;
  }

  .meta-cell-left {
    display: table-cell;
    text-align: left;
    padding: 4px 0;
  }

  .meta-cell-right {
    display: table-cell;
    text-align: right;
    padding: 4px 0;
  }

  /* Table styling */
  table.items-table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0;
    font-size: 13.5px;
  }

  table.items-table th {
    font-size: 13px;
    text-transform: uppercase;
    border-bottom: 1.5px dashed #333;
    padding: 8px 0;
  }

  table.items-table td {
    padding: 8px 0;
    vertical-align: top;
  }

  .col-item  { text-align: left; width: 45%; word-break: break-word; }
  .col-price { text-align: right; width: 20%; }
  .col-qty   { text-align: center; width: 12%; }
  .col-total { text-align: right; width: 23%; }

  /* Summary Section */
  .summary-box {
    margin-top: 10px;
    font-size: 14px;
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
  }

  .summary-row.total-row {
    font-size: 18px;
    font-weight: bold;
    border-top: 1.5px dashed #333;
    border-bottom: 1.5px dashed #333;
    padding: 10px 0;
    margin-top: 8px;
  }

  .promo-tag {
    color: #15803d;
    font-weight: bold;
  }

  .footer {
    text-align: center;
    margin-top: 20px;
    font-size: 12px;
    color: #444;
    line-height: 1.8;
    letter-spacing: 0.08em;
  }

  @media print {
    html, body {
      width: 100%;
      margin: 0;
      padding: 0;
    }
  }
</style>
</head>
<body>
  <div class="header center">
    <div class="brand-title">Phūrai</div>
    <div class="brand-subtitle">Premium Japanese-Peruvian Dining</div>
    <div class="receipt-tag">RECEIPT</div>
  </div>

  <hr class="dashed-divider" />

  <div class="meta-grid">
    <div class="meta-row">
      <span class="meta-cell-left">Name: <strong class="bold">${guestName}</strong></span>
      <span class="meta-cell-right">Invoice No: <strong class="bold">${invoiceNo}</strong></span>
    </div>
    <div class="meta-row">
      <span class="meta-cell-left">Table: <strong class="bold">${fullTableLabel}</strong></span>
      <span class="meta-cell-right">Date: <strong>${currentDate}</strong></span>
    </div>
    <div class="meta-row">
      <span class="meta-cell-left">Time: <strong>${timeRange}</strong></span>
      <span class="meta-cell-right">Mode: <strong class="bold">${paymentMode}</strong></span>
    </div>
  </div>

  <hr class="dashed-divider" />

  <table class="items-table">
    <thead>
      <tr>
        <th class="col-item">Item</th>
        <th class="col-price">Price</th>
        <th class="col-qty">Qty</th>
        <th class="col-total">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRowsHTML}
    </tbody>
  </table>

  <hr class="dashed-divider" />

  <div class="summary-box">
    <div class="summary-row">
      <span>Sub-Total:</span>
      <span>${formatVND(subtotal)}</span>
    </div>

    <div class="summary-row">
      <span>Voucher / Promo:</span>
      <span class="${promoCode ? 'promo-tag' : ''}">
        ${promoCode ? `${promoCode} (-${formatVND(discountAmount)})` : 'None'}
      </span>
    </div>

    ${serviceCharge > 0 ? `
    <div class="summary-row">
      <span>Service Charge (5%):</span>
      <span>${formatVND(serviceCharge)}</span>
    </div>` : ''}

    ${discountAmount > 0 ? `
    <div class="summary-row" style="color:#666; font-size:9.5px;">
      <span>Original Total:</span>
      <span style="text-decoration: line-through;">${formatVND(subtotal + serviceCharge)}</span>
    </div>` : ''}

    <div class="summary-row total-row">
      <span>Total Amount:</span>
      <span>${formatVND(finalTotal)}</span>
    </div>
  </div>

  <div class="footer center">
    THANK YOU. VISIT AGAIN.<br />
    🍱 PHŪRAI RESTAURANT 🍱<br />
    Printed: ${currentDate} ${currentTime}
  </div>
</body>
</html>`;
}

/**
 * Print a bill as a professional thermal receipt PDF via browser native print dialog.
 * @param {object} bill — bill object
 * @param {object} [options] — optional customer email / payment mode
 */
export function printBillAsPDF(bill, options = {}) {
  if (!bill) return;

  const html = buildReceiptHTML(bill, options);

  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;top:-9999px;left:-9999px;width:80mm;height:1px;border:none;visibility:hidden;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  iframe.contentWindow.onload = () => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 2000);
  };

  iframe.contentWindow.addEventListener("afterprint", () => {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  });
}

export function useBillPDF() {
  return { printBill: printBillAsPDF };
}

export default useBillPDF;
