function SectionHeader({ title, className = '' }) {
  return (
    <div className={`phurai-section-header ${className}`.trim()}>
      <h2>{title}</h2>
      <span className="phurai-section-header__divider" aria-hidden="true" />
    </div>
  );
}

export default SectionHeader;
