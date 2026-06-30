/**
 * AddWalkInModal — Staff Portal
 *
 * Collects: Full Name (required), Phone (required), Email (optional),
 *           Guest Count (required, 1–50), Table (required — only Available tables shown).
 *
 * Business rules enforced:
 *   - No deposit field
 *   - No voucher / promo code field
 *   - Table dropdown filters to Available only
 *   - On success → parent refreshes list via socket (no manual reload needed)
 */
import React, { useEffect, useRef, useState } from "react";
import { fetchStaffTables, createWalkInReservation } from "../services/staffApi.js";
import "./AddWalkInModal.css";

const FIELD_RULES = {
  contact_name:  { label: "Full Name",     required: true,  min: 2,  max: 100, type: "text",  placeholder: "e.g. Nguyen Van An" },
  contact_phone: { label: "Phone Number",  required: true,  min: 8,  max: 20,  type: "tel",   placeholder: "e.g. 0901234567" },
  contact_email: { label: "Email",         required: false, min: 0,  max: 100, type: "email", placeholder: "Optional" },
  guest_count:   { label: "Guest Count",   required: true,  min: 1,  max: 50,  type: "number",placeholder: "Number of guests" },
};

function validate(fields) {
  const errors = {};
  if (!fields.contact_name?.trim() || fields.contact_name.trim().length < 2) {
    errors.contact_name = "Full name is required (min 2 characters).";
  }
  if (!fields.contact_phone?.trim() || fields.contact_phone.trim().length < 8) {
    errors.contact_phone = "Valid phone number is required.";
  }
  if (fields.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.contact_email)) {
    errors.contact_email = "Enter a valid email address.";
  }
  const gc = parseInt(fields.guest_count, 10);
  if (!gc || gc < 1 || gc > 50) {
    errors.guest_count = "Guest count must be between 1 and 50.";
  }
  if (!fields.table_id) {
    errors.table_id = "Please select an available table.";
  }
  return errors;
}

export default function AddWalkInModal({ user, toast, onClose, onCreated }) {
  const userId = user?.userId ?? user?.user_id ?? user?.id;
  const modalRef = useRef(null);

  const [fields, setFields] = useState({
    contact_name:  "",
    contact_phone: "",
    contact_email: "",
    guest_count:   "2",
    table_id:      "",
  });
  const [errors,       setErrors]       = useState({});
  const [tables,       setTables]       = useState([]);
  const [loadingTables,setLoadingTables]= useState(true);
  const [submitting,   setSubmitting]   = useState(false);

  // Load available tables on mount
  useEffect(() => {
    setLoadingTables(true);
    fetchStaffTables(userId)
      .then((res) => {
        const all = Array.isArray(res?.data) ? res.data : [];
        setTables(all.filter((t) => t.table_status === "Available" && !t.is_counter));
      })
      .catch(() => setTables([]))
      .finally(() => setLoadingTables(false));
  }, [userId]);

  // Trap focus + close on Escape
  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;
    el.focus();
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function setField(key, val) {
    setFields((f) => ({ ...f, [key]: val }));
    if (errors[key]) setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate(fields);
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSubmitting(true);
    try {
      const result = await createWalkInReservation(userId, {
        contact_name:  fields.contact_name.trim(),
        contact_phone: fields.contact_phone.trim(),
        contact_email: fields.contact_email.trim() || null,
        guest_count:   parseInt(fields.guest_count, 10),
        table_id:      parseInt(fields.table_id, 10),
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

  return (
    <div className="walkin-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="walkin-modal" role="dialog" aria-modal="true" aria-label="Add Walk-in Guest" ref={modalRef} tabIndex={-1}>

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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Form */}
        <form className="walkin-modal__form" onSubmit={handleSubmit} noValidate>

          {/* Section: Guest Info */}
          <div className="walkin-form__section">
            <p className="walkin-form__section-label">Guest Information</p>
            <div className="walkin-form__grid">
              {["contact_name", "contact_phone"].map((key) => {
                const rule = FIELD_RULES[key];
                return (
                  <div key={key} className={`walkin-form__field${errors[key] ? " is-error" : ""}`}>
                    <label className="walkin-form__label">
                      {rule.label}
                      {rule.required && <span className="walkin-form__required">*</span>}
                    </label>
                    <input
                      className="walkin-form__input"
                      type={rule.type}
                      value={fields[key]}
                      onChange={(e) => setField(key, e.target.value)}
                      placeholder={rule.placeholder}
                      maxLength={rule.max}
                      autoComplete={key === "contact_phone" ? "tel" : "name"}
                    />
                    {errors[key] && <p className="walkin-form__error">{errors[key]}</p>}
                  </div>
                );
              })}
            </div>

            <div className="walkin-form__grid walkin-form__grid--2col">
              {/* Email — optional */}
              <div className={`walkin-form__field${errors.contact_email ? " is-error" : ""}`}>
                <label className="walkin-form__label">Email <span className="walkin-form__optional">(optional)</span></label>
                <input
                  className="walkin-form__input"
                  type="email"
                  value={fields.contact_email}
                  onChange={(e) => setField("contact_email", e.target.value)}
                  placeholder="Optional"
                  maxLength={100}
                  autoComplete="email"
                />
                {errors.contact_email && <p className="walkin-form__error">{errors.contact_email}</p>}
              </div>

              {/* Guest count */}
              <div className={`walkin-form__field${errors.guest_count ? " is-error" : ""}`}>
                <label className="walkin-form__label">Guest Count <span className="walkin-form__required">*</span></label>
                <input
                  className="walkin-form__input"
                  type="number"
                  min={1} max={50}
                  value={fields.guest_count}
                  onChange={(e) => setField("guest_count", e.target.value)}
                  placeholder="Number of guests"
                />
                {errors.guest_count && <p className="walkin-form__error">{errors.guest_count}</p>}
              </div>
            </div>
          </div>

          {/* Section: Table */}
          <div className="walkin-form__section">
            <p className="walkin-form__section-label">Select Table</p>
            <div className={`walkin-form__field${errors.table_id ? " is-error" : ""}`}>
              {loadingTables ? (
                <div className="walkin-form__table-loading">Loading available tables…</div>
              ) : tables.length === 0 ? (
                <div className="walkin-form__no-tables">No available tables at this moment.</div>
              ) : (
                <div className="walkin-table-grid">
                  {tables.map((t) => (
                    <button
                      key={t.table_id}
                      type="button"
                      className={`walkin-table-tile${fields.table_id === String(t.table_id) ? " is-selected" : ""}`}
                      onClick={() => setField("table_id", String(t.table_id))}
                    >
                      <span className="walkin-table-tile__name">{t.table_name || t.table_number}</span>
                      <span className="walkin-table-tile__area">{t.area_name || ""}</span>
                      {t.capacity && (
                        <span className="walkin-table-tile__cap">{t.capacity} seats</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {errors.table_id && <p className="walkin-form__error" style={{ marginTop: 8 }}>{errors.table_id}</p>}
            </div>
          </div>

          {/* Walk-in badge notice */}
          <div className="walkin-notice">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
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
}
