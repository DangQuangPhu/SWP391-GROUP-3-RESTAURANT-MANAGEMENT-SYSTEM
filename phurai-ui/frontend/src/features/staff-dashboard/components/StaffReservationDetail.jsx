/**
 * StaffReservationDetail
 * Full-detail drawer content for a reservation — Staff portal version.
 * Layout mirrors the Manager drawer (ReservationsSection.jsx) but is read-only
 * (no edit mode) and shows Staff-specific check-in / check-out records.
 */
import { useEffect, useState } from "react";
import { Bone } from "./StaffSkeleton.jsx";
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
  CANCEL_RESERVATION: "Reservation Cancelled",
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
      <div style={{ display: "flex", flexDirection: "column", gap: "20px", position: "relative", paddingLeft: "10px" }} aria-busy="true" aria-label="Loading timeline">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <Bone w={12} h={12} radius={6} />
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
              <Bone w="45%" h={14} />
              <Bone w="30%" h={11} />
            </div>
          </div>
        ))}
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
    area_name, preferred_area, assigned_area_name,
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
  const tableList = Array.isArray(assigned_tables) ? assigned_tables : reservation.tables;
  const tableAreaName = Array.isArray(tableList)
    ? tableList.find((table) => table?.area_name)?.area_name
    : null;
  const displayAreaName = tableAreaName || assigned_area_name || area_name || preferred_area || null;

  const resolveTableName = () => {
    if (assigned_tables && String(assigned_tables).trim() !== "" && assigned_tables !== "Unassigned" && assigned_tables !== "—") return assigned_tables;
    if (table_label && String(table_label).trim() !== "" && table_label !== "Unassigned" && table_label !== "—") return table_label;
    if (reservation.preferred_table_number) return `Table ${reservation.preferred_table_number} (Preferred)`;
    if (reservation.preferred_table_name) return `${reservation.preferred_table_name} (Preferred)`;
    if (reservation.table_number) return `Table ${reservation.table_number}`;
    if (Array.isArray(reservation.tables) && reservation.tables.length > 0) {
      const names = reservation.tables.map(t => typeof t === "string" ? t : (t.table_number || t.table_label || t.name)).filter(Boolean).join(", ");
      if (names) return names;
    }
    const prefMatch = String(noteText || "").match(/\[PreferredTable:\s*([^\]]+)\]/i) || String(noteText || "").match(/\[Preferred Table:\s*([^\]]+)\]/i);
    if (prefMatch && prefMatch[1]) return `${prefMatch[1].trim()} (Preferred)`;
    return null;
  };

  const displayTableName = resolveTableName();

  const displayNoteText = (() => {
    if (!noteText) return null;
    const cleaned = String(noteText)
      .replace(/\[PreferredTableId:[^\]]*\]/gi, "")
      .replace(/\[PreferredTable:[^\]]*\]/gi, "")
      .replace(/\[Assignment:[^\]]*\]/gi, "")
      .trim();
    return cleaned.length > 0 ? cleaned : null;
  })();

  const isPendingRequest = Boolean(
    reservation.has_pending_request === 1 ||
    reservation.has_pending_request === true ||
    reservation.reservation_status === "Pending Request" ||
    reservation.status === "Pending Request" ||
    reservation.reservation_status === "Request" ||
    reservation.status === "Request" ||
    (reservation.pending_changes_json && reservation.pending_changes_json !== "{}" && reservation.pending_changes_json !== "null") ||
    (reservation.request_type && reservation.request_type !== "")
  );

  return (
    <div className="sfx-detail" style={{ padding: "0 2px" }}>
      {/* ── Header ── */}
      <div style={{ textAlign: "center", marginBottom: 20, marginTop: 8 }}>
        <h2 style={{ fontSize: 28, margin: "0 0 10px", fontWeight: 700, letterSpacing: "0.05em" }}>
          #{String(reservation_id).padStart(6, "0")}
        </h2>
        {isPendingRequest ? (
          <span style={{ display: "inline-flex", alignItems: "center", background: "rgba(245, 158, 11, 0.12)", color: "#b45309", fontSize: 12, fontWeight: 800, padding: "5px 16px", borderRadius: 24, letterSpacing: "0.08em", border: "1px solid rgba(245, 158, 11, 0.35)", textTransform: "uppercase" }}>
            PENDING REQUEST
          </span>
        ) : (
          <ReservationStatusBadge status={reservation_status} size="md" />
        )}
        {diningPurpose && (
          <div style={{ marginTop: 10 }}>
            <span style={{ display: "inline-block", background: "rgba(201,169,110,0.15)", color: "#b09460", padding: "4px 10px", borderRadius: 6, fontSize: 13, fontWeight: 600, border: "1px solid rgba(201,169,110,0.3)" }}>
              {diningPurpose}
            </span>
          </div>
        )}
      </div>

      {/* ── 50-50 Split Layout for Pending Requests ── */}
      {isPendingRequest ? (() => {
        let pendingChanges = {};
        try { pendingChanges = JSON.parse(reservation.pending_changes_json || "{}"); } catch (_) { }

        const fmt = (iso) => {
          try { return format(new Date(iso), "dd/MM/yyyy HH:mm"); } catch { return String(iso || "—"); }
        };

        let preferredTable = null;
        const prefMatch = String(noteText || "").match(/\[PreferredTable:\s*([^\]]+)\]/i);
        if (prefMatch && prefMatch[1]) {
          preferredTable = prefMatch[1].trim();
        }

        const rawOrigTable = assigned_tables || table_label || null;
        const origTable = rawOrigTable
          ? rawOrigTable
          : preferredTable
            ? `${preferredTable} (Preferred)`
            : "Not Assigned Yet";

        const newTable = pendingChanges.table_ids
          ? `Table #${pendingChanges.table_ids.join(", ")}`
          : pendingChanges.table_label
            ? pendingChanges.table_label
            : origTable;

        const origArea = displayAreaName || "Any Area";
        const newArea = pendingChanges.area_name || pendingChanges.preferred_area || origArea;

        const origStart = reservation_start_at ? fmt(reservation_start_at) : "—";
        const newStart = pendingChanges.reservation_start_at ? fmt(pendingChanges.reservation_start_at) : origStart;

        const origEnd = reservation_end_at ? fmt(reservation_end_at) : "—";
        const newEnd = pendingChanges.reservation_end_at ? fmt(pendingChanges.reservation_end_at) : origEnd;

        const origGuests = String(guest_count || "—") + " Guests";
        const newGuests = (pendingChanges.guest_count != null ? String(pendingChanges.guest_count) : String(guest_count || "—")) + " Guests";

        const origPhone = customer_phone || phone || "—";
        const newPhone = pendingChanges.contact_phone || pendingChanges.phone || origPhone;

        const origNotesVal = displayNoteText || "None";
        const rawNewNotes = pendingChanges.special_request || pendingChanges.notes;
        const cleanedNewNotes = rawNewNotes ? String(rawNewNotes).replace(/\[PreferredTableId:[^\]]*\]/gi, "").replace(/\[PreferredTable:[^\]]*\]/gi, "").replace(/\[Assignment:[^\]]*\]/gi, "").trim() : null;
        const newNotesVal = rawNewNotes !== undefined ? (cleanedNewNotes || "None") : origNotesVal;

        const origDining = diningPurpose || "None";
        const newDining = pendingChanges.dining_purpose || pendingChanges.occasion || origDining;

        const compareFields = [
          { label: "Request Time", orig: fmtDateTime(reservation.created_at || reservation.created_time), new: fmtDateTime(reservation.created_at || reservation.created_time) },
          { label: "Customer Name", orig: customer_name || "—", new: customer_name || "—" },
          { label: "Contact Phone", orig: origPhone, new: newPhone },
          { label: "Email Address", orig: customer_email || email || "—", new: customer_email || email || "—" },
          { label: "Start Time", orig: origStart, new: newStart },
          { label: "Est. Duration (ERT)", orig: duration, new: duration },
          { label: "Guests", orig: origGuests, new: newGuests },
          { label: "Table", orig: origTable, new: newTable },
          { label: "Area", orig: origArea, new: newArea },
          { label: "Dining Purpose", orig: origDining, new: newDining },
          { label: "Notes", orig: origNotesVal, new: newNotesVal },
        ];

        return (
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", background: "#ffffff", boxShadow: "0 4px 14px rgba(0, 0, 0, 0.04)" }}>
            {/* Card Header */}
            <div style={{ background: "#f8fafc", padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#334155", letterSpacing: "0.06em", textTransform: "uppercase" }}>CHANGE REQUEST COMPARISON</span>
              <span style={{ fontSize: 11, fontWeight: 700, background: "#f59e0b", color: "#ffffff", padding: "3px 10px", borderRadius: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>AWAITING DECISION</span>
            </div>

            {/* Column Titles */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #e2e8f0", background: "#f1f5f9" }}>
              <div style={{ padding: "10px 16px", borderRight: "1px solid #e2e8f0", fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                ORIGINAL BOOKING
              </div>
              <div style={{ padding: "10px 16px", fontSize: 11, fontWeight: 800, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                REQUESTED CHANGES
              </div>
            </div>

            {/* Row-by-Row 50-50 Grid */}
            <div>
              {compareFields.map((field, idx) => {
                const isDiff = field.orig !== field.new;
                return (
                  <div
                    key={field.label}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      borderBottom: idx < compareFields.length - 1 ? "1px solid #f1f5f9" : "none",
                    }}
                  >
                    {/* Left Cell: Original */}
                    <div style={{ padding: "11px 16px", borderRight: "1px solid #e2e8f0", background: "#ffffff" }}>
                      <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600, display: "block", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 3 }}>
                        {field.label}
                      </span>
                      <span style={{ fontSize: 13, color: "#1e293b", fontWeight: 600, wordBreak: "break-word" }}>
                        {field.orig}
                      </span>
                    </div>

                    {/* Right Cell: Requested */}
                    <div style={{ padding: "11px 16px", background: isDiff ? "#f0fdf4" : "#ffffff" }}>
                      <span style={{ fontSize: 11, color: isDiff ? "#15803d" : "#64748b", fontWeight: 600, display: "block", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 3 }}>
                        {field.label}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, color: isDiff ? "#15803d" : "#1e293b", fontWeight: isDiff ? 700 : 600, wordBreak: "break-word" }}>
                          {field.new}
                        </span>
                        {isDiff && (
                          <span style={{ fontSize: 10, background: "#dcfce7", color: "#15803d", border: "1px solid #86efac", fontWeight: 700, padding: "1px 6px", borderRadius: 4 }}>
                            Changed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })() : (
        /* ── Standard Info Grid for Non-Pending Reservations ── */
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
          <DetailRow label="Est. Duration (ERT)"><EmptyVal val={duration} fallback="60 minutes" /></DetailRow>
          <DetailRow label="Guests"><EmptyVal val={guest_count} /></DetailRow>
          <DetailRow label="Table">
            <span style={{ fontWeight: 600 }}>{displayTableName || <span style={{ color: "var(--sfx-muted, #9ca3af)", fontStyle: "italic", fontWeight: 400 }}>Unassigned</span>}</span>
          </DetailRow>
          <DetailRow label="Area">{displayAreaName || <span style={{ color: "var(--sfx-muted, #9ca3af)", fontStyle: "italic", fontWeight: 400 }}>Any</span>}</DetailRow>
          <DetailRow label="Dining Purpose"><EmptyVal val={diningPurpose} fallback="None" /></DetailRow>
          <DetailRow label="Status"><EmptyVal val={reservation_status} /></DetailRow>
          <DetailRow label="Notes">
            {displayNoteText
              ? <span style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{displayNoteText}</span>
              : <EmptyVal val="" fallback="None" />
            }
          </DetailRow>
        </div>
      )}

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
    </div>
  );
}

export default StaffReservationDetail;
