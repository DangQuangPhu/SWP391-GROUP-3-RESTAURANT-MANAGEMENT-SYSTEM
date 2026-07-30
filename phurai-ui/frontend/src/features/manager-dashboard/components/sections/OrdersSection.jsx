import { useCallback, useEffect, useMemo, useState } from "react";
import { useSocket } from "@/core/socket/SocketContext.jsx";
import {
  SectionHead,
  ContentPanel,
  StatusBadge,
  EmptyState,
} from "../ManagerUI.jsx";
import { fetchKitchenQueue } from "../../../staff-dashboard/kitchen/kitchen.api.js";
import { useManagerPortal } from "../../context/ManagerPortalContext.jsx";
import { formatVND } from "@/core/utils/formatCurrency.js";

function formatWait(minutes) {
  const value = Number(minutes) || 0;
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  return mins ? `${hours}h ${mins}m` : `${hours} hr`;
}

function OrdersSection() {
  const { toast, user } = useManagerPortal();
  const { socket } = useSocket();
  const userId = user?.userId ?? user?.user_id ?? user?.id;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

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
    
    const handleNewPreorder = () => loadQueue(true);
    const handleItemUpdate = () => loadQueue(true);
    const handleClearOrder = () => loadQueue(true);

    socket.on("kitchen:new_preorder", handleNewPreorder);
    socket.on("kitchen:dish_ready", handleItemUpdate);
    socket.on("kitchen:dish_cancelled", handleItemUpdate);
    socket.on("kitchen:dish_preparing", handleItemUpdate);
    socket.on("kds:clear_order", handleClearOrder);

    return () => {
      socket.off("kitchen:new_preorder", handleNewPreorder);
      socket.off("kitchen:dish_ready", handleItemUpdate);
      socket.off("kitchen:dish_cancelled", handleItemUpdate);
      socket.off("kitchen:dish_preparing", handleItemUpdate);
      socket.off("kds:clear_order", handleClearOrder);
    };
  }, [socket, loadQueue]);

  const lanes = useMemo(() => {
    return {
      pending: items.filter(t => t.kitchen_status === "Pending" || t.kitchen_status === "Sent To Kitchen"),
      preparing: items.filter(t => t.kitchen_status === "Preparing"),
      ready: items.filter(t => t.kitchen_status === "Ready"),
    };
  }, [items]);

  const renderLane = (title, list, tone) => {
    // Define soft background tints for the cards based on their tone
    const bgTint = tone === "amber" ? "var(--clr-amber-50, #FFFBEB)" : 
                   tone === "blue" ? "var(--clr-blue-50, #EFF6FF)" : 
                   tone === "green" ? "var(--clr-emerald-50, #ECFDF5)" : "var(--bg-card)";
                   
    const borderColor = tone === "amber" ? "var(--clr-amber-500, #F59E0B)" :
                        tone === "blue" ? "var(--clr-blue-500, #3B82F6)" :
                        tone === "green" ? "var(--clr-emerald-500, #10B981)" : "gray";

    return (
    <div className="sfx-card" style={{ flex: 1, minWidth: '300px' }}>
      <header className="sfx-card__head">
        <h3 className="sfx-card__title">{title}</h3>
        <StatusBadge tone={tone}>{list.length}</StatusBadge>
      </header>
      <div className="sfx-card__body sfx-kds" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
        {list.length === 0 ? (
          <EmptyState icon="fire" title="No items" hint={`No items in ${title} state.`} />
        ) : (
          list.map((item) => {
            const wait_minutes = Math.floor((item.wait_time_seconds || 0) / 60);
            const isOverdue = item.is_overdue || wait_minutes > 15;
            
            return (
              <article key={item.kitchen_ticket_id} className="sfx-ordercard" style={{ 
                borderLeft: `5px solid ${borderColor}`, 
                padding: '1rem', 
                background: isOverdue && tone === 'blue' ? 'var(--clr-red-50, #FEF2F2)' : bgTint, 
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
              }}>
                <header className="sfx-ordercard__head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong style={{ fontSize: '1.1rem' }}>{item.quantity}× {item.dish_name}</strong>
                    {item.special_notes && (
                      <p style={{ margin: '0.25rem 0', fontStyle: 'italic', color: 'var(--clr-amber-700)' }}>
                        Note: {item.special_notes}
                      </p>
                    )}
                    <div className="sfx-ordercard__meta" style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--fg-muted)' }}>
                      <span>Order #{item.order_id}</span>
                      <br/>
                      <span>{item.guest_label} - Table {item.table_number || "—"}</span>
                      {wait_minutes >= 0 && (
                        <span style={{ marginLeft: '1rem', color: wait_minutes > 15 ? 'var(--clr-red-500)' : 'inherit', fontWeight: '500' }}>
                          Wait: {formatWait(wait_minutes)}
                        </span>
                      )}
                    </div>
                  </div>
                </header>
              </article>
            );
          })
        )}
      </div>
    </div>
    );
  };

  return (
    <div className="sfx-stack">
      <SectionHead title="Orders & Kitchen Supervisor" subtitle={`${items.length} total active tickets in kitchen`} />
      <ContentPanel compact>
        {loading && items.length === 0 ? (
          <div className="sfx-loading" style={{ padding: '2rem', textAlign: 'center' }}>
            <span className="sfx-spinner" />
            <p>Loading KDS sync…</p>
          </div>
        ) : (
          <div className="sfx-kdsboard" style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-start' }}>
            {renderLane("Pending", lanes.pending, "amber")}
            {renderLane("Preparing", lanes.preparing, "blue")}
            {renderLane("Ready", lanes.ready, "green")}
          </div>
        )}
      </ContentPanel>
    </div>
  );
}

export default OrdersSection;
