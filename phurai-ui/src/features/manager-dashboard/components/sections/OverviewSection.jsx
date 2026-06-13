import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isSameDay } from "date-fns";
import KpiCard from "../KpiCard.jsx";
import RevenueChart from "../RevenueChart.jsx";
import DashboardDateRangePicker from "../shared/DashboardDateRangePicker.jsx";
import Icon from "../ManagerIcons.jsx";
import { Card, StatusBadge, Button } from "../ManagerUI.jsx";
import { formatVND } from "@/utils/formatCurrency.js";
import {
  RESERVATION_STATUS_META,
  TABLE_STATUS_META,
  ORDER_STATUS_META,
  KPI_CARDS,
  DASHBOARD_TODAY,
  deriveKpisForRange,
  expandReservationsForDemo,
  filterDailyRevenue,
  formatDateRangeLabel,
  generateTwoYearDailyRevenue,
  getDateRangePresets,
  getDefaultDateRange,
  prepareChartSeries,
} from "../../data/managerDashboardMockData.js";

const QUICK_ACTIONS = [
  { label: "Add Dish", icon: "dish", view: "dishes", action: "add" },
  { label: "Add Table", icon: "table", view: "tables", action: "add" },
  { label: "Create Promotion", icon: "tag", view: "promotions", action: "add" },
  { label: "Export Report", icon: "download", view: "reports", action: "tab-export" },
  { label: "View Reservations", icon: "calendar", view: "reservations" },
];

function OverviewSection({
  kpis: baseKpisProp,
  reservations,
  tables,
  orders,
  bestSellers,
  role,
  onNavigate,
}) {
  const [dateRange, setDateRange] = useState(() => getDefaultDateRange());
  const [draftRange, setDraftRange] = useState(() => getDefaultDateRange());
  const [activePresetId, setActivePresetId] = useState("last30");
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerAnchorRef = useRef(null);

  const baseKpis = useMemo(
    () => (Array.isArray(baseKpisProp) && baseKpisProp.length ? baseKpisProp : KPI_CARDS),
    [baseKpisProp]
  );

  const dailyRevenueSeries = useMemo(
    () => generateTwoYearDailyRevenue(DASHBOARD_TODAY),
    []
  );

  const demoReservations = useMemo(
    () => expandReservationsForDemo(reservations, DASHBOARD_TODAY),
    [reservations]
  );

  const filteredDailyRevenue = useMemo(
    () => filterDailyRevenue(dailyRevenueSeries, dateRange),
    [dailyRevenueSeries, dateRange]
  );

  const chartSeries = useMemo(
    () => prepareChartSeries(filteredDailyRevenue),
    [filteredDailyRevenue]
  );

  const dateRangeLabel = useMemo(() => formatDateRangeLabel(dateRange), [dateRange]);

  const rangeKpis = useMemo(
    () => deriveKpisForRange(baseKpis, dailyRevenueSeries, dateRange, demoReservations),
    [baseKpis, dailyRevenueSeries, dateRange, demoReservations]
  );

  const chartTotal = useMemo(
    () => chartSeries.reduce((sum, point) => sum + (point.revenue ?? 0), 0),
    [chartSeries]
  );

  const openPicker = useCallback(() => {
    setDraftRange({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      key: "selection",
    });
    setPickerOpen(true);
  }, [dateRange]);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
  }, []);

  const handleApply = useCallback(({ startDate, endDate }) => {
    const next = { startDate, endDate, key: "selection" };
    setDateRange(next);

    const presets = getDateRangePresets(DASHBOARD_TODAY);
    const matched = presets.find(
      (preset) =>
        isSameDay(preset.range.startDate, next.startDate) &&
        isSameDay(preset.range.endDate, next.endDate)
    );
    setActivePresetId(matched?.id ?? "custom");
    setPickerOpen(false);
  }, []);

  const handlePresetSelect = useCallback((preset) => {
    setDraftRange(preset.range);
    setActivePresetId(preset.id);
  }, []);

  useEffect(() => {
    if (!pickerOpen) return undefined;

    const onPointerDown = (event) => {
      if (pickerAnchorRef.current?.contains(event.target)) return;
      setPickerOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [pickerOpen]);

  const safeReservations = Array.isArray(reservations) ? reservations : [];
  const safeTables = Array.isArray(tables) ? tables : [];
  const safeOrders = Array.isArray(orders) ? orders : [];
  const safeBestSellers = Array.isArray(bestSellers) ? bestSellers : [];

  const visibleKpis =
    role === "manager" ? rangeKpis : rangeKpis.filter((k) => k.id !== "revenue");
  const topReservations = safeReservations.slice(0, 5);
  const tableCounts = safeTables.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="sfx-stack">
      <div className="sfx-kpis">
        {visibleKpis.map((card, i) => (
          <KpiCard key={card.id} card={card} index={i} />
        ))}
      </div>

      <div className="sfx-grid sfx-grid--2-1">
        {role === "manager" ? (
          <Card className="sfx-span sfx-card--overflow-visible">
            <div className="sfx-chart-anchor">
              <div className="sfx-chart__head">
                <div>
                  <h3 className="sfx-card__title">Revenue Overview</h3>
                  <p className="sfx-chart__sub">
                    {dateRangeLabel} · {formatVND(chartTotal)} total
                  </p>
                </div>
                <div className="sfx-chart__actions">
                  <div className="sfx-chart__picker-anchor" ref={pickerAnchorRef}>
                    <button
                      type="button"
                      className="sfx-kpi__icon sfx-kpi__icon--trigger"
                      onClick={() => (pickerOpen ? closePicker() : openPicker())}
                      aria-label="Choose date range"
                      aria-expanded={pickerOpen}
                    >
                      <Icon name="calendar" size={18} />
                    </button>
                    {pickerOpen ? (
                      <div className="sfx-dp-popover-shell">
                        <DashboardDateRangePicker
                          draftRange={draftRange}
                          activePresetId={activePresetId}
                          onDraftChange={(selection) => {
                            setDraftRange(selection);
                            setActivePresetId("custom");
                          }}
                          onPresetSelect={handlePresetSelect}
                          onApply={handleApply}
                          onCancel={closePicker}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              <RevenueChart data={chartSeries} showHeader={false} />
            </div>
          </Card>
        ) : null}

        <Card
          title="Quick Actions"
          className={role === "manager" ? "" : "sfx-span"}
        >
          <div className="sfx-quick">
            {QUICK_ACTIONS.map((q) => (
              <button
                key={q.label}
                type="button"
                className="sfx-quick__btn"
                onClick={() => onNavigate(q.view, q.action)}
              >
                <span className="sfx-quick__icon">
                  <Icon name={q.icon} size={18} />
                </span>
                {q.label}
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="sfx-grid sfx-grid--2">
        <Card
          title="Reservation Timeline"
          action={
            <Button variant="ghost" size="sm" onClick={() => onNavigate("reservations")}>
              View all
            </Button>
          }
        >
          <ul className="sfx-timeline">
            {topReservations.map((r) => {
              const meta = RESERVATION_STATUS_META[r.status] || {};
              return (
                <li key={r.reservation_id} className="sfx-timeline__row">
                  <span className="sfx-timeline__time">{r.start_time}</span>
                  <span className="sfx-timeline__main">
                    <strong>{r.customer_name}</strong>
                    <small>
                      {r.party_size} guests · {r.table_label} · {r.area_name}
                    </small>
                  </span>
                  <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card
          title="Table Status Board"
          action={
            <Button variant="ghost" size="sm" onClick={() => onNavigate("tables")}>
              Manage
            </Button>
          }
        >
          <div className="sfx-statusrow">
            {Object.entries(TABLE_STATUS_META).map(([key, meta]) => (
              <div key={key} className="sfx-statusrow__item">
                <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                <strong>{tableCounts[key] || 0}</strong>
              </div>
            ))}
          </div>
          <div className="sfx-tiles">
            {safeTables.slice(0, 12).map((t) => (
              <div key={t.table_id} className={`sfx-tile sfx-tile--${TABLE_STATUS_META[t.status]?.tone}`}>
                <strong>{t.table_number}</strong>
                <small>{t.capacity}p</small>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="sfx-grid sfx-grid--2">
        <Card
          title="Active Orders"
          action={
            <Button variant="ghost" size="sm" onClick={() => onNavigate("orders")}>
              Kitchen
            </Button>
          }
        >
          <div className="sfx-table-wrap">
            <table className="sfx-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Table</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Kitchen</th>
                </tr>
              </thead>
              <tbody>
                {safeOrders.map((o) => (
                  <tr key={o.order_id}>
                    <td>{o.order_number}</td>
                    <td>{o.table_label}</td>
                    <td>{o.items_count}</td>
                    <td>{formatVND(o.total)}</td>
                    <td>
                      <StatusBadge tone={ORDER_STATUS_META[o.kitchen_status]?.tone}>
                        {ORDER_STATUS_META[o.kitchen_status]?.label}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title="Best-selling Dishes"
          action={
            <Button variant="ghost" size="sm" onClick={() => onNavigate("dishes", "tab-best")}>
              Report
            </Button>
          }
        >
          <ul className="sfx-rank">
            {safeBestSellers.map((d) => (
              <li key={d.rank} className="sfx-rank__row">
                <span className="sfx-rank__no">{d.rank}</span>
                <span className="sfx-rank__main">
                  <strong>{d.dish_name}</strong>
                  <small>{d.qty_sold} sold</small>
                </span>
                <span className="sfx-rank__rev">{formatVND(d.revenue)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

export default OverviewSection;
