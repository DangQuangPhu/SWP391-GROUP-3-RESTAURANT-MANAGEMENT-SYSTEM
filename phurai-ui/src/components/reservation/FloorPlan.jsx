import { useMemo, useState } from "react";
import {
  FLOOR_PLANS,
  TABLE_VISUALS,
  DECOR_TABLES,
  resolveTableState,
  resolveAmbientState,
  TABLE_STATE_META,
} from "@/data/reservationFloorPlanConfig";
import TableNode from "./TableNode";
import FloorPlanLegend from "./FloorPlanLegend";

/**
 * Interactive SVG restaurant floor plan.
 *
 * Backend availability (`tables`) is merged with the frontend-only visual config
 * (`TABLE_VISUALS`) by DB table_number. Only the active floor is rendered.
 * Selecting a bookable table reports the real table_id to the parent.
 *
 * Decorative ambient tables (DECOR_TABLES) flesh out the room but are never
 * selectable and never submitted — the backend stays authoritative.
 */
function FloorPlan({ tables = [], selectedTableIds = [], onSelectTable, loading }) {
  const [activeFloor, setActiveFloor] = useState(1);
  const [showLegend, setShowLegend] = useState(true);

  const floor = useMemo(
    () => FLOOR_PLANS.find((f) => f.id === activeFloor) || FLOOR_PLANS[0],
    [activeFloor]
  );

  // Merge each backend table with its visual config (by table_number).
  const visualTables = useMemo(
    () =>
      tables
        .map((t) => {
          const cfg = TABLE_VISUALS[t.table_number];
          if (!cfg) return null;
          return {
            ...t,
            displayLabel: cfg.displayLabel,
            floor: cfg.floor,
            zone: cfg.zone,
            x: cfg.x,
            y: cfg.y,
            shape: cfg.shape,
          };
        })
        .filter(Boolean),
    [tables]
  );

  const floorTables = useMemo(
    () => visualTables.filter((t) => Number(t.floor) === Number(activeFloor)),
    [visualTables, activeFloor]
  );

  const floorDecor = useMemo(
    () => DECOR_TABLES.filter((d) => Number(d.floor) === Number(activeFloor)),
    [activeFloor]
  );

  // Tables returned by the backend that we have no visual mapping for.
  const unmappedTables = useMemo(
    () => tables.filter((t) => !TABLE_VISUALS[t.table_number]),
    [tables]
  );

  const selectedSet = useMemo(() => new Set(selectedTableIds), [selectedTableIds]);

  const selectedTables = useMemo(
    () => visualTables.filter((t) => selectedSet.has(t.table_id)),
    [visualTables, selectedSet]
  );

  const availableOnFloor = floorTables.filter(
    (t) => t.is_bookable && !t.is_too_small
  ).length;

  const floorPlanReady = tables.length > 0;

  return (
    <div className="rzv-card rzv-fm">
      <div className="rzv-fm__head">
        <div>
          <h3 className="rzv-card__title">Choose your table</h3>
          <p className="rzv-card__hint">
            Tap an available table on the plan. Recommended tables glow gold.
          </p>
        </div>
        {!showLegend ? (
          <button
            type="button"
            className="rzv-fm__legend-recall"
            onClick={() => setShowLegend(true)}
          >
            <span aria-hidden>◴</span> Show legend
          </button>
        ) : null}
      </div>

      {/* Floor switch */}
      <div className="rzv-floor__tabs" role="tablist" aria-label="Select floor">
        {FLOOR_PLANS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={activeFloor === f.id}
            className={`rzv-floor__tab ${activeFloor === f.id ? "rzv-floor__tab--active" : ""}`}
            onClick={() => setActiveFloor(f.id)}
          >
            <span className="rzv-floor__tab-num">Floor {f.id}</span>
            <span className="rzv-floor__tab-name">{f.sublabel}</span>
          </button>
        ))}
      </div>

      <div className="rzv-fm__stage">
        {/* SVG map (horizontally scrollable on small screens) */}
        <div className="rzv-fm__scroll">
          <svg
            key={floor.id}
            className="rzv-fm__svg"
            viewBox={floor.viewBox}
            role="img"
            aria-label={`${floor.label} ${floor.sublabel} floor plan`}
          >
            <defs>
              <pattern
                id="rzvCleaning"
                width="10"
                height="10"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="10" height="10" fill="#eef0ee" />
                <line x1="0" y1="0" x2="0" y2="10" stroke="#cfd3cd" strokeWidth="4" />
              </pattern>
            </defs>

            {/* Outer boundary wall */}
            <rect
              className={`rzv-fm-wall rzv-fm-wall--${floor.boundaryType}`}
              x={floor.boundary.x}
              y={floor.boundary.y}
              width={floor.boundary.w}
              height={floor.boundary.h}
              rx={18}
            />

            {/* Floor 2 open-air railing */}
            {floor.railings?.map((r, i) => (
              <line
                key={`rail-${i}`}
                className="rzv-fm-railing"
                x1={r.x1}
                y1={r.y1}
                x2={r.x2}
                y2={r.y2}
              />
            ))}

            {/* Zones */}
            {floor.zones.map((zone) => (
              <g key={zone.id} className={`rzv-fm-zone rzv-fm-zone--${zone.variant}`}>
                <rect
                  className="rzv-fm-zone__box"
                  x={zone.x}
                  y={zone.y}
                  width={zone.w}
                  height={zone.h}
                  rx={14}
                />
                <text className="rzv-fm-zone__label" x={zone.x + 16} y={zone.y + 28}>
                  {zone.label.toUpperCase()}
                </text>
              </g>
            ))}

            {/* Window line on Floor 1 */}
            {floor.windows?.map((w, i) => (
              <line
                key={`win-${i}`}
                className="rzv-fm-window"
                x1={w.x1}
                y1={w.y1}
                x2={w.x2}
                y2={w.y2}
              />
            ))}

            {/* Entrance hint on Floor 1 */}
            {floor.entrance ? (
              <g>
                <rect
                  className="rzv-fm-entrance"
                  x={floor.entrance.x}
                  y={floor.entrance.y}
                  width={floor.entrance.w}
                  height={floor.entrance.h}
                />
                <text
                  className="rzv-fm-entrance__label"
                  x={floor.entrance.x + 16}
                  y={floor.entrance.y + floor.entrance.h / 2}
                >
                  {floor.entrance.label}
                </text>
              </g>
            ) : null}

            {/* Floor 2 plant hints */}
            {floor.plants?.map((p, i) => (
              <g key={`plant-${i}`} className="rzv-fm-plant" transform={`translate(${p.x} ${p.y})`}>
                <circle className="rzv-fm-plant__pot" cx={0} cy={6} r={9} />
                <circle className="rzv-fm-plant__leaf" cx={0} cy={-6} r={11} />
              </g>
            ))}

            {/* Decorative ambient tables (non-interactive room context) */}
            {floorDecor.map((d) => (
              <TableNode
                key={d.id}
                visual={d}
                state={resolveAmbientState(d.ambientStatus)}
                onSelect={() => {}}
                decorative
              />
            ))}

            {/* Real, bookable tables */}
            {floorTables.map((t) => (
              <TableNode
                key={t.table_id}
                visual={t}
                state={resolveTableState(t, selectedSet.has(t.table_id))}
                onSelect={onSelectTable}
              />
            ))}

            {/* Empty / loading overlay text */}
            {!floorPlanReady ? (
              <text className="rzv-fm__empty" x="600" y="380" textAnchor="middle">
                {loading
                  ? "Checking live availability…"
                  : "Select a date, time and guests to load tables"}
              </text>
            ) : null}
          </svg>
        </div>

        {/* Collapsible legend / dashboard */}
        {showLegend ? (
          <div className="rzv-fm__legend-panel">
            <div className="rzv-fm__legend-head">
              <span className="rzv-fm__legend-title">Table status</span>
              <button
                type="button"
                className="rzv-fm__legend-hide"
                onClick={() => setShowLegend(false)}
                aria-label="Hide legend"
              >
                Hide
              </button>
            </div>
            <FloorPlanLegend />
            <p className="rzv-fm__legend-note">
              {loading
                ? "Checking live availability…"
                : !floorPlanReady
                ? "Pick a date, time and party size to load tables."
                : `${availableOnFloor} table(s) available on ${floor.label}.`}
            </p>
          </div>
        ) : null}
      </div>

      {/* Fallback: tables the backend returned but we cannot place visually. */}
      {unmappedTables.length > 0 ? (
        <div className="rzv-fm-fallback">
          <span className="rzv-fm-fallback__label">Other tables</span>
          <div className="rzv-chips">
            {unmappedTables.map((t) => {
              const state = resolveTableState(t, selectedSet.has(t.table_id));
              const selectable = TABLE_STATE_META[state]?.selectable;
              return (
                <button
                  key={t.table_id}
                  type="button"
                  className={`rzv-chip ${selectedSet.has(t.table_id) ? "rzv-chip--active" : ""}`}
                  disabled={!selectable}
                  onClick={() => selectable && onSelectTable(t.table_id)}
                >
                  {t.display_label || t.table_number} · {t.capacity}p
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Selected table detail panel */}
      <div className="rzv-fm-detail">
        <h4 className="rzv-fm-detail__title">Selected table</h4>
        {selectedTables.length === 0 ? (
          <p className="rzv-fm-detail__empty">
            Choose an available table from the floor plan.
          </p>
        ) : (
          <ul className="rzv-fm-detail__list">
            {selectedTables.map((t) => (
              <li key={t.table_id} className="rzv-fm-detail__row">
                <div>
                  <span className="rzv-fm-detail__label">{t.displayLabel}</span>
                  <span className="rzv-fm-detail__sub">
                    {t.table_number} · Floor {t.floor} · {t.zone}
                  </span>
                </div>
                <div className="rzv-fm-detail__meta">
                  <span>{t.capacity} guests</span>
                  <button
                    type="button"
                    className="rzv-fm-detail__remove"
                    onClick={() => onSelectTable(t.table_id)}
                    aria-label={`Remove table ${t.displayLabel}`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default FloorPlan;
