import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye } from 'lucide-react';
import TableUnit from './TableUnit';
import { TABLES } from '../../config/floorPlanConfig';
import { validateTableCapacity } from '../../utils/validateTableCapacity';

// Normalize status based on backend API data
function normalizeStatus(apiTable) {
  if (apiTable.is_bookable === false) {
    const avail = apiTable.availability_at_slot || "";
    const lowerAvail = avail.toLowerCase();
    if (lowerAvail === "occupied") return "Occupied";
    if (lowerAvail === "cleaning") return "Cleaning";
    if (lowerAvail === "inactive") return "Occupied";
    return "Reserved";
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
  guestCount,
  onTableClick,
  activeFilter = null,
  onViewZone
}) {
  const [activeTooltip, setActiveTooltip] = useState(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.table-unit')) {
        setActiveTooltip(null);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // We need to map config Table ID (e.g. "S-03") to API Table object
  const apiTableMap = useMemo(() => {
    const map = new Map();
    tables.forEach(t => {
      map.set(t.table_number, t);
    });
    return map;
  }, [tables]);

  const handleShowTooltip = (e, tableConfig, apiTable, status) => {
    let text = "";
    if (status === 'Occupied' && apiTable?.estimated_release_at) {
      const releaseTime = new Date(apiTable.estimated_release_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      text = `Bàn đang có khách, dự kiến trống lúc ${releaseTime}`;
    } else if (status === 'Occupied') {
      text = "Bàn đang có khách";
    } else if (status === 'Reserved') {
      text = "Bàn đã được đặt trước";
    } else if (status === 'Cleaning') {
      text = "Bàn đang được dọn dẹp";
    } else {
      const cap = apiTable?.capacity || tableConfig.capacity || 2;
      text = `Bàn ${tableConfig.id} (${cap} chỗ)`;
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
    <div className="floorplan-box w-full flex items-center justify-center relative">
      <svg id="floorplan-svg" className="w-full" viewBox="18 18 1294 884" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Graph paper grid pattern */}
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(142, 128, 106, 0.08)" strokeWidth="1" />
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(142, 128, 106, 0.03)" strokeWidth="0.5" />
          </pattern>
        </defs>

        <rect x="18" y="18" width="1294" height="884" fill="#fffdf9" rx="8" />
        <rect x="18" y="18" width="1294" height="884" fill="url(#grid)" stroke="rgba(142, 128, 106, 0.25)" strokeWidth="3" rx="8" />

        <rect className="zone-rect" x="20" y="20" width="240" height="170" rx="6" />
        <text className="zone-label" x="140" y="45">WINDOW ZONE A</text>
        <ZoneViewButton x={18} y={48} label="Window Zone A" img={IMAGES.window} onViewZone={onViewZone} />

        <rect className="zone-rect" x="280" y="20" width="240" height="170" rx="6" />
        <text className="zone-label" x="400" y="45">WINDOW ZONE B</text>
        <ZoneViewButton x={276} y={48} label="Window Zone B" img={IMAGES.window} onViewZone={onViewZone} />

        <rect className="zone-rect alt" x="540" y="20" width="200" height="170" rx="6" />
        <text className="zone-label" x="640" y="45">RECEPTION</text>
        <circle cx="640" cy="115" r="30" fill="#f5e9d6" stroke="#cdb27e" strokeWidth="1.5" />

        <rect className="zone-rect" x="760" y="20" width="240" height="170" rx="6" />
        <text className="zone-label" x="880" y="45">WINDOW ZONE C</text>
        <ZoneViewButton x={756} y={48} label="Window Zone C" img={IMAGES.window} onViewZone={onViewZone} />

        <rect className="zone-rect" x="1020" y="20" width="290" height="170" rx="6" />
        <text className="zone-label" x="1165" y="45">WINDOW ZONE D</text>
        <ZoneViewButton x={1019} y={48} label="Window Zone D" img={IMAGES.window} onViewZone={onViewZone} />

        <rect className="zone-rect" x="20" y="210" width="240" height="150" rx="6" fill="rgba(253, 244, 244, 0.45)" />
        <text className="zone-label" x="140" y="225">VIP ROOM 1</text>
        <ZoneViewButton x={26} y={216} label="VIP Room 1" img={IMAGES.vip} onViewZone={onViewZone} />

        <rect className="zone-rect" x="20" y="380" width="240" height="150" rx="6" fill="rgba(253, 244, 244, 0.45)" />
        <text className="zone-label" x="140" y="395">VIP ROOM 2</text>
        <ZoneViewButton x={26} y={386} label="VIP Room 2" img={IMAGES.vip} onViewZone={onViewZone} />

        <rect className="zone-rect" x="20" y="550" width="240" height="150" rx="6" fill="rgba(253, 244, 244, 0.45)" />
        <text className="zone-label" x="140" y="565">VIP ROOM 3</text>
        <ZoneViewButton x={26} y={556} label="VIP Room 3" img={IMAGES.vip} onViewZone={onViewZone} />

        <rect className="zone-rect" x="20" y="720" width="240" height="80" rx="6" />
        <text className="sub-label" x="140" y="765">LADIES RESTROOM</text>
        <rect className="zone-rect" x="20" y="820" width="240" height="80" rx="6" />
        <text className="sub-label" x="140" y="865">MEN RESTROOM</text>

        <rect className="zone-rect" x="280" y="210" width="560" height="490" rx="6" />
        <text className="zone-label" x="560" y="235">STANDARD DINING AREA</text>
        <ZoneViewButton x={286} y={216} label="Standard Dining Area" img={IMAGES.standard} onViewZone={onViewZone} />

        <rect className="zone-rect" x="860" y="210" width="140" height="490" rx="6" fill="rgba(253, 248, 240, 0.45)" />
        <text className="zone-label" x="930" y="235">PREMIUM</text>
        <ZoneViewButton x={816} y={216} label="Premium Dining Area" img={IMAGES.premium} onViewZone={onViewZone} />

        <rect className="zone-rect" x="1020" y="210" width="290" height="155" rx="6" fill="rgba(249, 245, 250, 0.45)" />
        <text className="zone-label" x="1165" y="235">PRIVATE ROOM 1</text>
        <ZoneViewButton x={1026} y={216} label="Private Room 1" img={IMAGES.private} onViewZone={onViewZone} />

        <rect className="zone-rect" x="1020" y="380" width="290" height="155" rx="6" fill="rgba(249, 245, 250, 0.45)" />
        <text className="zone-label" x="1165" y="405">PRIVATE ROOM 2</text>
        <ZoneViewButton x={1026} y={386} label="Private Room 2" img={IMAGES.private} onViewZone={onViewZone} />

        <rect className="zone-rect" x="1020" y="550" width="290" height="155" rx="6" fill="rgba(249, 245, 250, 0.45)" />
        <text className="zone-label" x="1165" y="575">PRIVATE ROOM 3</text>
        <ZoneViewButton x={1026} y={556} label="Private Room 3" img={IMAGES.private} onViewZone={onViewZone} />

        <rect className="zone-rect" x="1020" y="720" width="290" height="180" rx="6" fill="rgba(249, 245, 250, 0.45)" />
        <text className="zone-label" x="1165" y="745">PRIVATE ROOM 4</text>
        <ZoneViewButton x={1026} y={726} label="Private Room 4" img={IMAGES.private} onViewZone={onViewZone} />

        <rect className="zone-rect" rx="6" height="180" width="420" y="720" x="280" />
        <text className="zone-label" x="490" y="745">KITCHEN VIEW AREA</text>
        <ZoneViewButton x={288} y={726} label="Kitchen View Area" img={IMAGES.kitchen} onViewZone={onViewZone} />

        <rect className="zone-rect" x="710" y="720" width="300" height="180" rx="6" />
        <text className="zone-label" x="860" y="810">KITCHEN AREA</text>

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

            let visualStatus = status;
            if (isSelected) {
              visualStatus = 'Selected';
            }

            const isDimmed = activeFilter !== null && visualStatus !== activeFilter;

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
