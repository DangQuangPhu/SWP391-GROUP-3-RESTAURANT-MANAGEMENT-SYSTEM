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
    <div className="sfx-filterbar sfx-filterbar--horizontal sfx-tablemap-filter__container">
      
      <div className="sfx-tablemap-filter__search-box">
        <span className="sfx-tablemap-filter__label">Search Table</span>
        <SearchField
          value={search}
          onChange={onSearchChange}
          placeholder="Search table number..."
        />
      </div>

      <div className="sfx-tablemap-filter__area-box">
        <span className="sfx-tablemap-filter__label">Area</span>
        <select
          className="sfx-select sfx-tablemap-filter__select"
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
      </div>

      <div className="sfx-filterbar__statuses sfx-tablemap-filter__status-box">
        <span className="sfx-filterbar__label sfx-tablemap-filter__label">Status</span>
        <div className="sfx-chips sfx-tablemap-filter__chips">
          {FILTER_STATUS_SLUGS.map((slug) => {
            const active = selectedStatuses.includes(slug);
            const meta = TABLE_STATUS_META[slug];
            return (
              <button
                key={slug}
                type="button"
                className={`sfx-chip ${active ? "is-active" : "sfx-chip--outline"} sfx-tablemap-filter__chip-btn`}
                aria-pressed={active}
                onClick={() => {
                  if (active) {
                    onToggleStatus("clear");
                  } else {
                    onToggleStatus(slug);
                  }
                }}
              >
                <i className={`sfx-dot sfx-dot--${meta.tone}`} />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {actions ? (
        <div className="sfx-tablemap-filter__actions">
          {actions}
        </div>
      ) : null}

    </div>
  );
}

export default TableMapFilterBar;
