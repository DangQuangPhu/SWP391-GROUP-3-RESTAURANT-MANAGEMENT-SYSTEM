import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { formatBookingId } from "@/features/reservations/utils/formatBookingId.js";
import "../styles/gantt-timeline.css";

// ─── Status colour palette ───────────────────────────────────────────────────
const STATUS_COLOR = {
  "Confirmed":      { bg: "#dbeafe", text: "#1e40af", border: "#93c5fd" },
  "Await Check-in": { bg: "#e0f2fe", text: "#0369a1", border: "#7dd3fc" },
  "Checked In":     { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5" },
  "Dining":         { bg: "#fef3c7", text: "#92400e", border: "#fde68a" },
  "Completed":      { bg: "#f0fdf4", text: "#166534", border: "#86efac" },
  "Pending":        { bg: "#fefce8", text: "#854d0e", border: "#fef08a" },
  "No Show":        { bg: "#fef2f2", text: "#7f1d1d", border: "#fca5a5" },
  "Cancelled":      { bg: "#f9fafb", text: "#9ca3af", border: "#e5e7eb" },
};
const DEFAULT_SM = STATUS_COLOR["Confirmed"];
const CONFLICT_SM = { bg: "#fee2e2", text: "#dc2626", border: "#ef4444" };

// ─── Dining-window description (OpenTable / Resy style) ─────────────────────
// Based on the same logic used at booking creation time:
//   ≤2 guests  → 60 min  | ≤4 → 90 min | ≤6 → 105 min | 7+ → 120 min
// But we use the ACTUAL durationMinutes returned by the backend (which already
// accounts for the real reservation_end_at stored in the DB).
function diningWindowLabel(durationMinutes) {
  const h = Math.floor(durationMinutes / 60);
  const m = durationMinutes % 60;
  if (h === 0) return `${m} min dining window`;
  if (m === 0) return `${h}h dining window`;
  return `${h}h ${m}m dining window`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function parseTimeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = String(t).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function pad2(n) { return String(n).padStart(2, "0"); }
function minsToLabel(m) { return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`; }

// ─── SVG Icons ───────────────────────────────────────────────────────────────
function IconRefresh({ spinning }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className={spinning ? "apple-spin-active" : ""}
      style={{ display: "inline-block", flexShrink: 0 }}>
      <path d="M21.5 2v6h-6"/><path d="M2.5 22v-6h6"/>
      <path d="M2 11.5a10 10 0 0 1 18.8-4.3L21.5 8"/>
      <path d="M22 12.5a10 10 0 0 1-18.8 4.3L2.5 16"/>
    </svg>
  );
}
function IconSearch() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
      <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
    </svg>
  );
}

// ─── Rich Hover Tooltip ───────────────────────────────────────────────────────
function ReservationTooltip({ r, x, y, visible }) {
  if (!visible || !r) return null;
  const sm = r.is_conflict ? CONFLICT_SM : (STATUS_COLOR[r.reservation_status] || DEFAULT_SM);
  const left = Math.min(x + 16, window.innerWidth - 310);
  const top  = Math.min(y + 14, window.innerHeight - 340);
  const durMins = r.durationMinutes || 90;

  return (
    <div style={{
      position: "fixed", left, top, zIndex: 99999,
      width: 296, background: "#fff",
      border: "1px solid #e2e8f0", borderRadius: "12px",
      boxShadow: "0 12px 36px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
      pointerEvents: "none",
      fontFamily: "'Inter', sans-serif",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ padding: "10px 14px", background: sm.bg, borderBottom: `2px solid ${sm.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "13px", fontWeight: 800, color: sm.text }}>
          Reservation {formatBookingId(r.reservation_id)}
        </span>
        <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", background: "rgba(255,255,255,0.7)", color: sm.text, border: `1px solid ${sm.border}` }}>
          {r.is_conflict ? "⚠ CONFLICT" : r.reservation_status}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: "11px 14px", display: "flex", flexDirection: "column", gap: "6px" }}>
        {/* Timing block */}
        <div style={{ padding: "8px 10px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "2px" }}>
          <div style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.01em" }}>
            {r.start_time} – {r.end_time}
          </div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px", fontWeight: 500 }}>
            {diningWindowLabel(durMins)} · booked via system
          </div>
        </div>

        <TRow label="Guest"      value={r.contact_name} />
        <TRow label="Phone"      value={r.contact_phone || "—"} />
        <TRow label="Party"      value={`${r.guest_count} guests`} />
        <TRow label="Table"      value={r.table_number ? `Table ${r.table_number}` : "Unassigned"} />
        <TRow label="Area"       value={r.area_name || "—"} />
        {r.dining_purpose && <TRow label="Purpose" value={r.dining_purpose} />}

        {r.special_request && (
          <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "7px", marginTop: "2px" }}>
            <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600, marginBottom: "2px" }}>Special Request</div>
            <div style={{ fontSize: "12px", color: "#374151", lineHeight: 1.5 }}>{r.special_request}</div>
          </div>
        )}

        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "5px", marginTop: "2px", fontSize: "11px", color: "#94a3b8", textAlign: "right" }}>
          Click to open invoice
        </div>
      </div>
    </div>
  );
}
function TRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px" }}>
      <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: "12px", color: "#0f172a", fontWeight: 500, textAlign: "right" }}>{value}</span>
    </div>
  );
}

// ─── Constants ───────────────────────────────────────────────────────────────
const LEFT_COL_W  = 170;
const PX_PER_HOUR = 120;          // 120px per hour = 2px per minute
const PX_PER_MIN  = PX_PER_HOUR / 60; // = 2.0 px/min
const ROW_HEIGHT  = 64;

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TimelineGanttView({ date, onDateChange, onSelectReservation, onQuickBookTable }) {
  const today = new Date().toISOString().split("T")[0];
  const effectiveDate = date || today;

  const axisRef = useRef(null);
  const bodyRef = useRef(null);

  const [loading,  setLoading]  = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [data, setData] = useState({
    operating_hours: { open_time: "11:00", close_time: "23:00" },
    tables: [], reservations: [], unassigned_bench: [], conflict_count: 0,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [tooltip, setTooltip] = useState({ visible: false, r: null, x: 0, y: 0 });

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async (d) => {
    setLoading(true); setSpinning(true);
    try {
      const res = await fetch(`/api/staff/tables/timeline?date=${d}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json?.success && json.data) setData(json.data);
    } catch (err) {
      console.error("[Timeline] fetch error:", err);
    } finally {
      setLoading(false);
      setTimeout(() => setSpinning(false), 280);
    }
  }, []);

  useEffect(() => { fetchData(effectiveDate); }, [effectiveDate, fetchData]);

  // Sync axis scroll with body
  useEffect(() => {
    const body = bodyRef.current, axis = axisRef.current;
    if (!body || !axis) return;
    const sync = () => { axis.scrollLeft = body.scrollLeft; };
    body.addEventListener("scroll", sync, { passive: true });
    return () => body.removeEventListener("scroll", sync);
  }, [loading]);

  // ── Operating hours ───────────────────────────────────────────────────────
  const openMins  = useMemo(() => parseTimeToMinutes(data.operating_hours?.open_time  || "11:00"), [data.operating_hours]);
  const closeMins = useMemo(() => {
    let m = parseTimeToMinutes(data.operating_hours?.close_time || "23:00");
    return m <= openMins ? openMins + 720 : m;
  }, [data.operating_hours, openMins]);
  const totalMins    = useMemo(() => Math.max(120, closeMins - openMins), [openMins, closeMins]);
  const GRID_TOTAL_PX = Math.ceil(totalMins * PX_PER_MIN);

  const timeMarkers = useMemo(() => {
    const ms = [];
    let cur = Math.ceil(openMins / 60) * 60;
    while (cur <= closeMins) { ms.push(cur); cur += 60; }
    return ms;
  }, [openMins, closeMins]);

  // ── Grouped data ──────────────────────────────────────────────────────────
  const areas = useMemo(() => {
    const map = {};
    (data.tables || []).forEach((t) => {
      const k = t.area_name || "Standard Area";
      if (!map[k]) map[k] = [];
      map[k].push(t);
    });
    return map;
  }, [data.tables]);

  const resByTable = useMemo(() => {
    const m = {};
    (data.reservations || []).forEach((r) => {
      if (r.table_id) { if (!m[r.table_id]) m[r.table_id] = []; m[r.table_id].push(r); }
    });
    return m;
  }, [data.reservations]);

  // ── Search / highlight ────────────────────────────────────────────────────
  const nq = searchQuery.trim().toLowerCase().replace(/^#/, "");
  const matchedIds = useMemo(() => {
    if (!nq) return new Set();
    const set = new Set();
    (data.reservations || []).forEach((r) => {
      const id   = String(r.reservation_id);
      const fmtId = formatBookingId(r.reservation_id).toLowerCase();
      const name  = (r.contact_name || "").toLowerCase();
      if (id.includes(nq) || fmtId.includes(nq) || name.includes(nq)) set.add(r.reservation_id);
    });
    return set;
  }, [nq, data.reservations]);
  const hasSearch  = nq.length > 0;
  const matchCount = matchedIds.size;

  // ── Tooltip handlers ──────────────────────────────────────────────────────
  const showTip  = useCallback((r, e) => setTooltip({ visible: true,  r, x: e.clientX, y: e.clientY }), []);
  const moveTip  = useCallback((e)    => setTooltip(p => ({ ...p, x: e.clientX, y: e.clientY })),       []);
  const hideTip  = useCallback(()     => setTooltip(p => ({ ...p, visible: false })),                    []);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: "#0f172a" }} onMouseLeave={hideTip}>

      <ReservationTooltip {...tooltip} />

      {/* ── Controls Bar ─────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", flexWrap: "wrap", justifyContent: "space-between",
        alignItems: "center", gap: "10px",
        padding: "10px 16px",
        background: "#fff", border: "1px solid #e2e8f0",
        borderRadius: "12px", boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
        marginBottom: "12px",
      }}>
        {/* Left: Date + Today + Search */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748b" }}>Date:</span>
          <input type="date" value={effectiveDate}
            onChange={(e) => onDateChange?.(e.target.value)}
            style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "5px 10px", fontSize: "13px", fontWeight: 600, color: "#0f172a", cursor: "pointer" }}
          />
          <button type="button" className="apple-btn-interactive"
            onClick={() => onDateChange?.(today)}
            style={{ padding: "5px 12px", borderRadius: "8px", background: "#f1f5f9", border: "1px solid #cbd5e1", color: "#0f172a", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
            Today
          </button>

          {/* Search */}
          <div style={{ position: "relative" }}>
            <IconSearch />
            <input type="text" placeholder="ID or guest name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                paddingLeft: 30, paddingRight: searchQuery ? 26 : 10,
                paddingTop: 5, paddingBottom: 5,
                borderRadius: "8px",
                border: `1px solid ${hasSearch ? "#6366f1" : "#cbd5e1"}`,
                background: hasSearch ? "#eef2ff" : "#f8fafc",
                fontSize: "13px", color: "#0f172a", outline: "none", width: 190,
                boxShadow: hasSearch ? "0 0 0 3px rgba(99,102,241,0.12)" : "none",
                transition: "all 0.15s ease",
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")}
                style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "13px", lineHeight: 1, padding: 0 }}>
                ✕
              </button>
            )}
          </div>
          {hasSearch && (
            <span style={{ fontSize: "12px", fontWeight: 700, padding: "3px 9px", borderRadius: "20px", background: matchCount > 0 ? "#eef2ff" : "#fef2f2", color: matchCount > 0 ? "#4f46e5" : "#dc2626", border: `1px solid ${matchCount > 0 ? "#c7d2fe" : "#fca5a5"}` }}>
              {matchCount > 0 ? `${matchCount} match${matchCount > 1 ? "es" : ""}` : "No match"}
            </span>
          )}
        </div>

        {/* Right: Metrics + Refresh */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "12px", color: data.conflict_count > 0 ? "#dc2626" : "#64748b", fontWeight: 600, padding: "4px 10px", borderRadius: "8px", background: data.conflict_count > 0 ? "#fef2f2" : "#f8fafc", border: `1px solid ${data.conflict_count > 0 ? "#fca5a5" : "#e2e8f0"}` }}>
            Conflicts: <strong>{data.conflict_count}</strong>
          </span>
          <span style={{ fontSize: "12px", color: "#1e40af", fontWeight: 600, padding: "4px 10px", borderRadius: "8px", background: "#eff6ff", border: "1px solid #bfdbfe" }}>
            Unassigned: <strong>{(data.unassigned_bench||[]).length}</strong>
          </span>
          <button type="button" className="apple-btn-interactive"
            onClick={() => fetchData(effectiveDate)}
            style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "5px 12px", borderRadius: "8px", background: "#f8fafc", border: "1px solid #cbd5e1", color: "#0f172a", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
            <IconRefresh spinning={spinning} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Unassigned Bench ──────────────────────────────────────────────── */}
      {(data.unassigned_bench||[]).length > 0 && (
        <div style={{ marginBottom: "12px", padding: "10px 14px", background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#1e40af" }}>Unassigned Bench</span>
            <span style={{ fontSize: "12px", color: "#64748b" }}>— no table assigned yet</span>
          </div>
          <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "2px" }}>
            {data.unassigned_bench.map((r) => {
              const sm = STATUS_COLOR[r.reservation_status] || DEFAULT_SM;
              const isMatch = hasSearch && matchedIds.has(r.reservation_id);
              return (
                <div key={r.reservation_id}
                  className="apple-btn-interactive"
                  onClick={() => onSelectReservation?.(r.reservation_id)}
                  onMouseEnter={(e) => showTip(r, e)} onMouseMove={moveTip} onMouseLeave={hideTip}
                  style={{ flexShrink: 0, minWidth: 190, padding: "8px 12px", background: isMatch ? "#eef2ff" : "#fff", borderRadius: "8px", border: `1.5px solid ${isMatch ? "#6366f1" : sm.border}`, cursor: "pointer" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>{formatBookingId(r.reservation_id)} · {r.contact_name}</div>
                  <div style={{ fontSize: "11px", color: "#64748b", display: "flex", gap: "6px", marginTop: "2px" }}>
                    <span>{r.start_time} – {r.end_time}</span>
                    <span>{r.guest_count}p</span>
                    <span style={{ color: sm.text, background: sm.bg, padding: "0 5px", borderRadius: "4px", fontWeight: 600 }}>{r.reservation_status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Gantt Matrix ──────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ padding: "48px 0", textAlign: "center", color: "#94a3b8", fontSize: "14px", fontWeight: 500, background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px" }}>
          Loading timeline for {effectiveDate}…
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", overflow: "hidden" }}>

          {/* Sticky header */}
          <div style={{ display: "flex", background: "#f1f5f9", borderBottom: "2px solid #e2e8f0", position: "sticky", top: 0, zIndex: 20 }}>
            <div style={{ flexShrink: 0, width: LEFT_COL_W, padding: "8px 14px", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", borderRight: "1px solid #cbd5e1", background: "#f1f5f9" }}>
              TABLE / AREA
            </div>
            <div ref={axisRef} style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ position: "relative", width: GRID_TOTAL_PX, height: "36px" }}>
                {timeMarkers.map((mins) => (
                  <div key={mins} style={{ position: "absolute", left: (mins - openMins) * PX_PER_MIN, top: 0, bottom: 0, display: "flex", alignItems: "center", paddingLeft: 6, fontSize: "12px", fontWeight: 700, color: "#475569", borderLeft: "1px solid #e2e8f0", userSelect: "none" }}>
                    {minsToLabel(mins)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Scrollable body */}
          <div ref={bodyRef} style={{ overflowX: "auto", maxHeight: "60vh", overflowY: "auto" }}>
            <div style={{ width: LEFT_COL_W + GRID_TOTAL_PX, flexShrink: 0 }}>
              {Object.entries(areas).map(([areaName, areaTables]) => (
                <div key={areaName}>
                  {/* Area header — spans full width with sticky text */}
                  <div style={{ display: "flex", background: "#fef8ee", borderBottom: "1px solid #fde68a", borderTop: "1px solid #fde68a", width: "100%" }}>
                    <div style={{ position: "sticky", left: 0, padding: "6px 14px", fontSize: "11px", fontWeight: 800, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.06em", background: "#fef8ee", zIndex: 6, display: "inline-block" }}>
                      {areaName} ({areaTables.length} tables)
                    </div>
                  </div>

                  {/* Table rows */}
                  {areaTables.map((table) => {
                    const rows = resByTable[table.table_id] || [];
                    const rowMatch = hasSearch && rows.some(r => matchedIds.has(r.reservation_id));
                    const closingBufferStartMins = closeMins - 60; // 1h before closing

                    return (
                      <div key={table.table_id} className="gantt-table-row"
                        style={{ display: "flex", borderBottom: "1px solid #f1f5f9", height: ROW_HEIGHT }}>

                        {/* Left sticky label */}
                        <div style={{
                          flexShrink: 0, width: LEFT_COL_W,
                          padding: "8px 14px", boxSizing: "border-box",
                          background: rowMatch ? "#fffbeb" : "#f8fafc",
                          borderRight: `2px solid ${rowMatch ? "#fbbf24" : "#e2e8f0"}`,
                          position: "sticky", left: 0, zIndex: 5,
                          display: "flex", flexDirection: "column", justifyContent: "center",
                        }}>
                          <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", lineHeight: 1.2 }}>
                            Table {table.table_number}
                          </div>
                          <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                            {table.capacity} seats · {table.table_status}
                          </div>
                          {rowMatch && <div style={{ fontSize: "10px", fontWeight: 700, color: "#d97706", marginTop: "1px" }}>↳ match</div>}
                        </div>

                        {/* Gantt track */}
                        <div
                          style={{ position: "relative", width: GRID_TOTAL_PX, flexShrink: 0, height: "100%" }}
                          onClick={(e) => {
                            if (e.target !== e.currentTarget) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickX = e.clientX - rect.left;
                            const clickMins = openMins + (clickX / PX_PER_MIN);
                            if (clickMins >= closingBufferStartMins) {
                              alert("🔒 Reservations close 1 hour prior to closing time (22:00 – 23:00). No new bookings accepted.");
                              return;
                            }
                            onQuickBookTable?.(table.table_id);
                          }}
                        >
                          {/* Hour grid lines */}
                          {timeMarkers.map((mins) => (
                            <div key={mins} style={{ position: "absolute", left: (mins - openMins) * PX_PER_MIN, top: 0, bottom: 0, width: "1px", background: "#e2e8f0", pointerEvents: "none" }} />
                          ))}

                          {/* 1-Hour Closing Buffer Zone (Stripped Pattern) */}
                          <div
                            title="🔒 Closing Buffer: No new reservations accepted within 1 hour of closing"
                            style={{
                              position: "absolute",
                              left: (closingBufferStartMins - openMins) * PX_PER_MIN,
                              width: 60 * PX_PER_MIN,
                              top: 0, bottom: 0,
                              background: "repeating-linear-gradient(45deg, rgba(241,245,249,0.7), rgba(241,245,249,0.7) 10px, rgba(226,232,240,0.7) 10px, rgba(226,232,240,0.7) 20px)",
                              borderLeft: "1.5px dashed #cbd5e1",
                              pointerEvents: "none",
                              zIndex: 1,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <span style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", background: "rgba(255,255,255,0.85)", padding: "2px 6px", borderRadius: "4px" }}>
                              🔒 Closing Buffer
                            </span>
                          </div>

                        {/* Reservation blocks — width proportional to actual dining duration */}
                        {rows.map((r) => {
                          const startM  = parseTimeToMinutes(r.start_time);
                          const endM    = parseTimeToMinutes(r.end_time);
                          const durMins = r.durationMinutes || (endM > startM ? endM - startM : 90);

                          const cStart  = Math.max(openMins, startM);
                          const cEnd    = Math.min(closeMins, startM + durMins);
                          const leftPx  = (cStart - openMins) * PX_PER_MIN;
                          // Width = exact pixel span of the dining window — no artificial minimum
                          // so a 90-min block = 3 × 60px columns, a 60-min block = 2 columns, etc.
                          const widthPx = Math.max(4, (cEnd - cStart) * PX_PER_MIN);

                          const sm = r.is_conflict ? CONFLICT_SM : (STATUS_COLOR[r.reservation_status] || DEFAULT_SM);
                          const isMatch  = hasSearch && matchedIds.has(r.reservation_id);
                          const isDimmed = hasSearch && !isMatch;

                          // Concise inline text: ID + name (formatBookingId already includes #)
                          const blockText = `${formatBookingId(r.reservation_id)} ${r.contact_name}`;

                          return (
                            <div
                              key={r.reservation_id}
                              className={`gantt-reservation-block${r.is_conflict ? " is-conflict" : ""}`}
                              onClick={(e) => { e.stopPropagation(); onSelectReservation?.(r.reservation_id); }}
                              onMouseEnter={(e) => showTip(r, e)}
                              onMouseMove={moveTip}
                              onMouseLeave={hideTip}
                              style={{
                                position: "absolute",
                                left: leftPx,
                                width: widthPx,
                                top: 8, bottom: 8,
                                borderRadius: "7px",
                                background: sm.bg,
                                color: sm.text,
                                border: isMatch ? "2px solid #6366f1" : `1px solid ${sm.border}`,
                                boxShadow: isMatch
                                  ? "0 0 0 3px rgba(99,102,241,0.18), 0 2px 6px rgba(0,0,0,0.08)"
                                  : r.is_conflict
                                    ? "0 0 8px rgba(239,68,68,0.4)"
                                    : "0 1px 4px rgba(0,0,0,0.06)",
                                opacity: isDimmed ? 0.22 : 1,
                                padding: "4px 8px",
                                boxSizing: "border-box",
                                cursor: "pointer",
                                zIndex: isMatch ? 15 : r.is_conflict ? 10 : 2,
                                overflow: "hidden",
                                transition: "opacity 0.15s ease, box-shadow 0.15s ease",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "center",
                              }}
                            >
                              {/* Line 1: ID + name */}
                              <div style={{ fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {blockText}
                              </div>
                              {/* Line 2: time range + guest count (only if block wide enough) */}
                              {widthPx > 90 && (
                                <div style={{ fontSize: "10px", fontWeight: 500, opacity: 0.75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: "1px" }}>
                                  {r.start_time}–{r.end_time} · {r.guest_count}p · {diningWindowLabel(durMins)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
