import { useMemo } from "react";
import {
  SectionHead,
  StatusBadge,
  Button,
  EmptyState,
  NotConnectedNote,
} from "../StaffUI.jsx";
import { DEMO_NOTICE, ORDER_STATUS_META } from "../../data/staffDashboardMockData.js";

const KITCHEN_FLOW = { queued: "cooking", cooking: "ready", ready: "done" };
const KITCHEN_NEXT_LABEL = {
  queued: "Start cooking",
  cooking: "Mark ready",
  ready: "Hand off",
};

function KitchenDisplaySection({ tickets, setTickets, dataSource, toast }) {
  const lanes = useMemo(() => {
    const queued = tickets.filter((t) => t.kitchen_status === "queued");
    const cooking = tickets.filter((t) => t.kitchen_status === "cooking");
    const ready = tickets.filter((t) => t.kitchen_status === "ready");
    return { queued, cooking, ready };
  }, [tickets]);

  const advance = (ticket) => {
    const next = KITCHEN_FLOW[ticket.kitchen_status];
    if (!next) return;
    setTickets((prev) =>
      prev.map((x) =>
        x.ticket_id === ticket.ticket_id ? { ...x, kitchen_status: next } : x
      )
    );
    toast(
      `${ticket.order_number} → ${ORDER_STATUS_META[next]?.label || next} (local only)`,
      "info"
    );
  };

  const renderLane = (title, list, tone) => (
    <div className="sfx-card">
      <header className="sfx-card__head">
        <h3 className="sfx-card__title">{title}</h3>
        <StatusBadge tone={tone}>{list.length}</StatusBadge>
      </header>
      <div className="sfx-card__body sfx-kds">
        {list.length === 0 ? (
          <EmptyState icon="fire" title="No tickets" hint="Tickets appear when orders are sent to kitchen." />
        ) : (
          list.map((t) => (
            <article key={t.ticket_id} className="sfx-ordercard">
              <header className="sfx-ordercard__head">
                <div>
                  <strong>{t.order_number}</strong>
                  <div className="sfx-ordercard__meta">
                    <span>Table {t.table_label}</span>
                    <span>{t.elapsed_min}m</span>
                  </div>
                </div>
                <StatusBadge tone={ORDER_STATUS_META[t.kitchen_status]?.tone}>
                  {ORDER_STATUS_META[t.kitchen_status]?.label}
                </StatusBadge>
              </header>
              <ul className="sfx-kdsticket__items">
                {t.items.map((item, idx) => (
                  <li key={`${t.ticket_id}-${idx}`}>
                    <span>{item.qty}×</span> {item.name}
                  </li>
                ))}
              </ul>
              <footer className="sfx-ordercard__foot">
                {KITCHEN_FLOW[t.kitchen_status] ? (
                  <Button size="sm" variant="gold" onClick={() => advance(t)}>
                    {KITCHEN_NEXT_LABEL[t.kitchen_status]}
                  </Button>
                ) : (
                  <span />
                )}
              </footer>
            </article>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="sfx-stack">
      <SectionHead
        title="Cooking Queue"
        subtitle={`${tickets.length} kitchen tickets in progress`}
      />

      {dataSource === "mock" ? <NotConnectedNote>{DEMO_NOTICE}</NotConnectedNote> : null}

      <div className="sfx-kdsboard">
        {renderLane("Queued", lanes.queued, "muted")}
        {renderLane("Preparing", lanes.cooking, "red")}
        {renderLane("Ready", lanes.ready, "green")}
      </div>
    </div>
  );
}

export default KitchenDisplaySection;
