import React, { useMemo } from 'react';
import TableUnit from './TableUnit';
import { TABLES } from '../../config/floorPlanConfig';
import { validateTableCapacity } from '../../utils/validateTableCapacity';

// Normalize status based on backend API data
function normalizeStatus(apiTable) {
  if (apiTable.is_bookable === false) {
    const avail = apiTable.availability_at_slot || "";
    const lowerAvail = avail.toLowerCase();
    if (lowerAvail === "occupied") return "Occupied";
    if (lowerAvail === "cleaning") return "Occupied"; 
    if (lowerAvail === "inactive") return "Occupied"; 
    return "Reserved"; 
  }
  return "Available"; 
}

export default function FloorPlanSVG({
  tables = [],
  selectedTableId,
  guestCount,
  onTableClick
}) {
  // We need to map config Table ID (e.g. "S-03") to API Table object
  const apiTableMap = useMemo(() => {
    const map = new Map();
    tables.forEach(t => {
      // Map table_number (e.g. S-03) to the full API object
      map.set(t.table_number, t);
    });
    return map;
  }, [tables]);

  return (
    <div className="floorplan-box">
      <svg id="floorplan-svg" viewBox="0 0 1330 920" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="1326" height="916" fill="#fffdf9" stroke="var(--line)" strokeWidth="3" rx="8" />

        <rect className="zone-rect" x="20" y="20" width="240" height="170" rx="6" />
        <text className="zone-label" x="140" y="45">WINDOW ZONE A</text>

        <rect className="zone-rect" x="280" y="20" width="240" height="170" rx="6" />
        <text className="zone-label" x="400" y="45">WINDOW ZONE B</text>

        <rect className="zone-rect alt" x="540" y="20" width="200" height="170" rx="6" />
        <text className="zone-label" x="640" y="45">RECEPTION</text>
        <circle cx="640" cy="115" r="30" fill="#f5e9d6" stroke="#cdb27e" strokeWidth="1.5" />

        <rect className="zone-rect" x="760" y="20" width="240" height="170" rx="6" />
        <text className="zone-label" x="880" y="45">WINDOW ZONE C</text>

        <rect className="zone-rect" x="1020" y="20" width="290" height="170" rx="6" />
        <text className="zone-label" x="1165" y="45">WINDOW ZONE D</text>

        <rect className="zone-rect" x="20" y="210" width="240" height="150" rx="6" fill="#fdf4f4" />
        <text className="zone-label" x="140" y="225">VIP ROOM 1</text>

        <rect className="zone-rect" x="20" y="380" width="240" height="150" rx="6" fill="#fdf4f4" />
        <text className="zone-label" x="140" y="395">VIP ROOM 2</text>

        <rect className="zone-rect" x="20" y="550" width="240" height="150" rx="6" fill="#fdf4f4" />
        <text className="zone-label" x="140" y="565">VIP ROOM 3</text>

        <rect className="zone-rect" x="20" y="720" width="240" height="80" rx="6" />
        <text className="sub-label" x="140" y="765">LADIES RESTROOM</text>
        <rect className="zone-rect" x="20" y="820" width="240" height="80" rx="6" />
        <text className="sub-label" x="140" y="865">MEN RESTROOM</text>

        <rect className="zone-rect" x="280" y="210" width="560" height="490" rx="6" />
        <text className="zone-label" x="560" y="235">STANDARD DINING AREA</text>

        <rect className="zone-rect" x="860" y="210" width="140" height="490" rx="6" fill="#fdf8f0" />
        <text className="zone-label" x="930" y="235">PREMIUM</text>

        <rect className="zone-rect" x="1020" y="210" width="290" height="155" rx="6" fill="#f9f5fa" />
        <text className="zone-label" x="1165" y="235">PRIVATE ROOM 1</text>

        <rect className="zone-rect" x="1020" y="380" width="290" height="155" rx="6" fill="#f9f5fa" />
        <text className="zone-label" x="1165" y="405">PRIVATE ROOM 2</text>

        <rect className="zone-rect" x="1020" y="550" width="290" height="155" rx="6" fill="#f9f5fa" />
        <text className="zone-label" x="1165" y="575">PRIVATE ROOM 3</text>

        <rect className="zone-rect" x="1020" y="720" width="290" height="180" rx="6" fill="#f9f5fa" />
        <text className="zone-label" x="1165" y="745">PRIVATE ROOM 4</text>

        <rect className="zone-rect" rx="6" height="180" width="420" y="720" x="280" />
        <text className="zone-label" x="490" y="745">KITCHEN VIEW AREA</text>

        <rect className="zone-rect alt" x="710" y="720" width="300" height="180" rx="6" />
        <text className="zone-label" x="820" y="815">KITCHEN AREA</text>

        <g id="tables-layer">
          {TABLES.map((tableConfig) => {
            const apiTable = apiTableMap.get(tableConfig.id);
            let status = apiTable ? normalizeStatus(apiTable) : 'Occupied';

            const tableCapacity = apiTable?.capacity || tableConfig.capacity || 2;
            const isCapacityValid = validateTableCapacity(guestCount, tableCapacity);

            if (status === 'Available' && !isCapacityValid) {
              status = 'Occupied';
            }

            const isSelected = apiTable && selectedTableId === apiTable.table_id;

            return (
              <TableUnit
                key={tableConfig.id}
                tableData={tableConfig}
                status={status}
                isSelected={isSelected}
                onClick={onTableClick}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
