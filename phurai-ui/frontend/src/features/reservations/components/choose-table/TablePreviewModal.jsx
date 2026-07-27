import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Users, AlertTriangle, Maximize2, X } from 'lucide-react';
import { getTableInfo } from '../../data/tableImages';
import '../../styles/table-preview-modal.css';

function getTableStatus(apiTable) {
  if (!apiTable) return 'Available';
  if (apiTable.is_bookable === false) {
    const avail = (apiTable.availability_at_slot || "").toLowerCase();
    if (avail === "occupied") return "Occupied";
    if (avail === "cleaning") return "Cleaning";
    if (avail === "inactive") return "Occupied";
    return "Reserved";
  }
  return "Available";
}

export default function TablePreviewModal({
  table,
  apiTable,
  tableStatus,
  isOpen,
  onClose,
  onSelect
}) {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const tableCode = table || apiTable?.table_number || 'TABLE';
  const tableInfo = getTableInfo(tableCode, apiTable);
  const status = tableStatus || getTableStatus(apiTable);
  const isAvailable = status === 'Available';

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      if (isLightboxOpen) {
        setIsLightboxOpen(false);
      } else {
        onClose();
      }
    }
  }, [onClose, isLightboxOpen]);

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !table) return null;

  const handleSelectClick = () => {
    if (!isAvailable) return;
    const tableIdentifier = apiTable?.table_id || tableCode;
    onSelect(tableIdentifier);
    onClose();
  };

  return createPortal(
    <>
      <div className="tpm-overlay" onClick={onClose} role="dialog" aria-modal="true">
        <div className="tpm-card" onClick={(e) => e.stopPropagation()}>
          {/* Preview Image Header with Click-to-Expand */}
          <div
            className="tpm-image-wrap"
            onClick={() => setIsLightboxOpen(true)}
          >
            <img src={tableInfo.image} alt={tableCode} className="tpm-image" />
            <div className="tpm-image-badge">{tableInfo.zone}</div>
            
            <div className="tpm-expand-hint">
              <Maximize2 size={13} />
              <span>Click for full screen</span>
            </div>

            <button
              type="button"
              className="tpm-close-btn"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>

          {/* Info Content Section */}
          <div className="tpm-body">
            <div className="tpm-header">
              <div className="tpm-title-group">
                <h3 className="tpm-table-code">Table {tableCode}</h3>
                <p className="tpm-zone-name">{tableInfo.zone}</p>
              </div>
              <div className="tpm-capacity-badge">
                <Users size={15} />
                <span>{tableInfo.capacity} Guests</span>
              </div>
            </div>

            <p className="tpm-description">{tableInfo.description}</p>

            <div className="tpm-features">
              <span className="tpm-feature-chip">Prime View</span>
              <span className="tpm-feature-chip">Fine Dining Setup</span>
              <span className="tpm-feature-chip">Table Service</span>
            </div>

            {/* Red Alert Banner if Table is Occupied / Reserved / Cleaning */}
            {!isAvailable && (
              <div className="tpm-alert-banner">
                <AlertTriangle size={18} className="tpm-alert-icon" />
                <span>This table is currently unavailable ({status}). Please select another table.</span>
              </div>
            )}
          </div>

          {/* Fixed Action Bar — Strictly Cancel & Select */}
          <div className="tpm-actions">
            <button
              type="button"
              className="tpm-btn-cancel"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`tpm-btn-select${!isAvailable ? ' tpm-btn-select--disabled' : ''}`}
              onClick={handleSelectClick}
              disabled={!isAvailable}
            >
              Select
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen Lightbox Modal */}
      {isLightboxOpen && (
        <div
          className="tpm-lightbox-overlay"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div
            className="tpm-lightbox-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="tpm-lightbox-close"
              onClick={() => setIsLightboxOpen(false)}
            >
              <X size={20} />
            </button>
            <img src={tableInfo.image} alt={tableCode} className="tpm-lightbox-img" />
            <div className="tpm-lightbox-caption">Table {tableCode} — {tableInfo.zone}</div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
