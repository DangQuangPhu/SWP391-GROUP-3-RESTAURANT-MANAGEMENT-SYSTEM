import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ManagerDrawer } from "../ManagerOverlay.jsx";
import {
  SectionHead,
  ContentPanel,
  Toolbar,
  SearchField,
  StatusBadge,
  Button,
  EmptyState,
  NotConnectedNote,
} from "../ManagerUI.jsx";
import { RESERVATION_STATUS_META, AREAS } from "../../data/managerDashboardMockData.js";
import { getReservationsFilterFromSearch } from "../../config/managerRoutes.js";
import { confirmReservation } from "../../services/managerApi.js";
import { useManagerPortal } from "../../context/ManagerPortalContext.jsx";

const GLOBAL_RES_KEY = "phurai_global_reservations";

const FILTER_TABS = [
  { id: "all", label: "All Reservations" },
  { id: "pending", label: "Pending Approval" },
  { id: "confirmed", label: "Confirmed" },
];

function formatReservationDateTime(reservation) {
  const timeStr = reservation?.start_time || "—";
  const dateRaw = reservation?.reservation_date;
  if (!dateRaw) return timeStr;
  try {
    const day = parseISO(String(dateRaw).includes("T") ? dateRaw : `${dateRaw}T12:00:00`);
    return `${format(day, "MMM d")} - ${timeStr}`;
  } catch {
    return `${dateRaw} - ${timeStr}`;
  }
}

/**
 * Manager Reservations Section — THE APPROVER
 * 
 * Business Logic (per PRD):
 *   Manager reviews Pending bookings → [Confirm & Assign Table] or [Reject].
 *   Staff only sees Confirmed bookings and can only [Check-in].
 * 
 * This component handles the Manager's approval responsibilities ONLY.
 */
function ReservationsSection({ reservations, setReservations, tables = [], setTables, toast }) {
  const { user } = useManagerPortal();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [area, setArea] = useState("all");
  const [active, setActive] = useState(null);

  /* ── Assign Table drawer state ── */
  const [assignTarget, setAssignTarget] = useState(null);
  const [selectedTable, setSelectedTable] = useState("");

  const reservationList = Array.isArray(reservations) ? reservations : [];
  const tableList = Array.isArray(tables) ? tables : [];

  /* ── URL filter sync ── */
  const urlFilter = useMemo(
    () => getReservationsFilterFromSearch(`?${searchParams.toString()}`),
    [searchParams]
  );

  const selectFilterTab = (nextFilter) => {
    if (nextFilter === "all") {
      setSearchParams({}, { replace: true });
      setStatusFilter("all");
      return;
    }
    setSearchParams({ filter: nextFilter }, { replace: true });
    setStatusFilter(nextFilter);
  };

  useEffect(() => {
    if (urlFilter === "pending") setStatusFilter("pending");
    else if (urlFilter === "confirmed") setStatusFilter("confirmed");
    else if (urlFilter === "arriving") setStatusFilter("pending");
  }, [urlFilter]);

  /* ── Filtered list ── */
  const filtered = useMemo(() => {
    return reservationList.filter((r) => {
      const kw = search.trim().toLowerCase();
      const matchKw =
        !kw ||
        r.customer_name?.toLowerCase().includes(kw) ||
        r.table_label?.toLowerCase().includes(kw) ||
        String(r.customer_phone || r.phone || "").includes(kw) ||
        String(r.reservation_id || "").includes(kw);
      const statusMatchVal = (r.status || r.reservation_status || "").toLowerCase();
      const matchStatus =
        statusFilter === "all" || statusMatchVal === statusFilter.toLowerCase();
      const matchArea = area === "all" || r.area_name === area;
      return matchKw && matchStatus && matchArea;
    });
  }, [reservationList, search, statusFilter, area]);

  /* ── KPI counts ── */
  const pendingCount = useMemo(
    () => reservationList.filter((r) => (r.status || r.reservation_status || "").toLowerCase() === "pending").length,
    [reservationList]
  );
  const confirmedCount = useMemo(
    () => reservationList.filter((r) => (r.status || r.reservation_status || "").toLowerCase() === "confirmed").length,
    [reservationList]
  );

  /* ── Available tables for assignment (only Available tables) ── */
  const availableTables = useMemo(() => {
    if (!assignTarget) return [];
    return tableList.filter(
      (t) =>
        (t.status === "available" || t.table_status === "Available") &&
        t.capacity >= (assignTarget.party_size || 1)
    );
  }, [assignTarget, tableList]);

  /* ════════════════════════════════════════════════════════════
     STATE MACHINE HANDLERS (Manager-Only Actions)
     ════════════════════════════════════════════════════════════ */

  /**
   * handleConfirmAndAssign — Pending → Confirmed
   * Also sets the assigned table to "Reserved".
   */
  const handleConfirmAndAssign = useCallback(async () => {
    if (!assignTarget) return;
    if (!selectedTable) {
      toast("Please select a table before confirming.", "error");
      return;
    }

    const table = tableList.find((t) => String(t.table_id) === selectedTable);

    try {
      await confirmReservation(assignTarget.reservation_id, [parseInt(selectedTable, 10)], user?.user_id);
      
      // 1. Update local state
      setReservations((prev) =>
        prev.map((r) =>
          r.reservation_id === assignTarget.reservation_id
            ? {
                ...r,
                status: "confirmed",
                reservation_status: "Confirmed",
                table_id: table?.table_id,
                table_label: table?.table_number || selectedTable,
                area_name: table?.area_name || r.area_name,
              }
            : r
        )
      );

      // 2. Table Sync: Available → Reserved
      if (table && setTables) {
        setTables((prev) =>
          prev.map((t) =>
            String(t.table_id) === String(table.table_id)
              ? { ...t, status: "reserved", table_status: "Reserved" }
              : t
          )
        );
      }

      toast(
        `Booking #${assignTarget.reservation_id} confirmed → Table ${table?.table_number || selectedTable} reserved.`,
        "success"
      );
      setAssignTarget(null);
      setSelectedTable("");
    } catch (err) {
      toast(err.message || "Failed to confirm reservation.", "error");
    }
  }, [assignTarget, selectedTable, tableList, setReservations, setTables, toast, user]);

  /**
   * handleReject — Pending/Confirmed → Rejected
   * Releases assigned table back to Available if one was set.
   */
  const handleReject = useCallback(
    (reservation) => {
      if (!window.confirm(`Reject booking #${reservation.reservation_id} from ${reservation.customer_name}?`)) return;

      // 1. Update reservation status
      let updatedList;
      setReservations((prev) => {
        updatedList = prev.map((r) =>
          r.reservation_id === reservation.reservation_id
            ? { ...r, status: "cancelled", reservation_status: "Rejected" }
            : r
        );
        return updatedList;
      });

      // 2. Release assigned table if any
      const tableId = reservation.table_id;
      if (tableId && setTables) {
        setTables((prev) =>
          prev.map((t) =>
            String(t.table_id) === String(tableId)
              ? { ...t, status: "available", table_status: "Available" }
              : t
          )
        );
      }

      // 3. (Optional) In real app we might call a reject API endpoint here
      toast(`Booking #${reservation.reservation_id} rejected. Table released.`, "info");
      setActive(null);
    },
    [setReservations, setTables, toast]
  );

  /* ── Open the Assign drawer ── */
  const openAssignDrawer = (reservation) => {
    setAssignTarget(reservation);
    setSelectedTable("");
  };

  /* ════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════ */

  return (
    <div className="sfx-stack">
      <SectionHead
        title="Reservations"
        subtitle={`${pendingCount} pending · ${confirmedCount} confirmed · ${reservationList.length} total`}
      />

      <ContentPanel compact>
        {/* ── Tab bar ── */}
        <div className="sfx-tabs" role="tablist" aria-label="Reservation views">
          {FILTER_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={statusFilter === t.id}
              className={`sfx-tab ${statusFilter === t.id ? "is-active" : ""}`}
              onClick={() => selectFilterTab(t.id)}
            >
              {t.label}
              {t.id === "pending" && pendingCount > 0 ? (
                <span
                  style={{
                    marginLeft: "8px",
                    background: "#f59e0b",
                    color: "#fff",
                    borderRadius: "10px",
                    padding: "2px 8px",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  {pendingCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* ── Toolbar ── */}
        <Toolbar>
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Customer, table, phone, or booking ID…"
          />
          <select
            className="sfx-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            {Object.entries(RESERVATION_STATUS_META).map(([k, m]) => (
              <option key={k} value={k}>
                {m.label}
              </option>
            ))}
          </select>
          <select className="sfx-select" value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="all">All areas</option>
            {AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </Toolbar>

        {/* ── Table ── */}
        <div className="sfx-card sfx-card--flush">
          <div className="sfx-table-wrap">
            <table className="sfx-table sfx-table--hover">
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Date & Time</th>
                  <th>Customer</th>
                  <th>Guests</th>
                  <th>Area / Table</th>
                  <th>Occasion</th>
                  <th>Status</th>
                  <th className="sfx-table__right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const currentStatus = (r.status || r.reservation_status || "").toLowerCase();
                  const currentStatusCased = r.reservation_status || "Pending";
                  const meta = RESERVATION_STATUS_META[currentStatus] || RESERVATION_STATUS_META[currentStatusCased] || { label: currentStatusCased, tone: "default" };
                  const isPending = currentStatus === "pending";
                  const isConfirmed = currentStatus === "confirmed";

                  return (
                    <tr key={r.reservation_id}>
                      <td className="sfx-mono" style={{ fontWeight: 600 }}>
                        #{String(r.reservation_id).padStart(6, "0")}
                      </td>
                      <td className="sfx-mono">{formatReservationDateTime(r)}</td>
                      <td>
                        <strong>{r.customer_name}</strong>
                        <small className="sfx-cell-sub">{r.customer_phone || r.phone || "—"}</small>
                      </td>
                      <td>{r.guest_count || r.party_size}</td>
                      <td>
                        {r.area_name}
                        <small className="sfx-cell-sub">{r.table_label || r.assigned_tables || "Unassigned"}</small>
                      </td>
                      <td>{r.special_request || r.occasion || "—"}</td>
                      <td>
                        <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                      </td>
                      <td className="sfx-table__right">
                        <div className="sfx-rowacts">
                          <Button size="sm" variant="ghost" icon="eye" onClick={() => setActive(r)}>
                            View
                          </Button>

                          {/* MANAGER ACTION: Confirm & Assign (Pending only) */}
                          {isPending && (
                            <>
                              <Button
                                size="sm"
                                variant="gold"
                                onClick={() => openAssignDrawer(r)}
                              >
                                Confirm & Assign
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => handleReject(r)}
                              >
                                Reject
                              </Button>
                            </>
                          )}

                          {/* MANAGER ACTION: Reject confirmed (edge case) */}
                          {isConfirmed && (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleReject(r)}
                            >
                              Reject
                            </Button>
                          )}

                          {/* Checked-In / Completed / Cancelled / No-Show: no actions */}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 ? (
            <EmptyState
              title="No reservations match your filters"
              hint="Try clearing the search or status filter."
            />
          ) : null}
        </div>
      </ContentPanel>

      {/* ── Detail Drawer (View) ── */}
      <ManagerDrawer
        open={Boolean(active)}
        title="Reservation Details"
        onClose={() => setActive(null)}
        footer={
          active && (active.status || active.reservation_status || "").toLowerCase() === "pending" ? (
            <div className="sfx-drawer__acts">
              <Button
                variant="danger"
                onClick={() => handleReject(active)}
              >
                Reject booking
              </Button>
              <Button
                variant="gold"
                onClick={() => {
                  setActive(null);
                  openAssignDrawer(active);
                }}
              >
                Confirm & Assign Table
              </Button>
            </div>
          ) : active && (active.status || active.reservation_status || "").toLowerCase() === "confirmed" ? (
            <div className="sfx-drawer__acts">
              <Button variant="danger" onClick={() => handleReject(active)}>
                Reject booking
              </Button>
            </div>
          ) : null
        }
      >
        {active ? (
          <div className="sfx-detail">
            <div style={{ textAlign: "center", marginBottom: 24, marginTop: 8 }}>
              <h2 style={{ fontSize: "28px", margin: "0 0 12px 0", fontWeight: 700, letterSpacing: "0.05em" }}>
                #{String(active.reservation_id).padStart(6, "0")}
              </h2>
              <StatusBadge tone={RESERVATION_STATUS_META[(active.status || active.reservation_status || "").toLowerCase()]?.tone || "default"}>
                {RESERVATION_STATUS_META[(active.status || active.reservation_status || "").toLowerCase()]?.label || active.reservation_status}
              </StatusBadge>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 16, alignItems: "start" }}>
                <span style={{ color: "var(--sfx-muted)", fontWeight: "normal", fontSize: "13px" }}>Customer Name</span>
                <strong style={{ fontWeight: "bold", fontSize: "14px" }}>{active.customer_name}</strong>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 16, alignItems: "start" }}>
                <span style={{ color: "var(--sfx-muted)", fontWeight: "normal", fontSize: "13px" }}>Contact Phone</span>
                <strong style={{ fontWeight: "bold", fontSize: "14px" }}>{active.phone || "—"}</strong>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 16, alignItems: "start" }}>
                <span style={{ color: "var(--sfx-muted)", fontWeight: "normal", fontSize: "13px" }}>Email Address</span>
                <strong style={{ fontWeight: "bold", fontSize: "14px" }}>{active.email || "—"}</strong>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 16, alignItems: "start" }}>
                <span style={{ color: "var(--sfx-muted)", fontWeight: "normal", fontSize: "13px" }}>Date</span>
                <strong style={{ fontWeight: "bold", fontSize: "14px" }}>{active.reservation_date}</strong>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 16, alignItems: "start" }}>
                <span style={{ color: "var(--sfx-muted)", fontWeight: "normal", fontSize: "13px" }}>Time</span>
                <strong style={{ fontWeight: "bold", fontSize: "14px" }}>{active.start_time}</strong>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 16, alignItems: "start" }}>
                <span style={{ color: "var(--sfx-muted)", fontWeight: "normal", fontSize: "13px" }}>Guests</span>
                <strong style={{ fontWeight: "bold", fontSize: "14px" }}>{active.party_size}</strong>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 16, alignItems: "start" }}>
                <span style={{ color: "var(--sfx-muted)", fontWeight: "normal", fontSize: "13px" }}>Table</span>
                <strong style={{ fontWeight: "bold", fontSize: "14px" }}>{active.table_label || "Unassigned"}</strong>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 16, alignItems: "start" }}>
                <span style={{ color: "var(--sfx-muted)", fontWeight: "normal", fontSize: "13px" }}>Area</span>
                <strong style={{ fontWeight: "bold", fontSize: "14px" }}>{active.area_name}</strong>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 16, alignItems: "start" }}>
                <span style={{ color: "var(--sfx-muted)", fontWeight: "normal", fontSize: "13px" }}>Occasion</span>
                <strong style={{ fontWeight: "bold", fontSize: "14px" }}>{active.occasion || "—"}</strong>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 16, alignItems: "start" }}>
                <span style={{ color: "var(--sfx-muted)", fontWeight: "normal", fontSize: "13px" }}>Promotions</span>
                <strong style={{ fontWeight: "bold", fontSize: "14px" }}>{active.promotions || "None"}</strong>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 16, alignItems: "start" }}>
                <span style={{ color: "var(--sfx-muted)", fontWeight: "normal", fontSize: "13px" }}>Notes</span>
                <strong style={{ fontWeight: "bold", fontSize: "14px", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                  {active.special_request || active.notes || "—"}
                </strong>
              </div>
            </div>

            <div className="sfx-detail__block" style={{ marginTop: 24 }}>
              <span style={{ color: "var(--sfx-muted)", fontWeight: "normal", fontSize: "13px", marginBottom: 8, display: "block" }}>Pre-ordered items</span>
              {active.preorder?.length ? (
                <ul className="sfx-detail__list">
                  {active.preorder.map((p, i) => (
                    <li key={i}>
                      <span>{p.dish_name}</span>
                      <strong>×{p.qty}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>None</p>
              )}
            </div>
            <NotConnectedNote>
              Status changes apply to this view only — reservation write API not connected.
            </NotConnectedNote>
          </div>
        ) : null}
      </ManagerDrawer>

      {/* ── Assign Table Drawer (Manager confirms + assigns) ── */}
      <ManagerDrawer
        open={Boolean(assignTarget)}
        title={assignTarget ? `Confirm & Assign — ${assignTarget.customer_name}` : ""}
        onClose={() => setAssignTarget(null)}
        footer={
          <div className="sfx-drawer__acts">
            <Button variant="ghost" onClick={() => setAssignTarget(null)}>
              Cancel
            </Button>
            <Button variant="gold" onClick={handleConfirmAndAssign}>
              Confirm & Assign Table
            </Button>
          </div>
        }
      >
        {assignTarget ? (
          <div className="sfx-assign-form" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ padding: "12px 16px", background: "rgba(245, 158, 11, 0.1)", borderRadius: "8px", border: "1px solid rgba(245, 158, 11, 0.2)" }}>
              <p style={{ margin: 0, fontSize: "14px", color: "#92400e" }}>
                <strong>Pending Approval</strong> — Review details and assign a table to confirm this booking.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <span style={{ fontSize: "12px", color: "#888", textTransform: "uppercase" }}>Guest</span>
                <p style={{ margin: "4px 0 0", fontWeight: 600 }}>{assignTarget.customer_name}</p>
              </div>
              <div>
                <span style={{ fontSize: "12px", color: "#888", textTransform: "uppercase" }}>Party Size</span>
                <p style={{ margin: "4px 0 0", fontWeight: 600 }}>{assignTarget.party_size} guests</p>
              </div>
              <div>
                <span style={{ fontSize: "12px", color: "#888", textTransform: "uppercase" }}>Date</span>
                <p style={{ margin: "4px 0 0", fontWeight: 600 }}>{assignTarget.reservation_date}</p>
              </div>
              <div>
                <span style={{ fontSize: "12px", color: "#888", textTransform: "uppercase" }}>Time</span>
                <p style={{ margin: "4px 0 0", fontWeight: 600 }}>{assignTarget.start_time}</p>
              </div>
              <div>
                <span style={{ fontSize: "12px", color: "#888", textTransform: "uppercase" }}>Preferred Area</span>
                <p style={{ margin: "4px 0 0", fontWeight: 600 }}>{assignTarget.area_name || "Any"}</p>
              </div>
              <div>
                <span style={{ fontSize: "12px", color: "#888", textTransform: "uppercase" }}>Occasion</span>
                <p style={{ margin: "4px 0 0", fontWeight: 600 }}>{assignTarget.occasion || "—"}</p>
              </div>
            </div>
            {assignTarget.special_request ? (
              <div style={{ padding: "10px 14px", background: "rgba(59, 130, 246, 0.06)", borderRadius: "6px" }}>
                <span style={{ fontSize: "12px", color: "#888", textTransform: "uppercase" }}>Special Request</span>
                <p style={{ margin: "4px 0 0" }}>{assignTarget.special_request}</p>
              </div>
            ) : null}
            <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontWeight: 600, fontSize: "14px" }}>
                Assign Table ({availableTables.length} available for {assignTarget.party_size}+ guests)
              </span>
              <select
                className="sfx-select"
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                style={{ padding: "10px 12px", fontSize: "14px" }}
              >
                <option value="">Choose an available table…</option>
                {availableTables.map((t) => (
                  <option key={t.table_id} value={String(t.table_id)}>
                    {t.table_number} · {t.area_name} ({t.capacity} seats)
                  </option>
                ))}
              </select>
            </label>
            {availableTables.length === 0 ? (
              <p style={{ color: "#ef4444", fontSize: "13px", margin: 0 }}>
                No available tables fit this party size. Consider releasing a reserved table first.
              </p>
            ) : null}
          </div>
        ) : null}
      </ManagerDrawer>
    </div>
  );
}

export default ReservationsSection;
