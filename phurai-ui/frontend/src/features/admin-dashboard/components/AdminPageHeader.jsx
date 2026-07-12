import React from 'react';

/**
 * AdminPageHeader — page-level header for Admin subpages.
 * Primary action button uses sfx-btn--gold to match the system design.
 *
 * Props:
 * - title: Title text.
 * - description: Subtext description (optional).
 * - primaryAction: Optional object for action button: { label: 'Button text', onClick: () => {} }
 */
export default function AdminPageHeader({ title, description, primaryAction }) {
  return (
    <div className="adp-toolbar" style={{ marginBottom: 20 }}>
      <div>
        <h1 className="adp-page-title">{title}</h1>
        {description && <p className="adp-subtitle">{description}</p>}
      </div>
      {primaryAction && (
        <button
          type="button"
          onClick={primaryAction.onClick}
          className="sfx-btn sfx-btn--gold sfx-btn--md"
        >
          {primaryAction.label}
        </button>
      )}
    </div>
  );
}
