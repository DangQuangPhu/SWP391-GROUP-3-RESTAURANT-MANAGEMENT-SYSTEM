import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "../services/staffApi.js";
import { formatBookingId } from "@/utils/formatBookingId.js";
import {
  DEMO_NOTICE,
} from "../data/staffDashboardMockData.js";
import { TABLE_STATUS_META } from "../../manager-dashboard/data/managerDashboardMockData.js";
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
  return roleId === 4;
}

function sameTableId(left, right) {
  if (left == null || right == null) return false;
  const a = Number(left);
  const b = Number(right);
  if (Number.isFinite(a) && Number.isFinite(b)) return a === b;
  return String(left) === String(right);
}

/** Primary assigned table from API row (table_id, assigned_tables[], legacy fields). */
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
  const partySize = Number(reservation?.party_size ?? reservation?.guest_count ?? 1);
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

function ReservationCheckInModal({
  reservation,
  tables,
  onClose,
  onConfirm,
  onReject,
  busy,
}) {
  const [selectedTableId, setSelectedTableId] = useState("");
  const [showTablePicker, setShowTablePicker] = useState(false);

  const briefing = useMemo(
    () => (reservation ? buildReservationBriefing(reservation) : null),
    [reservation]
  );

  const options = useMemo(
    () => getTablesForReservationCheckIn(tables, reservation),
    [tables, reservation]
  );

  const partySize = reservation?.party_size ?? reservation?.guest_count ?? "—";
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

  const contactLine = [reservation.phone, reservation.email].filter(Boolean).join(" · ");

  return (
    <div
      className="staff-table-modal staff-table-modal--light staff-table-modal--briefing"
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-reservation-checkin-title"
    >
      <button
        type="button"
        className="staff-table-modal__backdrop"
        aria-label="Close check-in"
        onClick={onClose}
      />
      <div className="staff-table-modal__panel staff-checkin-brief">
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
            label="Guests (pax)"
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
              onClick={() => onConfirm(Number(selectedTableId))}
              disabled={busy || !selectedTableId}
            >
              CONFIRM CHECK-IN
            </button>
            <button
              type="button"
              className="sfx-btn sfx-btn--md staff-checkin-brief__reject"
              onClick={onReject}
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
    </div>
  );
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

function TableActionModal({
  table,
  user,
  onClose,
  onCheckIn,
  onReset,
  busy,
}) {
  if (!table) return null;

  const status = normalizeTableStatus(table);
  const meta = STATUS_META[status] || STATUS_META.Available;
  const manager = isManagerUser(user);

  const showCheckIn = status === "Available";
  const showReset = status === "Occupied" || status === "Cleaning";

  return (
    <div
      className="staff-table-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-table-modal-title"
    >
      <button
        type="button"
        className="staff-table-modal__backdrop"
        aria-label="Close table actions"
        onClick={onClose}
      />
      <div className="staff-table-modal__panel">
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
        </div>

        <div className="staff-table-modal__actions">
          {showCheckIn ? (
            <button
              type="button"
              className="sfx-btn sfx-btn--gold sfx-btn--md staff-table-action"
              onClick={() => onCheckIn(table)}
              disabled={busy}
            >
              Check-in
            </button>
          ) : null}

          {showReset ? (
            <button
              type="button"
              className="sfx-btn sfx-btn--ghost sfx-btn--md staff-table-action"
              onClick={() => onReset(table)}
              disabled={busy}
            >
              Reset Table
            </button>
          ) : null}

          <button
            type="button"
            className="sfx-btn sfx-btn--ghost sfx-btn--md staff-table-action staff-table-action--locked"
            disabled={!manager}
            title={
              manager
                ? "Move table (coming soon)"
                : "Manager role required"
            }
          >
            {!manager ? <LockIcon /> : null}
            Move Table
          </button>

          <button
            type="button"
            className="sfx-btn sfx-btn--ghost sfx-btn--md staff-table-action staff-table-action--locked"
            disabled={!manager}
            title={
              manager
                ? "Merge tables (coming soon)"
                : "Manager role required"
            }
          >
            {!manager ? <LockIcon /> : null}
            Merge Tables
          </button>
        </div>
      </div>
    </div>
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

  const handleRefreshAll = useCallback(() => {
    onRefresh?.();
  }, [onRefresh]);

  const areas = useMemo(() => {
    const names = new Set(tables.map((t) => t.area_name).filter(Boolean));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [tables]);

  const filteredTables = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return tables.filter((table) => {
      if (query && !String(table.table_number ?? "").toLowerCase().includes(query)) {
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
  }, [tables, searchTerm, selectedArea, selectedStatuses]);

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
          table_status: "Available",
          status: "available",
          active_session_id: null,
        });
        toast(`Table ${table.table_number} reset to Available`, "success");
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

  return (
    <div className="sfx-stack">
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

                  return (
                    <button
                      key={table.table_id}
                      type="button"
                      className={`sfx-mtile sfx-mtile--${meta.tone}`}
                      onClick={() => setSelectedTable(table)}
                    >
                      <span className="sfx-mtile__no">{table.table_number}</span>
                      <span className="sfx-mtile__cap">{table.capacity} seats</span>
                      <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      <TableActionModal
        table={selectedTable}
        user={user}
        onClose={() => setSelectedTable(null)}
        onCheckIn={handleCheckIn}
        onReset={handleReset}
        busy={actionBusy}
      />

      <ReservationCheckInModal
        reservation={checkInReservation}
        tables={tables}
        onClose={() => setCheckInReservation(null)}
        onConfirm={handleConfirmReservationCheckIn}
        onReject={handleRejectReservation}
        busy={actionBusy}
      />
    </div>
  );
}

export default StaffTableTab;
