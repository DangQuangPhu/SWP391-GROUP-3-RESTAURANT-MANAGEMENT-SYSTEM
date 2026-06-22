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

function ReservationStatusBadge({ status, size = "md", isFlashing = false }) {
  const flashingStyle = isFlashing
    ? {
        animation: "sfxBadgePulse 1.5s infinite",
        boxShadow: "0 0 0 0 rgba(16, 185, 129, 0.7)",
      }
    : {};

  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  const baseClasses = `inline-flex items-center rounded font-semibold whitespace-nowrap transition-all duration-300 ${sizeClasses}`;

  let colorClasses = "";

  switch (status) {
    case 'Pending Request':
    case 'Pending Payment':
    case 'Pending':
      colorClasses = isFlashing ? "bg-emerald-500 text-white" : "bg-orange-100 text-orange-700";
      break;
    case 'Await Check-in':
    case 'Confirmed':
    case 'Reserved':
    case 'Request':
      colorClasses = isFlashing ? "bg-emerald-500 text-white" : "bg-blue-100 text-blue-700";
      break;
    case 'Check-in':
    case 'Seated':
    case 'Cleaning':
      colorClasses = isFlashing ? "bg-emerald-500 text-white" : "bg-green-100 text-green-700";
      break;
    case 'Completed':
    case 'Paid':
    case 'Complete Paid':
    case 'Check-out':
      colorClasses = isFlashing ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-700";
      break;
    case 'No Show':
    case 'Cancelled':
    case 'PaymentFailed':
    case 'Reject Check-in':
    case 'Reject Request':
    case 'Reject Check-out':
      colorClasses = isFlashing ? "bg-emerald-500 text-white" : "bg-red-100 text-red-700";
      break;
    default:
      colorClasses = isFlashing ? "bg-emerald-500 text-white" : "bg-gray-50 border border-gray-200 text-gray-500";
      break;
  }

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
        {status || 'Unknown'}
      </span>
    </>
  );
}

export default ReservationStatusBadge;

