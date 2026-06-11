import { useMemo, useState } from "react";

/* Dependency-free SVG area/line chart with a day/week/month toggle. */
function RevenueChart({ series }) {
  const [range, setRange] = useState("week");
  const data = series?.[range] || [];

  const geom = useMemo(() => {
    const W = 760;
    const H = 240;
    const padX = 28;
    const padY = 24;
    const max = Math.max(...data.map((d) => d.value), 1) * 1.15;
    const stepX = data.length > 1 ? (W - padX * 2) / (data.length - 1) : 0;
    const pts = data.map((d, i) => {
      const x = padX + i * stepX;
      const y = H - padY - (d.value / max) * (H - padY * 2);
      return { x, y, ...d };
    });
    const line = pts.map((p) => `${p.x},${p.y}`).join(" ");
    const area = pts.length
      ? `M${pts[0].x},${H - padY} L${line.replace(/ /g, " L")} L${pts[pts.length - 1].x},${H - padY} Z`
      : "";
    return { W, H, padY, pts, line, area, max };
  }, [data]);

  return (
    <div className="sfx-chart">
      <div className="sfx-chart__head">
        <div>
          <h3 className="sfx-card__title">Revenue Overview</h3>
          <p className="sfx-chart__sub">Gross sales · sample trend</p>
        </div>
        <div className="sfx-seg">
          {["day", "week", "month"].map((r) => (
            <button
              key={r}
              type="button"
              className={`sfx-seg__btn ${range === r ? "is-active" : ""}`}
              onClick={() => setRange(r)}
            >
              {r[0].toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <svg
        className="sfx-chart__svg"
        viewBox={`0 0 ${geom.W} ${geom.H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Revenue trend chart"
      >
        <defs>
          <linearGradient id="sfxRevFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(159,134,85,0.32)" />
            <stop offset="100%" stopColor="rgba(159,134,85,0)" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line
            key={g}
            x1="20"
            x2={geom.W - 20}
            y1={geom.H - geom.padY - g * (geom.H - geom.padY * 2)}
            y2={geom.H - geom.padY - g * (geom.H - geom.padY * 2)}
            className="sfx-chart__grid"
          />
        ))}

        {geom.area ? <path d={geom.area} fill="url(#sfxRevFill)" /> : null}
        {geom.line ? (
          <polyline className="sfx-chart__line" points={geom.line} />
        ) : null}

        {geom.pts.map((p) => (
          <g key={p.label} className="sfx-chart__pt">
            <circle cx={p.x} cy={p.y} r="4" className="sfx-chart__dot" />
            <text x={p.x} y={geom.H - 6} className="sfx-chart__xlabel">
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default RevenueChart;
