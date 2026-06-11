import KpiCard from "@/components/staff/KpiCard.jsx";
import RevenueChart from "@/components/staff/RevenueChart.jsx";
import Icon from "@/components/staff/StaffIcons.jsx";
import { Card, StatusBadge, Button } from "@/components/staff/StaffUI.jsx";
import { formatVND } from "@/utils/formatCurrency.js";
import {
  RESERVATION_STATUS_META,
  TABLE_STATUS_META,
  ORDER_STATUS_META,
} from "@/data/staffDashboardMockData.js";

const QUICK_ACTIONS = [
  { label: "Add Dish", icon: "dish", view: "dishes", action: "add" },
  { label: "Add Table", icon: "table", view: "tables", action: "add" },
  { label: "Create Promotion", icon: "tag", view: "promotions", action: "add" },
  { label: "Export Report", icon: "download", view: "reports", action: "tab-export" },
  { label: "View Reservations", icon: "calendar", view: "reservations" },
];

function OverviewSection({
  kpis,
  revenue,
  reservations,
  tables,
  orders,
  bestSellers,
  role,
  onNavigate,
}) {
  const visibleKpis = role === "manager" ? kpis : kpis.filter((k) => k.id !== "revenue");
  const topReservations = reservations.slice(0, 5);
  const tableCounts = tables.reduce((acc, t) => {
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
          <Card className="sfx-span">
            <RevenueChart series={revenue} />
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
            {tables.slice(0, 12).map((t) => (
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
                {orders.map((o) => (
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
    </div>
  );
}

export default OverviewSection;
