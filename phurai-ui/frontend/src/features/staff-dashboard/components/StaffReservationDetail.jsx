/**
 * StaffReservationDetail
 * Full-detail drawer content for a reservation — Staff portal version.
 * Layout mirrors the Manager drawer (ReservationsSection.jsx) but is read-only
 * (no edit mode) and shows Staff-specific check-in / check-out records.
 */
import { useEffect, useState } from "react";
import { format } from "date-fns";
import ReservationStatusBadge from "@/components/shared/ReservationStatusBadge.jsx";
import EmptyVal from "@/components/shared/EmptyVal.jsx";
import { fetchReservationTimeline } from "../services/staffApi.js";

/* ── Timeline dot colors by action ── */
const TIMELINE_COLOR = {
  RESERVATION_CREATED: "#c9a96e",
  MANAGER_CONFIRMED: "#3b82f6",
  CHECK_IN_RESERVATION: "#22c55e",
  STAFF_CHECKIN_CONFIRMED: "#22c55e",
  PAYMENT_CHECKOUT_AUTO: "#c2610a",
  STAFF_CHECKOUT_CONFIRMED: "#7c5cbf",
  REJECT_RESERVATION: "#ef4444",
  REJECT_CHECKIN: "#ef4444",
  MANAGER_CANCELLED_RESERVATION: "#ef4444",
  CANCEL_RESERVATION: "#ef4444",
  CUSTOMER_CANCEL_REQUEST: "#f59e0b",
  CUSTOMER_EDIT_REQUEST: "#f59e0b",
  MANAGER_RESOLVE_REQUEST: "#14b8a6",
  MANAGER_DECLINE_REQUEST: "#ef4444",
  MANAGER_APPROVED_EDIT: "#14b8a6",
  MANAGER_EDIT_RESERVATION: "#14b8a6",
  STAFF_SEND_COOKING_QUEUE: "#8b5cf6",
  "Staff Send Cooking Queue": "#8b5cf6",
  SEED_TEST_RESERVATION: "#c9a96e",
};

/* ── Action friendly labels (fallback if server doesn't map) ── */
const ACTION_DISPLAY = {
  RESERVATION_CREATED: "Reservation Create",
  MANAGER_CONFIRMED: "Confirm Request Check-in Create",
  CHECK_IN_RESERVATION: "Confirm Check-in Create",
  STAFF_CHECKIN_CONFIRMED: "Confirm Check-in Create",
  PAYMENT_CHECKOUT_AUTO: "Complete Paid Create",
  STAFF_CHECKOUT_CONFIRMED: "Confirm Check-out Created",
  REJECT_RESERVATION: "Reject Request Check-in Create",
  REJECT_CHECKIN: "Reject Check-in Create",
  MANAGER_CANCELLED_RESERVATION: "Reject Request Check-in Create",
  CANCEL_RESERVATION: "Booking Cancelled",
  CUSTOMER_CANCEL_REQUEST: "Cancellation Requested",
  CUSTOMER_EDIT_REQUEST: "Edit Request Sent",
  MANAGER_RESOLVE_REQUEST: "Confirm Request Check-in Create",
  MANAGER_DECLINE_REQUEST: "Reject Request Check-in Create",
  MANAGER_APPROVED_EDIT: "Edit Approved",
  MANAGER_EDIT_RESERVATION: "Reservation Edited",
  STAFF_SEND_COOKING_QUEUE: "Sent to Kitchen",
  "Staff Send Cooking Queue": "Sent to Kitchen",
  SEED_TEST_RESERVATION: "Seed Test Reservation",
  REJECT_CHECKOUT: "Reject Check-out Created",
};

/* ── Helpers ── */
function fmtDate(iso) {
  if (!iso) return "—";
  try { return format(new Date(iso), "dd/MM/yyyy"); } catch { return "—"; }
}
function fmtDateTime(iso) {
  if (!iso) return "—";
  try { return format(new Date(iso), "dd/MM/yyyy HH:mm"); } catch { return "—"; }
}

function parseHoldMinutes(specialRequest) {
  if (!specialRequest) return null;
  const m = specialRequest.match(/\[Hold:\s*(\d+)m\]/i);
  return m ? Number(m[1]) : null;
}
function formatDuration(startAt, endAt, holdMins) {
  if (startAt && endAt) {
    const diff = Math.round((new Date(endAt) - new Date(startAt)) / 60000);
    if (diff > 0) return `${diff} minutes`;
  }
  if (holdMins) return `${holdMins} minutes`;
  return "—";
}

/* ── Row helper ── */
function DetailRow({ label, children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: "8px 16px", alignItems: "start" }}>
      <span style={{ color: "var(--sfx-muted, #8a8175)", fontWeight: "normal", fontSize: "13px", alignSelf: "center" }}>
        {label}
      </span>
      <strong style={{ fontWeight: "bold", fontSize: "14px", color: "var(--text-color, #1a1a1a)" }}>
        {children}
      </strong>
    </div>
  );
}

/* ── Timeline ── */
function TimelineList({ reservationId, userId, customerName }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

// ... skipping unchanged lines, actually let's just do a specific replace block

  useEffect(() => {
    if (!reservationId) { setLoading(false); return; }
    setLoading(true);
    fetchReservationTimeline(reservationId, userId)
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [reservationId, userId]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="sfx-spinner" style={{ width: 14, height: 14 }} />
        <span style={{ fontSize: 13, color: "var(--sfx-muted, #8a8175)" }}>Loading timeline…</span>
      </div>
    );
  }
  if (!items.length) {
    return <p style={{ fontSize: 13, color: "var(--sfx-muted, #8a8175)", fontStyle: "italic" }}>No activity yet.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, position: "relative" }}>
      {items.map((item, idx) => {
        const color = TIMELINE_COLOR[item.action_name] || "#8a8175";
        const label = ACTION_DISPLAY[item.action_name] || item.label || item.action_name;
        const tsStr = item.timestamp_formatted || fmtDateTime(item.timestamp);
        const formattedTs = tsStr !== "—" ? tsStr.replace(" ", " ") : "";
        let actorName = item.actor_name || "System";
        const isCreated = item.action_name === "RESERVATION_CREATED";
        
        let actorPrefix = isCreated
          ? "Customer"
          : (
            ["CHECK_IN_RESERVATION", "STAFF_CHECKIN_CONFIRMED", "STAFF_CHECKOUT_CONFIRMED", "REJECT_RESERVATION", "REJECT_CHECKIN", "STAFF_SEND_COOKING_QUEUE", "Staff Send Cooking Queue"].includes(item.action_name)
              ? "Staff"
              : ["MANAGER_CONFIRMED", "MANAGER_RESOLVE_REQUEST", "MANAGER_APPROVED_EDIT", "MANAGER_DECLINE_REQUEST", "MANAGER_CANCELLED_RESERVATION", "MANAGER_EDIT_RESERVATION"].includes(item.action_name)
                ? "Manager"
                : ["CUSTOMER_EDIT_REQUEST", "CUSTOMER_CANCEL_REQUEST"].includes(item.action_name)
                  ? "Customer"
                  : item.action_name === "PAYMENT_CHECKOUT_AUTO" ? null : "System"
          );
          
        if (isCreated && actorName === "System") {
           actorName = item.customer_name || item.contact_name || customerName || "Unknown"; 
        }

        // Extract sent_to from new_value_json if it's a kitchen queue action
        let destInfo = "";
        if (item.action_name === "Staff Send Cooking Queue" || item.action_name === "STAFF_SEND_COOKING_QUEUE") {
          try {
            const nv = JSON.parse(item.new_value_json || "{}");
            if (nv.sent_to) destInfo = ` ➔ ${nv.sent_to}`;
          } catch (e) { }
        }

        return (
          <div key={item.log_id ?? idx} style={{ display: "flex", gap: 12, paddingBottom: 16, position: "relative" }}>
            {/* Vertical connector */}
            {idx < items.length - 1 && (
              <div style={{ position: "absolute", left: 8, top: 20, bottom: 0, width: 2, background: "var(--border-color, rgba(0,0,0,0.08))", borderRadius: 2 }} />
            )}
            {/* Dot */}
            <div style={{
              width: 18, height: 18, borderRadius: "50%", background: color, flexShrink: 0, marginTop: 2,
              boxShadow: `0 0 0 3px color-mix(in srgb, ${color} 20%, transparent)`,
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-color, #1a1a1a)" }}>{label}:</span>
                <span style={{ fontSize: 13, color: "var(--text-color, #1a1a1a)", whiteSpace: "nowrap" }}>{formattedTs}</span>
              </div>
              {actorPrefix !== null && (
                <span style={{ fontSize: 12, color: "var(--sfx-muted, #8a8175)", display: "block", marginTop: 2 }}>
                  By {actorPrefix}{isCreated ? " : " : " "}{actorName}{destInfo}
                </span>
              )}
              {/* Show cancel reason if present */}
              {item.cancel_reason && (
                <div style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>
                  Reason: {item.cancel_reason}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Main component ── */
function StaffReservationDetail({ reservation, userId, checkedInAt: checkedInAtProp }) {
  if (!reservation) return null;

  const {
    reservation_id,
    reservation_status,
    customer_name,
    customer_phone, phone,
    customer_email, email,
    reservation_start_at,
    reservation_end_at,
    reservation_date,
    start_time,
    guest_count,
    table_label, assigned_tables,
    area_name, preferred_area,
    special_request, notes,
    occasion, dining_purpose,
    checked_in_at,
    checked_out_at,
    checked_in_by_name,
    checked_out_by_name,
  } = reservation;

  const checkedInAt = checkedInAtProp || checked_in_at;

  const diningPurpose = dining_purpose || occasion || null;
  const noteText = special_request || notes || null;
  const holdMins = parseHoldMinutes(special_request);
  const duration = formatDuration(reservation_start_at, reservation_end_at, holdMins);

  const FadedUnassigned = <span style={{ color: "var(--sfx-muted, #9ca3af)", fontStyle: "italic", fontWeight: 400 }}>Unassigned</span>;
  const FadedAny = <span style={{ color: "var(--sfx-muted, #9ca3af)", fontStyle: "italic", fontWeight: 400 }}>Any</span>;

  return (
    <div className="sfx-detail" style={{ padding: "0 2px" }}>
      {/* ── Header ── */}
      <div style={{ textAlign: "center", marginBottom: 24, marginTop: 8 }}>
        <h2 style={{ fontSize: 28, margin: "0 0 12px", fontWeight: 700, letterSpacing: "0.05em" }}>
          #{String(reservation_id).padStart(6, "0")}
        </h2>
        <ReservationStatusBadge status={reservation_status} size="md" />
        {diningPurpose && (
          <div style={{ marginTop: 12 }}>
            <span style={{ display: "inline-block", background: "rgba(201,169,110,0.15)", color: "#b09460", padding: "4px 10px", borderRadius: 6, fontSize: 13, fontWeight: 600, border: "1px solid rgba(201,169,110,0.3)" }}>
              ★ {diningPurpose}
            </span>
          </div>
        )}
      </div>

      {/* ── Info grid ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <DetailRow label="Request Time">
          <span style={{ color: "var(--sfx-gold, #b09460)" }}>
            {fmtDateTime(reservation.created_at || reservation.created_time)}
          </span>
        </DetailRow>
        <DetailRow label="Customer Name"><EmptyVal val={customer_name} /></DetailRow>
        <DetailRow label="Contact Phone"><EmptyVal val={customer_phone || phone} /></DetailRow>
        <DetailRow label="Email Address">
          <span style={{ wordBreak: "break-all" }}><EmptyVal val={customer_email || email} /></span>
        </DetailRow>
        <DetailRow label="Start Time">
          <EmptyVal val={reservation_start_at ? format(new Date(reservation_start_at), "HH:mm (dd/MM/yyyy)") : (start_time ? `${start_time} (${reservation_date})` : null)} />
        </DetailRow>
        <DetailRow label="End Time">
          <EmptyVal val={reservation_end_at ? format(new Date(reservation_end_at), "HH:mm (dd/MM/yyyy)") : "—"} />
        </DetailRow>
        <DetailRow label="Duration"><EmptyVal val={duration} fallback="None" /></DetailRow>
        <DetailRow label="Guests"><EmptyVal val={guest_count} /></DetailRow>
        <DetailRow label="Table">
          <span style={{ fontWeight: 600 }}>{assigned_tables || table_label || FadedUnassigned}</span>
        </DetailRow>
        <DetailRow label="Area">{area_name || preferred_area || FadedAny}</DetailRow>
        <DetailRow label="Dining Purpose"><EmptyVal val={diningPurpose} fallback="None" /></DetailRow>
        <DetailRow label="Status"><EmptyVal val={reservation_status} /></DetailRow>
        <DetailRow label="Notes">
          {noteText
            ? <span style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{noteText}</span>
            : <EmptyVal val="" fallback="None" />
          }
        </DetailRow>
      </div>

      {/* ── Check-in / Check-out records ── */}
      {(checkedInAt || checked_out_at) && (
        <>
          <hr style={{ margin: "20px 0", border: "none", borderTop: "1px solid var(--border-color, rgba(0,0,0,0.08))" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {checkedInAt && (
              <DetailRow label="Checked in">
                <span style={{ color: "#2f7d4f" }}>
                  {fmtDateTime(checkedInAt)}
                  {checked_in_by_name && (
                    <span style={{ fontWeight: 400, color: "var(--sfx-muted, #8a8175)", fontSize: 12, marginLeft: 6 }}>
                      · by {checked_in_by_name}
                    </span>
                  )}
                </span>
              </DetailRow>
            )}
            {checked_out_at && (
              <DetailRow label="Checked out">
                <span style={{ color: "#7c5cbf" }}>
                  {fmtDateTime(checked_out_at)}
                  {checked_out_by_name && (
                    <span style={{ fontWeight: 400, color: "var(--sfx-muted, #8a8175)", fontSize: 12, marginLeft: 6 }}>
                      · by {checked_out_by_name}
                    </span>
                  )}
                </span>
              </DetailRow>
            )}
          </div>
        </>
      )}

      {/* ── Pre-ordered items ── */}
      <div style={{ marginTop: 24 }}>
        <span style={{ color: "var(--sfx-muted, #8a8175)", fontSize: 13, marginBottom: 8, display: "block" }}>
          Pre-ordered items
        </span>
        {(() => {
          const preorders = reservation.preorders || reservation.preorder || [];
          return preorders.length ? (
            <ul className="sfx-detail__list">
              {preorders.map((p, i) => (
                <li key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>{p.dish_name || `Dish #${p.dish_id}`}</span>
                  <strong>×{p.quantity || p.qty}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0 }}><EmptyVal val="" fallback="None" /></p>
          );
        })()}
      </div>

      {/* ── Timeline ── */}
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border-color, rgba(0,0,0,0.08))" }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-color, #1a1a1a)", marginBottom: 12, display: "block" }}>
          Reservation Timeline
        </span>
        <TimelineList reservationId={reservation_id} userId={userId} customerName={customer_name || reservation.contact_name} />
      </div>
    </div>
  );
}

export default StaffReservationDetail;
