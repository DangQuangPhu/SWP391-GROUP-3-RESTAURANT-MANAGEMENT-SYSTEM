import KpiCard from "@/components/staff/KpiCard.jsx";
import { Card, StatusBadge, Button } from "@/components/staff/StaffUI.jsx";
import {
  RESERVATION_STATUS_META,
  TABLE_STATUS_META,
  ORDER_STATUS_META,
} from "@/data/staffDashboardMockData.js";

/* Operations-focused view (no revenue) for floor & kitchen staff. */
function TodaySection({ kpis, reservations, tables, orders, onNavigate }) {
  const opsKpis = kpis.filter((k) =>
    ["reservations", "occupied", "pendingOrders", "kitchen"].includes(k.id)
  );
  const arriving = reservations.filter((r) => ["pending", "confirmed"].includes(r.status));

  return (
    <div className="sfx-stack">
      <div className="sfx-kpis">
        {opsKpis.map((c, i) => (
          <KpiCard key={c.id} card={c} index={i} />
        ))}
      </div>

      <div className="sfx-grid sfx-grid--2">
        <Card
          title="Arriving guests"
          action={<Button size="sm" variant="ghost" onClick={() => onNavigate("reservations", "filter-arriving")}>Check-in</Button>}
        >
          <ul className="sfx-timeline">
            {arriving.length ? (
              arriving.map((r) => (
                <li key={r.reservation_id} className="sfx-timeline__row">
                  <span className="sfx-timeline__time">{r.start_time}</span>
                  <span className="sfx-timeline__main">
                    <strong>{r.customer_name}</strong>
                    <small>{r.party_size} guests · {r.table_label}</small>
                  </span>
                  <StatusBadge tone={RESERVATION_STATUS_META[r.status]?.tone}>
                    {RESERVATION_STATUS_META[r.status]?.label}
                  </StatusBadge>
                </li>
              ))
            ) : (
              <li className="sfx-muted">No arriving guests right now.</li>
            )}
          </ul>
        </Card>

        <Card
          title="Kitchen queue"
          action={<Button size="sm" variant="ghost" onClick={() => onNavigate("orders", "tab-kitchen")}>Open</Button>}
        >
          <ul className="sfx-timeline">
            {orders
              .filter((o) => o.kitchen_status !== "done")
              .map((o) => (
                <li key={o.order_id} className="sfx-timeline__row">
                  <span className="sfx-timeline__time">{o.order_number}</span>
                  <span className="sfx-timeline__main">
                    <strong>Table {o.table_label}</strong>
                    <small>{o.items_count} items</small>
                  </span>
                  <StatusBadge tone={ORDER_STATUS_META[o.kitchen_status]?.tone}>
                    {ORDER_STATUS_META[o.kitchen_status]?.label}
                  </StatusBadge>
                </li>
              ))}
          </ul>
        </Card>
      </div>

      <Card
        title="Table status"
        action={<Button size="sm" variant="ghost" onClick={() => onNavigate("tables")}>Manage</Button>}
      >
        <div className="sfx-tiles">
          {tables.map((t) => (
            <div key={t.table_id} className={`sfx-tile sfx-tile--${TABLE_STATUS_META[t.status]?.tone}`}>
              <strong>{t.table_number}</strong>
              <small>{TABLE_STATUS_META[t.status]?.label}</small>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default TodaySection;
