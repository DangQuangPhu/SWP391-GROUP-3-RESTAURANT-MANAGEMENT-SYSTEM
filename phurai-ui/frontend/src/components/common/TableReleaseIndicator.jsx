function parseDateTime(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTime(value) {
  const date = parseDateTime(value);
  if (!date) return null;
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(totalMinutes) {
  const minutes = Math.max(0, Math.round(Number(totalMinutes) || 0));
  if (minutes <= 0) return "now";

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours <= 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function getMinutesBetween(left, right) {
  const leftDate = parseDateTime(left);
  const rightDate = parseDateTime(right);
  if (!leftDate || !rightDate) return null;
  return Math.round((leftDate.getTime() - rightDate.getTime()) / 60000);
}

function getSourceLabel(table, statusSlug) {
  if (statusSlug === "reserved") return "Await check-in";
  if (statusSlug !== "occupied") return null;

  const hasReservation =
    table?.active_occupancy_reservation_id != null ||
    table?.active_reservation_id != null ||
    table?.reservation_id != null;

  return hasReservation ? "Reservation dining" : "Walk-in dining";
}

export default function TableReleaseIndicator({ table, now = new Date() }) {
  const statusSlug = String(table?.table_status || table?.status || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  const sourceLabel = getSourceLabel(table, statusSlug);

  if (statusSlug === "reserved") {
    const checkInTime = formatTime(table?.next_reservation_start_at);
    return (
      <div className="table-release table-release--reserved" title="Reserved but not checked in yet">
        <span className="table-release__source">{sourceLabel}</span>
        <span className="table-release__main">{checkInTime ? `Due ${checkInTime}` : "No check-in time"}</span>
      </div>
    );
  }

  if (statusSlug !== "occupied") return null;

  const releaseAt = parseDateTime(table?.estimated_release_at);
  const occupiedSince = parseDateTime(table?.occupied_since);
  const checkInAt = formatTime(occupiedSince);

  if (!releaseAt) {
    return (
      <div className="table-release table-release--unknown" title="No open TableOccupancySessions estimate found">
        <span className="table-release__source">{sourceLabel}</span>
        <span className="table-release__main">ERT not set</span>
      </div>
    );
  }

  const minutesRemaining = getMinutesBetween(releaseAt, now);
  const isOverdue = minutesRemaining != null && minutesRemaining < 0;
  const elapsedRatio =
    occupiedSince && releaseAt && releaseAt > occupiedSince
      ? (now.getTime() - occupiedSince.getTime()) / (releaseAt.getTime() - occupiedSince.getTime())
      : 0;
  const isApproaching = !isOverdue && elapsedRatio >= 0.8;
  const tone = isOverdue ? "overdue" : isApproaching ? "risk" : "ok";
  const releaseTime = formatTime(releaseAt);
  const relative = isOverdue
    ? `${formatDuration(Math.abs(minutesRemaining))} overdue`
    : `${formatDuration(minutesRemaining)} left`;
  const title = [
    sourceLabel,
    checkInAt ? `occupied since ${checkInAt}` : null,
    releaseTime ? `estimated release ${releaseTime}` : null,
  ].filter(Boolean).join(" - ");

  return (
    <div className={`table-release table-release--${tone}`} title={title}>
      <span className="table-release__source">{sourceLabel}</span>
      <span className="table-release__main">
        ERT {releaseTime} - {relative}
      </span>
      {checkInAt ? <span className="table-release__sub">In since {checkInAt}</span> : null}
    </div>
  );
}
