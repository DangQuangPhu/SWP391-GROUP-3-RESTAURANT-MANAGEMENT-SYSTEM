import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import "../styles/reservation.css";
import { useTableSession, ViewQrTableModal } from "@/features/table-session";
import {
  getMyReservations,
  requestCancel,
  requestEdit,
} from "../services/reservationApi.js";
import { useSocket } from "@/core/socket/SocketContext.jsx";

// Per state machine: new bookings are only ever Confirmed or Rejected — Pending is legacy
const ACTIVE_STATUSES = ["Confirmed"];

// Editable fields allowed by the spec (Q2 decision)
const EDIT_FIELDS = [
  { key: "reservation_start_at", label: "Date & Time", type: "datetime-local" },
  { key: "guest_count", label: "Guests", type: "number", min: 1 },
  { key: "contact_phone", label: "Phone", type: "tel" },
  { key: "special_request", label: "Special Request / Dining Purpose", type: "textarea" },
];

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: "short", day: "numeric", month: "short",
    year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function statusModifier(status) {
  const key = String(status || "").toLowerCase().replace(/\s+/g, "-");
  return `rzv-status-pill--${key}`;
}

/** Derive the display label for a reservation — matches Section 1.5 logic */
function getDisplayStatus(r) {
  if (r.has_pending_request) {
    return r.request_type === "cancel" ? "Cancellation Requested" : "Edit Requested";
  }
  return r.reservation_status || "—";
}

function MyReservationsPage({
  isAuthenticated = false,
  currentUser = null,
  onNavigate,
  onNavigateLogin,
}) {
  const userId = currentUser?.userId ?? currentUser?.id ?? null;

  const [reservations, setReservations] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [qrModalOpen, setQrModalOpen] = useState(false);

  // View Details modal (read-only — never repurposed for editing)
  const [viewDetailsTarget, setViewDetailsTarget] = useState(null);

  // Cancel Request modal states
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // Edit Request modal states
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editConfirm, setEditConfirm] = useState(false);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editWarningOpen, setEditWarningOpen] = useState(false); // 1-time edit warning
  const [editWarningTarget, setEditWarningTarget] = useState(null);

  const { hasActiveSession, session: tableSession } = useTableSession();

  // Helper to get Zone name from assigned tables prefix
  const getZoneNameFromTables = (tables) => {
    if (!tables || tables.length === 0) return null;
    const tableNumber = tables[0].table_number || "";
    const prefix = tableNumber.split("-")[0];
    switch (prefix) {
      case "WIN":
        return "Window";
      case "VIP":
        return "VIP / Private";
      case "S":
        return "Standard";
      case "PRE":
        return "Premium";
      case "PR":
        return "VIP / Private";
      case "K":
        return "Kitchen View";
      case "R":
        return "Rooftop / Outdoor";
      default:
        return null;
    }
  };

  const load = useCallback(() => {
    if (!isAuthenticated || !userId) return;
    setStatus("loading");
    setError("");
    getMyReservations(userId)
      .then((res) => {
        setReservations(res?.reservations || []);
        setStatus("ready");
      })
      .catch((err) => {
        setError(err?.message || "Could not load your reservations.");
        setStatus("error");
      });
  }, [isAuthenticated, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const { socket } = useSocket();
  useEffect(() => {
    if (!socket) return;
    const handleProcessed = () => load();
    const handleResolved = () => load();
    socket.on("reservation:processed", handleProcessed);
    socket.on("reservation:request_resolved", handleResolved);
    return () => {
      socket.off("reservation:processed", handleProcessed);
      socket.off("reservation:request_resolved", handleResolved);
    };
  }, [socket, load]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up = [], old = [];
    for (const r of reservations) {
      const start = new Date(r.reservation_start_at).getTime();
      const isActive = ACTIVE_STATUSES.includes(r.reservation_status);
      if (isActive && (Number.isNaN(start) || start >= now)) up.push(r);
      else old.push(r);
    }
    return { upcoming: up, past: old };
  }, [reservations]);

  // ── Cancel Request flow ────────────────────────────────────────────────────
  const openCancelRequest = (r) => {
    setCancelTarget(r);
    setCancelReason("");
    setCancelConfirm(false);
  };

  const handleSubmitCancelRequest = async () => {
    if (!cancelTarget || submittingCancel) return;
    setSubmittingCancel(true);
    try {
      await requestCancel(cancelTarget.reservation_id, userId, cancelReason || null);
      setReservations((prev) =>
        prev.map((r) =>
          r.reservation_id === cancelTarget.reservation_id
            ? { ...r, has_pending_request: 1, request_type: "cancel" }
            : r
        )
      );
      setCancelTarget(null);
      setCancelConfirm(false);
    } catch (err) {
      setError(err?.message || "Could not submit cancellation request.");
    } finally {
      setSubmittingCancel(false);
    }
  };

  // ── Edit Request flow (with 1-time warning gate) ───────────────────────────
  const openEditRequestWithWarning = (r) => {
    // Show the 1-time warning first — user must acknowledge before editting
    setEditWarningTarget(r);
    setEditWarningOpen(true);
  };

  const confirmEditWarning = () => {
    setEditWarningOpen(false);
    if (editWarningTarget) openEditRequest(editWarningTarget);
    setEditWarningTarget(null);
  };

  const openEditRequest = (r) => {
    setEditTarget(r);
    // Pre-populate form with current values
    setEditForm({
      reservation_start_at: r.reservation_start_at
        ? new Date(r.reservation_start_at).toISOString().slice(0, 16)
        : "",
      guest_count: String(r.guest_count ?? ""),
      contact_phone: r.customer_phone || r.contact_phone || "",
      special_request: r.special_request || "",
    });
    setEditConfirm(false);
  };

  const handleSubmitEditRequest = async () => {
    if (!editTarget || submittingEdit) return;
    // Build diff — only include fields that actually changed
    const current = {
      reservation_start_at: editTarget.reservation_start_at
        ? new Date(editTarget.reservation_start_at).toISOString().slice(0, 16)
        : "",
      guest_count: String(editTarget.guest_count ?? ""),
      contact_phone: editTarget.customer_phone || editTarget.contact_phone || "",
      special_request: editTarget.special_request || "",
    };
    const changes = {};
    for (const field of EDIT_FIELDS) {
      const newVal = String(editForm[field.key] ?? "").trim();
      const oldVal = String(current[field.key] ?? "").trim();
      if (newVal !== oldVal && newVal !== "") changes[field.key] = editForm[field.key];
    }
    if (Object.keys(changes).length === 0) {
      setError("No changes detected. Please modify at least one field.");
      return;
    }

    setSubmittingEdit(true);
    try {
      await requestEdit(editTarget.reservation_id, userId, changes);
      setReservations((prev) =>
        prev.map((r) =>
          r.reservation_id === editTarget.reservation_id
            ? { ...r, has_pending_request: 1, request_type: "edit", edit_used_count: 1 }
            : r
        )
      );
      setEditTarget(null);
      setEditConfirm(false);
    } catch (err) {
      setError(err?.message || "Could not submit edit request.");
    } finally {
      setSubmittingEdit(false);
    }
  };

  const renderCard = (r) => {
    const hasPending = Boolean(r.has_pending_request);
    const isValidStatus = r.reservation_status === "Confirmed" || r.reservation_status === "AWAIT CHECK-IN";
    const canEdit = !hasPending && (r.edit_used_count ?? 0) < 1 && isValidStatus;
    const canCancel = !hasPending && isValidStatus;
    const displayStatus = getDisplayStatus(r);

    return (
      <article
        className="rzv-res-card"
        key={r.reservation_id}
        style={{ display: "flex", flexDirection: "row", width: "100%", minHeight: "80px", alignItems: "center", justifyContent: "space-between", padding: "16px 24px" }}
      >
        <header className="rzv-res-card__head" style={{ display: "flex", gap: "24px", alignItems: "center", borderBottom: "none", paddingBottom: 0, margin: 0, flex: 1 }}>
          <div style={{ display: "flex", gap: "24px", alignItems: "center", flexWrap: "wrap", flex: 1 }}>
            <span className="rzv-res-card__id" style={{ minWidth: "120px", margin: 0, color: "var(--rzv-muted)", fontSize: "0.8rem", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>
              Reservation #{String(r.reservation_id).padStart(6, "0")}
            </span>
            <h3 className="rzv-res-card__when rzv-serif" style={{ margin: 0, fontSize: "1.35rem", color: "var(--rzv-text)", fontWeight: 500 }}>
              {formatDateTime(r.reservation_start_at)}
            </h3>
          </div>
          <span className={`rzv-status-pill ${statusModifier(displayStatus)}`} style={{ margin: "0 24px 0 0", fontSize: "11px", whiteSpace: "nowrap" }}>
            {displayStatus}
          </span>
        </header>
        <footer className="rzv-res-card__actions" style={{ marginTop: 0, display: "flex", gap: "10px" }}>
          <button type="button" className="rzv-btn rzv-btn--ghost" onClick={() => setViewDetailsTarget(r)} style={{ padding: "8px 16px", fontSize: "0.8rem" }}>
            View Details
          </button>
          {canEdit && (
            <button type="button" className="rzv-btn rzv-btn--ghost" onClick={() => openEditRequestWithWarning(r)} style={{ padding: "8px 16px", fontSize: "0.8rem" }}>
              Edit
            </button>
          )}
          {canCancel && (
            <button type="button" className="rzv-btn rzv-btn--danger" onClick={() => openCancelRequest(r)} style={{ padding: "8px 16px", fontSize: "0.8rem" }}>
              Cancel
            </button>
          )}
        </footer>
      </article>
    );
  };

  return (
    <main className="rzv-page rzv-myres">
      <section className="rzv-myres__hero">
        <span className="rzv-booking__kicker">Your Table</span>
        <h1 className="rzv-myres__title rzv-serif">MY RESERVATIONS</h1>
        <p className="rzv-myres__lead">
          Review upcoming visits, attach a pre-order, or request changes.
        </p>
      </section>

      <div className="rzv-myres__body">
        {!isAuthenticated ? (
          <div className="rzv-myres__empty">
            <p>Please sign in to view your reservations.</p>
            <button type="button" className="rzv-btn rzv-btn--solid" onClick={() => onNavigateLogin?.()}>
              Sign In
            </button>
          </div>
        ) : null}

        {isAuthenticated && status === "loading" ? (
          <p className="rzv-myres__state">Loading your reservations…</p>
        ) : null}

        {isAuthenticated && status === "error" ? (
          <div className="rzv-myres__empty">
            <p className="rzv-summary__error">{error}</p>
            <button type="button" className="rzv-btn rzv-btn--ghost" onClick={load}>Try again</button>
          </div>
        ) : null}

        {isAuthenticated && status === "ready" ? (
          <>
            {error ? <p className="rzv-summary__error">{error}</p> : null}

            {hasActiveSession ? (
              <section className="rzv-myres__group rzv-myres__qr-card">
                <h2 className="rzv-myres__group-title">Active table session</h2>
                <div className="rzv-res-card">
                  <header className="rzv-res-card__head">
                    <div>
                      <p className="rzv-res-card__id">Table {tableSession?.table_number || `T-${tableSession?.table_id}`}</p>
                      <p className="rzv-res-card__when">
                        Session #{tableSession?.session_id}
                        {tableSession?.area_name ? ` · ${tableSession.area_name}` : ""}
                      </p>
                    </div>
                  </header>
                  <footer className="rzv-res-card__actions">
                    <button type="button" className="rzv-btn rzv-btn--solid" onClick={() => setQrModalOpen(true)}>
                      View QR Table
                    </button>
                  </footer>
                </div>
              </section>
            ) : null}

            {reservations.length === 0 ? (
              <div className="rzv-myres__empty">
                <p>You have no reservations yet.</p>
                <button type="button" className="rzv-btn rzv-btn--solid" onClick={() => onNavigate?.("reservations")}>
                  Book a Table
                </button>
              </div>
            ) : null}

            {upcoming.length > 0 ? (
              <section className="rzv-myres__group">
                <h2 className="rzv-myres__group-title">Upcoming</h2>
                <div className="rzv-myres__list">{upcoming.map(renderCard)}</div>
              </section>
            ) : null}

            {past.length > 0 ? (
              <section className="rzv-myres__group">
                <h2 className="rzv-myres__group-title">Past &amp; Cancelled</h2>
                <div className="rzv-myres__list">{past.map(renderCard)}</div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>

      {hasActiveSession ? (
        <ViewQrTableModal isOpen={qrModalOpen} onClose={() => setQrModalOpen(false)} />
      ) : null}

      {/* ── View Details modal (read-only) ── */}
      {viewDetailsTarget ? (
        <div className="rzv-modal-overlay" onClick={(e) => { if (e.target.className === "rzv-modal-overlay") setViewDetailsTarget(null); }}>
          <div className="rzv-modal" style={{ maxWidth: "600px", width: "100%", padding: "40px", backgroundColor: "#fff", borderRadius: "16px", boxShadow: "0 24px 60px rgba(0,0,0,0.12)" }}>
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: "40px" }}>
              <h2 style={{ fontSize: "2rem", fontWeight: 500, color: "var(--rzv-gold)", margin: "0 0 16px 0", letterSpacing: "0.02em" }}>Reservation Invoice</h2>
              <div style={{ fontSize: "0.85rem", color: "var(--rzv-muted)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                Reservation #{String(viewDetailsTarget.reservation_id).padStart(6, "0")}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px 32px", borderTop: "1px solid var(--rzv-line)", borderBottom: "1px solid var(--rzv-line)", padding: "32px 0", marginBottom: "32px" }}>

              {/* Customer Details */}
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div>
                  <strong style={{ color: "var(--rzv-muted)", display: "block", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>Name</strong>
                  <span style={{ fontSize: "1.05rem", fontWeight: 500 }}>{viewDetailsTarget.customer_name}</span>
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <strong style={{ color: "var(--rzv-muted)", display: "block", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>Email</strong>
                  <span style={{ fontSize: "1.05rem", fontWeight: 500, wordBreak: "break-all" }}>{viewDetailsTarget.customer_email || viewDetailsTarget.email || "—"}</span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div>
                  <strong style={{ color: "var(--rzv-muted)", display: "block", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>Phone</strong>
                  <span style={{ fontSize: "1.05rem", fontWeight: 500 }}>{viewDetailsTarget.customer_phone || viewDetailsTarget.phone || "—"}</span>
                </div>
              </div>

              {/* Timings */}
              <div style={{ gridColumn: "span 2", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "8px" }}>
                <div style={{ background: "var(--rzv-bg)", padding: "16px", borderRadius: "12px" }}>
                  <strong style={{ color: "var(--rzv-muted)", display: "block", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>Request Time</strong>
                  <span style={{ fontSize: "1rem", fontWeight: 500 }}>
                    {viewDetailsTarget.created_at
                      ? format(new Date(viewDetailsTarget.created_at), "EEE, MMM d, yyyy, h:mm a")
                      : "—"}
                  </span>
                </div>
                <div style={{ background: "var(--rzv-bg)", padding: "16px", borderRadius: "12px" }}>
                  <strong style={{ color: "var(--rzv-muted)", display: "block", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>Dining Execution</strong>
                  <span style={{ fontSize: "1rem", fontWeight: 500 }}>
                    {viewDetailsTarget.reservation_start_at
                      ? format(new Date(viewDetailsTarget.reservation_start_at), "EEE, MMM d, yyyy, h:mm a")
                      : "—"}
                  </span>
                </div>
              </div>

              {/* Status & Guests */}
              <div style={{ gridColumn: "span 2", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", borderBottom: "1px solid var(--rzv-line)", paddingBottom: "24px" }}>
                <div>
                  <strong style={{ color: "var(--rzv-muted)", display: "block", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>Status</strong>
                  <span className={`rzv-status-pill ${statusModifier(getDisplayStatus(viewDetailsTarget))}`} style={{ margin: 0, display: "inline-block" }}>{getDisplayStatus(viewDetailsTarget)}</span>
                </div>
                <div>
                  <strong style={{ color: "var(--rzv-muted)", display: "block", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>Guests</strong>
                  <span style={{ fontSize: "1.05rem", fontWeight: 500 }}>{viewDetailsTarget.guest_count} Persons</span>
                </div>

                <div style={{ gridColumn: "span 2", borderTop: "1px solid var(--rzv-line)", paddingTop: "20px", marginTop: "4px" }}>
                  <strong style={{ color: "var(--rzv-muted)", display: "block", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>Designated Zone</strong>
                  <span style={{ fontSize: "1.05rem", fontWeight: 500 }}>{getZoneNameFromTables(viewDetailsTarget.tables) || viewDetailsTarget.area_name || viewDetailsTarget.preferred_area || "—"}</span>
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <strong style={{ color: "var(--rzv-muted)", display: "block", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>Dining Schedule</strong>
                  <span style={{ fontSize: "1.05rem", fontWeight: 500 }}>
                    {viewDetailsTarget.reservation_start_at && viewDetailsTarget.reservation_end_at
                      ? `${format(new Date(viewDetailsTarget.reservation_start_at), "EEE, MMM d, yyyy, h:mm a")} → ${format(new Date(viewDetailsTarget.reservation_end_at), "h:mm a")}`
                      : "—"}
                  </span>
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <strong style={{ color: "var(--rzv-muted)", display: "block", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>Assigned Tables</strong>
                  <span style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--rzv-gold)" }}>
                    {viewDetailsTarget.tables?.length > 0
                      ? viewDetailsTarget.tables.map(t => t.table_number).join(", ")
                      : "—"}
                  </span>
                </div>
              </div>

              {viewDetailsTarget.preorders?.length > 0 && (
                <div style={{ marginBottom: "24px", fontSize: "0.95rem" }}>
                  <strong style={{ color: "var(--rzv-muted)", display: "block", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>Pre-order Items</strong>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, border: "1px solid var(--rzv-line)", borderRadius: "12px", overflow: "hidden" }}>
                    {viewDetailsTarget.preorders.map((p, index) => (
                      <li key={p.dish_id} style={{ padding: "12px 16px", background: index % 2 === 0 ? "var(--rzv-bg)" : "#fff", display: "flex", justifyContent: "space-between" }}>
                        <span>{p.dish_name}</span>
                        <strong style={{ color: "var(--rzv-gold)" }}>×{p.quantity}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(viewDetailsTarget.special_request || viewDetailsTarget.occasion) && (() => {
                const purpose = viewDetailsTarget.occasion;
                const notes = viewDetailsTarget.special_request;
                if (!purpose && !notes) return null;
                return (
                  <div style={{ marginBottom: "32px", fontSize: "0.95rem" }}>
                    {purpose && (
                      <div style={{ marginBottom: "16px", textAlign: "center" }}>
                        <strong style={{ color: "var(--rzv-muted)", display: "block", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>Dining Purpose</strong>
                        <span style={{ fontSize: "1.05rem", fontWeight: 500, color: "var(--rzv-text)" }}>{purpose}</span>
                      </div>
                    )}
                    {notes && (
                      <div>
                        <strong style={{ color: "var(--rzv-muted)", display: "block", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>Special Notes</strong>
                        <p style={{ margin: 0, padding: "16px", backgroundColor: "var(--rzv-bg)", borderLeft: "3px solid var(--rzv-gold)", borderRadius: "0 8px 8px 0", fontStyle: "italic", color: "var(--rzv-text)", lineHeight: 1.6 }}>
                          {notes}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Pending request notice */}
              {viewDetailsTarget.has_pending_request ? (
                <div style={{ gridColumn: "span 2", padding: "16px", backgroundColor: "#fff8e1", border: "1px solid #ffc107", borderRadius: "12px", marginBottom: "16px" }}>
                  <strong style={{ display: "block", color: "#b45309", marginBottom: "8px" }}>Action Required</strong>
                  <p style={{ margin: 0, fontSize: "0.95rem", color: "#92400e" }}>
                    A <strong>{viewDetailsTarget.request_type === "cancel" ? "cancellation" : "edit"} request</strong> is pending Manager review.<br />
                    <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>No further requests can be submitted until this is resolved.</span>
                  </p>
                </div>
              ) : null}

            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", borderTop: "1px solid var(--rzv-line)", paddingTop: "24px" }}>
              {!viewDetailsTarget.has_pending_request &&
                (viewDetailsTarget.edit_used_count ?? 0) < 1 &&
                (viewDetailsTarget.reservation_status === "Confirmed" || viewDetailsTarget.reservation_status === "AWAIT CHECK-IN") && (
                  <button
                    type="button"
                    className="rzv-btn rzv-btn--ghost"
                    style={{ padding: "10px 24px" }}
                    onClick={() => { setViewDetailsTarget(null); openEditRequestWithWarning(viewDetailsTarget); }}
                  >
                    Edit
                  </button>
                )}
              {!viewDetailsTarget.has_pending_request &&
                (viewDetailsTarget.reservation_status === "Confirmed" || viewDetailsTarget.reservation_status === "AWAIT CHECK-IN") && (
                  <button
                    type="button"
                    className="rzv-btn rzv-btn--danger"
                    style={{ padding: "10px 24px" }}
                    onClick={() => { setViewDetailsTarget(null); openCancelRequest(viewDetailsTarget); }}
                  >
                    Cancel
                  </button>
                )}
              <button className="rzv-btn rzv-btn--solid" style={{ padding: "10px 24px" }} onClick={() => setViewDetailsTarget(null)}>Close Invoice</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Cancel Request modal ── */}
      {cancelTarget && !cancelConfirm && (
        <div className="rzv-modal-overlay" onClick={(e) => { if (e.target.className === "rzv-modal-overlay") setCancelTarget(null); }}>
          <div className="rzv-modal" style={{ maxWidth: "420px", width: "100%", padding: "24px", backgroundColor: "#fff", borderRadius: "8px" }}>
            <h2 className="rzv-serif" style={{ marginBottom: "8px" }}>Request Cancellation</h2>
            <p style={{ fontSize: 14, color: "#666", marginBottom: 16 }}>
              Booking <strong>#{String(cancelTarget.reservation_id).padStart(6, "0")}</strong> will remain <strong>Confirmed</strong> until a Manager reviews and processes your request.
            </p>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
              Reason
            </label>
            <textarea
              className="rzv-input"
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Let us know why you're cancelling…"
              style={{ width: "100%", marginBottom: 16, resize: "vertical" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="rzv-btn rzv-btn--ghost" onClick={() => setCancelTarget(null)}>Go Back</button>
              <button type="button" className="rzv-btn rzv-btn--danger" onClick={() => setCancelConfirm(true)}>
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Request — second confirmation */}
      {cancelTarget && cancelConfirm && (
        <div className="rzv-modal-overlay">
          <div className="rzv-modal" style={{ maxWidth: "380px", width: "100%", padding: "24px", backgroundColor: "#fff", borderRadius: "8px" }}>
            <h2 className="rzv-serif" style={{ marginBottom: "8px" }}>Confirm Cancellation Request</h2>
            <p style={{ fontSize: 14, color: "#666", marginBottom: 20 }}>
              Are you sure you want to send a cancellation request for booking <strong>#{String(cancelTarget.reservation_id).padStart(6, "0")}</strong>?
              The manager will process your refund and confirm the cancellation.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="rzv-btn rzv-btn--ghost" disabled={submittingCancel} onClick={() => setCancelConfirm(false)}>Go Back</button>
              <button type="button" className="rzv-btn rzv-btn--danger" disabled={submittingCancel} onClick={handleSubmitCancelRequest}>
                {submittingCancel ? "Submitting…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Request modal ── */}
      {editTarget && !editConfirm && (
        <div className="rzv-modal-overlay" onClick={(e) => { if (e.target.className === "rzv-modal-overlay") setEditTarget(null); }}>
          <div className="rzv-modal" style={{ maxWidth: "480px", width: "100%", padding: "24px", backgroundColor: "#fff", borderRadius: "8px" }}>
            <h2 className="rzv-serif" style={{ marginBottom: "8px" }}>Edit Reservation</h2>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 18 }}>
              You can request one edit per booking. This will be reviewed by the manager.
            </p>
            {EDIT_FIELDS.map((field) => (
              <div key={field.key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                  {field.label}
                </label>
                {field.type === "textarea" ? (
                  <textarea
                    className="rzv-input"
                    rows={3}
                    value={editForm[field.key] || ""}
                    onChange={(e) => setEditForm((p) => ({ ...p, [field.key]: e.target.value }))}
                    style={{ width: "100%", resize: "vertical" }}
                  />
                ) : (
                  <input
                    className="rzv-input"
                    type={field.type}
                    min={field.min}
                    value={editForm[field.key] || ""}
                    onChange={(e) => setEditForm((p) => ({ ...p, [field.key]: e.target.value }))}
                    style={{ width: "100%" }}
                  />
                )}
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button type="button" className="rzv-btn rzv-btn--ghost" onClick={() => setEditTarget(null)}>Cancel</button>
              <button type="button" className="rzv-btn rzv-btn--solid" onClick={() => setEditConfirm(true)}>
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Request — Verify Confirm Request second dialog */}
      {editTarget && editConfirm && (
        <div className="rzv-modal-overlay">
          <div className="rzv-modal" style={{ maxWidth: "380px", width: "100%", padding: "24px", backgroundColor: "#fff", borderRadius: "8px" }}>
            <h2 className="rzv-serif" style={{ marginBottom: "8px" }}>Verify Confirm Request</h2>
            <p style={{ fontSize: 14, color: "#666", marginBottom: 20 }}>
              Submit your edit request for booking <strong>#{String(editTarget.reservation_id).padStart(6, "0")}</strong>?
              The manager will review and apply the changes if approved. Note: you may only request one edit per booking.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="rzv-btn rzv-btn--ghost" disabled={submittingEdit} onClick={() => setEditConfirm(false)}>Go Back</button>
              <button type="button" className="rzv-btn rzv-btn--solid" disabled={submittingEdit} onClick={handleSubmitEditRequest}>
                {submittingEdit ? "Submitting…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit 1-Time Warning Modal ── */}
      {editWarningOpen && (
        <div className="rzv-modal-overlay">
          <div className="rzv-modal" style={{ maxWidth: "400px", width: "100%", padding: "28px", backgroundColor: "#fff", borderRadius: "10px" }}>
            <h2 className="rzv-serif" style={{ marginBottom: "8px", color: "#9f7c3a" }}>⚠️ One-Time Edit Notice</h2>
            <p style={{ fontSize: 14, color: "#555", marginBottom: 20, lineHeight: 1.7 }}>
              You are allowed to edit this reservation <strong>only once</strong>.<br />
              After submitting your edit request, you will <strong>not be able to make further changes</strong> to this booking.<br /><br />
              A confirmation email will be sent to you when the manager applies the changes.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="rzv-btn rzv-btn--ghost" onClick={() => { setEditWarningOpen(false); setEditWarningTarget(null); }}>
                Cancel
              </button>
              <button type="button" className="rzv-btn rzv-btn--solid" onClick={confirmEditWarning}>
                I Understand — Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default MyReservationsPage;
