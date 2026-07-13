/**
 * StaffSkeleton.jsx — Apple-style Skeleton Loading for /staff portal
 *
 * All transitions use Apple's signature cubic-bezier(0.16, 1, 0.3, 1).
 * Exported pieces:
 *   Bone                      — raw shimmer block
 *   KpiSkeleton               — KPI card row
 *   ReservationTableSkeleton  — full reservation list placeholder
 *   TableCardSkeleton         — floor plan tile grid placeholder
 *   SkeletonPresence          — AnimatePresence skeleton ↔ content handoff
 *   fadeScaleVariants         — shared Framer variants
 *   listContainerVariants     — stagger container
 *   listItemVariants          — stagger child (y: 20 → 0)
 */
import { motion, AnimatePresence } from "framer-motion";

/* ─── Apple easing ─────────────────────────────────────────────────────────── */
const APPLE = [0.16, 1, 0.3, 1];

/* ─── Shared Framer variants ───────────────────────────────────────────────── */
export const fadeScaleVariants = {
  hidden:  { opacity: 0, scale: 0.98 },
  visible: { opacity: 1, scale: 1,    transition: { ease: APPLE, duration: 0.45 } },
  exit:    { opacity: 0, scale: 0.98, transition: { ease: APPLE, duration: 0.22 } },
};

export const listContainerVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};

export const listItemVariants = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { ease: APPLE, duration: 0.42 } },
};

/* ─── Shimmer keyframe injection (once, no React dep) ──────────────────────── */
if (typeof document !== "undefined" && !document.getElementById("sk-shimmer-style")) {
  const s = document.createElement("style");
  s.id = "sk-shimmer-style";
  s.textContent = "@keyframes sk-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}";
  document.head.appendChild(s);
}

/* ─── Bone primitive ───────────────────────────────────────────────────────── */
export function Bone({ w = "100%", h = 14, radius = 6 }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display:        "inline-block",
        width:          w,
        height:         h,
        borderRadius:   radius,
        background:     "linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)",
        backgroundSize: "200% 100%",
        animation:      "sk-shimmer 1.6s infinite linear",
        flexShrink:     0,
      }}
    />
  );
}

/* ─── KPI card row skeleton ────────────────────────────────────────────────── */
export function KpiSkeleton({ count = 4 }) {
  return (
    <div className="staff-reservation-kpis sfx-kpis" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <article key={i} className="sfx-kpi sfx-kpi--blue">
          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
            <Bone w={32} h={32} radius={8} />
            <Bone w="55%" h={26} radius={6} />
            <Bone w="72%" h={13} radius={4} />
          </div>
        </article>
      ))}
    </div>
  );
}

/* ─── Single reservation row skeleton ─────────────────────────────────────── */
function ReservationRowSkeleton() {
  return (
    <tr aria-hidden="true" style={{ height: 52 }}>
      <td style={{ textAlign: "center", verticalAlign: "middle", padding: "10px 8px" }}>
        <Bone w={60} h={13} radius={4} />
      </td>
      <td style={{ textAlign: "center", verticalAlign: "middle", padding: "10px 8px" }}>
        <Bone w={70} h={13} radius={4} />
      </td>
      <td style={{ textAlign: "center", verticalAlign: "middle", padding: "10px 8px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <Bone w={96} h={13} radius={4} />
          <Bone w={60} h={11} radius={4} />
        </div>
      </td>
      <td style={{ textAlign: "center", verticalAlign: "middle", padding: "10px 8px" }}>
        <Bone w={78} h={13} radius={4} />
      </td>
      <td style={{ textAlign: "center", verticalAlign: "middle", padding: "10px 8px" }}>
        <Bone w={100} h={13} radius={4} />
      </td>
      <td style={{ textAlign: "center", verticalAlign: "middle", padding: "10px 8px" }}>
        <Bone w={68} h={22} radius={20} />
      </td>
      <td style={{ textAlign: "center", verticalAlign: "middle", padding: "10px 8px" }}>
        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
          <Bone w={56} h={26} radius={6} />
          <Bone w={40} h={26} radius={6} />
        </div>
      </td>
    </tr>
  );
}

/* ─── Full reservation list skeleton ──────────────────────────────────────── */
export function ReservationTableSkeleton({ count = 6 }) {
  return (
    <motion.div
      key="reservation-skeleton"
      variants={fadeScaleVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      aria-busy="true"
      aria-label="Loading reservations"
    >
      <KpiSkeleton count={4} />

      <div className="sfx-card" style={{ marginTop: 16 }}>
        <div className="sfx-card__body">
          <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
            <Bone w="36%" h={36} radius={8} />
            <Bone w={160} h={36} radius={8} />
            <Bone w={130} h={36} radius={8} />
          </div>
          <div className="sfx-table-wrap">
            <table className="sfx-table staff-reservations-table" style={{ background: "#ffffff" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Reservation ID", "Date", "Customer", "Phone", "Email", "Status", "Actions"].map((h) => (
                    <th key={h} style={{ padding: "10px 8px" }}>
                      <Bone w="65%" h={11} radius={3} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: count }).map((_, i) => (
                  <ReservationRowSkeleton key={i} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Floor plan tile skeleton ─────────────────────────────────────────────── */
export function TableCardSkeleton({ count = 12 }) {
  return (
    <motion.div
      key="table-skeleton"
      variants={fadeScaleVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      aria-busy="true"
      aria-label="Loading floor plan"
    >
      <div className="sfx-card">
        <div className="sfx-card__body">
          <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
            <Bone w="32%" h={36} radius={8} />
            <Bone w={130} h={36} radius={8} />
            {[84, 88, 80, 84].map((w, i) => <Bone key={i} w={w} h={30} radius={20} />)}
          </div>
          <Bone w={120} h={16} radius={4} />
          <div
            style={{
              display:             "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
              gap:                 12,
              marginTop:           14,
            }}
          >
            {Array.from({ length: count }).map((_, i) => (
              <div
                key={i}
                style={{
                  borderRadius:  12,
                  padding:       12,
                  border:        "1px solid #f0f0f0",
                  display:       "flex",
                  flexDirection: "column",
                  gap:           8,
                }}
              >
                <Bone w={40} h={40} radius={10} />
                <Bone w="80%" h={12} radius={4} />
                <Bone w="52%" h={11} radius={4} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── SkeletonPresence: synchronized handoff wrapper ───────────────────────── */
/**
 * AnimatePresence mode="wait" ensures skeleton exits FULLY before content enters.
 * No abrupt DOM flash or layout jump.
 *
 * @example
 *   <SkeletonPresence loading={loading} skeleton={<ReservationTableSkeleton count={6} />}>
 *     <YourContent />
 *   </SkeletonPresence>
 */
export function SkeletonPresence({ loading, skeleton, children, className }) {
  return (
    <AnimatePresence mode="wait">
      {loading
        ? skeleton
        : (
          <motion.div
            key="sk-content"
            className={className}
            variants={fadeScaleVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {children}
          </motion.div>
        )
      }
    </AnimatePresence>
  );
}
