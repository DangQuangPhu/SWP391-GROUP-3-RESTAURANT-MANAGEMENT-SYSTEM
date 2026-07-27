import React, { useMemo } from 'react';
import { SHAPES, getChairPositions } from '../../config/floorPlanConfig';
import '../../styles/table-board.css';

export default function TableUnit({ tableData, status, isSelected, isDimmed, onClick, onShowTooltip, onHideTooltip }) {
  const profile = SHAPES[tableData.type];

  const handleTableClick = (e) => {
    onHideTooltip();
    onClick(tableData.id);
  };

  const chairs = useMemo(() => getChairPositions(profile), [profile]);

  const maxRy = profile.shape === 'circle' ? profile.r : (profile.shape === 'rect' ? profile.h / 2 : profile.ry);
  const textY = maxRy + profile.gap + 16;

  let shapeSVG = null;
  if (profile.shape === 'circle') {
    shapeSVG = <circle className="table-shape" r={profile.r} fill={tableData.fill || "#dceaf5"} stroke="#2f7d4f" strokeWidth="2" />;
  } else if (profile.shape === 'ellipse') {
    shapeSVG = <ellipse className="table-shape" rx={profile.rx} ry={profile.ry} fill={tableData.fill || "#dceaf5"} stroke="#2f7d4f" strokeWidth="2" />;
  } else if (profile.shape === 'rect') {
    shapeSVG = (
      <rect
        className="table-shape"
        x={-profile.w / 2}
        y={-profile.h / 2}
        width={profile.w}
        height={profile.h}
        rx={profile.rx}
        ry={profile.ry}
        fill={tableData.fill || "#dceaf5"}
        stroke="#2f7d4f"
        strokeWidth="2"
      />
    );
  }

  let statusClass = 'available';
  if (status === 'Occupied') {
    statusClass = 'occupied';
  } else if (status === 'Reserved') {
    statusClass = 'reserved';
  } else if (status === 'Cleaning') {
    statusClass = 'cleaning';
  } else if (isSelected) {
    statusClass = 'selected';
  }

  const style = {
    '--table-fill': tableData.fill || '#dceaf5',
    '--chair-fill': tableData.chair || '#cfe3da',
    opacity: isDimmed ? 0.35 : 1,
    cursor: 'pointer',
    pointerEvents: 'auto',
    transition: 'opacity 0.2s ease'
  };

  return (
    <g
      id={`tbl-${tableData.id}`}
      className={`table-unit ${statusClass}`}
      data-id={tableData.id}
      data-capacity={profile.n}
      transform={`translate(${tableData.x},${tableData.y})`}
      style={style}
      onClick={handleTableClick}
      onMouseEnter={onShowTooltip}
      onMouseLeave={onHideTooltip}
    >
      {chairs.map((p, index) => (
        <rect
          key={index}
          className="chair"
          x={(p.x - 9).toFixed(1)}
          y={(p.y - 7).toFixed(1)}
          width="18"
          height="14"
          rx="4"
          transform={`rotate(${p.rot.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)})`}
        />
      ))}
      {shapeSVG}
      <text className="table-label" y={textY}>
        {tableData.id}
      </text>
    </g>
  );
}
