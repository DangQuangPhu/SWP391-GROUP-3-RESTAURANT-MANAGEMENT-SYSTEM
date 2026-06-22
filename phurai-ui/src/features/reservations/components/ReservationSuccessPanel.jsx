function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // 24-hour format
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/**
 * Compact 2-column receipt ticket for Reservation Request Submitted.
 * Layout: Header (ID + status) + Grid (left: customer, right: booking details).
 * Rule: max-width 680px, font-size text-sm, no vertical stacking.
 */
function ReservationSuccessPanel({ reservation, onReturnHome, onViewReservation }) {
  if (!reservation) return null;

  const tables = reservation.tables || [];
  const start  = reservation.reservation_start_at;
  const end    = reservation.reservation_end_at;

  return (
    <div className="rzv-success" style={{ maxWidth: "680px", margin: "0 auto", width: "100%" }}>
      {/* Animated check icon */}
      <div className="rzv-success__check" aria-hidden>
        <svg viewBox="0 0 80 80">
          <circle className="rzv-success__check-ring" cx="40" cy="40" r="36" />
          <path className="rzv-success__check-mark" d="M24 41.5 L35 52 L57 29" />
        </svg>
      </div>

      <h1 className="rzv-success__title rzv-serif" style={{ fontSize: "1.4rem" }}>
        Reservation Confirmed!
      </h1>
      <p className="rzv-success__msg" style={{ fontSize: "0.875rem", marginBottom: "16px" }}>
        Thank you for choosing Phūrai. Your table is reserved — a confirmation email will be sent to you shortly.
      </p>

      {/* ── Receipt card ── */}
      <div
        className="rzv-success__card"
        style={{ padding: "16px 20px", textAlign: "left" }}
      >
        {/* Header row: reference ID + request time */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: "12px",
            borderBottom: "1px solid var(--border-color)",
            marginBottom: "14px",
          }}
        >
          <div>
            <span
              style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--sfx-muted)" }}
            >
              Booking Reference
            </span>
            <div
              className="sfx-mono"
              style={{ fontWeight: 700, fontSize: "1.15rem", color: "var(--sfx-gold)" }}
            >
              #{String(reservation.reservation_id).padStart(6, "0")}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <span
              style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--sfx-muted)" }}
            >
              Confirmed
            </span>
            <div className="sfx-mono" style={{ fontSize: "13px" }}>
              {reservation.created_at
                ? new Date(reservation.created_at).toLocaleString("vi-VN", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })
                : new Date().toLocaleString("vi-VN", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
            </div>
          </div>
        </div>

        {/* ── 2-column grid ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px 24px",
            fontSize: "13px",
          }}
        >
          {/* ── Left column: Customer Profile ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span
              style={{
                fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.07em",
                color: "var(--sfx-muted)", fontWeight: 600, marginBottom: "2px",
              }}
            >
              Customer Profile
            </span>

            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <Row label="Name" value={reservation.customer_name || reservation.guest_name || "—"} />
              <Row
                label="Phone"
                value={reservation.customer_phone || reservation.guest_phone || "—"}
                mono
              />
              <Row
                label="Email"
                value={reservation.customer_email || reservation.guest_email || "—"}
              />
            </div>

            {/* Voucher — sits under customer info */}
            {reservation.voucher_code && (
              <div style={{ marginTop: "6px", paddingTop: "6px", borderTop: "1px dashed var(--border-color)" }}>
                <Row label="Voucher" value={reservation.voucher_code} accent />
              </div>
            )}
          </div>

          {/* ── Right column: Booking Details ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span
              style={{
                fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.07em",
                color: "var(--sfx-muted)", fontWeight: 600, marginBottom: "2px",
              }}
            >
              Booking Details
            </span>

            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <Row label="Date" value={formatDate(start)} />
              <Row
                label="Time"
                value={`${formatTime(start)}${end ? ` → ${formatTime(end)}` : ""}`}
                mono
              />
              <Row label="Guests" value={reservation.guest_count ? `${reservation.guest_count} pax` : "—"} />
              <Row
                label="Area"
                value={reservation.area_name || reservation.preferred_area || "—"}
              />
              <Row
                label="Table(s)"
                value={
                  tables.length > 0
                    ? tables.map((t) => t.display_label || t.table_number).join(", ")
                    : "Assigned"
                }
              />
            </div>
          </div>
        </div>

        {/* Pre-orders — full width below the grid */}
        {reservation.preorderItems && reservation.preorderItems.length > 0 && (
          <div
            style={{
              marginTop: "12px",
              paddingTop: "12px",
              borderTop: "1px solid var(--border-color)",
              fontSize: "13px",
            }}
          >
            <span
              style={{
                fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.07em",
                color: "var(--sfx-muted)", fontWeight: 600, display: "block", marginBottom: "6px",
              }}
            >
              Pre-ordered Items
            </span>
            <ul style={{ margin: 0, paddingLeft: "18px", lineHeight: 1.7 }}>
              {reservation.preorderItems.map((item, idx) => (
                <li key={idx}>
                  {item.dish_name || `Dish #${item.dish_id}`}{" "}
                  <strong>× {item.quantity || item.qty}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Special requests — full width */}
        {reservation.special_request && (
          <div
            style={{
              marginTop: "10px",
              paddingTop: "10px",
              borderTop: "1px solid var(--border-color)",
              fontSize: "13px",
            }}
          >
            <span
              style={{
                fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.07em",
                color: "var(--sfx-muted)", fontWeight: 600, display: "block", marginBottom: "4px",
              }}
            >
              Special Notes
            </span>
            <p
              style={{
                margin: 0, padding: "8px 10px",
                background: "var(--bg-card-alt, #f5f5f5)",
                borderRadius: "6px", lineHeight: 1.6,
              }}
            >
              {reservation.special_request}
            </p>
          </div>
        )}
      </div>

      <div className="rzv-success__actions">
        <button type="button" className="rzv-btn rzv-btn--ghost" onClick={onReturnHome}>
          Return Home
        </button>
        <button type="button" className="rzv-btn rzv-btn--solid" onClick={onViewReservation}>
          View Reservation
        </button>
      </div>
    </div>
  );
}

/* ── Tiny label/value row helper ── */
function Row({ label, value, mono, accent }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "baseline" }}>
      <span style={{ color: "var(--sfx-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>{label}:</span>
      <span
        className={mono ? "sfx-mono" : ""}
        style={{
          fontWeight: 500,
          textAlign: "right",
          color: accent ? "var(--sfx-gold)" : "inherit",
          wordBreak: "break-word",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default ReservationSuccessPanel;
