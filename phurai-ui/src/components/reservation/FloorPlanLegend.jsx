import { LEGEND_ORDER, TABLE_STATE_META } from "@/data/reservationFloorPlanConfig";

/**
 * Legend for the floor plan. Each swatch uses the same state classes as the
 * real table nodes so the colours always match the map.
 */
function FloorPlanLegend() {
  return (
    <ul className="rzv-fm-legend" aria-label="Table status legend">
      {LEGEND_ORDER.map((key) => (
        <li key={key} className="rzv-fm-legend__item">
          <span className={`rzv-fm-legend__swatch rzv-fm-legend__swatch--${key}`} />
          {TABLE_STATE_META[key]?.label || key}
        </li>
      ))}
    </ul>
  );
}

export default FloorPlanLegend;
