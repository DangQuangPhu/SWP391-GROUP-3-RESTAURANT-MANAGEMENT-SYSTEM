/* Small reusable primitives shared across staff dashboard sections. */
import Icon from "@/components/staff/StaffIcons.jsx";

export function StatusBadge({ tone = "muted", children }) {
  return <span className={`sfx-badge sfx-badge--${tone}`}>{children}</span>;
}

export function SectionHead({ title, subtitle, actions }) {
  return (
    <div className="sfx-sechead">
      <div>
        <h2 className="sfx-sechead__title">{title}</h2>
        {subtitle ? <p className="sfx-sechead__sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="sfx-sechead__actions">{actions}</div> : null}
    </div>
  );
}

export function Toolbar({ children }) {
  return <div className="sfx-toolbar">{children}</div>;
}

export function SearchField({ value, onChange, placeholder = "Search…" }) {
  return (
    <label className="sfx-search">
      <Icon name="search" size={16} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export function Button({
  children,
  onClick,
  variant = "ghost",
  size = "md",
  icon,
  type = "button",
  disabled = false,
}) {
  return (
    <button
      type={type}
      className={`sfx-btn sfx-btn--${variant} sfx-btn--${size}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon ? <Icon name={icon} size={size === "sm" ? 14 : 16} /> : null}
      {children ? <span>{children}</span> : null}
    </button>
  );
}

export function EmptyState({ icon = "search", title, hint }) {
  return (
    <div className="sfx-empty">
      <span className="sfx-empty__icon">
        <Icon name={icon} size={22} />
      </span>
      <p className="sfx-empty__title">{title}</p>
      {hint ? <p className="sfx-empty__hint">{hint}</p> : null}
    </div>
  );
}

export function Card({ title, action, children, className = "" }) {
  return (
    <section className={`sfx-card ${className}`}>
      {(title || action) && (
        <header className="sfx-card__head">
          {title ? <h3 className="sfx-card__title">{title}</h3> : <span />}
          {action || null}
        </header>
      )}
      <div className="sfx-card__body">{children}</div>
    </section>
  );
}

export function NotConnectedNote({ children }) {
  return (
    <div className="sfx-note">
      <Icon name="spark" size={15} />
      <span>{children}</span>
    </div>
  );
}
