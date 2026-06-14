import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import RevenueChart from "../RevenueChart.jsx";
import KpiCard from "../KpiCard.jsx";
import Icon from "../ManagerIcons.jsx";
import {
  SectionHead,
  Card,
  StatusBadge,
  NotConnectedNote,
} from "../ManagerUI.jsx";
import {
  RESERVATION_STATUS_META,
  DASHBOARD_TODAY,
  deriveKpisForRange,
  filterDailyRevenue,
  formatDateRangeLabel,
  generateTwoYearDailyRevenue,
  getDefaultDateRange,
  prepareChartSeries,
} from "../../data/managerDashboardMockData.js";
import { formatVND } from "@/utils/formatCurrency.js";
import { getReportsTabFromSearch, REPORT_TAB_IDS } from "../../config/managerRoutes.js";

const TABS = [
  { id: "revenue", label: "Revenue Dashboard" },
  { id: "reservations", label: "Reservation Report" },
  { id: "stats", label: "Reservation Statistics" },
  { id: "export", label: "Export & View" },
];

function ReportsSection({
  kpis,
  reservations,
  bestSellers,
  stats,
  utilization,
  toast,
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = useMemo(
    () => getReportsTabFromSearch(`?${searchParams.toString()}`),
    [searchParams]
  );

  const dateRange = useMemo(() => getDefaultDateRange(DASHBOARD_TODAY), []);
  const dailyRevenueSeries = useMemo(
    () => generateTwoYearDailyRevenue(DASHBOARD_TODAY),
    []
  );
  const chartSeries = useMemo(() => {
    const filtered = filterDailyRevenue(dailyRevenueSeries, dateRange);
    return prepareChartSeries(filtered);
  }, [dailyRevenueSeries, dateRange]);
  const dateRangeLabel = useMemo(() => formatDateRangeLabel(dateRange), [dateRange]);
  const rangeKpis = useMemo(
    () => deriveKpisForRange(kpis, dailyRevenueSeries, dateRange, reservations),
    [kpis, dailyRevenueSeries, dateRange, reservations]
  );

  const selectTab = (nextTab) => {
    if (!REPORT_TAB_IDS.includes(nextTab)) return;
    if (nextTab === "revenue") {
      setSearchParams({}, { replace: true });
      return;
    }
    setSearchParams({ tab: nextTab }, { replace: true });
  };

  const revenueKpis = rangeKpis.filter((k) => ["revenue", "reservations", "promos", "rating"].includes(k.id));

  return (
    <div className="sfx-stack">
      <SectionHead title="Reports" subtitle="Revenue, statistics and exports" />

      <div className="sfx-tabs" role="tablist" aria-label="Report sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`sfx-tab ${tab === t.id ? "is-active" : ""}`}
            onClick={() => selectTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "revenue" ? (
        <div className="sfx-stack">
          <div className="sfx-kpis">
            {revenueKpis.map((c, i) => (
              <KpiCard key={c.id} card={c} index={i} />
            ))}
          </div>
          <Card>
            <RevenueChart
              data={chartSeries}
              dateRange={dateRange}
              rangeLabel={dateRangeLabel}
            />
          </Card>
          <Card title="Top dishes by revenue">
            <ul className="sfx-rank">
              {bestSellers.map((d) => (
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
      ) : null}

      {tab === "reservations" ? (
        <Card title="Reservation Report" action={<span className="sfx-muted">Today · sample</span>}>
          <div className="sfx-table-wrap">
            <table className="sfx-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Customer</th>
                  <th>Date / Time</th>
                  <th>Guests</th>
                  <th>Table</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => (
                  <tr key={r.reservation_id}>
                    <td className="sfx-mono">#{r.reservation_id}</td>
                    <td>{r.customer_name}</td>
                    <td>
                      {r.reservation_date}
                      <small className="sfx-cell-sub">{r.start_time}</small>
                    </td>
                    <td>{r.party_size}</td>
                    <td>{r.table_label}</td>
                    <td>
                      <StatusBadge tone={RESERVATION_STATUS_META[r.status]?.tone}>
                        {RESERVATION_STATUS_META[r.status]?.label}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {tab === "stats" ? (
        <div className="sfx-stack">
          <div className="sfx-statgrid">
            <div className="sfx-statcard">
              <span className="sfx-statcard__val">{stats.totalThisMonth}</span>
              <span className="sfx-statcard__lbl">Reservations this month</span>
            </div>
            <div className="sfx-statcard">
              <span className="sfx-statcard__val">{stats.completionRate}%</span>
              <span className="sfx-statcard__lbl">Completion rate</span>
            </div>
            <div className="sfx-statcard">
              <span className="sfx-statcard__val">{stats.noShowRate}%</span>
              <span className="sfx-statcard__lbl">No-show rate</span>
            </div>
            <div className="sfx-statcard">
              <span className="sfx-statcard__val">{stats.avgPartySize}</span>
              <span className="sfx-statcard__lbl">Avg party size</span>
            </div>
          </div>

          <div className="sfx-grid sfx-grid--2">
            <Card title="Reservations by area">
              <ul className="sfx-barlist">
                {stats.byArea.map((a) => {
                  const max = Math.max(...stats.byArea.map((x) => x.count));
                  return (
                    <li key={a.area}>
                      <span className="sfx-barlist__label">{a.area}</span>
                      <span className="sfx-bar">
                        <span className="sfx-bar__fill" style={{ width: `${(a.count / max) * 100}%` }} />
                      </span>
                      <span className="sfx-barlist__val">{a.count}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
            <Card title="Table utilization">
              <ul className="sfx-barlist">
                {utilization.map((u) => (
                  <li key={u.area}>
                    <span className="sfx-barlist__label">{u.area}</span>
                    <span className="sfx-bar">
                      <span className="sfx-bar__fill sfx-bar__fill--green" style={{ width: `${u.utilization}%` }} />
                    </span>
                    <span className="sfx-barlist__val">{u.utilization}%</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "export" ? (
        <Card title="Export & View Reports">
          <div className="sfx-exportgrid">
            <button type="button" className="sfx-export" onClick={() => toast("Excel export API not connected yet", "info")}>
              <Icon name="download" size={20} />
              <strong>Export Excel</strong>
              <small>Revenue + reservations (.xlsx)</small>
            </button>
            <button type="button" className="sfx-export" onClick={() => toast("PDF export API not connected yet", "info")}>
              <Icon name="report" size={20} />
              <strong>Export PDF</strong>
              <small>Formatted summary report</small>
            </button>
            <button type="button" className="sfx-export" onClick={() => toast("Report viewer not connected yet", "info")}>
              <Icon name="eye" size={20} />
              <strong>View Report</strong>
              <small>Open full report snapshot</small>
            </button>
          </div>
          <NotConnectedNote>
            Export endpoints are not connected. Buttons are UI-ready and will call the real export API once available.
          </NotConnectedNote>
        </Card>
      ) : null}
    </div>
  );
}

export default ReportsSection;
