import { useMemo } from "react";
import {
  SectionHead,
  StatusBadge,
  Button,
  EmptyState,
  NotConnectedNote,
} from "../StaffUI.jsx";
import { DEMO_NOTICE, ORDER_STATUS_META } from "../../data/staffDashboardMockData.js";
import { formatVND } from "@/utils/formatCurrency.js";

function ActiveOrdersSection({ orders, setOrders, dataSource, toast }) {
  const activeOrders = useMemo(
    () => orders.filter((o) => o.kitchen_status !== "done" && o.status !== "served"),
    [orders]
  );

  const markServed = (order) => {
    setOrders((prev) =>
      prev.map((x) =>
        x.order_id === order.order_id
          ? { ...x, status: "served", kitchen_status: "done" }
          : x
      )
    );
    toast(`${order.order_number} marked served (local only)`, "info");
  };

  return (
    <div className="sfx-stack">
      <SectionHead
        title="Active Orders"
        subtitle={`${activeOrders.length} open orders on the floor`}
      />

      {dataSource === "mock" ? <NotConnectedNote>{DEMO_NOTICE}</NotConnectedNote> : null}

      <div className="sfx-orderboard">
        {activeOrders.length === 0 ? (
          <EmptyState
            icon="receipt"
            title="No active orders"
            hint="New orders will appear here when guests place them."
          />
        ) : (
          activeOrders.map((o) => (
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
                {o.kitchen_status === "ready" ? (
                  <Button size="sm" variant="gold" onClick={() => markServed(o)}>
                    Mark served
                  </Button>
                ) : null}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

export default ActiveOrdersSection;
