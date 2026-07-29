function isOccupied(table) {
  const raw = String(table?.table_status ?? table?.status ?? "").trim().toLowerCase();
  return raw === "occupied";
}

function TableStageIndicator({ table, compact = false }) {
  if (!isOccupied(table) || !table?.course_stage) return null;

  const detail = table.course_stage_detail || table.active_order_status || "Active dining";

  return (
    <span className={`table-stage${compact ? " table-stage--compact" : ""}`}>
      <span className="table-stage__label">Stage</span>
      <strong className="table-stage__value">{table.course_stage}</strong>
      {!compact ? <small className="table-stage__detail">{detail}</small> : null}
    </span>
  );
}

export default TableStageIndicator;
