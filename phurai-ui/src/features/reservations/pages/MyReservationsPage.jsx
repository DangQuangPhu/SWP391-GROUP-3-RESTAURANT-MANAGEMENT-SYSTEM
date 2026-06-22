import { useCallback, useEffect, useMemo, useState } from "react";
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
  { key: "guest_count",          label: "Guests",      type: "number", min: 1 },
  { key: "contact_phone",        label: "Phone",       type: "tel" },
  { key: "special_request",      label: "Special Request / Dining Purpose", type: "textarea" },
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
  const [status, setStatus]             = useState("idle");
  const [error, setError]               = useState("");
  const [qrModalOpen, setQrModalOpen]   = useState(false);

  // View Details modal (read-only — never repurposed for editing)
  const [viewDetailsTarget, setViewDetailsTarget] = useState(null);

  // Cancel Request modal states
  const [cancelTarget, setCancelTarget]       = useState(null);
  const [cancelReason, setCancelReason]       = useState("");
  const [cancelConfirm, setCancelConfirm]     = useState(false);
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // Edit Request modal states
  const [editTarget, setEditTarget]         = useState(null);
  const [editForm, setEditForm]             = useState({});
  const [editConfirm, setEditConfirm]       = useState(false);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editWarningOpen, setEditWarningOpen] = useState(false); // 1-time edit warning
  const [editWarningTarget, setEditWarningTarget] = useState(null);

  const { hasActiveSession, session: tableSession } = useTableSession();

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
    const handleResolved  = () => load();
    socket.on("reservation:processed",        handleProcessed);
    socket.on("reservation:request_resolved", handleResolved);
    return () => {
      socket.off("reservation:processed",        handleProcessed);
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
      guest_count:    String(r.guest_count ?? ""),
      contact_phone:  r.customer_phone || r.contact_phone || "",
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
      guest_count:    String(editTarget.guest_count ?? ""),
      contact_phone:  editTarget.customer_phone || editTarget.contact_phone || "",
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

  // ── Card renderer ──────────────────────────────────────────────────────────
  const renderCard = (r) => {
    const hasPending = Boolean(r.has_pending_request);
    const canEdit   = !hasPending && (r.edit_used_count ?? 0) < 1 && r.reservation_status === "Confirmed";
    const canCancel = !hasPending && r.reservation_status === "Confirmed";
    const displayStatus = getDisplayStatus(r);

    return (
      <article
        className="rzv-res-card"
        key={r.reservation_id}
        style={{ display: "flex", flexDirection: "row", width: "100%", maxHeight: "80px", alignItems: "center", justifyContent: "space-between", padding: "16px" }}
      >
        <header className="rzv-res-card__head" style={{ display: "flex", gap: "24px", alignItems: "center", borderBottom: "none", paddingBottom: 0, margin: 0, flex: 1 }}>
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <span className="rzv-res-card__id" style={{ minWidth: "140px", margin: 0, color: "var(--rzv-muted)" }}>
              Booking #{String(r.reservation_id).padStart(6, "0")}
            </span>
            <h3 className="rzv-res-card__when rzv-serif" style={{ margin: 0 }}>
              {formatDateTime(r.reservation_start_at)}
            </h3>
          </div>
          <span className={`rzv-status-pill ${statusModifier(displayStatus)}`} style={{ margin: 0, fontSize: "11px" }}>
            {displayStatus}
          </span>
        </header>
        <footer className="rzv-res-card__actions" style={{ marginTop: 0, display: "flex", gap: 8 }}>
          <button type="button" className="rzv-btn rzv-btn--ghost" onClick={() => setViewDetailsTarget(r)}>
            View Details
          </button>
          {canEdit && (
            <button type="button" className="rzv-btn rzv-btn--ghost" onClick={() => openEditRequestWithWarning(r)}>
              Edit
            </button>
          )}
          {canCancel && (
            <button type="button" className="rzv-btn rzv-btn--danger" onClick={() => openCancelRequest(r)}>
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
          <div className="rzv-modal" style={{ maxWidth: "500px", width: "100%", padding: "24px", backgroundColor: "#fff", borderRadius: "8px" }}>
            <h2 className="rzv-serif" style={{ marginBottom: "16px" }}>Reservation Invoice</h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "14px", marginBottom: "20px" }}>
              <div><strong>Name:</strong> {viewDetailsTarget.customer_name || "---"}</div>
              <div><strong>Phone:</strong> {viewDetailsTarget.customer_phone || "---"}</div>
              <div style={{ gridColumn: "span 2" }}><strong>Email:</strong> {viewDetailsTarget.customer_email || "---"}</div>
              <div><strong>Request Time:</strong><br />{formatDateTime(viewDetailsTarget.created_time || viewDetailsTarget.created_at)}</div>
              <div><strong>Dining Execution:</strong><br />{formatDateTime(viewDetailsTarget.reservation_start_at)}</div>
              <div><strong>Status:</strong> {getDisplayStatus(viewDetailsTarget)}</div>
              <div><strong>Guests:</strong> {viewDetailsTarget.guest_count}</div>
              <div style={{ gridColumn: "span 2" }}>
                <strong>Designated Zone:</strong>{" "}
                {viewDetailsTarget.area_name || viewDetailsTarget.preferred_area || "—"}
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <strong>Dining Schedule:</strong>{" "}
                {formatDateTime(viewDetailsTarget.reservation_start_at)}
                {viewDetailsTarget.reservation_end_at
                  ? ` → ${new Date(viewDetailsTarget.reservation_end_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
                  : ""}
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <strong>Assigned Tables:</strong>{" "}
                {viewDetailsTarget.assigned_tables || viewDetailsTarget.tables?.map((t) => t.display_label || t.table_number).join(", ") || "—"}
              </div>
            </div>

            {viewDetailsTarget.preorders?.length > 0 && (
              <div style={{ marginBottom: "20px", fontSize: "14px" }}>
                <strong>Pre-order Items:</strong>
                <ul style={{ paddingLeft: "20px", marginTop: "4px" }}>
                  {viewDetailsTarget.preorders.map((p) => (
                    <li key={p.dish_id}>{p.quantity}× {p.dish_name}</li>
                  ))}
                </ul>
              </div>
            )}

            {viewDetailsTarget.special_request && (
              <div style={{ marginBottom: "20px", fontSize: "14px" }}>
                <strong>Special Notes:</strong>
                <p style={{ marginTop: "4px", padding: "8px", backgroundColor: "#f5f5f5", borderRadius: "4px" }}>
                  {viewDetailsTarget.special_request}
                </p>
              </div>
            )}

            {/* Pending request notice */}
            {viewDetailsTarget.has_pending_request ? (
              <div style={{ padding: "10px 14px", background: "#fff8e6", borderRadius: 6, fontSize: 13, marginBottom: 16, color: "#7a5500", border: "1px solid #f0c040" }}>
                ⏳ A <strong>{viewDetailsTarget.request_type === "cancel" ? "cancellation" : "edit"} request</strong> is pending Manager review.
                No further requests can be submitted until this is resolved.
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              {/* Edit button inside View Details — same modal trigger as card */}
              {!viewDetailsTarget.has_pending_request &&
               (viewDetailsTarget.edit_used_count ?? 0) < 1 &&
               viewDetailsTarget.reservation_status === "Confirmed" && (
                <button
                  type="button"
                  className="rzv-btn rzv-btn--ghost"
                  onClick={() => { setViewDetailsTarget(null); openEditRequestWithWarning(viewDetailsTarget); }}
                >
                  Edit
                </button>
              )}
              {/* Cancel button — now submits a Cancel Request, not instant cancel */}
              {!viewDetailsTarget.has_pending_request &&
               viewDetailsTarget.reservation_status === "Confirmed" && (
                <button
                  type="button"
                  className="rzv-btn rzv-btn--danger"
                  onClick={() => { setViewDetailsTarget(null); openCancelRequest(viewDetailsTarget); }}
                >
                  Cancel
                </button>
              )}
              <button className="rzv-btn rzv-btn--solid" onClick={() => setViewDetailsTarget(null)}>Close</button>
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
              Reason (optional)
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
