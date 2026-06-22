import React from 'react';

/**
 * Reusable page header component for admin views.
 * 
 * Props:
 * - title: Title text.
 * - description: Subtext description (optional).
 * - primaryAction: Optional object for action button: { label: 'Button text', onClick: () => {} }
 */
export default function AdminPageHeader({ title, description, primaryAction }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-5 border-b border-gray-100">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      {primaryAction && (
        <div className="flex-shrink-0">
          <button
            type="button"
            onClick={primaryAction.onClick}
            className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-white bg-[#8c764b] hover:bg-[#846d44] active:bg-[#725e39] rounded-lg shadow-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8c764b]"
          >
            {primaryAction.label}
          </button>
        </div>
      )}
    </div>
  );
}
