import React, { useMemo } from 'react';
import FloorPlanSVG from './FloorPlanSVG';
import { validateTableCapacity } from '../../utils/validateTableCapacity';
import '../../styles/table-board.css';

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

export default function TableBoard({
  tables = [],
  selectedTableId,
  onSelectTable,
  guestCount
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

  const handleTableClick = (configId) => {
    const apiTable = apiTableMap.get(configId);
    if (!apiTable) return; // if not found in API, can't select

    // Enforce capacity validation
    const isCapacityValid = validateTableCapacity(guestCount, apiTable.capacity);
    if (!isCapacityValid) return;

    const status = normalizeStatus(apiTable);
    if (status === 'Occupied' || status === 'Reserved') {
      return;
    }

    const actualTableId = apiTable.table_id;
    const newSelected = selectedTableId === actualTableId ? null : actualTableId;
    
    if (onSelectTable) {
      onSelectTable(newSelected);
    }
  };

  const selectedApiTable = useMemo(() => tables.find(t => t.table_id === selectedTableId), [tables, selectedTableId]);

  return (
    <div className="table-board-container">
      <div className="tb-board__header">
        <p className="tb-board__hint">
          Select an available table. Occupied or invalid capacity tables are disabled.
        </p>
      </div>

      <div className="tb-legend" style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap', fontWeight: 600 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <span className="swatch" style={{ width: 16, height: 16, borderRadius: 4, background: '#dceaf5', border: '1.5px solid #5a8bb0' }}></span>
          Available
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <span className="swatch" style={{ width: 16, height: 16, borderRadius: 4, background: '#f6c453', border: '1.5px solid #b8862c' }}></span>
          Selected
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <span className="swatch" style={{ width: 16, height: 16, borderRadius: 4, background: '#dcdcdc', border: '1.5px solid #a3a3a3' }}></span>
          Occupied / Unavailable
        </span>
      </div>

      <FloorPlanSVG
        tables={tables}
        selectedTableId={selectedTableId}
        guestCount={guestCount}
        onTableClick={handleTableClick}
      />
      
      {selectedApiTable && (
        <div className="panel mt-4 p-4 border rounded shadow-sm bg-white">
          <strong>SELECTED TABLE: </strong> <span className="text-amber-600 ml-2">{selectedApiTable.table_number}</span>
        </div>
      )}
    </div>
  );
}
