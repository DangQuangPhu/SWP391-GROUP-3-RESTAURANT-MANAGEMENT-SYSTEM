import { createContext, useContext, useCallback, useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  TableCardSkeleton,
  SkeletonPresence,
  fadeScaleVariants,
} from "./StaffSkeleton.jsx";
import {
  SectionHead,
  SearchField,
  StatusBadge,
  Button,
  NotConnectedNote,
  EmptyState,
} from "./StaffUI.jsx";
import Icon from "./StaffIcons.jsx";
import {
  checkInStaffTable,
  checkInStaffReservation,
  rejectStaffReservation,
  resetStaffTable,
  markStaffTableClean,
  mergeTablesApi,
  unmergeTableApi,
  fetchStaffReservationDetail,
} from "../services/staffApi.js";
import { formatBookingId } from "@/features/reservations/utils/formatBookingId.js";
import { DEMO_NOTICE, TABLE_STATUS_META } from "@/shared/constants.js";
import "../styles/staff-table-tab.css";

const FILTER_STATUS_SLUGS = ["available", "reserved", "occupied", "cleaning"];

const STATUS_LABEL_TO_SLUG = {
  Available: "available",
  Reserved: "reserved",
  Occupied: "occupied",
  Cleaning: "cleaning",
  Inactive: "inactive",
};

const STATUS_META = {
  Available: { label: "Available", tone: "available", slug: "available" },
  Occupied: { label: "Occupied", tone: "occupied", slug: "occupied" },
  Cleaning: { label: "Cleaning", tone: "cleaning", slug: "cleaning" },
  Reserved: { label: "Reserved", tone: "reserved", slug: "reserved" },
  Inactive: { label: "Inactive", tone: "muted", slug: "inactive" },
};

function normalizeTableStatus(table) {
  const raw = table?.table_status ?? table?.status ?? "Available";
  const text = String(raw).trim();
  if (STATUS_META[text]) return text;

  const slug = text.toLowerCase().replace(/\s+/g, "_");
  if (slug === "available") return "Available";
  if (slug === "occupied") return "Occupied";
  if (slug === "cleaning") return "Cleaning";
  if (slug === "reserved") return "Reserved";
  if (slug === "inactive") return "Inactive";
  return "Available";
}

function getTableStatusSlug(table) {
  const raw = String(table?.status ?? "").trim().toLowerCase();
  if (TABLE_STATUS_META[raw]) return raw;

  const normalized = normalizeTableStatus(table);
  return STATUS_LABEL_TO_SLUG[normalized] || "available";
}

function isManagerUser(user) {
  const roleId = Number(user?.roleId ?? user?.role_id);
  return roleId === 4 || roleId === 5;
}

function sameTableId(left, right) {
  if (left == null || right == null) return false;
  const a = Number(left);
  const b = Number(right);
  if (Number.isFinite(a) && Number.isFinite(b)) return a === b;
  return String(left) === String(right);
}

function getAssignedTableId(reservation) {
  if (!reservation) return null;

  const direct =
    reservation.assignedTableId ??
    reservation.assigned_table_id ??
    reservation.table_id;
  if (direct != null && direct !== "") return direct;

  const fromList = reservation.assigned_tables?.[0]?.table_id;
  return fromList != null && fromList !== "" ? fromList : null;
}

function formatDurationLabel(minutes) {
  const mins = Number(minutes);
  if (!Number.isFinite(mins) || mins <= 0) return null;
  if (mins < 60) return `${mins} minutes`;
  if (mins === 60) return "1 hour";
  if (mins === 90) return "1.5 hours";
  if (mins % 60 === 0) {
    const hours = mins / 60;
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  }
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  return `${hours}h ${remainder}m`;
}

function parseTaggedField(text, tag) {
  const re = new RegExp(`\\[${tag}:\\s*([^\\]]+)\\]`, "i");
  const match = String(text || "").match(re);
  return match ? match[1].trim() : null;
}

function buildReservationBriefing(reservation) {
  const specialRequest = reservation?.special_request || "";
  const holdMinutes =
    reservation?.hold_duration_minutes ??
    (() => {
      const match = specialRequest.match(/\[Hold:\s*(\d+)m\]/i);
      return match ? Number(match[1]) : null;
    })();

  const durationMinutes = reservation?.duration_minutes ?? holdMinutes ?? null;
  const diningPurpose =
    reservation?.dining_purpose ||
    parseTaggedField(specialRequest, "Dining Purpose") ||
    "Not specified";
  const specialNotes =
    specialRequest
      .replace(/\[[^\]]+\]\s*/g, "")
      .replace(/\n+/g, " ")
      .trim() || null;
  const tableDisplay =
    reservation?.table_label && reservation.table_label !== "—"
      ? `${reservation.table_label} (${reservation.area_name || "Unassigned"})`
      : reservation?.table_number
        ? `${reservation.table_number} (${reservation.area_name || "Unassigned"})`
        : "Not assigned yet";

  return {
    diningPurpose,
    durationMinutes,
    durationLabel: formatDurationLabel(durationMinutes),
    specialNotes,
    tableDisplay,
    assignedTableId: getAssignedTableId(reservation),
  };
}

function BriefingDetail({ label, value }) {
  return (
    <div className="staff-checkin-brief__cell">
      <span className="staff-checkin-brief__label">{label}</span>
      <span className="staff-checkin-brief__value">{value}</span>
    </div>
  );
}

function getTablesForReservationCheckIn(tables, reservation) {
  const partySize = Number(reservation?.guest_count ?? 1);
  const assignedTableId = getAssignedTableId(reservation);
  const tableList = Array.isArray(tables) ? [...tables] : [];

  if (assignedTableId != null) {
    const hasAssigned = tableList.some((table) =>
      sameTableId(table.table_id, assignedTableId)
    );
    if (!hasAssigned) {
      const fromReservation = reservation.assigned_tables?.find((table) =>
        sameTableId(table.table_id, assignedTableId)
      );
      if (fromReservation) {
        tableList.push(fromReservation);
      }
    }
  }

  return tableList
    .filter((table) => {
      const status = normalizeTableStatus(table);
      const isAssigned = sameTableId(table.table_id, assignedTableId);
      const fitsParty = Number(table.capacity ?? 0) >= partySize;

      if (isAssigned && status === "Reserved") return true;
      if (status === "Available" && fitsParty) return true;
      return false;
    })
    .sort((a, b) => {
      const aPreferred = sameTableId(a.table_id, assignedTableId) ? -1 : 0;
      const bPreferred = sameTableId(b.table_id, assignedTableId) ? -1 : 0;
      if (aPreferred !== bPreferred) return aPreferred - bPreferred;
      return String(a.table_number).localeCompare(String(b.table_number));
    })
    .map((table) => ({
      ...table,
      fitsParty: Number(table.capacity ?? 0) >= partySize,
    }));
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="staff-table-action__lock">
      <path
        d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* =========================================================================
   COMPOUND COMPONENTS ARCHITECTURE
   ========================================================================= */

const TableManagementContext = createContext(null);

function useTableManagement() {
  const ctx = useContext(TableManagementContext);
  if (!ctx) throw new Error("useTableManagement must be used within TableManagementProvider");
  return ctx;
}

function TableManagementProvider({ children, value }) {
  return (
    <TableManagementContext.Provider value={value}>
      {children}
    </TableManagementContext.Provider>
  );
}

function TableManagementHeader() {
  const { state, actions } = useTableManagement();
  const { tables, areas, dataSource, refreshing } = state;
  const { handleRefreshAll } = actions;

  return (
    <div className="staff-card staff-table-intro">
      <SectionHead
        title="Table Management"
        subtitle={`${tables.length} tables across ${areas.length} areas`}
        actions={
          <Button
            variant="ghost"
            size="sm"
            icon="refresh"
            onClick={handleRefreshAll}
            disabled={refreshing}
          >
            Refresh
          </Button>
        }
      />
      {dataSource === "mock" ? (
        <NotConnectedNote>{DEMO_NOTICE}</NotConnectedNote>
      ) : null}
    </div>
  );
}

function TableManagementToolbar() {
  const { state, actions } = useTableManagement();
  const { searchTerm, selectedArea, selectedStatuses, areas } = state;
  const { setSearchTerm, setSelectedArea, toggleStatusFilter } = actions;

  return (
    <div className="staff-card staff-card--compact">
      <div className="sfx-filterbar sfx-filterbar--horizontal">
        <SearchField
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search table number..."
        />

        <label className="sfx-field sfx-filterbar__area">
          <span>Area</span>
          <select
            className="sfx-select"
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
          >
            <option value="">All Areas</option>
            {areas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </label>

        <div className="sfx-filterbar__statuses">
          <span className="sfx-filterbar__label">Status</span>
          <div className="sfx-chips">
            {FILTER_STATUS_SLUGS.map((slug) => {
              const active = selectedStatuses.includes(slug);
              const meta = TABLE_STATUS_META[slug];
              return (
                <button
                  key={slug}
                  type="button"
                  className={`sfx-chip ${active ? "is-active" : "sfx-chip--outline"}`}
                  aria-pressed={active}
                  onClick={() => toggleStatusFilter(slug)}
                >
                  <i className={`sfx-dot sfx-dot--${meta.tone}`} />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function TableManagementFloorMap() {
  const { state, actions } = useTableManagement();
  const { groupedEntries, refreshing, isJiggling } = state;
  const {
    handlePointerDown,
    handlePointerUpOrLeave,
    handleDragStart,
    handleDrop,
    setSelectedTable,
    handleUnmerge,
  } = actions;

  return (
    <div className={`sfx-tablemap-wrap${refreshing ? " is-loading" : ""}`}>
      {!refreshing && groupedEntries.length === 0 ? (
        <div className="sfx-card">
          <div className="sfx-card__body">
            <p className="sfx-muted">No tables match the current filters.</p>
          </div>
        </div>
      ) : null}

      {groupedEntries.map(([areaName, list]) => (
        <div key={areaName} className="sfx-card">
          <header className="sfx-card__head">
            <h3 className="sfx-card__title">{areaName}</h3>
            <span className="sfx-muted">{list.length} tables</span>
          </header>
          <div className="sfx-card__body">
            <div className="sfx-tablemap">
              {list.map((table) => {
                const slug = getTableStatusSlug(table);
                const meta = TABLE_STATUS_META[slug] || TABLE_STATUS_META.available;
                const displayNum = table.combined_names.join(" | ");
                const canMerge = isJiggling && !table.is_counter;

                return (
                  <article
                    key={table.table_id}
                    draggable={canMerge}
                    onPointerDown={(e) => handlePointerDown(e, table)}
                    onPointerUp={handlePointerUpOrLeave}
                    onPointerLeave={handlePointerUpOrLeave}
                    onDragStart={(e) => handleDragStart(e, table)}
                    onDragOver={(e) => {
                      if (canMerge) e.preventDefault();
                    }}
                    onDrop={(e) => handleDrop(e, table)}
                    className={`sfx-mtile sfx-mtile--${meta.tone} ${canMerge ? "is-jiggling" : ""}`}
                  >
                    <span className="sfx-mtile__no">{displayNum}</span>
                    <span className="sfx-mtile__cap">{table.combined_capacity} seats</span>
                    <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                    <div
                      className="sfx-tabletile__actions"
                      style={{
                        marginTop: "8px",
                        display: "flex",
                        gap: "4px",
                        flexWrap: "wrap",
                        justifyContent: "center",
                      }}
                    >
                      {!isJiggling ? (
                        meta.slug === "cleaning" ? (
                          <Button size="sm" variant="soft" onClick={(e) => { e.stopPropagation(); actions.handleMarkClean(table); }}>
                            Mark as Cleaned
                          </Button>
                        ) : (
                          <Button size="sm" onClick={() => setSelectedTable(table)}>
                            Manage
                          </Button>
                        )
                      ) : null}
                      {table.child_ids?.length > 0 && !isJiggling ? (
                        <Button
                          size="sm"
                          variant="soft"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnmerge(table.table_id);
                          }}
                        >
                          Separate
                        </Button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TableManagementTableModal() {
  const { state, actions } = useTableManagement();
  const { selectedTable: table, user, actionBusy: busy, toast } = state;
  const { setSelectedTable, handleCheckIn, handleReset } = actions;

  if (!table) return null;

  const status = normalizeTableStatus(table);
  const meta = STATUS_META[status] || STATUS_META.Available;
  const manager = isManagerUser(user);
  const onClose = () => setSelectedTable(null);

  const showCheckIn = status === "Available";
  const showViewReservation = status === "Reserved";
  const showCheckOut = status === "Occupied" || status === "Cleaning";

  return createPortal(
    <div
      className="staff-table-modal fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-table-modal-title"
    >
      <button
        type="button"
        className="staff-table-modal__backdrop fixed inset-0 z-[100] w-screen h-screen bg-black/50"
        aria-label="Close table actions"
        onClick={onClose}
      />
      <div className="staff-table-modal__panel relative z-[101]">
        <header className="staff-table-modal__head">
          <div>
            <p className="staff-table-modal__eyebrow">{table.area_name}</p>
            <h2 id="staff-table-modal-title" className="staff-table-modal__title">
              Table {table.table_number}
            </h2>
          </div>
          <button
            type="button"
            className="staff-table-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="close" size={18} />
          </button>
        </header>

        <div className="staff-table-modal__meta">
          <span className={`staff-table-status staff-table-status--${meta.tone}`}>
            {meta.label}
          </span>
          <span className="staff-table-modal__cap">{table.capacity} seats</span>
          {table.active_session_id ? (
            <span className="staff-table-modal__session">
              Session #{table.active_session_id}
            </span>
          ) : null}
          {table.active_reservation_customer_name ? (
            <span className="staff-table-modal__session" style={{ backgroundColor: "rgba(59, 130, 246, 0.1)", color: "#2563eb", border: "1px solid rgba(59, 130, 246, 0.2)" }}>
              Reserved for {table.active_reservation_customer_name}
            </span>
          ) : null}
        </div>

        <div className="staff-table-modal__actions">
          {showCheckIn ? (
            <button
              type="button"
              className="sfx-btn sfx-btn--gold sfx-btn--md staff-table-action"
              onClick={() => handleCheckIn(table)}
              disabled={busy}
            >
              Check-in
            </button>
          ) : null}

          {showViewReservation ? (
            <button
              type="button"
              className="sfx-btn sfx-btn--gold sfx-btn--md staff-table-action"
              onClick={async () => {
                if (table.active_reservation_id) {
                  setSelectedTable(null);
                  try {
                    const userId = Number(user?.userId ?? user?.id);
                    const resDetail = await fetchStaffReservationDetail(table.active_reservation_id, userId);
                    actions.setCheckInReservation(resDetail.reservation || resDetail);
                  } catch (err) {
                    toast?.(err.message || "Failed to load reservation details", "error");
                  }
                } else {
                  toast?.("No active reservation found for this table.", "error");
                }
              }}
              disabled={busy}
            >
              View Reservation
            </button>
          ) : null}

          {showCheckOut ? (
            <button
              type="button"
              className="sfx-btn sfx-btn--ghost sfx-btn--md staff-table-action"
              onClick={() => handleReset(table)}
              disabled={busy}
            >
              Check-out
            </button>
          ) : null}

          <button
            type="button"
            className="sfx-btn sfx-btn--ghost sfx-btn--md staff-table-action staff-table-action--locked"
            disabled={!manager}
            title={manager ? "Move table (coming soon)" : "Manager role required"}
          >
            {!manager ? <LockIcon /> : null}
            Move Table
          </button>
        </div>
        <p style={{ marginTop: "16px", fontSize: "12px", color: "var(--sfx-muted)", textAlign: "center" }}>
          Tip: Long-press any table card to drag and merge it.
        </p>
      </div>
    </div>,
    document.body
  );
}

function TableManagementReservationModal() {
  const { state, actions } = useTableManagement();
  const { checkInReservation: reservation, tables, actionBusy: busy } = state;
  const { setCheckInReservation, handleConfirmReservationCheckIn, handleRejectReservation } = actions;

  const [selectedTableId, setSelectedTableId] = useState("");
  const [showTablePicker, setShowTablePicker] = useState(false);

  const onClose = () => setCheckInReservation(null);

  const briefing = useMemo(
    () => (reservation ? buildReservationBriefing(reservation) : null),
    [reservation]
  );

  const options = useMemo(
    () => getTablesForReservationCheckIn(tables, reservation),
    [tables, reservation]
  );

  const partySize = reservation?.guest_count ?? "—";
  const timeAndDuration = briefing?.durationLabel
    ? `${reservation?.start_time || "—"} (${briefing.durationLabel})`
    : reservation?.start_time || "—";

  useEffect(() => {
    if (!reservation) {
      setSelectedTableId("");
      setShowTablePicker(false);
      return;
    }

    const assignedId = getAssignedTableId(reservation);
    setSelectedTableId(assignedId != null ? String(assignedId) : "");
    setShowTablePicker(false);
  }, [reservation?.reservation_id]);

  useEffect(() => {
    if (!reservation || options.length === 0) return;

    setSelectedTableId((prev) => {
      if (prev && options.some((table) => String(table.table_id) === prev)) {
        return prev;
      }

      const assignedId = getAssignedTableId(reservation);
      const assignedStr = assignedId != null ? String(assignedId) : "";
      if (assignedStr && options.some((table) => String(table.table_id) === assignedStr)) {
        return assignedStr;
      }

      return String(options[0].table_id);
    });
  }, [reservation, options]);

  if (!reservation || !briefing) return null;

  const phone = reservation.customer_phone || reservation.phone;
  const email = reservation.customer_email || reservation.email;
  const contactLine = [phone, email].filter(Boolean).join(" · ");

  return createPortal(
    <div
      className="staff-table-modal staff-table-modal--light staff-table-modal--briefing fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-reservation-checkin-title"
    >
      <button
        type="button"
        className="staff-table-modal__backdrop fixed inset-0 z-[100] w-screen h-screen bg-black/50"
        aria-label="Close check-in"
        onClick={onClose}
      />
      <div className="staff-table-modal__panel staff-checkin-brief relative z-[101]">
        <header className="staff-checkin-brief__head">
          <div>
            <p className="staff-checkin-brief__eyebrow">Reservation check-in</p>
            <h2 id="staff-reservation-checkin-title" className="staff-checkin-brief__guest">
              {reservation.customer_name}
            </h2>
            <p className="staff-checkin-brief__booking-id">
              ID: {formatBookingId(reservation.reservation_id)}
            </p>
            {contactLine ? (
              <p className="staff-checkin-brief__contact">{contactLine}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="staff-table-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="close" size={18} />
          </button>
        </header>

        <div className="staff-checkin-brief__grid">
          <BriefingDetail label="Time & duration" value={timeAndDuration} />
          <BriefingDetail
            label="Guests"
            value={`${partySize} ${Number(partySize) === 1 ? "person" : "people"}`}
          />
          <BriefingDetail label="Assigned table" value={briefing.tableDisplay} />
          <BriefingDetail label="Dining purpose" value={briefing.diningPurpose} />
        </div>

        {briefing.specialNotes ? (
          <section className="staff-checkin-brief__requirements" aria-label="Special notes">
            <h3 className="staff-checkin-brief__requirements-title">Special notes</h3>
            <p className="staff-checkin-brief__notes">{briefing.specialNotes}</p>
          </section>
        ) : null}

        {showTablePicker ? (
          <div className="staff-checkin-brief__picker">
            <label className="sfx-field staff-reservation-checkin__field">
              <span>Change seating table</span>
              <select
                className="sfx-select staff-reservation-checkin__select"
                value={selectedTableId}
                onChange={(e) => setSelectedTableId(e.target.value)}
                disabled={busy || options.length === 0}
              >
                <option value="">Select a table…</option>
                {options.map((table) => (
                  <option key={table.table_id} value={String(table.table_id)}>
                    {table.table_number} · {table.area_name} ({table.capacity} seats)
                    {!table.fitsParty ? " — tight fit" : ""}
                  </option>
                ))}
              </select>
            </label>
            {options.length === 0 ? (
              <p className="staff-reservation-checkin__hint">
                No available tables match this reservation right now.
              </p>
            ) : null}
            <button
              type="button"
              className="staff-checkin-brief__picker-dismiss"
              onClick={() => {
                setShowTablePicker(false);
                if (briefing.assignedTableId != null) {
                  setSelectedTableId(String(briefing.assignedTableId));
                }
              }}
              disabled={busy}
            >
              Use assigned table
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="staff-checkin-brief__change-link"
            onClick={() => setShowTablePicker(true)}
            disabled={busy}
          >
            Change seating table
          </button>
        )}

        <div className="staff-checkin-brief__actions">
          <div className="staff-checkin-brief__actions-row">
            <button
              type="button"
              className="sfx-btn sfx-btn--gold sfx-btn--md staff-checkin-brief__confirm"
              onClick={() => handleConfirmReservationCheckIn(Number(selectedTableId))}
              disabled={busy || !selectedTableId}
            >
              Check-in Customer
            </button>
            <button
              type="button"
              className="sfx-btn sfx-btn--md staff-checkin-brief__reject"
              onClick={handleRejectReservation}
              disabled={busy}
            >
              Reject Booking
            </button>
          </div>
          <button
            type="button"
            className="sfx-btn sfx-btn--ghost sfx-btn--md staff-table-action"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function StaffTableTab({
  tables,
  setTables,
  dataSource,
  user,
  toast,
  onRefresh,
  refreshing = false,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [checkInReservation, setCheckInReservation] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  const [isJiggling, setIsJiggling] = useState(false);
  const pressTimer = useRef(null);

  const handleRefreshAll = useCallback(() => {
    onRefresh?.();
  }, [onRefresh]);

  const areas = useMemo(() => {
    const names = new Set(tables.map((t) => t.area_name).filter(Boolean));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [tables]);

  const groupedTables = useMemo(() => {
    const sorted = [...tables].sort((a, b) => {
      const cmp = (a.area_name || "").localeCompare(b.area_name || "");
      if (cmp !== 0) return cmp;
      return String(a.table_number).localeCompare(String(b.table_number), undefined, { numeric: true });
    });

    const parentMap = new Map();
    sorted.forEach((t) => {
      if (!t.merged_into_table_id) {
        parentMap.set(t.table_id, { ...t, combined_names: [t.table_number], combined_capacity: t.capacity, child_ids: [] });
      }
    });

    sorted.forEach((t) => {
      if (t.merged_into_table_id && parentMap.has(t.merged_into_table_id)) {
        const parent = parentMap.get(t.merged_into_table_id);
        parent.combined_names.push(t.table_number);
        parent.combined_capacity += t.capacity;
        parent.child_ids.push(t.table_id);
      }
    });

    return Array.from(parentMap.values());
  }, [tables]);

  const filteredTables = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return groupedTables.filter((table) => {
      if (query && !table.combined_names.some(n => String(n).toLowerCase().includes(query))) {
        return false;
      }

      if (selectedArea && table.area_name !== selectedArea) {
        return false;
      }

      if (selectedStatuses.length > 0) {
        const slug = getTableStatusSlug(table);
        if (!selectedStatuses.includes(slug)) return false;
      }

      return true;
    });
  }, [groupedTables, searchTerm, selectedArea, selectedStatuses]);

  const groupedEntries = useMemo(() => {
    const map = {};
    filteredTables.forEach((table) => {
      const key = table.area_name || "Unassigned";
      if (!map[key]) map[key] = [];
      map[key].push(table);
    });

    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredTables]);

  const toggleStatusFilter = (slug) => {
    setSelectedStatuses((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const updateTableInState = useCallback(
    (tableId, patch) => {
      setTables((prev) =>
        prev.map((row) =>
          row.table_id === tableId ? { ...row, ...patch } : row
        )
      );
      setSelectedTable((prev) =>
        prev?.table_id === tableId ? { ...prev, ...patch } : prev
      );
    },
    [setTables]
  );

  const handlePointerDown = (e, t) => {
    if (t.is_counter) return;
    pressTimer.current = window.setTimeout(() => {
      setIsJiggling(true);
    }, 500);
  };

  const handlePointerUpOrLeave = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
  };

  const handleDragStart = (e, t) => {
    if (!isJiggling || t.is_counter) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("application/json", JSON.stringify({ id: t.table_id, area_id: t.area_id }));
  };

  const handleDrop = async (e, targetTable) => {
    e.preventDefault();
    setIsJiggling(false);
    if (targetTable.is_counter) return;

    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      if (data.id === targetTable.table_id || data.area_id !== targetTable.area_id) return;
      const userId = Number(user?.userId ?? user?.id);
      await mergeTablesApi(data.id, targetTable.table_id, userId);
      toast("Tables merged successfully", "success");
      handleRefreshAll();
    } catch (err) {
      toast(err.message || "Merge failed", "error");
    }
  };

  const handleUnmerge = async (tableId) => {
    try {
      const userId = Number(user?.userId ?? user?.id);
      await unmergeTableApi(tableId, userId);
      toast("Tables separated", "success");
      handleRefreshAll();
    } catch (err) {
      toast(err.message || "Failed to separate tables", "error");
    }
  };

  const handleCheckIn = useCallback(
    async (table) => {
      const userId = Number(user?.userId ?? user?.id);
      setActionBusy(true);
      try {
        const res = await checkInStaffTable(table.table_id, userId);
        const data = res.data;
        updateTableInState(table.table_id, {
          table_status: "Occupied",
          status: "occupied",
          active_session_id: data.session_id,
        });
        toast(`Table ${table.table_number} checked in — session #${data.session_id}`, "success");
        setSelectedTable(null);
        handleRefreshAll();
      } catch (err) {
        toast(err.message || "Check-in failed", "error");
      } finally {
        setActionBusy(false);
      }
    },
    [user, updateTableInState, toast, handleRefreshAll]
  );

  const handleReset = useCallback(
    async (table) => {
      const userId = Number(user?.userId ?? user?.id);
      setActionBusy(true);
      try {
        await resetStaffTable(table.table_id, userId);
        updateTableInState(table.table_id, {
          table_status: "Cleaning",
          status: "cleaning",
          active_session_id: null,
        });
        toast(`Table ${table.table_number} checked out and set to Cleaning`, "success");
        setSelectedTable(null);
        handleRefreshAll();
      } catch (err) {
        toast(err.message || "Reset failed", "error");
      } finally {
        setActionBusy(false);
      }
    },
    [user, updateTableInState, toast, handleRefreshAll]
  );

  const handleMarkClean = useCallback(
    async (table) => {
      const userId = Number(user?.userId ?? user?.id);
      setActionBusy(true);
      try {
        await markStaffTableClean(table.table_id, userId);
        updateTableInState(table.table_id, {
          table_status: "Available",
          status: "available",
        });
        toast(`Table ${table.table_number} is now Available`, "success");
        handleRefreshAll();
      } catch (err) {
        toast(err.message || "Failed to mark clean", "error");
      } finally {
        setActionBusy(false);
      }
    },
    [user, updateTableInState, toast, handleRefreshAll]
  );

  const handleConfirmReservationCheckIn = useCallback(
    async (tableId) => {
      if (!checkInReservation || !tableId) {
        toast("Please select a table", "error");
        return;
      }

      const userId = Number(user?.userId ?? user?.id);
      setActionBusy(true);
      try {
        const res = await checkInStaffReservation(
          checkInReservation.reservation_id,
          userId,
          { table_id: tableId }
        );
        const sessionId = res.data?.session_id;
        toast(
          sessionId
            ? `${checkInReservation.customer_name} checked in — session #${sessionId}`
            : `${checkInReservation.customer_name} checked in`,
          "success"
        );
        setCheckInReservation(null);
        handleRefreshAll();
      } catch (err) {
        toast(err.message || "Reservation check-in failed", "error");
      } finally {
        setActionBusy(false);
      }
    },
    [checkInReservation, user, toast, handleRefreshAll]
  );

  const handleRejectReservation = useCallback(async () => {
    if (!checkInReservation) return;

    if (
      !window.confirm(
        "Are you sure you want to reject and cancel this reservation?"
      )
    ) {
      return;
    }

    const userId = Number(user?.userId ?? user?.id);
    setActionBusy(true);
    try {
      const res = await rejectStaffReservation(
        checkInReservation.reservation_id,
        userId
      );
      const freedIds = res.data?.freed_table_ids || [];
      const assignedId = getAssignedTableId(checkInReservation);
      const tableIdsToFree = new Set(
        [...freedIds, assignedId].filter((id) => id != null && id !== "")
      );

      tableIdsToFree.forEach((tableId) => {
        updateTableInState(tableId, {
          table_status: "Available",
          status: "available",
        });
      });

      toast(
        `${checkInReservation.customer_name} reservation rejected`,
        "success"
      );
      setCheckInReservation(null);
      handleRefreshAll();
    } catch (err) {
      toast(err.message || "Reservation rejection failed", "error");
    } finally {
      setActionBusy(false);
    }
  }, [
    checkInReservation,
    user,
    toast,
    updateTableInState,
    handleRefreshAll,
  ]);

  if (!tables.length) {
    return (
      <div className="sfx-stack">
        <SectionHead
          title="Table Management"
          subtitle="Live floor layout grouped by dining area"
        />
        <EmptyState
          icon="grid"
          title="No tables found"
          hint="Verify the restaurant areas and tables are configured in the database."
        />
      </div>
    );
  }

  const contextValue = {
    state: {
      tables,
      dataSource,
      user,
      refreshing,
      searchTerm,
      selectedArea,
      selectedStatuses,
      selectedTable,
      checkInReservation,
      actionBusy,
      isJiggling,
      areas,
      groupedEntries,
      toast,
    },
    actions: {
      setSearchTerm,
      setSelectedArea,
      setSelectedStatuses,
      setSelectedTable,
      setCheckInReservation,
      handleRefreshAll,
      toggleStatusFilter,
      handlePointerDown,
      handlePointerUpOrLeave,
      handleDragStart,
      handleDrop,
      handleUnmerge,
      handleCheckIn,
      handleReset,
      handleMarkClean,
      handleConfirmReservationCheckIn,
      handleRejectReservation,
    },
  };

  // Show skeleton only on the true initial load (no data yet)
  const isFirstLoad = refreshing && (!Array.isArray(tables) || tables.length === 0);

  return (
    <SkeletonPresence
      loading={isFirstLoad}
      skeleton={<TableCardSkeleton count={12} />}
    >
      <motion.div
        key="table-content"
        variants={fadeScaleVariants}
        initial="hidden"
        animate="visible"
      >
        <TableManagementProvider value={contextValue}>
          <div className="sfx-stack">
            <TableManagementHeader />
            <TableManagementToolbar />
            <TableManagementFloorMap />
            <TableManagementTableModal />
            <TableManagementReservationModal />
          </div>
        </TableManagementProvider>
      </motion.div>
    </SkeletonPresence>
  );
}

StaffTableTab.Provider = TableManagementProvider;
StaffTableTab.Header = TableManagementHeader;
StaffTableTab.Toolbar = TableManagementToolbar;
StaffTableTab.FloorMap = TableManagementFloorMap;
StaffTableTab.TableModal = TableManagementTableModal;
StaffTableTab.ReservationModal = TableManagementReservationModal;

export default StaffTableTab;
