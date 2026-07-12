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

// ── Ticket Card ───────────────────────────────────────────────────────────────
function TicketCard({ ticket, busy, onAction, onCancel }) {
  const meta = statusMeta(ticket.kitchen_status);
  const isOverdue = ticket.is_overdue;

  const canSendToKitchen = ticket.kitchen_status === "Pending";
  const canMarkServed    = ticket.kitchen_status === "Ready";
  const canFreeCancel    = ["Pending", "Sent To Kitchen"].includes(ticket.kitchen_status);
  const isBusy = busy === ticket.kitchen_ticket_id;

  return (
    <article
      style={{
        background: isOverdue ? "rgba(224,82,82,.08)" : "var(--surface-1, #1e1e1e)",
        border: `1px solid ${isOverdue ? "rgba(224,82,82,.4)" : "var(--border, #2a2a2a)"}`,
        borderRadius: "12px",
        padding: "14px 16px",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "12px",
      }}
    >
      {/* Priority indicator */}
      {ticket.priority_level >= 4 && (
        <div style={{ width: "3px", background: "#f0a500", borderRadius: "2px", alignSelf: "stretch", flexShrink: 0 }} />
      )}

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
          <span style={{ fontWeight: "600", fontSize: "15px" }}>{ticket.dish_name}</span>
          <span style={{
            fontSize: "11px", padding: "2px 8px", borderRadius: "12px", fontWeight: "500",
            background: meta.bg, color: meta.color,
          }}>
            {meta.label}
          </span>
          {isOverdue && (
            <span style={{ fontSize: "11px", color: "#e05252", fontWeight: "600" }}>⚠ OVERDUE</span>
          )}
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-muted, #888)", display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <span>Table {ticket.table_number ?? "—"}</span>
          <span>×{ticket.quantity}</span>
          {ticket.category_name && <span>{ticket.category_name}</span>}
          {ticket.wait_time_seconds > 0 && (
            <span style={{ color: isOverdue ? "#e05252" : undefined }}>
              Wait: {formatWait(ticket.wait_time_seconds)}
            </span>
          )}
          {ticket.special_notes && (
            <span style={{ color: "#f0a500", fontStyle: "italic" }}>📝 {ticket.special_notes}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
        {canSendToKitchen && (
          <Button size="sm" variant="primary" onClick={() => onAction(ticket, "Sent To Kitchen")} disabled={isBusy}>
            {isBusy ? "…" : "Send to Kitchen"}
          </Button>
        )}
        {canMarkServed && (
          <Button size="sm" variant="success" onClick={() => onAction(ticket, "Served")} disabled={isBusy}>
            {isBusy ? "…" : "Mark Served"}
          </Button>
        )}
        {canFreeCancel && (
          <Button size="sm" variant="ghost" onClick={() => onCancel(ticket)} disabled={isBusy}>
            Cancel
          </Button>
        )}
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
  const [dataSource, setDataSource] = useState("mock");
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
      setDataSource(res?.source === "api" ? "api" : "mock");
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
    ];
    events.forEach(e => socket.on(e, reload));
    return () => events.forEach(e => socket.off(e, reload));
  }, [socket, loadQueue, onRefresh]);

  // ── FSM action ──────────────────────────────────────────────────────────────
  const handleAction = async (ticket, newStatus) => {
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
  };

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

  // ── Filter ──────────────────────────────────────────────────────────────────
  const FILTER_OPTS = [
    { id: "all",       label: "All" },
    { id: "Ready",     label: `Ready (${queue.filter(t => t.kitchen_status === "Ready").length})` },
    { id: "Preparing", label: `Preparing (${queue.filter(t => t.kitchen_status === "Preparing").length})` },
    { id: "Sent To Kitchen", label: `Sent (${queue.filter(t => t.kitchen_status === "Sent To Kitchen").length})` },
    { id: "Pending",   label: `Pending (${queue.filter(t => t.kitchen_status === "Pending").length})` },
  ];

  const displayed = activeFilter === "all"
    ? [...queue].sort((a, b) => (statusMeta(b.kitchen_status).order - statusMeta(a.kitchen_status).order) || new Date(a.sent_at) - new Date(b.sent_at))
    : queue.filter(t => t.kitchen_status === activeFilter);

  const overdueCount = queue.filter(t => t.is_overdue).length;

  return (
    <div className="staff-kds-tab">
      <SectionHead
        title="Kitchen Display"
        subtitle="Live kitchen queue — send items, track progress, confirm service"
        actions={
          <Button variant="ghost" size="sm" icon="refresh" onClick={() => { onRefresh?.(); loadQueue(false); }} disabled={refreshing || loading}>
            Refresh
          </Button>
        }
      />

      {/* Summary strip */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
        {[
          { label: "Ready to Serve", value: queue.filter(t => t.kitchen_status === "Ready").length, color: "#4caf7d" },
          { label: "Preparing",      value: queue.filter(t => t.kitchen_status === "Preparing").length, color: "#4a90e2" },
          { label: "Overdue",        value: overdueCount, color: overdueCount > 0 ? "#e05252" : "var(--text-muted)" },
          { label: "In Queue",       value: queue.length, color: "var(--text-muted)" },
        ].map(s => (
          <div key={s.label} style={{
            padding: "10px 16px", borderRadius: "10px", background: "var(--surface-1, #1e1e1e)",
            border: "1px solid var(--border, #2a2a2a)", textAlign: "center", minWidth: "90px"
          }}>
            <div style={{ fontSize: "22px", fontWeight: "700", color: s.color }}>{s.value}</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{s.label}</div>
          </div>
        ))}
        {lastUpdated && (
          <div style={{ alignSelf: "center", fontSize: "11px", color: "var(--text-muted)", marginLeft: "auto" }}>
            Updated {lastUpdated.toLocaleTimeString("vi-VN")}
          </div>
        )}
      </div>

      {/* Filter pills */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
        {FILTER_OPTS.map(f => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            style={{
              padding: "6px 14px", borderRadius: "20px", border: "none", cursor: "pointer", fontSize: "12px",
              fontWeight: activeFilter === f.id ? "600" : "400",
              background: activeFilter === f.id ? "var(--accent, #c8a96e)" : "var(--surface-2, #252525)",
              color: activeFilter === f.id ? "#fff" : "var(--text-muted, #aaa)",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Ticket list */}
      {loading ? (
        <div className="sfx-loading staff-kds-tab__loading">
          <span className="sfx-spinner" />
          <p>Loading kitchen queue…</p>
        </div>
      ) : displayed.length === 0 ? (
        <EmptyState
          icon="fire"
          title={activeFilter === "all" ? "Queue empty" : `No ${activeFilter} items`}
          hint="Tickets appear when orders are placed or sent to kitchen"
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {displayed.map(ticket => (
            <TicketCard
              key={ticket.kitchen_ticket_id}
              ticket={ticket}
              busy={busyId}
              onAction={handleAction}
              onCancel={setCancelTarget}
            />
          ))}
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
