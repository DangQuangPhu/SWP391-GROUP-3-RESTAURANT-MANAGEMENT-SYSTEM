// DELETED

/* ============================================================
   Phūrai — Manager/Manager Dashboard mock fallback data
   ------------------------------------------------------------
   This file holds SAMPLE data used by the /manager portal when a
   real backend endpoint is not yet connected. Structures mirror
   the SQL schema (dbo.Dishes, dbo.RestaurantTables, dbo.Orders,
   dbo.Reservations, dbo.Promotions, dbo.ManagerProfiles, etc.) so a
   real API response can replace it later with minimal changes.

   NOTE: This is frontend-only sample data. Nothing here is written
   to the database. Mutations live in component state only.
   ============================================================ */

export const DEMO_NOTICE =
  "Showing sample operations data. Connect the live API to replace it.";

/* ---- KPI summary (overview cards) ---- */
export const KPI_CARDS = [
  {
    id: "revenue",
    label: "Today Revenue",
    value: 48750000,
    format: "currency",
    icon: "wallet",
    trend: { dir: "up", text: "+18.2% vs yesterday" },
    accent: "gold",
  },
  {
    id: "reservations",
    label: "Reservations Today",
    value: 45,
    format: "number",
    icon: "calendar",
    trend: { dir: "up", text: "+11 new today" },
    accent: "blue",
  },
  {
    id: "occupied",
    label: "Occupied Tables",
    value: 18,
    suffix: " / 28",
    format: "number",
    icon: "grid",
    trend: { dir: "up", text: "64% capacity" },
    accent: "green",
  },
  {
    id: "pendingOrders",
    label: "Pending Orders",
    value: 12,
    format: "number",
    icon: "receipt",
    trend: { dir: "up", text: "+4 since 6pm" },
    accent: "amber",
  },
  {
    id: "kitchen",
    label: "Kitchen Queue",
    value: 8,
    format: "number",
    icon: "fire",
    trend: { dir: "up", text: "3 firing now" },
    accent: "red",
  },
  {
    id: "bestDish",
    label: "Best-selling Dish",
    value: "Wagyu Sukiyaki",
    format: "text",
    icon: "star",
    trend: { dir: "up", text: "124 sold today" },
    accent: "gold",
  },
  {
    id: "promos",
    label: "Active Promotions",
    value: 5,
    format: "number",
    icon: "tag",
    trend: { dir: "flat", text: "2 ending soon" },
    accent: "purple",
  },
  {
    id: "rating",
    label: "Customer Rating",
    value: "4.8",
    suffix: " / 5",
    format: "text",
    icon: "heart",
    trend: { dir: "up", text: "2,547 verified reviews" },
    accent: "green",
  },
];

/* ---- Revenue chart series (day / week / month) ---- */
export const REVENUE_SERIES = {
  day: [
    { label: "10a", value: 1.8 },
    { label: "12p", value: 3.6 },
    { label: "2p", value: 2.9 },
    { label: "4p", value: 4.2 },
    { label: "6p", value: 6.8 },
    { label: "8p", value: 9.4 },
    { label: "10p", value: 8.2 },
  ],
  week: [
    { label: "Mon", value: 28.5 },
    { label: "Tue", value: 32.1 },
    { label: "Wed", value: 34.8 },
    { label: "Thu", value: 38.2 },
    { label: "Fri", value: 44.5 },
    { label: "Sat", value: 52.8 },
    { label: "Sun", value: 48.6 },
  ],
  month: [
    { label: "W1", value: 168 },
    { label: "W2", value: 182 },
    { label: "W3", value: 198 },
    { label: "W4", value: 218 },
  ],
};

/* ---- Reservations mock data (40 entries, spread across recent days) ---- */
function daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10);
}
function todayStr() { return new Date().toISOString().slice(0, 10); }
function daysFromNow(n) {
  const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10);
}

export const RESERVATIONS = SHARED_MOCK_RESERVATIONS;

// RESERVATION_STATUS_META is now exported from src/shared/reservationStatus.js



export const TABLE_STATUS_META = {
  available: { label: "Available", tone: "green" },
  reserved: { label: "Reserved", tone: "blue" },
  occupied: { label: "Occupied", tone: "amber" },
  cleaning: { label: "Cleaning", tone: "purple" },
  inactive: { label: "Inactive", tone: "muted" },
};

export const AREAS = [
  "Main Dining",
  "Window Area",
  "Wine Bar",
  "VIP Lounge",
  "Private Room",
  "Rooftop Terrace",
  "Balcony",
  "Event Corner",
];

/* ---- Dishes (dbo.Dishes + MenuCategories) ---- */
export const DISH_CATEGORIES = menuCategories.map((cat) => cat.name);

export const DISHES = flattenMenuDishes(menuCategories).map((item, index) => ({
  dish_id: item.id || `mock-${index}`,
  dish_name: item.name,
  category_name: item.categoryName,
  price: item.price,
  is_available: true,
  is_recommended: item.recommended || false,
  spicy_level: item.spicy || 0,
  prep_minutes: 15,
  description: item.description,
  image_url: "",
}));

/* ---- Best-selling dishes (revenue ranking) ---- */
export const BEST_SELLERS = (() => {
  const allDishes = flattenMenuDishes(menuCategories);
  const selected = allDishes.slice(0, 7);
  const mockRevenues = [110360000, 129050000, 41160000, 27520000, 27360000, 19040000, 8910000];
  const mockSold = [124, 89, 98, 86, 72, 68, 54];
  return selected.map((item, index) => ({
    rank: index + 1,
    dish_name: item.name,
    qty_sold: mockSold[index],
    revenue: mockRevenues[index],
  }));
})();

/* ---- Active orders (dbo.Orders + OrderItems + KitchenTickets) ---- */
export const ORDERS = [
  { order_id: 5101, order_number: "#A-5101", table_label: "M-02", items_count: 5, total: 2140000, status: "in_progress", kitchen_status: "cooking" },
  { order_id: 5102, order_number: "#A-5102", table_label: "B-03", items_count: 3, total: 980000, status: "in_progress", kitchen_status: "queued" },
  { order_id: 5103, order_number: "#A-5103", table_label: "R-05", items_count: 7, total: 3260000, status: "ready", kitchen_status: "ready" },
  { order_id: 5104, order_number: "#A-5104", table_label: "M-08", items_count: 2, total: 640000, status: "served", kitchen_status: "done" },
  { order_id: 5105, order_number: "#A-5105", table_label: "V-01", items_count: 9, total: 8700000, status: "in_progress", kitchen_status: "cooking" },
  { order_id: 5106, order_number: "#A-5106", table_label: "M-04", items_count: 4, total: 1680000, status: "in_progress", kitchen_status: "cooking" },
  { order_id: 5107, order_number: "#A-5107", table_label: "W-12", items_count: 6, total: 2450000, status: "in_progress", kitchen_status: "queued" },
  { order_id: 5108, order_number: "#A-5108", table_label: "R-06", items_count: 3, total: 1120000, status: "in_progress", kitchen_status: "queued" },
  { order_id: 5109, order_number: "#A-5109", table_label: "P-01", items_count: 12, total: 12400000, status: "in_progress", kitchen_status: "cooking" },
  { order_id: 5110, order_number: "#A-5110", table_label: "B-06", items_count: 2, total: 720000, status: "in_progress", kitchen_status: "queued" },
  { order_id: 5111, order_number: "#A-5111", table_label: "G-08", items_count: 5, total: 1980000, status: "in_progress", kitchen_status: "queued" },
  { order_id: 5112, order_number: "#A-5112", table_label: "M-09", items_count: 4, total: 1560000, status: "in_progress", kitchen_status: "queued" },
];

export const ORDER_STATUS_META = {
  queued: { label: "Queued", tone: "muted" },
  in_progress: { label: "In Progress", tone: "amber" },
  cooking: { label: "Cooking", tone: "red" },
  ready: { label: "Ready", tone: "green" },
  served: { label: "Served", tone: "blue" },
  done: { label: "Done", tone: "muted" },
};

/* ---- Staff roster mock — Restaurant Staff only (dbo.UserAccounts + dbo.Roles) ---- */
/* Note: Kitchen Staff (role_id=3) rows removed — KDS is device-based */
export const MANAGER = [
  { manager_id: 2, full_name: "Tuan Le", role_name: "Restaurant Staff", phone: "0902 345 678", email: "tuan.le@phurai.com", status: "active", shift: "Evening" },
  { manager_id: 4, full_name: "Lan Pham", role_name: "Restaurant Staff", phone: "0904 567 890", email: "lan.pham@phurai.com", status: "on_leave", shift: "Morning" },
  { manager_id: 6, full_name: "Hoa Tran", role_name: "Restaurant Staff", phone: "0906 789 012", email: "hoa.tran@phurai.com", status: "active", shift: "Morning" },
  { manager_id: 8, full_name: "Thuy Dang", role_name: "Restaurant Staff", phone: "0908 901 234", email: "thuy.dang@phurai.com", status: "active", shift: "Evening" },
  { manager_id: 10, full_name: "Linh Do", role_name: "Restaurant Staff", phone: "0910 123 456", email: "linh.do@phurai.com", status: "on_leave", shift: "Morning" },
  { manager_id: 12, full_name: "Mai Le", role_name: "Restaurant Staff", phone: "0912 345 678", email: "mai.le@phurai.com", status: "active", shift: "Morning" },
  { manager_id: 14, full_name: "Thu Vo", role_name: "Restaurant Staff", phone: "0914 567 890", email: "thu.vo@phurai.com", status: "inactive", shift: "Evening" },
  { manager_id: 16, full_name: "Kim Hoang", role_name: "Restaurant Staff", phone: "0916 789 012", email: "kim.hoang@phurai.com", status: "active", shift: "Evening" },
  { manager_id: 18, full_name: "Phuong Bui", role_name: "Restaurant Staff", phone: "0918 901 234", email: "phuong.bui@phurai.com", status: "on_leave", shift: "Morning" },
  { manager_id: 20, full_name: "Ngan Le", role_name: "Restaurant Staff", phone: "0920 123 456", email: "ngan.le@phurai.com", status: "active", shift: "Morning" },
];

/** Roles a Manager may view and manage on /manager (UC-M05). Kitchen Staff removed (deprecated). */
export const STAFF_ASSIGNABLE_ROLES = ["Restaurant Staff"];

export const MANAGER_STATUS_META = {
  active: { label: "Active", tone: "green" },
  on_leave: { label: "On Leave", tone: "amber" },
  inactive: { label: "Inactive", tone: "muted" },
};
export const SHIFTS = ["Morning", "Evening", "Night"];

/* ---- Promotions (dbo.Promotions + Vouchers) ---- */
export const PROMOTIONS = [
  { promo_id: 1, name: "Weekday Lunch 15%", code: "LUNCH15", discount_type: "percent", discount_value: 15, min_order: 300000, start_date: "2026-06-01", end_date: "2026-06-30", status: "active", usage_count: 428 },
  { promo_id: 2, name: "Anniversary Gift", code: "PHURAI2Y", discount_type: "amount", discount_value: 200000, min_order: 1000000, start_date: "2026-06-05", end_date: "2026-06-20", status: "active", usage_count: 186 },
  { promo_id: 3, name: "Rooftop Happy Hour", code: "ROOF20", discount_type: "percent", discount_value: 20, min_order: 0, start_date: "2026-06-01", end_date: "2026-07-15", status: "active", usage_count: 312 },
  { promo_id: 4, name: "VIP Member 10%", code: "VIP10", discount_type: "percent", discount_value: 10, min_order: 500000, start_date: "2026-01-01", end_date: "2026-12-31", status: "active", usage_count: 892 },
  { promo_id: 5, name: "Omakase Pairing", code: "OMAKASE", discount_type: "amount", discount_value: 350000, min_order: 2500000, start_date: "2026-06-10", end_date: "2026-06-25", status: "active", usage_count: 74 },
  { promo_id: 6, name: "New Year Set", code: "NY2026", discount_type: "amount", discount_value: 500000, min_order: 2000000, start_date: "2026-01-01", end_date: "2026-02-15", status: "expired", usage_count: 318 },
  { promo_id: 7, name: "Manager Test Promo", code: "INTERNAL", discount_type: "percent", discount_value: 50, min_order: 0, start_date: "2026-06-01", end_date: "2026-12-31", status: "disabled", usage_count: 4 },
];

export const PROMO_STATUS_META = {
  active: { label: "Active", tone: "green" },
  scheduled: { label: "Scheduled", tone: "blue" },
  expired: { label: "Expired", tone: "muted" },
  disabled: { label: "Disabled", tone: "red" },
};

/* ---- Reports: reservation statistics ---- */
export const RESERVATION_STATS = {
  totalThisMonth: 1248,
  completionRate: 92,
  noShowRate: 4,
  avgPartySize: 3.8,
  byArea: [
    { area: "Main Dining", count: 412 },
    { area: "Window Area", count: 228 },
    { area: "Rooftop Terrace", count: 196 },
    { area: "VIP Lounge", count: 142 },
    { area: "Wine Bar", count: 158 },
    { area: "Private Room", count: 112 },
  ],
};

export const TABLE_UTILIZATION = [
  { area: "Main Dining", utilization: 84 },
  { area: "Window Area", utilization: 78 },
  { area: "Rooftop Terrace", utilization: 88 },
  { area: "VIP Lounge", utilization: 62 },
  { area: "Wine Bar", utilization: 71 },
  { area: "Private Room", utilization: 58 },
];

/* ============================================================
   Daily revenue time-series helpers (2-year mock trend)
   ============================================================ */

/** Real-time today anchor — always the current day. */
export const DASHBOARD_TODAY = new Date();

function pseudoRandom(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Generate daily revenue for the last 2 years ending on `endDate`.
 * @returns {Array<{ date: string, revenue: number }>}
 */
export function generateTwoYearDailyRevenue(endDate = DASHBOARD_TODAY) {
  const totalDays = 730;
  const series = [];
  const floorRevenue = 16_500_000;

  for (let offset = totalDays - 1; offset >= 0; offset -= 1) {
    const date = startOfDay(subDays(endDate, offset));
    const progress = (totalDays - 1 - offset) / (totalDays - 1);
    const growth = 1 + progress * 0.92;
    const day = date.getDay();
    const weekendBoost = day === 0 || day === 5 || day === 6 ? 1.24 : 1;
    const month = date.getMonth();
    const seasonal = 1 + 0.14 * Math.sin((month / 12) * Math.PI * 2 - 0.4);
    const noise = 0.86 + pseudoRandom(offset + 17) * 0.28;
    const revenue = Math.round(floorRevenue * growth * weekendBoost * seasonal * noise);

    series.push({
      date: format(date, "yyyy-MM-dd"),
      revenue,
    });
  }

  return series;
}

export function getDefaultDateRange(today = DASHBOARD_TODAY) {
  return {
    startDate: startOfDay(subDays(today, 29)),
    endDate: endOfDay(today),
    key: "selection",
  };
}

export function filterDailyRevenue(dailySeries, range) {
  if (!Array.isArray(dailySeries) || !range?.startDate || !range?.endDate) return [];

  const start = startOfDay(range.startDate);
  const end = endOfDay(range.endDate);

  return dailySeries.filter((point) => {
    const day = parseISO(point.date);
    return isWithinInterval(day, { start, end });
  });
}

function aggregateWeekly(filtered) {
  if (!filtered.length) return [];

  const start = parseISO(filtered[0].date);
  const end = parseISO(filtered[filtered.length - 1].date);
  const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });

  return weeks.map((weekStart) => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const bucket = filtered.filter((point) => {
      const day = parseISO(point.date);
      return day >= weekStart && day <= weekEnd;
    });
    const revenue = bucket.reduce((sum, point) => sum + point.revenue, 0);
    return {
      date: format(weekStart, "yyyy-MM-dd"),
      label: format(weekStart, "MMM d"),
      revenue,
      value: revenue,
    };
  });
}

export function prepareChartSeries(filtered) {
  if (!filtered.length) return [];

  if (filtered.length > 90) {
    return aggregateWeekly(filtered);
  }

  return filtered.map((point) => ({
    ...point,
    value: point.revenue,
    label: format(parseISO(point.date), filtered.length <= 14 ? "EEE d" : "MMM d"),
  }));
}

export function formatDateRangeLabel(range) {
  if (!range?.startDate || !range?.endDate) return "Select dates";
  const { startDate, endDate } = range;
  if (isSameDay(startDate, endDate)) {
    return format(startDate, "MMMM d, yyyy");
  }
  return `${format(startDate, "MMMM d, yyyy")} - ${format(endDate, "MMMM d, yyyy")}`;
}

export function getDateRangePresets(today = DASHBOARD_TODAY) {
  const end = endOfDay(today);
  return [
    {
      id: "all",
      label: "All Dates",
      range: { startDate: null, endDate: null, key: "selection" },
      startDate: null,
      endDate: null,
    },
    {
      id: "today",
      label: "Today",
      range: { startDate: startOfDay(today), endDate: end, key: "selection" },
      startDate: startOfDay(today),
      endDate: end,
    },
    {
      id: "last7",
      label: "Last 7 days",
      range: { startDate: startOfDay(subDays(today, 6)), endDate: end, key: "selection" },
      startDate: startOfDay(subDays(today, 6)),
      endDate: end,
    },
    {
      id: "last30",
      label: "Last 30 days",
      range: { startDate: startOfDay(subDays(today, 29)), endDate: end, key: "selection" },
      startDate: startOfDay(subDays(today, 29)),
      endDate: end,
    },
    {
      id: "mtd",
      label: "Month to date",
      range: { startDate: startOfMonth(today), endDate: end, key: "selection" },
      startDate: startOfMonth(today),
      endDate: end,
    },
    {
      id: "ytd",
      label: "Year to date",
      range: { startDate: startOfYear(today), endDate: end, key: "selection" },
      startDate: startOfYear(today),
      endDate: end,
    },
    {
      id: "next7",
      label: "Next 7 days",
      range: { startDate: startOfDay(today), endDate: endOfDay(addDays(today, 6)), key: "selection" },
      startDate: startOfDay(today),
      endDate: endOfDay(addDays(today, 6)),
    },
    {
      id: "next30",
      label: "Next 30 days",
      range: { startDate: startOfDay(today), endDate: endOfDay(addDays(today, 29)), key: "selection" },
      startDate: startOfDay(today),
      endDate: endOfDay(addDays(today, 29)),
    },
    {
      id: "all_time",
      label: "All time",
      range: { startDate: null, endDate: null, key: "selection" },
      startDate: null,
      endDate: null,
    },
  ];
}

export function deriveKpisForRange(baseKpis, fullDailySeries, dateRange, reservations = []) {
  const base = Array.isArray(baseKpis) && baseKpis.length ? baseKpis : KPI_CARDS;
  const filtered = filterDailyRevenue(fullDailySeries, dateRange);
  const totalRevenue = filtered.reduce((sum, point) => sum + point.revenue, 0);

  const days = differenceInCalendarDays(dateRange.endDate, dateRange.startDate) + 1;
  const prevEnd = endOfDay(subDays(dateRange.startDate, 1));
  const prevStart = startOfDay(subDays(prevEnd, days - 1));
  const prevFiltered = filterDailyRevenue(fullDailySeries, {
    startDate: prevStart,
    endDate: prevEnd,
    key: "selection",
  });
  const prevRevenue = prevFiltered.reduce((sum, point) => sum + point.revenue, 0);
  const revenueDelta =
    prevRevenue > 0
      ? (((totalRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1)
      : null;

  const rangeStart = startOfDay(dateRange.startDate);
  const rangeEnd = endOfDay(dateRange.endDate);
  const reservationCount = (Array.isArray(reservations) ? reservations : []).filter((row) => {
    if (!row?.reservation_date) return false;
    const day = parseISO(row.reservation_date);
    return isWithinInterval(day, { start: rangeStart, end: rangeEnd });
  }).length;

  const scaledReservations =
    reservationCount > 0 ? reservationCount : Math.max(1, Math.round(45 * (days / 30)));

  const rangeLabel = days === 1 ? "Today" : `${days}-day range`;

  return base.map((kpi) => {
    if (kpi.id === "revenue") {
      return {
        ...kpi,
        value: totalRevenue,
        trend: {
          dir: totalRevenue >= prevRevenue ? "up" : "down",
          text:
            revenueDelta != null
              ? `${revenueDelta}% vs prior ${days}d`
              : "Selected period total",
        },
      };
    }
    if (kpi.id === "reservations") {
      return {
        ...kpi,
        value: scaledReservations,
        trend: { dir: "up", text: `${rangeLabel} · bookings` },
      };
    }
    if (kpi.id === "promos") {
      const activeBoost = days <= 7 ? 0 : days <= 30 ? 0 : 1;
      return {
        ...kpi,
        value: Number(kpi.value) + activeBoost,
        trend: {
          ...kpi.trend,
          text: days >= 30 ? "2 ending soon" : kpi.trend?.text,
        },
      };
    }
    return kpi;
  });
}

/** Expand mock reservations across recent weeks for richer range filtering demos. */
export function expandReservationsForDemo(reservations, today = DASHBOARD_TODAY) {
  if (!Array.isArray(reservations) || !reservations.length) return [];

  const expanded = [...reservations];
  const templates = reservations.slice(0, 5);

  for (let week = 1; week <= 8; week += 1) {
    templates.forEach((template, index) => {
      const date = format(subDays(today, week * 7 + index), "yyyy-MM-dd");
      expanded.push({
        ...template,
        reservation_id: template.reservation_id + week * 100 + index,
        reservation_date: date,
        status: week % 2 === 0 ? "complete paid" : "await check-in",
      });
    });
  }

  return expanded;
}
