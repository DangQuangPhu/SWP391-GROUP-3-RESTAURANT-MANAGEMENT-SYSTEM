import React from 'react';
import { motion } from 'framer-motion';
import '../styles/liquidGlass.css';

export default function MenuPagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', margin: '40px 0 20px 0' }}>
      <div 
        className="liquid-glass-container"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 14px',
          background: 'rgba(255, 255, 255, 0.9)',
          borderRadius: '9999px',
          border: '1px solid rgba(208, 197, 186, 0.5)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
        }}
      >
        {/* Previous Button */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          style={{
            border: 'none',
            background: currentPage === 1 ? 'transparent' : 'rgba(197, 168, 128, 0.15)',
            color: currentPage === 1 ? '#d1d5db' : '#342716',
            fontWeight: '700',
            fontSize: '0.85rem',
            padding: '6px 14px',
            borderRadius: '9999px',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          Previous
        </motion.button>

        {/* First Page indicator if scrolled far */}
        {pages[0] > 1 && (
          <>
            <button
              type="button"
              onClick={() => onPageChange(1)}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#4d463d',
                fontWeight: '600',
                padding: '6px 12px',
                borderRadius: '9999px',
                cursor: 'pointer'
              }}
            >
              1
            </button>
            {pages[0] > 2 && <span style={{ color: '#9ca3af', padding: '0 4px' }}>...</span>}
          </>
        )}

        {/* Page Numbers with Apple Spring Pill animation */}
        {pages.map((page) => {
          const isActive = page === currentPage;
          return (
            <motion.button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              style={{
                position: 'relative',
                border: 'none',
                background: isActive ? '#342716' : 'transparent',
                color: isActive ? '#ffffff' : '#4d463d',
                fontWeight: isActive ? '800' : '600',
                fontSize: '0.88rem',
                padding: '6px 14px',
                borderRadius: '9999px',
                cursor: 'pointer',
                boxShadow: isActive ? '0 4px 12px rgba(52, 39, 22, 0.25)' : 'none',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="activeApplePagePill"
                  transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '9999px',
                    background: '#342716',
                    zIndex: -1
                  }}
                />
              )}
              {page}
            </motion.button>
          );
        })}

        {/* Last Page indicator if truncating */}
        {pages[pages.length - 1] < totalPages && (
          <>
            {pages[pages.length - 1] < totalPages - 1 && <span style={{ color: '#9ca3af', padding: '0 4px' }}>...</span>}
            <button
              type="button"
              onClick={() => onPageChange(totalPages)}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#4d463d',
                fontWeight: '600',
                padding: '6px 12px',
                borderRadius: '9999px',
                cursor: 'pointer'
              }}
            >
              {totalPages}
            </button>
          </>
        )}

        {/* Next Button */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          style={{
            border: 'none',
            background: currentPage === totalPages ? 'transparent' : 'rgba(197, 168, 128, 0.15)',
            color: currentPage === totalPages ? '#d1d5db' : '#342716',
            fontWeight: '700',
            fontSize: '0.85rem',
            padding: '6px 14px',
            borderRadius: '9999px',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          Next
        </motion.button>
      </div>
    </div>
  );
}
