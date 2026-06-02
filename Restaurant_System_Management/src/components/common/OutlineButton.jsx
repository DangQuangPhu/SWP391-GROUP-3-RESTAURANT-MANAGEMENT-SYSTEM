function OutlineButton({ children, className = '', type = 'button', onClick }) {
  return (
    <button type={type} className={`phurai-btn-outline ${className}`.trim()} onClick={onClick}>
      {children}
    </button>
  );
}

export default OutlineButton;
