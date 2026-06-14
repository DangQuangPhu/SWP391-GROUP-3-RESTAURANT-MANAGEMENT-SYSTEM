import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isSameDay } from "date-fns";
import KpiCard from "../KpiCard.jsx";
import RevenueChart from "../RevenueChart.jsx";
import DashboardDateRangePicker from "../shared/DashboardDateRangePicker.jsx";
import Icon from "../ManagerIcons.jsx";
import { Card } from "../ManagerUI.jsx";
import { formatVND } from "@/utils/formatCurrency.js";
import {
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
  { label: "Add Dish", icon: "dish", view: "menu", action: "add" },
  { label: "Add Table", icon: "table", view: "tables", action: "add" },
  { label: "Create Promotion", icon: "tag", view: "promotions", action: "add" },
  { label: "Export Report", icon: "download", view: "reports", action: "tab-export" },
];

function OverviewSection({ kpis: baseKpisProp, reservations, role, onNavigate }) {
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

  const visibleKpis =
    role === "manager" ? rangeKpis : rangeKpis.filter((k) => k.id !== "revenue");

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
    </div>
  );
}

export default OverviewSection;
