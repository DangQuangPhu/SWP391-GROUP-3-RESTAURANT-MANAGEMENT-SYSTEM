import { SearchField } from "../ManagerUI.jsx";
import { TABLE_STATUS_META } from "@/shared/constants.js";
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

      <label className="sfx-field sfx-filterbar__area">
        <span>Status</span>
        <select
          className="sfx-select"
          value={selectedStatuses[0] || ""}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "") {
               // clear selected statuses
               onToggleStatus("clear"); 
            } else {
               onToggleStatus(val);
            }
          }}
        >
          <option value="">All Statuses</option>
          {STATUS_KEYS.map((slug) => (
            <option key={slug} value={slug}>
              {TABLE_STATUS_META[slug].label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export default TableMapFilterBar;
