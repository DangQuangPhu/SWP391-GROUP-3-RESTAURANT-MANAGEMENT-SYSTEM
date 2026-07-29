import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Skeleton, listContainerVariants, listItemVariants } from "@/components/ui/Skeleton";
import { useSearchParams } from "react-router-dom";
import { format, parseISO, isSameDay } from "date-fns";
import { ManagerDrawer } from "../ManagerOverlay.jsx";
import DashboardDateRangePicker from "../shared/DashboardDateRangePicker.jsx";
import Icon from "../ManagerIcons.jsx";
import {
  SectionHead,
  ContentPanel,
  Toolbar,
  SearchField,
  StatusBadge,
  Button,
  EmptyState,
} from "../ManagerUI.jsx";
import { RESERVATION_STATUS_META, RESERVATION_STATUS, FILTER_GROUPS, ALL_RESERVATION_STATUSES } from "@/shared/reservationStatus.js";
import { getReservationsFilterFromSearch } from "../../config/managerRoutes.js";
import {
  confirmReservation, rejectReservation, cancelReservation, getReservationDetails, updateReservation, getReservationHistory, resolveEditRequest, fetchAllReservations,
} from "../../services/managerApi.js";
import { useManagerPortal } from "../../context/ManagerPortalContext.jsx";
import ReservationStatusBadge from "@/components/shared/ReservationStatusBadge.jsx";
import EmptyVal from "@/components/shared/EmptyVal.jsx";
import { Pagination } from "@/components/ui/Pagination.jsx";



function formatReservationDateTime(reservation) {
  // Prefer the pre-split fields (socket payload or enriched API row).
  // Fall back to parsing the raw ISO timestamp that the DB always returns.
  const rawIso = reservation?.reservation_start_at;
  const dateRaw = reservation?.reservation_date ||
    (rawIso ? String(rawIso).slice(0, 10) : null);
  const timeStr = reservation?.start_time ||
    (rawIso ? String(rawIso).slice(11, 16) : "—");

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
function ReservationsSection({ reservations, setReservations, setTables, toast }) {
  const { user } = useManagerPortal();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [active, setActive] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editConfirmPending, setEditConfirmPending] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [resolveConfirmPending, setResolveConfirmPending] = useState(null);
  const [editRejectReason, setEditRejectReason] = useState("");
  const [resolving, setResolving] = useState(false);
  const [cancelModal, setCancelModal] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);


  /* ── Assign Table drawer state ── */
  const confirmingRef = useRef(new Set()); // guard against double-submit

  /* ── Date Picker State ── */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftRange, setDraftRange] = useState(() => {
    return { startDate: null, endDate: null, key: "selection" };
  });
  const [appliedRange, setAppliedRange] = useState(() => {
    return { startDate: null, endDate: null };
  });
  const [activePresetId, setActivePresetId] = useState("all");

  const closePicker = useCallback(() => setPickerOpen(false), []);
  const openPicker = useCallback(() => {
    setDraftRange({ startDate: appliedRange.startDate, endDate: appliedRange.endDate, key: "selection" });
    setPickerOpen(true);
  }, [appliedRange]);

  const handleApplyDate = useCallback((sel) => {
    setAppliedRange({ startDate: sel.startDate, endDate: sel.endDate });
    closePicker();
  }, [closePicker]);

  const handlePresetSelect = useCallback((preset) => {
    const range = preset.range || { startDate: preset.startDate, endDate: preset.endDate, key: "selection" };
    setActivePresetId(preset.id);
    setDraftRange(range);
    setAppliedRange({ startDate: range.startDate, endDate: range.endDate });
    closePicker();
  }, [closePicker]);

  const selectedDateLabel = useMemo(() => {
    if (!appliedRange.startDate) return "All Dates";
    const { startDate, endDate } = appliedRange;
    if (isSameDay(startDate, endDate)) return format(startDate, "dd/MM/yyyy");
    return `${format(startDate, "dd/MM")} – ${format(endDate, "dd/MM/yyyy")}`;
  }, [appliedRange]);


  const reservationList = useMemo(() => Array.isArray(reservations) ? reservations : [], [reservations]);

  /* ── URL filter sync ── */
  const urlFilter = useMemo(
    () => getReservationsFilterFromSearch(`?${searchParams.toString()}`),
    [searchParams]
  );

  useEffect(() => {
    let newStatus = "all";
    if (urlFilter === "pending payment" || urlFilter === "pending request" || urlFilter === "pending") newStatus = "Pending";
    else if (urlFilter === "await check-in" || urlFilter === "confirmed" || urlFilter === "reserved") newStatus = "Upcoming";
    else if (urlFilter === "arriving" || urlFilter === "check-in") newStatus = "In Progress";
    else if (urlFilter === "completed") newStatus = "Completed";

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatusFilter(newStatus);
    setCurrentPage(1);
  }, [urlFilter]);

  /* ── Server-side Fetching ── */
  const fetchPaginatedData = useCallback(async () => {
    try {
      const params = {
        page: currentPage,
        limit: 10,
        search,
        status: statusFilter,
      };
      
      const sd = appliedRange?.startDate;
      const ed = appliedRange?.endDate;
      if (sd && ed && sd !== "all" && sd !== "All Dates" && String(sd).trim() !== "") {
        params.startDate = format(new Date(sd), "yyyy-MM-dd");
        params.endDate = format(new Date(ed), "yyyy-MM-dd");
      }

      const res = await fetchAllReservations(user?.userId || user?.user_id, params);
      if (res?.source === "api") {
        setReservations(res.data);
        setTotalCount(res.totalCount || 0);
        setTotalPages(res.totalPages || 1);
      }
    } catch (error) {
      console.error("Failed to fetch paginated reservations:", error);
    }
  }, [currentPage, search, statusFilter, appliedRange?.startDate, appliedRange?.endDate, user?.userId, user?.user_id]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, appliedRange]);

  // Fetch data on page or filter changes
  useEffect(() => {
    fetchPaginatedData();
  }, [fetchPaginatedData]);

  const filtered = reservationList;

  /* ── KPI counts (now using totalCount from server for total bookings) ── */
  const kpiTotalBookings = totalCount;
  const kpiPendingRequests = useMemo(
    () => filtered.filter((r) => r.reservation_status === "Pending Request").length,
    [filtered]
  );
  const kpiCompleted = useMemo(
    () => filtered.filter((r) => r.reservation_status === "Completed").length,
    [filtered]
  );
  const kpiLostBookings = useMemo(
    () => filtered.filter((r) => r.reservation_status === "Cancelled" || r.reservation_status === "No Show").length,
    [filtered]
  );

  /* ════════════════════════════════════════════════════════════
     STATE MACHINE HANDLERS (Manager-Only Actions)
     ════════════════════════════════════════════════════════════ */

  const handleViewDetails = useCallback(async (row) => {
    const fetchId = parseInt(row?.reservation_id || row?.id, 10);
    if (!fetchId || isNaN(fetchId)) {
      console.warn("[handleViewDetails] No valid reservation ID on row:", row);
      return;
    }
    setActive(row);
    setDetailsLoading(true);
    setHistoryLoading(true);
    try {
      const full = await getReservationDetails(fetchId, user?.userId || user?.user_id);
      setActive(full);
      setIsEditing(false);
      setEditForm({
        customer_name: full.customer_name || "",
        customer_phone: full.customer_phone || full.phone || "",
        customer_email: full.customer_email || full.email || "",
        guest_count: full.guest_count || 1,
        table_id: full.table_id || "",
        occasion: full.dining_purpose || full.occasion || "",
        promotions: full.promotions || "",
        notes: full.special_request || full.notes || "",
        status: (full.status || full.reservation_status || "").toLowerCase(),
        edit_reason: "",
        reservation_start_at: full.reservation_start_at ? new Date(new Date(full.reservation_start_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "",
        duration: full.reservation_start_at && full.reservation_end_at ? Math.max(15, Math.round((new Date(full.reservation_end_at) - new Date(full.reservation_start_at)) / 60000) - 90) : 30
      });
      const hist = await getReservationHistory(fetchId, user?.userId || user?.user_id);
      setHistory(hist || []);
    } catch {
      setIsEditing(false);
      setEditForm({
        customer_name: row.customer_name || "",
        customer_phone: row.customer_phone || row.phone || "",
        customer_email: row.customer_email || row.email || "",
        guest_count: row.guest_count || 1,
        table_id: row.table_id || "",
        occasion: row.dining_purpose || row.occasion || "",
        promotions: row.promotions || "",
        notes: row.special_request || row.notes || "",
        status: (row.status || row.reservation_status || "").toLowerCase(),
        edit_reason: "",
        reservation_start_at: row.reservation_start_at ? new Date(new Date(row.reservation_start_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "",
        duration: row.reservation_start_at && row.reservation_end_at ? Math.max(15, Math.round((new Date(row.reservation_end_at) - new Date(row.reservation_start_at)) / 60000) - 90) : 30
      });
      setHistory([]);
    } finally {
      setDetailsLoading(false);
      setHistoryLoading(false);
    }
  }, [user]);

  const handleConfirm = useCallback(async (reservationToConfirm) => {
    const resId = reservationToConfirm.reservation_id || reservationToConfirm.id;

    // Guard: prevent double-firing if already in-flight for this booking
    if (confirmingRef.current.has(resId)) return;
    confirmingRef.current.add(resId);

    try {
      await confirmReservation(resId, [], user?.userId || user?.user_id);

      setReservations((prev) =>
        prev.map((r) =>
          r?.reservation_id === resId
            ? { ...r, status: "await check-in", reservation_status: RESERVATION_STATUS.AWAIT_CHECK_IN }
            : r
        )
      );

      toast(`Booking #${resId} confirmed successfully.`, "success");
    } catch (err) {
      // 409 = reservation was already confirmed (e.g. duplicate click) — treat as soft success
      if (err.status === 409 || (err.message || "").includes("already")) {
        setReservations((prev) =>
          prev.map((r) =>
            r?.reservation_id === resId
              ? { ...r, status: "await check-in", reservation_status: RESERVATION_STATUS.AWAIT_CHECK_IN }
              : r
          )
        );
        toast(`Booking #${resId} confirmed.`, "success");
      } else {
        toast(err.message || "Failed to confirm reservation.", "error");
      }
    } finally {
      confirmingRef.current.delete(resId);
    }
  }, [setReservations, toast, user]);

  const handleReject = useCallback(
    (reservation) => {
      const rejectId = reservation.reservation_id || reservation.id;
      setCancelReason("");
      setCancelModal({
        reservation: { ...reservation, reservation_id: rejectId },
        actionType: "reject",
      });
    },
    []
  );

  // Flow D — Manager proactively cancel/reject a reservation
  const handleCancelByManager = useCallback(async () => {
    if (!cancelModal?.reservation) return;
    const resId = cancelModal.reservation.reservation_id;
    const cleanReason = cancelReason.trim() || "Cancelled by manager";

    setCancelling(true);
    try {
      if (cancelModal.actionType === "reject") {
        await rejectReservation(resId, cleanReason, user?.userId || user?.user_id);
      } else {
        await cancelReservation(resId, cleanReason, user?.userId || user?.user_id);
      }

      setReservations((prev) =>
        prev.map((r) =>
          r?.reservation_id === resId || r?.id === resId
            ? { ...r, status: "cancelled", reservation_status: RESERVATION_STATUS.CANCELLED }
            : r
        )
      );

      const tableId = cancelModal.reservation.table_id;
      if (tableId && setTables) {
        setTables((prev) =>
          prev.map((t) =>
            String(t.table_id) === String(tableId)
              ? { ...t, status: "available", table_status: "Available" }
              : t
          )
        );
      }

      toast(`Reservation #${resId} cancelled/rejected. Table released.`, "success");
      setCancelModal(null);
      setCancelReason("");
      if (active?.reservation_id === resId) setActive(null);
    } catch (err) {
      toast(err.message || "Failed to cancel reservation.", "error");
    } finally {
      setCancelling(false);
    }
  }, [cancelModal, cancelReason, cancelReservation, rejectReservation, setReservations, setTables, toast, user, active, setActive]);

  const handleSaveEdit = useCallback(async () => {
    if (!active) return;
    const isRejecting = editForm.status === "reject check-in" || editForm.status === "reject request";
    if (isRejecting && (!editForm.edit_reason || editForm.edit_reason.trim() === "")) {
      toast("A reason is required when rejecting a reservation.", "error");
      return;
    }
    const editId = active.reservation_id || active.id;
    try {
      const payload = {
        contact_name: editForm.customer_name,
        contact_phone: editForm.customer_phone,
        contact_email: editForm.customer_email,
        guest_count: editForm.guest_count,
        special_request: editForm.notes || null,
        occasion: editForm.occasion || null,
        reservation_status: editForm.status === "reject check-in" ? RESERVATION_STATUS.REJECT_CHECK_IN : (editForm.status === "await check-in" ? RESERVATION_STATUS.AWAIT_CHECK_IN : editForm.status),
        preferred_area_id: active.preferred_area_id,
        reservation_start_at: new Date(editForm.reservation_start_at).toISOString(),
        reservation_end_at: new Date(new Date(editForm.reservation_start_at).getTime() + (90 + parseInt(editForm.duration)) * 60000).toISOString(),
        table_id: editForm.table_id || null
      };

      const result = await updateReservation(editId, payload, user?.userId || user?.user_id);
      toast("Reservation updated successfully.", "success");

      // removed onRefresh call

      setIsEditing(false);
      setDetailsLoading(true);
      try {
        const full = await getReservationDetails(editId, user?.userId || user?.user_id);
        setActive(full);
      } catch (e) {
        console.error("Failed to re-fetch active details:", e);
      } finally {
        setDetailsLoading(false);
      }

      if (editForm.status === "reject check-in" && active.table_id && setTables) {
        setTables((prev) =>
          prev.map((t) =>
            String(t.table_id) === String(active.table_id)
              ? { ...t, status: "available", table_status: "Available" }
              : t
          )
        );
      }
    } catch (err) {
      toast(err.message || "Failed to update reservation.", "error");
    }
  }, [active, editForm, setReservations, setTables, toast, user]);

  // Flow C — resolve an edit or cancel request
  const handleResolveRequest = useCallback(async (decision, rejectReason) => {
    if (!active || resolving) return;
    const reservationId = active.reservation_id || active.id;
    const requestType = active.request_type;
    setResolving(true);
    try {
      let endpoint, method, body;

      if (requestType === 'edit' || requestType === 'table_change') {
        // New endpoint for customer edit requests
        endpoint = `/api/manager/reservations/${reservationId}/resolve-edit`;
        method = 'POST';
        body = JSON.stringify({ decision, reject_reason: rejectReason || "" });
      } else if (requestType === 'cancel') {
        endpoint = `/api/manager/reservations/${reservationId}/resolve-cancel`;
        method = 'PATCH';
        body = JSON.stringify({ decision });
      } else {
        // Generic fallback
        endpoint = `/api/manager/reservations/${reservationId}/resolve-request`;
        method = 'PATCH';
        body = JSON.stringify({ decision });
      }

      const resp = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body,
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) throw new Error(data.message || 'Request failed');

      // Apply pending changes to local state if confirmed edit
      let appliedChanges = {};
      if (decision === 'confirm' && data.applied_changes) {
        appliedChanges = data.applied_changes;
      }

      // Update local list
      setReservations((prev) =>
        prev.map((r) => {
          if ((r?.reservation_id || r?.id) !== reservationId) return r;
          const isCancelProcessed = requestType === 'cancel' && decision === 'process';
          const newStatus = isCancelProcessed ? RESERVATION_STATUS.CANCELLED : (data.reservation_status || r.reservation_status || RESERVATION_STATUS.CONFIRMED);
          return {
            ...r,
            has_pending_request: 0,
            request_type: null,
            pending_changes_json: null,
            display_status: newStatus,
            reservation_status: newStatus,
            status: newStatus.toLowerCase(),
            // Apply confirmed changes
            ...(appliedChanges.guest_count && { guest_count: appliedChanges.guest_count }),
            ...(appliedChanges.special_request && { special_request: appliedChanges.special_request }),
          };
        })
      );

      const actionLabel = requestType === 'cancel'
        ? (decision === 'process' ? 'Cancellation processed' : 'Cancellation rejected')
        : (decision === 'confirm' ? 'Edit request confirmed ✓' : 'Edit request declined');
      toast(`${actionLabel} for booking #${reservationId}.`, 'success');
      setActive(null);
      setResolveConfirmPending(null);
    } catch (err) {
      toast(err.message || 'Failed to resolve request.', 'error');
    } finally {
      setResolving(false);
    }
  }, [active, resolving, setReservations, toast]);

  const sortedFiltered = filtered;

  return (
    <div className="sfx-stack">

      <div className="staff-reservation-kpis sfx-kpis mb-2" aria-label="Reservation summary">
        <article className="sfx-kpi sfx-kpi--blue">
          <div className="sfx-kpi__top">
            <span className="sfx-kpi__icon" aria-hidden="true"><Icon name="calendar" size={18} /></span>
          </div>
          <p className="sfx-kpi__value">{kpiTotalBookings}</p>
          <p className="sfx-kpi__label">Total Reservations</p>
        </article>

        <article className="sfx-kpi sfx-kpi--amber">
          <div className="sfx-kpi__top">
            <span className="sfx-kpi__icon" aria-hidden="true"><Icon name="bell" size={18} /></span>
          </div>
          <p className="sfx-kpi__value">{kpiPendingRequests}</p>
          <p className="sfx-kpi__label">Pending Requests</p>
        </article>

        <article className="sfx-kpi sfx-kpi--green">
          <div className="sfx-kpi__top">
            <span className="sfx-kpi__icon" aria-hidden="true"><Icon name="check" size={18} /></span>
          </div>
          <p className="sfx-kpi__value">{kpiCompleted}</p>
          <p className="sfx-kpi__label">Completed</p>
        </article>

        <article className="sfx-kpi sfx-kpi--red">
          <div className="sfx-kpi__top">
            <span className="sfx-kpi__icon" aria-hidden="true"><Icon name="close" size={18} /></span>
          </div>
          <p className="sfx-kpi__value">{kpiLostBookings}</p>
          <p className="sfx-kpi__label">Lost Reservations</p>
        </article>
      </div>

      <div className="sfx-card sfx-card--overflow-visible sfx-card--featured-dashboard staff-reservations-card">
        <header className="sfx-card__head sfx-card__head--dashboard">
          <div>
            <h3 className="sfx-card__title sfx-card__title--dashboard">Reservations</h3>
            <p className="sfx-muted sfx-card__subtitle--dashboard">
              {`Reservations for ${selectedDateLabel}`}
            </p>
          </div>
          <span className="sfx-muted sfx-card__counter--dashboard">{totalCount} reservations</span>
        </header>

        <div className="sfx-tablemap-filter__container">
          <div className="sfx-tablemap-filter__search-box">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Customer, table, phone, or reservation ID…"
            />
          </div>

          <div className="sfx-tablemap-filter__area-box">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="sfx-input sfx-tablemap-filter__select"
            >
              <option value="all">All statuses</option>
              {ALL_RESERVATION_STATUSES.map((statusVal) => (
                <option key={statusVal} value={statusVal}>
                  {RESERVATION_STATUS_META[statusVal]?.label || statusVal}
                </option>
              ))}
            </select>
          </div>

          <div className="sfx-tablemap-filter__actions"></div>



          <div className={`staff-reservations-toolbar__date${pickerOpen ? " is-open" : ""}`} style={{ marginLeft: "auto", position: "relative" }}>
            <button
              type="button"
              className="staff-reservations-date-trigger sfx-picker__trigger"
              onClick={() => (pickerOpen ? closePicker() : openPicker())}
              aria-label="Select date"
              aria-expanded={pickerOpen}
            >
              <span className="staff-reservations-toolbar__date-label sfx-picker__trigger-label">
                {selectedDateLabel}
              </span>
              <span className="sfx-kpi__icon sfx-kpi__icon--trigger sfx-picker__trigger-icon">
                <Icon name="calendar" size={16} style={{ pointerEvents: "none" }} />
              </span>
            </button>
            {pickerOpen && (
              <div className="sfx-picker__popover">
                <DashboardDateRangePicker
                  inline={true}
                  allowFuture={true}
                  draftRange={draftRange}
                  activePresetId={activePresetId}
                  onDraftChange={(selection) => { setDraftRange(selection); setActivePresetId("custom"); }}
                  onPresetSelect={handlePresetSelect}
                  onApply={handleApplyDate}
                  onCancel={closePicker}
                />
              </div>
            )}
          </div>
        </div>

        <div className="sfx-table-wrap">
          <table className="sfx-table sfx-table--hover staff-reservations-table sfx-reservations-table sfx-reservations__table-bg">
            <thead>
              <tr className="sfx-reservations__tr-head-bg">
                <th className="sfx-reservations__th" style={{ width: "50px", textAlign: "center" }}>#</th>
                <th className="sfx-reservations__th" style={{ width: "130px", textAlign: "center" }}>Reservation ID</th>
                <th className="sfx-reservations__th" style={{ width: "110px", textAlign: "center" }}>Date</th>
                <th className="sfx-reservations__th" style={{ width: "160px", textAlign: "center" }}>Customer</th>
                <th className="sfx-reservations__th" style={{ width: "125px", textAlign: "center" }}>Phone</th>
                <th className="sfx-reservations__th" style={{ width: "190px", textAlign: "center" }}>Email</th>
                <th className="sfx-reservations__th" style={{ width: "135px", textAlign: "center" }}>Status</th>
                <th className="sfx-reservations__th" style={{ width: "210px", textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <motion.tbody
              variants={listContainerVariants}
              initial="hidden"
              animate="visible"
            >
              {sortedFiltered.filter(Boolean).map((r, index) => {
                const currentId = r.id || r.reservation_id;
                // Use display_status (computed by backend CASE expression) over raw reservation_status
                const displayStatusRaw = r.display_status || r.reservation_status || RESERVATION_STATUS.PENDING_PAYMENT;
                const currentStatus = (r.status || r.reservation_status || "").trim().toLowerCase();
                const meta = RESERVATION_STATUS_META[r.reservation_status || r.status || RESERVATION_STATUS.PENDING_REQUEST] || { label: currentStatus, tone: "default" };
                const isPending = currentStatus === "pending payment" || currentStatus === "pending request" || currentStatus === "pending";
                const isConfirmed = currentStatus === "await check-in" || currentStatus === "confirmed" || currentStatus === "reserved" || currentStatus === "paid";
                const isRequest = currentStatus === "request";

                const appTime = r.confirmed_at || r.updated_at;
                const approvalTime = (appTime && !isNaN(new Date(appTime).getTime()))
                  ? format(new Date(appTime), "dd/MM/yyyy HH:mm")
                  : <EmptyVal val="" />;

                return (
                  <motion.tr
                    key={currentId}
                    variants={listItemVariants}
                    className="sfx-reservations__tr"
                  >
                    {/* Index Sequence */}
                    <td className="sfx-reservations__td-index">
                      {(currentPage - 1) * 10 + index + 1}
                    </td>
                    {/* Reservation ID — sans-serif, black */}
                    <td className="sfx-reservations__td-id">
                      #{String(currentId).padStart(6, "0")}
                    </td>
                    {/* Date — sans-serif, black */}
                    <td className="sfx-reservations__td-date">
                      {(() => {
                        const rawIso = r.reservation_start_at;
                        const dateRaw = r.reservation_date || (rawIso ? String(rawIso).slice(0, 10) : null);
                        if (!dateRaw) return <EmptyVal val="" />;
                        try {
                          return format(parseISO(dateRaw.includes("T") ? dateRaw : `${dateRaw}T12:00:00`), "dd/MM/yyyy");
                        } catch { return dateRaw; }
                      })()}
                    </td>
                    <td className="sfx-reservations__td-customer">
                      <div className="sfx-reservations__customer-container">
                        <span><EmptyVal val={r.customer_name} /></span>
                        {(r.reservation_source === 'Walk-in' || r.source === 'Walk-in') && (
                          <span className="sfx-reservations__walk-in-tag">
                            Customer Walk-in
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="sfx-reservations__td-phone"><EmptyVal val={r.customer_phone || r.phone} /></td>
                    <td className="sfx-reservations__td-email"><EmptyVal val={r.customer_email || r.email} /></td>
                    <td className="sfx-reservations__td-status">
                      <div className="sfx-reservations__status-container">
                        <ReservationStatusBadge
                          status={displayStatusRaw === "Request" ? "Request" : (r.reservation_status || displayStatusRaw)}
                          size="sm"
                          isFlashing={r._isFlashing}
                        />
                      </div>
                    </td>
                    <td className="sfx-reservations__td-actions">
                      <div className="sfx-rowacts sfx-reservations__actions-container">
                        <Button size="sm" variant="ghost" icon="eye" onClick={() => handleViewDetails(r)}>
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="gold"
                          onClick={() => { handleViewDetails(r); setIsEditing(true); }}
                        >
                          Edit
                        </Button>
                        {(isConfirmed || isPending) && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => { setCancelReason(""); setCancelModal({ reservation: { ...r, reservation_id: currentId } }); }}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </motion.tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalCount={totalCount}
            limit={10}
          />
        )}
        {filtered.length === 0 ? (
          <EmptyState
            title="No reservations match your filters"
            hint="Try clearing the search or status filter."
          />
        ) : null}
      </div>
      <ManagerDrawer
        open={Boolean(active)}
        title="Reservation Details"
        onClose={() => setActive(null)}
        footer={
          isEditing ? (
            <div className="sfx-drawer__acts">
              <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel Edit</Button>
              <Button variant="gold" onClick={() => setEditConfirmPending(true)}>Save Changes</Button>
            </div>
          ) : active && active.has_pending_request ? (
            // Flow C — pending request footer
            <div className="sfx-drawer__acts" style={{ justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: 8 }}>
              {active.request_type === 'cancel' ? (
                <>
                  <Button variant="ghost" onClick={() => setResolveConfirmPending({ type: 'cancel', decision: 'reject' })}>
                    Reject Cancellation
                  </Button>
                  <Button variant="danger" onClick={() => setResolveConfirmPending({ type: 'cancel', decision: 'process' })}>
                    Process Refund &amp; Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="danger" onClick={() => setResolveConfirmPending({ type: 'edit', decision: 'decline' })} disabled={resolving}>
                    {resolving ? "Processing…" : "✕ Reject Request"}
                  </Button>
                  <Button variant="gold" onClick={() => setResolveConfirmPending({ type: 'edit', decision: 'confirm' })} disabled={resolving}>
                    {resolving ? "Processing…" : "✓ Confirm Request"}
                  </Button>
                </>
              )}
            </div>
          ) : active ? (
            <div className="sfx-drawer__acts" style={{ justifyContent: "space-between", width: "100%" }}>
              <Button variant="ghost" onClick={() => setIsEditing(true)}>Edit Details</Button>
              <div style={{ display: "flex", gap: "8px" }}>
                {(active.status || active.reservation_status || "").toLowerCase() === "pending payment" ? (
                  <>
                    <Button variant="danger" onClick={() => handleReject(active)}>Reject booking</Button>
                    <Button variant="gold" onClick={() => { handleConfirm(active); setActive(null); }}>Confirm</Button>
                  </>
                ) : (active.status || active.reservation_status || "").toLowerCase() === "await check-in" ? (
                  <Button variant="danger" onClick={() => handleReject(active)}>Reject booking</Button>
                ) : null}
              </div>
            </div>
          ) : null
        }
      >
        {active ? (
          detailsLoading ? (
            <div style={{ padding: "24px 0", display: "flex", flexDirection: "column", gap: "24px" }} aria-busy="true" aria-label="Loading reservation details">
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <Skeleton className="w-24 h-8" />
                <Skeleton className="w-32 h-4" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <Skeleton className="w-16 h-3" />
                  <Skeleton className="w-32 h-5" />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <Skeleton className="w-16 h-3" />
                  <Skeleton className="w-28 h-5" />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <Skeleton className="w-16 h-3" />
                  <Skeleton className="w-36 h-5" />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <Skeleton className="w-16 h-3" />
                  <Skeleton className="w-24 h-5" />
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                <Skeleton className="w-24 h-4" />
                <Skeleton className="w-full h-12" />
              </div>
            </div>
          ) : (
            <div className="sfx-detail">
              <div style={{ textAlign: "center", marginBottom: 24, marginTop: 8 }}>
                <h2 style={{ fontSize: "28px", margin: "0 0 12px 0", fontWeight: 700, letterSpacing: "0.05em" }}>
                  #{String(active.reservation_id).padStart(6, "0")}
                </h2>
              {(() => {
                const isPendingActive = Boolean(
                  active?.has_pending_request === 1 ||
                  active?.has_pending_request === true ||
                  active?.reservation_status === "Pending Request" ||
                  active?.status === "Pending Request" ||
                  active?.reservation_status === "Request" ||
                  active?.status === "Request" ||
                  (active?.pending_changes_json && active?.pending_changes_json !== "{}" && active?.pending_changes_json !== "null") ||
                  (active?.request_type && active?.request_type !== "")
                );

                return isPendingActive ? (
                  <span style={{ display: "inline-flex", alignItems: "center", background: "rgba(245, 158, 11, 0.12)", color: "#b45309", fontSize: 12, fontWeight: 800, padding: "5px 16px", borderRadius: 24, letterSpacing: "0.08em", border: "1px solid rgba(245, 158, 11, 0.35)", textTransform: "uppercase" }}>
                    PENDING REQUEST
                  </span>
                ) : (
                  <StatusBadge tone={RESERVATION_STATUS_META[(active.status || active.reservation_status || "")]?.tone || "default"} color={RESERVATION_STATUS_META[(active.status || active.reservation_status || "")]?.color}>
                    {RESERVATION_STATUS_META[(active.status || active.reservation_status || "")]?.label || active.reservation_status}
                  </StatusBadge>
                );
              })()}
              </div>

              {/* 50-50 Split Layout for Pending Requests */}
              {Boolean(
                active?.has_pending_request === 1 ||
                active?.has_pending_request === true ||
                active?.reservation_status === "Pending Request" ||
                active?.status === "Pending Request" ||
                active?.reservation_status === "Request" ||
                active?.status === "Request" ||
                (active?.pending_changes_json && active?.pending_changes_json !== "{}" && active?.pending_changes_json !== "null") ||
                (active?.request_type && active?.request_type !== "")
              ) ? (() => {
                let pendingChanges = {};
                try { pendingChanges = JSON.parse(active.pending_changes_json || "{}"); } catch (_) { }

                const fmt = (iso) => {
                  try { return format(new Date(iso), "dd/MM/yyyy HH:mm"); } catch { return String(iso || "—"); }
                };

                const rawSpecial = active.special_request || active.notes || "";
                const cleanNote = String(rawSpecial)
                  .replace(/\[PreferredTable[^\]]*\]/gi, "")
                  .replace(/\[PreferredTableId[^\]]*\]/gi, "")
                  .replace(/\[Assignment[^\]]*\]/gi, "")
                  .replace(/\[[^\]]+\]/g, "")
                  .trim();

                let preferredTable = null;
                const prefMatch = String(rawSpecial).match(/\[PreferredTable:\s*([^\]]+)\]/i);
                if (prefMatch && prefMatch[1]) {
                  preferredTable = prefMatch[1].trim();
                }

                const rawOrigTable = active.assigned_tables || active.table_label || null;
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

                const origArea = active.assigned_area_name || active.area_name || active.preferred_area || "Any Area";
                const newArea = pendingChanges.area_name || pendingChanges.preferred_area || origArea;

                const origStart = active.reservation_start_at ? fmt(active.reservation_start_at) : "—";
                const newStart = pendingChanges.reservation_start_at ? fmt(pendingChanges.reservation_start_at) : origStart;

                const origEnd = active.reservation_end_at ? fmt(active.reservation_end_at) : "—";
                const newEnd = pendingChanges.reservation_end_at ? fmt(pendingChanges.reservation_end_at) : origEnd;

                const origGuests = String(active.guest_count || "—") + " Guests";
                const newGuests = (pendingChanges.guest_count != null ? String(pendingChanges.guest_count) : String(active.guest_count || "—")) + " Guests";

                const origPhone = active.customer_phone || active.contact_phone || "—";
                const newPhone = pendingChanges.contact_phone || pendingChanges.phone || origPhone;

                const origNotesVal = cleanNote || "None";
                const newNotesVal = pendingChanges.special_request || pendingChanges.notes || origNotesVal;

                const origDining = active.dining_purpose || active.occasion || "None";
                const newDining = pendingChanges.dining_purpose || pendingChanges.occasion || origDining;

                const createdStr = active.created_time || active.created_at ? fmt(active.created_time || active.created_at) : "—";

                const compareFields = [
                  { label: "Request Time", orig: createdStr, new: createdStr },
                  { label: "Customer Name", orig: active.customer_name || "—", new: active.customer_name || "—" },
                  { label: "Contact Phone", orig: origPhone, new: newPhone },
                  { label: "Email Address", orig: active.customer_email || active.email || "—", new: active.customer_email || active.email || "—" },
                  { label: "Start Time", orig: origStart, new: newStart },
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
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 16, alignItems: "start" }}>
                    <span style={{ color: "var(--sfx-muted)", fontWeight: "normal", fontSize: "13px", alignSelf: "center" }}>Request Time</span>
                    <strong style={{ fontWeight: "bold", fontSize: "14px", color: "var(--sfx-gold)" }}>
                      {active.created_time || active.created_at
                        ? !isNaN(new Date(active.created_time || active.created_at).getTime())
                          ? format(new Date(active.created_time || active.created_at), "dd/MM/yyyy HH:mm")
                          : "---"
                        : "---"}
                    </strong>
                  </div>
                <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 16, alignItems: "start" }}>
                  <span style={{ color: "var(--sfx-muted)", fontWeight: "normal", fontSize: "13px", alignSelf: "center" }}>Customer Name</span>
                  {isEditing ? (
                    <input className="sfx-input" value={editForm.customer_name} onChange={e => setEditForm(p => ({ ...p, customer_name: e.target.value }))} />
                  ) : (
                    <strong style={{ fontWeight: "bold", fontSize: "14px" }}>{active.customer_name}</strong>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 16, alignItems: "start" }}>
                  <span style={{ color: "var(--sfx-muted)", fontWeight: "normal", fontSize: "13px", alignSelf: "center" }}>Contact Phone</span>
                  {isEditing ? (
                    <input className="sfx-input" value={editForm.customer_phone} onChange={e => setEditForm(p => ({ ...p, customer_phone: e.target.value }))} />
                  ) : (
                    <strong style={{ fontWeight: "bold", fontSize: "14px" }}><EmptyVal val={active.customer_phone || active.phone} /></strong>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 16, alignItems: "start" }}>
                  <span style={{ color: "var(--sfx-muted)", fontWeight: "normal", fontSize: "13px", alignSelf: "center" }}>Email Address</span>
                  {isEditing ? (
                    <input className="sfx-input" type="email" value={editForm.customer_email} onChange={e => setEditForm(p => ({ ...p, customer_email: e.target.value }))} />
                  ) : (
                    <strong style={{ fontWeight: "bold", fontSize: "14px" }}><EmptyVal val={active.customer_email || active.email} /></strong>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 16, alignItems: "start" }}>
                  <span style={{ color: "var(--sfx-muted)", fontWeight: "normal", fontSize: "13px" }}>Start Time</span>
                  {isEditing ? (
                    <input className="sfx-input" type="datetime-local" value={editForm.reservation_start_at} onChange={e => setEditForm(p => ({ ...p, reservation_start_at: e.target.value }))} />
                  ) : (
                    <strong style={{ fontWeight: "bold", fontSize: "14px" }}>
                      <EmptyVal val={active.reservation_start_at ? format(new Date(active.reservation_start_at), "HH:mm (dd/MM/yyyy)") : (active.start_time ? `${active.start_time} (${active.reservation_date})` : null)} />
                    </strong>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 16, alignItems: "start" }}>
                  <span style={{ color: "var(--sfx-muted)", fontWeight: "normal", fontSize: "13px", alignSelf: "center" }}>Guests</span>
                  {isEditing ? (
                    <input className="sfx-input" type="number" min="1" value={editForm.guest_count} onChange={e => setEditForm(p => ({ ...p, guest_count: e.target.value }))} />
                  ) : (
                    <strong style={{ fontWeight: "bold", fontSize: "14px" }}>{active.guest_count}</strong>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 16, alignItems: "start" }}>
                  <span style={{ color: "var(--sfx-muted)", fontWeight: "normal", fontSize: "13px", alignSelf: "center" }}>Table</span>
                  {isEditing ? (
                    <input className="sfx-input" type="number" value={editForm.table_id} onChange={e => setEditForm(p => ({ ...p, table_id: e.target.value }))} placeholder="e.g. 1" />
                  ) : (
                    <strong style={{ fontWeight: "bold", fontSize: "14px" }}>{active.assigned_tables || active.table_label || "Unassigned"}</strong>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 16, alignItems: "start" }}>
                  <span style={{ color: "var(--sfx-muted)", fontWeight: "normal", fontSize: "13px" }}>Area</span>
                  <strong style={{ fontWeight: "bold", fontSize: "14px" }}>{active.assigned_area_name || active.area_name || active.preferred_area || "Any"}</strong>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 16, alignItems: "start" }}>
                  <span style={{ color: "var(--sfx-muted)", fontWeight: "normal", fontSize: "13px", alignSelf: "center" }}>Dining Purpose</span>
                  {isEditing ? (
                    <select
                      className="sfx-select"
                      value={editForm.occasion}
                      onChange={e => setEditForm(p => ({ ...p, occasion: e.target.value }))}
                    >
                      <option value="Casual Dinner">Casual Dinner</option>
                      <option value="Casual Date">Casual Date</option>
                      <option value="Date Night">Date Night</option>
                      <option value="Birthday">Birthday</option>
                      <option value="Anniversary">Anniversary</option>
                      <option value="Business Meeting">Business Meeting</option>
                      <option value="Family Gathering">Family Gathering</option>
                      <option value="Special Occasion">Special Occasion</option>
                      <option value="Other">Other</option>
                    </select>
                  ) : (
                    <strong style={{ fontWeight: "bold", fontSize: "14px" }}>
                      {(() => {
                        const dp = active.dining_purpose || active.occasion;
                        return <EmptyVal val={dp} fallback="None" />;
                      })()}
                    </strong>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 16, alignItems: "start" }}>
                  <span style={{ color: "var(--sfx-muted)", fontWeight: "normal", fontSize: "13px", alignSelf: "center" }}>Duration</span>
                  {isEditing ? (
                    <select className="sfx-select" value={editForm.duration} onChange={e => setEditForm(p => ({ ...p, duration: parseInt(e.target.value) }))}>
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={45}>45 minutes</option>
                      <option value={60}>60 minutes</option>
                    </select>
                  ) : (
                    <strong style={{ fontWeight: "bold", fontSize: "14px" }}>
                      {(() => {
                        if (active.reservation_start_at && active.reservation_end_at) {
                          const diffMs = new Date(active.reservation_end_at) - new Date(active.reservation_start_at);
                          const mins = Math.round(diffMs / 60000);
                          if (mins > 0) return `${mins} minutes`;
                        }
                        return <EmptyVal val="" fallback="None" />;
                      })()}
                    </strong>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 16, alignItems: "start" }}>
                  <span style={{ color: "var(--sfx-muted)", fontWeight: "normal", fontSize: "13px", alignSelf: "center" }}>Promotions</span>
                  {isEditing ? (
                    <input className="sfx-input" value={editForm.promotions} onChange={e => setEditForm(p => ({ ...p, promotions: e.target.value }))} />
                  ) : (
                    <EmptyVal val={active.promotions} fallback="None" />
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 16, alignItems: "start" }}>
                  <span style={{ color: "var(--sfx-muted)", fontWeight: "normal", fontSize: "13px", alignSelf: "center" }}>Status</span>
                  {isEditing ? (
                    <select className="sfx-select" value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}>
                      {Object.entries(RESERVATION_STATUS_META).map(([k, m]) => (
                        <option key={k} value={k}>{m.label}</option>
                      ))}
                    </select>
                  ) : (
                    <strong style={{ fontWeight: "bold", fontSize: "14px" }}>
                      {active.has_pending_request ? "Pending Request" : (RESERVATION_STATUS_META[(active.status || active.reservation_status || "")]?.label || active.reservation_status)}
                    </strong>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 16, alignItems: "start" }}>
                  <span style={{ color: "var(--sfx-muted)", fontWeight: "normal", fontSize: "13px", alignSelf: "center" }}>Source</span>
                  <strong style={{ fontWeight: "bold", fontSize: "14px" }}>
                    {active.reservation_source || active.source || "Online"}
                    {(active.reservation_source === 'Walk-in' || active.source === 'Walk-in') && (
                      <span style={{ marginLeft: 8, fontSize: 11, color: '#856404', background: '#fff3cd', padding: '2px 6px', borderRadius: 4, fontWeight: 'bold' }}>
                        Customer Walk-in
                      </span>
                    )}
                  </strong>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 16, alignItems: "start" }}>
                  <span style={{ color: "var(--sfx-muted)", fontWeight: "normal", fontSize: "13px", alignSelf: "start" }}>Notes</span>
                  {isEditing ? (
                    <textarea className="sfx-input" rows="3" value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} />
                  ) : (() => {
                    const rawNote = active.special_request || active.notes || "";
                    const cleanNote = String(rawNote)
                      .replace(/\[PreferredTable[^\]]*\]/gi, "")
                      .replace(/\[PreferredTableId[^\]]*\]/gi, "")
                      .replace(/\[Assignment[^\]]*\]/gi, "")
                      .replace(/\[[^\]]+\]/g, "")
                      .trim();
                    return cleanNote ? (
                      <strong style={{ fontWeight: "bold", fontSize: "14px", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                        {cleanNote}
                      </strong>
                    ) : (
                      <EmptyVal val="" fallback="None" />
                    );
                  })()}
                </div>
                {isEditing && (
                  <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 16, alignItems: "start" }}>
                    <span style={{ color: "var(--sfx-muted)", fontWeight: "normal", fontSize: "13px", alignSelf: "center" }}>Reason for Edit {(editForm.status === "reject check-in" || editForm.status === "reject request") && <span style={{ color: "#ef4444" }}>*</span>}</span>
                    <input className="sfx-input" value={editForm.edit_reason || ""} onChange={e => setEditForm(p => ({ ...p, edit_reason: e.target.value }))} placeholder="Reason for changing details or rejecting" />
                  </div>
                )}
              </div>
            )}

              <div className="sfx-detail__block" style={{ marginTop: 24 }}>
                <span style={{ color: "var(--sfx-muted)", fontWeight: "normal", fontSize: "13px", marginBottom: 8, display: "block" }}>Pre-ordered items</span>
                {(() => {
                  const preorders = active.preorders || active.preorder || [];
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

              {!isEditing && (
                <div className="sfx-detail__block" style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border-color)" }}>
                  <span style={{ color: "var(--sfx-muted)", fontWeight: "bold", fontSize: "14px", marginBottom: 12, display: "block" }}>Reservation Timeline</span>
                  {historyLoading ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="sfx-spinner" style={{ width: 14, height: 14 }} />
                      <span style={{ fontSize: "13px", color: "var(--sfx-muted)" }}>Loading timeline...</span>
                    </div>
                  ) : history.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 0, position: "relative" }}>
                      {history.map((hist, idx) => {
                        const ACTION_COLOR = {
                          RESERVATION_CREATED: "#c9a96e",
                          CHECK_IN_RESERVATION: "#22c55e",
                          STAFF_CHECKIN_CONFIRMED: "#22c55e",
                          PAYMENT_CHECKOUT_AUTO: "#c2610a",
                          STAFF_CHECKOUT_CONFIRMED: "#7c5cbf",
                          REJECT_RESERVATION: "#ef4444",
                          REJECT_CHECKIN: "#ef4444",
                          MANAGER_CONFIRMED: "#3b82f6",
                          MANAGER_RESOLVE_REQUEST: "#14b8a6",
                          MANAGER_APPROVED_EDIT: "#14b8a6",
                          MANAGER_DECLINE_REQUEST: "#ef4444",
                          CANCEL_RESERVATION: "#ef4444",
                          CUSTOMER_INITIATED_RESERVATION: "#c9a96e",
                          RESERVATION_CREATED: "#c9a96e",
                          SYSTEM_TABLE_STATUS_CONFLICT: "#eab308",
                          AUTOMATED_PAYMENT_SUCCESS: "#22c55e",
                          CUSTOMER_EDIT_REQUEST: "#3b82f6",
                          CUSTOMER_CANCEL_REQUEST: "#ef4444",
                          STAFF_RESOLVED_CHANGE_REQUEST: "#14b8a6",
                          MANAGER_APPROVED_CHANGE_REQUEST: "#14b8a6",
                          CHECK_IN_RESERVATION: "#22c55e",
                          STAFF_CHECKIN_CONFIRMED: "#22c55e",
                          PAYMENT_CHECKOUT_AUTO: "#c2610a",
                          STAFF_CHECKOUT_CONFIRMED: "#7c5cbf",
                          REJECT_RESERVATION: "#ef4444",
                          REJECT_CHECKIN: "#ef4444",
                          MANAGER_CONFIRMED: "#3b82f6",
                          MANAGER_RESOLVE_REQUEST: "#14b8a6",
                          MANAGER_APPROVED_EDIT: "#14b8a6",
                          MANAGER_DECLINE_REQUEST: "#ef4444",
                          CANCEL_RESERVATION: "#ef4444",
                          CUSTOMER_CANCELLED_RESERVATION: "#ef4444",
                          STAFF_SEND_COOKING_QUEUE: "#8b5cf6",
                          "Staff Send Cooking Queue": "#8b5cf6",
                          SEED_TEST_RESERVATION: "#c9a96e",
                          REJECT_CHECKOUT: "#ef4444",
                        };
                        const ACTION_LABEL = {
                          CUSTOMER_INITIATED_RESERVATION: "Reservation Created",
                          RESERVATION_CREATED: "Reservation Created",
                          SYSTEM_TABLE_STATUS_CONFLICT: "Table Status Conflict",
                          AUTOMATED_PAYMENT_SUCCESS: "Payment Successful",
                          CUSTOMER_EDIT_REQUEST: "Change Request Submitted",
                          CUSTOMER_CANCEL_REQUEST: "Cancellation Requested",
                          STAFF_RESOLVED_CHANGE_REQUEST: "Change Request Approved",
                          MANAGER_APPROVED_CHANGE_REQUEST: "Change Request Approved",
                          CHECK_IN_RESERVATION: "Check-in Confirmed",
                          STAFF_CHECKIN_CONFIRMED: "Check-in Confirmed",
                          PAYMENT_CHECKOUT_AUTO: "Payment Completed",
                          STAFF_CHECKOUT_CONFIRMED: "Check-out Confirmed",
                          REJECT_RESERVATION: "Reservation Rejected",
                          REJECT_CHECKIN: "Check-in Rejected",
                          MANAGER_CONFIRMED: "Manager Confirmed",
                          MANAGER_RESOLVE_REQUEST: "Manager Approved",
                          MANAGER_APPROVED_EDIT: "Edit Approved",
                          MANAGER_DECLINE_REQUEST: "Edit Request Rejected",
                          CANCEL_RESERVATION: "Reservation Cancelled",
                          CUSTOMER_CANCELLED_RESERVATION: "Reservation Cancelled",
                          STAFF_SEND_COOKING_QUEUE: "Sent to Kitchen",
                          "Staff Send Cooking Queue": "Sent to Kitchen",
                          SEED_TEST_RESERVATION: "Seed Test Reservation",
                          REJECT_CHECKOUT: "Check-out Rejected",
                        };

                        const rawAction = hist.action_name || "";
                        const color = ACTION_COLOR[rawAction] || "#8a8175";
                        let label = ACTION_LABEL[rawAction] || hist.label;
                        if (!label) {
                          label = rawAction
                            .replace(/_/g, " ")
                            .toLowerCase()
                            .replace(/\b\w/g, (c) => c.toUpperCase())
                            .trim();
                        }

                        let performerName = hist.performed_by || hist.actor_name || "System";
                        let actorRole = hist.role_name;
                        if (!actorRole) {
                          if (["RESERVATION_CREATED", "CUSTOMER_INITIATED_RESERVATION", "CUSTOMER_EDIT_REQUEST", "CUSTOMER_CANCEL_REQUEST"].includes(rawAction)) {
                            actorRole = "Customer";
                            if (performerName === "System") {
                              performerName = active.customer_name || active.contact_name || "Guest";
                            }
                          } else if (["CHECK_IN_RESERVATION", "STAFF_CHECKIN_CONFIRMED", "STAFF_CHECKOUT_CONFIRMED", "REJECT_RESERVATION", "REJECT_CHECKIN", "STAFF_SEND_COOKING_QUEUE", "Staff Send Cooking Queue", "STAFF_RESOLVED_CHANGE_REQUEST"].includes(rawAction)) {
                            actorRole = "Staff";
                          } else if (["MANAGER_CONFIRMED", "MANAGER_RESOLVE_REQUEST", "MANAGER_APPROVED_EDIT", "MANAGER_DECLINE_REQUEST", "MANAGER_APPROVED_CHANGE_REQUEST"].includes(rawAction)) {
                            actorRole = "Manager";
                          } else {
                            actorRole = "System";
                          }
                        }

                        // Timestamp
                        const tsStr = (hist.created_time || hist.created_at) && !isNaN(new Date(hist.created_time || hist.created_at).getTime())
                          ? format(new Date(hist.created_time || hist.created_at), "dd/MM HH:mm")
                          : "---";
                        // Extract sent_to from notes if it's a kitchen queue action
                        let destInfo = "";
                        if (rawAction === "Staff Send Cooking Queue" || rawAction === "STAFF_SEND_COOKING_QUEUE") {
                          if (hist.notes && hist.notes.sent_to) destInfo = ` ➔ ${hist.notes.sent_to}`;
                        }

                        const displayPerformer = performerName && performerName !== "System" ? ` ${performerName}` : "";

                        return (
                          <div key={idx} className="sfx-reservations__timeline-item">
                            {idx < history.length - 1 && (
                              <div className="sfx-reservations__timeline-line" />
                            )}
                            <div className="sfx-reservations__timeline-dot-container" style={{ background: color, boxShadow: `0 0 0 3px color-mix(in srgb, ${color} 20%, transparent)` }} />
                            <div className="sfx-reservations__timeline-content">
                              <div className="sfx-reservations__timeline-header">
                                <span className="sfx-reservations__timeline-label">{label}</span>
                                <span className="sfx-reservations__timeline-time">{tsStr !== "---" ? tsStr.replace(" ", " ") : ""}</span>
                              </div>
                              {actorRole && (
                                <span className="sfx-reservations__timeline-actor">
                                  By {actorRole}{displayPerformer}{destInfo}
                                </span>
                              )}
                              {hist.notes && (
                                typeof hist.notes === "string" ? (
                                  <div className="sfx-reservations__timeline-reason">
                                    Reason: {hist.notes}
                                  </div>
                                ) : (hist.notes.cancel_reason || hist.notes.reject_reason || hist.notes.reason) ? (
                                  <div className="sfx-reservations__timeline-reason">
                                    Reason: {hist.notes.cancel_reason || hist.notes.reject_reason || hist.notes.reason}
                                  </div>
                                ) : null
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="sfx-reservations__empty-text">No timeline events yet.</p>
                  )}
                </div>
              )}
            </div>
          )
        ) : null}
      </ManagerDrawer>

      {/* 2-Step Confirmation Modal */}
      <ManagerDrawer
        open={!!pendingAction}
        onClose={() => setPendingAction(null)}
        title={
          pendingAction?.reservation?.has_pending_request
            ? (pendingAction?.type === 'confirm' ? "Confirm Change Request?" : "Reject Change Request?")
            : (pendingAction?.type === 'confirm' ? "Confirm Reservation" : "Reject Reservation")
        }
      >
        <div className="sfx-form sfx-form--vert">
          <p className="sfx-text-muted sfx-reservations__desc-text" style={{ fontSize: "14px", lineHeight: "1.5" }}>
            {pendingAction?.reservation?.has_pending_request ? (
              <>Are you sure you want to <strong>{pendingAction?.type === 'confirm' ? 'confirm and apply' : 'reject'}</strong> the requested changes for reservation <strong>#{String(pendingAction?.reservation?.reservation_id || pendingAction?.reservation?.id).padStart(6, "0")}</strong>? This action cannot be undone.</>
            ) : (
              <>Are you sure you want to {pendingAction?.type} reservation #{String(pendingAction?.reservation?.reservation_id || pendingAction?.reservation?.id).padStart(6, "0")}? This will notify the customer.</>
            )}
          </p>

          <div className="sfx-detail" style={{ background: "#fafafa", borderRadius: "12px", padding: "16px" }}>
            <span className="sfx-detail__label">Customer Name</span>
            <span className="sfx-detail__value">{pendingAction?.reservation?.customer_name || "---"}</span>

            <span className="sfx-detail__label">Date &amp; Time</span>
            <span className="sfx-detail__value">{formatReservationDateTime(pendingAction?.reservation)}</span>

            <span className="sfx-detail__label">Guests</span>
            <span className="sfx-detail__value">{pendingAction?.reservation?.guest_count} people</span>
          </div>

          <div className="sfx-actions sfx-reservations__actions-row" style={{ marginTop: "20px" }}>
            <Button variant="ghost" onClick={() => setPendingAction(null)}>
              Cancel
            </Button>
            <Button
              variant={pendingAction?.type === 'confirm' ? "gold" : "danger"}
              onClick={() => {
                if (pendingAction?.type === 'confirm') {
                  handleConfirm(pendingAction.reservation);
                } else {
                  handleReject(pendingAction.reservation, true);
                }
                setPendingAction(null);
                setActive(null);
              }}
            >
              {pendingAction?.reservation?.has_pending_request
                ? (pendingAction?.type === 'confirm' ? 'Yes, Confirm Changes' : 'Yes, Reject Request')
                : (pendingAction?.type === 'confirm' ? 'Yes, Confirm Booking' : 'Yes, Reject Booking')}
            </Button>
          </div>
        </div>
      </ManagerDrawer>

      {/* Manager Edit — Double-Confirm Overlay */}
      {editConfirmPending && (
        <div
          className="sfx-reservations__confirm-overlay"
          onClick={() => setEditConfirmPending(false)}
        >
          <div
            className="sfx-reservations__confirm-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="sfx-reservations__confirm-title">
              Verify Changes
            </h3>
            <p className="sfx-reservations__confirm-desc">
              Please confirm the following changes to Booking{" "}
              <strong>#{String(active?.reservation_id || "").padStart(6, "0")}</strong>:
            </p>
            <div className="sfx-reservations__changes-box">
              {editForm.customer_name !== active?.customer_name && (
                <div className="sfx-reservations__change-row">
                  <span>Name: </span>
                  <span className="sfx-reservations__change-old">{active?.customer_name}</span>
                  <strong>{editForm.customer_name}</strong>
                </div>
              )}
              {editForm.notes !== (active?.special_request || active?.notes || "") && (
                <div className="sfx-reservations__change-row">
                  <span>Notes: </span>
                  <strong>{editForm.notes || "(cleared)"}</strong>
                </div>
              )}
              {editForm.guest_count != active?.guest_count && (
                <div className="sfx-action-modal__change">
                  <span>Guests: </span>
                  <strong>{editForm.guest_count}</strong>
                </div>
              )}
              {editForm.status && editForm.status !== (active?.status || "").toLowerCase() && (
                <div className="sfx-reservations__change-row">
                  <span>Status: </span>
                  <strong>{editForm.status}</strong>
                </div>
              )}
              {!editForm.customer_name && !editForm.notes && !editForm.guest_count && !editForm.status && (
                <span className="sfx-reservations__change-row">All current values will be saved.</span>
              )}
            </div>
            <div className="sfx-reservations__btn-row">
              <Button variant="ghost" onClick={() => setEditConfirmPending(false)}>Go Back</Button>
              <Button
                variant="gold"
                onClick={async () => {
                  setEditConfirmPending(false);
                  await handleSaveEdit();
                }}
              >
                Verify &amp; Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Flow C: Resolve Request double-confirmation modal ── */}
      {resolveConfirmPending && (
        <div
          className="sfx-reservations__confirm-overlay sfx-reservations__confirm-overlay--blur"
          onClick={() => setResolveConfirmPending(null)}
        >
          <div
            className="sfx-reservations__confirm-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="sfx-reservations__confirm-title">
              {resolveConfirmPending.type === "cancel"
                ? (resolveConfirmPending.decision === "process" ? "Process Refund & Cancel" : "Reject Cancellation")
                : (resolveConfirmPending.decision === "confirm" ? "✓ Confirm Edit Request" : "✕ Reject Edit Request")}
            </h3>
            <p className="sfx-reservations__confirm-desc">
              {resolveConfirmPending.type === "cancel" && resolveConfirmPending.decision === "process"
                ? `This will cancel reservation #${String(active?.reservation_id || "").padStart(6, "0")}, release the table, and send a refund confirmation email. This cannot be undone.`
                : resolveConfirmPending.type === "cancel" && resolveConfirmPending.decision === "reject"
                  ? `Reject the cancellation request. Reservation #${String(active?.reservation_id || "").padStart(6, "0")} stays Await Check-in.`
                  : resolveConfirmPending.decision === "confirm"
                    ? `Apply all requested changes to reservation #${String(active?.reservation_id || "").padStart(6, "0")}. A confirmation email with the comparison table will be sent to the customer.`
                    : `Decline the edit request for reservation #${String(active?.reservation_id || "").padStart(6, "0")}. The original reservation remains unchanged and the customer will be notified.`}
            </p>
            {/* Reject reason input for edit decline */}
            {resolveConfirmPending.type !== "cancel" && resolveConfirmPending.decision === "decline" && (
              <div className="sfx-reservations__form-group">
                <label className="sfx-reservations__form-label">
                  Reason (required)
                </label>
                <textarea
                  rows={2}
                  value={editRejectReason}
                  onChange={e => setEditRejectReason(e.target.value)}
                  placeholder="e.g. Requested date is fully booked, table not available…"
                  className="sfx-reservations__form-textarea"
                />
              </div>
            )}
            <div className="sfx-reservations__btn-row">
              <Button variant="ghost" onClick={() => setResolveConfirmPending(null)} disabled={resolving}>
                Go Back
              </Button>
              <Button
                variant={resolveConfirmPending.decision === "process" || resolveConfirmPending.decision === "decline" ? "danger" : "gold"}
                disabled={resolving}
                onClick={() => {
                  if (resolveConfirmPending.decision === "decline" && (!editRejectReason || editRejectReason.trim() === "")) {
                    toast("A reason is required to reject an edit request.", "error");
                    return;
                  }
                  handleResolveRequest(resolveConfirmPending.decision, editRejectReason);
                  setEditRejectReason("");
                }}
              >
                {resolving ? "Processing…" : (resolveConfirmPending.decision === "confirm" ? "Confirm Changes" : resolveConfirmPending.decision === "decline" ? "Reject Request" : "Confirm")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Flow D: Unified Manager Cancel / Reject Modal ──────────────── */}
      {cancelModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(15, 23, 42, 0.45)", backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
          animation: "appleFadeIn 0.2s ease forwards",
        }}>
          <div style={{
            background: "#ffffff", border: "1px solid #cbd5e1",
            borderRadius: "16px", padding: "24px 28px", maxWidth: "480px", width: "100%",
            boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
            fontFamily: "'Inter', sans-serif", color: "#0f172a",
            animation: "appleScaleEntrance 0.2s cubic-bezier(0.25, 0.1, 0.25, 1) forwards",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>
                  {cancelModal.actionType === "reject" ? "Reject Reservation" : "Cancel Reservation"}
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
                  Reservation <strong>#{cancelModal.reservation.reservation_id}</strong> · {cancelModal.reservation.customer_name || "Guest"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setCancelModal(null); setCancelReason(""); }}
                style={{ background: "none", border: "none", fontSize: "18px", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 14px", lineHeight: 1.5 }}>
              This action will release any assigned table, record an Audit Log entry, and notify the customer by email.
            </p>

            {/* Quick Reason Preset Chips */}
            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#94a3b8", letterSpacing: "0.05em", display: "block", marginBottom: "6px" }}>
                Quick Reasons:
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {[
                  "Customer requested cancellation",
                  "Out of capacity / No table available",
                  "No-show / Exceeded hold duration",
                  "Duplicate booking",
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setCancelReason(chip)}
                    style={{
                      padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: 600,
                      background: cancelReason === chip ? "#fef3c7" : "#f1f5f9",
                      border: `1px solid ${cancelReason === chip ? "#fde68a" : "#cbd5e1"}`,
                      color: cancelReason === chip ? "#92400e" : "#475569",
                      cursor: "pointer", transition: "all 0.15s ease",
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <label style={{ fontSize: "12px", fontWeight: 600, color: "#334155", display: "block", marginBottom: "6px" }}>
              Cancellation / Rejection Reason Note:
            </label>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Select a quick reason above or type a custom reason..."
              style={{
                width: "100%", padding: "10px 12px", borderRadius: "10px",
                border: "1px solid #cbd5e1", background: "#f8fafc",
                fontSize: "13px", color: "#0f172a", outline: "none",
                boxSizing: "border-box", resize: "none", marginBottom: "18px",
              }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="apple-btn-interactive"
                onClick={() => { setCancelModal(null); setCancelReason(""); }}
                disabled={cancelling}
                style={{
                  padding: "8px 16px", borderRadius: "8px", background: "#f1f5f9",
                  border: "1px solid #cbd5e1", color: "#475569", fontSize: "13px", fontWeight: 600, cursor: "pointer",
                }}
              >
                Go Back
              </button>
              <button
                type="button"
                className="apple-btn-interactive"
                onClick={handleCancelByManager}
                disabled={cancelling}
                style={{
                  padding: "8px 18px", borderRadius: "8px", background: "#ef4444",
                  border: "1px solid #dc2626", color: "#ffffff", fontSize: "13px", fontWeight: 700, cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(239, 68, 68, 0.25)",
                }}
              >
                {cancelling ? "Processing…" : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default ReservationsSection;
