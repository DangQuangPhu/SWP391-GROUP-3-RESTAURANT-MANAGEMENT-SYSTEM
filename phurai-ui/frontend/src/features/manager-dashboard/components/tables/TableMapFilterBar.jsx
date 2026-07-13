import { SearchField } from "../ManagerUI.jsx";
import { TABLE_STATUS_META } from "@/shared/constants.js";
import { STATUS_KEYS } from "./tableConstants.js";

const FILTER_STATUS_SLUGS = ["available", "reserved", "occupied", "cleaning"];

function TableMapFilterBar({
  search,
  onSearchChange,
  areaId,
  onAreaChange,
  areas,
  areasLoading,
  selectedStatuses,
  onToggleStatus,
  actions,
}) {
  return (
    <div className="sfx-filterbar sfx-filterbar--horizontal" style={{ display: "flex", alignItems: "flex-end", gap: "12px 16px", flexWrap: "wrap" }}>
      
      <div style={{ flex: "1 1 220px", minWidth: "200px" }}>
        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--sfx-muted)", display: "block", marginBottom: "6px" }}>Search Table</span>
        <SearchField
          value={search}
          onChange={onSearchChange}
          placeholder="Search table number..."
        />
      </div>

      <div style={{ flex: "0 1 180px", minWidth: "140px" }}>
        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--sfx-muted)", display: "block", marginBottom: "6px" }}>Area</span>
        <select
          className="sfx-select"
          value={areaId}
          onChange={(e) => onAreaChange(e.target.value)}
          disabled={areasLoading}
          style={{ width: "100%", height: "40px" }}
        >
          <option value="">All Areas</option>
          {areas.map((area) => (
            <option key={area.area_id} value={area.area_id}>
              {area.area_name}
            </option>
          ))}
        </select>
      </div>

      <div className="sfx-filterbar__statuses" style={{ flex: "1 1 320px", minWidth: "280px", margin: 0 }}>
        <span className="sfx-filterbar__label" style={{ fontSize: "12px", fontWeight: 600, color: "var(--sfx-muted)", display: "block", marginBottom: "6px" }}>Status</span>
        <div className="sfx-chips" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {FILTER_STATUS_SLUGS.map((slug) => {
            const active = selectedStatuses.includes(slug);
            const meta = TABLE_STATUS_META[slug];
            return (
              <button
                key={slug}
                type="button"
                className={`sfx-chip ${active ? "is-active" : "sfx-chip--outline"}`}
                aria-pressed={active}
                onClick={() => {
                  if (active) {
                    onToggleStatus("clear");
                  } else {
                    onToggleStatus(slug);
                  }
                }}
                style={{ height: "40px", display: "inline-flex", alignItems: "center" }}
              >
                <i className={`sfx-dot sfx-dot--${meta.tone}`} />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {actions ? (
        <div style={{ marginLeft: "auto", height: "40px", display: "flex", alignItems: "center" }}>
          {actions}
        </div>
      ) : null}

    </div>
  );
}

export default TableMapFilterBar;
