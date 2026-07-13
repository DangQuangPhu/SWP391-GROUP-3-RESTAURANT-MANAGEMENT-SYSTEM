import { useStaffPortal } from "../context/StaffPortalContext.jsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ReservationTableSkeleton,
  SkeletonPresence,
  listContainerVariants,
  listItemVariants,
  fadeScaleVariants,
} from "./StaffSkeleton.jsx";
import { useLocation } from "react-router-dom";
import { format, isSameDay } from "date-fns";
import DashboardDateRangePicker from "@/features/manager-dashboard/components/shared/DashboardDateRangePicker.jsx";
import { Pagination } from "@/components/ui/Pagination.jsx";

import Icon from "./StaffIcons.jsx";
import { EmptyState, Button, SearchField } from "./StaffUI.jsx";
import { StaffDrawer } from "./StaffOverlay.jsx";
import { AlertTriangle, MapPin, CheckCircle, Clock, Save, FileText, Download, X } from "lucide-react";
import ReservationStatusBadge from "@/components/shared/ReservationStatusBadge.jsx";
import EmptyVal from "@/components/shared/EmptyVal.jsx";
import StaffReservationDetail from "./StaffReservationDetail.jsx";
import {
  fetchTodayReservations,
  checkInStaffReservation,
  rejectStaffReservation,
  confirmCheckoutReservation,
  sendReservationToKitchenQueue,
  fetchReservationTimeline,
  fetchStaffTables,
} from "../services/staffApi.js";
import {
  getReservationDateIso,
  getReservationStatusKey,
  formatReservationTimeDisplay,
} from "../utils/reservationQueueHelpers.js";
import { useSocket } from "@/core/socket/SocketContext.jsx";
import { FILTER_GROUPS, RESERVATION_STATUS, RESERVATION_STATUS_META, ALL_RESERVATION_STATUSES } from "@/shared/reservationStatus.js";

import LateArrivalBadge from "./LateArrivalBadge.jsx";
import StaffEditReservationModal from "./StaffEditReservationModal.jsx";
import AddWalkInModal from "./AddWalkInModal.jsx";
import "@/styles/staff-dashboard/ReservationManagement.css";



const getSelectStyle = (status) => {
  if (status === "all") {
    return {
      background: "#ffffff",
      color: "#1a1a1a",
      borderColor: "#e5e7eb"
    };
  }
  const meta = RESERVATION_STATUS_META[status] || {};
  const tone = meta.tone || "muted";

  if (tone === "amber") {
    return {
      background: "#fef3c7",
      color: "#b45309",
      borderColor: "#fde68a"
    };
  }
  if (tone === "blue") {
    return {
      background: "#dbeafe",
      color: "#1d4ed8",
      borderColor: "#bfdbfe"
    };
  }
  if (tone === "purple") {
    return {
      background: "#f3e8ff",
      color: "#6b21a8",
      borderColor: "#e9d5ff"
    };
  }
  if (tone === "green" || status === "Completed") {
    return {
      background: "#d1fae5",
      color: "#065f46",
      borderColor: "#a7f3d0"
    };
  }
  if (tone === "red") {
    return {
      background: "#fee2e2",
      color: "#991b1b",
      borderColor: "#fecaca"
    };
  }
  return {
    background: "#f3f4f6",
    color: "#374151",
    borderColor: "#e5e7eb"
  };
};

/* ── Date filter ── */
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

/* ── Table styles — white background, black text ── */
const TABLE_CELL_STYLE = { color: "#000000" };
const ID_DATE_CELL_STYLE = {
  color: "#000000",
  fontSize: "13px",
};

/* ── Confirm dialog configs ── */
const CONFIRM_ACTIONS = {
  checkin: {
    title: "Confirm Check-in",
    desc: (r) =>
      `Confirm check-in for ${r.customer_name} (Booking #${String(r.reservation_id).padStart(6, "0")})?`,
    btnLabel: "Confirm Check-in",
    btnVariant: "gold",
  },
  noshow: {
    title: "Mark as No Show",
    desc: (r) => `Mark ${r.customer_name}'s reservation as No Show? The table will be released.`,
    btnLabel: "Mark No Show",
    btnVariant: "danger",
  },
  reject: {
    title: "Reject Check-in",
    desc: (r) => `Reject check-in for ${r.customer_name}? Please provide a reason.`,
    btnLabel: "Reject",
    btnVariant: "danger",
    needsReason: true,
  },
  reject_checkin: {
    title: "Reject Check-in",
    desc: (r) => `Reject check-in for ${r.customer_name} (Booking #${String(r.reservation_id).padStart(6, "0")})? Please state the reason.`,
    btnLabel: "Reject & Release",
    btnVariant: "danger",
    needsReason: true,
  },
  checkout: {
    title: "Confirm Check-out",
    desc: (r) => `Confirm check-out for ${r.customer_name} (Booking #${String(r.reservation_id).padStart(6, "0")})?`,
    btnLabel: "Confirm Check-out",
    btnVariant: "gold",
  },
  reject_checkout: {
    title: "Reject Check-out",
    desc: (r) => `Reject check-out for ${r.customer_name}? Please provide a reason.`,
    btnLabel: "Reject Check-out",
    btnVariant: "danger",
    needsReason: true,
  },
};

/* ── Timeline node colors ── */
const TIMELINE_ACTION_COLOR = {
  RESERVATION_CREATED: "#3a6ea5",
  STAFF_CHECKIN_CONFIRMED: "#2f7d4f",
  CHECK_IN_RESERVATION: "#2f7d4f",
  PAYMENT_CHECKOUT_AUTO: "#c2610a",
  STAFF_CHECKOUT_CONFIRMED: "#7c5cbf",
  MANAGER_APPROVED_EDIT: "#3a6ea5",
  MANAGER_RESOLVE_REQUEST: "#3a6ea5",
  default: "#8a8175",
};

function TimelineSection({ reservationId, userId }) {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!reservationId) return;
    setLoading(true);
    fetchReservationTimeline(reservationId, userId)
      .then((items) => setTimeline(items))
      .finally(() => setLoading(false));
  }, [reservationId, userId]);

  if (loading) return <p style={{ color: "#8a8175", fontSize: 13 }}>Loading activity history…</p>;
  if (!timeline.length) return <p style={{ color: "#8a8175", fontSize: 13, fontStyle: "italic" }}>No activity history yet.</p>;

  return (
    <div style={{ marginTop: 8 }}>
      {timeline.map((node, i) => {
        const color = TIMELINE_ACTION_COLOR[node.action_name] || TIMELINE_ACTION_COLOR.default;
        return (
          <div key={node.log_id ?? i} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
              <div style={{
                width: 10, height: 10, borderRadius: "50%",
                background: color, marginTop: 3, flexShrink: 0,
              }} />
              {i < timeline.length - 1 && (
                <div style={{ width: 2, flex: 1, background: "rgba(0,0,0,0.08)", minHeight: 20 }} />
              )}
            </div>
            <div style={{ flex: 1, paddingBottom: 2 }}>
              <p style={{ margin: 0, fontSize: 13, color: "#1a1a1a", fontWeight: 500, lineHeight: 1.4 }}>
                {node.display_text}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AnimatedStatusDropdown({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const style = getSelectStyle(value);
  const selectedLabel = value === "all" ? "All statuses" : (RESERVATION_STATUS_META[value]?.label || value);

  return (
    <div ref={dropdownRef} style={{ position: "relative", minWidth: 160 }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "8px 12px",
          borderRadius: "8px",
          border: `1px solid ${style.borderColor || "#e5e7eb"}`,
          background: style.background || "#fff",
          color: style.color || "#1a1a1a",
          fontSize: "14px",
          fontWeight: "600",
          cursor: "pointer",
          transition: "all 0.2s ease"
        }}
      >
        <span>{selectedLabel}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              width: "200px",
              marginTop: 4,
              background: "#333", // Dark background as requested in screenshot
              color: "#fff",
              borderRadius: 8,
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              zIndex: 100,
              overflow: "hidden",
              border: "1px solid #444",
              display: "flex",
              flexDirection: "column",
              padding: "4px 0"
            }}
          >
            <button
              type="button"
              onClick={() => { onChange("all"); setIsOpen(false); }}
              style={{
                padding: "8px 16px",
                textAlign: "left",
                background: value === "all" ? "rgba(255,255,255,0.1)" : "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                gap: 8
              }}
            >
              <div style={{ width: 14, display: "flex", justifyContent: "center" }}>
                {value === "all" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
              </div>
              All statuses
            </button>
            <div style={{ height: 1, background: "#444", margin: "4px 0" }} />
            {ALL_RESERVATION_STATUSES.map(st => (
              <button
                key={st}
                type="button"
                onClick={() => { onChange(st); setIsOpen(false); }}
                style={{
                  padding: "8px 16px",
                  textAlign: "left",
                  background: value === st ? "rgba(255,255,255,0.1)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 14,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "background 0.1s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                onMouseLeave={(e) => e.currentTarget.style.background = value === st ? "rgba(255,255,255,0.1)" : "transparent"}
              >
                <div style={{ width: 14, display: "flex", justifyContent: "center" }}>
                  {value === st && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                </div>
                {RESERVATION_STATUS_META[st]?.label || st}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReservationManagement({ user, toast, refreshKey }) {
  const { socket } = useSocket();
  const userId = user?.userId ?? user?.user_id ?? user?.id;
  const isManager = Number(user?.roleId ?? user?.role_id) === 4 || Number(user?.roleId ?? user?.role_id) === 5;
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [editReservation, setEditReservation] = useState(null);
  const [checkedInIds, setCheckedInIds] = useState(new Set());
  const [rejectedIds, setRejectedIds] = useState(new Set());
  const [confirmedAtMap, setConfirmedAtMap] = useState(new Map());
  const [checkoutReadyIds, setCheckoutReadyIds] = useState(new Set());
  const [checkoutDoneIds, setCheckoutDoneIds] = useState(new Set());

  const [walkInOpen, setWalkInOpen] = useState(false);
  // Table-selection modal state (replaces standalone "Assign Table" flow)
  const [tableSelectDialog, setTableSelectDialog] = useState(null); // holds reservation obj
  const [tableSelectTables, setTableSelectTables] = useState([]);
  const [tableSelectLoading, setTableSelectLoading] = useState(false);
  const [tableSelectAreaFilter, setTableSelectAreaFilter] = useState("All");
  const [tableSelectSubmitting, setTableSelectSubmitting] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [draftRange, setDraftRange] = useState(() => {
    return { startDate: null, endDate: null, key: "selection" };
  });
  const [appliedRange, setAppliedRange] = useState(() => {
    return { startDate: null, endDate: null };
  });
  const [activePresetId, setActivePresetId] = useState("all_dates");

  const closePicker = useCallback(() => setPickerOpen(false), []);
  const openPicker = useCallback(() => {
    setDraftRange({ startDate: appliedRange.startDate, endDate: appliedRange.endDate, key: "selection" });
    setPickerOpen(true);
  }, [appliedRange]);

  const handleApplyDate = useCallback((sel) => {
    setAppliedRange({ startDate: sel.startDate, endDate: sel.endDate });
    setSelectedDate(sel.startDate); // keep backward compat for matchesSelectedDate
    closePicker();
  }, [closePicker]);

  const handlePresetSelect = useCallback((preset) => {
    const range = preset.range || { startDate: preset.startDate, endDate: preset.endDate, key: "selection" };
    setActivePresetId(preset.id);
    setDraftRange(range);
    setAppliedRange({ startDate: range.startDate, endDate: range.endDate });
    setSelectedDate(range.startDate);
    closePicker();
  }, [closePicker]);

  const selectedDateLabel = useMemo(() => {
    if (!appliedRange.startDate) return "All Dates";
    const { startDate, endDate } = appliedRange;
    if (isSameDay(startDate, endDate)) return format(startDate, "dd/MM/yyyy");
    return `${format(startDate, "dd/MM")} – ${format(endDate, "dd/MM/yyyy")}`;
  }, [appliedRange]);

  // dateScopedQueue is now just the raw queue from API (date filter done server-side)
  const dateScopedQueue = useMemo(() => Array.isArray(queue) ? queue : [], [queue]);

  const loadReservations = useCallback(async () => {
    setLoading(true);
    try {
      const sd = appliedRange?.startDate;
      const ed = appliedRange?.endDate;
      const startStr = sd && sd !== "all" && sd !== "All Dates" && String(sd).trim() !== "" ? format(new Date(sd), "yyyy-MM-dd") : null;
      const endStr = ed && ed !== "all" && ed !== "All Dates" && String(ed).trim() !== "" ? format(new Date(ed), "yyyy-MM-dd") : null;

      const params = {
        page: currentPage,
        limit: 20,
        search,
        status: statusFilter,
      };
      if (startStr && endStr) {
        params.startDate = startStr;
        params.endDate = endStr;
      } else if (startStr) {
        params.startDate = startStr;
      }

      const res = await fetchTodayReservations(userId, params);
      setQueue(res.data || []);
      setTotalCount(res.totalCount || 0);
      setTotalPages(res.totalPages || 1);
    } catch {
      toast("Failed to load reservations.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast, user, appliedRange, currentPage, search, statusFilter]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [appliedRange, search, statusFilter]);

  useEffect(() => { loadReservations(); }, [loadReservations]);
  useEffect(() => { if (refreshKey > 0) loadReservations(); }, [refreshKey, loadReservations]);

  /* ── Socket listeners ── */
  useEffect(() => {
    const handleSameTabSync = () => loadReservations();
    window.addEventListener("phurai_reservations_updated", handleSameTabSync);

    if (socket) {
      const handleStatusChanged = (data) => {
        const newStatus = data?.new_status || data?.status;
        setQueue((prev) => {
          const updated = [...prev];
          const idx = updated.findIndex((r) => r.reservation_id === data.reservation_id);
          if (idx !== -1) {
            updated[idx] = { ...updated[idx], status: newStatus, reservation_status: newStatus };
          }
          return updated;
        });
        if (newStatus) {
          toast(`Booking #${String(data.reservation_id || "").padStart(6, "0")} → ${newStatus}`, "info");
        }
      };

      const handlePaymentSuccess = (data) => {
        if (data.flashCompletePaid) {
          setQueue((prev) => {
            const updated = [...prev];
            const idx = updated.findIndex((r) => r.reservation_id === data.reservation_id);
            if (idx !== -1) {
              const originalStatus = updated[idx].reservation_status || updated[idx].status || RESERVATION_STATUS.AWAIT_CHECK_IN;

              // Mutate to Complete Paid temporarily
              updated[idx] = {
                ...updated[idx],
                status: RESERVATION_STATUS.COMPLETE_PAID,
                reservation_status: RESERVATION_STATUS.COMPLETE_PAID,
                _isFlashing: true
              };

              // Set timeout to revert exactly after 10000ms
              setTimeout(() => {
                setQueue((currentQueue) => {
                  const currIdx = currentQueue.findIndex((r) => r.reservation_id === data.reservation_id);
                  if (currIdx !== -1 && currentQueue[currIdx]._isFlashing) {
                    const reverted = [...currentQueue];
                    reverted[currIdx] = {
                      ...reverted[currIdx],
                      status: originalStatus,
                      reservation_status: originalStatus,
                      _isFlashing: false
                    };
                    return reverted;
                  }
                  return currentQueue;
                });
              }, 10000);
            }
            return updated;
          });
          toast(`Payment verified for booking #${String(data.reservation_id || "").padStart(6, "0")}`, "success");
        }
      };

      const handleNew = (data) => {
        // DIRECTIVE C: Optimistic injection — walk-in appears INSTANTLY in the list
        // without waiting for the server round-trip from loadReservations().
        // We inject a synthetic row into queue state immediately, then loadReservations
        // replaces it with the real server row.
        if (data?.reservation_source === 'Walk-in' && data?.reservation_id) {
          const syntheticRow = {
            reservation_id: data.reservation_id,
            customer_name: data.customer_name || 'Walk-in Guest',
            contact_phone: data.contact_phone || '',
            reservation_status: data.reservation_status || 'Dining',
            status: data.reservation_status || 'Dining',
            reservation_source: 'Walk-in',
            table_id: data.table_id,
            table_number: data.table_number,
            guest_count: data.guest_count || 1,
            reservation_start_at: new Date().toISOString(),
            _isOptimistic: true,
          };
          setQueue((prev) => {
            const alreadyExists = prev.some((r) => r.reservation_id === data.reservation_id);
            if (alreadyExists) return prev;
            return [syntheticRow, ...prev];
          });
          toast(`Walk-in #${String(data.reservation_id).padStart(6, '0')} — ${data.customer_name || 'Guest'} seated at Table ${data.table_number || ''}`, 'success');
        } else {
          toast(`New booking #${String(data.reservation_id || '').padStart(6, '0')} from ${data.customer_name || 'Guest'}`, 'info');
        }
        // Always sync from server to replace the synthetic row with real data
        loadReservations();
      };
      const handleCheckoutReady = ({ reservation_id }) => {
        setCheckoutReadyIds((prev) => new Set([...prev, reservation_id]));
        toast("Payment completed. Please confirm check-out.", "info");
      };

      const handleEditConfirmed = (data) => {
        loadReservations();
        // 10-second toast notification
        toast(
          `✓ Manager confirmed edit request for booking #${String(data.reservation_id || "").padStart(6, "0")}. Data updated.`,
          "success",
          10000
        );
      };
      const handleEditRejected = (data) => {
        loadReservations();
        toast(
          `Booking #${String(data.reservation_id || "").padStart(6, "0")} edit request was rejected — original booking stands.`,
          "info",
          10000
        );
      };

      const handleBatchSeeded = () => {
        loadReservations();
        toast("Manager added test reservations — list refreshed.", "info");
      };

      socket.on("reservation:status_changed", handleStatusChanged);
      socket.on("RESERVATION_STATUS_CHANGED", handleStatusChanged);
      socket.on("RESERVATION_PAYMENT_SUCCESS", handlePaymentSuccess);
      socket.on("reservation:new", handleNew);
      socket.on("reservation:checkout_ready", handleCheckoutReady);
      socket.on("reservation:edit_confirmed", handleEditConfirmed);
      socket.on("reservation:edit_rejected", handleEditRejected);
      socket.on("reservation:batch_seeded", handleBatchSeeded);

      return () => {
        window.removeEventListener("phurai_reservations_updated", handleSameTabSync);
        socket.off("reservation:status_changed", handleStatusChanged);
        socket.off("RESERVATION_STATUS_CHANGED", handleStatusChanged);
        socket.off("RESERVATION_PAYMENT_SUCCESS", handlePaymentSuccess);
        socket.off("reservation:new", handleNew);
        socket.off("reservation:checkout_ready", handleCheckoutReady);
        socket.off("reservation:edit_confirmed", handleEditConfirmed);
        socket.off("reservation:edit_rejected", handleEditRejected);
        socket.off("reservation:batch_seeded", handleBatchSeeded);
      };
    }

    return () => { window.removeEventListener("phurai_reservations_updated", handleSameTabSync); };
  }, [loadReservations, socket, toast]);

  /* ── Hash scroll ── */
  const location = useLocation();
  useEffect(() => {
    if (!loading && location.hash.startsWith("#res-")) {
      const id = location.hash.slice(1);
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.style.transition = "background-color 0.5s ease";
          el.style.backgroundColor = "rgba(16, 185, 129, 0.2)";
          setTimeout(() => { el.style.backgroundColor = ""; }, 2000);
        }
      }, 300);
    }
  }, [loading, location.hash, dateScopedQueue]);

  /* ── Filtered rows ── */
  const filtered = useMemo(() => {
    const sorted = [...dateScopedQueue];
    sorted.sort((a, b) => {
      const keyA = getReservationStatusKey(a);
      const keyB = getReservationStatusKey(b);

      const isPendingA = (keyA === "pending_request" || keyA === "request" || keyA === "pending");
      const isPendingB = (keyB === "pending_request" || keyB === "request" || keyB === "pending");

      const isCheckInA = (keyA === "check-in" || keyA === "checked-in" || keyA === "checked_in");
      const isCheckInB = (keyB === "check-in" || keyB === "checked-in" || keyB === "checked_in");

      const rankA = isPendingA ? 1 : (isCheckInA ? 2 : 3);
      const rankB = isPendingB ? 1 : (isCheckInB ? 2 : 3);

      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return new Date(a?.reservation_start_at || 0).getTime() - new Date(b?.reservation_start_at || 0).getTime();
    });
    return sorted;
  }, [dateScopedQueue]);

  const kpiConfirmed = useMemo(
    () => dateScopedQueue.filter((r) => r.reservation_status === "Confirmed").length,
    [dateScopedQueue]
  );
  const kpiDining = useMemo(
    () => dateScopedQueue.filter((r) => r.reservation_status === "Dining").length,
    [dateScopedQueue]
  );
  const kpiCompleted = useMemo(
    () => dateScopedQueue.filter((r) => r.reservation_status === "Completed").length,
    [dateScopedQueue]
  );

  /* ── Action handlers ── */
  const handleCheckIn = useCallback(async () => {
    if (!confirmDialog?.target) return;
    const target = confirmDialog.target;
    try {
      const result = await checkInStaffReservation(target.reservation_id, userId, { table_id: target.table_id });
      toast("Check-in successful!", "success");
      setCheckedInIds((prev) => new Set([...prev, target.reservation_id]));
      if (result?.checked_in_at) {
        setConfirmedAtMap((prev) => new Map(prev).set(target.reservation_id, result.checked_in_at));
      }
      loadReservations();
      setConfirmDialog(null);
    } catch (err) {
      toast(err.message || "Check-in failed.", "error");
    }
  }, [confirmDialog, toast, loadReservations, user]);

  const handleRejectWalkin = useCallback(async () => {
    if (!confirmDialog?.target) return;
    const target = confirmDialog.target;
    try {
      await rejectStaffReservation(target.reservation_id, userId, { reason: "Customer No-Show", new_status: "No Show" });
      toast("Marked as No Show. Table released.", "info");
      setRejectedIds((prev) => new Set([...prev, target.reservation_id]));
      loadReservations();
      setConfirmDialog(null);
    } catch (err) {
      toast(err.message || "Operation failed.", "error");
    }
  }, [confirmDialog, toast, loadReservations, user]);

  const handleRejectCheckin = useCallback(async () => {
    if (!confirmDialog?.target) return;
    const target = confirmDialog.target;
    const reason = confirmDialog.reason?.trim();
    if (!reason) {
      toast("A reason is required to reject check-in.", "error");
      return;
    }
    try {
      await rejectStaffReservation(target.reservation_id, userId, { reason, new_status: "Check-in Rejected" });
      toast("Check-in rejected. Table released.", "info");
      setRejectedIds((prev) => new Set([...prev, target.reservation_id]));
      loadReservations();
      setConfirmDialog(null);
    } catch (err) {
      toast(err.message || "Operation failed.", "error");
    }
  }, [confirmDialog, toast, loadReservations, user]);

  const handleRejectCheckout = useCallback(async () => {
    if (!confirmDialog?.target) return;
    const target = confirmDialog.target;
    const reason = confirmDialog.reason?.trim();
    if (!reason) {
      toast("A reason is required to reject check-out.", "error");
      return;
    }
    try {
      await rejectStaffReservation(target.reservation_id, userId, { reason, new_status: "Reject Check-out" });
      toast("Check-out rejected.", "info");
      loadReservations();
      setConfirmDialog(null);
    } catch (err) {
      toast(err.message || "Rejection failed.", "error");
    }
  }, [confirmDialog, toast, loadReservations, user]);

  const handleRejectMismatch = useCallback(async () => {
    if (!confirmDialog?.target) return;
    const target = confirmDialog.target;
    const reason = confirmDialog.reason?.trim();
    if (!reason) {
      toast("A reason is required to reject check-in.", "error");
      return;
    }
    try {
      await rejectStaffReservation(target.reservation_id, userId, { reason, new_status: "Check-in Rejected" });
      toast("Check-in rejected. Table released.", "info");
      setRejectedIds((prev) => new Set([...prev, target.reservation_id]));
      loadReservations();
      setConfirmDialog(null);
    } catch (err) {
      toast(err.message || "Rejection failed.", "error");
    }
  }, [confirmDialog, toast, loadReservations, user]);

  const handleConfirmCheckout = useCallback(async () => {
    if (!confirmDialog?.target) return;
    const target = confirmDialog.target;
    try {
      await confirmCheckoutReservation(target.reservation_id, userId);
      toast("Check-out confirmed!", "success");
      setCheckoutDoneIds((prev) => new Set([...prev, target.reservation_id]));
      setCheckoutReadyIds((prev) => {
        const next = new Set(prev);
        next.delete(target.reservation_id);
        return next;
      });
      loadReservations();
      setConfirmDialog(null);
    } catch (err) {
      toast(err.message || "Check-out confirmation failed.", "error");
    }
  }, [confirmDialog, toast, loadReservations, user]);

  // Open table selection modal and fetch tables
  const openTableSelect = useCallback(async (reservation) => {
    setTableSelectDialog(reservation);
    setTableSelectAreaFilter("All");
    setTableSelectLoading(true);
    try {
      const res = await fetchStaffTables(userId);
      const all = Array.isArray(res?.data) ? res.data : [];
      setTableSelectTables(all.filter((t) => !t.is_counter));
    } catch (err) {
      toast("Failed to load tables: " + err.message, "error");
      setTableSelectTables([]);
    } finally {
      setTableSelectLoading(false);
    }
  }, [userId, toast]);

  // Check-in with chosen table → atomic: Reservation→Dining, Table→Occupied
  const handleCheckInWithTable = useCallback(async (tableId) => {
    if (!tableSelectDialog) return;
    setTableSelectSubmitting(true);
    try {
      await checkInStaffReservation(tableSelectDialog.reservation_id, userId, { table_id: tableId });
      toast("Check-in successful! Table is now Occupied.", "success");
      setCheckedInIds((prev) => new Set([...prev, tableSelectDialog.reservation_id]));
      setTableSelectDialog(null);
      setConfirmDialog(null);
      loadReservations();
    } catch (err) {
      if (err?.status === 409) {
        // RACE CONDITION: Another staff member just seated a guest at this table.
        // Show a clear message and auto-refresh the table grid so the floor plan is current.
        toast(
          "⚡ This table was just taken by another staff member. Please select a different table.",
          "error"
        );
        // Refresh the table list so the now-Occupied table shows as unavailable
        try {
          const res = await fetchStaffTables(userId);
          const all = Array.isArray(res?.data) ? res.data : [];
          setTableSelectTables(all.filter((t) => !t.is_counter));
        } catch (_) {
          // Non-fatal — modal is still open with stale data, staff can close and reopen
        }
      } else {
        toast(err.message || "Check-in failed. Please try again.", "error");
      }
    } finally {
      setTableSelectSubmitting(false);
    }
  }, [tableSelectDialog, userId, toast, loadReservations]);


  const handleSendToKitchen = useCallback(async (reservationId) => {
    try {
      const res = await sendReservationToKitchenQueue(reservationId, userId);
      toast(res.message || "Items sent to kitchen!", "success");
      // Reload so preorder cooking_status updates from "Not Sent" → "Queued" and button disappears
      loadReservations();
    } catch (err) {
      toast(err.message || "Failed to send to kitchen.", "error");
    }
  }, [toast, userId, loadReservations]);


  /* ── Per-row action buttons ── */
  function RowActions({ reservation }) {
    const resId = reservation.reservation_id;
    const statusKey = getReservationStatusKey(reservation);
    const isOccupied = statusKey === "occupied" || statusKey === "seated" || checkedInIds.has(resId);
    const isCheckedOut = statusKey === "check-out" || checkoutDoneIds.has(resId);
    const isCheckoutReady = checkoutReadyIds.has(resId);

    const viewBtn = (
      <Button
        size="sm"
        variant="ghost"
        icon="eye"
        onClick={() => setConfirmDialog({ action: "view", target: reservation })}
      >
        View
      </Button>
    );

    const editBtn = (
      <Button
        size="sm"
        variant="gold"
        onClick={() => setEditReservation(reservation)}
      >
        Edit
      </Button>
    );

    if (isCheckedOut) {
      return (
        <div className="sfx-rowacts" style={{ justifyContent: "center", gap: 8, display: "flex", alignItems: "center" }}>
          {viewBtn}
          {editBtn}
        </div>
      );
    }

    if (statusKey === "check-in") {
      return (
        <div className="sfx-rowacts" style={{ justifyContent: "center", gap: 8, display: "flex", alignItems: "center" }}>
          <Button
            size="sm"
            variant="soft"
            style={{
              color: "#fff",
              backgroundColor: "#10b981",
              fontWeight: 600,
              border: "none"
            }}
            onClick={() => openTableSelect(reservation)}
          >
            Check-in
          </Button>
          {viewBtn}
          {editBtn}
        </div>
      );
    }

    if (isOccupied) {
      return (
        <div className="sfx-rowacts" style={{ justifyContent: "center", gap: 8, display: "flex", alignItems: "center" }}>
          <button
            type="button"
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "5px 12px", borderRadius: 20, border: "none",
              cursor: "pointer", fontSize: 12, fontWeight: 700,
              color: "#fff", background: "linear-gradient(135deg, #f59e0b, #d97706)",
              boxShadow: "0 2px 8px rgba(245,158,11,0.30)",
              animation: "sfxFadeRise 0.5s ease both",
            }}
            onClick={() => handleSendToKitchen(resId)}
          >
            <Icon name="fire" size={14} /> Send to Kitchen
          </button>

          {isCheckoutReady && isSameDay(new Date(reservation.reservation_start_at), new Date()) && (
            <button
              type="button"
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "5px 12px", borderRadius: 20, border: "none",
                cursor: "pointer", fontSize: 12, fontWeight: 700,
                color: "#fff", background: "linear-gradient(135deg, #2f7d4f, #3aa868)",
                boxShadow: "0 2px 8px rgba(47,125,79,0.30)",
                animation: "sfxFadeRise 0.5s ease both",
              }}
              onClick={() => setConfirmDialog({ action: "checkout", target: reservation })}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Check-out
            </button>
          )}
          {viewBtn}
          {editBtn}
        </div>
      );
    }

    if (statusKey === "await check-in" || statusKey === "confirmed") {
      const isToday = isSameDay(new Date(reservation.reservation_start_at), new Date());

      return (
        <div className="sfx-rowacts" style={{ justifyContent: "center", gap: 8, display: "flex", alignItems: "center" }}>
          {isToday && (
            <Button
              size="sm"
              variant="soft"
              style={{
                color: "#fff",
                backgroundColor: "#10b981",
                fontWeight: 600,
                border: "none"
              }}
              onClick={() => openTableSelect(reservation)}
            >
              Check-in
            </Button>
          )}
          {viewBtn}
          {editBtn}
        </div>
      );
    }

    return <div className="sfx-rowacts" style={{ justifyContent: "center", gap: 8, display: "flex", alignItems: "center" }}>{viewBtn}{editBtn}</div>;
  }

  /* ── Detail drawer content ── */
  function DrawerContent({ target }) {
    if (!target) return null;
    const statusKey = getReservationStatusKey(target);
    const checkedInAt = confirmedAtMap.get(target.reservation_id) || target.checked_in_at;
    const checkedOutAt = target.checked_out_at;

    return (
      <div className="sfx-assign-form">
        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "8px 12px", fontSize: 14, marginBottom: 16 }}>
          <span style={{ color: "#8a8175" }}>Customer</span>
          <strong style={{ color: "#1a1a1a" }}>{target.customer_name}</strong>

          {(target.customer_phone || target.phone) && <>
            <span style={{ color: "#8a8175" }}>Phone</span>
            <span style={{ color: "#1a1a1a" }}>{target.customer_phone || target.phone}</span>
          </>}

          {(target.customer_email || target.email) && <>
            <span style={{ color: "#8a8175" }}>Email</span>
            <span style={{ color: "#1a1a1a", wordBreak: "break-all", fontSize: 13 }}>{target.customer_email || target.email}</span>
          </>}

          <span style={{ color: "#8a8175" }}>Guests</span>
          <span style={{ color: "#1a1a1a" }}><EmptyVal val={target.guest_count} /></span>

          <span style={{ color: "#8a8175" }}>Time</span>
          <span style={{ color: "#1a1a1a", fontFamily: "'Courier New', monospace", fontSize: 13 }}>
            {formatReservationTimeDisplay(target)}
          </span>

          <span style={{ color: "#8a8175" }}>Table</span>
          <span style={{ color: "#1a1a1a" }}><EmptyVal val={target.table_label || target.assigned_tables} /></span>

          <span style={{ color: "#8a8175" }}>Status</span>
          <div>
            <ReservationStatusBadge status={target.display_status || target.reservation_status} size="sm" isFlashing={target._isFlashing} />
            <LateArrivalBadge reservationStartAt={target.reservation_start_at} status={target.reservation_status} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <Button
            size="sm"
            variant="outline"
            style={{ color: "#3b82f6", borderColor: "#3b82f6", fontWeight: "bold" }}
            onClick={() => setEditReservation(target)}
          >
            Edit
          </Button>
        </div>

        <hr style={{ margin: "14px 0", border: "none", borderTop: "1px solid rgba(0,0,0,0.08)" }} />

        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "8px 12px", fontSize: 14, marginBottom: 16 }}>
          <span style={{ color: "#8a8175" }}>Checked in</span>
          <span style={{ color: checkedInAt ? "#2f7d4f" : "#c0b8af", fontWeight: 600 }}>
            {checkedInAt
              ? format(new Date(checkedInAt), "dd/MM/yyyy HH:mm")
              : <em style={{ fontWeight: 400, fontSize: 13 }}>Not yet</em>}
          </span>

          {checkedOutAt && <>
            <span style={{ color: "#8a8175" }}>Checked out</span>
            <span style={{ color: "#7c5cbf", fontWeight: 600 }}>
              {format(new Date(checkedOutAt), "dd/MM/yyyy HH:mm")}
            </span>
          </>}
        </div>

        {(() => {
          const noteText = target.special_request || target.notes || "";
          return (
            <div className="sfx-note" style={{ marginBottom: 16 }}>
              <strong>Special Request:</strong><br />
              {noteText ? (
                <span style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{noteText}</span>
              ) : (
                <span style={{ color: "rgba(150,150,150,0.55)", fontStyle: "italic", fontWeight: 400 }}>None</span>
              )}
            </div>
          );
        })()}

        {/* ── Pre-ordered Items ── */}
        {(() => {
          const preorders = Array.isArray(target.preorders) ? target.preorders : [];
          const unsentItems = preorders.filter(p => p.cooking_status === 'Not Sent');
          const hasSent = preorders.some(p => p.cooking_status !== 'Not Sent');

          const statusColor = (s) => {
            if (s === 'Queued') return { bg: 'rgba(37,99,235,0.1)', color: '#1d4ed8' };
            if (s === 'Cooking') return { bg: 'rgba(245,158,11,0.1)', color: '#b45309' };
            if (s === 'Ready') return { bg: 'rgba(16,185,129,0.1)', color: '#059669' };
            if (s === 'Not Sent') return { bg: 'rgba(100,100,100,0.1)', color: '#666' };
            return { bg: 'rgba(100,100,100,0.08)', color: '#888' };
          };

          return (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <p style={{ fontWeight: 700, fontSize: 13, color: '#1a1a1a', margin: 0 }}>
                  Pre-ordered Items
                  {preorders.length > 0 && (
                    <span style={{
                      marginLeft: 6, fontSize: 11, fontWeight: 600,
                      background: 'rgba(139,97,20,0.1)', color: '#8B6114', padding: '2px 7px', borderRadius: 10
                    }}>
                      {preorders.length} item{preorders.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </p>
                {/* Send to Kitchen button — only if there are unsent items and reservation is Occupied */}
                {unsentItems.length > 0 && (getReservationStatusKey(target) === 'occupied' || getReservationStatusKey(target) === 'seated' || getReservationStatusKey(target) === 'check-in') && (
                  <button
                    type="button"
                    onClick={() => handleSendToKitchen(target.reservation_id)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '5px 13px', borderRadius: 20, border: 'none',
                      cursor: 'pointer', fontSize: 12, fontWeight: 700,
                      color: '#fff', background: 'linear-gradient(135deg, #f97316, #ea580c)',
                      boxShadow: '0 2px 8px rgba(249,115,22,0.35)',
                    }}
                  >
                    🍳 Send {unsentItems.length} to Kitchen
                  </button>
                )}
                {hasSent && unsentItems.length === 0 && (
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    color: '#059669', background: 'rgba(16,185,129,0.1)', padding: '3px 8px', borderRadius: 10
                  }}>
                    ✓ All sent to kitchen
                  </span>
                )}
              </div>

              {preorders.length === 0 ? (
                <p style={{ color: '#c0b8af', fontSize: 13, fontStyle: 'italic', margin: 0 }}>No pre-ordered items</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {preorders.map((item, idx) => {
                    const sc = statusColor(item.cooking_status);
                    return (
                      <div key={item.preorder_item_id ?? idx} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '4px 12px', borderRadius: 9999, background: '#374151', color: '#FFFFFF'
                      }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: '#F3F4F6' }}>
                          ×{item.quantity}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>
                          {item.dish_name || `Dish #${item.dish_id}`}
                        </span>
                        {item.unit_price && (
                          <span style={{ fontSize: 12, color: '#D1D5DB', fontWeight: 500, marginLeft: 4 }}>
                            {Number(item.unit_price * item.quantity).toLocaleString('vi-VN')}₫
                          </span>
                        )}
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                          background: 'rgba(255,255,255,0.2)', color: '#FFFFFF', marginLeft: 4
                        }}>
                          {item.cooking_status}
                        </span>
                      </div>
                    );
                  })}
                  {preorders.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>
                        Total: {preorders.reduce((s, p) => s + (Number(p.unit_price) * Number(p.quantity)), 0).toLocaleString('vi-VN')}₫
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        <hr style={{ margin: "14px 0", border: "none", borderTop: "1px solid rgba(0,0,0,0.08)" }} />

        <p style={{ fontWeight: 700, fontSize: 13, color: "#1a1a1a", margin: "0 0 10px" }}>Activity Timeline</p>
        <TimelineSection reservationId={target.reservation_id} userId={userId} />

        <hr style={{ margin: "20px 0 12px", border: "none", borderTop: "1px solid rgba(0,0,0,0.08)" }} />
        <p className="sfx-muted" style={{ fontSize: 13 }}>
          Verify guest information before confirming check-in.
        </p>
      </div>
    );
  }

  return (
    <>

      <div className="staff-reservation-tab-content sfx-stack">
        {/* ── Initial skeleton vs real content ─────────────────────────── */}
        <SkeletonPresence
          loading={loading && dateScopedQueue.length === 0}
          skeleton={<ReservationTableSkeleton count={6} />}
          className="sfx-stack"
        >
          <>
            {/* ── KPI cards ── */}
            <div className="staff-reservation-kpis sfx-kpis" aria-label="Reservation summary">
              <article className="sfx-kpi sfx-kpi--blue">
                <div className="sfx-kpi__top">
                  <span className="sfx-kpi__icon" aria-hidden="true"><Icon name="calendar" size={18} /></span>
                </div>
                <p className="sfx-kpi__value">{totalCount}</p>
                <p className="sfx-kpi__label">Total Reservations</p>
              </article>

              <article className="sfx-kpi sfx-kpi--amber">
                <div className="sfx-kpi__top">
                  <span className="sfx-kpi__icon" aria-hidden="true"><Icon name="bell" size={18} /></span>
                </div>
                <p className="sfx-kpi__value">{kpiConfirmed}</p>
                <p className="sfx-kpi__label">Confirmed</p>
              </article>

              <article className="sfx-kpi sfx-kpi--green">
                <div className="sfx-kpi__top">
                  <span className="sfx-kpi__icon" aria-hidden="true"><Icon name="check" size={18} /></span>
                </div>
                <p className="sfx-kpi__value">{kpiDining}</p>
                <p className="sfx-kpi__label">Dining</p>
              </article>

              <article className="sfx-kpi" style={{ borderTop: "3px solid #7c5cbf" }}>
                <div className="sfx-kpi__top">
                  <span className="sfx-kpi__icon" aria-hidden="true"><Icon name="logout" size={18} /></span>
                </div>
                <p className="sfx-kpi__value">{kpiCompleted}</p>
                <p className="sfx-kpi__label">Completed</p>
              </article>
            </div>

            {/* ── Table card ── */}
            <div className="staff-card sfx-card staff-reservations-card sfx-card--overflow-visible">
              <header className="sfx-card__head">
                <div>
                  <h3 className="sfx-card__title" style={{ color: "#1a1a1a" }}>Reservations</h3>
                  <p className="sfx-muted staff-reservations-card__subtitle">
                    Reservations for {selectedDateLabel}
                  </p>
                </div>
                <span className="sfx-muted">{totalCount} reservations</span>
              </header>

              {/* Search + Filters + Date toolbar */}
              <div
                className="staff-reservations-toolbar staff-reservations-toolbar--stacked"
                style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 24, position: "relative", zIndex: 50, alignItems: "center" }}
              >
                <div style={{ flex: "1 1 250px", minWidth: 200 }}>
                  <label className="sfx-search staff-reservations-toolbar__search" style={{ margin: 0, width: "100%" }}>
                    <Icon name="search" size={16} />
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by name, phone or reservation ID…"
                      aria-label="Search reservations"
                    />
                  </label>
                </div>

                <div style={{ flex: "0 0 auto", zIndex: 60 }}>
                  <AnimatedStatusDropdown value={statusFilter} onChange={setStatusFilter} />
                </div>

                <div style={{ flex: 1 }}></div>

                {/* Add Walk-in button */}
                <button
                  type="button"
                  onClick={() => setWalkInOpen(true)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    padding: "9px 16px", borderRadius: 10,
                    background: "linear-gradient(135deg,#059669 0%,#047857 100%)",
                    color: "#fff", border: "none", cursor: "pointer",
                    fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
                    boxShadow: "0 2px 8px rgba(5,150,105,0.28)",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 14px rgba(5,150,105,0.4)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(5,150,105,0.28)"; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  Add Walk-in
                </button>

                <div
                  className={`staff-reservations-toolbar__date${pickerOpen ? " is-open" : ""}`}
                  style={{ marginLeft: "auto", position: "relative", display: "flex", alignItems: "center" }}
                >
                  <button
                    type="button"
                    className="staff-reservations-date-trigger"
                    onClick={() => (pickerOpen ? closePicker() : openPicker())}
                    aria-label="Select date"
                    aria-expanded={pickerOpen}
                    style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    <span className="staff-reservations-toolbar__date-label" style={{ fontSize: 13, color: "#1a1a1a", fontWeight: 500 }}>
                      {selectedDateLabel}
                    </span>
                    <span className="sfx-kpi__icon sfx-kpi__icon--trigger" style={{ position: "relative", zIndex: 20, background: "#f8f5ef", border: "1px solid #e2dcd0", borderRadius: 8, width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#b09460" }}>
                      <Icon name="calendar" size={16} style={{ pointerEvents: "none" }} />
                    </span>
                  </button>
                  {pickerOpen && (
                    <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 1000 }}>
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

              {/* Table */}
              <div className="sfx-card__body">
                {filtered.length === 0 ? (
                  <EmptyState
                    icon="calendar"
                    title="No reservations found"
                    hint="Reservations will appear here once confirmed by a manager."
                  />
                ) : (
                  <>
                    <div className="sfx-table-wrap">
                      <table
                        className="sfx-table sfx-table--hover staff-reservations-table"
                        style={{ background: "#ffffff" }}
                      >
                        <thead>
                          <tr style={{ background: "#ffffff" }}>
                            <th style={{ color: "#000", fontSize: 13, textTransform: "uppercase", textAlign: "center", verticalAlign: "middle" }}>Reservation ID</th>
                            <th style={{ color: "#000", fontSize: 13, textTransform: "uppercase", textAlign: "center", verticalAlign: "middle" }}>Date</th>
                            <th style={{ color: "#000", fontSize: 13, textTransform: "uppercase", textAlign: "center", verticalAlign: "middle" }}>Customer</th>
                            <th style={{ color: "#000", fontSize: 13, textTransform: "uppercase", textAlign: "center", verticalAlign: "middle" }}>Phone</th>
                            <th style={{ color: "#000", fontSize: 13, textTransform: "uppercase", textAlign: "center", verticalAlign: "middle" }}>Email</th>
                            <th style={{ color: "#000", fontSize: 13, textTransform: "uppercase", textAlign: "center", verticalAlign: "middle" }}>Status</th>
                            <th style={{ color: "#000", fontSize: 13, textTransform: "uppercase", textAlign: "center", verticalAlign: "middle" }}>Actions</th>
                          </tr>
                        </thead>
                        <motion.tbody
                          variants={listContainerVariants}
                          initial="hidden"
                          animate="visible"
                        >
                          {filtered.map((reservation) => {
                            const resId = reservation.reservation_id;
                            const dateIso = getReservationDateIso(reservation);
                            const displayDate = (() => {
                              try {
                                return format(new Date(`${dateIso}T12:00:00`), "dd/MM/yyyy");
                              } catch { return dateIso; }
                            })();

                            return (
                              <motion.tr
                                key={resId}
                                variants={listItemVariants}
                                id={`res-${String(resId).padStart(6, "0")}`}
                                style={{ background: "#ffffff" }}
                                className={`sfx-table__row${checkedInIds.has(resId) ? " sfx-table__row--just-actioned" : ""}${rejectedIds.has(resId) ? " sfx-table__row--just-rejected" : ""}`}
                              >
                                <td style={{ fontSize: 13, fontWeight: 600, color: "#000", textAlign: "center", verticalAlign: "middle" }}>
                                  #{String(resId).padStart(6, "0")}
                                </td>
                                <td style={{ fontSize: 13, color: "#000", textAlign: "center", verticalAlign: "middle" }}>
                                  {displayDate}
                                </td>
                                <td style={{ fontWeight: 500, color: "#000", textAlign: "center", verticalAlign: "middle" }}>
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                    <span>{reservation.customer_name}</span>
                                  </div>
                                </td>
                                <td style={{ color: "#000", fontSize: 13, textAlign: "center", verticalAlign: "middle" }}>
                                  <EmptyVal val={reservation.customer_phone || reservation.phone} />
                                </td>
                                <td style={{ color: "#000", fontSize: 12, wordBreak: "break-all", textAlign: "center", verticalAlign: "middle" }}>
                                  <EmptyVal val={reservation.customer_email || reservation.email} />
                                </td>
                                <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                                  <div style={{ display: "flex", justifyContent: "center" }}>
                                    <ReservationStatusBadge
                                      status={reservation.display_status || reservation.reservation_status}
                                      size="sm"
                                      isFlashing={reservation._isFlashing}
                                    />
                                  </div>
                                </td>
                                <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                                  <div style={{ display: "flex", justifyContent: "center" }}>
                                    <RowActions reservation={reservation} />
                                  </div>
                                </td>
                              </motion.tr>
                            );
                          })}
                        </motion.tbody>
                      </table>
                    </div>
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalCount={totalCount}
                      limit={20}
                      onPageChange={setCurrentPage}
                    />
                  </>
                )}
              </div>
            </div>

            {/* ── Detail Drawer ── */}
            <StaffDrawer
              open={Boolean(confirmDialog?.action === "view" && confirmDialog?.target)}
              title={
                confirmDialog?.target
                  ? `Reservation — #${String(confirmDialog.target.reservation_id).padStart(6, "0")}`
                  : ""
              }
              onClose={() => setConfirmDialog(null)}
              footer={
                (() => {
                  const target = confirmDialog?.target;
                  if (!target) return null;
                  const sk = getReservationStatusKey(target);
                  const isConfirmedState = sk === "confirmed" && !checkedInIds.has(target.reservation_id);
                  const isOccupiedState = sk === "occupied" || sk === "seated" || checkedInIds.has(target.reservation_id);
                  const isFutureDate = new Date(target.reservation_start_at).setHours(0, 0, 0, 0) > new Date().setHours(0, 0, 0, 0);

                  return (
                    <div className="sfx-drawer__acts" style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      {isConfirmedState && !isFutureDate && <>
                        <Button variant="danger" onClick={() => setConfirmDialog({ action: "reject_checkin", target, reason: "" })}>
                          Reject Check-in
                        </Button>
                        <Button variant="gold" onClick={() => openTableSelect(target)}>
                          Confirm Check-in
                        </Button>
                      </>}
                      {isOccupiedState && !isFutureDate && checkoutReadyIds.has(target.reservation_id) && (
                        <Button variant="gold" onClick={() => setConfirmDialog({ action: "checkout", target })}>
                          Confirm Check-out
                        </Button>
                      )}
                    </div>
                  );
                })()
              }
            >
              <StaffReservationDetail
                reservation={confirmDialog?.target}
                userId={userId}
                checkedInAt={confirmDialog?.target ? confirmedAtMap.get(confirmDialog.target.reservation_id) : null}
              />
            </StaffDrawer>

            {/* ── Double-Confirm Dialog ── */}
            {confirmDialog && confirmDialog.action !== "view" && (
              <div
                style={{
                  position: "fixed", inset: 0, zIndex: 1100,
                  background: "rgba(0,0,0,0.55)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
                onClick={() => setConfirmDialog(null)}
              >
                <div
                  style={{
                    background: "#ffffff", borderRadius: 14,
                    padding: "28px 32px", maxWidth: 420, width: "92%",
                    boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
                    animation: "sfx-drawer-in 0.22s ease",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {(() => {
                    const cfg = CONFIRM_ACTIONS[confirmDialog.action];
                    if (!cfg) return null;
                    return (
                      <>
                        <h3 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 700, color: "#1a1a1a" }}>
                          {cfg.title}
                        </h3>
                        <p style={{ margin: "0 0 20px", fontSize: 14, color: "#6b6459", lineHeight: 1.6 }}>
                          {cfg.desc(confirmDialog.target)}
                        </p>
                        {cfg.needsReason && (
                          <div style={{ marginTop: 16 }}>
                            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--sfx-muted)", marginBottom: 6, textTransform: "uppercase" }}>Reason (required) <span style={{ color: "#ef4444" }}>*</span></label>
                            <input
                              type="text"
                              autoFocus
                              className="sfx-input"
                              value={confirmDialog.reason || ""}
                              onChange={(e) => setConfirmDialog({ ...confirmDialog, reason: e.target.value })}
                              placeholder="Enter reason for rejection…"
                              style={{ width: "100%", boxSizing: "border-box" }}
                            />
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                          <Button variant="ghost" onClick={() => setConfirmDialog(null)}>Cancel</Button>
                          <Button
                            variant={cfg.btnVariant}
                            onClick={() => {
                              if (confirmDialog.action === "checkin") handleCheckIn();
                              else if (confirmDialog.action === "noshow") handleRejectWalkin();
                              else if (confirmDialog.action === "reject_checkin") handleRejectCheckin();
                              else if (confirmDialog.action === "walkin_noshow") handleRejectWalkin();
                              else if (confirmDialog.action === "reject") handleRejectMismatch();
                              else if (confirmDialog.action === "reject_checkout") handleRejectCheckout();
                              else if (confirmDialog.action === "checkout") handleConfirmCheckout();
                            }}
                          >
                            {cfg.btnLabel}
                          </Button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </>
        </SkeletonPresence>

        {editReservation && (
          <StaffEditReservationModal
            reservation={editReservation}
            userId={userId}
            allReservations={dateScopedQueue}
            onClose={() => setEditReservation(null)}
            onSuccess={() => {
              setEditReservation(null);
              toast("Reservation updated (Admin Override).", "success");
              loadReservations();
            }}
          />
        )}

      </div>

      {/* ── Table Selection Modal (Check-in flow) — portal to document.body ─ */}
      {tableSelectDialog && (() => {
        const allAreas = ["All", ...new Set(tableSelectTables.map((t) => t.area_name).filter(Boolean))];
        const visibleTables = tableSelectAreaFilter === "All"
          ? tableSelectTables
          : tableSelectTables.filter((t) => t.area_name === tableSelectAreaFilter);
        const TABLE_DOT = { Available: "#10b981", Occupied: "#ef4444", Reserved: "#f59e0b", Cleaning: "#94a3b8" };
        const modalContent = (
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 9999,
              background: "rgba(0,0,0,0.72)",
              backdropFilter: "blur(8px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 16,
            }}
            onClick={() => !tableSelectSubmitting && setTableSelectDialog(null)}
          >
            <div
              style={{
                background: "#ffffff", borderRadius: 20,
                width: "100%", maxWidth: 640, maxHeight: "92vh",
                boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
                display: "flex", flexDirection: "column",
                overflow: "hidden",
                animation: "sfx-drawer-in 0.22s ease",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 99, background: "#dbeafe", color: "#1d4ed8", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", border: "1px solid #bfdbfe" }}>Check-in</span>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a" }}>
                      Select Table for {tableSelectDialog.customer_name}
                    </h3>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                    Party of <strong>{tableSelectDialog.guest_count}</strong> · Reservation #{String(tableSelectDialog.reservation_id).padStart(6, "0")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTableSelectDialog(null)}
                  disabled={tableSelectSubmitting}
                  style={{ border: "none", background: "#f1f5f9", cursor: "pointer", color: "#64748b", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Area filter pills */}
              {allAreas.length > 1 && (
                <div style={{ padding: "12px 24px 0", display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {allAreas.map((area) => (
                    <button
                      key={area}
                      type="button"
                      onClick={() => setTableSelectAreaFilter(area)}
                      style={{
                        padding: "5px 12px", borderRadius: 20, border: "1.5px solid",
                        fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                        background: tableSelectAreaFilter === area ? "#ecfdf5" : "#f8fafc",
                        color: tableSelectAreaFilter === area ? "#059669" : "#64748b",
                        borderColor: tableSelectAreaFilter === area ? "#059669" : "#e2e8f0",
                        boxShadow: tableSelectAreaFilter === area ? "0 0 0 2px rgba(5,150,105,0.12)" : "none",
                      }}
                    >
                      {area}
                    </button>
                  ))}
                </div>
              )}

              {/* Table grid */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 24px" }}>
                {tableSelectLoading ? (
                  <p style={{ textAlign: "center", marginTop: 40, color: "#6b7280", fontSize: 14 }}>Loading floor plan…</p>
                ) : visibleTables.length === 0 ? (
                  <p style={{ textAlign: "center", marginTop: 40, color: "#6b7280", fontSize: 14, fontStyle: "italic" }}>No tables in this area.</p>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 8 }}>
                    {visibleTables.map((t) => {
                      const isAvail = t.table_status === "Available";
                      const dot = TABLE_DOT[t.table_status] || "#94a3b8";
                      return (
                        <button
                          key={t.table_id}
                          type="button"
                          disabled={!isAvail || tableSelectSubmitting}
                          onClick={() => handleCheckInWithTable(t.table_id)}
                          title={isAvail ? `Seat guest at ${t.table_number}` : `${t.table_status} — unavailable`}
                          style={{
                            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                            padding: "10px 6px 8px", borderRadius: 12, textAlign: "center",
                            border: `1.5px solid ${isAvail ? "#bbf7d0" : "#e2e8f0"}`,
                            background: isAvail ? "#f0fdf4" : "#f8fafc",
                            cursor: isAvail ? "pointer" : "not-allowed",
                            opacity: isAvail ? 1 : 0.55,
                            transition: "all 0.15s ease",
                          }}
                          onMouseEnter={(e) => { if (isAvail) { e.currentTarget.style.borderColor = "#34d399"; e.currentTarget.style.background = "#dcfce7"; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(16,185,129,0.15)"; } }}
                          onMouseLeave={(e) => { if (isAvail) { e.currentTarget.style.borderColor = "#bbf7d0"; e.currentTarget.style.background = "#f0fdf4"; e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; } }}
                        >
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, display: "block", marginBottom: 2 }} />
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: isAvail ? "#0f172a" : "#6b7280", lineHeight: 1.2 }}>{t.table_number}</span>
                          <span style={{ fontSize: 10, color: "#94a3b8" }}>{t.area_name || ""}</span>
                          {t.capacity && <span style={{ fontSize: 10, color: "#64748b", background: "#f1f5f9", borderRadius: 4, padding: "1px 5px" }}>{t.capacity} seats</span>}
                          <span style={{ fontSize: 9.5, fontWeight: 600, color: dot, letterSpacing: "0.02em", textTransform: "uppercase", marginTop: 1 }}>{t.table_status}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Legend */}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
                  {Object.entries(TABLE_DOT).map(([status, color]) => (
                    <span key={status} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "#64748b", fontWeight: 500 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
                      {status}
                    </span>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: "14px 24px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", background: "#f8fafc" }}>
                <Button variant="ghost" onClick={() => setTableSelectDialog(null)} disabled={tableSelectSubmitting}>
                  Cancel
                </Button>
                {tableSelectSubmitting && (
                  <span style={{ marginLeft: 12, fontSize: 13, color: "#059669", fontWeight: 600, alignSelf: "center" }}>Seating guest…</span>
                )}
              </div>
            </div>
          </div>
        );
        return createPortal(modalContent, document.body);
      })()}

      {/* ── Walk-in Modal — uses createPortal internally to escape stacking context ── */}
      {walkInOpen && (
        <AddWalkInModal
          user={user}
          toast={toast}
          onClose={() => setWalkInOpen(false)}
          onCreated={() => { loadReservations(); }}
        />
      )}
    </>
  );
}

export default ReservationManagement;
