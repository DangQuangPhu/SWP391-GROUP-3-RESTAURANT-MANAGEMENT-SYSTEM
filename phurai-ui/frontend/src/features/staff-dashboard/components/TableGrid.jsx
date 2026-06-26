import React from 'react';
import { useStaffStore } from '../store/staffStore';
import '../styles/staff-table-tab.css';

export default function TableGrid({ onSelectTable }) {
  const tables = useStaffStore(state => state.tables);

  if (!tables || tables.length === 0) {
    return (
      <div className="sfx-shell__empty">
        <p className="sfx-note">No table data.</p>
      </div>
    );
  }

  return (
    <div className="sfx-mtiles" style={{ padding: '20px' }}>
      {tables.map(table => {
        const statusLower = table.table_status?.toLowerCase();
        const isOccupied = statusLower === 'occupied';
        const isCleaning = statusLower === 'cleaning';
        const isReserved = statusLower === 'reserved';
        const isAvailable = statusLower === 'available';

        let statusClass = 'staff-table-status--muted';
        if (isAvailable) statusClass = 'staff-table-status--available';
        if (isOccupied) statusClass = 'staff-table-status--occupied';
        if (isCleaning) statusClass = 'staff-table-status--cleaning';
        if (isReserved) statusClass = 'staff-table-status--reserved';

        return (
          <button
            key={table.table_id}
            onClick={() => onSelectTable && onSelectTable(table)}
            className={`sfx-mtile ${isOccupied ? 'is-occupied' : ''} ${isReserved ? 'is-reserved' : ''}`}
          >
            <div className="sfx-mtile__head">
              <span className="sfx-mtile__title">Table {table.table_number}</span>
              <span className="sfx-mtile__cap">{table.capacity} seats</span>
            </div>
            <div className="sfx-mtile__body" style={{ marginTop: 'auto' }}>
              <span className={`staff-table-status ${statusClass}`}>
                {table.table_status}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
