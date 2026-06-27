import React from 'react';

// Base Shimmer block
export function Skeleton({ className = '', variant = 'rect' }) {
  const shapeClass =
    variant === 'circle'
      ? 'rounded-full'
      : variant === 'text'
      ? 'rounded h-4'
      : 'rounded-lg';
  return <div className={`shimmer ${shapeClass} ${className}`} />;
}

// KPI / Stat Card Skeleton (Grid of 4 cards)
export function KpiSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col justify-between h-[140px]"
        >
          <div className="flex justify-between items-start">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <Skeleton className="w-16 h-4" />
          </div>
          <div className="space-y-2 mt-4">
            <Skeleton className="w-24 h-8" />
            <Skeleton className="w-32 h-4" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Table Row Skeleton
export function TableSkeleton({ cols = 4, rows = 5 }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden w-full">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              {Array.from({ length: cols }).map((_, idx) => (
                <th key={idx} className="px-6 py-4">
                  <Skeleton className="w-20 h-4 bg-gray-200" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {Array.from({ length: rows }).map((_, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-gray-50/50">
                {Array.from({ length: cols }).map((_, colIdx) => (
                  <td key={colIdx} className="px-6 py-4">
                    <Skeleton className="w-32 h-4" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Form Field Skeleton (Grid + Button)
export function FormSkeleton({ items = 6 }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: items }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="w-28 h-4" />
            <Skeleton className="w-full h-10" />
          </div>
        ))}
      </div>
      <div className="flex justify-end pt-4">
        <Skeleton className="w-32 h-10" />
      </div>
    </div>
  );
}

// Grid Card Skeleton (for dishes, tables, etc.)
export function CardGridSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm flex flex-col h-[280px]"
        >
          <Skeleton className="w-full h-40 rounded-t-xl rounded-b-none" />
          <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
            <div className="space-y-2">
              <Skeleton className="w-3/4 h-5" />
              <Skeleton className="w-1/2 h-4" />
            </div>
            <div className="flex justify-between items-center mt-2">
              <Skeleton className="w-20 h-6" />
              <Skeleton className="w-24 h-8" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Main Default export grouping all Skeletons
export default Skeleton;
