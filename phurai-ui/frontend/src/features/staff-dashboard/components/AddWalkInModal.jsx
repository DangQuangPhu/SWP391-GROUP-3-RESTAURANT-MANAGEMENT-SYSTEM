/**
 * AddWalkInModal — Staff Portal
 *
 * Collects: Full Name (required), Phone (optional), Email (required — for e-receipt),
 *           Guest Count (required, 1–50), Table (required — only Available selectable).
 *
 * Business rules enforced:
 *   - No deposit, no voucher/promo code
 *   - Email is MANDATORY — used to dispatch e-receipt after payment
 *   - Table selected via the shared Customer Floor Plan (TableBoard) via portal
 *   - On success → parent refreshes list via socket (no manual reload needed)
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LayoutGrid, X, Check, ChevronRight } from "lucide-react";
import TableBoard from "@/features/reservations/components/choose-table/TableBoard.jsx";
import { createWalkInReservation } from "../services/staffApi.js";
import { formatTimeForInput, getDefaultErtDurationMin } from "../utils/ertConfig.js";
import "../styles/AddWalkInModal.css";

// ─── Field config ────────────────────────────────────────────────────────────
const FIELD_RULES = {
  contact_name:  { label: "Full Name",    required: true,  max: 100, type: "text",   placeholder: "e.g. Nguyen Van An",      autoComplete: "name" },
  contact_phone: { label: "Phone Number", required: true,  max: 20,  type: "tel",    placeholder: "e.g. 0901234567",        autoComplete: "tel" },
  contact_email: { label: "Email",        required: true,  max: 100, type: "email",  placeholder: "e.g. guest@example.com", autoComplete: "email" },
  guest_count:   { label: "Guest Count",  required: true,  max: 3,   type: "number", placeholder: "e.g. 2",                 autoComplete: "off" },
};

// ─── Adapt staff API rows → TableBoard's expected shape ──────────────────────
// TableBoard uses `is_bookable` + `availability_at_slot` for status.
// Staff API returns `table_status` directly ("Available", "Occupied", etc.).
function adaptForTableBoard(staffTable) {
  const isAvailable = staffTable.table_status === "Available";
  return {
    ...staffTable,
    is_bookable: isAvailable,
    availability_at_slot: isAvailable ? "Available" : staffTable.table_status,
  };
}

// ─── Validation ──────────────────────────────────────────────────────────────
function validate(fields) {
  const errors = {};
  if (!fields.contact_name?.trim() || fields.contact_name.trim().length < 2) {
    errors.contact_name = "Full name is required (min 2 characters).";
  }
  if (!fields.contact_phone?.trim() || fields.contact_phone.trim().length < 8) {
    errors.contact_phone = "A valid phone number is required.";
  }
  if (!fields.contact_email?.trim()) {
    errors.contact_email = "Email address is required for e-receipt delivery.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.contact_email.trim())) {
    errors.contact_email = "Please enter a valid email address.";
  }
  const gc = parseInt(fields.guest_count, 10);
  if (!gc || gc < 1 || gc > 50) {
    errors.guest_count = "Guest count must be between 1 and 50.";
  }
  if (!fields.start_time) {
    errors.start_time = "Start time is required.";
  }
  if (!Array.isArray(fields.table_ids) || fields.table_ids.length === 0) {
    errors.table_id = "Please select enough tables using the floor plan.";
  }
  return errors;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function AddWalkInModal({ user, toast, onClose, onCreated, initialTableId = "" }) {
  const userId = user?.userId ?? user?.user_id ?? user?.id;
  const modalRef = useRef(null);

  const getNowDate = () => new Date();

  const getNowTimeString = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const [fields, setFields] = useState({
    contact_name:  "",
    contact_phone: "",
    contact_email: "",
    guest_count:   "2",
    table_id:      initialTableId ? String(initialTableId) : "",
    table_ids:     initialTableId ? [Number(initialTableId)] : [],
    start_time:    getNowTimeString(),
  });
  const [seatedAt, setSeatedAt] = useState(() => getNowDate());
  const [errors,        setErrors]        = useState({});
  const [allTables,     setAllTables]     = useState([]);
  const [loadingTables, setLoadingTables] = useState(true);
  const [submitting,    setSubmitting]    = useState(false);
  const [showFloorPlan, setShowFloorPlan] = useState(false);

  // Fetch tables according to the chosen time slot and guest count
  useEffect(() => {
    let active = true;
    
    // Set loading asynchronously to avoid synchronous effect warnings
    const timer = setTimeout(() => {
      if (active) setLoadingTables(true);
    }, 0);

    const duration = getDefaultErtDurationMin(fields.guest_count);

    const todayStr = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
    const url = `/api/reservations/availability?date=${todayStr}&time=${fields.start_time}&durationMinutes=${duration}&guestCount=${parseInt(fields.guest_count, 10) || 1}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (active) {
          if (data.success && Array.isArray(data.tables)) {
            const mapped = data.tables
              .filter((t) => !t.is_counter)
              .map((t) => ({
                ...t,
                table_status: t.availability_at_slot === "Available" ? "Available" : t.availability_at_slot,
              }));
            setAllTables(mapped);
          } else {
            setAllTables([]);
          }
        }
      })
      .catch(() => {
        if (active) setAllTables([]);
      })
      .finally(() => {
        clearTimeout(timer);
        if (active) setLoadingTables(false);
      });

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [fields.start_time, fields.guest_count]);

  // Trap focus + Escape
  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;
    el.focus();
    const onKeyDown = (e) => { if (e.key === "Escape" && !showFloorPlan) onClose(); };
    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, [onClose, showFloorPlan]);

  // Lock body scroll when floor plan is open
  useEffect(() => {
    if (showFloorPlan) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [showFloorPlan]);

  function setField(key, val) {
    setFields((f) => ({ ...f, [key]: val }));
    if (errors[key]) setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  }

  // The currently-selected table object (for display)
  const selectedTableData = allTables.find((t) => String(t.table_id) === String(fields.table_id));
  const selectedTableDataList = allTables.filter((t) => fields.table_ids.map(String).includes(String(t.table_id)));
  const selectedCapacity = selectedTableDataList.reduce((sum, table) => sum + Number(table.capacity || 0), 0);
  const estimatedDurationMin = getDefaultErtDurationMin(
    fields.guest_count,
    selectedTableData?.area_name
  );
  const estimatedReleaseAt = new Date(seatedAt.getTime() + estimatedDurationMin * 60000);

  // TableBoard-adapted table list
  const adaptedTables = allTables.map(adaptForTableBoard);

  function handleTableSelect(tableIds) {
    const ids = (Array.isArray(tableIds) ? tableIds : [tableIds]).map(Number).filter(Number.isFinite);
    setFields((previous) => ({ ...previous, table_ids: ids, table_id: ids[0] ? String(ids[0]) : "" }));
    if (errors.table_id) setErrors((previous) => { const next = { ...previous }; delete next.table_id; return next; });
    setShowFloorPlan(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate(fields);
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSubmitting(true);
    try {
      const now = getNowDate();
      setSeatedAt(now);
      const result = await createWalkInReservation(userId, {
        contact_name:  fields.contact_name.trim(),
        contact_phone: fields.contact_phone.trim() || null,
        contact_email: fields.contact_email.trim(),
        guest_count:   parseInt(fields.guest_count, 10),
        table_id:      parseInt(fields.table_id, 10),
        table_ids:     fields.table_ids,
      });
      toast(result.message || "Walk-in created successfully.", "success");
      onCreated?.(result);
      onClose();
    } catch (err) {
      toast(err.message || "Failed to create walk-in.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Walk-in form modal ───────────────────────────────────────────────────
  const modalJsx = (
    <div className="walkin-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="walkin-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Add Walk-in Guest"
        ref={modalRef}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="walkin-modal__header">
          <div className="walkin-modal__header-left">
            <div className="walkin-modal__title-group">
              <span className="walkin-modal__badge">Walk-in</span>
              <h2 className="walkin-modal__title">Add Walk-in Guest</h2>
            </div>
            <p className="walkin-modal__subtitle">No deposit · No promo code · Immediate table assignment</p>
          </div>
          <button className="walkin-modal__close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form className="walkin-modal__form" onSubmit={handleSubmit} noValidate>

          {/* Section: Guest Info */}
          <div className="walkin-form__section">
            <p className="walkin-form__section-label">Guest Information</p>

            {/* Row 1: Name + Phone side by side */}
            <div className="walkin-form__grid">
              {["contact_name", "contact_phone"].map((key) => {
                const rule = FIELD_RULES[key];
                return (
                  <div key={key} className={`walkin-form__field${errors[key] ? " is-error" : ""}`}>
                    <label className="walkin-form__label">
                      {rule.label}
                      {rule.required && <span className="walkin-form__required">*</span>}
                      {!rule.required && <span className="walkin-form__optional"> (optional)</span>}
                    </label>
                    <input
                      className="walkin-form__input"
                      type={rule.type}
                      value={fields[key]}
                      onChange={(e) => setField(key, e.target.value)}
                      placeholder={rule.placeholder}
                      maxLength={rule.max}
                      autoComplete={rule.autoComplete}
                    />
                    {errors[key] && <p className="walkin-form__error">{errors[key]}</p>}
                  </div>
                );
              })}
            </div>

            {/* Row 2: Email — mandatory for e-receipt */}
            <div className={`walkin-form__field${errors.contact_email ? " is-error" : ""}`}>
              <label className="walkin-form__label">
                {FIELD_RULES.contact_email.label}
                <span className="walkin-form__required">*</span>
              </label>
              <input
                className="walkin-form__input"
                type="email"
                value={fields.contact_email}
                onChange={(e) => setField("contact_email", e.target.value)}
                placeholder={FIELD_RULES.contact_email.placeholder}
                maxLength={FIELD_RULES.contact_email.max}
                autoComplete="email"
              />
              {errors.contact_email && <p className="walkin-form__error">{errors.contact_email}</p>}
            </div>

            {/* Row 3: Guest Count & Dining Time Slot */}
            <div className="walkin-form__grid">
              <div className={`walkin-form__field${errors.guest_count ? " is-error" : ""}`}>
                <label className="walkin-form__label">
                  {FIELD_RULES.guest_count.label}
                  <span className="walkin-form__required">*</span>
                </label>
                <input
                  className="walkin-form__input"
                  type="number"
                  min={1}
                  max={50}
                  value={fields.guest_count}
                  onChange={(e) => setField("guest_count", e.target.value)}
                  placeholder={FIELD_RULES.guest_count.placeholder}
                />
                {errors.guest_count && <p className="walkin-form__error">{errors.guest_count}</p>}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className={`walkin-form__field${errors.start_time ? " is-error" : ""}`}>
                  <label className="walkin-form__label">
                    Start Time <span className="walkin-form__required">*</span>
                  </label>
                  <input
                    className="walkin-form__input"
                    type="time"
                    value={fields.start_time}
                    readOnly
                  />
                  {errors.start_time && <p className="walkin-form__error">{errors.start_time}</p>}
                </div>

                <div className={`walkin-form__field${errors.end_time ? " is-error" : ""}`}>
                  <label className="walkin-form__label">
                    Estimated Release
                  </label>
                  <input
                    className="walkin-form__input"
                    type="time"
                    value={formatTimeForInput(estimatedReleaseAt)}
                    readOnly
                  />
                  <p className="walkin-form__hint">{estimatedDurationMin} min service estimate</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Table */}
          <div className="walkin-form__section">
            <p className="walkin-form__section-label">Table Assignment</p>

            {!selectedTableDataList.length ? (
              /* ── No table selected yet ── */
              <div className={`walkin-table-picker${errors.table_id ? " is-error" : ""}`}>
                <button
                  type="button"
                  className="walkin-table-picker__btn"
                  onClick={() => setShowFloorPlan(true)}
                  disabled={loadingTables}
                >
                  <LayoutGrid size={18} className="walkin-table-picker__icon" />
                  <span>{loadingTables ? "Loading tables…" : "Select A Table"}</span>
                  <ChevronRight size={16} className="walkin-table-picker__chevron" />
                </button>
                {errors.table_id && (
                  <p className="walkin-form__error" style={{ marginTop: 8 }}>{errors.table_id}</p>
                )}
              </div>
            ) : (
              /* ── Table selected — show chip ── */
              <div className="walkin-table-selected">
                <div className="walkin-table-selected__chip">
                  <span className="walkin-table-selected__check">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <div className="walkin-table-selected__info">
                    <span className="walkin-table-selected__name">{selectedTableDataList.map((table) => table.table_name || table.table_number).join(" + ")}</span>
                    <span className="walkin-table-selected__area">{selectedCapacity} seats for {fields.guest_count} guests</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="walkin-table-selected__change"
                  onClick={() => setShowFloorPlan(true)}
                >
                  Change Table
                </button>
              </div>
            )}
          </div>

          {/* Notice */}
          <div className="walkin-notice">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>Walk-in guests are seated immediately. No deposit collected. Voucher &amp; promo codes are not applicable.</span>
          </div>

          {/* Actions */}
          <div className="walkin-modal__actions">
            <button type="button" className="walkin-btn walkin-btn--ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="walkin-btn walkin-btn--primary" disabled={submitting || loadingTables}>
              {submitting ? "Creating…" : "Confirm Walk-in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // ── Floor Plan portal — reuses exact customer TableBoard ─────────────────
  // rzv-fullscreen-content already has `animation: rzvModalPop 0.4s cubic-bezier(0.16,1,0.3,1)`
  // baked into reservation.css — Apple-eased scale-up for free.
  const floorPlanPortal = showFloorPlan && createPortal(
    <div
      className="rzv-fullscreen-overlay"
      onClick={() => setShowFloorPlan(false)}
    >
      <div
        className="rzv-fullscreen-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floor plan header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexShrink: 0 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--text-color, #0f172a)" }}>
              Choose a Table
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>
              Only available tables can be selected · {parseInt(fields.guest_count, 10) || 2} guests
            </p>
          </div>
          <button
            type="button"
            className="walkin-modal__close"
            onClick={() => setShowFloorPlan(false)}
            aria-label="Close floor plan"
          >
            <X size={18} />
          </button>
        </div>

        {/* TableBoard — exact same component used in customer flow */}
        <TableBoard
          tables={adaptedTables}
          selectedTableId={fields.table_id ? parseInt(fields.table_id, 10) : null}
          selectedTableIds={fields.table_ids}
          allowMultiple
          onApplySelection={handleTableSelect}
          onCancelSelection={() => setShowFloorPlan(false)}
          guestCount={parseInt(fields.guest_count, 10) || 2}
        />
      </div>
    </div>,
    document.body
  );

  return (
    <>
      {createPortal(modalJsx, document.body)}
      {floorPlanPortal}
    </>
  );
}
