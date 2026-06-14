import { SearchField } from "../ManagerUI.jsx";
import { TABLE_STATUS_META } from "../../data/managerDashboardMockData.js";
import { STATUS_KEYS } from "./tableConstants.js";

function TableMapFilterBar({
  search,
  onSearchChange,
  areaId,
  onAreaChange,
  areas,
  areasLoading,
  selectedStatuses,
  onToggleStatus,
}) {
  return (
    <div className="sfx-filterbar sfx-filterbar--horizontal">
      <SearchField
        value={search}
        onChange={onSearchChange}
        placeholder="Search table number..."
      />

      <label className="sfx-field sfx-filterbar__area">
        <span>Area</span>
        <select
          className="sfx-select"
          value={areaId}
          onChange={(e) => onAreaChange(e.target.value)}
          disabled={areasLoading}
        >
          <option value="">All Areas</option>
          {areas.map((area) => (
            <option key={area.area_id} value={area.area_id}>
              {area.area_name}
            </option>
          ))}
        </select>
      </label>

      <div className="sfx-filterbar__statuses">
        <span className="sfx-filterbar__label">Status</span>
        <div className="sfx-chips">
          {STATUS_KEYS.map((slug) => {
            const active = selectedStatuses.includes(slug);
            return (
              <button
                key={slug}
                type="button"
                className={`sfx-chip ${active ? "is-active" : "sfx-chip--outline"}`}
                aria-pressed={active}
                onClick={() => onToggleStatus(slug)}
              >
                <i className={`sfx-dot sfx-dot--${TABLE_STATUS_META[slug].tone}`} />
                {TABLE_STATUS_META[slug].label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default TableMapFilterBar;
