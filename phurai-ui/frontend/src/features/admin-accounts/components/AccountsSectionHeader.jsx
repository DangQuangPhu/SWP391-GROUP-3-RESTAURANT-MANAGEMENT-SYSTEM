import React from 'react';

export default function AccountsSectionHeader({ title, subtitle, count }) {
  return (
    <header className="sfx-card__head sfx-card__head--dashboard">
      <div>
        <h3 className="sfx-card__title sfx-card__title--dashboard">{title}</h3>
        {subtitle && <p className="sfx-muted sfx-card__subtitle--dashboard">{subtitle}</p>}
      </div>
      {count != null && (
        <span className="sfx-muted sfx-card__counter--dashboard">{count}</span>
      )}
    </header>
  );
}
