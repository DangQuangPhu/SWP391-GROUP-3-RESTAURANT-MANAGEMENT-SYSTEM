/**
 * StaffKdsTab.jsx — Kitchen Display App (Staff Portal)
 *
 * Staff (user-JWT, role_id=2) perspective:
 *   - Send orders to kitchen: Pending → Sent To Kitchen
 *   - View full queue (Sent To Kitchen, Preparing, Ready)
 *   - Mark ready dishes as Served: Ready → Served
 *   - See overdue warnings
 *   - Free-cancel Pending/Sent To Kitchen items (with reason)
 *
 * Backend: GET /api/kitchen/queue, PATCH /api/kitchen/tickets/:id/status
 */
import { useCallback, useEffect, useState, useRef } from "react";
import { SectionHead, Button, EmptyState } from "./StaffUI.jsx";
import { useSocket } from "@/core/socket/SocketContext.jsx";
import { fetchKdsReadyQueue, fetchKdsDelayedItems, updateKitchenTicketFSM, fetchKitchenQueueFSM } from "../services/staffApi.js";
import "../styles/staff-kds-tab.css";

const POLL_MS = 12000;

import { Bone } from "./StaffSkeleton.jsx";

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_META = {
  "Pending":         { label: "Pending",         color: "#888",   bg: "rgba(136,136,136,.12)", order: 0 },
  "Sent To Kitchen": { label: "Sent to Kitchen",  color: "#f0a500", bg: "rgba(240,165,0,.12)",   order: 1 },
  "Preparing":       { label: "Preparing",        color: "#4a90e2", bg: "rgba(74,144,226,.12)",  order: 2 },
  "Ready":           { label: "Ready ✓",          color: "#4caf7d", bg: "rgba(76,175,125,.12)",  order: 3 },
};

function statusMeta(status) {
  return STATUS_META[status] ?? { label: status, color: "#888", bg: "rgba(136,136,136,.1)", order: 99 };
}

function formatWait(seconds) {
  const s = Number(seconds) || 0;
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// ── Order Group Card ────────────────────────────────────────────────────────────
function OrderGroupCard({ tickets, busyId, onAction }) {
  if (!tickets || tickets.length === 0) return null;
  
  const first = tickets[0];
  const isOverdue = tickets.some(t => t.is_overdue);
  const isPending = first.kitchen_status === "Pending";
  const isSent = first.kitchen_status === "Sent To Kitchen";
  const isPreparing = first.kitchen_status === "Preparing";
  const isReady = first.kitchen_status === "Ready";

  const handleGroupAction = async (newStatus) => {
    for (const t of tickets) {
      await onAction(t, newStatus);
    }
  };

  const totalItems = tickets.reduce((sum, t) => sum + t.quantity, 0);

  const getStatusPill = () => {
    if (isPreparing) return { label: "Cooking", bg: "#fce8e8", color: "#c94f4f" };
    if (isSent) return { label: "In Progress", bg: "#fdf3e7", color: "#b87c3a" };
    if (isReady) return { label: "Ready", bg: "#e9f5e9", color: "#4caf50" };
    return { label: "Pending", bg: "#f4f6f8", color: "#6b7280" };
  };

  const pill = getStatusPill();

  const actionButtonStyle = {
    background: "#a88658",
    color: "#fff",
    borderRadius: "10px",
    border: "none",
    padding: "8px 16px",
    fontWeight: "700",
    fontSize: "13px",
    cursor: "pointer",
    boxShadow: "0 2px 4px rgba(168, 134, 88, 0.2)"
  };

  return (
    <article
      style={{
        background: isOverdue ? "#fff9f9" : "#ffffff",
        border: isOverdue ? "1px solid #fca5a5" : "none",
        borderRadius: "16px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        boxShadow: "0 2px 16px rgba(0,0,0,0.06)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontWeight: "800", fontSize: "20px", color: "#2d2d2d" }}>
              Table {first.table_number ?? "—"}
            </span>
            {first.order_type?.includes("QR") && (
              <span style={{
                fontSize: "11px", padding: "2px 6px", borderRadius: "6px", fontWeight: "700",
                background: "#ffeed6", color: "#d97706"
              }}>
                QR
              </span>
            )}
          </div>
          <span style={{ fontSize: "13px", color: "#888", fontWeight: "500" }}>
            {totalItems} items
          </span>
        </div>
        
        <span style={{
          background: pill.bg, color: pill.color,
          padding: "4px 12px", borderRadius: "20px",
          fontSize: "12px", fontWeight: "700"
        }}>
          {pill.label}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {tickets.map(t => (
          <div key={t.kitchen_ticket_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontWeight: "700", fontSize: "15px", color: "#4a4a4a" }}>{t.dish_name}</span>
              {t.special_notes && (
                <span style={{ fontSize: "12px", color: "#b87c3a", fontStyle: "italic", marginTop: "2px" }}>* {t.special_notes}</span>
              )}
            </div>
            <span style={{ fontWeight: "800", fontSize: "15px", color: "#2d2d2d", whiteSpace: "nowrap" }}>
              × {t.quantity}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
        <div>
          {first.reservation_start_at && isPending && (
            <span style={{ color: "#4a90e2", fontWeight: "600", fontSize: "12px" }}>
              Start: {new Date(new Date(first.reservation_start_at).getTime() - 15 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {isOverdue && (
            <span style={{ fontSize: "12px", color: "#e05252", fontWeight: "700" }}>OVERDUE</span>
          )}
        </div>

        <div style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
          {isPending && (
            <button style={actionButtonStyle} onClick={() => handleGroupAction("Sent To Kitchen")} disabled={!!busyId}>
              Send to Kitchen
            </button>
          )}
          {isSent && (
            <button style={actionButtonStyle} onClick={() => handleGroupAction("Preparing")} disabled={!!busyId}>
              Start Cooking
            </button>
          )}
          {isPreparing && (
            <button style={actionButtonStyle} onClick={() => handleGroupAction("Ready")} disabled={!!busyId}>
              Mark Ready
            </button>
          )}
          {isReady && (
            <button style={{...actionButtonStyle, background: "#4caf50", boxShadow: "0 2px 4px rgba(76, 175, 80, 0.2)"}} onClick={() => handleGroupAction("Served")} disabled={!!busyId}>
              Mark Served
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

// ── Cancel Modal ──────────────────────────────────────────────────────────────
function CancelModal({ ticket, onConfirm, onClose }) {
  const [reason, setReason] = useState("");
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center"
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "var(--surface-1, #1e1e1e)", borderRadius: "14px", padding: "24px",
        width: "380px", maxWidth: "90vw", display: "flex", flexDirection: "column", gap: "14px"
      }}>
        <div style={{ fontWeight: "600" }}>Cancel Ticket — {ticket.dish_name}</div>
        <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
          Table {ticket.table_number}. This action cannot be undone. A reason is required.
        </p>
        <textarea
          autoFocus
          rows={3}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Reason for cancellation (e.g. guest changed order)"
          style={{
            padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border, #333)",
            background: "var(--surface-2, #252525)", color: "var(--text, #eee)",
            fontSize: "13px", resize: "vertical", outline: "none"
          }}
        />
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onClose}>Back</Button>
          <Button variant="danger" onClick={() => reason.trim() && onConfirm(reason.trim())} disabled={!reason.trim()}>
            Confirm Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
function StaffKdsTab({ user, toast, onRefresh, refreshing }) {
  const { socket } = useSocket();

  // Full FSM queue from kitchenController
  const [queue, setQueue]           = useState([]);
  // Also keep the legacy ready/delayed for the summary panels
  const [readyItems, setReadyItems] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [busyId, setBusyId]         = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null); // ticket | null
  const [activeFilter, setActiveFilter] = useState("all"); // 'all' | 'ready' | 'preparing' | 'pending'

  const userId = user?.userId ?? user?.user_id ?? user?.id;

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadQueue = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetchKitchenQueueFSM();
      const rows = Array.isArray(res?.data) ? res.data : [];
      setQueue(rows);
      setReadyItems(rows.filter(t => t.kitchen_status === "Ready"));
      setLastUpdated(new Date());
    } catch {
      // Fall back to legacy endpoints
      try {
        const [readyRes, delayedRes] = await Promise.all([
          fetchKdsReadyQueue(), fetchKdsDelayedItems()
        ]);
        const ready   = Array.isArray(readyRes?.data) ? readyRes.data : [];
        const delayed = Array.isArray(delayedRes?.data) ? delayedRes.data : [];
        setQueue([...ready, ...delayed]);
        setReadyItems(ready);
        setDataSource("api");
        setLastUpdated(new Date());
      } catch {
        toast?.("Could not load KDS data", "error");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadQueue(false); }, [loadQueue]);

  useEffect(() => {
    const timer = setInterval(() => loadQueue(true), POLL_MS);
    return () => clearInterval(timer);
  }, [loadQueue]);

  // ── Socket listeners ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const reload = () => { loadQueue(true); onRefresh?.(); };
    const events = [
      "NEW_KITCHEN_ORDER", "NEW_KITCHEN_TICKET", "kitchen:new_preorder",
      "kitchen:new_ticket", "kds:clear_order", "kitchen:dish_ready",
      "kitchen:dish_cancelled", "kitchen:dish_preparing", "kds:ticket_updated",
      "kds:ticket_cancelled", "ORDER_ITEM_CANCELLED"
    ];
    events.forEach(e => socket.on(e, reload));
    return () => events.forEach(e => socket.off(e, reload));
  }, [socket, loadQueue, onRefresh]);

  // ── FSM action ──────────────────────────────────────────────────────────────
  const handleAction = useCallback(async (ticket, newStatus) => {
    setBusyId(ticket.kitchen_ticket_id);
    try {
      const res = await updateKitchenTicketFSM(ticket.kitchen_ticket_id, {
        new_status: newStatus,
        expected_updated_at: ticket.updated_at,
      });
      if (res?.success === false) {
        if (res?.code === "STALE_STATE") {
          toast?.("Ticket was updated by someone else — refreshing…", "info");
        } else {
          toast?.(res?.message || "Could not update ticket", "error");
        }
      } else {
        const verb = newStatus === "Sent To Kitchen" ? "Sent to kitchen" : `Marked ${newStatus}`;
        toast?.(`${verb}: ${ticket.dish_name}`, "success");
        onRefresh?.();
      }
    } catch {
      toast?.("Network error — please retry", "error");
    } finally {
      setBusyId(null);
      loadQueue(true);
    }
  }, [toast, loadQueue, onRefresh]);

  // ── Auto-transition pre-orders ─────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      queue.forEach((ticket) => {
        if (ticket.kitchen_status === "Pending" && ticket.reservation_start_at) {
          const startAt = new Date(ticket.reservation_start_at);
          const diffMins = (startAt - now) / 60000;
          if (diffMins <= 15 && diffMins > -120) { // Add safety boundary so it doesn't fire for very old reservations
            handleAction(ticket, "Sent To Kitchen");
          }
        }
      });
    }, 15000); // Check every 15s
    return () => clearInterval(timer);
  }, [queue, handleAction]);

  // ── Cancel (free cancel — Pending/Sent To Kitchen) ──────────────────────────
  const handleCancelConfirm = async (reason) => {
    const ticket = cancelTarget;
    setCancelTarget(null);
    setBusyId(ticket.kitchen_ticket_id);
    try {
      const res = await updateKitchenTicketFSM(ticket.kitchen_ticket_id, {
        new_status: "Cancelled",
        cancel_reason: reason,
        expected_updated_at: ticket.updated_at,
      });
      if (res?.success === false) {
        toast?.(res?.message || "Could not cancel ticket", "error");
      } else {
        toast?.(`Cancelled: ${ticket.dish_name}`, "success");
        onRefresh?.();
      }
    } catch {
      toast?.("Network error — please retry", "error");
    } finally {
      setBusyId(null);
      loadQueue(true);
    }
  };

  // Kanban layout replaced the old filter and summary strip

  return (
    <div className="staff-kds-tab">
      <SectionHead
        title="Kitchen Display"
        subtitle="Live kitchen queue — send items, track progress, confirm service"
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {lastUpdated && (
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Updated: {lastUpdated.toLocaleTimeString("vi-VN")}
              </span>
            )}
            <Button variant="ghost" size="sm" icon="refresh" onClick={() => { onRefresh?.(); loadQueue(false); }} disabled={refreshing || loading}>
              Refresh
            </Button>
          </div>
        }
      />

      {/* Kanban Board */}
      {loading && queue.length === 0 ? (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(300px, 1fr))",
          gap: "20px",
          alignItems: "stretch",
          minHeight: "500px",
          marginTop: "20px",
          width: "100%"
        }} aria-busy="true" aria-label="Loading kitchen queue">
          {["Pending", "Sent", "Preparing", "Ready"].map((statusLabel, idx) => (
            <div key={idx} style={{
              background: "#f3f4f6",
              border: "1px solid #e5e7eb",
              borderRadius: "16px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              minHeight: "350px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "12px", borderBottom: "2px solid #e5e7eb", marginBottom: "4px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: "800", margin: 0, color: "#2d2d2d" }}>{statusLabel}</h3>
                <Bone w={24} h={18} radius={12} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {Array.from({ length: idx === 0 ? 2 : 1 }).map((_, cIdx) => (
                  <div key={cIdx} style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <Bone w="40%" h={14} />
                      <Bone w="20%" h={14} />
                    </div>
                    <Bone w="80%" h={12} />
                    <Bone w="60%" h={12} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(300px, 1fr))",
          gap: "20px",
          alignItems: "stretch",
          minHeight: "500px",
          marginTop: "20px",
          width: "100%"
        }}>
          {["Pending", "Sent To Kitchen", "Preparing", "Ready"].map(status => {
            const colTickets = queue.filter(t => t.kitchen_status === status);
            const statusLabel = status === "Sent To Kitchen" ? "Sent" : status;
            
            const markerColor = 
              status === "Pending" ? "#f5a623" :
              status === "Sent To Kitchen" ? "#4a90e2" :
              status === "Preparing" ? "#bd10e0" : "#7ed321";

            return (
              <div key={status} style={{
                background: "#f3f4f6",
                border: "1px solid #e5e7eb",
                borderRadius: "16px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                minHeight: "350px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "12px", borderBottom: "2px solid #e5e7eb", marginBottom: "4px", paddingLeft: "4px", paddingRight: "4px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: "800", margin: 0, color: "#2d2d2d" }}>{statusLabel}</h3>
                  <span style={{ background: "#e5e7eb", padding: "2px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "700", color: "#555" }}>
                    {colTickets.length}
                  </span>
                </div>
                {colTickets.length === 0 ? (
                  <div style={{ color: "#9ca3af", fontSize: "13px", textAlign: "center", padding: "20px 0", fontWeight: "500" }}>
                    No {statusLabel.toLowerCase()} items
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {Object.values(
                      colTickets.reduce((acc, ticket) => {
                        const key = ticket.order_id || `${ticket.table_number}-${ticket.sent_at}`;
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(ticket);
                        return acc;
                      }, {})
                    ).map((groupTickets, i) => (
                      <OrderGroupCard
                        key={groupTickets[0].order_id || i}
                        tickets={groupTickets}
                        busyId={busyId}
                        onAction={handleAction}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel confirmation modal */}
      {cancelTarget && (
        <CancelModal
          ticket={cancelTarget}
          onConfirm={handleCancelConfirm}
          onClose={() => setCancelTarget(null)}
        />
      )}
    </div>
  );
}

export default StaffKdsTab;
