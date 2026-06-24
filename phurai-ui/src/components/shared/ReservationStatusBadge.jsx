/**
 * ReservationStatusBadge
 * Shared component used by both Staff and Manager portals.
 * Renders a colored pill badge with a status icon or specific Tailwind classes.
 *
 * Props:
 *   status {string} — DB reservation_status or display_status ('Request')
 *   size   {'sm'|'md'} — optional, defaults to 'md'
 */

import React from "react";
import { RESERVATION_STATUS_META } from "@/shared/reservationStatus.js";

function ReservationStatusBadge({ status, size = "md", isFlashing = false }) {
  const flashingStyle = isFlashing
    ? {
        animation: "sfxBadgePulse 1.5s infinite",
        boxShadow: "0 0 0 0 rgba(16, 185, 129, 0.7)",
      }
    : {};

  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  const baseClasses = `inline-flex items-center rounded font-semibold whitespace-nowrap transition-all duration-300 ${sizeClasses}`;

  const meta = RESERVATION_STATUS_META[status];
  
  let colorClasses = meta ? meta.color : "bg-gray-50 border border-gray-200 text-gray-500";
  if (isFlashing) {
    colorClasses = "bg-emerald-500 text-white";
  }

  const label = meta ? meta.label : (status || 'Unknown');

  return (
    <>
      {isFlashing && (
        <style>{`
          @keyframes sfxBadgePulse {
            0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
            100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
          }
        `}</style>
      )}
      <span className={`${baseClasses} ${colorClasses}`} style={flashingStyle}>
        {label}
      </span>
    </>
  );
}

export default ReservationStatusBadge;

