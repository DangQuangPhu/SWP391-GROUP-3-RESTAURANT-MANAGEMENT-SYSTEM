import React from "react";

export function Pagination({ currentPage, totalPages, onPageChange, totalCount, limit = 20 }) {
  if (totalPages <= 1 && !totalCount) return null;

  const handlePrev = () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1);
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      let startPage = Math.max(1, currentPage - 2);
      let endPage = Math.min(totalPages, currentPage + 2);

      if (currentPage <= 3) {
        endPage = maxVisiblePages;
      } else if (currentPage >= totalPages - 2) {
        startPage = totalPages - maxVisiblePages + 1;
      }

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }
    return pages;
  };

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "16px 24px",
      borderTop: "1px solid rgba(0,0,0,0.05)",
      background: "#fff",
      borderBottomLeftRadius: "inherit",
      borderBottomRightRadius: "inherit"
    }}>
      <div style={{ fontSize: "13px", color: "#6b7280" }}>
        {totalCount > 0 ? (
          <span>
            Showing <strong>{((currentPage - 1) * limit) + 1}</strong> to <strong>{Math.min(currentPage * limit, totalCount)}</strong> of <strong>{totalCount}</strong> results
          </span>
        ) : (
          <span>No results</span>
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            onClick={handlePrev}
            disabled={currentPage === 1}
            style={{
              padding: "6px 12px",
              border: "1px solid #e5e7eb",
              borderRadius: "6px",
              background: currentPage === 1 ? "#f9fafb" : "#fff",
              color: currentPage === 1 ? "#9ca3af" : "#374151",
              fontSize: "13px",
              fontWeight: 500,
              cursor: currentPage === 1 ? "not-allowed" : "pointer"
            }}
          >
            Prev
          </button>
          
          {getPageNumbers().map(page => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              style={{
                padding: "6px 12px",
                border: "1px solid",
                borderColor: currentPage === page ? "#3b82f6" : "#e5e7eb",
                borderRadius: "6px",
                background: currentPage === page ? "#eff6ff" : "#fff",
                color: currentPage === page ? "#1d4ed8" : "#374151",
                fontSize: "13px",
                fontWeight: currentPage === page ? 600 : 500,
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
            >
              {page}
            </button>
          ))}
          
          <button
            onClick={handleNext}
            disabled={currentPage === totalPages}
            style={{
              padding: "6px 12px",
              border: "1px solid #e5e7eb",
              borderRadius: "6px",
              background: currentPage === totalPages ? "#f9fafb" : "#fff",
              color: currentPage === totalPages ? "#9ca3af" : "#374151",
              fontSize: "13px",
              fontWeight: 500,
              cursor: currentPage === totalPages ? "not-allowed" : "pointer"
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
