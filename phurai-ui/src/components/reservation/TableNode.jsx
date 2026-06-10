import { TABLE_STATE_META } from "@/data/reservationFloorPlanConfig";

/**
 * A single restaurant table drawn as real SVG geometry (table + chairs),
 * positioned at the visual config's x/y. Visual state comes only from the
 * backend availability flags; selection comes from the parent.
 *
 * Props:
 *   visual   – merged backend table + frontend visual config
 *   state    – resolved state key (available|suggested|selected|reserved|…)
 *   onSelect – (table_id) => void
 */

const SHAPE = {
  round: { kind: "circle", r: 32, chairRadius: 48 },
  vip: { kind: "circle", r: 34, chairRadius: 51, premium: true },
  rect: { kind: "rect", w: 96, h: 60 },
  long: { kind: "rect", w: 154, h: 60 },
  "vip-long": { kind: "rect", w: 154, h: 62, premium: true },
  private: { kind: "rect", w: 184, h: 96, ends: true },
  bar: { kind: "bar", w: 168, h: 26 },
};

/* Evenly spread N chairs around a circle (first chair at the top). */
function circleChairs(count, radius) {
  const chairs = [];
  const n = Math.max(1, count);
  for (let i = 0; i < n; i += 1) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    chairs.push({ cx: Math.cos(angle) * radius, cy: Math.sin(angle) * radius, vertical: false });
  }
  return chairs;
}

/* Place chairs along the long sides of a rectangle (+ optional end seats). */
function rectChairs(count, w, h, allowEnds) {
  const chairs = [];
  const n = Math.max(1, count);
  const ends = allowEnds && n >= 6 ? Math.min(2, n) : 0;
  const sideCount = n - ends;
  const top = Math.ceil(sideCount / 2);
  const bottom = sideCount - top;
  const gap = 18;

  const row = (qty, y) => {
    for (let i = 0; i < qty; i += 1) {
      const x = -w / 2 + (w * (i + 1)) / (qty + 1);
      chairs.push({ cx: x, cy: y, vertical: false });
    }
  };
  row(top, -h / 2 - gap);
  row(bottom, h / 2 + gap);
  if (ends >= 1) chairs.push({ cx: -w / 2 - gap, cy: 0, vertical: true });
  if (ends >= 2) chairs.push({ cx: w / 2 + gap, cy: 0, vertical: true });
  return chairs;
}

/* Bar stools in a row beneath the counter. */
function barStools(count, w, y) {
  const chairs = [];
  const n = Math.max(1, count);
  for (let i = 0; i < n; i += 1) {
    const x = -w / 2 + (w * (i + 1)) / (n + 1);
    chairs.push({ cx: x, cy: y, vertical: false });
  }
  return chairs;
}

function Chair({ cx, cy, vertical }) {
  if (vertical) {
    return <rect className="rzv-tbl__chair" x={cx - 5} y={cy - 8} width={10} height={16} rx={4} />;
  }
  return <rect className="rzv-tbl__chair" x={cx - 8} y={cy - 5} width={16} height={10} rx={4} />;
}

function TableNode({ visual, state, onSelect }) {
  const meta = TABLE_STATE_META[state] || TABLE_STATE_META.available;
  const selectable = meta.selectable;
  const spec = SHAPE[visual.shape] || SHAPE.rect;
  const capacity = Number(visual.capacity) || 0;

  const classes = ["rzv-tbl", `rzv-tbl--${state}`];
  if (selectable) classes.push("rzv-tbl--clickable");
  if (spec.premium) classes.push("rzv-tbl--vip");

  const handleSelect = () => {
    if (!selectable) return;
    onSelect(visual.table_id);
  };
  const handleKey = (e) => {
    if (!selectable) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(visual.table_id);
    }
  };

  // --- chairs + table body geometry per shape ---
  let chairs = [];
  let body = null;
  let statusY = 0;

  if (spec.kind === "circle") {
    chairs = circleChairs(capacity, spec.chairRadius);
    body = <circle className="rzv-tbl__shape" cx={0} cy={0} r={spec.r} />;
    statusY = spec.r + 30;
  } else if (spec.kind === "bar") {
    chairs = barStools(capacity, spec.w, spec.h / 2 + 16);
    body = (
      <rect
        className="rzv-tbl__shape"
        x={-spec.w / 2}
        y={-spec.h / 2}
        width={spec.w}
        height={spec.h}
        rx={8}
      />
    );
    statusY = spec.h / 2 + 44;
  } else {
    chairs = rectChairs(capacity, spec.w, spec.h, spec.ends);
    body = (
      <rect
        className="rzv-tbl__shape"
        x={-spec.w / 2}
        y={-spec.h / 2}
        width={spec.w}
        height={spec.h}
        rx={14}
      />
    );
    statusY = spec.h / 2 + 34;
  }

  const isCircle = spec.kind === "circle";
  const showBadge = state === "selected" || state === "suggested";
  const badgeY = isCircle ? -(spec.r + 22) : -(spec.h / 2 + 22);
  const showStatusText = !selectable; // Reserved / Occupied / Cleaning / Too small …

  return (
    <g transform={`translate(${visual.x} ${visual.y})`}>
      <g
        className={classes.join(" ")}
        role="button"
        tabIndex={selectable ? 0 : -1}
        aria-disabled={!selectable}
        aria-pressed={state === "selected"}
        aria-label={`Table ${visual.displayLabel}, ${visual.zone}, ${capacity} seats, ${meta.label}`}
        onClick={handleSelect}
        onKeyDown={handleKey}
      >
        <title>
          {`${visual.displayLabel} · ${visual.zone}\n${capacity} seats · ${meta.label}`}
        </title>

        {chairs.map((c, i) => (
          <Chair key={i} cx={c.cx} cy={c.cy} vertical={c.vertical} />
        ))}

        {body}

        <text className="rzv-tbl__label" x={0} y={isCircle ? 1 : -4} textAnchor="middle">
          {visual.displayLabel}
        </text>
        {!isCircle ? (
          <text className="rzv-tbl__cap" x={0} y={14} textAnchor="middle">
            {capacity} seats
          </text>
        ) : null}

        {showBadge ? (
          <g className="rzv-tbl__badge" transform={`translate(0 ${badgeY})`}>
            <rect className="rzv-tbl__badge-bg" x={-34} y={-12} width={68} height={22} rx={11} />
            <text className="rzv-tbl__badge-txt" x={0} y={3} textAnchor="middle">
              {state === "selected" ? "✓ Selected" : "Suggested"}
            </text>
          </g>
        ) : null}

        {showStatusText ? (
          <text className="rzv-tbl__status" x={0} y={statusY} textAnchor="middle">
            {meta.label}
          </text>
        ) : null}
      </g>
    </g>
  );
}

export default TableNode;
