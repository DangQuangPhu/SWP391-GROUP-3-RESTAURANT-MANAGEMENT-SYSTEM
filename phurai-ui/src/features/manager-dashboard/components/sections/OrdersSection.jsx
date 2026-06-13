import { useEffect, useMemo, useState } from "react";
import {
  SectionHead,
  StatusBadge,
  Button,
  EmptyState,
} from "../ManagerUI.jsx";
import { ORDER_STATUS_META } from "../../data/managerDashboardMockData.js";
import { formatVND } from "@/utils/formatCurrency.js";

const KITCHEN_FLOW = { queued: "cooking", cooking: "ready", ready: "done" };
const KITCHEN_NEXT_LABEL = { queued: "Start cooking", cooking: "Mark ready", ready: "Mark served" };

const TABS = [
  { id: "active", label: "Active Orders" },
  { id: "kitchen", label: "Kitchen Queue" },
  { id: "ready", label: "Ready to Serve" },
  { id: "history", label: "Order History" },
];

function OrdersSection({ orders, setOrders, pendingAction, toast }) {
  const [tab, setTab] = useState("active");

  useEffect(() => {
    if (pendingAction === "tab-kitchen") setTab("kitchen");
    if (pendingAction === "tab-ready") setTab("ready");
  }, [pendingAction]);

  const filtered = useMemo(() => {
    switch (tab) {
      case "kitchen":
        return orders.filter((o) => ["queued", "cooking"].includes(o.kitchen_status));
      case "ready":
        return orders.filter((o) => o.kitchen_status === "ready");
      case "history":
        return orders.filter((o) => ["done"].includes(o.kitchen_status));
      default:
        return orders.filter((o) => o.kitchen_status !== "done");
    }
  }, [orders, tab]);

  const advance = (o) => {
    const next = KITCHEN_FLOW[o.kitchen_status];
    if (!next) return;
    const nextStatus = next === "done" ? "served" : o.status;
    setOrders((prev) =>
      prev.map((x) => (x.order_id === o.order_id ? { ...x, kitchen_status: next, status: nextStatus } : x))
    );
    toast(`${o.order_number} → ${ORDER_STATUS_META[next].label} (local only — order API not connected)`, "info");
  };

  return (
    <div className="sfx-stack">
      <SectionHead title="Orders & Kitchen" subtitle={`${orders.length} orders on the floor`} />

      <div className="sfx-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`sfx-tab ${tab === t.id ? "is-active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="sfx-orderboard">
        {filtered.map((o) => (
          <article key={o.order_id} className="sfx-ordercard">
            <header className="sfx-ordercard__head">
              <strong>{o.order_number}</strong>
              <StatusBadge tone={ORDER_STATUS_META[o.kitchen_status]?.tone}>
                {ORDER_STATUS_META[o.kitchen_status]?.label}
              </StatusBadge>
            </header>
            <div className="sfx-ordercard__meta">
              <span>Table {o.table_label}</span>
              <span>{o.items_count} items</span>
            </div>
            <p className="sfx-ordercard__total">{formatVND(o.total)}</p>
            <div className="sfx-ordercard__foot">
              <StatusBadge tone={ORDER_STATUS_META[o.status]?.tone}>
                {ORDER_STATUS_META[o.status]?.label || o.status}
              </StatusBadge>
              {KITCHEN_FLOW[o.kitchen_status] ? (
                <Button size="sm" variant="gold" onClick={() => advance(o)}>
                  {KITCHEN_NEXT_LABEL[o.kitchen_status]}
                </Button>
              ) : (
                <span className="sfx-muted">Completed</span>
              )}
            </div>
          </article>
        ))}
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon="receipt" title="No orders in this lane" hint="Orders will appear here as they move through the kitchen." />
      ) : null}
    </div>
  );
}

export default OrdersSection;
