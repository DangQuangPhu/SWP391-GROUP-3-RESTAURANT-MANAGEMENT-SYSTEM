import { useStaffPortal } from "../context/StaffPortalContext.jsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { format, isSameDay } from "date-fns";

import DashboardDateRangePicker from "@/features/manager-dashboard/components/shared/DashboardDateRangePicker.jsx";
import { DASHBOARD_TODAY } from "@/features/manager-dashboard/data/managerDashboardMockData.js";


import {
  QUEUE_RESERVATIONS,
} from "../data/staffDashboardMockData.js";
import {
  getReservationDateIso,
  getReservationDisplayMeta,
  getReservationStatusKey,
  formatReservationTimeDisplay,
} from "../utils/reservationQueueHelpers.js";
import Icon from "./StaffIcons.jsx";
import { EmptyState, Button, StatusBadge, SearchField } from "./StaffUI.jsx";
import { StaffDrawer } from "./StaffOverlay.jsx";
import { fetchTodayReservations, checkInStaffReservation, rejectStaffReservation } from "../services/staffApi.js";
import { useSocket } from "@/core/socket/SocketContext.jsx";

/* ── Real-time shift detection ── */
function getCurrentShift() {
  const h = new Date().getHours();
  if (h >= 6 && h < 14) return "morning";
  if (h >= 14 && h < 18) return "afternoon";
  return "night"; // 18-23 or 0-5
}

function getShiftLabel(shift) {
  if (shift === "morning") return "Morning (6 AM – 2 PM)";
  if (shift === "afternoon") return "Afternoon (2 PM – 6 PM)";
  return "Night (6 PM – 6 AM)";
}

function matchesSelectedDate(reservation, selectedDate) {
  if (!selectedDate) return true;
  try {
    const iso = getReservationDateIso(reservation);
    const day = new Date(`${iso}T12:00:00`);
    return isSameDay(day, selectedDate);
  } catch {
    return true;
  }
}

function ReservationManagement({
  user,
  toast,
  refreshKey,
}) {
  const { tables, setTables } = useStaffPortal();
  const { socket } = useSocket();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [verifyTarget, setVerifyTarget] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftRange, setDraftRange] = useState({
    startDate: new Date(),
    endDate: new Date(),
    key: "selection",
  });
  const [activePresetId, setActivePresetId] = useState("today");

  const dateScopedQueue = useMemo(
    () => (Array.isArray(queue) ? queue : []).filter((row) => matchesSelectedDate(row, selectedDate)),
    [queue, selectedDate]
  );

  const loadReservations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchTodayReservations(user?.user_id);
      setQueue(res.data || []);
    } catch (err) {
      toast("Could not load today's reservations", "error");
    } finally {
      setLoading(false);
    }
  }, [toast, user]);

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  useEffect(() => {
    if (refreshKey > 0) {
      loadReservations();
    }
  }, [refreshKey, loadReservations]);

  /* ── Socket.IO / Window Sync ── */
  useEffect(() => {
    const handleSameTabSync = () => loadReservations();
    window.addEventListener('phurai_reservations_updated', handleSameTabSync);
    
    if (socket) {
      const handleConfirmed = (data) => {
        toast(`Table ${data.assigned_tables?.join(", ") || 'assigned'} confirmed for ${data.customer_name}`, "success");
        loadReservations();
      };
      socket.on("reservation:confirmed", handleConfirmed);
      return () => {
        window.removeEventListener('phurai_reservations_updated', handleSameTabSync);
        socket.off("reservation:confirmed", handleConfirmed);
      };
    }
    
    return () => {
      window.removeEventListener('phurai_reservations_updated', handleSameTabSync);
    };
  }, [loadReservations, socket, toast]);

  const location = useLocation();

  useEffect(() => {
    if (!loading && location.hash.startsWith('#res-')) {
      const id = location.hash.slice(1);
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.style.transition = "background-color 0.5s ease";
          el.style.backgroundColor = "rgba(16, 185, 129, 0.2)"; // flash highlight
          setTimeout(() => {
            el.style.backgroundColor = "";
          }, 2000);
        }
      }, 300);
    }
  }, [loading, location.hash, dateScopedQueue]);
  const pickerAnchorRef = useRef(null);

  const closePicker = useCallback(() => setPickerOpen(false), []);

  const openPicker = useCallback(() => {
    setDraftRange({
      startDate: selectedDate,
      endDate: selectedDate,
      key: "selection",
    });
    setPickerOpen(true);
  }, [selectedDate]);

  // The DatePicker now uses a Portal with its own backdrop for outside clicks.

  const filtered = useMemo(() => {
    let base = (Array.isArray(dateScopedQueue) ? dateScopedQueue : []).filter((row) => {
      const statusKey = getReservationStatusKey(row);
      return statusKey === "confirmed" || statusKey === "checked_in";
    });

    if (search.trim()) {
      const kw = search.trim().toLowerCase();
      base = base.filter((row) =>
        (row.customer_name || "").toLowerCase().includes(kw) ||
        String(row.phone || "").includes(kw) ||
        String(row.reservation_id).includes(kw)
      );
    }

    return base;
  }, [dateScopedQueue, search]);

  const kpiConfirmed = useMemo(
    () =>
      dateScopedQueue.filter((row) => {
        const status = getReservationStatusKey(row);
        return status === "confirmed";
      }).length,
    [dateScopedQueue]
  );

  const kpiCheckedIn = useMemo(
    () =>
      dateScopedQueue.filter((row) => {
        const status = getReservationStatusKey(row);
        return status === "checked_in";
      }).length,
    [dateScopedQueue]
  );

  const selectedDateLabel = format(selectedDate, "dd/MM/yyyy");

  const handleCheckIn = useCallback(async () => {
    if (!verifyTarget) return;

    try {
      await checkInStaffReservation(verifyTarget.reservation_id, user?.user_id, { table_id: verifyTarget.table_id });
      toast("Guest Checked-In. Table status updated to Occupied.", "success");
      loadReservations(); // Reload from server
      setVerifyTarget(null);
    } catch (err) {
      toast(err.message || "Failed to check in.", "error");
    }
  }, [verifyTarget, toast, loadReservations, user]);

  const handleRejectWalkin = useCallback(async () => {
    if (!verifyTarget) return;
    if (!window.confirm(`Reject walk-in for ${verifyTarget.customer_name}?`)) return;

    try {
      await rejectStaffReservation(verifyTarget.reservation_id, user?.user_id, { reason: "No Show", new_status: "No Show" });
      toast("Walk-in rejected. Table released.", "info");
      loadReservations();
      setVerifyTarget(null);
    } catch (err) {
      toast(err.message || "Failed to reject walk-in.", "error");
    }
  }, [verifyTarget, toast, loadReservations, user]);


  const handlePresetSelect = (preset) => {
    setActivePresetId(preset.id);
    setDraftRange({
      startDate: preset.startDate,
      endDate: preset.endDate,
      key: "selection",
    });
  };

  const handleApplyDate = ({ startDate }) => {
    if (startDate) setSelectedDate(startDate);
    closePicker();
  };

  return (
    <div className="staff-reservation-tab-content sfx-stack">
      {loading && (Array.isArray(queue) ? queue : []).length === 0 ? (
        <p className="sfx-muted">Loading reservations…</p>
      ) : (
        <>
          <div className="staff-reservation-kpis sfx-kpis" aria-label="Reservation summary">
            <article className="sfx-kpi sfx-kpi--blue">
              <div className="sfx-kpi__top">
                <span className="sfx-kpi__icon" aria-hidden="true">
                  <Icon name="calendar" size={18} />
                </span>
              </div>
              <p className="sfx-kpi__value">{dateScopedQueue.length}</p>
              <p className="sfx-kpi__label">Bookings today</p>
            </article>

            <article className="sfx-kpi sfx-kpi--amber">
              <div className="sfx-kpi__top">
                <span className="sfx-kpi__icon" aria-hidden="true">
                  <Icon name="bell" size={18} />
                </span>
              </div>
              <p className="sfx-kpi__value">{kpiConfirmed}</p>
              <p className="sfx-kpi__label">Awaiting check-in</p>
            </article>

            <article className="sfx-kpi sfx-kpi--green">
              <div className="sfx-kpi__top">
                <span className="sfx-kpi__icon" aria-hidden="true">
                  <Icon name="check" size={18} />
                </span>
              </div>
              <p className="sfx-kpi__value">{kpiCheckedIn}</p>
              <p className="sfx-kpi__label">Checked in</p>
            </article>
          </div>

          <div className="staff-card sfx-card staff-reservations-card sfx-card--overflow-visible">
            <header className="sfx-card__head">
              <div>
                <h3 className="sfx-card__title">Reservation</h3>
                <p className="sfx-muted staff-reservations-card__subtitle">
                  {`Showing all confirmed bookings for ${selectedDateLabel}`}
                </p>
              </div>
              <span className="sfx-muted">
                {filtered.length} booking{filtered.length === 1 ? "" : "s"}
              </span>
            </header>

            <div
              className="staff-reservations-toolbar staff-reservations-toolbar--stacked"
              style={{ position: "relative", zIndex: 50 }}
            >
              <label className="sfx-search staff-reservations-toolbar__search">
                <Icon name="search" size={16} />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by guest name, phone, or booking ID…"
                  aria-label="Search reservations"
                />
              </label>

              <div
                className={`staff-reservations-toolbar__date${pickerOpen ? " is-open" : ""}`}
                ref={pickerAnchorRef}
              >
                <button
                  type="button"
                  className="sfx-kpi__icon sfx-kpi__icon--trigger staff-reservations-date-trigger"
                  onClick={() => (pickerOpen ? closePicker() : openPicker())}
                  aria-label="Choose reservation date"
                  aria-expanded={pickerOpen}
                >
                  <Icon name="calendar" size={18} />
                </button>
                <span className="staff-reservations-toolbar__date-label">{selectedDateLabel}</span>
                {pickerOpen ? (
                  <div className="sfx-dp-popover-shell">
                    <DashboardDateRangePicker
                      draftRange={draftRange}
                      activePresetId={activePresetId}
                      onDraftChange={(selection) => {
                        setDraftRange(selection);
                        setActivePresetId("custom");
                      }}
                      onPresetSelect={handlePresetSelect}
                      onApply={handleApplyDate}
                      onCancel={closePicker}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="sfx-card__body">
              {filtered.length === 0 ? (
                <EmptyState
                  icon="calendar"
                  title={"No confirmed reservations for this date"}
                  hint={"Bookings will appear here once they are confirmed by the manager."}
                />
              ) : (
                <div className="sfx-table-wrap">
                  <table className="sfx-table sfx-table--hover staff-reservations-table">
                    <thead>
                      <tr>
                        <th className="staff-reservations-table__id-cell" style={{ textAlign: "center" }}>Booking ID</th>
                        <th className="staff-reservations-table__datetime-cell">Time</th>
                        <th>Guest</th>
                        <th>Pax</th>
                        <th>Area</th>
                        <th>Table</th>
                        <th className="staff-reservations-table__status-cell">Status</th>
                        <th className="sfx-table__right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(Array.isArray(filtered) ? filtered : []).map((reservation) => {
                        const statusKey = getReservationStatusKey(reservation);
                        const meta = getReservationDisplayMeta(statusKey);

                        return (
                          <tr 
                            key={reservation.reservation_id} 
                            id={`res-${String(reservation.reservation_id).padStart(6, '0')}`}
                            className="sfx-table__row"
                          >
                            <td className="staff-reservations-table__id-cell" style={{ textAlign: "center" }}>
                              <span className="staff-reservations-table__booking-id">
                                #{reservation.reservation_id?.toString().padStart(6, "0")}
                              </span>
                            </td>
                            <td className="staff-reservations-table__datetime-cell">
                              <span className="staff-reservations-table__datetime">
                                {formatReservationTimeDisplay(reservation)}
                              </span>
                            </td>
                            <td>
                              <span className="staff-reservations-table__name">
                                {reservation.customer_name}
                              </span>
                              {reservation.phone ? (
                                <small className="sfx-cell-sub">{reservation.phone}</small>
                              ) : null}
                            </td>
                            <td>{reservation.party_size ?? reservation.guest_count ?? "—"}</td>
                            <td>{reservation.area_name || "—"}</td>
                            <td>{reservation.table_label || "Available"}</td>
                            <td className="staff-reservations-table__status-cell">
                              <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                            </td>
                            <td className="sfx-table__right">
                              {statusKey === "confirmed" ? (
                                <div className="sfx-rowacts">
                                  <Button
                                    size="sm"
                                    variant="soft"
                                    onClick={() => setVerifyTarget(reservation)}
                                  >
                                    Check-in
                                  </Button>
                                </div>
                              ) : statusKey === "checked_in" ? (
                                <StatusBadge tone="green">Done</StatusBadge>
                              ) : (
                                <span className="staff-reservations-action-muted">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <StaffDrawer
            open={Boolean(verifyTarget)}
            title={verifyTarget ? `Verify Walk-in — ${verifyTarget.customer_name}` : ""}
            onClose={() => setVerifyTarget(null)}
            footer={
              <div className="sfx-drawer__acts">
                <Button variant="danger" onClick={handleRejectWalkin}>
                  Reject Walk-in
                </Button>
                <Button variant="gold" onClick={handleCheckIn}>
                  Confirm Check-in
                </Button>
              </div>
            }
          >
            {verifyTarget ? (
              <div className="sfx-assign-form">
                <p>
                  <strong>Customer:</strong> {verifyTarget.customer_name}
                </p>
                {verifyTarget.phone && (
                  <p>
                    <strong>Phone:</strong> {verifyTarget.phone}
                  </p>
                )}
                <p>
                  <strong>Party Size:</strong> {verifyTarget.party_size}
                </p>
                <p>
                  <strong>Time:</strong> {formatReservationTimeDisplay(verifyTarget)}
                </p>
                <p>
                  <strong>Assigned Table:</strong> {verifyTarget.table_label} ({verifyTarget.area_name})
                </p>
                {verifyTarget.special_request && (
                  <div className="sfx-note" style={{ marginTop: "16px" }}>
                    <strong>Special Request:</strong><br />
                    <span>{verifyTarget.special_request}</span>
                  </div>
                )}
                
                <hr style={{ margin: "24px 0", border: "none", borderTop: "1px solid var(--border-color)", opacity: 0.5 }} />
                <p className="sfx-muted" style={{ fontSize: "14px" }}>
                  Please verify the customer's account and information upon walk-in.
                  If the information is incorrect or the customer no-shows, you may reject the walk-in.
                </p>
              </div>
            ) : null}
          </StaffDrawer>

        </>
      )}
    </div>
  );
}

export default ReservationManagement;
