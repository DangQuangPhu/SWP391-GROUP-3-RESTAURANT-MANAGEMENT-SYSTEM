import React from "react";
const FILTERS = [
  { id: "all", label: "All Tables" },
  { id: "window", label: "Window" },
  { id: "standard", label: "Standard" },
  { id: "premium", label: "Premium" },
  { id: "vip", label: "VIP / Private" },
  { id: "kitchen", label: "Kitchen View" },
  { id: "rooftop", label: "Rooftop / Outdoor" },
];
export default function TableBoardFilter({ activeFilter, onFilterChange }) {
  return (
    <div className="tb-filter-container">
      <div className="tb-filter-chips">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`tb-chip ${activeFilter === f.id ? "tb-chip--active" : ""}`}
            onClick={() => onFilterChange(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}