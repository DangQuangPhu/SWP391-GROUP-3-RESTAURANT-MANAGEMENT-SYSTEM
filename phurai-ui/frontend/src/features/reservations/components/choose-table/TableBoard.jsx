import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Filter, ChevronDown, Check, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import FloorPlanSVG, { normalizeStatus } from './FloorPlanSVG';
import TablePreviewModal from './TablePreviewModal';

export default function TableBoard({
  tables = [],
  selectedTableId,
  onSelectTable,
  guestCount
}) {
  const [activeFilter, setActiveFilter] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [viewZoneImage, setViewZoneImage] = useState(null);
  const [previewTable, setPreviewTable] = useState(null); // Table object for preview modal
  const dropdownRef = useRef(null);

  // Lifted Zoom & Pan states
  const [zoomScale, setZoomScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const handleResetZoomAndPan = () => {
    setZoomScale(1);
    setPan({ x: 0, y: 0 });
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    const status = normalizeStatus(apiTable, guestCount);

    // Open Apple-style Table Preview Modal for confirmation / view
    setPreviewTable({
      code: configId,
      apiTable: apiTable || { table_number: configId, capacity: 2 },
      status
    });
  };

  const selectedApiTable = useMemo(() => tables.find(t => t.table_id === selectedTableId), [tables, selectedTableId]);

  return (
    <div className="table-board-container">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 relative" ref={dropdownRef}>
        <div className="tb-board__header m-0 p-0 border-0 bg-transparent">
          <p className="tb-board__hint">
            Select an available table. Occupied or invalid capacity tables are disabled.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* Zoom & Pan Control Bar placed next to Filter Tables */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-xs text-xs font-semibold text-gray-700">
            <span className="text-[11px] text-gray-500 mr-1 hidden md:inline">Hold Left-Click Drag | Scroll to Zoom</span>
            <button
              type="button"
              disabled={zoomScale <= 1}
              onClick={() => setZoomScale(prev => Math.max(1, prev - 0.15))}
              className={`w-7 h-7 flex items-center justify-center rounded-lg font-bold transition-all ${zoomScale <= 1 ? 'bg-gray-100 text-gray-300 cursor-not-allowed opacity-40' : 'bg-gray-100 hover:bg-gray-200 text-gray-800 cursor-pointer'}`}
              title={zoomScale <= 1 ? "Minimum zoom reached" : "Zoom Out"}
            >
              <ZoomOut size={13} />
            </button>
            <span className="font-mono text-xs w-10 text-center font-bold text-gray-900">{Math.round(zoomScale * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoomScale(prev => Math.min(2.5, prev + 0.15))}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold transition-all cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn size={13} />
            </button>
            <button
              type="button"
              onClick={handleResetZoomAndPan}
              className="p-1.5 rounded-lg bg-[#8c764b]/10 text-[#8c764b] hover:bg-[#8c764b]/20 font-bold transition-all ml-1 cursor-pointer flex items-center gap-1 text-[11px]"
              title="Reset Zoom & Pan"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          </div>

          {/* Filter Tables Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all focus:outline-none focus:ring-2 focus:ring-[#8c764b]/20 shadow-xs"
            >
              <Filter className="w-4 h-4 text-gray-500" />
              {activeFilter ? (
                <span className="font-semibold text-gray-900">
                  {activeFilter === 'Occupied' ? 'Occupied / Unavailable' : activeFilter}
                </span>
              ) : 'Filter Tables'}
              {activeFilter ? (
                <div 
                  className="ml-1 p-0.5 hover:bg-gray-200 rounded-full transition-colors"
                  onClick={(e) => { e.stopPropagation(); setActiveFilter(null); }}
                >
                  <X className="w-3.5 h-3.5 text-gray-500" />
                </div>
              ) : (
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
              )}
            </button>

            {/* Animated Dropdown Menu */}
            <div 
              className={`absolute right-0 mt-2 w-64 bg-white border border-gray-100 rounded-xl shadow-xl transform transition-all duration-200 origin-top-right z-50 ${isDropdownOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'}`}
            >
            <div className="p-2 space-y-1">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Highlight by Status
              </div>
              {[
                { label: 'Available', key: 'Available', color: '#2f7d4f', bg: 'rgba(47, 125, 79, 0.1)' },
                { label: 'Selected', key: 'Selected', color: '#b8862c', bg: '#f6c453' },
                { label: 'Reserved', key: 'Reserved', color: '#3a6ea5', bg: 'rgba(58, 110, 165, 0.1)' },
                { label: 'Cleaning', key: 'Cleaning', color: '#7c5cbf', bg: 'rgba(124, 92, 191, 0.1)' },
                { label: 'Occupied / Unavailable', key: 'Occupied', color: '#b7791f', bg: 'rgba(183, 121, 31, 0.1)' },
              ].map(item => {
                const isActive = activeFilter === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setActiveFilter(isActive ? null : item.key);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive ? 'bg-gray-50 text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="swatch" style={{ width: 14, height: 14, borderRadius: 4, background: item.bg, border: `1.5px solid ${item.color}` }}></span>
                      {item.label}
                    </div>
                    {isActive && <Check className="w-4 h-4 text-[#8c764b]" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>

      <FloorPlanSVG
        tables={tables}
        selectedTableId={selectedTableId}
        guestCount={guestCount}
        onTableClick={handleTableClick}
        activeFilter={activeFilter}
        zoomScale={zoomScale}
        setZoomScale={setZoomScale}
        pan={pan}
        setPan={setPan}
        onResetZoomAndPan={handleResetZoomAndPan}
        onViewZone={(img, label) => setViewZoneImage({ src: img, title: label })}
      />

      {/* Zone Image Viewer Modal */}
      {viewZoneImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">{viewZoneImage.title}</h3>
              <button 
                onClick={() => setViewZoneImage(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 bg-gray-50 flex justify-center">
              <img 
                src={viewZoneImage.src} 
                alt={viewZoneImage.title} 
                className="max-h-[70vh] object-contain rounded-lg shadow-inner"
              />
            </div>
          </div>
        </div>
      )}

      {/* Apple-style Table Preview Modal */}
      <TablePreviewModal
        table={previewTable?.code}
        apiTable={previewTable?.apiTable}
        tableStatus={previewTable?.status}
        isOpen={Boolean(previewTable)}
        onClose={() => setPreviewTable(null)}
        onSelect={(selectedId) => {
          if (onSelectTable) {
            onSelectTable(selectedId);
          }
          setPreviewTable(null);
        }}
      />
    </div>
  );
}
