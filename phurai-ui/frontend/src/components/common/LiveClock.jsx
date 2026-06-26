import { useEffect, useState } from "react";
import "./LiveClock.css";

function formatLiveClock(date) {
  const dayDate = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);

  const time = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);

  return `${dayDate} • ${time}`;
}

/** Static date label for section headings (no live seconds). */
export function formatTodayHeadingDate(date = new Date()) {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/**
 * Self-contained live clock — state stays here so parent layouts do not re-render every second.
 */
function LiveClock({ className = "", variant = "default" }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const classes = [
    "live-clock",
    variant === "header" ? "live-clock--header" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <time className={classes} dateTime={now.toISOString()} aria-live="off">
      {formatLiveClock(now)}
    </time>
  );
}

export default LiveClock;
