/**
 * Skeleton.jsx — Apple-style Skeleton Loading + Framer Motion choreography
 *
 * Used by the /manager portal (and /staff via StaffSkeleton).
 * All transitions use Apple's signature cubic-bezier(0.16, 1, 0.3, 1).
 *
 * Exports:
 *   Skeleton            — raw shimmer block (Tailwind or inline)
 *   KpiSkeleton         — 4-card KPI grid placeholder
 *   TableSkeleton       — data table placeholder
 *   FormSkeleton        — form field placeholder
 *   CardGridSkeleton    — card grid placeholder
 *   SkeletonPresence    — AnimatePresence skeleton ↔ content handoff
 *   fadeScaleVariants   — shared Framer variants (import and reuse)
 *   listContainerVariants — stagger container
 *   listItemVariants    — stagger child (y: 20 → 0)
 */
import { motion, AnimatePresence } from "framer-motion";

/* ─── Apple easing ─────────────────────────────────────────────────────────── */
const APPLE = [0.16, 1, 0.3, 1];

/* ─── Shimmer keyframe injection (once, no React dep) ──────────────────────── */
if (typeof document !== "undefined" && !document.getElementById("mgr-shimmer-style")) {
  const s = document.createElement("style");
  s.id = "mgr-shimmer-style";
  s.textContent = `
    @keyframes mgr-shimmer {
      0%   { background-position: 200% 0 }
      100% { background-position: -200% 0 }
    }
    .shimmer {
      background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: mgr-shimmer 1.6s infinite linear;
    }
  `;
  document.head.appendChild(s);
}

/* ─── Shared Framer variants (re-exported for section components) ─────────── */
export const fadeScaleVariants = {
  hidden:  { opacity: 0, scale: 0.98 },
  visible: { opacity: 1, scale: 1,    transition: { ease: APPLE, duration: 0.45 } },
  exit:    { opacity: 0, scale: 0.98, transition: { ease: APPLE, duration: 0.22 } },
};

export const listContainerVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.02, delayChildren: 0.02 } },
};

export const listItemVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { ease: APPLE, duration: 0.2 } },
};

/* ─── Base Shimmer block ────────────────────────────────────────────────────── */
export function Skeleton({ className = "", variant = "rect" }) {
  const shapeClass =
    variant === "circle"
      ? "rounded-full"
      : variant === "text"
      ? "rounded h-4"
      : "rounded-lg";
  return <div aria-hidden="true" className={`shimmer ${shapeClass} ${className}`} />;
}

/* ─── KPI / Stat Card Skeleton (Grid of N cards) ───────────────────────────── */
export function KpiSkeleton({ count = 4, className = "" }) {
  return (
    <motion.div
      key="kpi-skeleton"
      variants={fadeScaleVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      aria-busy="true"
      aria-label="Loading KPIs"
      className={className || "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            background: "#fff",
            borderRadius: 16,
            border: "1px solid rgba(31,26,23,0.07)",
            padding: "16px 16px 14px",
            boxShadow: "0 1px 2px rgba(31,26,23,0.04), 0 8px 24px rgba(31,26,23,0.06)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Accent top border */}
          <div className="shimmer" style={{ position: "absolute", inset: "0 0 auto 0", height: 3 }} />
          {/* Icon */}
          <Skeleton className="w-9 h-9 rounded-lg" />
          {/* Value */}
          <Skeleton className="w-24 h-7" />
          {/* Label */}
          <Skeleton className="w-32 h-3.5" />
        </div>
      ))}
    </motion.div>
  );
}

/* ─── Table Row Skeleton ────────────────────────────────────────────────────── */
export function TableSkeleton({ cols = 4, rows = 5 }) {
  return (
    <motion.div
      key="table-skeleton"
      variants={fadeScaleVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      aria-busy="true"
      aria-label="Loading data"
      className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden w-full"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              {Array.from({ length: cols }).map((_, idx) => (
                <th key={idx} className="px-6 py-4">
                  <Skeleton className="w-20 h-4 bg-gray-200" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {Array.from({ length: rows }).map((_, rowIdx) => (
              <tr key={rowIdx}>
                {Array.from({ length: cols }).map((_, colIdx) => (
                  <td key={colIdx} className="px-6 py-4">
                    <Skeleton className="w-32 h-4" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

/* ─── Form Field Skeleton ───────────────────────────────────────────────────── */
export function FormSkeleton({ items = 6 }) {
  return (
    <motion.div
      key="form-skeleton"
      variants={fadeScaleVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      aria-busy="true"
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: items }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="w-28 h-4" />
            <Skeleton className="w-full h-10" />
          </div>
        ))}
      </div>
      <div className="flex justify-end pt-4">
        <Skeleton className="w-32 h-10" />
      </div>
    </motion.div>
  );
}

/* ─── Grid Card Skeleton (dishes, tables) ───────────────────────────────────── */
export function CardGridSkeleton({ count = 6 }) {
  return (
    <motion.div
      key="card-grid-skeleton"
      variants={fadeScaleVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      aria-busy="true"
      aria-label="Loading cards"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm flex flex-col h-[280px]"
        >
          <Skeleton className="w-full h-40 rounded-t-xl rounded-b-none" />
          <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
            <div className="space-y-2">
              <Skeleton className="w-3/4 h-5" />
              <Skeleton className="w-1/2 h-4" />
            </div>
            <div className="flex justify-between items-center mt-2">
              <Skeleton className="w-20 h-6" />
              <Skeleton className="w-24 h-8" />
            </div>
          </div>
        </div>
      ))}
    </motion.div>
  );
}

/* ─── Chart + KPI combined skeleton (for Overview/Dashboard) ───────────────── */
export function DashboardSkeleton() {
  return (
    <motion.div
      key="dashboard-skeleton"
      variants={fadeScaleVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      aria-busy="true"
      className="space-y-8 p-6"
    >
      <KpiSkeleton count={4} />
      {/* Chart area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="space-y-3 mb-4">
            <Skeleton className="w-36 h-5" />
            <Skeleton className="w-48 h-4" />
          </div>
          <Skeleton className="w-full h-52 rounded-lg" />
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
          <Skeleton className="w-32 h-5" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="w-28 h-4" />
                <Skeleton className="w-16 h-3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── SkeletonPresence: synchronized skeleton ↔ content handoff ────────────── */
/**
 * AnimatePresence mode="wait" — skeleton exits FULLY before content enters.
 * Content container wraps children with fadeScaleVariants by default.
 * For staggered children, pass a motion.div with listContainerVariants as the child.
 *
 * @example
 *   <SkeletonPresence loading={loading} skeleton={<TableSkeleton cols={5} rows={6} />}>
 *     <motion.div variants={listContainerVariants} initial="hidden" animate="visible">
 *       {rows.map(r => <motion.tr key={r.id} variants={listItemVariants}>…</motion.tr>)}
 *     </motion.div>
 *   </SkeletonPresence>
 */
export function SkeletonPresence({ loading, skeleton, children }) {
  return (
    <AnimatePresence mode="wait">
      {loading
        ? skeleton
        : (
          <motion.div
            key="sk-content"
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

export default Skeleton;
