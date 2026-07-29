import { createContext, useContext, useCallback, useMemo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { QRCodeSVG as QRCode } from "qrcode.react";
import TableQrOrderLink from "@/components/common/TableQrOrderLink.jsx";
import TableReleaseIndicator from "@/components/common/TableReleaseIndicator.jsx";
import TableStageIndicator from "@/components/common/TableStageIndicator.jsx";

import { ManagerModal } from "../../manager-dashboard/components/ManagerOverlay.jsx";
import AddWalkInModal from "./AddWalkInModal.jsx";
import TimelineGanttView from "./TimelineGanttView.jsx";
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
  createVirtualTableApi,
  updateStaffTableStatusApi,
  deleteStaffTableApi,
  fetchStaffReservationDetail,
  extendReservationErt,
  advanceTableStage,
  fetchTableUpcomingReservations,
} from "../services/staffApi.js";
import { formatBookingId } from "@/features/reservations/utils/formatBookingId.js";
import { TABLE_STATUS_META } from "@/shared/constants.js";
import { useStaffStore } from "../store/staffStore.js";
import ReservationQueueInvoiceModal from "./ReservationQueueInvoiceModal.jsx";
import "../styles/staff-table-tab.css";
import "../styles/reservation-queue.css";
import "../styles/gantt-timeline.css";


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
  const raw = String(table.table_status || table.status || "Available").toLowerCase();
  if (TABLE_STATUS_META[raw]) return raw;

  const normalized = normalizeTableStatus(table);
  return STATUS_LABEL_TO_SLUG[normalized] || "available";
}

function getStageAdvanceLabel(stage) {
  if (stage === "Order Placed") return "Send to Kitchen";
  if (stage === "Ready") return "Mark Served";
  if (stage === "Served") return "Request Bill";
  return null;
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
    reservation?.occasion ||
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
  return null;
}

function TableManagementToolbar() {
  const { state, actions } = useTableManagement();
  const { searchTerm, selectedArea, selectedStatuses, areas, refreshing } = state;
  const { setSearchTerm, setSelectedArea, toggleStatusFilter, handleRefreshAll } = actions;

  return (
    <div className="sfx-filterbar sfx-filterbar--horizontal" style={{ display: "flex", alignItems: "flex-end", gap: "12px 16px", flexWrap: "wrap" }}>
      
      <div style={{ flex: "1 1 220px", minWidth: "200px" }}>
        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--sfx-muted)", display: "block", marginBottom: "6px" }}>Search Table</span>
        <SearchField
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search table number..."
        />
      </div>

      <div style={{ flex: "0 1 180px", minWidth: "140px" }}>
        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--sfx-muted)", display: "block", marginBottom: "6px" }}>Area</span>
        <select
          className="sfx-select"
          value={selectedArea}
          onChange={(e) => setSelectedArea(e.target.value)}
          style={{ width: "100%", height: "40px" }}
        >
          <option value="">All Areas</option>
          {areas.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </select>
      </div>

      <div className="sfx-filterbar__statuses" style={{ flex: "1 1 320px", minWidth: "280px", margin: 0 }}>
        <span className="sfx-filterbar__label" style={{ fontSize: "12px", fontWeight: 600, color: "var(--sfx-muted)", display: "block", marginBottom: "6px" }}>Status</span>
        <div className="sfx-chips" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
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
                style={{ height: "40px", display: "inline-flex", alignItems: "center" }}
              >
                <i className={`sfx-dot sfx-dot--${meta.tone}`} />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginLeft: "auto", height: "40px", display: "flex", alignItems: "center" }}>
        <Button
          variant="ghost"
          size="sm"
          icon="refresh"
          onClick={handleRefreshAll}
          disabled={refreshing}
        >
          Refresh
        </Button>
      </div>

    </div>
  );
}

function TableManagementFloorMap() {
  const { state, actions } = useTableManagement();
  const { groupedEntries, refreshing, isJiggling, clockNow } = state;
  const {
    handlePointerDown,
    handlePointerUpOrLeave,
    handleDragStart,
    handleDrop,
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
                const normalizedArea = (table.area_name || "").toLowerCase().trim();
                const isRestricted = !["kitchen view", "standard area", "window area"].includes(normalizedArea);
                const canMerge = isJiggling && !isRestricted;

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
                    onClick={() => {
                      if (!isJiggling) actions.setSelectedTable(table);
                    }}
                    className={`sfx-mtile sfx-mtile--${(table.upcoming_count > 0 && meta.tone === "green") ? "amber" : meta.tone} ${canMerge ? "is-jiggling" : ""}`}
                    style={{
                      cursor: isJiggling ? "grab" : "pointer"
                    }}
                  >
                    {table.upcoming_count > 0 && (
                      <div className="sfx-mtile__notif-badge" title={`${table.upcoming_count} upcoming reservation(s) queued`}>
                        <span>🔔</span>
                        <span>{table.upcoming_count}</span>
                      </div>
                    )}
                    <span className="sfx-mtile__no">{displayNum}</span>
                    <span className="sfx-mtile__cap">{table.combined_capacity} seats</span>
                    <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                    {table.active_reservation_customer_name && (
                      <div className="sfx-mtile__next-preview" title={`Next: ${table.active_reservation_customer_name}`}>
                        Next: {table.active_reservation_customer_name}
                      </div>
                    )}
                    <TableReleaseIndicator table={table} now={clockNow} />
                    <TableStageIndicator table={table} compact />


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
                      {!isJiggling && meta.slug === "cleaning" ? (
                        <Button size="sm" variant="soft" onClick={(e) => { e.stopPropagation(); actions.handleMarkClean(table); }}>
                          {table.child_ids?.length > 0 ? "Clean & Split" : "Mark as Cleaned"}
                        </Button>
                      ) : null}
                      {table.child_ids?.length > 0 && !isJiggling && meta.slug !== "cleaning" ? (
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

export function TableUpcomingQueueSection({ tableId, userId, showPhone = true, customFetcher = null }) {
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return now.toISOString().split("T")[0];
  });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoiceItem, setSelectedInvoiceItem] = useState(null);

  const fetcher = customFetcher || fetchTableUpcomingReservations;

  const loadQueue = useCallback(() => {
    if (!tableId) return;
    let active = true;
    setLoading(true);
    fetcher(tableId, userId, selectedDate)
      .then((data) => {
        if (active) setItems(data || []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [tableId, userId, selectedDate, fetcher]);

  useEffect(() => {
    return loadQueue();
  }, [loadQueue]);

  // Group items into 3 groups
  const groups = useMemo(() => {
    const history = [];
    const seated = [];
    const upcoming = [];

    items.forEach((item) => {
      const st = (item.reservation_status || "").toLowerCase();
      if (st === "dining" || st === "seated") {
        seated.push(item);
      } else if (st === "completed" || st === "no show" || st === "noshow" || st === "cancelled") {
        history.push(item);
      } else {
        upcoming.push(item);
      }
    });

    return { history, seated, upcoming };
  }, [items]);

  const renderItem = (item) => {
    const st = (item.reservation_status || "").toLowerCase().replace(/[^a-z]/g, "");
    let itemModifier = "upcoming";
    if (st === "dining" || st === "seated") itemModifier = "seated";
    else if (st === "completed" || st === "noshow" || st === "cancelled") itemModifier = "history";

    return (
      <div
        key={item.reservation_id}
        className={`rq-item rq-item--${itemModifier}`}
        onClick={() => setSelectedInvoiceItem(item)}
      >
        <div className="rq-item-left">
          <div className="rq-item-top">
            <span className="rq-res-id">#{item.reservation_id}</span>
            <span className="rq-cust-name">{item.contact_name}</span>
            <span className="rq-guest-badge">👥 {item.guest_count}</span>
          </div>
          <div className="rq-item-sub">
            <span>{item.dining_purpose}</span>
            {showPhone && item.contact_phone ? <span>• 📞 {item.contact_phone}</span> : null}
          </div>
        </div>

        <div className="rq-item-right">
          <span className="rq-time">{item.start_time}</span>
          <span className={`rq-status-pill rq-status-pill--${st}`}>
            {item.reservation_status}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="rq-section">
      <div className="rq-header">
        <div className="rq-title-wrap">
          <span className="rq-title">
            <span>📅</span> Table Reservation Queue
          </span>
          <span className="rq-count-badge">{items.length}</span>
        </div>

        <div className="rq-date-picker">
          <input
            type="date"
            className="rq-date-input"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <p style={{ fontSize: "12px", color: "#64748b" }}>Loading queue...</p>
      ) : items.length > 0 ? (
        <div>
          {/* Seated / Dining Group */}
          {groups.seated.length > 0 && (
            <div className="rq-group">
              <div className="rq-group-title rq-group-title--seated">
                🔴 Currently Dining ({groups.seated.length})
              </div>
              <div className="rq-list">{groups.seated.map(renderItem)}</div>
            </div>
          )}

          {/* Upcoming Group */}
          {groups.upcoming.length > 0 && (
            <div className="rq-group">
              <div className="rq-group-title rq-group-title--upcoming">
                🟡 Upcoming Reservations ({groups.upcoming.length})
              </div>
              <div className="rq-list">{groups.upcoming.map(renderItem)}</div>
            </div>
          )}

          {/* History Group */}
          {groups.history.length > 0 && (
            <div className="rq-group">
              <div className="rq-group-title rq-group-title--history">
                ⚪ Past / Completed ({groups.history.length})
              </div>
              <div className="rq-list">{groups.history.map(renderItem)}</div>
            </div>
          )}
        </div>
      ) : (
        <p style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic", margin: 0 }}>
          No reservations found for this table on {selectedDate}.
        </p>
      )}

      {selectedInvoiceItem && (
        <ReservationQueueInvoiceModal
          item={selectedInvoiceItem}
          showPhone={showPhone}
          onClose={() => setSelectedInvoiceItem(null)}
        />
      )}
    </div>
  );
}


function TableManagementTableModal() {
  const { state, actions } = useTableManagement();
  const { selectedTable: table, user, actionBusy: busy, toast, tables } = state;
  const {
    setSelectedTable,
    handleUnmerge,
    handleRefreshAll,
    handleCheckIn,
    handleReset,
    handleAdvanceStage,
  } = actions;

  const [editingStatus, setEditingStatus] = useState(() => table ? normalizeTableStatus(table) : "");
  const [walkInTable, setWalkInTable] = useState(null);

  const handleCheckInAction = () => {
    setWalkInTable(table);
  };

  const handleCheckOutAction = async () => {
    try {
      await handleReset(table);
      setSelectedTable(null);
    } catch (err) {
      toast(err.message || "Check-out failed", "error");
    }
  };

  const handleViewReservationAction = async () => {
    if (table.active_reservation_id) {
      setSelectedTable(null);
      try {
        const userId = Number(user?.userId ?? user?.id);
        const resDetail = await fetchStaffReservationDetail(table.active_reservation_id, userId);
        actions.setCheckInReservation(resDetail.reservation || resDetail);
      } catch (err) {
        toast(err.message || "Failed to load reservation details", "error");
      }
    } else {
      toast("No active reservation found for this table.", "error");
    }
  };

  const childTables = useMemo(() => {
    if (!table || !table.child_ids || !tables) return [];
    return table.child_ids.map(id => tables.find(t => t.table_id === id)).filter(Boolean);
  }, [table, tables]);

  if (!table) return null;

  const onClose = () => setSelectedTable(null);

  const handleSave = async () => {
    try {
      const userId = Number(user?.userId ?? user?.id);
      await updateStaffTableStatusApi(table.table_id, editingStatus, userId);
      toast("Table status updated successfully", "success");
      handleRefreshAll();
      onClose();
    } catch (err) {
      toast(err.message || "Failed to update table status", "error");
    }
  };

  const handleAddVirtualSlot = async () => {
    try {
      const userId = Number(user?.userId ?? user?.id);
      const res = await createVirtualTableApi(userId, {
        table_number: table.table_number,
        area_id: table.area_id,
        capacity: table.capacity
      });
      const newTable = res.data;

      // Auto-merge new virtual slot into parent table
      await mergeTablesApi(newTable.table_id, table.table_id, userId);

      toast(`Virtual slot ${newTable.table_number} created and merged with ${table.table_number}`, "success");
      handleRefreshAll();
      onClose();
    } catch (err) {
      toast(err.message || "Failed to create and merge virtual slot", "error");
    }
  };

  const handleExtendErt = async (minutes) => {
    const reservationId =
      table.active_occupancy_reservation_id ||
      table.active_reservation_id ||
      table.reservation_id;

    if (!reservationId) {
      toast("No active dining reservation found for this table.", "error");
      return;
    }

    try {
      const userId = Number(user?.userId ?? user?.id);
      await extendReservationErt(reservationId, userId, minutes);
      toast(`Estimated release extended by ${minutes} minutes`, "success");
      handleRefreshAll();
    } catch (err) {
      toast(err.message || "Failed to extend estimated release time", "error");
    }
  };

  const lowerArea = (table.area_name || "").toLowerCase();
  const isRestricted = lowerArea.includes("premium") || lowerArea.includes("private") || lowerArea.includes("vip");
  const stageAdvanceLabel = getStageAdvanceLabel(table.course_stage);

  return (
    <>
      <ManagerModal
        open={Boolean(table) && !walkInTable}
        title={`Edit ${table.combined_names?.join(" | ") || table.table_number || "Table"}`}
        onClose={onClose}
        size="lg"
        footer={
        <>
          <div style={{ display: "flex", gap: "8px" }}>
            {editingStatus === "Available" && (
              <Button variant="gold" onClick={handleCheckInAction} disabled={busy}>
                Check-in
              </Button>
            )}
            {editingStatus === "Reserved" && (
              <Button variant="gold" onClick={handleViewReservationAction} disabled={busy}>
                View Reservation
              </Button>
            )}
            {editingStatus === "Occupied" && (
              <Button variant="danger" onClick={handleCheckOutAction} disabled={busy}>
                Check-out
              </Button>
            )}
          </div>
          <div className="sfx-modal__footacts" style={{ marginLeft: "auto" }}>
            {table.child_ids?.length > 0 && (
              <Button
                variant="danger"
                onClick={async () => {
                  await handleUnmerge(table.table_id);
                  onClose();
                }}
              >
                Separate Tables
              </Button>
            )}
            {(table.table_number.includes("-V") || table.table_number.startsWith("V-")) && (
              <Button
                variant="danger"
                onClick={async () => {
                  try {
                    const userId = Number(user?.userId ?? user?.id);
                    if (table.merged_into_table_id) {
                      await unmergeTableApi(table.table_id, userId);
                    }
                    await deleteStaffTableApi(table.table_id, userId);
                    toast(`Virtual table ${table.table_number} deleted`, "success");
                    handleRefreshAll();
                    onClose();
                  } catch (err) {
                    toast(err.message || "Failed to delete virtual table", "error");
                  }
                }}
                disabled={busy}
              >
                Delete Table
              </Button>
            )}
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="gold" onClick={handleSave} disabled={busy}>
              Save changes
            </Button>
          </div>
        </>
        }
      >
      <div className="sfx-form">
        <div style={{ display: "flex", gap: "24px" }}>
          <div style={{ flex: 1 }}>
            <label className="sfx-field">
              <span>Table number</span>
              <input
                className="sfx-input"
                value={table.combined_names?.join(" | ") || table.table_number}
                disabled
              />
            </label>
            <div className="sfx-form__row">
              <label className="sfx-field">
                <span>Area</span>
                <input
                  className="sfx-input"
                  value={table.area_name}
                  disabled
                />
              </label>
              <label className="sfx-field">
                <span>Capacity</span>
                <input
                  className="sfx-input"
                  type="number"
                  value={table.combined_capacity || table.capacity}
                  disabled
                />
              </label>
            </div>
          </div>

          {(table.qr_code || table.static_qr_code) && (
            <TableQrOrderLink table={table} allTables={tables} />
          )}

        </div>

        <div className="sfx-field">
          <span>Status</span>
          <div className="sfx-chips">
            {["Available", "Reserved", "Occupied", "Cleaning", "Inactive"].map((s) => {
              const isActive = s === editingStatus;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setEditingStatus(s)}
                  className={`sfx-chip ${isActive ? "is-active" : "sfx-chip--outline"}`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        {editingStatus === "Occupied" ? (
          <>
            <div className="staff-table-stage-actions">
              <TableStageIndicator table={table} />
              {stageAdvanceLabel ? (
                <Button
                  variant="gold"
                  size="sm"
                  onClick={() => handleAdvanceStage(table)}
                  disabled={busy}
                >
                  {stageAdvanceLabel}
                </Button>
              ) : null}
            </div>
            <div className="staff-table-ert-actions">
              <span className="staff-table-ert-actions__label">Extend Estimated Time</span>
              <div className="staff-table-ert-actions__buttons">
                <Button variant="soft" size="sm" onClick={() => handleExtendErt(30)} disabled={busy}>
                  +30 min
                </Button>
                <Button variant="soft" size="sm" onClick={() => handleExtendErt(60)} disabled={busy}>
                  +60 min
                </Button>
              </div>
            </div>
          </>
        ) : null}

        {!isRestricted && (
          <div style={{ marginTop: "16px" }}>
            <Button
              variant="soft"
              size="md"
              icon="plus"
              onClick={handleAddVirtualSlot}
              disabled={busy}
              style={{ width: "100%" }}
            >
              Add Virtual Slot (Walk-in)
            </Button>
          </div>
        )}

        {childTables.length > 0 && (
          <div className="sfx-field" style={{ marginTop: "20px" }}>
            <span>Merged Tables</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
              {childTables.map((child) => {
                const isVirtualChild = child.table_number.includes("-V") || child.table_number.startsWith("V-");
                return (
                  <div key={child.table_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "var(--sfx-bg-soft, #f8f9fa)", borderRadius: "8px", border: "1px solid var(--sfx-border-soft, #e9ecef)" }}>
                    <span style={{ fontWeight: "600", fontSize: "14px" }}>{child.table_number} ({child.capacity} seats)</span>
                    <div style={{ display: "flex", gap: "8px" }}>
                      {isVirtualChild ? (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={async () => {
                            try {
                              const userId = Number(user?.userId ?? user?.id);
                              await unmergeTableApi(child.table_id, userId);
                              await deleteStaffTableApi(child.table_id, userId);
                              toast(`Virtual table ${child.table_number} deleted`, "success");
                              handleRefreshAll();
                              onClose();
                            } catch (err) {
                              toast(err.message || "Failed to delete virtual table", "error");
                            }
                          }}
                        >
                          Delete
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="soft"
                          onClick={async () => {
                            try {
                              const userId = Number(user?.userId ?? user?.id);
                              await unmergeTableApi(child.table_id, userId);
                              toast(`Table ${child.table_number} separated`, "success");
                              handleRefreshAll();
                              onClose();
                            } catch (err) {
                              toast(err.message || "Failed to separate table", "error");
                            }
                          }}
                        >
                          Separate
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <TableUpcomingQueueSection tableId={table.table_id} userId={Number(user?.userId ?? user?.id)} />
      </div>
      </ManagerModal>
      {walkInTable ? (
        <AddWalkInModal
          user={user}
          toast={toast}
          initialTableId={walkInTable.table_id}
          onCreated={() => {
            setWalkInTable(null);
            setSelectedTable(null);
            handleRefreshAll();
          }}
          onClose={() => setWalkInTable(null)}
        />
      ) : null}
    </>
  );
}

function TableManagementReservationModal() {
  const { state, actions } = useTableManagement();
  const { checkInReservation: reservation, tables, actionBusy: busy } = state;
  const { setCheckInReservation, handleConfirmReservationCheckIn, handleRejectReservation } = actions;

  const options = useMemo(
    () => getTablesForReservationCheckIn(tables, reservation),
    [tables, reservation]
  );

  const [selectedTableId, setSelectedTableId] = useState(() => {
    if (!reservation) return "";
    const assignedId = getAssignedTableId(reservation);
    const assignedStr = assignedId != null ? String(assignedId) : "";
    if (assignedStr && options.some((table) => String(table.table_id) === assignedStr)) {
      return assignedStr;
    }
    return options.length > 0 ? String(options[0].table_id) : "";
  });
  const [showTablePicker, setShowTablePicker] = useState(false);

  const onClose = () => setCheckInReservation(null);

  const briefing = useMemo(
    () => (reservation ? buildReservationBriefing(reservation) : null),
    [reservation]
  );

  const partySize = reservation?.guest_count ?? "—";
  const timeAndDuration = briefing?.durationLabel
    ? `${reservation?.start_time || "—"} (${briefing.durationLabel})`
    : reservation?.start_time || "—";

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
              Reject Reservation
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
  const [clockNow, setClockNow] = useState(() => new Date());
  const [activeView, setActiveView] = useState("table");
  const [ganttDate, setGanttDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedTimelineReservation, setSelectedTimelineReservation] = useState(null);

  const [isJiggling, setIsJiggling] = useState(false);
  const pressTimer = useRef(null);

  const selectedTableIdForModal = useStaffStore((state) => state.selectedTableIdForModal);
  const closeTableModal = useStaffStore((state) => state.closeTableModal);

  useEffect(() => {
    if (selectedTableIdForModal) {
      const match = tables.find(t => t.table_id === Number(selectedTableIdForModal));
      if (match) {
        setSelectedTable(match);
      }
      closeTableModal();
    }
  }, [selectedTableIdForModal, tables, closeTableModal]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

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
    const lowerArea = (t.area_name || "").toLowerCase().trim();
    if (!["kitchen view", "standard area", "window area"].includes(lowerArea)) {
      return; // Cannot jiggle or merge restricted areas
    }
    pressTimer.current = window.setTimeout(() => {
      setIsJiggling(true);
    }, 500);
  };

  const handlePointerUpOrLeave = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
  };

  const handleDragStart = (e, t) => {
    if (!isJiggling) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("application/json", JSON.stringify({ id: t.table_id, area_id: t.area_id }));
  };

  const handleDrop = async (e, targetTable) => {
    e.preventDefault();
    setIsJiggling(false);

    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      if (data.id === targetTable.table_id || data.area_id !== targetTable.area_id) return;

      const sourceTable = tables.find((t) => t.table_id === data.id);
      if (!sourceTable) return;

      // Extract table number prefix (up to the hyphen)
      const getPrefix = (num) => String(num).split("-")[0];
      const sourcePrefix = getPrefix(sourceTable.table_number);
      const targetPrefix = getPrefix(targetTable.table_number);

      if (sourcePrefix !== targetPrefix) {
        toast("Only tables with the same prefix (e.g. K-01 and K-02) can be merged.", "error");
        return;
      }

      const lowerArea = (targetTable.area_name || "").toLowerCase().trim();
      if (!["kitchen view", "standard area", "window area"].includes(lowerArea)) {
        toast("Tables in this area cannot be merged.", "error");
        return;
      }

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
        
        // If it's a merged table, automatically unmerge it
        if (table.child_ids?.length > 0) {
          await unmergeTableApi(table.table_id, userId);
          toast(`Table ${table.table_number} is cleaned and separated`, "success");
        } else {
          toast(`Table ${table.table_number} is now Available`, "success");
        }
        
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

  const handleAddVirtualTable = useCallback(async () => {
    const userId = Number(user?.userId ?? user?.id);
    setActionBusy(true);
    try {
      await createVirtualTableApi(userId);
      toast("Virtual table added successfully", "success");
      handleRefreshAll();
    } catch (err) {
      toast(err.message || "Failed to add virtual table", "error");
    } finally {
      setActionBusy(false);
    }
  }, [user, toast, handleRefreshAll]);

  const handleAdvanceStage = useCallback(
    async (table) => {
      const userId = Number(user?.userId ?? user?.id);
      setActionBusy(true);
      try {
        const data = await advanceTableStage(table.table_id, userId);
        updateTableInState(table.table_id, {
          course_stage: data.course_stage,
          course_stage_detail: data.course_stage_detail,
          active_order_status: data.active_order_status,
        });
        toast(
          data.course_stage
            ? `Table ${table.table_number} stage advanced to ${data.course_stage}`
            : `Table ${table.table_number} stage advanced`,
          "success"
        );
        handleRefreshAll();
      } catch (err) {
        toast(err.message || "Failed to advance table stage", "error");
      } finally {
        setActionBusy(false);
      }
    },
    [user, updateTableInState, toast, handleRefreshAll]
  );

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
      clockNow,
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
      handleAddVirtualTable,
      handleAdvanceStage,
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "var(--sfx-heading, #0f172a)" }}>Table Management</h2>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--sfx-muted, #64748b)" }}>
                  {activeView === "table" ? "Live floor layout & real-time table status" : "Full-day Gantt timeline schedule & conflict detection"}
                </p>
              </div>

              <div className="apple-toggle-container">
                <div
                  className="apple-toggle-thumb"
                  style={{
                    left: activeView === "table" ? "4px" : "calc(50% + 2px)",
                    width: "calc(50% - 6px)"
                  }}
                />
                <button
                  type="button"
                  className={`apple-toggle-btn ${activeView === "table" ? "is-active" : ""}`}
                  onClick={() => setActiveView("table")}
                >
                  Table View (Live)
                </button>
                <button
                  type="button"
                  className={`apple-toggle-btn ${activeView === "timeline" ? "is-active" : ""}`}
                  onClick={() => setActiveView("timeline")}
                >
                  Timeline View (Gantt)
                </button>
              </div>
            </div>

            {activeView === "timeline" ? (
              <TimelineGanttView
                date={ganttDate}
                onDateChange={setGanttDate}
                activeView={activeView}
                onViewToggle={setActiveView}
                onSelectReservation={async (resId) => {
                  try {
                    const data = await fetchStaffReservationDetail(resId);
                    if (data?.reservation) {
                      setSelectedTimelineReservation(data.reservation);
                    }
                  } catch (e) {
                    console.error("Failed to load reservation detail:", e);
                  }
                }}
                onQuickBookTable={(tableId) => {
                  const targetTable = tables.find((t) => sameTableId(t.table_id, tableId));
                  if (targetTable) {
                    setSelectedTable(targetTable);
                  }
                }}
                user={user}
              />
            ) : (
              <>
                <TableManagementToolbar />
                <TableManagementFloorMap />
              </>
            )}

            <TableManagementTableModal key={selectedTable?.table_id} />
            <TableManagementReservationModal key={checkInReservation?.reservation_id} />
            {selectedTimelineReservation ? (
              <ReservationQueueInvoiceModal
                item={selectedTimelineReservation}
                onClose={() => setSelectedTimelineReservation(null)}
              />
            ) : null}
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
