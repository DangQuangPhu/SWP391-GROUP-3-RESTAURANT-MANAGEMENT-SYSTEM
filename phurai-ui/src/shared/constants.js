// Trigger HMR
import { menuCategories } from "../features/menu/data/menuData.js";
export * from "./reservationStatus.js";
import { format, subDays, startOfDay, endOfDay, isSameDay, isWithinInterval, addDays, startOfMonth, endOfMonth, subMonths } from "date-fns";

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

export const DISH_CATEGORIES = menuCategories.map((cat) => cat.name);

export const ORDER_STATUS_META = {
  queued: { label: "Queued", tone: "muted" },
  in_progress: { label: "In Progress", tone: "amber" },
  cooking: { label: "Cooking", tone: "red" },
  ready: { label: "Ready", tone: "green" },
  served: { label: "Served", tone: "blue" },
  done: { label: "Done", tone: "muted" },
};

export const STAFF_ASSIGNABLE_ROLES = ["Restaurant Staff", "Kitchen Staff"];

export const MANAGER_STATUS_META = {
  active: { label: "Active", tone: "green" },
  inactive: { label: "Inactive", tone: "muted" },
  on_leave: { label: "On Leave", tone: "amber" },
};

export const SHIFTS = ["Morning", "Evening", "Night"];

export const PROMO_STATUS_META = {
  active: { label: "Active", tone: "green" },
  scheduled: { label: "Scheduled", tone: "blue" },
  expired: { label: "Expired", tone: "muted" },
};

export const DASHBOARD_TODAY = new Date();

export const KPI_CARDS = [];
export const REVENUE_SERIES = { day: [], week: [], month: [] };
export const DISHES = [];
export const BEST_SELLERS = [];
export const ORDERS = [];
export const MANAGER = [];
export const PROMOTIONS = [];
export const RESERVATION_STATS = {
  total: 0, completed: 0, cancelled: 0, noShow: 0,
  upcoming: 0, pending: 0, seated: 0
};
export const TABLE_UTILIZATION = [];
export const DEMO_NOTICE = "Live data mode activated.";

export const RESERVATIONS = [];
export const KITCHEN_TICKETS = [];
export const QUEUE_RESERVATIONS = [];
export const STAFF_KDS_DELAYED = [];
export const STAFF_KDS_READY = [];
export const STAFF_MENU_DISHES = [];
export const STAFF_ORDERS = [];
export const STAFF_REPORT_AUDIT = [];
export const STAFF_REPORT_SUMMARY = {};
export function getMockPaymentBill() { return {}; }

export function getDateRangePresets(today) {
  return [
    { id: "allDates", label: "All Dates", range: { startDate: null, endDate: null, key: "selection" } },
    { id: "today", label: "Today", range: { startDate: startOfDay(today), endDate: endOfDay(today), key: "selection" } },
    { id: "yesterday", label: "Yesterday", range: { startDate: startOfDay(subDays(today, 1)), endDate: endOfDay(subDays(today, 1)), key: "selection" } },
    { id: "last7", label: "Last 7 Days", range: { startDate: startOfDay(subDays(today, 6)), endDate: endOfDay(today), key: "selection" } },
    { id: "last30", label: "Last 30 Days", range: { startDate: startOfDay(subDays(today, 29)), endDate: endOfDay(today), key: "selection" } },
    { id: "thisMonth", label: "This Month", range: { startDate: startOfMonth(today), endDate: endOfMonth(today), key: "selection" } },
    { id: "lastMonth", label: "Last Month", range: { startDate: startOfMonth(subMonths(today, 1)), endDate: endOfMonth(subMonths(today, 1)), key: "selection" } },
  ];
}

export function getDefaultDateRange(today) {
  return {
    startDate: startOfDay(subDays(today, 29)),
    endDate: endOfDay(today),
    key: "selection"
  };
}

export function formatDateRangeLabel(range) {
  if (!range || !range.startDate || !range.endDate) return "All Dates";
  if (isSameDay(range.startDate, range.endDate)) return format(range.startDate, "MMM d, yyyy");
  return `${format(range.startDate, "MMM d, yyyy")} - ${format(range.endDate, "MMM d, yyyy")}`;
}

export function generateTwoYearDailyRevenue(today) {
  const series = [];
  let current = subDays(today, 730);
  while (current <= today) {
    series.push({
      date: format(current, "yyyy-MM-dd"),
      dateObj: current,
      revenue: Math.floor(Math.random() * 10000000) + 5000000,
      reservations: Math.floor(Math.random() * 50) + 10,
    });
    current = addDays(current, 1);
  }
  return series;
}

export function filterDailyRevenue(series, range) {
  if (!range || !range.startDate || !range.endDate) return series;
  return series.filter(item => {
    return isWithinInterval(item.dateObj, { start: startOfDay(range.startDate), end: endOfDay(range.endDate) });
  });
}

export function prepareChartSeries(filteredSeries) {
  return filteredSeries.map(item => ({
    name: format(item.dateObj, "MMM dd"),
    revenue: item.revenue,
    reservations: item.reservations
  }));
}

export function expandReservationsForDemo(reservations, today) {
  return reservations || [];
}

export function deriveKpisForRange(baseKpis, dailyRevenueSeries, dateRange, demoReservations) {
  if (!baseKpis) return [];
  const filtered = filterDailyRevenue(dailyRevenueSeries, dateRange);
  const totalRev = filtered.reduce((sum, item) => sum + item.revenue, 0);
  const totalRes = filtered.reduce((sum, item) => sum + item.reservations, 0);
  
  return baseKpis.map(kpi => {
    if (kpi.id === "revenue") return { ...kpi, value: totalRev, label: "Total Revenue" };
    if (kpi.id === "reservations") return { ...kpi, value: totalRes };
    return kpi;
  });
}
