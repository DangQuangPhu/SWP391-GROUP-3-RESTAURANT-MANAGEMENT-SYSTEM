/**
 * ReservationStatusBadge
 *
 * Premium status pill. Uses a CSS-variable token system for colors.
 * NO icons — clean text-only pill design.
 *
 * Pulse behavior:
 *   - Actionable states (Pending Request, Check-in, Dining, Payment Pending)
 *     get a soft glow-pulse via CSS animation
 *   - Terminal states (Completed, Cancelled, No Show) are always static
 *
 * Props:
 *   status {string} — e.g. 'Dining', 'Confirmed', 'Cancelled'
 *   size   {'sm'|'md'} — optional, defaults to 'md'
 *   isFlashing {bool} — legacy: forces green flash for live payment events
 */

import React from "react";
import { RESERVATION_STATUS_META } from "@/shared/reservationStatus.js";
import "@/styles/shared/ReservationStatusBadge.css";

// CSS class mapping keyed by tone from RESERVATION_STATUS_META
const TONE_CLASS = {
  amber:  "rsb--amber",
  blue:   "rsb--blue",
  purple: "rsb--purple",
  green:  "rsb--green",
  red:    "rsb--red",
  muted:  "rsb--muted",
};

function ReservationStatusBadge({ status, size = "md", isFlashing = false }) {
  const meta = RESERVATION_STATUS_META[status];

  const toneClass = isFlashing
    ? "rsb--flash"
    : (TONE_CLASS[meta?.tone] ?? "rsb--muted");

  const pulseClass = (!isFlashing && meta?.pulse) ? "rsb--pulse" : "";
  const sizeClass  = size === "sm" ? "rsb--sm" : "rsb--md";

  const label = meta?.label ?? status ?? "Unknown";

  return (
    <span className={`rsb ${toneClass} ${sizeClass} ${pulseClass}`}>
      {label}
    </span>
  );
}

export default ReservationStatusBadge;
