import { useCallback, useEffect, useMemo, useState } from "react";
import { useSocket } from "@/core/socket/SocketContext.jsx";
import {
  SectionHead,
  StatusBadge,
  Button,
  EmptyState,
} from "../components/StaffUI.jsx";
import { fetchKitchenQueue, updateTicketStatus, cancelTicket } from "./kitchen.api.js";
import { useStaffPortal } from "../context/StaffPortalContext.jsx";

const KITCHEN_NEXT_LABEL = {
  "Pending": "Start Preparing",
  "Preparing": "Mark Ready",
};

const KITCHEN_NEXT_STATUS = {
  "Pending": "Preparing",
  "Preparing": "Ready",
};

function formatWait(minutes) {
  const value = Number(minutes) || 0;
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  return mins ? `${hours}h ${mins}m` : `${hours} hr`;
}

function KitchenDashboard() {
  const { toast, user } = useStaffPortal();
  const { socket } = useSocket();
  const userId = user?.userId ?? user?.user_id ?? user?.id;
  
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyItems, setBusyItems] = useState({});

  const loadQueue = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetchKitchenQueue(userId);
      if (res?.data) {
        setItems(res.data);
      }
    } catch (err) {
      toast?.("Could not load kitchen queue", "error");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [toast, userId]);

  useEffect(() => {
    loadQueue(false);
  }, [loadQueue]);

  // Real-time socket events
  useEffect(() => {
    if (!socket) return;
    
    const handleNewPreorder = (payload) => {
      const count = payload?.item_count ?? 1;
      toast?.(`🍽 New order received (${count} item${count !== 1 ? 's' : ''})`, "info");
      loadQueue(true);
    };

    const handleItemUpdate = () => {
      loadQueue(true);
    };

    socket.on("kitchen:new_preorder", handleNewPreorder);
    socket.on("kitchen:dish_ready", handleItemUpdate);
    socket.on("kitchen:dish_cancelled", handleItemUpdate);
    socket.on("kitchen:dish_preparing", handleItemUpdate);

    return () => {
      socket.off("kitchen:new_preorder", handleNewPreorder);
      socket.off("kitchen:dish_ready", handleItemUpdate);
      socket.off("kitchen:dish_cancelled", handleItemUpdate);
      socket.off("kitchen:dish_preparing", handleItemUpdate);
    };
  }, [socket, loadQueue, toast]);

  const advanceStatus = async (item) => {
    const nextStatus = KITCHEN_NEXT_STATUS[item.kitchen_status];
    if (!nextStatus) return;

    setBusyItems(prev => ({ ...prev, [item.kitchen_ticket_id]: true }));
    try {
      const res = await updateTicketStatus(item.kitchen_ticket_id, nextStatus, userId);
      if (res?.success) {
        // Optimistic update
        setItems(prev => prev.map(i => 
          i.kitchen_ticket_id === item.kitchen_ticket_id ? { ...i, kitchen_status: nextStatus } : i
        ));
        toast?.(`Marked ${item.dish_name} as ${nextStatus}`, "success");
      } else {
        toast?.(res?.message || "Could not update status", "error");
        loadQueue(true); // revert
      }
    } catch {
      toast?.("Failed to update status", "error");
      loadQueue(true);
    } finally {
      setBusyItems(prev => ({ ...prev, [item.kitchen_ticket_id]: false }));
    }
  };

  const handleCancel = async (item) => {
    const reason = window.prompt("Enter cancel reason:");
    if (!reason) return;

    setBusyItems(prev => ({ ...prev, [item.kitchen_ticket_id]: true }));
    try {
      const res = await cancelTicket(item.kitchen_ticket_id, reason, userId);
      if (res?.success) {
        setItems(prev => prev.filter(i => i.kitchen_ticket_id !== item.kitchen_ticket_id));
        toast?.(`Cancelled ${item.dish_name}`, "info");
      } else {
        toast?.(res?.message || "Could not cancel item", "error");
      }
    } catch {
      toast?.("Failed to cancel item", "error");
    } finally {
      setBusyItems(prev => ({ ...prev, [item.kitchen_ticket_id]: false }));
    }
  };

  const lanes = useMemo(() => {
    return {
      pending: items.filter(t => t.kitchen_status === "Pending"),
      preparing: items.filter(t => t.kitchen_status === "Preparing"),
      ready: items.filter(t => t.kitchen_status === "Ready"),
    };
  }, [items]);

  const renderLane = (title, list, tone) => (
    <div className="sfx-card">
      <header className="sfx-card__head">
        <h3 className="sfx-card__title">{title}</h3>
        <StatusBadge tone={tone}>{list.length}</StatusBadge>
      </header>
      <div className="sfx-card__body sfx-kds" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {list.length === 0 ? (
          <EmptyState icon="fire" title="No items" hint={`No items in ${title} state.`} />
        ) : (
          list.map((item) => {
            const isBusy = busyItems[item.kitchen_ticket_id];
            const wait_minutes = item.wait_minutes || 0;
            return (
              <article key={item.kitchen_ticket_id} className="sfx-ordercard" style={{ borderLeft: `4px solid var(--clr-${tone}-500, gray)`, padding: '1rem', background: 'var(--bg-card)' }}>
                <header className="sfx-ordercard__head">
                  <div>
                    <strong>{item.quantity}× {item.dish_name}</strong>
                    <div className="sfx-ordercard__meta" style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: 'var(--fg-muted)' }}>
                      <span>Order #{item.order_id} ({item.order_type})</span>
                      <br/>
                      <span>{item.guest_label} - Table {item.table_number || "—"}</span>
                      {wait_minutes >= 0 && (
                        <span style={{ marginLeft: '1rem', color: wait_minutes > 15 ? 'var(--clr-red-500)' : 'inherit' }}>
                          Wait: {formatWait(wait_minutes)}
                        </span>
                      )}
                    </div>
                  </div>
                </header>
                <footer className="sfx-ordercard__foot" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  {item.kitchen_status !== 'Ready' && (
                    <Button size="sm" variant="outline" onClick={() => handleCancel(item)} disabled={isBusy}>
                      Cancel
                    </Button>
                  )}
                  {KITCHEN_NEXT_STATUS[item.kitchen_status] && (
                    <Button size="sm" variant={tone === "red" ? "primary" : "gold"} onClick={() => advanceStatus(item)} disabled={isBusy}>
                      {isBusy ? "Saving..." : KITCHEN_NEXT_LABEL[item.kitchen_status]}
                    </Button>
                  )}
                </footer>
              </article>
            );
          })
        )}
      </div>
    </div>
  );

  if (loading && items.length === 0) {
    return (
      <div className="sfx-loading">
        <span className="sfx-spinner" />
        <p>Loading kitchen queue…</p>
      </div>
    );
  }

  return (
    <div className="sfx-stack">
      <SectionHead
        title="Kitchen Dashboard"
        subtitle="Manage cooking queue and send ready items to staff"
        actions={
          <Button variant="ghost" size="sm" icon="refresh" onClick={() => loadQueue(true)} disabled={loading}>
            Refresh
          </Button>
        }
      />
      <div className="sfx-kdsboard" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
        {renderLane("Pending", lanes.pending, "muted")}
        {renderLane("Preparing", lanes.preparing, "red")}
        {renderLane("Ready", lanes.ready, "green")}
      </div>
    </div>
  );
}

export default KitchenDashboard;
