import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarX, Utensils, RefreshCw, Lock, AlertCircle, Calendar, Clock, Sparkles } from "lucide-react";
import CustomDatePicker from "../components/CustomDatePicker.jsx";
import "../styles/reservation.css";
import { Skeleton } from "@/components/ui/Skeleton.jsx";
import { useTableSession, ViewQrTableModal } from "@/features/table-session";
import {
  getAvailability,
  getMyReservations,
  requestCancel,
  requestEdit,
  getUpgradeQuoteApi,
  verifyUpgradePaymentApi,
} from "../services/reservationApi.js";
import { useSocket } from "@/core/socket/SocketContext.jsx";

// Per state machine: new bookings are only ever Confirmed or Rejected — Pending is legacy
const ACTIVE_STATUSES = ["Confirmed"];

// Editable fields allowed by the spec (Q2 decision)
const EDIT_FIELDS = [
  { key: "reservation_start_at", label: "Date & Time", type: "datetime-local" },
  { key: "guest_count", label: "Guests", type: "number", min: 1 },
  { key: "contact_phone", label: "Phone", type: "tel" },
  { key: "special_request", label: "Special Request / Dining Purpose", type: "textarea" },
];

function toLocalDateTimeInput(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function getCurrentLocalDateTimeInput() {
  return toLocalDateTimeInput(new Date());
}

function splitDateTimeInput(value) {
  const text = String(value || "");
  const [date = "", timeWithSeconds = ""] = text.split("T");
  return { date, time: timeWithSeconds.slice(0, 5) };
}

function parseYmdLocal(ymd) {
  const match = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeDateFilterValue(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const ymd = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    const parsed = parseYmdLocal(text);
    return parsed ? text : "";
  }
  const dmy = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmy) {
    const [, day, month, year] = dmy;
    const parsed = parseYmdLocal(`${year}-${month}-${day}`);
    return parsed ? `${year}-${month}-${day}` : "";
  }
  return "";
}

function getReservationTableIds(reservation) {
  if (!reservation) return [];
  const candidates = Array.isArray(reservation.tables)
    ? reservation.tables
    : Array.isArray(reservation.assigned_tables)
      ? reservation.assigned_tables
      : [];

  return candidates
    .map((table) => Number(table?.table_id ?? table?.id))
    .filter((id) => Number.isFinite(id) && id > 0);
}

function formatDateOnly(iso) {
  if (!iso) return "—";
  const localYmd = parseYmdLocal(iso);
  if (localYmd) {
    return localYmd.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeOnly(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatFullDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function groupReservationsByDate(list) {
  const groupsMap = new Map();
  for (const r of list) {
    const dateLabel = formatDateOnly(r.reservation_start_at);
    if (!groupsMap.has(dateLabel)) {
      groupsMap.set(dateLabel, []);
    }
    groupsMap.get(dateLabel).push(r);
  }
  return Array.from(groupsMap.entries()).map(([dateLabel, items]) => ({
    dateLabel,
    items,
  }));
}

function statusModifier(status) {
  const key = String(status || "").toLowerCase().replace(/\s+/g, "-");
  return `rzv-status-pill--${key}`;
}

function safeParseDateMs(dateStr) {
  if (!dateStr) return 0;
  if (dateStr instanceof Date) return dateStr.getTime();
  const d = new Date(dateStr);
  if (!Number.isNaN(d.getTime())) return d.getTime();
  const isoFixed = String(dateStr).replace(" ", "T");
  const d2 = new Date(isoFixed);
  return Number.isNaN(d2.getTime()) ? 0 : d2.getTime();
}

/** Derive the display label for a reservation — matches Section 1.5 logic */
function getDisplayStatus(r) {
  if (!r) return "—";
  const hasPending = Boolean(r.has_pending_request) || r.has_pending_request === 1 || r.has_pending_request === "1";
  if (hasPending) {
    return "Pending Request";
  }
  const status = r.reservation_status || "—";
  if (status === "Await Check-in" || status === "Confirmed") {
    const startMs = safeParseDateMs(r.reservation_start_at);
    const now = Date.now();
    // Only return No Show if current time is MORE THAN 30 MINUTES past reservation_start_at
    if (startMs > 0 && now > startMs + 30 * 60 * 1000) {
      return "No Show";
    }
  }
  return status;
}

function canEditReservation(r) {
  if (!r) return false;
  const hasPending = Boolean(r.has_pending_request) || r.has_pending_request === 1 || r.has_pending_request === "1";
  if (hasPending) return false;
  // Customer can request an edit at most 1 time per reservation
  const editCount = Number(r.edit_used_count || r.edit_count || (r.is_edited ? 1 : 0));
  if (editCount >= 1) return false;

  const validStatuses = ["Await Check-in", "Confirmed", "Pending Request", "Awaiting Deposit"];
  const status = r.reservation_status;
  if (!validStatuses.includes(status)) return false;

  const startMs = safeParseDateMs(r.reservation_start_at);
  if (!startMs) return false;

  const nowMs = Date.now();
  const timeUntilStartMs = startMs - nowMs;

  // Must be at least 30 minutes BEFORE start time (30 * 60 * 1000 ms)
  if (timeUntilStartMs < 30 * 60 * 1000) return false;

  return true;
}

function canCancelReservation(r) {
  if (!r || Boolean(r.has_pending_request)) return false;

  const validStatuses = ["Await Check-in", "Confirmed", "Pending Request", "Awaiting Deposit"];
  const status = r.reservation_status;
  if (!validStatuses.includes(status)) return false;

  const startMs = safeParseDateMs(r.reservation_start_at);
  if (!startMs) return false;

  return Date.now() < startMs + 30 * 60 * 1000;
}

function ReservationCountdownTimer({ startAt, status, onExpire }) {
  function calculateRemaining(targetIso) {
    if (!targetIso) return { status: 'INVALID', text: '' };
    const startMs = safeParseDateMs(targetIso);
    if (!startMs) return { status: 'INVALID', text: '' };

    const nowMs = Date.now();
    const diffMs = startMs - nowMs;
    const graceExpireMs = startMs + 30 * 60 * 1000;

    if (nowMs > graceExpireMs) {
      return { status: 'EXPIRED', text: 'Expired' };
    }

    if (diffMs > 0) {
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diffMs % (1000 * 60)) / 1000);

      let text = '';
      if (hours > 24) {
        const days = Math.floor(hours / 24);
        const remHours = hours % 24;
        text = `${days}d ${remHours}h left`;
      } else if (hours > 0) {
        text = `${hours}h ${mins}m left`;
      } else {
        text = `${mins}m ${secs}s left`;
      }
      return { status: 'UPCOMING', text };
    } else {
      const remGraceMs = graceExpireMs - nowMs;
      const mins = Math.floor(remGraceMs / (1000 * 60));
      const secs = Math.floor((remGraceMs % (1000 * 60)) / 1000);
      return { status: 'GRACE', text: `Grace Period: ${mins}m ${secs}s left!` };
    }
  }

  const [timeLeft, setTimeLeft] = useState(() => calculateRemaining(startAt));

  useEffect(() => {
    const validStatuses = ['Await Check-in', 'Confirmed', 'Pending Request', 'Awaiting Deposit'];
    if (!validStatuses.includes(status)) return;

    const interval = setInterval(() => {
      const res = calculateRemaining(startAt);
      setTimeLeft(res);
      if (res.status === 'EXPIRED') {
        clearInterval(interval);
        if (onExpire) onExpire();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [startAt, status, onExpire]);

  const validStatuses = ['Await Check-in', 'Confirmed', 'Pending Request', 'Awaiting Deposit'];
  if (!validStatuses.includes(status)) return null;
  if (!timeLeft.text || timeLeft.status === 'INVALID') return null;

  if (timeLeft.status === 'EXPIRED') {
    return (
      <span className="rzv-countdown-badge rzv-countdown-badge--expired">
        <AlertCircle size={12} /> Auto-Cancelled (No Show)
      </span>
    );
  }

  if (timeLeft.status === 'GRACE') {
    return (
      <span className="rzv-countdown-badge rzv-countdown-badge--grace">
        <Clock size={12} className="animate-pulse" /> {timeLeft.text}
      </span>
    );
  }

  return (
    <span className="rzv-countdown-badge rzv-countdown-badge--upcoming">
      <Clock size={12} /> Arrive in: {timeLeft.text}
    </span>
  );
}

function toDateStringYYYYMMDD(iso) {
  if (!iso) return "";
  const text = String(iso);
  const direct = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (direct) return `${direct[1]}-${direct[2]}-${direct[3]}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function MyReservationsPage({
  isAuthenticated = false,
  currentUser = null,
  onNavigate,
  onNavigateLogin,
}) {
  const userId = currentUser?.userId ?? currentUser?.id ?? currentUser?.user_id ?? currentUser?.sub ?? null;

  const [reservations, setReservations] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [qrModalOpen, setQrModalOpen] = useState(false);

  // View Details modal (read-only — never repurposed for editing)
  const [viewDetailsTarget, setViewDetailsTarget] = useState(null);

  // Cancel Request modal states
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // Edit Request modal states
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editConfirm, setEditConfirm] = useState(false);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editWarningOpen, setEditWarningOpen] = useState(false); // 1-time edit warning
  const [editWarningTarget, setEditWarningTarget] = useState(null);
  const [editTables, setEditTables] = useState([]);
  const [editTablesLoading, setEditTablesLoading] = useState(false);
  const [editValidationError, setEditValidationError] = useState("");

  // SePay Upgrade Payment Modal State
  const [upgradeModal, setUpgradeModal] = useState(null); // { quote, pendingChanges, isVerifying }

  const handleVerifyUpgradePayment = async () => {
    if (!upgradeModal || !editTarget) return;
    setUpgradeModal((prev) => ({ ...prev, isVerifying: true }));
    try {
      const res = await verifyUpgradePaymentApi(editTarget.reservation_id, userId, {
        upgrade_order_code: upgradeModal.quote.upgrade_order_code,
        upgrade_amount: upgradeModal.quote.upgrade_amount,
        pending_changes: upgradeModal.pendingChanges,
      });

      if (res?.success) {
        setReservations((prev) =>
          prev.map((r) =>
            r.reservation_id === editTarget.reservation_id
              ? { ...r, has_pending_request: 1, request_type: "edit", edit_used_count: 1 }
              : r
          )
        );
        setUpgradeModal(null);
        setEditTarget(null);
      } else {
        setError(res?.message || "Payment verification failed.");
      }
    } catch (err) {
      setError(err?.message || "Could not verify upgrade payment.");
    } finally {
      setUpgradeModal((prev) => (prev ? { ...prev, isVerifying: false } : null));
    }
  };

  const { hasActiveSession, session: tableSession } = useTableSession();

  // Helper to extract assigned table numbers from any data structure
  const getAssignedTablesText = (r) => {
    if (!r) return "—";
    if (Array.isArray(r.tables) && r.tables.length > 0) {
      const formatted = r.tables
        .map(t => (typeof t === "string" ? t : (t.table_number || t.table_label || t.display_label || t.name)))
        .filter(Boolean)
        .join(", ");
      if (formatted) return formatted;
    }
    if (typeof r.assigned_tables === "string" && r.assigned_tables.trim() && r.assigned_tables.trim() !== "—") {
      return r.assigned_tables.trim();
    }
    if (Array.isArray(r.assigned_tables) && r.assigned_tables.length > 0) {
      const formatted = r.assigned_tables
        .map(t => (typeof t === "string" ? t : (t.table_number || t.table_label || t.name)))
        .filter(Boolean)
        .join(", ");
      if (formatted) return formatted;
    }
    if (r.preferred_table_number) return `${r.preferred_table_number} (preference)`;
    if (r.preferred_table_label) return r.preferred_table_label;
    if (r.table_number) return String(r.table_number);
    if (r.table_label) return String(r.table_label);
    if (r.table_name) return String(r.table_name);
    if (r.table_id) return `Table #${r.table_id}`;
    return "—";
  };

  const resolveTableId = (r) => {
    if (!r) return "—";
    const assigned = getAssignedTablesText(r);
    if (assigned && assigned !== "—") return assigned;
    return "Awaiting staff confirmation";
  };

  // Calculates Meal Shift & Session Window based on execution time
  const getDiningSessionInfo = (dateString) => {
    if (!dateString) return { mealName: "—", windowStr: "—", fullText: "—" };
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return { mealName: "—", windowStr: "—", fullText: "—" };

    const hour = d.getHours();
    let mealName = "";
    let windowStr = "";

    if (hour < 11) {
      mealName = "Breakfast Session";
      windowStr = "7:00 AM → 10:59 AM";
    } else if (hour < 17) {
      mealName = "Lunch Session";
      windowStr = "11:00 AM → 4:59 PM";
    } else {
      mealName = "Dinner Session";
      windowStr = "5:00 PM → 11:00 PM";
    }

    return {
      mealName,
      windowStr,
      fullText: `${mealName} (${windowStr})`,
    };
  };

  // Helper to filter out seed values like "Private room" or "None" if user didn't type custom notes
  const getCleanSpecialNotes = (r) => {
    if (!r) return null;
    const req = r.special_request || r.special_notes || r.notes;
    if (!req || typeof req !== "string") return null;
    const trimmed = req
      .replace(/\s*\[PreferredTable:[^\]]*\]/gi, "")
      .replace(/\s*\[PreferredTableId:[^\]]*\]/gi, "")
      .replace(/\s*\[Assignment:[^\]]*\]/gi, "")
      .trim();
    if (!trimmed) return null;

    const lower = trimmed.toLowerCase();
    const zone = (r.area_name || r.preferred_area || getZoneName(r) || "").toLowerCase().trim();

    // Ignore seed/default values like "Private room", "None", "N/A" if user didn't type custom notes
    if (
      lower === "private room" ||
      lower === "none" ||
      lower === "n/a" ||
      lower === "null" ||
      (zone && lower === zone)
    ) {
      return null;
    }
    return trimmed;
  };

  const getZoneName = (r) => {
    if (!r) return "—";

    const tablesText = getAssignedTablesText(r);
    const resolvedTableId = resolveTableId(r);
    const textToMatch = (tablesText && tablesText !== "—") ? tablesText : resolvedTableId;

    if (textToMatch && textToMatch !== "—") {
      const match = textToMatch.match(/\b(WIN|VIP|PRE|PR|K|S)\b/i);
      if (match) {
        const code = match[1].toUpperCase();
        switch (code) {
          case "WIN": return "Window Area";
          case "VIP": return "VIP Lounge";
          case "PRE": return "Premium Area";
          case "PR": return "Private Room";
          case "K": return "Kitchen View Area";
          case "S": return "Standard Area";
        }
      }
    }

    const rawArea = r.area_name || r.preferred_area || r.area_type || "";
    if (rawArea) {
      const lower = rawArea.toLowerCase();
      if (lower.includes("window")) return "Window Area";
      if (lower.includes("vip")) return "VIP Lounge";
      if (lower.includes("private")) return "Private Room";
      if (lower.includes("premium")) return "Premium Area";
      if (lower.includes("kitchen")) return "Kitchen View Area";
      if (lower.includes("standard") || lower.includes("main") || lower.includes("event")) return "Standard Area";
      return rawArea;
    }

    return "Standard Area";
  };

  const load = useCallback(() => {
    if (!isAuthenticated) return;
    setStatus("loading");
    setError("");
    getMyReservations(userId, { date: selectedDate || undefined })
      .then((res) => {
        setReservations(res?.reservations || []);
        setStatus("ready");
      })
      .catch((err) => {
        setError(err?.message || "Could not load your reservations.");
        setStatus("error");
      });
  }, [isAuthenticated, userId, selectedDate]);

  useEffect(() => {
    load();
  }, [load]);

  const { socket } = useSocket();
  useEffect(() => {
    if (!socket) return;
    const handleProcessed = () => load();
    const handleResolved = () => load();
    socket.on("reservation:processed", handleProcessed);
    socket.on("reservation:request_resolved", handleResolved);
    return () => {
      socket.off("reservation:processed", handleProcessed);
      socket.off("reservation:request_resolved", handleResolved);
    };
  }, [socket, load]);

  const filteredReservations = useMemo(() => {
    if (!selectedDate) return reservations;
    return reservations.filter((r) => {
      const rDate = toDateStringYYYYMMDD(r.reservation_start_at);
      return rDate === selectedDate;
    });
  }, [reservations, selectedDate]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up = [], old = [];
    for (const r of filteredReservations) {
      const start = new Date(r.reservation_start_at).getTime();
      const isActive = ACTIVE_STATUSES.includes(r.reservation_status);
      if (isActive && (Number.isNaN(start) || start >= now)) up.push(r);
      else old.push(r);
    }
    return { upcoming: up, past: old };
  }, [filteredReservations]);

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
    const currentTableIds = getReservationTableIds(r);
    const cleanSpecialReq = String(r.special_request || "")
      .replace(/\[PreferredTable[^\]]*\]/gi, "")
      .replace(/\[PreferredTableId[^\]]*\]/gi, "")
      .replace(/\[Assignment[^\]]*\]/gi, "")
      .replace(/\[[^\]]+\]/g, "")
      .trim();

    // Pre-populate form with current values
    setEditForm({
      reservation_start_at: r.reservation_start_at
        ? toLocalDateTimeInput(r.reservation_start_at)
        : "",
      guest_count: String(r.guest_count ?? ""),
      contact_phone: r.customer_phone || r.contact_phone || "",
      special_request: cleanSpecialReq,
      table_id: currentTableIds[0] ? String(currentTableIds[0]) : "",
      preorder_items_text: "",
    });
    setEditConfirm(false);
    setEditValidationError("");
  };

  useEffect(() => {
    if (!editTarget || editConfirm) return undefined;

    const { date, time } = splitDateTimeInput(editForm.reservation_start_at);
    const guestCount = Number(editForm.guest_count || editTarget.guest_count || 1);

    if (!date || !time || !Number.isFinite(guestCount) || guestCount <= 0) {
      setEditTables([]);
      return undefined;
    }

    let active = true;
    setEditTablesLoading(true);

    getAvailability({
      date,
      time,
      durationMinutes: 90,
      guestCount,
    })
      .then((res) => {
        if (!active) return;
        const currentIds = new Set(getReservationTableIds(editTarget).map(String));
        const rows = Array.isArray(res?.tables) ? res.tables : [];
        setEditTables(rows.filter((table) => table.is_bookable || currentIds.has(String(table.table_id))));
      })
      .catch(() => {
        if (active) setEditTables([]);
      })
      .finally(() => {
        if (active) setEditTablesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [editTarget, editConfirm, editForm.reservation_start_at, editForm.guest_count]);

  const handleSubmitEditRequest = async () => {
    if (!editTarget || submittingEdit) return;
    // Build diff — only include fields that actually changed
    const current = {
      reservation_start_at: editTarget.reservation_start_at
        ? toLocalDateTimeInput(editTarget.reservation_start_at)
        : "",
      guest_count: String(editTarget.guest_count ?? ""),
      contact_phone: editTarget.customer_phone || editTarget.contact_phone || "",
      special_request: editTarget.special_request || "",
      table_id: String(getReservationTableIds(editTarget)[0] || ""),
      preorder_items_text: "",
    };
    const requestedStart = editForm.reservation_start_at ? new Date(editForm.reservation_start_at) : null;
    if (requestedStart && requestedStart.getTime() <= Date.now()) {
      setEditValidationError("Please choose a future date and time. Past time slots cannot be requested.");
      setEditConfirm(false);
      return;
    }

    const changes = {};
    for (const field of EDIT_FIELDS) {
      const newVal = String(editForm[field.key] ?? "").trim();
      const oldVal = String(current[field.key] ?? "").trim();
      if (newVal !== oldVal && newVal !== "") changes[field.key] = editForm[field.key];
    }
    if (String(editForm.table_id || "").trim() && String(editForm.table_id) !== current.table_id) {
      changes.table_ids = [Number(editForm.table_id)].filter((id) => Number.isFinite(id) && id > 0);
    }
    if (String(editForm.preorder_items_text || "").trim()) {
      changes.preorder_items = String(editForm.preorder_items_text)
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => ({ item_name: line, quantity: 1, notes: "Requested during reservation edit" }));
    }
    if (Object.keys(changes).length === 0) {
      setError("No changes detected. Please modify at least one field.");
      return;
    }

    setSubmittingEdit(true);
    try {
      // Check upgrade quote if area/table/guests changed
      const quoteRes = await getUpgradeQuoteApi(editTarget.reservation_id, userId, {
        new_area_id: editForm.area_id || null,
        new_table_id: editForm.table_id || null,
        guest_count: editForm.guest_count || editTarget.guest_count,
      });

      if (quoteRes?.success && quoteRes?.data?.requires_payment) {
        setUpgradeModal({
          quote: quoteRes.data,
          pendingChanges: changes,
          isVerifying: false,
        });
        setSubmittingEdit(false);
        setEditConfirm(false);
        return;
      }

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

  const handleExpireReservation = useCallback((resId) => {
    setReservations((prev) =>
      prev.map((r) =>
        r.reservation_id === resId ? { ...r, reservation_status: "No Show" } : r
      )
    );
  }, []);

  const renderCard = (r, index = 0) => {
    const canEdit = canEditReservation(r);
    const canCancel = canCancelReservation(r);
    const displayStatus = getDisplayStatus(r);

    return (
      <article
        className="rzv-res-card"
        key={r.reservation_id}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 160px auto",
          width: "100%",
          minHeight: "72px",
          alignItems: "center",
          alignContent: "center",
          padding: "16px 24px",
          gap: "24px",
          boxSizing: "border-box",
          animationDelay: `${index * 0.06}s`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", minWidth: 0, margin: 0, padding: 0 }}>
          <span className="rzv-res-card__id" style={{ margin: 0, color: "var(--rzv-text)", fontSize: "0.95rem", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, lineHeight: 1 }}>
            Reservation #{String(r.reservation_id).padStart(6, "0")}
          </span>
          <ReservationCountdownTimer
            startAt={r.reservation_start_at}
            status={r.reservation_status}
            onExpire={() => handleExpireReservation(r.reservation_id)}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", margin: 0, padding: 0 }}>
          <span className={`rzv-status-pill ${statusModifier(displayStatus)}`} style={{ margin: 0 }}>
            {displayStatus}
          </span>
        </div>

        <div className="rzv-res-card__actions" style={{ display: "flex", gap: "10px", justifyContent: "flex-end", alignItems: "center", margin: 0, padding: 0 }}>
          <button
            type="button"
            className="rzv-btn--gold-liquid"
            onClick={() => setViewDetailsTarget(r)}
            style={{ margin: 0 }}
          >
            <Sparkles size={14} /> View Details
          </button>
          {canEdit && (
            <button type="button" className="rzv-btn rzv-btn--ghost" onClick={() => openEditRequestWithWarning(r)} style={{ padding: "8px 16px", fontSize: "0.8rem", margin: 0 }}>
              Edit
            </button>
          )}
          {canCancel && (
            <button type="button" className="rzv-btn rzv-btn--danger" onClick={() => openCancelRequest(r)} style={{ padding: "8px 16px", fontSize: "0.8rem", margin: 0 }}>
              Cancel
            </button>
          )}
        </div>
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
          <div className="rzv-myres__empty" style={{ padding: "60px 32px", borderRadius: "24px" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(159, 134, 85, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#9f8655" }}>
              <Lock size={28} />
            </div>
            <h3 style={{ margin: "8px 0 4px", fontSize: "1.2rem", fontWeight: "600", color: "var(--rzv-text)" }}>Sign In Required</h3>
            <p style={{ maxWidth: "380px", margin: "0 0 8px", fontSize: "0.9rem", color: "var(--rzv-muted)" }}>
              Please sign in to your account to view and manage your table reservations.
            </p>
            <button type="button" className="rzv-btn rzv-btn--solid" onClick={() => onNavigateLogin?.()}>
              Sign In
            </button>
          </div>
        ) : null}

        {isAuthenticated && (status === "loading" || status === "idle") ? (
          <div className="rzv-myres__list" aria-busy="true" aria-label="Loading reservations" style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px" }}>
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={`sk-${idx}`}
                className="rzv-res-card"
                style={{ display: "flex", flexDirection: "row", width: "100%", minHeight: "80px", alignItems: "center", justifyContent: "space-between", padding: "16px 24px" }}
              >
                <div style={{ display: "flex", gap: "24px", alignItems: "center", flex: 1 }}>
                  <Skeleton className="w-28 h-4" />
                  <Skeleton className="w-48 h-6" />
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <Skeleton className="w-24 h-8" />
                  <Skeleton className="w-16 h-8" />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {isAuthenticated && status === "error" ? (
          <div className="rzv-myres__empty" style={{ padding: "60px 32px", borderRadius: "24px" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(220, 38, 38, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#dc2626" }}>
              <AlertCircle size={28} />
            </div>
            <p className="rzv-summary__error" style={{ margin: "8px 0" }}>{error}</p>
            <button type="button" className="rzv-btn rzv-btn--ghost" onClick={load} style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
              <RefreshCw size={14} /> Try again
            </button>
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

            {reservations.length > 0 || selectedDate ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "16px",
                  backgroundColor: "var(--rzv-panel)",
                  border: "1px solid var(--rzv-line)",
                  borderRadius: "16px",
                  padding: "14px 22px",
                  marginBottom: "28px"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <Calendar size={18} style={{ color: "var(--rzv-gold)" }} />
                  <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--rzv-text)" }}>
                    Filter by Date:
                  </span>
                  <CustomDatePicker
                    value={selectedDate}
                    onChange={(val) => setSelectedDate(normalizeDateFilterValue(val))}
                  />
                  {selectedDate && (
                    <button
                      type="button"
                      onClick={() => setSelectedDate("")}
                      className="rzv-btn rzv-btn--ghost"
                      style={{ padding: "6px 14px", fontSize: "0.78rem" }}
                    >
                      Clear Date
                    </button>
                  )}
                </div>

                {selectedDate && (
                  <span style={{ fontSize: "0.84rem", color: "var(--rzv-muted)" }}>
                    Found <strong style={{ color: "var(--rzv-gold)" }}>{filteredReservations.length}</strong> {filteredReservations.length === 1 ? "booking" : "bookings"} on {formatDateOnly(selectedDate)}
                  </span>
                )}
              </div>
            ) : null}

            {reservations.length === 0 && !selectedDate && !hasActiveSession ? (
              <div className="rzv-myres__empty" style={{ padding: "64px 32px", borderRadius: "24px", background: "var(--rzv-panel)", border: "1px solid var(--rzv-line)" }}>
                <div style={{ width: "72px", height: "72px", borderRadius: "50%", background: "rgba(159, 134, 85, 0.12)", border: "1px solid rgba(159, 134, 85, 0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "#9f8655" }}>
                  <CalendarX size={32} />
                </div>
                <h3 style={{ margin: "12px 0 4px", fontSize: "1.3rem", fontWeight: "600", color: "var(--rzv-text)", fontFamily: "serif" }}>
                  You Have No Reservations Yet
                </h3>
                <p style={{ maxWidth: "420px", margin: "0 0 12px", fontSize: "0.92rem", color: "var(--rzv-muted)", lineHeight: 1.55 }}>
                  You don't have any upcoming or past table reservations with Phūrai. Explore our floor plan and reserve your dining experience.
                </p>
                <button
                  type="button"
                  className="rzv-btn rzv-btn--solid"
                  onClick={() => onNavigate?.("reservations")}
                  style={{ display: "inline-flex", alignItems: "center", gap: "10px", padding: "12px 28px", fontSize: "0.9rem", fontWeight: 600 }}
                >
                  <Utensils size={16} /> Book a Table Now
                </button>
              </div>
            ) : null}

            {selectedDate && filteredReservations.length === 0 ? (
              <div className="rzv-myres__empty" style={{ padding: "48px 24px", borderRadius: "20px", background: "var(--rzv-panel)", border: "1px solid var(--rzv-line)" }}>
                <CalendarX size={36} style={{ color: "var(--rzv-gold)", marginBottom: "8px" }} />
                <h4 style={{ margin: "4px 0 4px", fontSize: "1.15rem", fontWeight: "600", color: "var(--rzv-text)" }}>
                  No Bookings Found for {formatDateOnly(selectedDate)}
                </h4>
                <p style={{ fontSize: "0.88rem", color: "var(--rzv-muted)", margin: "0 0 16px" }}>
                  You don't have any reservations on this specific date.
                </p>
                <button
                  type="button"
                  className="rzv-btn rzv-btn--ghost"
                  onClick={() => setSelectedDate("")}
                  style={{ padding: "8px 20px", fontSize: "0.85rem" }}
                >
                  Show All Dates
                </button>
              </div>
            ) : null}

            {upcoming.length > 0 ? (
              <section className="rzv-myres__group">
                <h2 className="rzv-myres__group-title">Upcoming</h2>
                {groupReservationsByDate(upcoming).map((group) => (
                  <div key={group.dateLabel} style={{ marginBottom: "24px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "16px 0 10px 4px" }}>
                      <Calendar size={14} style={{ color: "var(--rzv-gold)" }} />
                      <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--rzv-gold)", letterSpacing: "0.04em" }}>
                        {group.dateLabel}
                      </span>
                      <span style={{ fontSize: "0.78rem", color: "var(--rzv-muted)" }}>
                        ({group.items.length} {group.items.length === 1 ? "reservation" : "reservations"})
                      </span>
                    </div>
                    <div className="rzv-myres__list" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {group.items.map((item, idx) => renderCard(item, idx))}
                    </div>
                  </div>
                ))}
              </section>
            ) : null}

            {past.length > 0 ? (
              <section className="rzv-myres__group">
                <h2 className="rzv-myres__group-title">Past &amp; Cancelled</h2>
                {groupReservationsByDate(past).map((group) => (
                  <div key={group.dateLabel} style={{ marginBottom: "24px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "16px 0 10px 4px" }}>
                      <Calendar size={14} style={{ color: "var(--rzv-gold)" }} />
                      <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--rzv-gold)", letterSpacing: "0.04em" }}>
                        {group.dateLabel}
                      </span>
                      <span style={{ fontSize: "0.78rem", color: "var(--rzv-muted)" }}>
                        ({group.items.length} {group.items.length === 1 ? "reservation" : "reservations"})
                      </span>
                    </div>
                    <div className="rzv-myres__list" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {group.items.map((item, idx) => renderCard(item, idx))}
                    </div>
                  </div>
                ))}
              </section>
            ) : null}
          </>
        ) : null}
      </div>

      {hasActiveSession ? (
        <ViewQrTableModal isOpen={qrModalOpen} onClose={() => setQrModalOpen(false)} />
      ) : null}

      {/* ── View Details modal (Apple-Style Liquid Glass Reservation Invoice) ── */}
      {viewDetailsTarget ? (() => {
        const assignedText = getAssignedTablesText(viewDetailsTarget);
        const zoneName = getZoneName(viewDetailsTarget);
        const tableIdResolved = resolveTableId(viewDetailsTarget);
        const sessionInfo = getDiningSessionInfo(viewDetailsTarget.reservation_start_at);
        const displayStatus = getDisplayStatus(viewDetailsTarget);
        const normalizedStatus = String(displayStatus || "").toLowerCase();
        const tableAssignmentStatus = String(viewDetailsTarget.table_assignment_status || "").toLowerCase();
        const isClosedStatus = ["no show", "cancelled", "completed"].includes(normalizedStatus);
        const isPreferredTable =
          tableAssignmentStatus === "preferred" ||
          String(tableIdResolved || "").toLowerCase().includes("preference");
        const tableStatusTitle = isClosedStatus
          ? "Table Hold Released"
          : isPreferredTable
            ? "Preferred Table"
            : "Confirmed Table";
        const tableStatusTone = isClosedStatus
          ? { bg: "#fff5f5", border: "#fecaca", color: "#b91c1c" }
          : isPreferredTable
            ? { bg: "#fff8e1", border: "#f4d38a", color: "#9f6b1b" }
            : { bg: "#ecfdf5", border: "#a7f3d0", color: "#047857" };
        const tableExplanation = isClosedStatus
          ? "This reservation is no longer holding a table. Please make a new reservation if you still want to visit."
          : isPreferredTable
            ? "This is your requested table preference. Staff will confirm the final table closer to your arrival."
            : "This table has been confirmed by the restaurant for your arrival.";

        return (
          <div className="rzv-modal-overlay" onClick={(e) => { if (e.target.className === "rzv-modal-overlay") setViewDetailsTarget(null); }}>
            <div className="rzv-apple-invoice-modal">
              {/* Header */}
              <div className="apple-stagger-item" style={{ textAlign: "center", marginBottom: "32px", animationDelay: "0.05s" }}>
                <span className="rzv-booking__kicker" style={{ fontSize: "0.75rem", letterSpacing: "0.2em" }}>Your Booking</span>
                <h2 style={{ fontSize: "2rem", fontWeight: 500, color: "var(--rzv-gold)", margin: "4px 0 10px 0", letterSpacing: "0.02em", fontFamily: "serif" }}>Reservation Details</h2>
                <div style={{ display: "inline-flex", padding: "6px 16px", borderRadius: "999px", background: "rgba(159, 134, 85, 0.12)", color: "var(--rzv-gold)", fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  Reservation #{String(viewDetailsTarget.reservation_id).padStart(6, "0")}
                </div>
              </div>

              {/* Customer Details Card */}
              <div className="apple-stagger-item" style={{ background: "rgba(248, 245, 239, 0.8)", border: "1px solid var(--rzv-line)", borderRadius: "18px", padding: "20px 24px", marginBottom: "20px", animationDelay: "0.12s" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 24px" }}>
                  <div>
                    <strong style={{ color: "var(--rzv-muted)", display: "block", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "3px" }}>Customer Name</strong>
                    <span style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--rzv-text)" }}>{viewDetailsTarget.customer_name}</span>
                  </div>
                  <div>
                    <strong style={{ color: "var(--rzv-muted)", display: "block", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "3px" }}>Phone Number</strong>
                    <span style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--rzv-text)" }}>{viewDetailsTarget.customer_phone || viewDetailsTarget.phone || "—"}</span>
                  </div>
                  <div style={{ gridColumn: "span 2" }}>
                    <strong style={{ color: "var(--rzv-muted)", display: "block", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "3px" }}>Email Address</strong>
                    <span style={{ fontSize: "0.98rem", fontWeight: 500, color: "var(--rzv-text)", wordBreak: "break-all" }}>{viewDetailsTarget.customer_email || viewDetailsTarget.email || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Timings Side-by-Side Cards */}
              <div className="apple-stagger-item" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "20px", animationDelay: "0.18s" }}>
                <div style={{ background: "#ffffff", border: "1px solid var(--rzv-line)", padding: "16px 18px", borderRadius: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
                  <strong style={{ color: "var(--rzv-muted)", display: "block", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>Arrival Time</strong>
                  <span style={{ fontSize: "0.98rem", fontWeight: 700, color: "var(--rzv-text)" }}>
                    {viewDetailsTarget.reservation_start_at
                      ? format(new Date(viewDetailsTarget.reservation_start_at), "EEE, MMM d, yyyy, h:mm a")
                      : "—"}
                  </span>
                </div>
                <div style={{ background: "#ffffff", border: "1px solid var(--rzv-line)", padding: "16px 18px", borderRadius: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
                  <strong style={{ color: "var(--rzv-muted)", display: "block", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>Planning Window</strong>
                  <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "var(--rzv-gold)" }}>
                    {viewDetailsTarget.reservation_start_at ? (
                      <>
                        <div style={{ fontSize: "0.86rem", marginTop: "3px", color: "var(--rzv-gold)", fontWeight: 700, display: "flex", alignItems: "center", gap: "5px" }}>
                          <Clock size={13} /> {sessionInfo.fullText}
                        </div>
                        <p style={{ margin: "6px 0 0", color: "var(--rzv-muted)", fontSize: "0.74rem", lineHeight: 1.4, fontWeight: 500 }}>
                          Used for scheduling only; your actual table release is handled by staff checkout.
                        </p>
                      </>
                    ) : "—"}
                  </div>
                </div>
              </div>

              {/* Booking Details Grid */}
              <div className="apple-stagger-item" style={{ background: "#ffffff", border: "1px solid var(--rzv-line)", borderRadius: "20px", padding: "22px 24px", marginBottom: "24px", animationDelay: "0.24s" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                  <div>
                    <strong style={{ color: "var(--rzv-muted)", display: "block", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>Booking Status</strong>
                    <span className={`rzv-status-pill ${statusModifier(displayStatus)}`} style={{ margin: 0 }}>
                      {displayStatus}
                    </span>
                  </div>
                  <div>
                    <strong style={{ color: "var(--rzv-muted)", display: "block", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>Guest Party</strong>
                    <span style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--rzv-text)" }}>{viewDetailsTarget.guest_count} Persons</span>
                  </div>

                  <div style={{ gridColumn: "span 2", borderTop: "1px solid var(--rzv-line)", paddingTop: "18px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "14px" }}>
                      <div>
                        <strong style={{ color: "var(--rzv-muted)", display: "block", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "5px" }}>Area / Zone</strong>
                        <span style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--rzv-text)" }}>{zoneName}</span>
                      </div>
                      <div>
                        <strong style={{ color: "var(--rzv-muted)", display: "block", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "5px" }}>Table Status</strong>
                        <span style={{ display: "inline-flex", padding: "6px 12px", borderRadius: "999px", background: tableStatusTone.bg, border: `1px solid ${tableStatusTone.border}`, color: tableStatusTone.color, fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                          {tableStatusTitle}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ gridColumn: "span 2", padding: "16px", borderRadius: "16px", border: `1px solid ${tableStatusTone.border}`, background: tableStatusTone.bg }}>
                    <strong style={{ color: tableStatusTone.color, display: "block", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>{tableStatusTitle}</strong>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
                      {!isClosedStatus && tableIdResolved && tableIdResolved !== "—" ? (
                        tableIdResolved.split(",").map((t, idx) => {
                          const label = t.trim().replace(/\s*\(preference\)$/i, "");
                          return (
                            <span key={idx} className="rzv-table-badge" style={{ background: "#fff" }}>
                              <Utensils size={13} /> {label.startsWith("Table") ? label : `Table ${label}`}
                            </span>
                          );
                        })
                      ) : (
                        <span style={{ color: tableStatusTone.color, fontSize: "0.95rem", fontWeight: 700 }}>
                          No active table hold
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, color: tableStatusTone.color, fontSize: "0.84rem", lineHeight: 1.5, fontWeight: 600 }}>
                      {tableExplanation}
                    </p>
                  </div>
                </div>
              </div>

              {/* Pre-order Items */}
              {viewDetailsTarget.preorders?.length > 0 && (
                <div className="apple-stagger-item" style={{ marginBottom: "24px", fontSize: "0.95rem", animationDelay: "0.30s" }}>
                  <strong style={{ color: "var(--rzv-muted)", display: "block", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>Pre-order Items</strong>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, border: "1px solid var(--rzv-line)", borderRadius: "14px", overflow: "hidden" }}>
                    {viewDetailsTarget.preorders.map((p, index) => (
                      <li key={p.dish_id} style={{ padding: "12px 18px", background: index % 2 === 0 ? "rgba(248, 245, 239, 0.6)" : "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 500 }}>{p.dish_name}</span>
                        <strong style={{ color: "var(--rzv-gold)", fontSize: "0.95rem" }}>×{p.quantity}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Special Notes */}
              {(() => {
                const purpose = viewDetailsTarget.occasion;
                const cleanNotes = getCleanSpecialNotes(viewDetailsTarget);
                if (!purpose && !cleanNotes) return null;
                return (
                  <div className="apple-stagger-item" style={{ marginBottom: "28px", animationDelay: "0.32s" }}>
                    {purpose && (
                      <div style={{ marginBottom: "12px" }}>
                        <strong style={{ color: "var(--rzv-muted)", display: "block", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>Dining Purpose</strong>
                        <span style={{ fontSize: "1rem", fontWeight: 500, color: "var(--rzv-text)" }}>{purpose}</span>
                      </div>
                    )}
                    {cleanNotes && (
                      <div>
                        <strong style={{ color: "var(--rzv-muted)", display: "block", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>Special Notes</strong>
                        <p style={{ margin: 0, padding: "14px 18px", backgroundColor: "rgba(248, 245, 239, 0.7)", borderLeft: "3px solid var(--rzv-gold)", borderRadius: "0 12px 12px 0", fontStyle: "italic", color: "var(--rzv-text)", lineHeight: 1.6, fontSize: "0.92rem" }}>
                          "{cleanNotes}"
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Pending Request Notice */}
              {viewDetailsTarget.has_pending_request ? (
                <div className="apple-stagger-item" style={{ padding: "16px", backgroundColor: "#fff8e1", border: "1px solid #ffc107", borderRadius: "14px", marginBottom: "24px", animationDelay: "0.34s" }}>
                  <strong style={{ display: "block", color: "#b45309", marginBottom: "4px", fontSize: "0.9rem" }}>Action Required</strong>
                  <p style={{ margin: 0, fontSize: "0.88rem", color: "#92400e", lineHeight: 1.5 }}>
                    A <strong>{viewDetailsTarget.request_type === "cancel" ? "cancellation" : "edit"} request</strong> is pending Manager review.
                  </p>
                </div>
              ) : null}

              {/* Footer Actions */}
              <div className="apple-stagger-item" style={{ display: "flex", justifyContent: "flex-end", gap: "12px", borderTop: "1px solid var(--rzv-line)", paddingTop: "24px", animationDelay: "0.36s" }}>
                {!viewDetailsTarget.has_pending_request &&
                  (viewDetailsTarget.edit_used_count ?? 0) < 1 &&
                  (viewDetailsTarget.reservation_status === "Confirmed" || viewDetailsTarget.reservation_status === "AWAIT CHECK-IN") && (
                    <button
                      type="button"
                      className="rzv-btn rzv-btn--ghost"
                      style={{ padding: "10px 24px" }}
                      onClick={() => { setViewDetailsTarget(null); openEditRequestWithWarning(viewDetailsTarget); }}
                    >
                      Edit
                    </button>
                  )}
                {!viewDetailsTarget.has_pending_request &&
                  (viewDetailsTarget.reservation_status === "Confirmed" || viewDetailsTarget.reservation_status === "AWAIT CHECK-IN") && (
                    <button
                      type="button"
                      className="rzv-btn rzv-btn--danger"
                      style={{ padding: "10px 24px" }}
                      onClick={() => { setViewDetailsTarget(null); openCancelRequest(viewDetailsTarget); }}
                    >
                      Cancel
                    </button>
                  )}
                <button
                  type="button"
                  className="rzv-btn rzv-btn--solid"
                  style={{ padding: "10px 28px", borderRadius: "999px" }}
                  onClick={() => setViewDetailsTarget(null)}
                >
                  Close Invoice
                </button>
              </div>
            </div>
          </div>
        );
      })() : null}

      {/* ── Cancel Request modal ── */}
      {cancelTarget && !cancelConfirm && (
        <div className="rzv-modal-overlay" onClick={(e) => { if (e.target.className === "rzv-modal-overlay") setCancelTarget(null); }}>
          <div className="rzv-modal" style={{ maxWidth: "420px", width: "100%", padding: "24px", backgroundColor: "#fff", borderRadius: "8px" }}>
            <h2 className="rzv-serif" style={{ marginBottom: "8px" }}>Request Cancellation</h2>
            <p style={{ fontSize: 14, color: "#666", marginBottom: 16 }}>
              Booking <strong>#{String(cancelTarget.reservation_id).padStart(6, "0")}</strong> will remain <strong>Confirmed</strong> until a Manager reviews and processes your request.
            </p>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
              Reason
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
              {cancelTarget.reservation_status === "Confirmed" || cancelTarget.reservation_status === "Reserved" || cancelTarget.reservation_status === "Await Check-in"
                ? " Per restaurant policy, cancelling a confirmed reservation forfeits your deposit (non-refundable)."
                : " The manager will process your cancellation."}
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
          <div className="rzv-modal" style={{ maxWidth: "680px", width: "calc(100% - 32px)", padding: "28px 32px", backgroundColor: "#fff", borderRadius: "20px", boxShadow: "0 20px 50px rgba(0,0,0,0.15)" }}>
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid #f0f0f0" }}>
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--rzv-gold)", display: "block", marginBottom: 6 }}>
                CHANGE REQUEST
              </span>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
                <h2 className="rzv-serif" style={{ margin: 0, fontSize: 24, color: "#111" }}>Edit Reservation</h2>
                <span style={{ border: "1px solid var(--rzv-line)", background: "#fafafa", borderRadius: 999, padding: "4px 12px", fontSize: 13, fontWeight: 700, color: "#444" }}>
                  #{String(editTarget.reservation_id).padStart(6, "0")}
                </span>
              </div>
              <p style={{ fontSize: 13.5, color: "#666", margin: "10px auto 0", maxWidth: "520px", lineHeight: 1.55 }}>
                Send your requested changes to Staff Portal for approval. Your current reservation stays unchanged until staff accepts the request.
              </p>
            </div>

            {editValidationError ? (
              <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 10, border: "1px solid #fca5a5", background: "#fef2f2", color: "#b91c1c", fontSize: 13, fontWeight: 600 }}>
                {editValidationError}
              </div>
            ) : null}

            {/* Balanced 2-Column Grid Layout */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 20px" }}>
              {/* Row 1: Date & Time + Guests */}
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>New Date & Time *</span>
                <input
                  className="rzv-input"
                  type="datetime-local"
                  min={getCurrentLocalDateTimeInput()}
                  value={editForm.reservation_start_at || ""}
                  onChange={(e) => {
                    setEditValidationError("");
                    setEditForm((p) => ({ ...p, reservation_start_at: e.target.value }));
                  }}
                  style={{ width: "100%", height: "42px", borderRadius: "10px" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>Guests *</span>
                <input
                  className="rzv-input"
                  type="number"
                  min="1"
                  max="20"
                  value={editForm.guest_count || ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, guest_count: e.target.value }))}
                  style={{ width: "100%", height: "42px", borderRadius: "10px" }}
                />
              </label>

              {/* Row 2: Requested Table + Phone */}
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>Requested Table</span>
                <select
                  className="rzv-input"
                  value={editForm.table_id || ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, table_id: e.target.value }))}
                  disabled={editTablesLoading}
                  style={{ width: "100%", height: "42px", borderRadius: "10px" }}
                >
                  <option value="">{editTablesLoading ? "Loading available tables..." : "Keep current table"}</option>
                  {editTables.map((table) => (
                    <option key={table.table_id} value={String(table.table_id)}>
                      {table.table_number} - {table.area_name} ({table.capacity} seats)
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>Contact Phone</span>
                <input
                  className="rzv-input"
                  type="tel"
                  value={editForm.contact_phone || ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, contact_phone: e.target.value }))}
                  style={{ width: "100%", height: "42px", borderRadius: "10px" }}
                />
              </label>

              {/* Row 3: Pre-order Items + Special Request */}
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>Pre-order Items</span>
                <textarea
                  className="rzv-input"
                  rows={4}
                  placeholder={"e.g.\nSushi Set x1\nLychee Martini x2"}
                  value={editForm.preorder_items_text || ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, preorder_items_text: e.target.value }))}
                  style={{ width: "100%", borderRadius: "10px", resize: "none", fontSize: "13px" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>Special Request / Purpose</span>
                <textarea
                  className="rzv-input"
                  rows={4}
                  placeholder="Anniversary, quiet corner table, birthday cake..."
                  value={editForm.special_request || ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, special_request: e.target.value }))}
                  style={{ width: "100%", borderRadius: "10px", resize: "none", fontSize: "13px" }}
                />
              </label>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24, paddingTop: 16, borderTop: "1px solid #f0f0f0" }}>
              <button type="button" className="rzv-btn rzv-btn--ghost" style={{ borderRadius: "10px", padding: "10px 20px" }} onClick={() => setEditTarget(null)}>Cancel</button>
              <button
                type="button"
                className="rzv-btn rzv-btn--solid"
                style={{ borderRadius: "10px", padding: "10px 24px" }}
                onClick={() => {
                  const requestedStart = editForm.reservation_start_at ? new Date(editForm.reservation_start_at) : null;
                  if (requestedStart && requestedStart.getTime() <= Date.now()) {
                    setEditValidationError("Please choose a future date and time. Past time slots cannot be requested.");
                    return;
                  }
                  setEditConfirm(true);
                }}
              >
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
              Staff will review the pending request and apply the change if approved. Manager Portal will keep the audit trail. Note: you may only request one edit per booking.
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

      {/* ── SePay Upgrade Payment Difference Modal ── */}
      {upgradeModal && (
        <div className="rzv-modal-overlay" style={{ background: "rgba(15, 23, 42, 0.5)", backdropFilter: "blur(8px)", zIndex: 9999 }}>
          <div className="rzv-modal" style={{ maxWidth: "460px", width: "100%", padding: "28px", backgroundColor: "#ffffff", borderRadius: "16px", boxShadow: "0 20px 40px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#d97706", letterSpacing: "0.06em" }}>
                  Area Upgrade Payment
                </span>
                <h3 style={{ margin: "2px 0 0", fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
                  Upgrade to {upgradeModal.quote.target_area_name}
                </h3>
              </div>
              <button onClick={() => setUpgradeModal(null)} style={{ background: "none", border: "none", fontSize: "18px", color: "#94a3b8", cursor: "pointer" }}>✕</button>
            </div>

            <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 16px", lineHeight: 1.5 }}>
              Your selected luxury area requires an additional table deposit. Your previous paid deposit has been credited towards this upgrade.
            </p>

            {/* Deposit offset breakdown table */}
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px 14px", marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#64748b", marginBottom: "6px" }}>
                <span>Previous Deposit Credited:</span>
                <span style={{ fontWeight: 600, color: "#166534" }}>-{upgradeModal.quote.previous_deposit_paid.toLocaleString("vi-VN")} VND</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#64748b", marginBottom: "8px" }}>
                <span>{upgradeModal.quote.target_area_name} Deposit Required:</span>
                <span style={{ fontWeight: 600, color: "#0f172a" }}>{upgradeModal.quote.new_required_deposit.toLocaleString("vi-VN")} VND</span>
              </div>
              <div style={{ borderTop: "1px dashed #cbd5e1", paddingTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>To Pay Now (Upgrade Difference):</span>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#d97706" }}>
                  {upgradeModal.quote.upgrade_amount.toLocaleString("vi-VN")} VND
                </span>
              </div>
            </div>

            {/* SePay QR Image */}
            <div style={{ textAlign: "center", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "12px", marginBottom: "16px" }}>
              <img
                src={upgradeModal.quote.sepay_qr_url}
                alt="SePay Upgrade QR"
                style={{ width: "200px", height: "200px", objectFit: "contain", margin: "0 auto", display: "block" }}
              />
              <div style={{ fontSize: "11px", color: "#64748b", marginTop: "8px", fontWeight: 500 }}>
                Scan with banking app · Order Code: <strong style="color: #0f172a">{upgradeModal.quote.upgrade_order_code}</strong>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="rzv-btn rzv-btn--ghost"
                onClick={() => setUpgradeModal(null)}
                disabled={upgradeModal.isVerifying}
                style={{ borderRadius: "8px", padding: "8px 16px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rzv-btn rzv-btn--solid"
                onClick={handleVerifyUpgradePayment}
                disabled={upgradeModal.isVerifying}
                style={{ borderRadius: "8px", padding: "8px 20px", background: "#d97706", borderColor: "#b45309" }}
              >
                {upgradeModal.isVerifying ? "Verifying Payment…" : "I Have Transferred via SePay"}
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
