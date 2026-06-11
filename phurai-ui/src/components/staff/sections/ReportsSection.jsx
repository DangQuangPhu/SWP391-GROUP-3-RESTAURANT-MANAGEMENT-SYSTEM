import { useEffect, useState } from "react";
import RevenueChart from "@/components/staff/RevenueChart.jsx";
import KpiCard from "@/components/staff/KpiCard.jsx";
import Icon from "@/components/staff/StaffIcons.jsx";
import {
  SectionHead,
  Card,
  StatusBadge,
  NotConnectedNote,
} from "@/components/staff/StaffUI.jsx";
import { RESERVATION_STATUS_META } from "@/data/staffDashboardMockData.js";
import { formatVND } from "@/utils/formatCurrency.js";

const TABS = [
  { id: "revenue", label: "Revenue Dashboard" },
  { id: "reservations", label: "Reservation Report" },
  { id: "stats", label: "Reservation Statistics" },
  { id: "export", label: "Export & View" },
];

function ReportsSection({
  kpis,
  revenue,
  reservations,
  bestSellers,
  stats,
  utilization,
  pendingAction,
  toast,
}) {
  const [tab, setTab] = useState("revenue");

  useEffect(() => {
    if (pendingAction?.startsWith("tab-")) {
      const t = pendingAction.replace("tab-", "");
      if (TABS.some((x) => x.id === t)) setTab(t);
    }
  }, [pendingAction]);

  const revenueKpis = kpis.filter((k) => ["revenue", "reservations", "promos", "rating"].includes(k.id));

  return (
    <div className="sfx-stack">
      <SectionHead title="Reports" subtitle="Revenue, statistics and exports" />

      <div className="sfx-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`sfx-tab ${tab === t.id ? "is-active" : ""}`} onClick={() => setTab(t.id)}>
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
            <RevenueChart series={revenue} />
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
            <button className="sfx-export" onClick={() => toast("Excel export API not connected yet", "info")}>
              <Icon name="download" size={20} />
              <strong>Export Excel</strong>
              <small>Revenue + reservations (.xlsx)</small>
            </button>
            <button className="sfx-export" onClick={() => toast("PDF export API not connected yet", "info")}>
              <Icon name="report" size={20} />
              <strong>Export PDF</strong>
              <small>Formatted summary report</small>
            </button>
            <button className="sfx-export" onClick={() => toast("Report viewer not connected yet", "info")}>
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
