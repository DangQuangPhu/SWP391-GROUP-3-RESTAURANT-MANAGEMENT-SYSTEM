import React from "react";
export default function TableStatusCard({ table, status, isSelected, onClick, isSuitable, guestCount, isLocked, requiredTier }) {
  const { table_id, table_number, display_label, capacity, area_name } = table;
  let label = display_label || table_number;
  let areaLabel = area_name || "Standard";
  
  const isClickable = status === "AVAILABLE" && isSuitable;
  // If locked, it can still be "clickable" in terms of opening the modal, but the parent handles that. We just need to add a visually locked style.
  
  let statusClass = "";
  if (isSelected) {
    statusClass = "tb-card--selected";
  } else {
    switch (status) {
      case "AVAILABLE":
        statusClass = "tb-card--available";
        break;
      case "RESERVED":
        statusClass = "tb-card--reserved";
        break;
      case "OCCUPIED":
        statusClass = "tb-card--occupied";
        break;
      case "CLEANING":
        statusClass = "tb-card--cleaning";
        break;
      default:
        statusClass = "tb-card--inactive";
        break;
    }
  }
  const handleClick = () => {
    if (isClickable || isSelected) {
      onClick(table_id);
    }
  };
  const formattedStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  let displayStatus = isSelected ? "Selected" : formattedStatus;
  if (isLocked && status === "AVAILABLE" && isSuitable) {
    displayStatus = `Requires ${requiredTier}`;
  }

  return (
    <div
      className={`tb-card ${statusClass} ${isClickable ? "tb-card--clickable" : ""}`}
      style={{
        opacity: isLocked && status === "AVAILABLE" ? 0.7 : 1,
        position: "relative"
      }}
      onClick={handleClick}
      role="button"
      tabIndex={isClickable || isSelected ? 0 : -1}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && (isClickable || isSelected)) {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="tb-card__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="6" width="16" height="12" rx="2" ry="2"></rect>
          <path d="M4 10h16"></path>
          <path d="M12 6v12"></path>
        </svg>
      </div>
      <div className="tb-card__id">
        {label}
        {isLocked && status === "AVAILABLE" && (
          <span style={{ marginLeft: "6px", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--rzv-gold, #d4af37)", color: "#000", borderRadius: "50%", width: "16px", height: "16px" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: "10px", height: "10px" }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </span>
        )}
      </div>
      <div className="tb-card__capacity" style={{ fontSize: "0.85rem", opacity: 0.8 }}>{capacity} seats</div>
      <div className="tb-card__status" style={{ color: isLocked && status === "AVAILABLE" && isSuitable ? "var(--rzv-gold, #d4af37)" : undefined }}>
        {displayStatus}
      </div>
      <div className="tb-card__area">{areaLabel}</div>
      {!isSuitable && status === "AVAILABLE" && (
        <div className="tb-card__warning" style={{ fontSize: "0.7rem", color: "var(--rzv-red)", marginTop: "4px" }}>
          Not suitable for {guestCount} guests
        </div>
      )}
    </div>
  );
}