import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import TableUnit from './TableUnit';
import { TABLES } from '../../config/floorPlanConfig';
import { validateTableCapacity } from '../../utils/validateTableCapacity';

// Normalize status based on backend API data and restaurant seating policy.
export function normalizeStatus(apiTable, guestCount, allowMultiple = false) {
  if (!apiTable) return "Inactive";

  const statusStr = (apiTable.availability_at_slot || apiTable.table_status || apiTable.status || "").toLowerCase().trim();

  if (apiTable.is_current || statusStr === "currenttable" || statusStr === "current_table") return "CurrentTable";
  if (statusStr === "occupied") return "Occupied";
  if (statusStr === "cleaning") return "Cleaning";
  if (statusStr === "reserved" || statusStr === "await check-in" || statusStr === "booked") return "Reserved";
  if (statusStr === "inactive") return "Inactive";

  if (apiTable.is_bookable === false) {
    return "Reserved";
  }

  const guests = Number(guestCount);
  const capacity = Number(apiTable.capacity);
  // Event reservations can combine tables. A 6-seat table must remain selectable
  // for an 8-person party so the guest can add a second available table.
  if (!allowMultiple && Number.isFinite(guests) && Number.isFinite(capacity) && guests > 0 && capacity > 0) {
    if (!validateTableCapacity(guests, capacity)) {
      return "InvalidCapacity";
    }
  }

  return "Available";
}

const IMAGES = {
  window: '/@fs/Users/phu/.gemini/antigravity-ide/brain/4f85d582-51c9-42b3-b311-de3c3d6b74b0/window_zone_view_1782253604685.png',
  vip: '/@fs/Users/phu/.gemini/antigravity-ide/brain/4f85d582-51c9-42b3-b311-de3c3d6b74b0/vip_room_view_1782253615699.png',
  standard: '/@fs/Users/phu/.gemini/antigravity-ide/brain/4f85d582-51c9-42b3-b311-de3c3d6b74b0/standard_dining_view_1782253625329.png',
  premium: '/@fs/Users/phu/.gemini/antigravity-ide/brain/4f85d582-51c9-42b3-b311-de3c3d6b74b0/premium_dining_view_1782253635769.png',
  private: '/@fs/Users/phu/.gemini/antigravity-ide/brain/4f85d582-51c9-42b3-b311-de3c3d6b74b0/private_room_view_1782253645615.png',
  kitchen: '/@fs/Users/phu/.gemini/antigravity-ide/brain/4f85d582-51c9-42b3-b311-de3c3d6b74b0/kitchen_view_4_chairs_1782254469257.png'
};

// The production seed uses compact codes (S01, P01, R01, K01) while the
// illustrated floor plan uses display codes (S-01, PRE-01, PR-01, K-01).
// Keep the API authoritative but resolve both forms before assigning a status.
function tableCodeAliases(code) {
  const value = String(code || '').trim().toUpperCase();
  const compact = value.replace(/-/g, '');
  const aliases = [value, compact];
  if (value.startsWith('PRE-')) aliases.push(`P${value.slice(4)}`);
  if (value.startsWith('PR-')) aliases.push(`R${value.slice(3)}`);
  return [...new Set(aliases)];
}

const ZoneViewButton = ({ x, y, label, img, onViewZone }) => {
  if (!onViewZone) return null;
  return (
    <foreignObject x={x} y={y} width="65" height="25" style={{ overflow: 'visible' }}>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onViewZone(img, label); }}
        className="flex items-center justify-center gap-1.5 w-full h-full bg-white/95 backdrop-blur-sm border-2 border-[#8c764b] text-[#8c764b] rounded-full text-[10px] font-bold shadow-md hover:bg-[#8c764b] hover:text-white transition-all hover:scale-105 cursor-pointer"
        style={{ pointerEvents: 'auto' }}
      >
        <Eye className="w-1.5 h-1.5" />
        <span>VIEW</span>
      </button>
    </foreignObject>
  );
};

export default function FloorPlanSVG({
  tables = [],
  selectedTableId,
  selectedTableIds = [],
  currentTableId,
  guestCount,
  allowMultiple = false,
  onTableClick,
  activeFilter = null,
  activeAreaId = null,
  searchQuery = '',
  zoomScale: externalZoomScale,
  setZoomScale: externalSetZoomScale,
  pan: externalPan,
  setPan: externalSetPan,
  onResetZoomAndPan,
  onViewZone
}) {
  const [activeTooltip, setActiveTooltip] = useState(null);
  const [internalZoomScale, setInternalZoomScale] = useState(1);
  const [internalPan, setInternalPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const zoomScale = externalZoomScale !== undefined ? externalZoomScale : internalZoomScale;
  const setZoomScale = externalSetZoomScale || setInternalZoomScale;
  const pan = externalPan !== undefined ? externalPan : internalPan;
  const setPan = externalSetPan || setInternalPan;
  
  const dragStartRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const containerRef = useRef(null);

  // Helper to clamp pan offset within map boundary when zoomed in
  const getClampedPan = (rawX, rawY, scale) => {
    if (scale <= 1 || !containerRef.current) {
      return { x: 0, y: 0 };
    }
    const rect = containerRef.current.getBoundingClientRect();
    const maxPanX = (rect.width * (scale - 1)) / 2;
    const maxPanY = (rect.height * (scale - 1)) / 2;

    return {
      x: Math.max(-maxPanX, Math.min(maxPanX, rawX)),
      y: Math.max(-maxPanY, Math.min(maxPanY, rawY))
    };
  };

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.table-unit')) {
        setActiveTooltip(null);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (zoomScale <= 1) {
      setPan({ x: 0, y: 0 });
    } else {
      setPan(prev => getClampedPan(prev.x, prev.y, zoomScale));
    }
  }, [zoomScale]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.12 : -0.12;
      setZoomScale(prev => Math.min(2.5, Math.max(1.0, prev + delta)));
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [setZoomScale]);

  // Mouse Drag / Pan Handlers
  const handleMouseDown = (e) => {
    if (e.button !== 0 || zoomScale <= 1) return; // Only drag when zoomed in (> 100%)
    if (e.target.closest('button') || e.target.closest('.zone-view-btn')) return;

    setIsDragging(true);
    hasDraggedRef.current = false;
    dragStartRef.current = {
      x: e.clientX - pan.x,
      y: e.clientY - pan.y
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging || zoomScale <= 1) return;
    const rawX = e.clientX - dragStartRef.current.x;
    const rawY = e.clientY - dragStartRef.current.y;
    if (Math.abs(rawX - pan.x) > 3 || Math.abs(rawY - pan.y) > 3) {
      hasDraggedRef.current = true;
    }
    setPan(getClampedPan(rawX, rawY, zoomScale));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // We need to map config Table ID (e.g. "S-03") to API Table object
  const apiTableMap = useMemo(() => {
    const map = new Map();
    tables.forEach(t => {
      tableCodeAliases(t.table_number).forEach((key) => map.set(key, t));
    });
    return map;
  }, [tables]);

  const handleShowTooltip = (e, tableConfig, apiTable, status) => {
    if (isDragging) return;
    let text = "";
    if (status === 'CurrentTable') {
      text = "Your current table (Bàn hiện tại của bạn)";
    } else if (status === 'Occupied' && apiTable?.estimated_release_at) {
      const releaseTime = new Date(apiTable.estimated_release_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      text = `Table occupied, expected release at ${releaseTime}`;
    } else if (status === 'Occupied') {
      text = "Table currently occupied";
    } else if (status === 'Reserved') {
      text = "Table currently reserved";
    } else if (status === 'Cleaning') {
      text = "Table currently being cleaned";
    } else if (status === 'InvalidCapacity') {
      const cap = apiTable?.capacity || tableConfig.capacity || 2;
      text = `Table ${tableConfig.id} has ${cap} seats and does not fit ${guestCount || 0} guest(s)`;
    } else {
      const cap = apiTable?.capacity || tableConfig.capacity || 2;
      text = `Table ${tableConfig.id} (${cap} seats)`;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const svgEl = e.currentTarget.ownerSVGElement || document.getElementById('floorplan-svg');
    if (!svgEl) return;
    const parentRect = svgEl.getBoundingClientRect();

    const x = rect.left - parentRect.left + rect.width / 2;
    const y = rect.top - parentRect.top - 6;

    setActiveTooltip({
      tableId: tableConfig.id,
      x,
      y,
      text
    });
  };

  const handleHideTooltip = () => {
    setActiveTooltip(null);
  };

  const isReducedMotion = typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
    : false;

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className={`floorplan-box w-full flex items-center justify-center relative overflow-hidden select-none ${zoomScale > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'}`}
      style={{ touchAction: 'none' }}
    >
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomScale})`,
          transformOrigin: 'center center',
          transition: isDragging ? 'none' : 'transform 0.12s cubic-bezier(0.16, 1, 0.3, 1)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <svg
          id="floorplan-svg"
          className="w-full h-full"
          viewBox="18 18 1294 884"
          preserveAspectRatio="xMidYMid meet"
          xmlns="http://www.w3.org/2000/svg"
        >
        <defs>
          {/* Graph paper grid pattern */}
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(142, 128, 106, 0.08)" strokeWidth="1" />
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(142, 128, 106, 0.03)" strokeWidth="0.5" />
          </pattern>
        </defs>

        <rect x="18" y="18" width="1294" height="884" fill="#fffdf9" rx="8" />
        <rect x="18" y="18" width="1294" height="884" fill="url(#grid)" stroke="rgba(142, 128, 106, 0.25)" strokeWidth="3" rx="8" />

        <rect className="zone-rect" x="20" y="20" width="240" height="170" rx="6" fill="rgba(250, 249, 246, 0.45)" stroke="#cdb27e" strokeWidth="1.5" strokeDasharray="6 3" />
        <text className="zone-label" x="140" y="45">WINDOW ZONE A</text>

        <rect className="zone-rect" x="280" y="20" width="240" height="170" rx="6" fill="rgba(250, 249, 246, 0.45)" stroke="#cdb27e" strokeWidth="1.5" strokeDasharray="6 3" />
        <text className="zone-label" x="400" y="45">WINDOW ZONE B</text>

        <rect className="zone-rect alt" x="540" y="20" width="200" height="170" rx="6" fill="transparent" stroke="none" />
        <text className="zone-label" x="640" y="45">RECEPTION</text>
        <circle cx="640" cy="115" r="30" fill="#f5e9d6" stroke="#cdb27e" strokeWidth="1.5" />

        <rect className="zone-rect" x="760" y="20" width="240" height="170" rx="6" fill="rgba(250, 249, 246, 0.45)" stroke="#cdb27e" strokeWidth="1.5" strokeDasharray="6 3" />
        <text className="zone-label" x="880" y="45">WINDOW ZONE C</text>

        <rect className="zone-rect" x="1020" y="20" width="290" height="170" rx="6" fill="rgba(250, 249, 246, 0.45)" stroke="#cdb27e" strokeWidth="1.5" strokeDasharray="6 3" />
        <text className="zone-label" x="1165" y="45">WINDOW ZONE D</text>

        <rect className="zone-rect" x="20" y="210" width="240" height="150" rx="6" fill="rgba(253, 244, 244, 0.45)" stroke="#cdb27e" strokeWidth="1.5" strokeDasharray="6 3" />
        <text className="zone-label" x="140" y="225">VIP ROOM 1</text>

        <rect className="zone-rect" x="20" y="380" width="240" height="150" rx="6" fill="rgba(253, 244, 244, 0.45)" stroke="#cdb27e" strokeWidth="1.5" strokeDasharray="6 3" />
        <text className="zone-label" x="140" y="395">VIP ROOM 2</text>

        <rect className="zone-rect" x="20" y="550" width="240" height="150" rx="6" fill="rgba(253, 244, 244, 0.45)" stroke="#cdb27e" strokeWidth="1.5" strokeDasharray="6 3" />
        <text className="zone-label" x="140" y="565">VIP ROOM 3</text>

        <rect className="zone-rect" x="20" y="720" width="240" height="80" rx="6" fill="rgba(250, 249, 246, 0.45)" stroke="#cdb27e" strokeWidth="1.5" strokeDasharray="6 3" />
        <text className="sub-label" x="140" y="765">LADIES RESTROOM</text>
        <rect className="zone-rect" x="20" y="820" width="240" height="80" rx="6" fill="rgba(250, 249, 246, 0.45)" stroke="#cdb27e" strokeWidth="1.5" strokeDasharray="6 3" />
        <text className="sub-label" x="140" y="865">MEN RESTROOM</text>

        <rect className="zone-rect" x="280" y="210" width="560" height="490" rx="6" fill="rgba(250, 249, 246, 0.45)" stroke="#cdb27e" strokeWidth="1.5" strokeDasharray="6 3" />
        <text className="zone-label" x="560" y="235">STANDARD DINING AREA</text>

        <rect className="zone-rect" x="860" y="210" width="140" height="490" rx="6" fill="rgba(253, 248, 240, 0.45)" stroke="#cdb27e" strokeWidth="1.5" strokeDasharray="6 3" />
        <text className="zone-label" x="930" y="235">PREMIUM</text>

        <rect className="zone-rect" x="1020" y="210" width="290" height="155" rx="6" fill="rgba(249, 245, 250, 0.45)" stroke="#cdb27e" strokeWidth="1.5" strokeDasharray="6 3" />
        <text className="zone-label" x="1165" y="235">PRIVATE ROOM 1</text>

        <rect className="zone-rect" x="1020" y="380" width="290" height="155" rx="6" fill="rgba(249, 245, 250, 0.45)" stroke="#cdb27e" strokeWidth="1.5" strokeDasharray="6 3" />
        <text className="zone-label" x="1165" y="405">PRIVATE ROOM 2</text>

        <rect className="zone-rect" x="1020" y="550" width="290" height="155" rx="6" fill="rgba(249, 245, 250, 0.45)" stroke="#cdb27e" strokeWidth="1.5" strokeDasharray="6 3" />
        <text className="zone-label" x="1165" y="575">PRIVATE ROOM 3</text>

        <rect className="zone-rect" x="1020" y="720" width="290" height="180" rx="6" fill="rgba(249, 245, 250, 0.45)" stroke="#cdb27e" strokeWidth="1.5" strokeDasharray="6 3" />
        <text className="zone-label" x="1165" y="745">PRIVATE ROOM 4</text>

        <rect className="zone-rect" rx="6" height="180" width="420" y="720" x="280" fill="rgba(250, 249, 246, 0.45)" stroke="#cdb27e" strokeWidth="1.5" strokeDasharray="6 3" />
        <text className="zone-label" x="490" y="745">KITCHEN VIEW AREA</text>

        <rect className="zone-rect" x="710" y="720" width="300" height="180" rx="6" fill="rgba(250, 249, 246, 0.45)" stroke="#cdb27e" strokeWidth="1.5" strokeDasharray="6 3" />
        <text className="zone-label" x="860" y="810">KITCHEN AREA</text>

        <g id="tables-layer">
          {TABLES.map((tableConfig) => {
            const apiTable = tableCodeAliases(tableConfig.id).map((key) => apiTableMap.get(key)).find(Boolean);
            let status = normalizeStatus(apiTable, guestCount, allowMultiple);

            const isSelected = apiTable && (selectedTableIds.map(String).includes(String(apiTable.table_id)) || String(selectedTableId) === String(apiTable.table_id));
            const isCurrent = apiTable && String(currentTableId) === String(apiTable.table_id);

            let visualStatus = status;
            if (isCurrent) {
              visualStatus = 'CurrentTable';
              status = 'CurrentTable';
            } else if (isSelected) {
              visualStatus = 'Selected';
            }

            const searchable = `${tableConfig.id} ${apiTable?.table_number || ''} ${apiTable?.area_name || ''}`.toLowerCase();
            const isDimmed = (activeFilter !== null && visualStatus !== activeFilter)
              || (activeAreaId !== null && String(apiTable?.area_id) !== String(activeAreaId))
              || (searchQuery.trim() && !searchable.includes(searchQuery.trim().toLowerCase()));

            return (
              <TableUnit
                key={tableConfig.id}
                tableData={tableConfig}
                status={status}
                isSelected={isSelected}
                isDimmed={isDimmed}
                onClick={onTableClick}
                onShowTooltip={(e) => handleShowTooltip(e, tableConfig, apiTable, status)}
                onHideTooltip={handleHideTooltip}
              />
            );
          })}
        </g>
      </svg>
      </div>

      <AnimatePresence>
        {activeTooltip && (
          <motion.div
            initial={isReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={isReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 5 }}
            transition={isReducedMotion ? { duration: 0.1 } : { type: "spring", stiffness: 350, damping: 22 }}
            style={{
              position: 'absolute',
              left: activeTooltip.x,
              top: activeTooltip.y,
              transform: 'translate(-50%, -100%)',
              zIndex: 100,
              pointerEvents: 'none',
            }}
          >
            <div style={{
              backgroundColor: '#111827',
              color: '#ffffff',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '500',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              whiteSpace: 'nowrap',
              position: 'relative',
            }}>
              {activeTooltip.text}
              <div style={{
                position: 'absolute',
                bottom: '-4px',
                left: '50%',
                transform: 'translateX(-50%) rotate(45deg)',
                width: '8px',
                height: '8px',
                backgroundColor: '#111827',
                borderRight: '1px solid rgba(255, 255, 255, 0.12)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
              }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
